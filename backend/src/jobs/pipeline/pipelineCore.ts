// ============================================
// Pipeline Core — Stages compartilhados
// ============================================
// Extraído de scanPipeline + manualSearchWorker.
// Cada pipeline chama esses stages e customiza via callbacks.

import * as Sentry from '@sentry/node';
import { createSearchProvider } from '../../services/search';
import { createContentFetcher } from '../../services/content';
import { createEmbeddingProvider } from '../../services/embedding';
import { filter0Regex } from '../../services/filters/filter0Regex';
import { filter1GPTBatch } from '../../services/filters/filter1GPTBatch';
import { filter2GPTWithReason } from '../../services/filters/filter2GPT';
import { logger } from '../../middleware/logger';
import { NewsExtraction } from '../../utils/types';
import { asyncPool, cosineSimilarity, normalizeText } from '../../utils/helpers';
import { FetchedContent } from '../../services/content/ContentFetcher';
import { rateLimiter } from '../../services/rateLimiter';
import { deduplicateResults } from '../../services/search/urlDeduplicator';
import { SearchResult } from '../../services/search/SearchProvider';

const searchProvider = createSearchProvider();
const contentFetcher = createContentFetcher();
const embeddingProvider = createEmbeddingProvider();

// ============================================
// Types
// ============================================

export interface PipelineConfig {
  searchMaxResults: number;
  contentFetchConcurrency: number;
  filter2ConfidenceMin: number;
  filter2MaxContentChars: number;
  filter0RegexEnabled: boolean;
}

export interface RejectedUrl {
  url: string;
  stage: string;
  reason: string;
}

export interface ExtractedNews extends NewsExtraction {
  embedding: number[];
  sourceUrl: string;
  sourceType: string;
}

export interface ConsolidatedNews extends ExtractedNews {
  extraSourceUrls: string[];
  sources: Array<{ url: string; type: string }>;
}

export interface PostFilter2Options {
  periodoDias?: number;
  estado?: string;
  cidades?: string[];
}

export interface PipelineStageResult {
  searchResults: SearchResult[];
  afterFilter0: SearchResult[];
  afterFilter1: SearchResult[];
  validContents: FetchedContent[];
  extractions: ExtractedNews[];
  consolidated: ConsolidatedNews[];
  rejectedUrls: RejectedUrl[];
  intraMerged: number;
}

// ============================================
// Stage 1: Filter0 — Regex (local, sem custo)
// ============================================

export function runFilter0(
  urls: SearchResult[],
  enabled: boolean,
  rejectedUrls: RejectedUrl[],
  logPrefix: string,
): SearchResult[] {
  if (!enabled) return [...urls];

  const passed: SearchResult[] = [];
  for (const r of urls) {
    if (filter0Regex(r.url, r.snippet)) {
      passed.push(r);
    } else {
      rejectedUrls.push({ url: r.url, stage: 'filter0', reason: 'regex_block' });
    }
  }

  logger.info(`${logPrefix} filter0: ${urls.length} → ${passed.length} (${urls.length - passed.length} rejeitadas)`);
  return passed;
}

// ============================================
// Stage 2: Filter1 — GPT Batch
// ============================================

export async function runFilter1(
  urls: SearchResult[],
  rejectedUrls: RejectedUrl[],
  logPrefix: string,
): Promise<{ passed: SearchResult[]; tokensUsed: number }> {
  if (urls.length === 0) return { passed: [], tokensUsed: 0 };

  const snippets = urls.map((r) => r.snippet);
  const { results: batchResults, tokensUsed } = await rateLimiter.schedule('openai', () =>
    filter1GPTBatch(snippets)
  );

  const passed: SearchResult[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (batchResults[i]) {
      passed.push(urls[i]);
    } else {
      rejectedUrls.push({ url: urls[i].url, stage: 'filter1', reason: 'gpt_nao_crime' });
    }
  }

  logger.info(`${logPrefix} filter1: ${urls.length} → ${passed.length} (${urls.length - passed.length} rejeitadas) [${tokensUsed} tokens]`);
  return { passed, tokensUsed };
}

