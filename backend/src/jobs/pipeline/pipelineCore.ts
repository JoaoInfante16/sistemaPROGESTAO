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
import { asyncPool, cosineSimilarity, mesmaCidade, normalizeText } from '../../utils/helpers';
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
  /**
   * Sinalizadores de balde. Ausentes = resultado principal, que e o caso de
   * TODO item do auto-scan (ele nao liga a classificacao — ver PostFilter2Options).
   *
   * Sao dois booleanos e nao um `bucket` string porque as condicoes sao
   * independentes: noticia de Camacari de tres meses atras e as duas coisas.
   */
  fora_do_periodo?: boolean;
  cidade_vizinha?: boolean;
}

export interface ConsolidatedNews extends ExtractedNews {
  extraSourceUrls: string[];
  sources: Array<{ url: string; type: string }>;
}

export interface PostFilter2Options {
  periodoDias?: number;
  estado?: string;
  cidades?: string[];

  /**
   * OPT-IN. Ligado, os dois maiores motivos de rejeicao (data fora da janela e
   * cidade vizinha) deixam de virar descarte e viram sinalizador no resultado.
   *
   * ⚠️ NAO ligar no auto-scan. Ele passa `postFilter` com periodoDias/estado/
   * cidades e grava direto na tabela `news`; classificar ali faria o CRON salvar
   * cidade vizinha e noticia velha como se fossem da cidade monitorada — a mesma
   * poluicao de banco que escanear `type='state'` causa. Default (ausente) =
   * descarta, exatamente como sempre foi.
   */
  classificar?: boolean;

  /** Municipios aceitos como vizinhos. So tem efeito com `classificar`. */
  cidadesRegiao?: string[];

