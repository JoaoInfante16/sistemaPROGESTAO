// ============================================
// Sistema de Deduplicação - 3 Camadas
// ============================================
// Camada 1: Geo-Temporal (SQL, grátis, 70% eliminados)
// Camada 2: Embedding Similarity (cosine, <200ms, 92% precisão)
// Camada 3: GPT Confirmation (caro, 98% precisão, só ~5% dos casos)

import { openai } from '../openaiClient';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { db } from '../../database/queries';
import { cosineSimilarity } from '../../utils/helpers';
import { NewsExtraction } from '../../utils/types';


const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

export interface DedupResult {
  isDuplicate: boolean;
  existingId?: string;
  layer?: 1 | 2 | 3; // Qual camada decidiu
  tokensUsed: number;
}

/**
 * Verifica se uma notícia é duplicata usando 3 camadas progressivas.
 * Mais barato primeiro, mais preciso por último.
 *
 * Se for duplicata, TODAS as URLs extras do cluster intra-batch também viram sources
 * da notícia existente (evita perda de agregação de veículos quando um crime ja estava no DB).
 */
export async function deduplicateNews(
  newsData: NewsExtraction & { embedding: number[] },
  sourceUrl: string,
  similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD,
  extraSourceUrls: string[] = [],
): Promise<DedupResult> {
  // CAMADA 1: Busca Geo-Temporal (SQL, instantâneo, grátis)
  const candidates = await db.findGeoTemporalCandidates(
    newsData.cidade,
    newsData.tipo_crime,
    newsData.data_ocorrencia,
    newsData.estado,
    newsData.bairro,
  );

  if (candidates.length === 0) {
    logger.debug('[Dedup] Layer 1: no candidates → new');
    return { isDuplicate: false, layer: 1, tokensUsed: 0 };
  }

  logger.debug(`[Dedup] Layer 1: ${candidates.length} candidates found`);

  // CAMADA 2: Embedding Similarity (cosine distance, <200ms)
  const validCandidates = candidates.filter(c => Array.isArray(c.embedding) && c.embedding.length === 1536);
  if (validCandidates.length === 0) {
    logger.debug('[Dedup] Layer 2: no candidates with valid embeddings → new');
    return { isDuplicate: false, layer: 2, tokensUsed: 0 };
  }

  const similarities = validCandidates.map((c) => ({
    id: c.id,
    resumo: c.resumo,
    score: cosineSimilarity(newsData.embedding, c.embedding),
  }));

  similarities.sort((a, b) => b.score - a.score);
  const topMatch = similarities[0];

  logger.debug(`[Dedup] Top similarity score: ${topMatch.score.toFixed(3)}`);

  if (topMatch.score < similarityThreshold) {
    logger.debug(`[Dedup] Layer 2: score ${topMatch.score.toFixed(3)} < ${similarityThreshold} → new`);
    return { isDuplicate: false, layer: 2, tokensUsed: 0 };
  }

  // CAMADA 3: Confirmação GPT (caro, mas só ~5% dos casos chegam aqui)
  logger.debug('[Dedup] High similarity, confirming with GPT...');
  const { isDupe, tokensUsed } = await confirmDuplicateWithGPT(newsData.resumo, topMatch.resumo);

  if (isDupe) {
    // Adicionar URL principal + extras do cluster intra-batch como fontes alternativas
    await db.insertNewsSource(topMatch.id, sourceUrl);
    for (const extraUrl of extraSourceUrls) {
      await db.insertNewsSource(topMatch.id, extraUrl);
    }
    logger.info(`[Dedup] Duplicate confirmed (score=${topMatch.score.toFixed(3)}), ${1 + extraSourceUrls.length} source(s) added to ${topMatch.id} (${tokensUsed} tokens)`);
    return { isDuplicate: true, existingId: topMatch.id, layer: 3, tokensUsed };
  }

  logger.debug('[Dedup] Layer 3: GPT says different → new');
  return { isDuplicate: false, layer: 3, tokensUsed };
}

/**
 * Confirmação via GPT: compara dois resumos para determinar se descrevem o mesmo evento.
 * Só chamada quando cosine similarity >= 0.85 (~5% dos casos).
 *
 * Nota: o prompt foi validado com script `scripts/test-dedup-prompt.ts` (10 pares, 9/10
 * acertos incluindo borderlines). Tentativa de reescrita com viés "quando em duvida, NO"
 * regrediu em casos YES claros (veiculos diferentes cobrindo mesmo evento). Revertido.
 *
 * 🚨 **A versão atual veio da `main`** (`add0967`, produção) e a `staging` tinha
 * ficado com a anterior — a lista de "Consider duplicate if" com `Location, date
 * and crime type are identical`. Aquele `identical` é o defeito: dois veículos
 * cobrindo o MESMO caso por ângulos diferentes ("corpo encontrado" e "suspeito
 * preso") nunca batem literalmente, o GPT respondia NO e a mesma ocorrência
 * aparecia duas vezes no feed. A regra passou a ser o **evento central**, com a
 * nota sobre ângulos escrita no prompt.
 *
 * 🚨 **O prompt era SENSÍVEL À ORDEM, e isso deixava duplicata passar.** Medido
 * em 17/08 com o par real que entrou duas vezes no feed (`Operação Olimpo`,
 * cosine 0.8343): `(resumo antigo, resumo novo)` deu **YES 5/5**, e
 * `(resumo novo, resumo antigo)` deu **NO 5/5** — determinístico, temperature 0.
 * O código chama sempre `(nova, existente)`, e a nova costuma ser a MAIS
 * detalhada porque é o follow-up: o modelo lia "detalhe que só um tem" como
 * fato divergente. As duas notas novas (assimetria de detalhe + simetria da
 * pergunta) levaram o mesmo par a **YES 10/10 nas duas ordens**.
 *
 * ⚠️ Quem mexer aqui: teste **nas duas ordens**. Um prompt que acerta num
 * sentido e erra no outro passa em qualquer bateria que só teste um lado.
 */
async function confirmDuplicateWithGPT(resumo1: string, resumo2: string): Promise<{ isDupe: boolean; tokensUsed: number }> {
  const prompt = `Do these two news summaries describe the SAME criminal incident?

Summary 1: "${resumo1}"
Summary 2: "${resumo2}"

They describe the SAME incident if the core event matches: same approximate location, same time frame, same type of crime, and details do not contradict each other.

They are DIFFERENT incidents if they clearly involve different victims/locations or contradictory facts.

Note: articles may cover different angles of the same event (victim found vs suspect arrested, early report vs follow-up) — these still count as the SAME incident.

Note: one summary is often MORE DETAILED than the other (naming the victim, the neighborhood, the operation). Detail present in only one summary is NOT a contradiction and NOT evidence of a different incident. Judge only on facts that CONFLICT.

The question is symmetric: the answer must not depend on which summary is listed first.

Answer ONLY "YES" or "NO":`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
      temperature: 0,
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase();
    const tokensUsed = response.usage?.total_tokens || 0;
    return { isDupe: answer === 'YES', tokensUsed };
  } catch (error) {
    logger.error('[Dedup] GPT confirmation error:', error);
    return { isDupe: false, tokensUsed: 0 };
  }
}

// Camada 3 reusada pelo dedup intra-batch em camadas da busca manual
// (jobs/pipeline/intraBatchDedupLayered.ts) — mesmo prompt, mesma validacao.
export { confirmDuplicateWithGPT };

// Export para testes (nome antigo, mantido pra nao quebrar scripts)
export { confirmDuplicateWithGPT as _confirmDuplicateWithGPT };
