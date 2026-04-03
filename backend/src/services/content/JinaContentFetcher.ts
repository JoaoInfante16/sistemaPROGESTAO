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
      const isSSLOrBlock = msg.includes('422') || msg.includes('SSL') || msg.includes('CERT') || msg.includes('403');

      if (isSSLOrBlock && config.brightdataApiKey) {
        logger.warn(`[Jina] Failed for ${url.substring(0, 60)}, trying Bright Data fallback: ${msg.substring(0, 100)}`);
        return await this.fetchWithBrightData(url);
      }

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

    const rawText = await response.text();
    logger.debug(`[Jina] ${url.substring(0, 60)} raw response: ${rawText.substring(0, 300).replace(/\n/g, ' ')}`);

    let data: {
      data?: { content?: string; title?: string; text?: string; description?: string };
      content?: string;
      title?: string;
      text?: string;
    };

    try {
      data = JSON.parse(rawText);
    } catch {
      logger.debug(`[Jina] ${url.substring(0, 60)} returned plain text (${rawText.length} chars)`);
      return {
        url,
        title: '',
        content: rawText,
        wordCount: rawText.trim() ? rawText.trim().split(/\s+/).length : 0,
      };
    }

    const content = data.data?.content || data.data?.text || data.data?.description || data.content || data.text || '';
    logger.info(`[Jina] ${url.substring(0, 60)} content=${content.length} chars, title="${(data.data?.title || data.title || '').substring(0, 50)}"`);

    return {
      url,
      title: data.data?.title || data.title || '',
      content,
      wordCount: content.trim() ? content.trim().split(/\s+/).length : 0,
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
