// ============================================
// Tetos da busca manual, derivados do periodo — SEM degraus
// ============================================
// O periodo e um numero livre de 1 a 180 (a validacao aceita qualquer int nessa
// faixa). Nada aqui pode ser tabela de faixas: se o usuario pode pedir 47 dias,
// 47 dias tem que ter teto proprio, e nao o de "60".
//
// As formulas abaixo NAO tem teto proprio de periodo — funcionam pra 365 do
// mesmo jeito. O limite de 180 mora so na validacao, e e por causa do app (ver
// validation.ts). Subir depois da 8.5 nao mexe em nada aqui.
//
// Ambas as funcoes crescem com a RAIZ do periodo, nao linearmente, porque o
// indice de noticias do Google rareia conforme se volta no tempo: dobrar o
// periodo nao dobra o que existe pra achar, entao cota extra em periodo longo
// rende menos.
//
// Modulo separado de proposito e SEM efeito colateral: o manualSearchWorker cria
// uma Queue do BullMQ no import, entao um script que so quisesse consultar estes
// numeros abriria conexao com o Redis e nao terminaria.
//
// Curva de COLETA, e a de analise se um dia voltar a ter teto (base 50):
//   dias | coleta/query | analise c/ base 50 | custo/cidade
//     30 |           70 |                 50 |  $0.16
//     90 |          110 |                 87 |  $0.27
//    180 |          150 |                122 |  $0.37   <- maximo hoje
//    365 |          220 |                174 |  $0.53   <- so depois da 8.5
// Com o teto de analise ABERTO (o padrao atual) a coluna de analise vira "tudo
// que passou no Filter1" — em capital, ~2.5x os numeros acima.

// Teto de COLETA do ramo news, POR QUERY (nao por cidade).
//
// Era a constante 20 (2 paginas) para qualquer periodo — e por isso o periodo
// pedido NAO era respeitado. Com `sbd:1` a SERP vem ordenada por data, entao 20
// resultados numa capital cobrem uns poucos dias: medido em 02/08, Salvador com
// "30 dias" so alcancava 30/07. Pedir 30 ou 90 devolvia a mesma coisa. Com o
// teto abaixo, a mesma busca passou a alcancar 05/07 — 29 dos 30 dias.
//
// E TETO, nao meta: a paginacao para sozinha quando a pagina inteira ja e
// anterior a janela, entao cidade pequena continua barata. Arredondado pra
// multiplo de 10 porque a SERP entrega 10 por pagina — assim o teto e um numero
// exato de paginas. Quem paga a conta de verdade e o teto de ANALISE: coletar
// custa $0.0015 por pagina, analisar custa ~$0.0025 por artigo.
const COLETA_COEF = 11;        // ~70 em 30 dias, ~220 em um ano
const COLETA_MAX_PAGINAS = 25; // teto duro de tempo/custo por query
const COLETA_MIN_PAGINAS = 2;

export function newsMaxPorQuery(periodoDias: number): number {
  const paginas = Math.ceil((COLETA_COEF * Math.sqrt(periodoDias)) / 10);
  return Math.min(Math.max(paginas, COLETA_MIN_PAGINAS), COLETA_MAX_PAGINAS) * 10;
}

/**
 * Teto de ARTIGOS ANALISADOS (Jina + GPT) por busca.
 *
 * Ancorado numa unica config — `manual_search_analysis_cap`, "quantos artigos
 * valem 30 dias de janela" — e escalado dali. Uma alavanca so, ajustavel no
 * admin sem deploy, valendo pra qualquer periodo.
 *
 * **0 = SEM TETO**, e e o default desde 02/08 por decisao do Joao: analisar tudo
 * que passou no Filter1. O mecanismo continua aqui inteiro justamente pra que
 * voltar a ter fusivel seja UMA config no admin, sem deploy — se um dia uma
 * busca sair cara ou longa demais, e so por um numero de volta.
 *
 * O que fica sem freio quando e 0 (extrapolado de Salvador/30d, medido em 02/08):
 *   - 180 dias: ~300 artigos por cidade, ~$0.75, ~7 min
 *   - 365 dias: ~470 artigos por cidade, ~$1.20, ~10 min
 * O `monthly_budget_usd` NAO protege disso: ele e checado uma vez, no inicio do
 * job, entao nao interrompe uma busca cara ja em andamento.
 */
export function analiseMaxPorBusca(periodoDias: number, base30d: number): number {
  if (base30d <= 0) return Infinity;
  return Math.max(10, Math.round(base30d * Math.sqrt(periodoDias / 30)));
}
