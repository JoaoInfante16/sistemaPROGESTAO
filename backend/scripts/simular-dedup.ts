#!/usr/bin/env tsx
/**
 * Reprocessa as noticias ja gravadas pelo dedup ATUAL do codigo e mostra o que
 * teria sido fundido — sem gravar nada.
 *
 * Uso:
 *   cd backend
 *   npx tsx scripts/simular-dedup.ts [YYYY-MM-DD]     (default: 2026-08-18)
 *
 * 🚨 Por que existe: mudanca de dedup nao tem ensaio. Staging e producao usam o
 * MESMO Supabase, e uma fusao errada nao volta com `git revert` — quando duas
 * linhas viram uma, o texto e reescrito e o embedding regravado. Entao a decisao
 * de subir se toma AQUI, lendo o que teria acontecido.
 *
 * Fidelidade: usa o `findGeoTemporalCandidates` de verdade (o portao real) e so
 * descarta os candidatos que ainda NAO existiam quando a noticia entrou — senao
 * a simulacao veria o futuro.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { db } from '../src/database/queries';
import { confirmDuplicateWithGPT } from '../src/services/deduplication';
import { cosineSimilarity } from '../src/utils/helpers';
import { configManager } from '../src/services/configManager';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const MAX_CANDIDATOS_AO_GPT = 3;

async function main() {
  const desde = process.argv[2] || '2026-08-18';
  const limiar = await configManager.getNumber('dedup_similarity_threshold');
  console.log(`Simulando desde ${desde} · limiar do painel = ${limiar}\n`);

  const { data } = await sb
    .from('news')
    .select('id, titulo, resumo, cidade, estado, tipo_crime, data_ocorrencia, created_at, embedding')
    .gte('created_at', desde)
    .order('created_at');

  const linhas = (data as any[]).map((r) => ({
    ...r,
    emb: typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding,
  }));
  const nascimento = new Map<string, string>();
  for (const l of linhas) nascimento.set(l.id, l.created_at);

  let fusoes = 0;
  let gptCalls = 0;

  for (const nova of linhas) {
    const candidatos = await db.findGeoTemporalCandidates(nova.cidade, nova.data_ocorrencia, nova.estado);
    const anteriores = candidatos.filter((c) => {
      const nasceu = nascimento.get(c.id);
      // Candidato de antes de 18/08 nao esta no mapa — existia, entao vale.
      return c.id !== nova.id && (!nasceu || nasceu < nova.created_at);
    });

    const ranking = anteriores
      .filter((c) => Array.isArray(c.embedding) && c.embedding.length === 1536)
      .map((c) => ({ c, score: cosineSimilarity(nova.emb, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .filter((r) => r.score >= limiar)
      .slice(0, MAX_CANDIDATOS_AO_GPT);

    for (const { c, score } of ranking) {
      gptCalls++;
      const r = await confirmDuplicateWithGPT(
        { titulo: nova.titulo, resumo: nova.resumo },
        { titulo: c.titulo, resumo: c.resumo },
      );
      if (!r.isDupe) continue;
      fusoes++;
      console.log(`FUNDE  score ${score.toFixed(3)}  [${nova.cidade}]`);
      console.log(`   nova : ${nova.titulo}  (${nova.tipo_crime})`);
      console.log(`   nela : ${c.titulo}  (${c.tipo_crime})`);
      console.log();
      break;
    }
  }

  console.log('='.repeat(64));
  console.log(`  ${linhas.length} noticias · ${fusoes} teriam sido fundidas · ${gptCalls} chamadas ao GPT`);
  console.log(`  media de ${(gptCalls / linhas.length).toFixed(2)} chamadas por noticia`);
  console.log('='.repeat(64));
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
