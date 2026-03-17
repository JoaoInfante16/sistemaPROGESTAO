// ============================================
// URL Deduplicator - Normalização e dedup de URLs
// ============================================
// Usado no Stage 1 do pipeline para eliminar URLs
// duplicadas vindas de múltiplas fontes (Google, RSS, crawling, SSP).

import { SearchResult } from './SearchProvider';

/**
 * Normaliza uma URL removendo protocolo, www, trailing slash,
 * fragmentos e parâmetros de tracking comuns.
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);

    // Remover parâmetros de tracking
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'ref', 'source',
    ];
    for (const param of trackingParams) {
      url.searchParams.delete(param);
    }

    // Reconstruir sem fragmento
    let normalized = `${url.hostname}${url.pathname}`;

    // Remover www.
    normalized = normalized.replace(/^www\./, '');

    // Remover trailing slash
    normalized = normalized.replace(/\/+$/, '');

    // Adicionar query string limpa (se existir)
    const query = url.searchParams.toString();
    if (query) {
      normalized += `?${query}`;
    }

    return normalized.toLowerCase();
  } catch {
    // Se URL inválida, retorna lowercase como fallback
    return rawUrl.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Deduplica array de SearchResult por URL normalizada.
 * Mantém a primeira ocorrência (prioridade por ordem de inserção).
 */
export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const result of results) {
    const normalized = normalizeUrl(result.url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(result);
    }
  }

  return unique;
}
