// ============================================
// SSP Scraper - Secretarias de Segurança Pública
// ============================================
// Scraping de páginas de notícias das SSPs estaduais.
// Usa Jina para extrair conteúdo e depois filtra links relevantes.

import { SearchResult } from './SearchProvider';
import { SSPSource, findSSPSource } from './sspSources';
import { extractArticleLinks, looksLikeArticle } from './SectionCrawler';
import { logger } from '../../middleware/logger';

export interface SSPScraperOptions {
  jinaApiKey: string;
}

/**
 * Busca notícias da SSP estadual correspondente.
 * @param stateName Nome ou sigla do estado
 */
export async function scrapeSSP(
  stateName: string,
  options: SSPScraperOptions
): Promise<SearchResult[]> {
  const source = findSSPSource(stateName);
  if (!source) {
    logger.debug(`[SSPScraper] No SSP source for state: ${stateName}`);
    return [];
  }

  try {
    return await fetchSSPNews(source, options.jinaApiKey);
  } catch (error) {
    logger.warn(`[SSPScraper] Failed to scrape ${source.uf}: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Faz fetch da página de notícias da SSP via Jina e extrai links.
 */
async function fetchSSPNews(source: SSPSource, jinaApiKey: string): Promise<SearchResult[]> {
  const jinaUrl = `https://r.jina.ai/${source.newsUrl}`;

  const response = await fetch(jinaUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${jinaApiKey}`,
      'X-Return-Format': 'text',
    },
  });

  if (!response.ok) {
    logger.warn(`[SSPScraper] HTTP ${response.status} for ${source.uf}`);
    return [];
  }

  const data = (await response.json()) as { data?: { content?: string } };
  const content = data.data?.content || '';

  // Extrair links do domínio da SSP
  const articles = extractArticleLinks(content, source.domain);

  // Também tentar extrair links de .gov.br que podem ser de outros órgãos
  const govLinks = extractGovLinks(content);

  const combined = [...articles, ...govLinks];

  logger.info(`[SSPScraper] ${source.uf}: found ${combined.length} articles`);
  return combined;
}

/**
 * Extrai links de domínios .gov.br que parecem artigos.
 */
function extractGovLinks(content: string): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  const urlRegex = /https?:\/\/[^\s)\]"'<>]*\.gov\.br[^\s)\]"'<>]*/g;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(content)) !== null) {
    const url = match[0].replace(/[.,;:!?)]+$/, '');

    if (seen.has(url)) continue;
    if (!looksLikeArticle(url)) continue;

    seen.add(url);
    results.push({
      url,
      title: '',
      snippet: 'Artigo encontrado via SSP estadual',
    });
  }

  return results;
}
