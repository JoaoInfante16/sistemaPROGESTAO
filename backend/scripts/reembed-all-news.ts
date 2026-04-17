#!/usr/bin/env tsx
/**
 * Re-embedda todas as noticias da tabela `news` usando o novo formato enriched
 * (tipo + estado + cidade + bairro + data como prefixo do resumo).
 *
 * Uso:
 *   cd backend
 *   npx tsx scripts/reembed-all-news.ts         # dry-run: so conta quantas seriam tocadas
 *   npx tsx scripts/reembed-all-news.ts --apply # aplica de verdade
 *
 * Porque: o embedding usado ate 2026-04-17 era raw (so o resumo). Variacao
 * editorial entre veiculos baixava muito o cosine similarity e falhava dedup.
 * Novo formato ancora o vetor em metadata estrutural. Script migra noticias
 * ja gravadas pra o novo formato, mantendo dedup consistente entre novas e antigas.
 *
 * Custo: ~$0.00002/noticia (text-embedding-3-small).
 * Tempo: depende da quantidade + rate limit OpenAI.
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { buildEmbeddingText } from '../src/jobs/pipeline/pipelineCore';

const apiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!apiKey) {
  console.error('[ERROR] OPENAI_API_KEY nao encontrada em backend/.env');
  process.exit(1);
}
if (!supabaseUrl || !supabaseKey) {
  console.error('[ERROR] SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_KEY) obrigatorias em backend/.env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });
const supabase = createClient(supabaseUrl, supabaseKey);
const MODEL = 'text-embedding-3-small';
const BATCH_DELAY_MS = 100; // 10 req/s safety margin (OpenAI permite muito mais)

const APPLY = process.argv.includes('--apply');

interface NewsRow {
  id: string;
  tipo_crime: string;
  estado: string | null;
  cidade: string;
  bairro: string | null;
  data_ocorrencia: string;
  resumo: string;
}

async function fetchAllNews(): Promise<NewsRow[]> {
  const rows: NewsRow[] = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('news')
      .select('id, tipo_crime, estado, cidade, bairro, data_ocorrencia, resumo')
      .eq('active', true)
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as NewsRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function embedText(text: string): Promise<{ vec: number[]; tokens: number }> {
  const res = await openai.embeddings.create({ model: MODEL, input: text });
  return {
    vec: res.data[0].embedding,
    tokens: res.usage?.total_tokens || 0,
  };
}

async function updateEmbedding(id: string, vec: number[]): Promise<void> {
  const vecStr = `[${vec.join(',')}]`;
  const { error } = await supabase
    .from('news')
    .update({ embedding: vecStr })
    .eq('id', id);

  if (error) throw new Error(`update ${id} failed: ${error.message}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log(`\n=== Re-embed all news (enriched format) ===`);
  console.log(`Modo: ${APPLY ? 'APPLY (escreve no banco)' : 'DRY-RUN (so conta)'}`);
  console.log(`Modelo: ${MODEL}\n`);

  console.log('Buscando noticias ativas...');
  const rows = await fetchAllNews();
  console.log(`  ${rows.length} noticias encontradas\n`);

  if (rows.length === 0) {
    console.log('Nada pra fazer.');
    return;
  }

  if (!APPLY) {
    console.log('DRY-RUN — rodaria re-embed em:');
    console.log(`  ${rows.length} noticias`);
    console.log(`  custo estimado: ~$${(rows.length * 0.00002).toFixed(4)}`);
    console.log(`  tempo estimado: ~${Math.ceil((rows.length * 0.2) / 60)}min (com ${BATCH_DELAY_MS}ms entre chamadas)`);
    console.log('\nRode com --apply pra executar de verdade.');
    return;
  }

  let totalTokens = 0;
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const text = buildEmbeddingText({
        tipo_crime: row.tipo_crime,
        estado: row.estado || undefined,
        cidade: row.cidade,
        bairro: row.bairro || undefined,
        data_ocorrencia: row.data_ocorrencia,
        resumo: row.resumo,
      });

      const { vec, tokens } = await embedText(text);
      totalTokens += tokens;

      await updateEmbedding(row.id, vec);
      ok++;

      if ((i + 1) % 10 === 0 || i === rows.length - 1) {
        console.log(`  ${i + 1}/${rows.length} processadas (ok=${ok}, failed=${failed}, tokens=${totalTokens})`);
      }

      await sleep(BATCH_DELAY_MS);
    } catch (err) {
      failed++;
      console.error(`  FAIL ${row.id}: ${(err as Error).message}`);
    }
  }

  console.log(`\n=== Fim ===`);
  console.log(`OK: ${ok}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total tokens: ${totalTokens}`);
  console.log(`Custo real: ~$${((totalTokens / 1_000_000) * 0.02).toFixed(4)}`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
