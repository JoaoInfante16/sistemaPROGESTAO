// ============================================
// Bright Data SERP Provider — Dual Mode
// ============================================
// Os dois modos usam a MESMA SERP API sincrona (via zone), mudando so o indice:
//   NEWS mode: tbm=nws   — indice de noticias. Estavel, e o alicerce do sistema.
//   WEB  mode: organico  — portais locais, prefeitura, comunicados de policia.
//              Conteudo que NAO aparece no indice de noticias.
//
// O modo web ja usou o scraper de dataset ("Google SERP - 100 Results"). Abandonado
// em 2026-08-01: o tempo de coleta dele saltou de 17-70s (ate 21/07) para 660-978s,
// travando a busca manual. A SERP API entrega o MESMO indice organico em 7-12s por
// pagina — 60 a 100x mais rapido. Quando falha, falha em segundos, nao em minutos.
// Medicoes em workdesk/AUDITORIA_2026-07-30.md.
//
// Docs: https://docs.brightdata.com/scraping-automation/serp-api

import * as Sentry from '@sentry/node';
import { SearchProvider, SearchResult, SearchOptions, SearchResponse } from './SearchProvider';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { parseSerpDate, inicioDaJanela } from './serpDateParser';

const SYNC_API_URL = 'https://api.brightdata.com/request';

// Medido: 5-20s por pagina. Sem isto uma pagina pendurada trava o stage 1 da
// busca manual PARA SEMPRE — nao ha nada acima que corte.
const SERP_TIMEOUT_MS = 60_000;

export class BrightDataSERPProvider implements SearchProvider {
  private apiKey: string;
  private zone: string;
  public lastRequestCount = 0;

