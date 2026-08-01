// ============================================
// Diagnostico do stage 1 da busca manual — pelo caminho REAL do app
// ============================================
// Reproduz o que o manualSearchWorker.collectManualSearchUrls faz hoje:
// cidades em PARALELO, e dentro de cada cidade as queries curtas EM SERIE,
// todas via rateLimiter (Bottleneck).
//
// IMPORTANTE: nao testar a API por fora (curl, fetch solto). Ja custou caro —
// em 2026-08-01 os testes diretos davam 5/5 enquanto o app travava, porque o
// app dispara requisicoes concorrentes e o teste disparava uma de cada vez.
//
// Uso:
//   npx tsx scripts/test-search-providers.ts                          -> 1 cidade
//   npx tsx scripts/test-search-providers.ts "São José,Palhoça" "Santa Catarina" 30

import { searchProvider } from '../src/jobs/pipeline/pipelineCore';
import { rateLimiter } from '../src/services/rateLimiter';
import { config } from '../src/config';
import { buildManualSearchQueries } from '../src/services/search/queryTemplates';
import { parseSerpDate, inicioDaJanela } from '../src/services/search/serpDateParser';

const cidades = (process.argv[2] || 'Florianópolis').split(',').map((c) => c.trim());
const estado = process.argv[3] || 'Santa Catarina';
const periodoDias = parseInt(process.argv[4] || '30', 10);
const dateRestrict = `d${periodoDias}`;

// Mesmo teto por query do worker
const MAX_POR_QUERY = 20;

async function porCidade(cidade: string): Promise<{ cidade: string; urls: Set<string>; ms: number; reqs: number }> {
  const queries = buildManualSearchQueries(cidade);
  const urls = new Set<string>();
  const t0 = Date.now();
  let reqs = 0;

  // EM SERIE, igual ao worker
  for (const q of queries) {
    try {
      const r = await rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(q, {
          maxResults: MAX_POR_QUERY,
          dateRestrict,
          searchMode: 'news',
          location: { city: cidade, state: estado, country: 'BR' },
        }),
      );
      reqs += searchProvider.lastRequestCount ?? 0;
      for (const x of r) urls.add(x.url);
      console.log(`    "${q}" → ${r.length} resultados`);
    } catch (err) {
      console.log(`    "${q}" FALHOU: ${(err as Error).message.substring(0, 90)}`);
    }
  }
  return { cidade, urls, ms: Date.now() - t0, reqs };
}

async function main(): Promise<void> {
  const janela = inicioDaJanela(dateRestrict)!;
  console.log(`Cidades: ${cidades.join(', ')} | ${estado} | ${periodoDias} dias (janela >= ${janela.toISOString().split('T')[0]})`);
  console.log(`Backend: ${config.searchBackend}`);
  console.log('='.repeat(74));

  const t0 = Date.now();
  // Cidades em paralelo, igual ao worker
  const res = await Promise.all(cidades.map(async (c) => {
    console.log(`\n  [${c}]`);
    return porCidade(c);
  }));
  const totalMs = Date.now() - t0;

  console.log('\n' + '='.repeat(74));
  let totalUrls = 0, totalReqs = 0;
  for (const r of res) {
    console.log(`  ${r.cidade.padEnd(20)} ${String(r.urls.size).padStart(3)} URLs unicas | ${r.reqs} requests | ${(r.ms / 1000).toFixed(1)}s`);
    totalUrls += r.urls.size;
    totalReqs += r.reqs;
  }
  console.log(`\n  TOTAL: ${totalUrls} URLs | ${totalReqs} requests (~$${(totalReqs * 0.0015).toFixed(4)}) | ${(totalMs / 1000).toFixed(1)}s de ponta a ponta`);
  console.log(`\n  (o parse de data e a triagem por cidade/estado acontecem depois, no Filter2)`);
  void parseSerpDate;
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
