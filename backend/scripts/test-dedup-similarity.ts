#!/usr/bin/env tsx
/**
 * Testa cosine similarity entre resumos de noticias reais que DEVERIAM
 * ter sido agrupadas pelo dedup camada 2 mas viraram cards separados.
 *
 * Uso:
 *   cd backend
 *   npx tsx scripts/test-dedup-similarity.ts
 *
 * Caso real: 17/04/2026, homicidio do "homem morto a pauladas" em Armacao do
 * Pantano do Sul, Florianopolis. Quatro coberturas diferentes do mesmo evento
 * (vitima Marcos A.S., autor irmao, mae testemunha). Viraram 4 cards no app.
 *
 * Objetivo: ver se cosine entre os pares fica acima ou abaixo do threshold
 * atual (0.85). Se abaixo, threshold rigido demais pra variacao editorial.
 */

import 'dotenv/config';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('[ERROR] OPENAI_API_KEY nao encontrada em backend/.env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });
const MODEL = 'text-embedding-3-small';
const CURRENT_THRESHOLD = 0.85;

interface Resumo {
  label: string;
  text: string;
}

// Metadata comum a todos (cidade+bairro+data+tipo) — ancora estrutural
const METADATA_PREFIX = 'homicidio Florianópolis Armação do Pântano do Sul 2026-04-17';

// Os 4 resumos extraidos das screenshots do app (17/04/2026, mesmo evento)
const RESUMOS: Resumo[] = [
  {
    label: 'R1 (encomenda/foragido)',
    text: 'Um homem foi morto a pauladas em Florianópolis, supostamente a mando de seu próprio irmão, que foi preso em flagrante. O autor direto do homicídio está foragido.',
  },
  {
    label: 'R2 (Marcos A.S./irmão preso)',
    text: 'Marcos A. S. foi morto a pauladas em Florianópolis, com suspeitas de que o crime foi encomendado pelo próprio irmão. A Polícia Militar identificou o autor das agressões e investiga o caso.',
  },
  {
    label: 'R3 (local/35 anos/horário)',
    text: 'Um homem de 35 anos foi assassinado a pauladas no bairro Armação do Pântano do Sul, em Florianópolis. O crime ocorreu no início da noite de quinta-feira e a vítima não resistiu aos ferimentos.',
  },
  {
    label: 'R4 (frente da mãe/discussão)',
    text: 'Um homem de 35 anos foi morto a pauladas na frente da mãe em Florianópolis, após uma discussão que evoluiu para agressão. A polícia investiga o caso e um suspeito foi identificado através de imagens de monitoramento.',
  },
];

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

async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

interface Pair {
  a: string;
  b: string;
  score: number;
}

function computePairs(labels: string[], embeddings: number[][]): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      pairs.push({
        a: labels[i],
        b: labels[j],
        score: cosineSimilarity(embeddings[i], embeddings[j]),
      });
    }
  }
  return pairs;
}

function stats(pairs: Pair[]): { min: number; max: number; avg: number } {
  const scores = pairs.map((p) => p.score);
  return {
    min: Math.min(...scores),
    max: Math.max(...scores),
    avg: scores.reduce((s, v) => s + v, 0) / scores.length,
  };
}

async function main(): Promise<void> {
  console.log(`\n=== Teste de cosine similarity — raw vs enriched ===`);
  console.log(`Modelo: ${MODEL}`);
  console.log(`Threshold atual do dedup: ${CURRENT_THRESHOLD}`);
  console.log(`Metadata prefix: "${METADATA_PREFIX}"\n`);

  // RAW: embedding so do resumo
  console.log('Gerando embeddings RAW...');
  const rawEmb = await Promise.all(RESUMOS.map((r) => embed(r.text)));

  // ENRICHED: prefixo de metadata + resumo
  console.log('Gerando embeddings ENRICHED (com prefixo de metadata)...');
  const enrichedEmb = await Promise.all(
    RESUMOS.map((r) => embed(`${METADATA_PREFIX}\n${r.text}`))
  );

  const labels = RESUMOS.map((r) => r.label);
  const rawPairs = computePairs(labels, rawEmb);
  const enrichedPairs = computePairs(labels, enrichedEmb);

  // Tabela comparativa
  console.log('\n=== Comparacao par a par ===');
  console.log('Par'.padEnd(55) + 'RAW'.padEnd(10) + 'ENRICHED'.padEnd(10) + 'Δ');
  console.log('-'.repeat(85));
  for (let k = 0; k < rawPairs.length; k++) {
    const r = rawPairs[k];
    const e = enrichedPairs[k];
    const delta = e.score - r.score;
    const label = `${r.a}  vs  ${r.b}`;
    const sign = delta >= 0 ? '+' : '';
    console.log(
      label.padEnd(55) +
      r.score.toFixed(4).padEnd(10) +
      e.score.toFixed(4).padEnd(10) +
      `${sign}${delta.toFixed(4)}`
    );
  }

  const rawStats = stats(rawPairs);
  const enrichedStats = stats(enrichedPairs);

  console.log('\n=== Stats ===');
  console.log(`RAW:      min=${rawStats.min.toFixed(4)}  max=${rawStats.max.toFixed(4)}  avg=${rawStats.avg.toFixed(4)}`);
  console.log(`ENRICHED: min=${enrichedStats.min.toFixed(4)}  max=${enrichedStats.max.toFixed(4)}  avg=${enrichedStats.avg.toFixed(4)}`);
  console.log(`Mudanca media: ${(enrichedStats.avg - rawStats.avg >= 0 ? '+' : '')}${(enrichedStats.avg - rawStats.avg).toFixed(4)}`);

  console.log('\n=== Simulacao de thresholds ===');
  console.log('threshold'.padEnd(12) + 'RAW merges'.padEnd(14) + 'ENRICHED merges');
  console.log('-'.repeat(45));
  for (const t of [0.85, 0.8, 0.78, 0.75, 0.7, 0.65]) {
    const rawM = rawPairs.filter((p) => p.score >= t).length;
    const enrM = enrichedPairs.filter((p) => p.score >= t).length;
    console.log(`  ${t.toFixed(2)}`.padEnd(12) + `${rawM}/${rawPairs.length}`.padEnd(14) + `${enrM}/${enrichedPairs.length}`);
  }
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