  constructor() {
    this.apiKey = config.brightdataApiKey;
    this.zone = config.brightdataZone;
    if (!this.apiKey) {
      logger.warn('[BrightData] BRIGHTDATA_API_KEY not set — searches will fail');
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const response = await this.searchWithMeta(query, options);
    return response.results;
  }

  async searchWithMeta(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    return await this.searchSerpPaginated(query, options, options.searchMode || 'news');
  }

  // ============================================
  // SERP sincrona via zone, paginada — serve os dois indices
  // ============================================

  private async searchSerpPaginated(
    query: string,
    options: SearchOptions,
    mode: 'news' | 'web',
  ): Promise<SearchResponse> {
    const totalWanted = options.maxResults || 20;
    const allResults: SearchResult[] = [];
    let requestsMade = 0;

    // Google deprecou `num` (set/2025) e devolve ~10 resultados/pagina.
    // Paginacao correta: `start` em incrementos de 10 (fix de 22/07 no staging).
    // Com incremento de 20 o codigo pulava as posicoes 10-19 de cada pagina —
    // medido em 2026-07-30: Florianopolis tem 31 noticias no mes, e a paginacao
    // errada entregava so 20 delas.
    const perPage = 10;
    const maxPages = Math.ceil(totalWanted / perPage);
    const TAG = mode === 'web' ? '[BrightData:Web]' : '[BrightData:News]';

    // Quantas paginas pedir de uma vez. Default 1 = serial, como sempre foi.
    // Ver o comentario de `pageConcurrency` em SearchProvider.ts pra saber por
    // que isto e opt-in e nao padrao.
    const lote = Math.max(1, options.pageConcurrency || 1);

    // Com `sbd:1` os resultados vem em ordem decrescente de data, entao da pra
    // parar de pedir pagina assim que a mais nova dela ja e mais velha que a
    // janela pedida. Antes se puxava um numero fixo de paginas e se jogava fora
    // no Filter2 — em Porto Alegre isso significou baixar 19 artigos pelo Jina
    // pra aproveitar 1.
    const janela = inicioDaJanela(options.dateRestrict);

    let parar = false;
    let especulativas = 0;

    for (let base = 0; base < maxPages && !parar; base += lote) {
      const paginas: number[] = [];
      for (let p = base; p < Math.min(base + lote, maxPages); p++) paginas.push(p);

      const respostas = await Promise.allSettled(
        paginas.map((p) => this.fetchSerpPage(query, options, mode, p * perPage))
      );

      // As paginas do lote ja foram pedidas e pagas, mas sao consumidas EM ORDEM
      // com exatamente a mesma regra de parada do codigo serial. Se a parada cai
      // no meio do lote, o resto e descartado — o resultado final fica IDENTICO
      // ao serial, e o preco da aposta e $0.0015 por pagina especulativa.
      for (let i = 0; i < respostas.length; i++) {
        const page = paginas[i];
        const r = respostas[i];

        if (r.status === 'rejected') {
          // So chega aqui se o serial tambem tivesse feito esta requisicao (nao
          // parou antes) — entao o erro e legitimo e deve subir. A promise
          // rejeitada nao diz quantas tentativas gastou; conta 1 e segue.
          requestsMade += 1;
          this.lastRequestCount = requestsMade;
          throw r.reason;
        }

        requestsMade += r.value.requests;
        const { data, rawText } = r.value;

        if (!data) {
          // Corpo vazio ou HTML com HTTP 200 = provider quebrado (brd_json ausente,
          // zona errada, rate limit), NAO "nao achou nada". Sem isto a busca conclui
          // com 0 resultados sem erro nenhum — foi o que mascarou o bug de 22/07.
          logger.error(`${TAG} Page ${page + 1} resposta nao-JSON (${rawText.length} bytes): "${rawText.substring(0, 120)}"`);
          if (page === 0) {
            Sentry.captureException(new Error(`${TAG} resposta non-JSON na pagina 1 — 0 resultados`), {
              tags: { provider: 'brightdata', mode },
              extra: { query: query.substring(0, 100), preview: rawText.substring(0, 300) },
            });
          }
          parar = true;
        } else {
          const pageResults = this.parseNewsResults(data);
          logger.info(`${TAG} Page ${page + 1} → ${pageResults.length} results`);
          allResults.push(...pageResults);

          if (pageResults.length < 5) parar = true;
          else if (allResults.length >= totalWanted) parar = true;
          else if (janela) {
            // Saiu da janela? A proxima pagina so tem coisa ainda mais velha.
            const maisNovaDaPagina = this.dataMaisNova(data);
            if (maisNovaDaPagina && maisNovaDaPagina < janela) {
              logger.info(`${TAG} Page ${page + 1} ja e toda anterior a ${janela.toISOString().split('T')[0]} — parando de paginar`);
              parar = true;
            }
          }
        }

        if (parar) {
          // Paginas do lote que o serial nunca teria pedido.
          for (let j = i + 1; j < respostas.length; j++) {
            const sobra = respostas[j];
            if (sobra.status === 'fulfilled') requestsMade += sobra.value.requests;
            else requestsMade += 1;
            especulativas++;
          }
          break;
        }
      }
    }

    if (especulativas > 0) {
      logger.info(`${TAG} ${especulativas} pagina(s) especulativa(s) descartada(s) — custo da paginacao em lote`);
    }

    const results = allResults.slice(0, totalWanted);
    this.lastRequestCount = requestsMade;
    const loc = options.location ? `[${options.location.city || '?'}/${options.location.state || '?'}]` : '';
    logger.info(`${TAG} ${loc} "${query.substring(0, 50)}..." → ${results.length} results (${requestsMade} req${lote > 1 ? `, lote de ${lote}` : ''})`);
    return { results, requestCount: requestsMade };
  }

  /**
   * Uma pagina da SERP. Devolve o JSON parseado (ou `null` se o corpo nao for
   * JSON) e quantas requisicoes HTTP foram gastas — a contagem importa porque a
   * Bright Data cobra por requisicao, inclusive a repetida.
   *
   * Lanca em falha explicita (HTTP != 2xx, `x-brd-err-code`): sao recusas reais
   * e devem subir pro BullMQ reprocessar e pro Sentry registrar.
   */
  private async fetchSerpPage(
    query: string,
    options: SearchOptions,
    mode: 'news' | 'web',
    start: number,
  ): Promise<{ data: SERPResponse | null; rawText: string; requests: number }> {
    const TAG = mode === 'web' ? '[BrightData:Web]' : '[BrightData:News]';
    const googleUrl = this.buildSerpUrl(query, { start, mode, dateRestrict: options.dateRestrict });
    let requests = 0;

    // Corpo de 0 bytes com HTTP 200 e SEM `x-brd-err-code` foi observado em
    // 01/08 e segue sem explicacao (nao era concorrencia — a doc descarta).
    // Cabe repetir UMA vez porque o sinal e inequivoco: 0 bytes nao e "nao achei
    // nada", e resposta que nao chegou. Isso nao contradiz a regra do projeto de
    // nunca repetir por contagem baixa — la o sinal e ambiguo, aqui nao e.
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      const response = await fetch(SYNC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ zone: this.zone, url: googleUrl, format: 'raw' }),
        signal: AbortSignal.timeout(SERP_TIMEOUT_MS),
      });
      requests++;

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`SERP error (${response.status}): ${err.substring(0, 300)}`);
      }

      // A Bright Data sinaliza falha de auth/proxy com HTTP 200, corpo VAZIO e o
      // erro so nos headers (ex: ip_blacklisted). Sem esta checagem o pipeline
      // trata como "nao achou nada" e a busca conclui com 0 resultados, sem erro
      // nenhum — foi o que mascarou o bug ate 2026-07-30. Falhar alto e melhor.
      const brdErrCode = response.headers.get('x-brd-err-code');
      if (brdErrCode) {
        const brdErrMsg = response.headers.get('x-brd-err-msg') || '';
        throw new Error(`Bright Data recusou (${brdErrCode}): ${brdErrMsg.substring(0, 300)}`);
      }

      const rawText = await response.text();

      if (rawText.length === 0 && tentativa === 1) {
        logger.warn(`${TAG} start=${start} corpo vazio (0 bytes, sem x-brd-err-code) — repetindo uma vez`);
        continue;
      }

      try {
        return { data: JSON.parse(rawText) as SERPResponse, rawText, requests };
      } catch {
        return { data: null, rawText, requests };
      }
    }

    return { data: null, rawText: '', requests };
  }


  // ============================================
  // Helpers
  // ============================================

  private buildSerpUrl(query: string, opts: {
    start: number;
    mode: 'news' | 'web';
    dateRestrict?: string;
  }): string {
    // brd_json=1 OBRIGATORIO: sem ele o /request com format=raw devolve o HTML
    // bruto da SERP, o JSON.parse falha e a busca conclui com 0 resultados em
    // silencio. Foi a causa do bug de 22/07 (fix veio do staging).
    // `num` deprecado pelo Google (set/2025) — paginacao so via `start`, 10/pagina.
    const params = new URLSearchParams({
      q: query,
      start: String(opts.start),
      gl: 'br', hl: 'pt-BR',
      brd_json: '1',
    });

    // tbm=nws restringe ao indice de noticias. No modo web fica de fora, pra
    // pegar o indice organico — portais locais, prefeitura, blog de bairro.
    if (opts.mode === 'news') params.set('tbm', 'nws');

    // `sbd:1` = ordenar por data. Medido em 2026-08-01: e o UNICO componente de
    // `tbs` que o Google obedece no indice de noticias. `qdr:d`, `qdr:w`, `qdr:m`
    // e ate `cdr:1` com range explicito devolveram os MESMOS 10 resultados, na
    // mesma ordem, com materia de marco numa busca de "1 dia". O `qdr` continua
    // sendo enviado so como rede de seguranca (custa nada se voltar a valer);
    // quem de fato garante o periodo e o `sbd:1` + o corte de paginacao acima
    // + o pos-filtro de data do Filter2.
    const qdr = this.mapDateRestrict(opts.dateRestrict);
    params.set('tbs', [qdr, 'sbd:1'].filter(Boolean).join(','));

    // uule NAO entra: o Google exige encoding canonico (base64) e texto puro era
    // ignorado. Medido em 2026-07-30 no indice organico, uule+tbs juntos ainda
    // derrubavam o resultado de ~100 pra 1. gl=br + cidade na query ja segmentam.

    return `https://www.google.com/search?${params.toString()}`;
  }

  private mapDateRestrict(dateRestrict?: string): string | undefined {
    if (!dateRestrict) return 'qdr:d';
    if (dateRestrict.startsWith('d')) {
      const days = parseInt(dateRestrict.slice(1), 10);
      if (isNaN(days)) return 'qdr:w';
      if (days <= 1) return 'qdr:d';
      if (days <= 7) return 'qdr:w';
      if (days <= 30) return 'qdr:m';
      if (days <= 90) return 'qdr:m3';
      if (days <= 365) return 'qdr:y';
      return undefined;
    }
    return 'qdr:w';
  }

  /**
   * Data mais nova da pagina. Com `sbd:1` e o primeiro item, mas nem todo item
   * traz data — entao varre todos e pega o maior. Null se nenhum for legivel
   * (nesse caso a paginacao segue como antes, sem corte).
   */
  private dataMaisNova(data: SERPResponse): Date | null {
    const itens = [...(data.news || []), ...(data.organic || [])];
    let maior: Date | null = null;
    for (const item of itens) {
      const d = parseSerpDate(item.date);
      if (d && (!maior || d > maior)) maior = d;
    }
    return maior;
  }

  // Le `news` (tbm=nws) e cai pra `organic` (modo web). O mesmo parser serve
  // aos dois porque a Bright Data devolve o mesmo shape de item nos dois indices.
  private parseNewsResults(data: SERPResponse): SearchResult[] {
    const results: SearchResult[] = [];

    // A data ja era lida aqui pra cortar a paginacao (dataMaisNova) e depois
    // jogada fora. Agora viaja junto: e o que permite priorizar quem esta dentro
    // da janela antes de aplicar o teto de analise.
    const paraResult = (item: SERPItem): SearchResult => {
      const d = parseSerpDate(item.date);
      return {
        url: item.link!,
        title: item.title || '',
        snippet: item.description || item.snippet || item.title || '',
        ...(d ? { publishedAt: d.toISOString().split('T')[0] } : {}),
      };
    };

    if (data.news && Array.isArray(data.news)) {
      for (const item of data.news) {
        if (item.link) results.push(paraResult(item));
      }
    }

    if (results.length === 0 && data.organic && Array.isArray(data.organic)) {
      for (const item of data.organic) {
        if (item.link) results.push(paraResult(item));
      }
    }

    return results;
  }
}

// ============================================
// Types
// ============================================

interface SERPItem {
  title?: string;
  link?: string;
  description?: string;
  snippet?: string;
  source?: string;
  date?: string;
}

interface SERPResponse {
  news?: SERPItem[];
  organic?: SERPItem[];
}
