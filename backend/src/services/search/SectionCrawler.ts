// ============================================
// Section Crawler - Crawl seções de crime/polícia
// ============================================
// Quando URLs de um jornal são encontradas, tenta acessar
// a seção "polícia" desse jornal e extrair artigos adicionais.
// Usa Jina para extrair conteúdo da página de seção.

import { SearchResult } from './SearchProvider';
import { logger } from '../../middleware/logger';
import { redis } from '../../config/redis';

/**
 * Mapeamento de domínios conhecidos → seções de crime.
 * Formato: domínio → array de paths a tentar.
 */
const KNOWN_SECTIONS: Record<string, string[]> = {
  'g1.globo.com': ['/policia/', '/monitor-da-violencia/'],
  'noticias.uol.com.br': ['/cotidiano/seguranca/'],
  'noticias.r7.com': ['/cidades/'],
  'www.correiobraziliense.com.br': ['/cidades-df/policia/'],
  'www.correio24horas.com.br': ['/policia/'],
  'gauchazh.clicrbs.com.br': ['/seguranca/'],
  'diariodonordeste.verdesmares.com.br': ['/seguranca/'],
};

/**
 * Seções genéricas para tentar em domínios desconhecidos.
 */
const GENERIC_SECTIONS = ['/policia/', '/seguranca/', '/crime/', '/cidades/'];

const SECTION_CACHE_TTL = 7 * 24 * 60 * 60; // 7 dias
const SECTION_CACHE_PREFIX = 'section:';

export interface SectionCrawlerOptions {
  maxDomains: number;
  jinaApiKey: string;
}

/**
 * Extrai domínios únicos a partir de URLs encontradas.
 */
export function extractUniqueDomains(urls: string[]): string[] {
  const domains = new Set<string>();
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      domains.add(parsed.hostname);
    } catch {
      // URL inválida, ignorar
    }
  }
  return Array.from(domains);
}

/**
 * Tenta crawlear seções de crime de domínios conhecidos.
 * Retorna URLs de artigos encontrados.
 */
export async function crawlSections(
  discoveredUrls: string[],
  options: SectionCrawlerOptions
): Promise<SearchResult[]> {
  const domains = extractUniqueDomains(discoveredUrls).slice(0, options.maxDomains);
  const allResults: SearchResult[] = [];

  for (const domain of domains) {
    try {
      const articles = await crawlDomainSections(domain, options.jinaApiKey);
      allResults.push(...articles);
    } catch (error) {
      logger.warn(`[SectionCrawler] Failed to crawl ${domain}: ${(error as Error).message}`);
    }
  }

  logger.info(`[SectionCrawler] Found ${allResults.length} articles from ${domains.length} domains`);
  return allResults;
}

/**
 * Crawl de um domínio específico.
 * Tenta seções conhecidas primeiro, depois genéricas.
 */
async function crawlDomainSections(domain: string, jinaApiKey: string): Promise<SearchResult[]> {
  // Checar cache de seções descobertas
  const cachedSection = await getCachedSection(domain);
  if (cachedSection === 'none') {
    return []; // Domínio já tentado sem sucesso
  }

  const sectionsToTry = cachedSection
    ? [cachedSection]
    : KNOWN_SECTIONS[domain] || GENERIC_SECTIONS;

  for (const section of sectionsToTry) {
    const sectionUrl = `https://${domain}${section}`;
    const articles = await fetchAndExtractLinks(sectionUrl, domain, jinaApiKey);

    if (articles.length > 0) {
      // Cachear seção que funcionou
      await cacheSection(domain, section);
      return articles;
    }
  }

  // Nenhuma seção funcionou — cachear como 'none' para não tentar de novo
  await cacheSection(domain, 'none');
  return [];
}

/**
 * Usa Jina para extrair conteúdo de uma página de seção
 * e depois extrai links que parecem artigos.
 */
async function fetchAndExtractLinks(
  sectionUrl: string,
  domain: string,
  jinaApiKey: string
): Promise<SearchResult[]> {
  try {
    const jinaUrl = `https://r.jina.ai/${sectionUrl}`;
    const response = await fetch(jinaUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${jinaApiKey}`,
        'X-Return-Format': 'text',
      },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { data?: { content?: string; title?: string } };
    const content = data.data?.content || '';

    return extractArticleLinks(content, domain);
  } catch {
    return [];
  }
}

/**
 * Extrai links que parecem artigos a partir do conteúdo textual.
 * Procura URLs do mesmo domínio com padrões de artigo.
 */
export function extractArticleLinks(content: string, domain: string): SearchResult[] {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // Match URLs no texto (Jina geralmente retorna markdown com links)
  const urlRegex = /https?:\/\/[^\s)\]"'<>]+/g;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(content)) !== null) {
    const url = match[0].replace(/[.,;:!?)]+$/, ''); // limpar pontuação final

    if (!url.includes(domain)) continue;
    if (seen.has(url)) continue;
    if (!looksLikeArticle(url)) continue;

    seen.add(url);
    results.push({
      url,
      title: '',
      snippet: `Artigo encontrado via seção de ${domain}`,
    });
  }

  return results;
}

/**
 * Heurística: URL parece ser um artigo?
 * Artigos geralmente têm datas ou slugs longos no path.
 */
export function looksLikeArticle(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Ignorar raiz, seções, RSS, imagens
    if (path === '/' || path.length < 15) return false;
    if (path.endsWith('.xml') || path.endsWith('.rss')) return false;
    if (path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.gif')) return false;
    if (path.endsWith('.css') || path.endsWith('.js')) return false;

    // Padrão de data no path (YYYY/MM/DD ou YYYYMMDD)
    if (/\/\d{4}\/\d{2}\/\d{2}\//.test(path)) return true;
    if (/\/\d{8}\//.test(path)) return true;

    // Slug longo (indicativo de artigo)
    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    if (lastSegment.length > 20 && lastSegment.includes('-')) return true;

    // Extensões comuns de artigo
    if (path.endsWith('.ghtml') || path.endsWith('.html') || path.endsWith('.htm')) return true;
    if (path.includes('/noticia/') || path.includes('/noticias/')) return true;

    return false;
  } catch {
    return false;
  }
}

async function getCachedSection(domain: string): Promise<string | null> {
  try {
    const cached = await redis.get(`${SECTION_CACHE_PREFIX}${domain}`);
    return cached;
  } catch {
    return null;
  }
}

async function cacheSection(domain: string, section: string): Promise<void> {
  try {
    await redis.set(`${SECTION_CACHE_PREFIX}${domain}`, section, 'EX', SECTION_CACHE_TTL);
  } catch {
    // Cache failure is non-critical
  }
}
