import * as Sentry from '@sentry/node';
import { ContentFetcher, FetchedContent } from './ContentFetcher';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

const BRIGHTDATA_API_URL = 'https://api.brightdata.com/request';

// Defesa preventiva, NAO conserto de sintoma observado: no teste do Joao em
// 02/08 o estagio 4 andou normalmente, levando ~2 min. O risco e outro — sem
// timeout, uma requisicao pendurada ocupa uma vaga do pool PARA SEMPRE, e o
// pool tem 5 vagas. Duas URLs mortas comeriam 40% da vazao do estagio ate o
// fim da busca. E a mesma falha que o SERP_TIMEOUT_MS do provider da SERP
// existe pra evitar, e la ela ja aconteceu.
//
// 20s no Jina: o normal e ~3s por artigo; passou muito disso, o artigo nao vem.
// 30s no fallback: o Web Unlocker e mais lento por natureza (ele existe pra
// URLs que o Jina ja nao conseguiu — SSL quebrado, .gov.br).
//
// Timeout NAO cai no fallback do Bright Data de proposito (o catch do fetch()
// so desvia em 422/503/SSL/403): se o Jina levou 20s, o Unlocker levaria mais.
const JINA_TIMEOUT_MS = 20_000;
const UNLOCKER_TIMEOUT_MS = 30_000;

export class JinaContentFetcher implements ContentFetcher {
  private apiKey: string;

  constructor() {
    this.apiKey = config.jinaApiKey;
  }

  private chamarJina(jinaUrl: string): Promise<Response> {
    return fetch(jinaUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'X-Return-Format': 'text',
      },
      signal: AbortSignal.timeout(JINA_TIMEOUT_MS),
    });
  }

  /**
   * Quanto esperar depois de um 429.
   *
   * `Retry-After` vem em segundos ou como data HTTP. Teto de 10s de propósito:
   * o artigo não vale uma busca inteira parada, e o pool tem outras 19 URLs
   * andando enquanto esta espera. Sem o header, 2s — o suficiente pra janela
   * de rate limit girar sem custar tempo de parede visível.
   */
  private esperaDoRetryAfter(header: string | null): number {
    const TETO_MS = 10_000;
    if (!header) return 2_000;

    const segundos = Number(header);
    if (Number.isFinite(segundos) && segundos > 0) {
      return Math.min(segundos * 1000, TETO_MS);
    }

    const data = Date.parse(header);
    if (!Number.isNaN(data)) {
      return Math.min(Math.max(data - Date.now(), 0), TETO_MS);
    }

    return 2_000;
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

    let response = await this.chamarJina(jinaUrl);

    // 429 = pedimos rápido demais. É o ÚNICO status que merece esperar e
    // repetir: não é o artigo que está ruim, é a nossa vazão.
    //
    // ⚠️ Sem isto, subir a concorrência do estágio 4 trocaria lentidão por
    // notícia faltando — o 429 caía no `throw` lá em cima, não entrava na lista
    // de fallback (422/503/SSL/403) e o artigo era perdido SEM aparecer em
    // lugar nenhum. Perder em silêncio é pior que demorar.
    if (response.status === 429) {
      const espera = this.esperaDoRetryAfter(response.headers.get('retry-after'));
      logger.warn(`[Jina] 429 em ${url.substring(0, 60)} — repetindo em ${espera}ms`);
      await new Promise((r) => setTimeout(r, espera));
      response = await this.chamarJina(jinaUrl);
    }

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
      signal: AbortSignal.timeout(UNLOCKER_TIMEOUT_MS),
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
