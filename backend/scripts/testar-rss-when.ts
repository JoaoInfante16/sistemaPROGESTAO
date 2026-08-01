// ============================================
// O operador `when:` do Google News RSS funciona?
// ============================================
// O `tbs` do SERP foi medido IGNORADO (qdr:d/w/m e cdr custom devolvem os mesmos
// 10 resultados). O Google News tem um operador proprio na query — `when:7d` —
// que, se for obedecido, resolve a data NA FONTE e de graca.
//
// Tambem mede a sobreposicao REAL entre RSS e ramo news, sem filtro de data
// (o teste anterior filtrou os dois lados e comparou quase nada).
//
// Uso: npx tsx scripts/testar-rss-when.ts "Porto Alegre" "Rio Grande do Sul"

import { fetchGoogleNewsRSS } from '../src/services/search/GoogleNewsRSSProvider';
import { searchProvider } from '../src/jobs/pipeline/pipelineCore';
import { rateLimiter } from '../src/services/rateLimiter';
import { config } from '../src/config';

const cidade = process.argv[2] || 'Porto Alegre';
const estado = process.argv[3] || 'Rio Grande do Sul';
const base = `notícias policiais ocorrências crime ${cidade}`;

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const chave = (s: string) => norm(s).split(' ').slice(0, 8).join(' ');
const dia = (d?: Date) => (d ? d.toISOString().split('T')[0] : 'sem-data');

async function main(): Promise<void> {
  console.log(`Cidade: ${cidade}/${estado} | hoje: ${new Date().toISOString().split('T')[0]}`);
  console.log('='.repeat(78));

  // ---- Operador when: em varias janelas (sem filtro local — queremos ver o que a FONTE manda)
  const janelas = ['(sem when)', 'when:1d', 'when:7d', 'when:30d'];
  const resultados = new Map<string, Array<{ title: string; pubDate?: Date }>>();

  for (const j of janelas) {
    const q = j === '(sem when)' ? base : `${base} ${j}`;
    const r = await fetchGoogleNewsRSS(q, { maxAgeDays: 0 });
    resultados.set(j, r);
    const datas = r.filter((x) => x.pubDate).map((x) => x.pubDate!).sort((a, b) => b.getTime() - a.getTime());
    console.log(`\n### ${j}  ->  ${r.length} itens`);
    if (datas.length) {
      console.log(`    mais recente: ${dia(datas[0])} | mais antiga: ${dia(datas[datas.length - 1])}`);
      const dentro30 = datas.filter((d) => d >= new Date(Date.now() - 30 * 864e5)).length;
      const dentro7 = datas.filter((d) => d >= new Date(Date.now() - 7 * 864e5)).length;
      console.log(`    dentro de 7 dias: ${dentro7} | dentro de 30 dias: ${dentro30} | total com data: ${datas.length}`);
    }
  }

  // ---- Sobreposicao REAL: RSS bruto (sem when) x ramo news, ambos sem filtro
  const news = await rateLimiter.schedule(config.searchBackend, () =>
    searchProvider.search(`${base} ${estado}`, {
      maxResults: 30, dateRestrict: 'd30', searchMode: 'news',
      location: { city: cidade, state: estado, country: 'BR' },
    }),
  );
  const rssBruto = resultados.get('(sem when)') || [];
  const kNews = new Set(news.map((n) => chave(n.title)));
  const kRss = new Map(rssBruto.map((r) => [chave(r.title), r]));
  const ambos = [...kRss.keys()].filter((k) => kNews.has(k));

  console.log('\n' + '='.repeat(78));
  console.log(`SOBREPOSICAO REAL (sem filtro de data dos dois lados)`);
  console.log(`  ramo news (pago): ${news.length} | RSS (gratis): ${kRss.size} unicos`);
  console.log(`  em ambos: ${ambos.length}`);
  console.log(`  redundancia do RSS: ${kRss.size ? Math.round((ambos.length / kRss.size) * 100) : 0}%`);
  console.log(`  materia que SO o RSS tem: ${kRss.size - ambos.length}`);

  // ---- O melhor when: vale a pena?
  const melhor = janelas.slice(1).map((j) => ({ j, r: resultados.get(j) || [] }))
    .sort((a, b) => b.r.length - a.r.length)[0];
  if (melhor && melhor.r.length) {
    console.log(`\n--- Amostra de "${melhor.j}" (${Math.min(melhor.r.length, 20)} de ${melhor.r.length}) ---`);
    for (const it of melhor.r.slice(0, 20)) {
      console.log(`  [${dia(it.pubDate)}] ${it.title.substring(0, 66)}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