// ============================================
// Stage 3: Content Fetch via Jina
// ============================================

export async function runContentFetch(
  urls: SearchResult[],
  concurrency: number,
  rejectedUrls: RejectedUrl[],
  logPrefix: string,
): Promise<FetchedContent[]> {
  const contentResults = await asyncPool<SearchResult, FetchedContent | null>(
    urls,
    concurrency,
    async (r) => {
      try {
        return await rateLimiter.schedule('jina', () => contentFetcher.fetch(r.url));
      } catch (err) {
        logger.error(`${logPrefix} fetch failed ${r.url}: ${(err as Error).message}`);
        return null;
      }
    }
  );

  const fetched = contentResults.filter((c): c is FetchedContent => c !== null);
  const valid = fetched.filter((c) => {
    if (c.content.trim().length < 100) {
      logger.warn(`${logPrefix} conteudo vazio/curto ${c.url.substring(0, 60)} (${c.content.length} chars)`);
      rejectedUrls.push({ url: c.url, stage: 'fetch', reason: `conteudo_vazio (${c.content.length} chars)` });
      return false;
    }
    return true;
  });

  logger.info(`${logPrefix} fetch: ${urls.length} → ${fetched.length} fetched → ${valid.length} com conteudo`);
  return valid;
}

// ============================================
// Stage 4: Filter2 — GPT Full Analysis + Embedding
// ============================================

export interface Filter2StageResult {
  extractions: ExtractedNews[];
  tokensUsed: { filter2: number; embedding: number };
}

// Casa com `api_rate_limits.openai.max_concurrent` (5). O rate limiter e quem
// de fato governa a vazao; o pool so precisa ser grande o bastante pra satura-lo.
const FILTER2_CONCURRENCY = 5;

/** Resultado de um item, resolvido em paralelo e agregado depois em ordem. */
type ItemFilter2 =
  | { tipo: 'ok'; extraction: ExtractedNews; f2: number; emb: number }
  | { tipo: 'rejeitado'; rejeicao: RejectedUrl; log: string; f2: number }
  | { tipo: 'erro'; url: string; msg: string };

