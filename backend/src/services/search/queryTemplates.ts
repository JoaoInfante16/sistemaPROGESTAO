// ============================================
// Assuntos pesquisados — Google (indice de noticias, tbm=nws)
// ============================================
// A lista de assuntos vive na config `search_subjects` e e editavel no painel.
// Cada assunto vira uma query `<assunto> <cidade>`. Ate 02/08 esta lista era
// hardcoded aqui (QUERY_TEMPLATES abaixo, que agora e so o fallback de fabrica).
//
// POR QUE ISTO E A ALAVANCA QUE IMPORTA (medido em 02/08 no budget_tracking):
//
//   Salvador /30 dias -> 202 URLs, paginacao no teto (24 de 24 paginas)
//   Sao Paulo /90 dias -> 185 URLs, e a SERP SECOU sozinha na pagina 23 de 36
//
// Pedir 90 dias em vez de 30 nao trouxe mais nada porque o Google serve ~60-70
// itens uteis POR QUERY na lista ordenada por data (`sbd:1`), e nao ha parametro
// que mude isso: `num` foi deprecado em set/2025 e `qdr`/`cdr` sao ignorados
// (medicao de 01/08). O teto e por query — entao a forma de enxergar mais nao e
// pedir mais paginas do mesmo assunto, e sim perguntar outra coisa. Dois
// assuntos valem dois tetos.
//
// Regras que sairam da medicao de 2026-08-01, ambas contraintuitivas, e que
// valem pra qualquer assunto que o cliente adicione:
//
// 1. QUERY CURTA GANHA DE QUERY LONGA. Porto Alegre, pagina 1, `sbd:1`:
//    `notícias policiais ocorrências crime Porto Alegre Rio Grande do Sul` -> 4/10 na janela
//    `polícia Porto Alegre`                                               -> 10/10, a mais recente de 17h atras
//
// 2. NAO COLOCAR O ESTADO NA QUERY — nem por extenso, nem a sigla. Ele empurra
//    o resultado pra conteudo institucional (concurso, corrida da PC, boletim
//    de secretaria) e afasta a ocorrencia local:
//    `polícia São José`    -> mais recente ha 44 MINUTOS
//    `polícia São José SC` -> mais recente ha 3 SEMANAS
//
//    A desambiguacao de cidade homonima (Sao Jose/SC vs Sao Jose/SP) NAO se faz
//    aqui — quem faz e o pos-filtro do Filter2, que le cidade E estado do corpo
//    do artigo. Botar o estado na query nao desambigua, so degrada.
//
// 3. Assuntos diferentes trazem materia diferente: `polícia` trouxe 10 itens
//    que o template base nao trazia; `homicídio` trouxe 9. Multi-query vale.
//
// A versao anterior a 01/08 era feita pra **Perplexity** (busca semantica):
// frases longas em linguagem natural. O backend virou Bright Data/Google e
// ninguem reescreveu — medido no dia, os templates 1-4 devolviam ZERO.

import { MonitoredLocation } from '../../utils/types';
import { configManager } from '../configManager';

/**
 * Fallback de fabrica, usado se `search_subjects` estiver vazia ou ilegivel.
 * E o mesmo conjunto que o default da config — existe em codigo pro sistema
 * nunca ficar sem assunto nenhum se o banco responder lixo.
 */
export const ASSUNTOS_PADRAO: string[] = [
  'polícia',
  'homicídio morte tiros',
  'roubo furto assalto',
  'tráfico drogas apreensão armas',
  'violência doméstica feminicídio',
];

/** Compat: alguns scripts e o admin ainda falam em "templates". */
export interface QueryTemplate {
  id: number;
  name: string;
  build: (location: MonitoredLocation) => string;
}

/**
 * Le e normaliza a lista de assuntos do painel.
 *
 * Aceita quebra de linha OU virgula como separador — o campo e um textarea e o
 * usuario digita como quiser; exigir um formato so seria pedir pra lista virar
 * uma unica query gigante por causa de uma virgula.
 */
export async function getAssuntos(): Promise<string[]> {
  const bruto = await configManager.get('search_subjects');
  const assuntos = parseAssuntos(bruto);
  return assuntos.length > 0 ? assuntos : ASSUNTOS_PADRAO;
}

export function parseAssuntos(bruto: string): string[] {
  if (!bruto) return [];
  return bruto
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // Assunto repetido custaria uma query inteira pra devolver a mesma SERP.
    .filter((s, i, arr) => arr.findIndex((o) => o.toLowerCase() === s.toLowerCase()) === i);
}

/**
 * Queries do AUTO-SCAN para uma location.
 *
 * Continua rodando so `queriesPerScan` assuntos por vez, em rodizio: o scan roda
 * de hora em hora, entao ele cobre a lista inteira ao longo do dia sem pagar
 * tudo de uma vez. Quem roda TODOS os assuntos de uma vez e a busca manual, que
 * e sob demanda.
 *
 * `mode === 'keywords'`: a location tem palavras proprias, definidas no painel
 * de monitoramentos, e elas SUBSTITUEM a lista de assuntos — e uma escolha por
 * cidade, mais especifica que a lista geral.
 */
export async function buildQueries(
  location: MonitoredLocation,
  options: { multiQueryEnabled: boolean; queriesPerScan: number; scanIndex: number }
): Promise<string[]> {
  if (location.mode === 'keywords' && location.keywords && location.keywords.length > 0) {
    return [`${location.keywords.join(' ')} ${location.name}`];
  }

  const assuntos = await getAssuntos();
  if (!options.multiQueryEnabled) {
    return [`${assuntos[0]} ${location.name}`];
  }

  const quantos = Math.max(1, Math.min(options.queriesPerScan, assuntos.length));
  const inicio = (options.scanIndex * quantos) % assuntos.length;

  const escolhidos: string[] = [];
  for (let i = 0; i < quantos; i++) {
    escolhidos.push(assuntos[(inicio + i) % assuntos.length]);
  }
  return escolhidos.map((a) => `${a} ${location.name}`);
}

/**
 * Queries da BUSCA MANUAL. Sem estado, pelo motivo medido no topo do arquivo.
 *
 * Roda a lista INTEIRA de assuntos, em qualquer periodo — e o pedido do Joao em
 * 02/08: *"ter uma lista de tudo o que meu cliente quiser que seja pesquisado, e
 * todas essas coisas aparecam em todos os periodos"*. Como o teto do indice e por
 * query, cada assunto e um teto novo: e assim que 90 dias passa a render mais que
 * 30, o que hoje nao acontece.
 *
 * As queries rodam em PARALELO no worker (uma requisicao a mais nao custa tempo
 * de parede), entao o preco de um assunto extra e so o da SERP: ~$0.0015 por
 * pagina, mais Jina+GPT do que sobreviver aos filtros.
 *
 * `assuntos` vem da TELA desde 03/08: o usuario escolhe quais perguntas fazer
 * (templates da taxonomia + palavra-chave livre) e paga o tempo da propria
 * escolha. Sem escolha, cai na lista do painel — o comportamento de antes.
 *
 * ⚠️ Cada assunto e ~1 min a mais de busca numa capital. Quem decide isso e a
 * tela, mostrando a estimativa antes de disparar; aqui a lista chega pronta.
 */
export async function buildManualSearchQueries(cidade: string, assuntos?: string[]): Promise<string[]> {
  const escolhidos = assuntos && assuntos.length > 0 ? assuntos : await getAssuntos();
  return escolhidos.map((a) => `${a} ${cidade}`);
}
