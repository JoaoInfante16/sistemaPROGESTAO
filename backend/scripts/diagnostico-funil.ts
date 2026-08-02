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
  runIntraBatchDedup, deduplicateResults, searchProvider, RejectedUrl,
} from '../src/jobs/pipeline/pipelineCore';
import { runIntraBatchDedupLayered } from '../src/jobs/pipeline/intraBatchDedupLayered';
import { configManager } from '../src/services/configManager';
import { rateLimiter } from '../src/services/rateLimiter';
import { config } from '../src/config';
import { buildManualSearchQueries } from '../src/services/search/queryTemplates';
import { getMetroRegionForCities } from '../src/services/location/metroRegion';
import { newsMaxPorQuery } from '../src/services/search/manualSearchCaps';

const cidade = process.argv[2] || 'Salvador';
const estado = process.argv[3] || 'Bahia';
const periodoDias = parseInt(process.argv[4] || '30', 10);
const TETO = parseInt(process.argv[5] || '25', 10);
const HORIZONTE = 180; // casa com manual_search_horizon_days
const NEWS_MAX = newsMaxPorQuery(periodoDias);

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

  // STAGE 1 — igual ao worker desde a 8.1: queries em PARALELO, paginas em lote.
  // O ramo WEB entra junto (o worker roda os dois), governado pela mesma config.
  const webEnabled = await configManager.getBoolean('manual_search_web_enabled');
  const sourceTypeMap = new Map<string, string>();

  // ORDEM IMPORTA e espelha o worker: ele empilha o WEB PRIMEIRO e o news
  // depois (collectManualSearchUrls). Como o teto de analise corta pelo fim da
  // lista, quem vem primeiro tem prioridade — ou seja, hoje o web passa na
  // frente do news. Se este script inverter, a medicao mente.
  const tarefas: Array<{ rotulo: string; fonte: string; p: Promise<Array<{ url: string; title: string; snippet: string }>> }> = [];

  if (webEnabled) {
    tarefas.push({
      rotulo: `web:  "${queries[0]}"`,
      fonte: 'web',
      p: rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(queries[0], {
          maxResults: 30, dateRestrict: `d${periodoDias}`, searchMode: 'web',
          location: { city: cidade, state: estado, country: 'BR' },
        }),
      ),
    });
  } else {
    console.log('  (ramo web DESLIGADO por config)');
  }

  for (const q of queries) {
    tarefas.push({
      rotulo: `news: "${q}"`,
      fonte: 'news',
      p: rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(q, {
          maxResults: NEWS_MAX, dateRestrict: `d${periodoDias}`, searchMode: 'news',
          pageConcurrency: 4,
          location: { city: cidade, state: estado, country: 'BR' },
        }),
      ),
    });
  }

  const settled = await Promise.allSettled(tarefas.map((t) => t.p));
  const brutos: Array<{ url: string; title: string; snippet: string }> = [];
  settled.forEach((s, i) => {
    const t = tarefas[i];
    if (s.status === 'fulfilled') {
      console.log(`  ${t.rotulo} → ${s.value.length}`);
      for (const r of s.value) {
        // Primeira fonte a trazer a URL fica com o credito, igual ao worker.
        if (!sourceTypeMap.has(r.url)) sourceTypeMap.set(r.url, t.fonte);
      }
      brutos.push(...s.value);
    } else {
      console.log(`  ${t.rotulo} FALHOU: ${String((s.reason as Error)?.message).substring(0, 80)}`);
    }
  });
  const urls = deduplicateResults(brutos);
  const soWeb = urls.filter((u) => sourceTypeMap.get(u.url) === 'web').length;
  if (webEnabled) console.log(`  → das ${urls.length} unicas, ${soWeb} vieram do ramo web`);
  console.log(`\n1) BUSCA .............. ${brutos.length} brutos → ${urls.length} unicos (teto ${NEWS_MAX}/query)`);

  // ALCANCE DA COLETA — a pergunta que a 8.4 existe pra responder: a busca chegou
  // mesmo ao periodo pedido, ou parou uns dias atras e chamou de 30?
  const datas = urls.map((u) => u.publishedAt).filter((d): d is string => !!d).sort();
  const janelaInicio = new Date(Date.now() - periodoDias * 86400_000).toISOString().split('T')[0];
  if (datas.length > 0) {
    const maisVelha = datas[0];
    const diasCobertos = Math.round((Date.now() - new Date(maisVelha).getTime()) / 86400_000);
    const cobriu = maisVelha <= janelaInicio;
    console.log(`   alcance: ${maisVelha} a ${datas[datas.length - 1]} → ${diasCobertos}d de ${periodoDias}d pedidos ${cobriu ? '✅' : `⚠️ FALTOU (janela comeca em ${janelaInicio})`}`);
    console.log(`   ${urls.length - datas.length} sem data na SERP`);
  }

  // STAGE 2 — Filter0
  const f0 = runFilter0(urls, true, rejected, LOG);
  console.log(`2) FILTER0 (regex) .... ${urls.length} → ${f0.length}`);

  // STAGE 3 — Filter1
  const f1 = (await runFilter1(f0, rejected, LOG)).passed;
  console.log(`3) FILTER1 (GPT) ...... ${f0.length} → ${f1.length}`);

  // Ordena dentro-da-janela primeiro, igual ao worker (8.4)
  const foraDaJanela = (r: { publishedAt?: string }): number =>
    r.publishedAt && r.publishedAt < janelaInicio ? 1 : 0;
  const ordenado = [...f1].sort((a, b) => foraDaJanela(a) - foraDaJanela(b));

  const analisar = ordenado.slice(0, TETO);
  if (ordenado.length > TETO) {
    const cortadosDentro = ordenado.slice(TETO).filter((r) => foraDaJanela(r) === 0).length;
    console.log(`   (teto: analisando so ${TETO} de ${ordenado.length} — ${cortadosDentro} cortados estavam dentro da janela)`);
  }

  // STAGE 4 — Jina
  const conteudos = await runContentFetch(analisar, 10, rejected, LOG);
  console.log(`4) JINA (conteudo) .... ${analisar.length} → ${conteudos.length}`);

  // STAGE 5 — Filter2 + pos-filtros
  const r2 = await runFilter2WithEmbedding(
    conteudos,
    { maxContentChars: 8000, minConfidence: 0.5 },
    rejected, LOG,
    { periodoDias, estado, cidades: [cidade], classificar: true, cidadesRegiao, horizonteDias: HORIZONTE },
    sourceTypeMap,
  );
  console.log(`5) FILTER2 ............ ${conteudos.length} → ${r2.extractions.length}`);

  // STAGE 6 — dedup, nos DOIS algoritmos, pra medir o ganho da 8.3
  const threshold = await configManager.getNumber('dedup_similarity_threshold');
  const antigo = runIntraBatchDedup(r2.extractions, '[antigo]', threshold);
  const novo = await runIntraBatchDedupLayered(r2.extractions, '[camadas]', { similarityThreshold: threshold });
  console.log(`6) DEDUP (threshold ${threshold})`);
  console.log(`     antigo (so cosine) .... ${r2.extractions.length} → ${antigo.consolidated.length}`);
  console.log(`     camadas (8.3) ......... ${r2.extractions.length} → ${novo.consolidated.length}  [${novo.bloqueadosPelaTrava} pares barrados pela trava]`);
  const recuperadas = novo.consolidated.length - antigo.consolidated.length;
  if (recuperadas > 0) console.log(`     → ${recuperadas} ocorrencia(s) que o antigo fundia por engano`);

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

  // ---- Separado por balde (8.2), ja consolidado pelo dedup em camadas
  const finais = novo.consolidated;
  const principal = finais.filter((e) => !e.fora_do_periodo && !e.cidade_vizinha);
  const regiao = finais.filter((e) => e.cidade_vizinha);
  const foraPeriodo = finais.filter((e) => e.fora_do_periodo && !e.cidade_vizinha);

  const linha = (e: (typeof finais)[number]): string =>
    `  ${e.data_ocorrencia} | ${e.tipo_crime.padEnd(20)} | ${e.cidade}/${e.estado || '?'} | conf ${e.confianca}`;

  // ---- O ramo web pagou por si? (a pergunta que decide liga/desliga)
  if (webEnabled) {
    const porFonte = (arr: typeof finais) => ({
      web: arr.filter((e) => e.sourceType === 'web').length,
      news: arr.filter((e) => e.sourceType !== 'web').length,
    });
    const f = porFonte(finais);
    console.log('\n' + '='.repeat(76));
    console.log('RAMO WEB — vale a pena?');
    console.log(`  URLs coletadas so pelo web ..... ${soWeb} de ${urls.length}`);
    console.log(`  resultados FINAIS vindos do web  ${f.web} de ${finais.length}`);
    console.log(`  custo do ramo web .............. ~$${(3 * 0.0015).toFixed(4)} de coleta + Jina/GPT dos que sobreviveram`);
    if (f.web === 0) console.log('  → nao entregou NADA nesta busca');
  }

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
