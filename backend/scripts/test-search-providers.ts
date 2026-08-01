// ============================================
// Diagnostico dos providers de busca
// ============================================
// Roda os DOIS ramos da busca manual (web + news) exatamente como o
// manualSearchWorker roda, e reporta tempo e volume de cada um.
//
// Existe por causa do incidente de 2026-07-30: os providers falhavam em
// SILENCIO (HTTP 200 com corpo vazio, ou query que o Google zera), e a busca
// concluia com 0 resultados sem erro nenhum. Este script torna isso visivel
// em 30 segundos, sem precisar disparar uma busca real e ler log do Render.
//
// Uso: npx tsx scripts/test-search-providers.ts [cidade] [estado]

import { searchProvider } from '../src/jobs/pipeline/pipelineCore';

const cidade = process.argv[2] || 'Florianópolis';
const estado = process.argv[3] || 'Santa Catarina';
const dateRestrict = 'd30';

async function run(
  label: string,
  query: string,
  mode: 'web' | 'news',
  maxResults: number,
): Promise<void> {
  const t0 = Date.now();
  try {
    const results = await searchProvider.search(query, {
      maxResults,
      dateRestrict,
      searchMode: mode,
      location: { city: cidade, state: estado, country: 'BR' },
    });
    const ms = Date.now() - t0;

    console.log(`\n[${label}] ${results.length} resultados em ${(ms / 1000).toFixed(1)}s`);
    if (results.length === 0) {
      console.log('  >>> ZERO. Provider vivo mas sem entregar — checar query ou bloqueio.');
    }
    for (const r of results.slice(0, 5)) {
      console.log(`  - ${(r.title || '(sem titulo)').substring(0, 65)}`);
      console.log(`    ${r.url.substring(0, 90)}`);
    }
    if (results.length > 5) console.log(`  ... mais ${results.length - 5}`);
  } catch (err) {
    const ms = Date.now() - t0;
    console.log(`\n[${label}] FALHOU em ${(ms / 1000).toFixed(1)}s`);
    console.log(`  ${(err as Error).message.substring(0, 300)}`);
  }
}

async function main(): Promise<void> {
  console.log(`Cidade: ${cidade} / ${estado} | periodo: ${dateRestrict}`);
  console.log('='.repeat(70));

  // Mesmas queries do manualSearchWorker.collectManualSearchUrls
  const q = `notícias policiais ocorrências crime ${cidade} ${estado}`;

  // Mesmos tetos do manualSearchWorker. Os dois ramos usam a MESMA SERP
  // paginada (10 por request), mudando so o indice do Google.
  // Obs: aqui o ramo web roda sempre, ignorando a config manual_search_web_enabled
  // — a ideia e justamente medir se ele voltou a prestar.
  await run('WEB (organico — portais locais)', q, 'web', 30);
  await run('NEWS (tbm=nws)', q, 'news', 30);

  console.log('\n' + '='.repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
