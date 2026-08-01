// ============================================
// Regressao do parser de datas do SERP
// ============================================
// Todas as strings abaixo foram COLHIDAS do Google em 2026-08-01 (Porto Alegre
// e Sao Jose). O parser controla quando a paginacao para — se ele errar, a
// busca ou para cedo demais (perde noticia) ou pagina de graca.
//
// Uso: npx tsx scripts/test-serp-date-parser.ts

import { parseSerpDate, inicioDaJanela } from '../src/services/search/serpDateParser';

const AGORA = new Date('2026-08-01T14:00:00Z');

const CASOS: Array<[string, string]> = [
  ['há 44 minutos', '2026-08-01'],
  ['há 1 hora', '2026-08-01'],
  ['há 17 horas', '2026-07-31'],
  ['há 21 horas', '2026-07-31'],
  ['1 dia atrás', '2026-07-31'],
  ['2 dias atrás', '2026-07-30'],
  ['3 dias atrás', '2026-07-29'],
  ['1 semana atrás', '2026-07-25'],
  ['2 semanas atrás', '2026-07-18'],
  ['3 semanas atrás', '2026-07-11'],
  ['4 semanas atrás', '2026-07-04'],
  [' 1 mês atrás', '2026-07-02'],       // vem com espaco na frente mesmo
  ['2 meses atrás', '2026-06-02'],
  ['6 de jun. de 2026', '2026-06-06'],
  ['27 de mar. de 2026', '2026-03-27'],
  ['1 de jun. de 2026', '2026-06-01'],
  ['15 de abr. de 2026', '2026-04-15'],
  ['ontem', '2026-07-31'],
  ['01/06/2026', '2026-06-01'],
  ['texto sem data', ''],               // nao reconhecido -> null -> nao corta paginacao
];

let ok = 0;
const falhas: string[] = [];

for (const [raw, esperado] of CASOS) {
  const d = parseSerpDate(raw, AGORA);
  const got = d ? d.toISOString().split('T')[0] : '';
  if (got === esperado) {
    ok++;
  } else {
    falhas.push(`  ${JSON.stringify(raw)} -> ${got || '(null)'} | esperado ${esperado || '(null)'}`);
  }
}

// inicioDaJanela
const j30 = inicioDaJanela('d30', AGORA);
const j30ok = j30?.toISOString().split('T')[0] === '2026-07-02';
if (j30ok) ok++; else falhas.push(`  inicioDaJanela('d30') -> ${j30?.toISOString()} | esperado 2026-07-02`);
const jNull = inicioDaJanela(undefined, AGORA);
if (jNull === null) ok++; else falhas.push(`  inicioDaJanela(undefined) deveria ser null`);

const total = CASOS.length + 2;
console.log(`${ok}/${total} corretos`);
if (falhas.length > 0) {
  console.log('\nFALHAS:');
  for (const f of falhas) console.log(f);
  process.exit(1);
}
