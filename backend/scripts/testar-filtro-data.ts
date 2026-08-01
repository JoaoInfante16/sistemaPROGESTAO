// ============================================
// Qual filtro de data o Google REALMENTE obedece no indice de noticias?
// ============================================
// A busca manual de 30 dias devolveu materias de janeiro a junho. O auto-scan,
// que usa qdr:d, so traz do dia. Este script compara as variantes de `tbs` na
// MESMA query e mostra a DATA de cada resultado, pra ver qual e obedecida.
//
// Roda SEQUENCIAL e via rateLimiter de proposito: rajada de request ja custou
// blacklist de IP na zone (30/07). Sao ~6 requests no total.
//
// Uso: npx tsx scripts/testar-filtro-data.ts "Porto Alegre" "Rio Grande do Sul"

import { rateLimiter } from '../src/services/rateLimiter';
import { config } from '../src/config';

const cidade = process.argv[2] || 'Porto Alegre';
const estado = process.argv[3] || 'Rio Grande do Sul';
const query = `notícias policiais ocorrências crime ${cidade} ${estado}`;

const hoje = new Date();
const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 3600 * 1000);
const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;

// Variantes a testar. `sbd:1` = sort by date (recencia em vez de relevancia).
// `cdr:1` = custom date range com janela explicita.
const VARIANTES: Array<{ nome: string; tbs: string }> = [
  { nome: 'qdr:m (o que a busca manual usa HOJE)', tbs: 'qdr:m' },
  { nome: 'qdr:m,sbd:1 (mes + ordenado por data)', tbs: 'qdr:m,sbd:1' },
  { nome: `cdr custom ${fmt(trintaDiasAtras)}-${fmt(hoje)}`, tbs: `cdr:1,cd_min:${fmt(trintaDiasAtras)},cd_max:${fmt(hoje)}` },
  { nome: `cdr custom + sbd:1`, tbs: `cdr:1,cd_min:${fmt(trintaDiasAtras)},cd_max:${fmt(hoje)},sbd:1` },
  { nome: 'qdr:w (7 dias)', tbs: 'qdr:w' },
  { nome: 'qdr:d (o que o AUTO-SCAN usa)', tbs: 'qdr:d' },
];

interface Item { title?: string; link?: string; date?: string; source?: string }

async function medir(tbs: string): Promise<{ qtd: number; itens: Item[]; erro?: string }> {
  const params = new URLSearchParams({
    q: query, start: '0', gl: 'br', hl: 'pt-BR', brd_json: '1', tbm: 'nws', tbs,
  });
  const googleUrl = `https://www.google.com/search?${params.toString()}`;

  try {
    return await rateLimiter.schedule(config.searchBackend, async () => {
      const res = await fetch('https://api.brightdata.com/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.brightdataApiKey}` },
        body: JSON.stringify({ zone: config.brightdataZone, url: googleUrl, format: 'raw' }),
        signal: AbortSignal.timeout(60_000),
      });
      const brdErr = res.headers.get('x-brd-err-code');
      if (brdErr) return { qtd: 0, itens: [], erro: `brd:${brdErr}` };
      const txt = await res.text();
      if (!txt.trim()) return { qtd: 0, itens: [], erro: 'corpo vazio (0 bytes)' };
      const data = JSON.parse(txt) as { news?: Item[] };
      const itens = data.news || [];
      return { qtd: itens.length, itens };
    });
  } catch (e) {
    return { qtd: 0, itens: [], erro: (e as Error).message.substring(0, 100) };
  }
}

async function main(): Promise<void> {
  console.log(`Query: "${query}"`);
  console.log(`Hoje: ${hoje.toISOString().split('T')[0]} | janela de 30 dias comeca em ${trintaDiasAtras.toISOString().split('T')[0]}`);
  console.log('='.repeat(78));

  for (const v of VARIANTES) {
    const r = await medir(v.tbs);
    console.log(`\n### ${v.nome}`);
    console.log(`    tbs=${v.tbs}`);
    if (r.erro) { console.log(`    ERRO: ${r.erro}`); continue; }
    console.log(`    ${r.qtd} resultados na pagina 1:`);
    for (const it of r.itens) {
      console.log(`      [${(it.date || 'sem data').padEnd(22)}] ${(it.title || '').substring(0, 62)}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
