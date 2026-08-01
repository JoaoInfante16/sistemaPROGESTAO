// ============================================
// Diagnostico das fontes de busca — pelo caminho REAL do app
// ============================================
// Reproduz exatamente o que o manualSearchWorker.collectManualSearchUrls faz:
// cidades em PARALELO, e dentro de cada cidade web+news em PARALELO, tudo
// passando pelo rateLimiter (Bottleneck) — que e onde a concorrencia real
// acontece.
//
// IMPORTANTE: nao testar a API por fora (curl, fetch solto). Ja custou caro —
// em 2026-08-01 os testes diretos davam 5/5 enquanto o app travava, porque o
// app dispara varias requisicoes concorrentes e o teste disparava uma de cada
// vez. Medir sempre pelo mesmo caminho que o worker usa.
//
// Uso:
//   npx tsx scripts/test-search-providers.ts                      -> 1 cidade
//   npx tsx scripts/test-search-providers.ts "Campo Grande,Cuiabá" "Mato Grosso do Sul"

import { searchProvider } from '../src/jobs/pipeline/pipelineCore';
import { rateLimiter } from '../src/services/rateLimiter';
import { config } from '../src/config';

const cidades = (process.argv[2] || 'Florianópolis').split(',').map((c) => c.trim());
const estado = process.argv[3] || 'Santa Catarina';
const dateRestrict = 'd30';

// Mesmos tetos do manualSearchWorker
const NEWS_MAX = 30;
const WEB_MAX = 30;

interface Medicao {
  cidade: string;
  ramo: 'web' | 'news';
  ok: boolean;
  qtd: number;
  ms: number;
  erro?: string;
}

async function buscar(cidade: string, ramo: 'web' | 'news'): Promise<Medicao> {
  const query = `notícias policiais ocorrências crime ${cidade} ${estado}`;
  const t0 = Date.now();
  try {
    // MESMA chamada do worker — via rateLimiter, nao direto no provider
    const results = await rateLimiter.schedule(config.searchBackend, () =>
      searchProvider.search(query, {
        maxResults: ramo === 'web' ? WEB_MAX : NEWS_MAX,
        dateRestrict,
        searchMode: ramo,
        location: { city: cidade, state: estado, country: 'BR' },
      }),
    );
    return { cidade, ramo, ok: results.length > 0, qtd: results.length, ms: Date.now() - t0 };
  } catch (err) {
    return { cidade, ramo, ok: false, qtd: 0, ms: Date.now() - t0, erro: (err as Error).message.substring(0, 120) };
  }
}

async function main(): Promise<void> {
  console.log(`Cidades: ${cidades.join(', ')} | Estado: ${estado} | periodo: ${dateRestrict}`);
  console.log(`Backend: ${config.searchBackend}`);
  console.log('='.repeat(72));

  const t0 = Date.now();

  // Igual ao worker: todas as cidades em paralelo, web+news em paralelo dentro
  const porCidade = await Promise.all(
    cidades.map(async (cidade) => {
      const [web, news] = await Promise.all([buscar(cidade, 'web'), buscar(cidade, 'news')]);
      return [web, news];
    }),
  );

  const todas = porCidade.flat();
  const totalMs = Date.now() - t0;

  console.log('');
  for (const m of todas) {
    const status = m.ok ? 'OK    ' : 'FALHOU';
    console.log(`  [${status}] ${m.ramo.padEnd(4)} ${m.cidade.padEnd(18)} ${String(m.qtd).padStart(3)} resultados  ${(m.ms / 1000).toFixed(1)}s`);
    if (m.erro) console.log(`           erro: ${m.erro}`);
  }

  const ok = todas.filter((m) => m.ok).length;
  const urls = todas.reduce((s, m) => s + m.qtd, 0);

  console.log('');
  console.log('='.repeat(72));
  console.log(`  ${ok}/${todas.length} chamadas com resultado | ${urls} URLs no total | ${(totalMs / 1000).toFixed(1)}s de ponta a ponta`);
  if (ok < todas.length) {
    console.log('  >>> Alguma falhou. Se o padrao for "falha quando varias saem juntas",');
    console.log('  >>> o suspeito e concorrencia: a zone SERP aceita ~1 por vez e o');
    console.log('  >>> rate limiter (api_rate_limits.brightdata) permite mais.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
