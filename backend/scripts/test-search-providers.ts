// ============================================
// Diagnostico do stage 1 da busca manual — pelo caminho REAL do app
// ============================================
// Reproduz o que o manualSearchWorker.collectManualSearchUrls faz: cidades em
// paralelo e, dentro de cada cidade, as queries curtas via rateLimiter.
//
// Roda nos DOIS modos pra medir o ganho da 8.1:
//   serie    = como era ate 01/08 (queries uma a uma, paginacao serial)
//   paralelo = como ficou (queries juntas + paginas em lote) — o caminho atual
//
// IMPORTANTE: nao testar a API por fora (curl, fetch solto). Ja custou caro —
// em 2026-08-01 os testes diretos davam 5/5 enquanto o app travava, porque o
// app dispara requisicoes concorrentes e o teste disparava uma de cada vez.
//
// Uso:
//   npx tsx scripts/test-search-providers.ts                                -> 1 cidade, os 2 modos
//   npx tsx scripts/test-search-providers.ts "São José,Palhoça" "Santa Catarina" 30
//   npx tsx scripts/test-search-providers.ts "Salvador" "Bahia" 30 paralelo  -> so um modo

import { searchProvider } from '../src/jobs/pipeline/pipelineCore';
import { rateLimiter } from '../src/services/rateLimiter';
import { config } from '../src/config';
import { buildManualSearchQueries } from '../src/services/search/queryTemplates';
import { inicioDaJanela } from '../src/services/search/serpDateParser';

const cidades = (process.argv[2] || 'Florianópolis').split(',').map((c) => c.trim());
const estado = process.argv[3] || 'Santa Catarina';
const periodoDias = parseInt(process.argv[4] || '30', 10);
const modoArg = (process.argv[5] || 'ambos').toLowerCase();
const dateRestrict = `d${periodoDias}`;

// Mesmos tetos do worker
const MAX_POR_QUERY = 20;
const PAGE_CONCURRENCY = 4;

type Modo = 'serie' | 'paralelo';
interface Medida { cidade: string; urls: Set<string>; ms: number; reqs: number }

function buscar(cidade: string, q: string, lote: number): Promise<{ urls: string[]; reqs: number }> {
  return rateLimiter
    .schedule(config.searchBackend, () =>
      searchProvider.search(q, {
        maxResults: MAX_POR_QUERY,
        dateRestrict,
        searchMode: 'news',
        ...(lote > 1 ? { pageConcurrency: lote } : {}),
        location: { city: cidade, state: estado, country: 'BR' },
      }),
    )
    .then((r) => ({
      urls: r.map((x) => x.url),
      // lastRequestCount e um contador unico do provider; com chamadas
      // concorrentes ele nao e atribuivel a uma query so. Serve como estimativa
      // grosseira — o numero exato de requisicoes esta no log do provider.
      reqs: searchProvider.lastRequestCount ?? 0,
    }));
}

async function porCidade(cidade: string, modo: Modo): Promise<Medida> {
  const queries = buildManualSearchQueries(cidade);
  const urls = new Set<string>();
  const t0 = Date.now();
  let reqs = 0;

  if (modo === 'serie') {
    for (const q of queries) {
      try {
        const r = await buscar(cidade, q, 1);
        reqs += r.reqs;
        for (const u of r.urls) urls.add(u);
        console.log(`    "${q}" → ${r.urls.length} resultados`);
      } catch (err) {
        console.log(`    "${q}" FALHOU: ${(err as Error).message.substring(0, 90)}`);
      }
    }
  } else {
    const settled = await Promise.allSettled(queries.map((q) => buscar(cidade, q, PAGE_CONCURRENCY)));
    settled.forEach((s, i) => {
      if (s.status === 'fulfilled') {
        reqs += s.value.reqs;
        for (const u of s.value.urls) urls.add(u);
        console.log(`    "${queries[i]}" → ${s.value.urls.length} resultados`);
      } else {
        console.log(`    "${queries[i]}" FALHOU: ${String((s.reason as Error)?.message).substring(0, 90)}`);
      }
    });
  }

  return { cidade, urls, ms: Date.now() - t0, reqs };
}

async function rodarModo(modo: Modo): Promise<{ urls: number; reqs: number; ms: number }> {
  console.log(`\n${'='.repeat(74)}\n  MODO: ${modo.toUpperCase()}\n${'='.repeat(74)}`);
  const t0 = Date.now();
  const res = await Promise.all(
    cidades.map(async (c) => {
      console.log(`\n  [${c}]`);
      return porCidade(c, modo);
    }),
  );
  const totalMs = Date.now() - t0;

  let totalUrls = 0;
  let totalReqs = 0;
  console.log('');
  for (const r of res) {
    console.log(`  ${r.cidade.padEnd(20)} ${String(r.urls.size).padStart(3)} URLs unicas | ~${r.reqs} req | ${(r.ms / 1000).toFixed(1)}s`);
    totalUrls += r.urls.size;
    totalReqs += r.reqs;
  }
  console.log(`  TOTAL: ${totalUrls} URLs | ~${totalReqs} req (~$${(totalReqs * 0.0015).toFixed(4)}) | ${(totalMs / 1000).toFixed(1)}s`);
  return { urls: totalUrls, reqs: totalReqs, ms: totalMs };
}

async function main(): Promise<void> {
  const janela = inicioDaJanela(dateRestrict)!;
  console.log(`Cidades: ${cidades.join(', ')} | ${estado} | ${periodoDias} dias (janela >= ${janela.toISOString().split('T')[0]})`);
  console.log(`Backend: ${config.searchBackend} | lote de paginas: ${PAGE_CONCURRENCY}`);

  const modos: Modo[] = modoArg === 'ambos' ? ['serie', 'paralelo'] : [modoArg as Modo];
  const resultados: Partial<Record<Modo, { urls: number; reqs: number; ms: number }>> = {};
  for (const m of modos) resultados[m] = await rodarModo(m);

  if (resultados.serie && resultados.paralelo) {
    const s = resultados.serie;
    const p = resultados.paralelo;
    console.log(`\n${'='.repeat(74)}`);
    console.log(`  serie    ${(s.ms / 1000).toFixed(1)}s | ${s.urls} URLs | ~${s.reqs} req`);
    console.log(`  paralelo ${(p.ms / 1000).toFixed(1)}s | ${p.urls} URLs | ~${p.reqs} req`);
    console.log(`  ganho de tempo: ${(s.ms / p.ms).toFixed(1)}x`);
    if (p.urls < s.urls) {
      console.log(`  ⚠ paralelo trouxe MENOS URLs (${p.urls} < ${s.urls}) — investigar antes de subir`);
    }
    console.log('='.repeat(74));
  }

  console.log(`\n  (o parse de data e a triagem por cidade/estado acontecem depois, no Filter2)`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
