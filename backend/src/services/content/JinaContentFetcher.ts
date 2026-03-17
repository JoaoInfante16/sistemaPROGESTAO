import { ContentFetcher, FetchedContent } from './ContentFetcher';
import { config } from '../../config';

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

    const data = (await response.json()) as {
      data?: { content?: string; title?: string };
      content?: string;
      title?: string;
    };

    const content = data.data?.content || data.content || '';

    return {
      url,
      title: data.data?.title || data.title || '',
      content,
      wordCount: content.trim() ? content.trim().split(/\s+/).length : 0,
    };
  }
}
