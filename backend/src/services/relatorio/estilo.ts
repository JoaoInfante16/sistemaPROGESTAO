// ============================================
// A folha — o fio de agência traduzido pra papel
// ============================================
// A tela do app é navy com texto claro. Papel é o contrário: **o navy vira a
// tinta**. O que atravessa a tradução não é a cor, é a disciplina — filete em
// vez de caixa, raio zero em tudo, título ancorado à esquerda, e a mesma escada
// tipográfica (dateline mono / título Archivo / corpo).
//
// ⚠️ **As cores de categoria NÃO são reescritas aqui.** Elas vêm de
// `CATEGORIA_CORES` (utils/taxonomia.ts), que é a fonte única — o app já quebrou
// uma vez por ter uma segunda cópia dessa tabela. Os hexes foram validados
// sobre navy e seguem legíveis sobre branco porque são todos de croma médio; o
// que muda no papel é só a **tinta do texto**, escurecida pra passar AA sobre
// branco (o teal #1A8F9A dá 3.4:1 no branco — reprovado pra texto pequeno).

export const ESTILO = `
:root {
  --tinta:        #060D18;
  --tinta-2:      #3C566E;
  --tinta-3:      #64798C;
  --filete:       #DBE2E9;
  --filete-med:   #B6C2CE;
  --filete-forte: #060D18;
  --teal:         #147885;
  --verde:        #4E7A24;
  --alerta:       #C42B30;
  --papel:        #FFFFFF;
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: #E9EDF1;
  color: var(--tinta);
  font-family: Archivo, 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 12px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Raio zero é regra, não descuido — o app inteiro é assim.
   ⚠️ Mas é regra de **interface**: card, botão, chip, bloco. Marca de dado não
   entra. A primeira versão pegava tudo com o seletor universal e transformou os
   74 pinos do mapa em quadradinhos — o mapa virou uma nuvem de amostras de
   legenda espalhadas sobre a cidade. O :not() separa a disciplina do dano.

   (E este arquivo é um template literal: crase dentro do CSS fecha a string.) */
*:not(.pino):not(.marca) { border-radius: 0 !important; }

.folha {
  max-width: 178mm;
  margin: 0 auto;
  background: var(--papel);
  padding: 16mm 14mm 20mm;
  box-shadow: 0 2px 24px rgba(6,13,24,.13);
}

/* ── escada tipográfica ─────────────────────────────────── */
.dateline, .slug {
  font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace;
  text-transform: uppercase;
  letter-spacing: .12em;
  font-weight: 500;
}
.dateline { font-size: 8.5px; color: var(--teal); }
.slug     { font-size: 9px;   color: var(--tinta-3); }

h1 { font-size: 40px; font-weight: 700; letter-spacing: -1.4px; line-height: 1.02; margin: 0; }
h2 { font-size: 17px; font-weight: 700; letter-spacing: -.3px; margin: 0; }
h3 { font-size: 12.5px; font-weight: 700; letter-spacing: -.1px; margin: 0 0 6px; }
p  { margin: 0 0 9px; }
.lead { font-size: 13.5px; line-height: 1.55; color: var(--tinta-2); }
.nota { font-size: 10.5px; color: var(--tinta-3); line-height: 1.5; }

/* ── o filete que separa seção, com o rótulo montado nele ── */
.secao { margin-top: 13mm; }
.secao > .cabeca {
  display: flex; align-items: center; gap: 11px;
  border-top: 1.6px solid var(--filete-forte);
  padding-top: 7px; margin-bottom: 9px;
}
.secao > .cabeca .conta { margin-left: auto; }

/* ── cabeçalho do documento ─────────────────────────────── */
.masthead {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 14px;
  border-bottom: 1.6px solid var(--filete-forte);
  padding-bottom: 8px;
}
.wordmark { font-size: 21px; font-weight: 700; letter-spacing: .3em; line-height: 1; }
.wordmark span { color: var(--teal); }

.capa { padding-top: 11mm; }
.capa h1 { margin-bottom: 7px; }
.capa .onde { font-size: 13px; color: var(--tinta-2); letter-spacing: -.1px; }

/* O recorte: filete grosso à esquerda, nunca uma caixa. */
.recorte {
  border-left: 2.5px solid var(--teal);
  padding: 2px 0 2px 12px;
  margin: 9mm 0 0;
  display: grid; grid-template-columns: 40mm 1fr; gap: 3px 14px;
  font-size: 11px;
}
.recorte dt {
  color: var(--tinta-3); font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase;
  padding-top: 3px;
}
.recorte dd { margin: 0; }

/* ── a abertura: número grande + a frase que ele significa ── */
.abertura { display: flex; align-items: flex-start; gap: 18px; margin-top: 9mm; }
.hero { font-size: 66px; font-weight: 700; letter-spacing: -3.4px; line-height: .84; flex-shrink: 0; }
.hero small {
  display: block; font-size: 8.5px; letter-spacing: .12em; font-weight: 500;
  color: var(--tinta-3); margin-top: 7px; font-family: 'JetBrains Mono', monospace;
}

/* ── tabelas: todo gráfico tem gêmeo em tabela ──────────── */
table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
th {
  text-align: left; font-family: 'JetBrains Mono', monospace;
  font-size: 8.5px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--tinta-3); font-weight: 500;
  padding: 0 0 5px; border-bottom: 1px solid var(--filete-med);
}
td { padding: 5.5px 0; border-bottom: 1px solid var(--filete); vertical-align: baseline; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
tr:last-child td { border-bottom: none; }
/* A marca da tabela é o gêmeo do pino: mesma forma, mesma cor, mesma leitura.
   Se uma for círculo e a outra quadrado, o leitor não liga as duas. */
.marca { display: inline-block; width: 9px; height: 9px; margin-right: 7px;
  vertical-align: -1px; border-radius: 50%; }

.duas { display: grid; grid-template-columns: 62mm 1fr; gap: 14px; align-items: center; }

/* ── barras (volume no tempo) ───────────────────────────── */
.barras { display: flex; align-items: flex-end; gap: 3px; height: 34mm; border-bottom: 1px solid var(--filete-med); }
.barras .col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; gap: 4px; }
.barras .val { font-size: 8.5px; color: var(--tinta-3); font-family: 'JetBrains Mono', monospace; }
.barras .haste { width: 100%; background: var(--teal); min-height: 1px; }
.barras .haste.zero { background: var(--filete); height: 1.5px; }
.eixo { display: flex; gap: 3px; margin-top: 5px; }
.eixo .col { flex: 1; text-align: center; font-size: 8.5px; color: var(--tinta-3); font-family: 'JetBrains Mono', monospace; }

/* ── ranking de bairro ──────────────────────────────────── */
.rank { display: grid; grid-template-columns: 16px 1fr 46px; gap: 9px; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--filete); }
.rank:last-child { border-bottom: none; }
.rank .pos { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--tinta-3); }
.rank .nome { font-size: 12px; }
.rank .trilho { height: 5px; background: var(--filete); margin-top: 3px; }
.rank .cheio { height: 5px; background: var(--tinta); }
.rank .qtd { text-align: right; font-size: 11px; font-variant-numeric: tabular-nums; }

/* ── indicadores do executivo ───────────────────────────── */
.indicadores { display: grid; grid-template-columns: repeat(2, 1fr); }
.ind { border-top: 1px solid var(--filete); padding: 9px 14px 11px 0; }
.ind:nth-child(-n+2) { border-top: none; }
.ind .n { font-size: 27px; font-weight: 700; letter-spacing: -1.1px; line-height: 1; }
.ind .n.positivo { color: var(--verde); }
.ind .n.negativo { color: var(--alerta); }
.ind .rot { font-size: 11.5px; margin-top: 4px; }
.ind .ctx { margin-top: 3px; }

/* ── mapa ───────────────────────────────────────────────── */
.mapa { position: relative; overflow: hidden; border: 1px solid var(--filete-med); background: #EFF2F5; }
/* A camada nasce maior que a caixa e encolhe pro tamanho exato dela. É o que dá
   zoom contínuo em cima de tiles que só existem em zoom inteiro — sem isso,
   "não coube por 11 pixels" custava metade da escala do mapa. */
.mapa .camada { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
.mapa img { position: absolute; width: 256px; height: 256px; display: block; }

/* O pino é redondo e pequeno de propósito: com 70 ocorrências num município,
   marca grande vira mancha e some a topografia embaixo. O anel branco é o que
   mantém dois pinos vizinhos legíveis como dois. */
.mapa .pino {
  position: absolute; width: 7px; height: 7px; border-radius: 50%;
  border: 1.2px solid rgba(255,255,255,.95);
  box-shadow: 0 0 0 .5px rgba(6,13,24,.35);
  transform: translate(-50%, -50%);
}
/* Sem bairro na matéria, o geocode devolve o centro do município — o ponto
   entra, mas apagado e menor, pra não fingir precisão que a matéria não deu. */
.mapa .pino.cidade { width: 5px; height: 5px; opacity: .45; border-width: 1px; }

.chave { display: flex; flex-wrap: wrap; gap: 5px 16px; margin-top: 7px; }
.chave span { display: flex; align-items: center; gap: 6px; font-size: 10.5px; }
.chave i { width: 8px; height: 8px; border-radius: 50%; display: block; }
.creditos { font-size: 8px; color: var(--tinta-3); margin-top: 6px; font-family: 'JetBrains Mono', monospace; letter-spacing: .05em; line-height: 1.6; }

/* ── fontes ─────────────────────────────────────────────── */
.fontes { display: grid; grid-template-columns: 1fr 1fr; gap: 0 22px; align-items: start; }
.fonte { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid var(--filete); font-size: 11px; }
.fonte:last-child { border-bottom: none; }
.fonte .q { color: var(--tinta-3); font-variant-numeric: tabular-nums; }

.rodape { margin-top: 13mm; border-top: 1.6px solid var(--filete-forte); padding-top: 8px; display: flex; justify-content: space-between; gap: 14px; }

/* ── a barra de ações: só na tela ───────────────────────── */
.acoes {
  position: sticky; top: 0; z-index: 9;
  background: var(--tinta); color: #F0F4F8;
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 11px 18px;
}
.acoes .quem {
  font-family: 'JetBrains Mono', monospace; font-size: 9px;
  letter-spacing: .14em; text-transform: uppercase; color: #8FA9C0;
}
.acoes button {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: .14em; text-transform: uppercase; font-weight: 600;
  background: #7AB648; color: #060D18; border: 0; padding: 10px 18px; cursor: pointer;
}
.acoes button:hover { background: #92D050; }

/* ══ IMPRESSÃO ═══════════════════════════════════════════
   O PDF sai daqui: Ctrl+P no computador, ⋮ → Compartilhar →
   Imprimir no Android. Quem renderiza é o mesmo motor que
   desenhou a página — o que se vê é o que sai. */
@page { size: A4; margin: 14mm 13mm 15mm; }

@media print {
  body { background: #fff; }
  .acoes { display: none !important; }
  .folha { max-width: none; margin: 0; padding: 0; box-shadow: none; }
  .bloco, .abertura, .mapa, table, .indicadores { break-inside: avoid; }
  h2, h3 { break-after: avoid; }
  tr { break-inside: avoid; }
  a { text-decoration: none; color: inherit; }
  /* Sem isto o Chrome imprime as barras e a rosca em branco. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;