export async function runFilter2WithEmbedding(
  contents: FetchedContent[],
  cfg: { maxContentChars: number; minConfidence: number },
  rejectedUrls: RejectedUrl[],
  logPrefix: string,
  postFilter?: PostFilter2Options,
  sourceTypeMap?: Map<string, string>,
): Promise<Filter2StageResult> {
  if (contents.length === 0) {
    return { extractions: [], tokensUsed: { filter2: 0, embedding: 0 } };
  }

  // Antes era um `for` sequencial usando ~20% da vazao que o rate limiter
  // permite. Com o stage 1 trazendo 3x mais URL (queries curtas, 2026-08-01),
  // o serial virou o gargalo da busca inteira.
  //
  // ATENCAO: o `asyncPool` NAO tem try/catch — se `fn` rejeitar, o
  // `Promise.all` interno derruba o pool inteiro. Todo erro tem que morrer
  // aqui dentro.
  const resultados = await asyncPool<FetchedContent, ItemFilter2>(
    contents,
    FILTER2_CONCURRENCY,
    async (fetched): Promise<ItemFilter2> => {
      try {
        const { extraction: extracted, rejectionReason, tokensUsed: f2tokens = 0 } = await rateLimiter.schedule('openai', () =>
          filter2GPTWithReason(fetched.content, {
            maxContentChars: cfg.maxContentChars,
            minConfidence: cfg.minConfidence,
          })
        );

        if (!extracted) {
          const reason = rejectionReason || 'unknown';
          return {
            tipo: 'rejeitado', f2: f2tokens,
            rejeicao: { url: fetched.url, stage: 'filter2', reason },
            log: `filter2 REJEITOU ${fetched.url.substring(0, 60)}... motivo: ${reason}`,
          };
        }

        // Post-filter: date range (comparar só YYYY-MM-DD, sem timezone)
        if (postFilter?.periodoDias) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - postFilter.periodoDias);
          const cutoffStr = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD
          if (extracted.data_ocorrencia < cutoffStr) {
            return {
              tipo: 'rejeitado', f2: f2tokens,
              rejeicao: { url: fetched.url, stage: 'filter2_date', reason: `Data antiga: ${extracted.data_ocorrencia}` },
              log: `filter2 data fora: ${extracted.data_ocorrencia} (cutoff: ${cutoffStr}) → ${fetched.url.substring(0, 80)}`,
            };
          }
        }

        // Post-filter: cidade/estado
        if (postFilter?.cidades && postFilter?.estado) {
          const cidadeExtraida = normalizeText(extracted.cidade);
          const estadoExtraido = normalizeText(extracted.estado || '');
          const estadoEsperado = normalizeText(postFilter.estado);
          const cidadesLower = postFilter.cidades.map(normalizeText);

          // Match de cidade (exato ou parcial), SEMPRE validando estado
          // (sem estado não há como distinguir cidades homônimas: São José/SC vs São José/SP)
          const cidadeExata = cidadesLower.some(c => cidadeExtraida === c);
          const cidadeParcial = cidadesLower.some(c => cidadeExtraida.includes(c) || c.includes(cidadeExtraida));
          const estadoBate = estadoExtraido.length > 0 && estadoExtraido.includes(estadoEsperado);

          if (!((cidadeExata || cidadeParcial) && estadoBate)) {
            return {
              tipo: 'rejeitado', f2: f2tokens,
              rejeicao: { url: fetched.url, stage: 'filter2_location', reason: `Local errado: ${extracted.cidade}/${extracted.estado || '?'} (esperado: ${postFilter.estado})` },
              log: `filter2 cidade/estado fora: ${extracted.cidade}/${extracted.estado || '?'} (esperado: ${postFilter.cidades.join(', ')}, ${postFilter.estado}) → ${fetched.url.substring(0, 80)}`,
            };
          }
        }

        // Gerar embedding com prefixo de metadata (tipo/estado/cidade/bairro/data)
        // Ancora os campos estruturados no vetor — mesma ocorrencia coberta por varios
        // veiculos com angulos editoriais diferentes fica com score alto (testado: raw
        // 0.63-0.77 → enriched 0.82-0.90 em caso real do homicidio Florianopolis 2026-04-17).
        const embeddingResult = await rateLimiter.schedule('openai', () =>
          embeddingProvider.generate(buildEmbeddingText(extracted))
        );

        return {
          tipo: 'ok', f2: f2tokens, emb: embeddingResult.tokensUsed,
          extraction: {
            ...extracted,
            embedding: embeddingResult.embedding,
            sourceUrl: fetched.url,
            sourceType: sourceTypeMap?.get(fetched.url) || 'google',
          },
        };
      } catch (err) {
        return { tipo: 'erro', url: fetched.url, msg: (err as Error).message };
      }
    },
  );

  // Agrega em ordem de entrada (o asyncPool preserva o indice)
  const extractions: ExtractedNews[] = [];
  let filter2Tokens = 0;
  let embeddingTokens = 0;
  let erros = 0;

  for (const r of resultados) {
    if (r.tipo === 'ok') {
      filter2Tokens += r.f2;
      embeddingTokens += r.emb;
      extractions.push(r.extraction);
    } else if (r.tipo === 'rejeitado') {
      filter2Tokens += r.f2;
      rejectedUrls.push(r.rejeicao);
      logger.info(`${logPrefix} ${r.log}`);
    } else {
      erros++;
      rejectedUrls.push({ url: r.url, stage: 'filter2', reason: `erro: ${r.msg.substring(0, 80)}` });
      logger.error(`${logPrefix} filter2 falhou em ${r.url.substring(0, 60)}: ${r.msg}`);
    }
  }

  // Um erro isolado degrada e segue. Falha em TODOS e problema sistemico
  // (chave invalida, provedor fora) e nao pode terminar como "0 resultados,
  // tudo certo" — foi esse padrao de falha silenciosa que mascarou o bug ate 30/07.
  if (erros === contents.length) {
    throw new Error(`Filter2 falhou em todos os ${contents.length} artigos — provavel problema no provedor`);
  }
  if (erros > 0) {
    Sentry.captureMessage(`Filter2: ${erros}/${contents.length} artigos com erro`, {
      level: 'warning', tags: { component: 'filter2' },
    });
  }

  logger.info(`${logPrefix} filter2: ${contents.length} → ${extractions.length} (${contents.length - extractions.length} rejeitadas${erros ? `, ${erros} por erro` : ''}) [filter2: ${filter2Tokens} tokens, embedding: ${embeddingTokens} tokens]`);
  return { extractions, tokensUsed: { filter2: filter2Tokens, embedding: embeddingTokens } };
}

