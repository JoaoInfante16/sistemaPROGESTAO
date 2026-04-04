import * as Sentry from '@sentry/node';
import { ContentFetcher, FetchedContent } from './ContentFetcher';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

const BRIGHTDATA_API_URL = 'https://api.brightdata.com/request';

export class JinaContentFetcher implements ContentFetcher {
  private apiKey: string;

  constructor() {
    this.apiKey = config.jinaApiKey;
  }

  async fetch(url: string): Promise<FetchedContent> {
    try {
      return await this.fetchWithJina(url);
    } catch (err) {
      const msg = (err as Error).message || '';
      const isSSLOrBlock = msg.includes('422') || msg.includes('503') || msg.includes('SSL') || msg.includes('CERT') || msg.includes('403');

      if (isSSLOrBlock && config.brightdataApiKey) {
        logger.warn(`[Jina] Failed for ${url.substring(0, 60)}, trying Bright Data fallback: ${msg.substring(0, 100)}`);
        return await this.fetchWithBrightData(url);
      }

      Sentry.captureException(err, { tags: { provider: 'jina' }, extra: { url: url.substring(0, 100) } });
      throw err;
    }
  }

  private async fetchWithJina(url: string): Promise<FetchedContent> {
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Return-Format': 'text',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Jina Reader API error (${response.status}): ${errorBody}`);
    }

    // Capturar tokens do header (Jina retorna em x-jina-tokens-used)
    const jinaTokens = parseInt(response.headers.get('x-jina-tokens-used') || '0', 10);

    const rawText = await response.text();
    logger.debug(`[Jina] ${url.substring(0, 60)} raw response: ${rawText.substring(0, 300).replace(/\n/g, ' ')}`);

    let data: {
      data?: { content?: string; title?: string; text?: string; description?: string; usage?: { tokens?: number } };
      content?: string;
      title?: string;
      text?: string;
      usage?: { tokens?: number };
    };

    try {
      data = JSON.parse(rawText);
    } catch {
      const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
      // Estimar tokens: ~1.3 tokens por palavra em PT-BR
      const estimatedTokens = jinaTokens || Math.ceil(wordCount * 1.3);
      logger.debug(`[Jina] ${url.substring(0, 60)} returned plain text (${rawText.length} chars, ~${estimatedTokens} tokens)`);
      return {
        url,
        title: '',
        content: rawText,
        wordCount,
        tokensUsed: estimatedTokens,
      };
    }

    const content = data.data?.content || data.data?.text || data.data?.description || data.content || data.text || '';
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
    // Tokens: header > response body > estimativa
    const tokensUsed = jinaTokens || data.usage?.tokens || data.data?.usage?.tokens || Math.ceil(wordCount * 1.3);
    logger.info(`[Jina] ${url.substring(0, 60)} content=${content.length} chars, ~${tokensUsed} tokens`);

    return {
      url,
      title: data.data?.title || data.title || '',
      content,
      wordCount,
      tokensUsed,
    };
  }

  /**
   * Fallback: Bright Data Web Unlocker para URLs que Jina nao consegue (SSL, .gov.br).
   * $0.0015/request. Retorna HTML bruto que parseamos pra texto.
   */
  private async fetchWithBrightData(url: string): Promise<FetchedContent> {
    const response = await fetch(BRIGHTDATA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.brightdataApiKey}`,
      },
      body: JSON.stringify({
        zone: config.brightdataZone,
        url,
        format: 'raw',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Bright Data Web Unlocker error (${response.status}): ${errorBody.substring(0, 200)}`);
    }

    const html = await response.text();
    const content = this.htmlToText(html);

    logger.info(`[BrightData-Fallback] ${url.substring(0, 60)} content=${content.length} chars`);

    return {
      url,
      title: this.extractTitle(html),
      content,
      wordCount: content.trim() ? content.trim().split(/\s+/).length : 0,
    };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim() : '';
  }
}
