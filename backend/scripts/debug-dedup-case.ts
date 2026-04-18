#!/usr/bin/env tsx
/**
 * Debug de dedup: puxa noticias reais de um caso especifico e mostra
 * tipo_crime/estado/bairro + cosine entre todos os pares de embeddings.
 *
 * Uso:
 *   cd backend
 *   npx tsx scripts/debug-dedup-case.ts
 *
 * Objetivo: entender por que 2 casos do 17/04/2026 ficaram separados em
 * cards diferentes apesar de threshold 0.80 + embedding enriched.
 *
 * Caso A: Florianopolis, homicidio, 17/04/2026 (4 cards no app, 1 com 3 fontes)
 * Caso B: Campo Grande, subtração, 17/04/2026 (2 cards, furto radiador R$7mil)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[ERROR] SUPABASE_URL e SUPABASE_SERVICE_KEY obrigatorias em backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const THRESHOLD = 0.80;

interface NewsRow {
  id: string;
  tipo_crime: string;
  estado: string | null;
  cidade: string;
  bairro: string | null;
  data_ocorrencia: string;
  resumo: string;
  embedding: number[] | string | null;
  active: boolean;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

function parseEmbedding(emb: number[] | string | null): number[] | null {
  if (!emb) return null;
  if (Array.isArray(emb)) return emb;
  // Supabase pgvector retorna string "[0.1,0.2,...]"
  try {
    return JSON.parse(emb);
  } catch {
    return null;
  }
}

async function fetchSources(newsId: string): Promise<string[]> {
  const { data } = await supabase
    .from('news_sources')
    .select('url')
    .eq('news_id', newsId);
  return (data || []).map((r: { url: string }) => r.url);
}

async function investigate(
  label: string,
  filters: { cidade: string; dateFrom: string; dateTo: string; resumoContains?: string[] },
): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`CASO: ${label}`);
  console.log(`Filtro: cidade=${filters.cidade}, data=${filters.dateFrom}..${filters.dateTo}`);
  console.log('='.repeat(80));

  const { data, error } = await supabase
    .from('news')
    .select('id, tipo_crime, estado, cidade, bairro, data_ocorrencia, resumo, embedding, active')
    .eq('cidade', filters.cidade)
    .gte('data_ocorrencia', filters.dateFrom)
    .lte('data_ocorrencia', filters.dateTo)
    .eq('active', true);

  if (error) {
    console.error(`[ERROR] ${error.message}`);
    return;
  }

  let rows = (data as NewsRow[]) || [];

  // Filtro opcional por substring no resumo (pra pegar so o evento especifico)
  if (filters.resumoContains && filters.resumoContains.length > 0) {
    rows = rows.filter((r) =>
      filters.resumoContains!.some((kw) => r.resumo.toLowerCase().includes(kw.toLowerCase())),
    );
  }

  console.log(`\n${rows.length} noticia(s) encontrada(s)\n`);

  if (rows.length === 0) return;

  // Tabela com metadata
  console.log('--- Metadata por noticia ---');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sources = await fetchSources(r.id);
    console.log(`\n[${i}] id=${r.id}`);
    console.log(`    tipo_crime: "${r.tipo_crime}"`);
    console.log(`    estado: ${r.estado === null ? 'NULL' : `"${r.estado}"`}`);
    console.log(`    cidade: "${r.cidade}"`);
    console.log(`    bairro: ${r.bairro === null ? 'NULL' : `"${r.bairro}"`}`);
    console.log(`    data: ${r.data_ocorrencia}`);
    console.log(`    fontes: ${sources.length}`);
    sources.forEach((u, j) => console.log(`      ${j + 1}. ${u}`));
    console.log(`    resumo: "${r.resumo.slice(0, 120)}${r.resumo.length > 120 ? '...' : ''}"`);
  }

  // Cosine entre pares
  console.log('\n--- Cosine similarity entre pares ---');
  console.log('Threshold configurado no script:', THRESHOLD);
  console.log('');

  const embeddings = rows.map((r) => parseEmbedding(r.embedding));

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const ea = embeddings[i];
      const eb = embeddings[j];

      if (!ea || !eb) {
        console.log(`  [${i}] vs [${j}]: SEM EMBEDDING VALIDO (ea=${ea ? 'ok' : 'null'}, eb=${eb ? 'ok' : 'null'})`);
        continue;
      }
      if (ea.length !== 1536 || eb.length !== 1536) {
        console.log(`  [${i}] vs [${j}]: DIMENSAO INVALIDA (${ea.length} vs ${eb.length})`);
        continue;
      }

      const score = cosineSimilarity(ea, eb);
      const merged = score >= THRESHOLD ? 'MERGE' : 'skip';

      // Verifica tbm se camada 1 deixaria passar (mesmo tipo_crime + mesmo estado + bairro compativel)
      const r1 = rows[i];
      const r2 = rows[j];
      const tipoBate = r1.tipo_crime === r2.tipo_crime;
      const estadoBate = (r1.estado || null) === (r2.estado || null);
      const bairroBate =
        !r1.bairro || !r2.bairro || r1.bairro === r2.bairro;
      const camada1Passa = tipoBate && estadoBate && bairroBate;

      const flags: string[] = [];
      if (!tipoBate) flags.push(`TIPO_DIFF("${r1.tipo_crime}" vs "${r2.tipo_crime}")`);
      if (!estadoBate) flags.push(`ESTADO_DIFF(${r1.estado} vs ${r2.estado})`);
      if (!bairroBate) flags.push(`BAIRRO_DIFF("${r1.bairro}" vs "${r2.bairro}")`);

      console.log(
        `  [${i}] vs [${j}]: cosine=${score.toFixed(4)} ${merged.padEnd(5)} camada1=${camada1Passa ? 'PASS' : 'BLOCK'} ${flags.join(' ')}`,
      );
    }
  }
}

async function main(): Promise<void> {
  console.log('=== Debug dedup — casos reais do 17/04/2026 ===');

  // Caso A: Florianopolis — homicidio a pauladas
  await investigate('Florianopolis homicidio 17/04', {
    cidade: 'Florianópolis',
    dateFrom: '2026-04-16',
    dateTo: '2026-04-18',
    resumoContains: ['pauladas'],
  });

  // Caso B: Campo Grande — furto radiador R$7mil
  await investigate('Campo Grande furto radiador 17/04', {
    cidade: 'Campo Grande',
    dateFrom: '2026-04-16',
    dateTo: '2026-04-18',
    resumoContains: ['radiador', 'caminhão'],
  });

  console.log('\n=== Fim ===\n');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
