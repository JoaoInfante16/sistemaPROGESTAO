// ============================================
// Funil completo da busca manual, com os MOTIVOS de rejeicao
// ============================================
// O worker so loga `rejectedUrls` e nao persiste (diferente do auto-scan, que
// grava em pipeline_rejected_urls). Entao, quando uma busca devolve pouco, nao
// da pra saber pelo banco ONDE morreu. Este script roda os mesmos stages e
// imprime o funil com os motivos.
//
// CUSTA DINHEIRO (Jina + GPT). Use teto baixo.
//
// Uso: npx tsx scripts/diagnostico-funil.ts "Salvador" "Bahia" 30 [teto]

import {
  runFilter0, runFilter1, runContentFetch, runFilter2WithEmbedding,
  deduplicateResults, searchProvider, RejectedUrl,
} from '../src/jobs/pipeline/pipelineCore';
import { rateLimiter } from '../src/services/rateLimiter';
import { config } from '../src/config';
import { buildManualSearchQueries } from '../src/services/search/queryTemplates';
import { getMetroRegionForCities } from '../src/services/location/metroRegion';

const cidade = process.argv[2] || 'Salvador';
const estado = process.argv[3] || 'Bahia';
const periodoDias = parseInt(process.argv[4] || '30', 10);
const TETO = parseInt(process.argv[5] || '25', 10);
const HORIZONTE = 365;

async function main(): Promise<void> {
  const rejected: RejectedUrl[] = [];
  const LOG = '[funil]';
  const queries = buildManualSearchQueries(cidade);

  console.log(`${cidade}/${estado} | ${periodoDias} dias | teto de analise: ${TETO} | horizonte: ${HORIZONTE}d`);
  console.log(`queries: ${JSON.stringify(queries)}`);
  console.log('='.repeat(76));

  // Regiao metropolitana — igual ao worker, uma chamada por busca
  const cidadesRegiao = await getMetroRegionForCities([cidade], estado);
  console.log(`\n0) REGIAO METROPOLITANA ... ${cidadesRegiao.length} municipios`);
  if (cidadesRegiao.length > 0) console.log(`   ${cidadesRegiao.join(', ')}`);

  // STAGE 1 — igual ao worker desde a 8.1: queries em PARALELO, paginas em lote
  const settled = await Promise.allSettled(
    queries.map((q) =>
      rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(q, {
          maxResults: 20, dateRestrict: `d${periodoDias}`, searchMode: 'news',
          pageConcurrency: 4,
          location: { city: cidade, state: estado, country: 'BR' },
        }),
      ),
    ),
  );
  const brutos: Array<{ url: string; title: string; snippet: string }> = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') {
      console.log(`  "${queries[i]}" → ${s.value.length}`);
      brutos.push(...s.value);
    } else {
      console.log(`  "${queries[i]}" FALHOU: ${String((s.reason as Error)?.message).substring(0, 80)}`);
    }
  });
  const urls = deduplicateResults(brutos);
  console.log(`\n1) BUSCA .............. ${brutos.length} brutos → ${urls.length} unicos`);

  // STAGE 2 — Filter0
  const f0 = runFilter0(urls, true, rejected, LOG);
  console.log(`2) FILTER0 (regex) .... ${urls.length} → ${f0.length}`);

  // STAGE 3 — Filter1
  const f1 = (await runFilter1(f0, rejected, LOG)).passed;
  console.log(`3) FILTER1 (GPT) ...... ${f0.length} → ${f1.length}`);

  const analisar = f1.slice(0, TETO);
  if (f1.length > TETO) console.log(`   (teto: analisando so ${TETO} de ${f1.length})`);

  // STAGE 4 — Jina
  const conteudos = await runContentFetch(analisar, 10, rejected, LOG);
  console.log(`4) JINA (conteudo) .... ${analisar.length} → ${conteudos.length}`);

  // STAGE 5 — Filter2 + pos-filtros
  const r2 = await runFilter2WithEmbedding(
    conteudos,
    { maxContentChars: 8000, minConfidence: 0.5 },
    rejected, LOG,
    { periodoDias, estado, cidades: [cidade], classificar: true, cidadesRegiao, horizonteDias: HORIZONTE },
  );
  console.log(`5) FILTER2 ............ ${conteudos.length} → ${r2.extractions.length}`);

  // ---- Motivos, agrupados
  console.log('\n' + '='.repeat(76));
  console.log('MOTIVOS DE REJEICAO POR STAGE');
  const porStage = new Map<string, RejectedUrl[]>();
  for (const r of rejected) {
    if (!porStage.has(r.stage)) porStage.set(r.stage, []);
    porStage.get(r.stage)!.push(r);
  }
  for (const [stage, itens] of porStage) {
    console.log(`\n  ${stage} — ${itens.length}`);
    for (const i of itens.slice(0, 15)) {
      console.log(`     ${i.reason}`);
      console.log(`        ${i.url.substring(0, 82)}`);
    }
    if (itens.length > 15) console.log(`     ... +${itens.length - 15}`);
  }

  // ---- Separado por balde (8.2)
  const principal = r2.extractions.filter((e) => !e.fora_do_periodo && !e.cidade_vizinha);
  const regiao = r2.extractions.filter((e) => e.cidade_vizinha);
  const foraPeriodo = r2.extractions.filter((e) => e.fora_do_periodo && !e.cidade_vizinha);

  const linha = (e: (typeof r2.extractions)[number]): string =>
    `  ${e.data_ocorrencia} | ${e.tipo_crime.padEnd(20)} | ${e.cidade}/${e.estado || '?'} | conf ${e.confianca}`;

  console.log('\n' + '='.repeat(76));
  console.log(`PRINCIPAL: ${principal.length}   (e o que o app mostra na lista, em body.results)`);
  for (const e of principal) console.log(linha(e));

  console.log(`\nEXTRAS — antes da 8.2 estes eram DESCARTADOS:`);
  console.log(`\n  regiao metropolitana: ${regiao.length}`);
  for (const e of regiao) console.log(linha(e));
  console.log(`\n  fora do periodo (ate ${HORIZONTE}d): ${foraPeriodo.length}`);
  for (const e of foraPeriodo) console.log(linha(e));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
