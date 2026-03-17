// ============================================
// Google News RSS Provider - GRÁTIS
// ============================================
// Busca notícias via Google News RSS feed.
// Sem API key, sem custo, sem quota.
// URL: https://news.google.com/rss/search?q=...&hl=pt-BR&gl=BR

import { SearchResult } from './SearchProvider';
import { logger } from '../../middleware/logger';

/**
 * Faz fetch do Google News RSS e extrai artigos.
 * Retorna SearchResult[] compatível com o pipeline.
 */
export async function fetchGoogleNewsRSS(query: string): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

  try {
    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'NetriosNews/1.0',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      logger.warn(`[GoogleNewsRSS] HTTP ${response.status} for query: ${query}`);
      return [];
    }

    const xml = await response.text();
    return parseRSSItems(xml);
  } catch (error) {
    logger.error(`[GoogleNewsRSS] Fetch failed: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Parse simples de RSS XML sem dependência externa.
 * Extrai <item> → { url (link), title, snippet (description) }
 */
export function parseRSSItems(xml: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Match all <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');

    if (link) {
      results.push({
        url: resolveGoogleNewsUrl(link),
        title: cleanHtml(title || ''),
        snippet: cleanHtml(description || title || ''),
      });
    }
  }

  return results;
}

/**
 * Extrai conteúdo de uma tag XML simples.
 */
function extractTag(xml: string, tag: string): string | null {
  // Try CDATA first
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`);
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  // Plain text
  const plainRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const plainMatch = plainRegex.exec(xml);
  if (plainMatch) return plainMatch[1].trim();

  return null;
}

/**
 * Google News URLs podem ser redirects (https://news.google.com/rss/articles/...).
 * Retorna a URL como está — o pipeline resolve o redirect via Jina.
 */
function resolveGoogleNewsUrl(url: string): string {
  return url.trim();
}

/**
 * Remove tags HTML e entidades comuns.
 */
function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