/**
 * Monta o texto que vai pro embedding, com prefixo de metadata.
 * Formato: "{tipo} {estado} {cidade} {bairro} {data}\n{resumo}"
 * Exportado pra ser reusado no script de re-embed de noticias existentes.
 */
export function buildEmbeddingText(extracted: {
  tipo_crime: string;
  estado?: string;
  cidade: string;
  bairro?: string;
  data_ocorrencia: string;
  resumo: string;
}): string {
  const parts = [
    extracted.tipo_crime,
    extracted.estado || '',
    extracted.cidade,
    extracted.bairro || '',
    extracted.data_ocorrencia,
  ].filter((p) => p && p.trim().length > 0);
  return `${parts.join(' ')}\n${extracted.resumo}`;
}

// ============================================
// Stage 5: Dedup intra-batch (embedding clustering)
// ============================================

const INTRA_SIMILARITY_THRESHOLD_DEFAULT = 0.85;

export function runIntraBatchDedup(
  extractions: ExtractedNews[],
  logPrefix: string,
  similarityThreshold: number = INTRA_SIMILARITY_THRESHOLD_DEFAULT,
): { consolidated: ConsolidatedNews[]; intraMerged: number } {
  if (extractions.length === 0) return { consolidated: [], intraMerged: 0 };

  const assigned = new Set<number>();
  const clusters: Array<{ lead: number; members: number[] }> = [];

  for (let i = 0; i < extractions.length; i++) {
    if (assigned.has(i)) continue;
    const cluster = { lead: i, members: [i] };
    assigned.add(i);

    for (let j = i + 1; j < extractions.length; j++) {
      if (assigned.has(j)) continue;
      const score = cosineSimilarity(extractions[i].embedding, extractions[j].embedding);
      if (score >= similarityThreshold) {
        cluster.members.push(j);
        assigned.add(j);
        logger.debug(`${logPrefix} intra-batch merge: #${j} into #${i} (score=${score.toFixed(3)})`);
      }
    }
    clusters.push(cluster);
  }

  const consolidated: ConsolidatedNews[] = clusters.map(cluster => {
    const members = cluster.members.map(idx => extractions[idx]);
    members.sort((a, b) => b.confianca - a.confianca);
    const lead = members[0];
    const extraSourceUrls = members.slice(1).map(m => m.sourceUrl);
    const sources = members.map(m => ({ url: m.sourceUrl, type: m.sourceType }));
    return { ...lead, extraSourceUrls, sources };
  });

  const intraMerged = extractions.length - consolidated.length;
  if (intraMerged > 0) {
    logger.info(`${logPrefix} intra-batch dedup: ${extractions.length} → ${consolidated.length} (${intraMerged} consolidadas)`);
  }

  return { consolidated, intraMerged };
}

// ============================================
// URL dedup helper (re-export)
// ============================================

export { deduplicateResults };

// ============================================
// Search provider + content fetcher (shared instances)
// ============================================

export { searchProvider, contentFetcher, embeddingProvider };
