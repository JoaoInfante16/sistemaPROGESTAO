// Diagnostico pontual: lista os TITULOS que o stage 1 da busca manual devolve
// para uma cidade/periodo — mesmo caminho do worker (rateLimiter + searchProvider).
// Serve pra entender O QUE a query retrospectiva traz (e o Filter2 rejeita).
//
// Uso: npx tsx scripts/diagnostico-titulos.ts "Porto Alegre" "Rio Grande do Sul" d30

import { searchProvider } from '../src/jobs/pipeline/pipelineCore';
import { rateLimiter } from '../src/services/rateLimiter';
import { config } from '../src/config';

const cidade = process.argv[2] || 'Porto Alegre';
const estado = process.argv[3] || 'Rio Grande do Sul';
const dateRestrict = process.argv[4] || 'd30';

async function main(): Promise<void> {
  const query = `notícias policiais ocorrências crime ${cidade} ${estado}`;
  console.log(`Query: "${query}" | ${dateRestrict} | backend: ${config.searchBackend}\n`);

  // Igual ao worker: web + news em paralelo, via rate limiter
  const [web, news] = await Promise.allSettled([
    rateLimiter.schedule(config.searchBackend, () =>
      searchProvider.search(query, {
        maxResults: 30, dateRestrict, searchMode: 'web',
        location: { city: cidade, state: estado, country: 'BR' },
      })),
    rateLimiter.schedule(config.searchBackend, () =>
      searchProvider.search(query, {
        maxResults: 30, dateRestrict, searchMode: 'news',
        location: { city: cidade, state: estado, country: 'BR' },
      })),
  ]);

  for (const [ramo, r] of [['WEB', web], ['NEWS', news]] as const) {
    console.log(`\n===== ${ramo} =====`);
    if (r.status === 'rejected') {
      console.log(`  FALHOU: ${(r.reason as Error).message.substring(0, 200)}`);
      continue;
    }
    console.log(`  ${r.value.length} resultados:`);
    for (const item of r.value) {
      console.log(`  - ${item.title}`);
      console.log(`      ${item.url.substring(0, 90)}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
