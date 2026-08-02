// ============================================
// Tetos da busca manual, derivados do periodo — SEM degraus
// ============================================
// O periodo e um numero livre de 1 a 365 (a validacao ja aceita qualquer int).
// Nada aqui pode ser tabela de faixas: se o usuario pode pedir 47 dias, 47 dias
// tem que ter teto proprio, e nao o de "60".
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
// Curva resultante (base de analise = 50):
//   dias | coleta/query | analise | custo/cidade
//     30 |           70 |      50 |  $0.16
//     90 |          110 |      87 |  $0.27
//    180 |          150 |     122 |  $0.37
//    365 |          220 |     174 |  $0.53

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
 * Ancorado numa unica config — `manual_search_max_results_30d`, que passa a
 * significar "quantos artigos valem 30 dias de janela" — e escalado dali. Uma
 * alavanca so, ajustavel no admin sem deploy, valendo pra qualquer periodo.
 */
export function analiseMaxPorBusca(periodoDias: number, base30d: number): number {
  return Math.max(10, Math.round(base30d * Math.sqrt(periodoDias / 30)));
}
