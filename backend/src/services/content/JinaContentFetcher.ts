import { ContentFetcher, FetchedContent } from './ContentFetcher';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

export class JinaContentFetcher implements ContentFetcher {
  private apiKey: string;

  constructor() {
    this.apiKey = config.jinaApiKey;
  }

  async fetch(url: string): Promise<FetchedContent> {
    // Jina Reader API: prepend r.jina.ai/ à URL
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
      // Jina retornou texto puro, não JSON
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
}
