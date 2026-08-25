// ============================================
// Dedup intra-batch em CAMADAS — só a busca manual usa
// ============================================
// Arquivo separado de proposito. O `runIntraBatchDedup` do pipelineCore e
// compartilhado com o auto-scan e NAO pode mudar (ordem do Joao em 02/08). Aqui
// e onde a busca manual evolui sem risco pro CRON.
//
// O PROBLEMA que isto resolve (medido em Salvador, 30 dias):
//   26 extraidas → 13 entregues. Metade sumia.
//
// O algoritmo antigo compara SO cosine contra o elemento semente, sem olhar data
// nem tipo de crime. Isso da errado nos dois sentidos ao mesmo tempo:
//   - funde demais: dois homicidios diferentes, em datas diferentes, tem resumos
//     parecidissimos ("homem e morto a tiros em Salvador") e batem 0.70+
//   - funde de menos: o mesmo evento coberto por dois veiculos com angulos
//     editoriais diferentes as vezes nao chega no limiar
// Mexer no numero nao resolve — o Joao ja tentou 0.80 e continuava duplicando,
// por isso baixou pra 0.70. E o algoritmo que estava errado.
//
// A ESTRATEGIA e a mesma que o auto-scan ja usa contra o banco e que funciona
// (services/deduplication + findGeoTemporalCandidates), so que em memoria:
//
//   Camada 1 — trava geo-temporal (gratis): so sao candidatos pares com mesma
//              cidade, mesmo estado, mesmo tipo de crime e data ±1 dia. Bairro
//              tolerante a nulo, igual ao auto-scan.
//   Camada 2 — cosine, com o `dedup_similarity_threshold` de sempre.
//   Camada 3 — confirmacao por GPT na faixa duvidosa, atras de config
//              (`dedup_gpt_confirm_enabled`, default false).
//
// A camada 1 e o que permite ser permissivo na 2 sem medo: se ja e a mesma
// cidade, o mesmo crime e o mesmo dia, um cosine alto quase so pode ser o mesmo
// evento. Crimes de datas diferentes param de se fundir de graca.

import { logger } from '../../middleware/logger';
import { cosineSimilarity, normalizeText } from '../../utils/helpers';
import { rateLimiter } from '../../services/rateLimiter';
import { confirmDuplicateWithGPT } from '../../services/deduplication';
import { ExtractedNews, ConsolidatedNews } from './pipelineCore';

/**
 * Acima disto o cosine decide sozinho — pedir GPT seria gastar por nada.
 * Entre o threshold e este valor fica a "faixa duvidosa", que e onde a camada 3
 * atua quando esta ligada.
 */
const BANDA_CONFIANTE = 0.92;

export interface LayeredDedupOptions {
  similarityThreshold: number;
  /** Camada 3. Default false — custa GPT por par duvidoso. */
  gptConfirmEnabled?: boolean;
}

export interface LayeredDedupResult {
  consolidated: ConsolidatedNews[];
  intraMerged: number;
  tokensUsed: number;
  /** Quantos pares a trava geo-temporal barrou antes de qualquer cosine. */
  bloqueadosPelaTrava: number;
}

/** Camada 1: os dois itens podem ser o mesmo evento? */
function mesmoEvento(a: ExtractedNews, b: ExtractedNews): boolean {
  if (normalizeText(a.cidade) !== normalizeText(b.cidade)) return false;
  if (a.tipo_crime !== b.tipo_crime) return false;

  // Estado so barra quando os dois informam e diferem — nao inventa rejeicao
  // por campo ausente.
  const ea = normalizeText(a.estado || '');
  const eb = normalizeText(b.estado || '');
  if (ea && eb && ea !== eb) return false;

  // Bairro tolerante a nulo, igual ao findGeoTemporalCandidates: se os dois tem
  // bairro e diferem, sao eventos distintos; se um for nulo, deixa o cosine
  // decidir (evita falso negativo em materia que nao cita bairro).
  const ba = normalizeText(a.bairro || '');
  const bb = normalizeText(b.bairro || '');
  if (ba && bb && ba !== bb) return false;

  // Data ±1 dia. Cobre a materia publicada no dia seguinte e a divergencia de
  // um dia entre veiculos, sem deixar crimes de semanas diferentes se fundirem.
  const ta = Date.parse(a.data_ocorrencia);
  const tb = Date.parse(b.data_ocorrencia);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return true; // data ilegivel: nao barra
  return Math.abs(ta - tb) <= 86_400_000;
}