  /**
   * Ate quantos dias atras aceitar noticia fora da janela. Alem disso, descarta
   * de verdade. So tem efeito com `classificar`.
   */
  horizonteDias?: number;
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

/**
 * Callback de andamento DENTRO de um estagio (8.5). Opcional de proposito: o
 * auto-scan chama estes stages sem passar nada e nao muda em nada.
 *
 * E sincrono e best-effort — quem recebe decide se escreve no banco, e a que
 * ritmo. Nunca pode bloquear nem derrubar o pipeline.
 */
export type OnStageProgress = (feitos: number, total: number) => void;

export async function runContentFetch(
  urls: SearchResult[],
  concurrency: number,
  rejectedUrls: RejectedUrl[],
  logPrefix: string,
  onProgress?: OnStageProgress,
): Promise<FetchedContent[]> {
  let feitos = 0;
  const contentResults = await asyncPool<SearchResult, FetchedContent | null>(
    urls,
    concurrency,
    async (r) => {
      try {
        return await rateLimiter.schedule('jina', () => contentFetcher.fetch(r.url));
      } catch (err) {
        logger.error(`${logPrefix} fetch failed ${r.url}: ${(err as Error).message}`);
        return null;
      } finally {
        // `finally` porque erro tambem e andamento — senao a barra trava numa
        // busca cheia de URL morta, que e justamente quando parece travado.
        feitos++;
        try { onProgress?.(feitos, urls.length); } catch { /* nunca derruba o stage */ }
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

/** Data de N dias atras em YYYY-MM-DD, pra comparar com `data_ocorrencia` sem timezone. */
export function diasAtrasISO(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
}

/**
 * Como o runContentFetch, mas carrega tambem o que ACABOU de ser extraido —
 * e o que transforma a tela de carregamento em algo que da vontade de olhar,
 * e o dado ja esta em memoria, custo zero.
 */
export type OnFilter2Progress = (
  feitos: number,
  total: number,
  achado?: { tipo_crime: string; bairro?: string | null; data_ocorrencia: string },
) => void;

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
  onProgress?: OnFilter2Progress,
): Promise<Filter2StageResult> {
  if (contents.length === 0) {
    return { extractions: [], tokensUsed: { filter2: 0, embedding: 0 } };
  }

  let feitos = 0;

  // Antes era um `for` sequencial usando ~20% da vazao que o rate limiter
  // permite. Com o stage 1 trazendo 3x mais URL (queries curtas, 2026-08-01),
  // o serial virou o gargalo da busca inteira.
  //
  // ATENCAO: o `asyncPool` NAO tem try/catch — se `fn` rejeitar, o
  // `Promise.all` interno derruba o pool inteiro. Todo erro tem que morrer
  // aqui dentro.
  const analisarUm = async (fetched: FetchedContent): Promise<ItemFilter2> => {
    {
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

        // Os dois pos-filtros abaixo sao os maiores motivos de descarte da busca
        // manual — e os dois descartam informacao que o usuario quer ver. Com
        // `classificar` ligado eles marcam em vez de jogar fora. Sem ele, o
        // comportamento e byte a byte o de sempre (caminho do auto-scan).
        const classificar = postFilter?.classificar === true;
        let foraDoPeriodo = false;
        let cidadeVizinha = false;

        // Post-filter: date range (comparar só YYYY-MM-DD, sem timezone)
        if (postFilter?.periodoDias) {
          const cutoffStr = diasAtrasISO(postFilter.periodoDias);
          if (extracted.data_ocorrencia < cutoffStr) {
            // O horizonte e o descarte de verdade: fora da janela ainda interessa,
            // fora do horizonte nao. Sem horizonte definido, nada e mantido.
            const horizonteStr = classificar && postFilter.horizonteDias
              ? diasAtrasISO(postFilter.horizonteDias)
              : null;

            if (!horizonteStr || extracted.data_ocorrencia < horizonteStr) {
              return {
                tipo: 'rejeitado', f2: f2tokens,
                rejeicao: { url: fetched.url, stage: 'filter2_date', reason: `Data antiga: ${extracted.data_ocorrencia}` },
                log: `filter2 data fora: ${extracted.data_ocorrencia} (cutoff: ${cutoffStr}) → ${fetched.url.substring(0, 80)}`,
              };
            }
            foraDoPeriodo = true;
          }
        }

        // Post-filter: cidade/estado
        if (postFilter?.cidades && postFilter?.estado) {
          const estadoExtraido = normalizeText(extracted.estado || '');
          const estadoEsperado = normalizeText(postFilter.estado);
          const estadoBate = estadoExtraido.length > 0 && estadoExtraido.includes(estadoEsperado);

          // Cidade por IGUALDADE (depois de limpar "(BA)", "- SC", "Municipio de"),
          // NUNCA por substring: `includes` colocou 10 noticias de Sao Jose do
          // Cedro no feed de Sao Jose. Ver `limparNomeCidade` em utils/helpers.
          // O estado segue sendo validado SEMPRE — sem ele nao ha como separar
          // homonimas (Sao Jose/SC vs Sao Jose/SP).
          const cidadeBate = postFilter.cidades.some(
            (c) => mesmaCidade(extracted.cidade, c, postFilter.estado)
          );

          if (!(cidadeBate && estadoBate)) {
            // Vizinha ainda exige o estado bater. Sem isso, Camacari/SP entraria
            // como vizinha de Salvador/BA — o mesmo erro de cidade homonima que
            // o filtro existe pra evitar.
            const ehVizinha = classificar && estadoBate && (postFilter.cidadesRegiao || []).some(
              (c) => mesmaCidade(extracted.cidade, c, postFilter.estado)
            );

            if (!ehVizinha) {
              // Marca quando a regra ANTIGA (substring) teria aceitado. Fica
              // gravado em `rejected_urls` e permite medir se o aperto derrubou
              // noticia boa, sem instrumentar nada novo.
              const cidadeExtraida = normalizeText(extracted.cidade);
              const quaseAceito = [...postFilter.cidades, ...(postFilter.cidadesRegiao || [])].some((c) => {
                const alvo = normalizeText(c);
                return cidadeExtraida.includes(alvo) || alvo.includes(cidadeExtraida);
              });
              const marca = quaseAceito ? ' [parcial]' : '';

              return {
                tipo: 'rejeitado', f2: f2tokens,
                rejeicao: { url: fetched.url, stage: 'filter2_location', reason: `Local errado${marca}: ${extracted.cidade}/${extracted.estado || '?'} (esperado: ${postFilter.estado})` },
                log: `filter2 cidade/estado fora${marca}: ${extracted.cidade}/${extracted.estado || '?'} (esperado: ${postFilter.cidades.join(', ')}, ${postFilter.estado}) → ${fetched.url.substring(0, 80)}`,
              };
            }
            cidadeVizinha = true;
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
            // So aparecem quando true — item do auto-scan sai limpo, sem campo novo.
            ...(foraDoPeriodo ? { fora_do_periodo: true } : {}),
            ...(cidadeVizinha ? { cidade_vizinha: true } : {}),
          },
        };
      } catch (err) {
        return { tipo: 'erro', url: fetched.url, msg: (err as Error).message };
      }
    }
  };

  const resultados = await asyncPool<FetchedContent, ItemFilter2>(
    contents,
    FILTER2_CONCURRENCY,
    async (fetched): Promise<ItemFilter2> => {
      const r = await analisarUm(fetched);
      // Conta rejeitado e erro tambem: e andamento. Contar so o que deu certo
      // faria a barra parecer travada exatamente na busca que mais rejeita.
      feitos++;
      try {
        onProgress?.(
          feitos,
          contents.length,
          r.tipo === 'ok'
            ? {
                tipo_crime: r.extraction.tipo_crime,
                bairro: r.extraction.bairro ?? null,
                data_ocorrencia: r.extraction.data_ocorrencia,
              }
            : undefined,
        );
      } catch { /* progresso nunca derruba o stage */ }
      return r;
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

  const nForaPeriodo = extractions.filter((e) => e.fora_do_periodo).length;
  const nVizinha = extractions.filter((e) => e.cidade_vizinha).length;
  const baldes = nForaPeriodo || nVizinha
    ? ` | salvos em vez de descartados: ${nForaPeriodo} fora do periodo, ${nVizinha} de cidade vizinha`
    : '';

  logger.info(`${logPrefix} filter2: ${contents.length} → ${extractions.length} (${contents.length - extractions.length} rejeitadas${erros ? `, ${erros} por erro` : ''})${baldes} [filter2: ${filter2Tokens} tokens, embedding: ${embeddingTokens} tokens]`);
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
