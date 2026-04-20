/**
 * Diagnóstico de deduplicação cross-scan
 *
 * Busca pares de artigos no banco que deveriam ter sido deduplicados
 * (mesma cidade + tipo_crime, data_ocorrencia próxima) mas existem como
 * registros separados. Calcula o score real de cosine similarity entre
 * os embeddings para mostrar qual threshold seria necessário.
 *
 * Uso: cd backend && npx tsx scripts/diagnose-dedup.ts
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

async function askGPT(resumo1: string, resumo2: string): Promise<string> {
  const prompt = `Do these two news summaries describe the SAME criminal incident?

Summary 1: "${resumo1}"
Summary 2: "${resumo2}"

They describe the SAME incident if the core event matches: same approximate location, same time frame, same type of crime, and details do not contradict each other.

They are DIFFERENT incidents if they clearly involve different victims/locations or contradictory facts.

Note: articles may cover different angles of the same event (victim found vs suspect arrested, early report vs follow-up) — these still count as the SAME incident.

Answer ONLY "YES" or "NO":`;
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 5,
    temperature: 0,
  });
  return res.choices[0].message.content?.trim().toUpperCase() ?? '?';
}

const LOOKBACK_DAYS = 7;
const DATE_WINDOW_DAYS = 2;

interface NewsRow {
  id: string;
  resumo: string;
  cidade: string;
  estado: string | null;
  tipo_crime: string;
  data_ocorrencia: string;
  bairro: string | null;
  created_at: string;
  embedding: number[] | string | null;
  confianca: number | null;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

function truncate(s: string, n = 70): string {
  return s && s.length > n ? s.slice(0, n) + '…' : (s || '-');
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function parseEmbedding(raw: number[] | string | null): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw as string); } catch { return null; }
}

async function main() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().split('T')[0];
  console.log(`\nBuscando artigos desde ${since} (últimos ${LOOKBACK_DAYS} dias)...\n`);

  const { data, error } = await supabase
    .from('news')
    .select('id, resumo, cidade, estado, tipo_crime, data_ocorrencia, bairro, created_at, embedding, confianca')
    .gte('created_at', since)
    .eq('active', true)
    .order('cidade')
    .order('tipo_crime')
    .order('data_ocorrencia')
    .limit(2000);

  if (error) {
    console.error('Erro ao buscar:', error.message);
    process.exit(1);
  }

  const rows = (data || []) as NewsRow[];
  console.log(`Total de artigos encontrados: ${rows.length}\n`);

  // Agrupar por cidade + tipo_crime
  const groups = new Map<string, NewsRow[]>();
  for (const row of rows) {
    const key = `${row.cidade}||${row.tipo_crime}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  interface SuspectPair {
    a: NewsRow;
    b: NewsRow;
    dateDiff: number;
    scanDiff: number;
    score: number | null;
  }

  const suspectPairs: SuspectPair[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const dateDiff = daysBetween(a.data_ocorrencia, b.data_ocorrencia);
        const scanDiff = daysBetween(a.created_at, b.created_at);
        if (dateDiff <= DATE_WINDOW_DAYS && scanDiff > 0.01) {
          const embA = parseEmbedding(a.embedding);
          const embB = parseEmbedding(b.embedding);
          const score = (embA && embB && embA.length === 1536 && embB.length === 1536)
            ? cosineSimilarity(embA, embB)
            : null;
          suspectPairs.push({ a, b, dateDiff, scanDiff, score });
        }
      }
    }
  }

  if (suspectPairs.length === 0) {
    console.log('✅ Nenhum par suspeito encontrado!\n');
    return;
  }

  // Ordenar por score desc (scores mais altos primeiro — mais prováveis de ser dedup real)
  suspectPairs.sort((x, y) => (y.score ?? -1) - (x.score ?? -1));

  console.log(`⚠️  ${suspectPairs.length} par(es) suspeito(s):\n`);
  console.log('='.repeat(130));

  for (const { a, b, dateDiff, scanDiff, score } of suspectPairs) {
    const scoreStr = score !== null ? score.toFixed(3) : 'N/A';
    const scoreFlag = score === null ? '❓' : score >= 0.80 ? '🔴 DEVERIA TER DEDUPLICADO' : score >= 0.70 ? '🟡 precisaria threshold ≤ 0.70' : '⚪ eventos diferentes?';

    console.log(`\n📍 ${a.cidade} — ${a.tipo_crime}`);
    console.log(`   Score: ${scoreStr}  ${scoreFlag}`);
    console.log(`   Δ data_ocorrencia: ${dateDiff.toFixed(1)} dia(s) | Δ scan: ${scanDiff.toFixed(1)} dia(s)`);
    console.log('');

    const tableRows = [
      ['Campo', 'Artigo A', 'Artigo B'],
      ['─'.repeat(18), '─'.repeat(55), '─'.repeat(55)],
      ['id', a.id, b.id],
      ['created_at', a.created_at.slice(0, 19).replace('T', ' '), b.created_at.slice(0, 19).replace('T', ' ')],
      ['data_ocorrencia', a.data_ocorrencia, b.data_ocorrencia],
      ['estado', a.estado ?? '(null)', b.estado ?? '(null)'],
      ['bairro', a.bairro ?? '(null)', b.bairro ?? '(null)'],
      ['resumo', truncate(a.resumo), truncate(b.resumo)],
    ];

    for (const [campo, va, vb] of tableRows) {
      console.log(`   ${campo.padEnd(18)} ${String(va).padEnd(55)} ${String(vb)}`);
    }
    // Simular Layer 1 nas duas direções (A procura B, B procura A)
    if (score !== null && score >= 0.80) {
      for (const [newer, older] of [[b, a], [a, b]] as [NewsRow, NewsRow][]) {
        const date = new Date(newer.data_ocorrencia);
        const dateFrom = new Date(date.getTime() - 86400000).toISOString().split('T')[0];
        const dateTo = new Date(date.getTime() + 86400000).toISOString().split('T')[0];

        let q = supabase
          .from('news')
          .select('id, bairro, data_ocorrencia, estado')
          .eq('cidade', newer.cidade)
          .eq('tipo_crime', newer.tipo_crime)
          .gte('data_ocorrencia', dateFrom)
          .lte('data_ocorrencia', dateTo)
          .eq('active', true)
          .neq('id', newer.id)
          .limit(20);

        if (newer.estado) q = q.eq('estado', newer.estado);
        if (newer.bairro && newer.bairro.trim().length > 0) {
          q = q.or(`bairro.eq.${newer.bairro},bairro.is.null`);
        }

        const { data: l1result, error: l1err } = await q;
        const foundOlder = (l1result || []).some((r: any) => r.id === older.id);
        const label = `Layer1(${newer.id.slice(0,8)}→busca ${older.id.slice(0,8)})`;
        if (l1err) {
          console.log(`   🔴 ${label}: ERRO — ${l1err.message}`);
        } else if (foundOlder) {
          console.log(`   ✅ ${label}: encontrou candidato (${(l1result||[]).length} total)`);
        } else {
          console.log(`   ❌ ${label}: NÃO encontrou → bug na Layer 1`);
          console.log(`      query: cidade=${newer.cidade} tipo=${newer.tipo_crime} data=[${dateFrom},${dateTo}] estado=${newer.estado ?? 'null'} bairro=${newer.bairro ?? 'null'}`);
        }
      }
      // Testar Layer 3 GPT (só uma vez por par)
      const gptAnswer = await askGPT(a.resumo, b.resumo);
      const gptFlag = gptAnswer === 'YES' ? '✅ YES → Layer 3 detectaria duplicata' : `❌ ${gptAnswer} → Layer 3 rejeitaria (BUG NO PROMPT)`;
      console.log(`   🤖 GPT Layer3: ${gptFlag}`);
    }
    console.log('─'.repeat(130));
  }

  // Resumo de scores
  console.log('\n📊 Distribuição de scores (só pares com embeddings válidos):');
  const withScores = suspectPairs.filter(p => p.score !== null);
  const buckets = [
    { label: '≥ 0.85 (threshold anterior)', min: 0.85, max: 1.01 },
    { label: '0.80–0.85 (threshold atual)', min: 0.80, max: 0.85 },
    { label: '0.70–0.80 (precisaria 0.70)', min: 0.70, max: 0.80 },
    { label: '< 0.70 (provavelmente diferentes)', min: 0, max: 0.70 },
  ];
  for (const b of buckets) {
    const count = withScores.filter(p => p.score! >= b.min && p.score! < b.max).length;
    console.log(`   ${b.label.padEnd(42)} ${count} par(es)`);
  }
  console.log(`   Sem embedding válido: ${suspectPairs.length - withScores.length} par(es)`);
  console.log('');
}

main().catch(console.error);