export async function runIntraBatchDedupLayered(
  extractions: ExtractedNews[],
  logPrefix: string,
  opts: LayeredDedupOptions,
): Promise<LayeredDedupResult> {
  if (extractions.length === 0) {
    return { consolidated: [], intraMerged: 0, tokensUsed: 0, bloqueadosPelaTrava: 0 };
  }

  const { similarityThreshold, gptConfirmEnabled = false } = opts;
  const assigned = new Set<number>();
  const clusters: Array<{ members: number[] }> = [];
  let tokensUsed = 0;
  let bloqueadosPelaTrava = 0;

  for (let i = 0; i < extractions.length; i++) {
    if (assigned.has(i)) continue;
    const members = [i];
    assigned.add(i);

    for (let j = i + 1; j < extractions.length; j++) {
      if (assigned.has(j)) continue;

      // Camada 1 — gratis, e corta a esmagadora maioria dos pares
      if (!mesmoEvento(extractions[i], extractions[j])) {
        bloqueadosPelaTrava++;
        continue;
      }

      // Camada 2 — cosine
      const score = cosineSimilarity(extractions[i].embedding, extractions[j].embedding);
      if (score < similarityThreshold) continue;

      // Camada 3 — GPT so na faixa duvidosa, e so se estiver ligada
      if (gptConfirmEnabled && score < BANDA_CONFIANTE) {
        try {
          // A manchete vai junto desde 24/08 — e nela que mora a identidade do
          // fato (nome da operacao, bairro, vitima). Ver o prompt da camada 3.
          const r = await rateLimiter.schedule('openai', () =>
            confirmDuplicateWithGPT(
              { titulo: extractions[i].titulo ?? null, resumo: extractions[i].resumo },
              { titulo: extractions[j].titulo ?? null, resumo: extractions[j].resumo },
            )
          );
          tokensUsed += r.tokensUsed;
          if (!r.isDupe) {
            logger.debug(`${logPrefix} dedup: GPT separou #${i}/#${j} (score=${score.toFixed(3)})`);
            continue;
          }
        } catch (err) {
          // GPT fora nao pode derrubar a busca. Degrada pro comportamento da
          // camada 2, que e o que rodaria com a config desligada.
          logger.warn(`${logPrefix} dedup: confirmacao GPT falhou (${(err as Error).message}) — mantendo decisao do cosine`);
        }
      }

      members.push(j);
      assigned.add(j);
      logger.debug(`${logPrefix} dedup: #${j} → #${i} (score=${score.toFixed(3)})`);
    }

    clusters.push({ members });
  }

  const consolidated: ConsolidatedNews[] = clusters.map((cluster) => {
    const membros = cluster.members.map((idx) => extractions[idx]);
    membros.sort((a, b) => b.confianca - a.confianca);
    const lead = membros[0];

    // OS SINALIZADORES SAO INCLUSIVOS, e nao os do lider.
    //
    // Se o mesmo evento aparece dentro e fora da janela (acontece na fronteira,
    // porque veiculos divergem um dia na data), ele E do periodo pedido. Herdar
    // o flag do lider — escolhido por confianca — faria uma noticia principal
    // sumir da lista e reaparecer em "fora do periodo" ao sabor de um decimal.
    // Foi por causa desse risco que a 8.2 teve de deduplicar por balde separado;
    // com esta regra, os baldes podem voltar a ser deduplicados juntos.
    const foraDoPeriodo = membros.every((m) => m.fora_do_periodo);
    const cidadeVizinha = membros.every((m) => m.cidade_vizinha);

    return {
      ...lead,
      ...(foraDoPeriodo ? { fora_do_periodo: true } : { fora_do_periodo: undefined }),
      ...(cidadeVizinha ? { cidade_vizinha: true } : { cidade_vizinha: undefined }),
      extraSourceUrls: membros.slice(1).map((m) => m.sourceUrl),
      sources: membros.map((m) => ({ url: m.sourceUrl, type: m.sourceType })),
    };
  });

  const intraMerged = extractions.length - consolidated.length;
  logger.info(
    `${logPrefix} dedup em camadas: ${extractions.length} → ${consolidated.length}` +
    ` (${intraMerged} consolidadas, ${bloqueadosPelaTrava} pares barrados pela trava geo-temporal` +
    `${tokensUsed ? `, ${tokensUsed} tokens de confirmacao` : ''})`
  );

  return { consolidated, intraMerged, tokensUsed, bloqueadosPelaTrava };
}
