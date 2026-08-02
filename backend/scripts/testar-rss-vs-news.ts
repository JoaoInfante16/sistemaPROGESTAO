// ============================================
// O Google News RSS e redundante com o ramo news (tbm=nws)?
// ============================================
// Contexto: `google_news_rss_enabled` esta OFF. Foi desligado quando o Top 100
// existia. O Top 100 morreu (scraper abandonado em 2026-08-01), entao a pergunta
// voltou: o RSS traz materia que o ramo news NAO traz?
//
// Compara por TITULO normalizado, nao por URL: o RSS devolve link de redirect
// (news.google.com/rss/articles/...), o SERP devolve a URL final do veiculo.
//
// O RSS e gratis e respeita pubDate de verdade — ao contrario do `tbs` do SERP,
// que foi medido em 2026-08-01 sendo IGNORADO (qdr:d, qdr:w, qdr:m e cdr custom
// devolveram os mesmos 10 resultados identicos).
//
// Uso: npx tsx scripts/testar-rss-vs-news.ts "Porto Alegre" "Rio Grande do Sul" 30

import { fetchGoogleNewsRSS } from '../src/services/search/GoogleNewsRSSProvider';
import { searchProvider } from '../src/jobs/pipeline/pipelineCore';
import { rateLimiter } from '../src/services/rateLimiter';
import { config } from '../src/config';
import { getAssuntos } from '../src/services/search/queryTemplates';

const cidade = process.argv[2] || 'Porto Alegre';
const estado = process.argv[3] || 'Rio Grande do Sul';
const dias = parseInt(process.argv[4] || '30', 10);

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Compara os primeiros 8 tokens do titulo — o RSS as vezes anexa " - Veiculo"
const chave = (s: string) => norm(s).split(' ').slice(0, 8).join(' ');

async function main(): Promise<void> {
  const queryManual = `notícias policiais ocorrências crime ${cidade} ${estado}`;
  console.log(`Cidade: ${cidade}/${estado} | janela: ${dias} dias`);
  console.log('='.repeat(78));

  // ---- 1. Ramo NEWS (pago, via Bright Data) — o que a busca manual usa hoje
  const news = await rateLimiter.schedule(config.searchBackend, () =>
    searchProvider.search(queryManual, {
      maxResults: 30, dateRestrict: `d${dias}`, searchMode: 'news',
      location: { city: cidade, state: estado, country: 'BR' },
    }),
  );
  console.log(`\n[1] RAMO NEWS (Bright Data, pago): ${news.length} resultados`);

  // ---- 2. RSS com a MESMA query (gratis)
  const rssMesmaQuery = await fetchGoogleNewsRSS(queryManual, { maxAgeDays: dias });
  console.log(`[2] RSS mesma query (gratis):      ${rssMesmaQuery.length} resultados`);

  // ---- 3. RSS com todos os assuntos do painel (gratis)
  const porTemplate: Array<{ nome: string; qtd: number }> = [];
  const rssTodos = new Map<string, { title: string; pubDate?: Date }>();
  const assuntos = await getAssuntos();
  for (const assunto of assuntos) {
    const r = await fetchGoogleNewsRSS(`${assunto} ${cidade}`, { maxAgeDays: dias });
    porTemplate.push({ nome: assunto, qtd: r.length });
    for (const item of r) rssTodos.set(chave(item.title), { title: item.title, pubDate: item.pubDate });
  }
  console.log(`[3] RSS ${assuntos.length} assuntos (gratis):      ${rssTodos.size} unicos`);
  for (const t of porTemplate) console.log(`      - ${t.nome.padEnd(22)} ${t.qtd}`);

  // ---- Sobreposicao
  const chavesNews = new Set(news.map((n) => chave(n.title)));
  const soNoRSS = [...rssTodos.entries()].filter(([k]) => !chavesNews.has(k));
  const emAmbos = [...rssTodos.keys()].filter((k) => chavesNews.has(k));

  console.log('\n' + '='.repeat(78));
  console.log(`SOBREPOSICAO: ${emAmbos.length} titulos em ambos | ${soNoRSS.length} SO no RSS`);
  const pct = rssTodos.size > 0 ? Math.round((emAmbos.length / rssTodos.size) * 100) : 0;
  console.log(`Redundancia do RSS em relacao ao news: ${pct}%`);

  // ---- Datas: o RSS respeita a janela?
  const comData = [...rssTodos.values()].filter((v) => v.pubDate);
  if (comData.length > 0) {
    const datas = comData.map((v) => v.pubDate!).sort((a, b) => b.getTime() - a.getTime());
    console.log(`\nDATAS no RSS: ${comData.length}/${rssTodos.size} com pubDate`);
    console.log(`  mais recente: ${datas[0].toISOString().split('T')[0]}`);
    console.log(`  mais antiga:  ${datas[datas.length - 1].toISOString().split('T')[0]}`);
    const hist: Record<string, number> = {};
    for (const d of datas) { const k = d.toISOString().split('T')[0]; hist[k] = (hist[k] || 0) + 1; }
    console.log('  por dia:');
    for (const [d, q] of Object.entries(hist).sort().reverse()) console.log(`    ${d}: ${'#'.repeat(q)} ${q}`);
  }

  console.log(`\n--- Amostra do que SO o RSS traz (${Math.min(soNoRSS.length, 25)} de ${soNoRSS.length}) ---`);
  for (const [, v] of soNoRSS.slice(0, 25)) {
    const d = v.pubDate ? v.pubDate.toISOString().split('T')[0] : 'sem data';
    console.log(`  [${d}] ${v.title.substring(0, 68)}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
