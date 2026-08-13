// ============================================
// Analytics Routes - FASE 2 (Dashboard de Risco)
// ============================================
// GET    /analytics/crime-summary            - Contagem por tipo, bairros
// GET    /analytics/crime-trend              - Série temporal agrupada
// POST   /analytics/report                   - Gera relatório compartilhável
// GET    /public/report/:id                  - Retorna relatório (público, sem auth)
// GET    /analytics/cities-overview          - Dashboard de cards das cidades

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateQuery, validateBody, schemas } from '../middleware/validation';
import { geocodePoint } from '../services/geocoding/nominatim';
import {
  getCrimeSummary,
  getCrimeTrend,
  getSearchResultsAnalytics,
  getNewsSources,
  createReport,
  getReport,
  getCitiesOverview,
  getMapPointsRaw,
  getSearchMapPointsRaw,
  MapPointRaw,
} from '../database/analyticsQueries';
import { CrimePoint } from '../utils/types';
import { getOrGenerateExecutive, generateExecutiveFromStatistics } from '../services/executive';
import { renderizarRelatorio, paginaDeErro } from '../services/relatorio/html';
import {
  RelatorioRenderizavel,
  RecorteDeclarado,
  ContagensDaTela,
} from '../services/relatorio/tipos';
import { db } from '../database/queries';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * A base do link que vai pro cliente.
 *
 * Ate 12/08 isto era `ADMIN_PANEL_URL` — o relatorio morava no painel admin, e
 * um link de cliente dependia de um servico administrativo estar de pe. Agora
 * o documento sai do proprio backend, entao a base e a dele.
 *
 * `RENDER_EXTERNAL_URL` o Render define sozinho em todo web service, o que faz
 * isto funcionar em staging e producao **sem variavel nova**; o fallback pelos
 * headers cobre o dev local. `x-forwarded-proto` e lido na mao porque atras do
 * proxy do Render o `req.protocol` responde `http` e o link sairia feio.
 */
function urlPublica(req: Request): string {
  const configurada = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL;
  if (configurada) return configurada.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol;
  return `${proto}://${req.get('host')}`;
}

/**
 * `cidade=X` ou `cidades=X,Y,Z` — devolve sempre uma lista.
 *
 * O relatorio de um GRUPO precisa das quatro cidades; o de uma cidade so manda
 * uma. Os dois parametros convivem porque o APK que o cliente tem na mao ainda
 * manda `cidade`, e ele nao pode quebrar quando este backend subir.
 *
 * 🚨 **`cidades` chega em DOIS formatos, e por isso o `Array.isArray`.** Nas
 * rotas GET e query string (`?cidades=A,B,C`); nos dois POST e um **array JSON**
 * (`{"cidades": ["A","B"]}`), porque o schema declara `z.array(z.string())`.
 *
 * Esta funcao so sabia do primeiro. O `.split()` num array levantava
 * `q.cidades.split is not a function`, o `try` da rota engolia, e o app recebia
 * **500 "Failed to generate report"** — nas duas telas, sempre. Passou
 * despercebido porque:
 *
 *   1. o tipo do parametro dizia `cidades?: string`, e o call site passa
 *      `req.body`, que e `any` — o TypeScript nao tinha o que conferir;
 *   2. a validacao foi testada contra o schema (passa) e o documento foi testado
 *      pela rota GET, com a linha gravada direto no banco. **O POST inteiro
 *      nunca rodou de ponta a ponta.**
 */
function resolverCidades(q: { cidade?: string; cidades?: string | string[] }): string[] {
  const bruto = q.cidades;
  if (bruto) {
    const lista = (Array.isArray(bruto) ? bruto : bruto.split(','))
      .map((c) => c.trim())
      .filter(Boolean);
    if (lista.length > 0) return lista;
  }
  return q.cidade ? [q.cidade] : [];
}

// Monta CrimePoint[] a partir de raws + geocode. Usado por /analytics/map-points
// (leve, on-demand) E por /analytics/report (persiste no relatório).
async function buildMapPoints(
  rawPoints: MapPointRaw[],
  /** Usada so quando o ponto nao traz cidade propria (linha antiga). */
  cidadePadrao: string,
  estado: string,
): Promise<CrimePoint[]> {
  const out: CrimePoint[] = [];
  for (const p of rawPoints) {
    // A cidade DO PONTO, nao a da requisicao. Num grupo elas sao diferentes, e
    // geocodificar "Ponte do Imaruim" contra Florianopolis poe o pino a 20km
    // do lugar — com a mesma aparencia de um pino certo.
    const geo = await geocodePoint(p.rua, p.bairro, p.cidade || cidadePadrao, estado);
    if (!geo) continue;
    out.push({
      id: p.id,
      lat: geo.lat,
      lng: geo.lng,
      categoria: p.categoria,
      tipo_crime: p.tipo_crime,
      data: p.data,
      bairro: p.bairro,
      rua: p.rua,
      precisao: geo.precisao,
      fora_do_periodo: p.fora_do_periodo === true,
      cidade_vizinha: p.cidade_vizinha === true,
    });
  }
  return out;
}

// ============================================
// Crime Summary
// ============================================

router.get(
  '/analytics/crime-summary',
  requireAuth,
  validateQuery(schemas.analyticsQuery),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { dateFrom, dateTo } = req.query as { dateFrom: string; dateTo: string };
      const cidades = resolverCidades(req.query);
      const [result, sources] = await Promise.all([
        getCrimeSummary(cidades, dateFrom, dateTo),
        getNewsSources(cidades, dateFrom, dateTo).catch(() => []),
      ]);
      // Sources já vêm agrupados por hostname com count + type (oficial/midia).
      // Expor pra city_detail renderizar "Fontes Analisadas" com mesma estrutura
      // da busca manual.
      res.json({ ...result, sources });
    } catch (error) {
      logger.error('[Analytics] Crime summary error:', error);
      res.status(500).json({ error: 'Failed to fetch crime summary' });
    }
  }
);

// ============================================
// Crime Trend
// ============================================

router.get(
  '/analytics/crime-trend',
  requireAuth,
  validateQuery(schemas.analyticsTrend),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { dateFrom, dateTo, groupBy } = req.query as {
        dateFrom: string;
        dateTo: string;
        groupBy: 'day' | 'week' | 'month';
      };
      const result = await getCrimeTrend(
        resolverCidades(req.query), dateFrom, dateTo, groupBy,
      );
      res.json(result);
    } catch (error) {
      logger.error('[Analytics] Crime trend error:', error);
      res.status(500).json({ error: 'Failed to fetch crime trend' });
    }
  }
);

// ============================================
// Executive (resumo + indicadores visuais via GPT, cacheado)
// ============================================
// Dashboard chama pra ver cards + parágrafo dos indicadores estatísticos do período.
// Lê cache primeiro; só chama GPT se cache miss/expirado. Custo rastreado em budget.
router.get(
  '/analytics/executive',
  requireAuth,
  validateQuery(schemas.executiveQuery),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { estado, rangeDays } = req.query as unknown as {
        estado: string;
        rangeDays: number;
      };
      const cidades = resolverCidades(req.query);

      const now = new Date();
      const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
      const dateFrom = from.toISOString().split('T')[0];
      const dateTo = now.toISOString().split('T')[0];

      const summary = await getCrimeSummary(cidades, dateFrom, dateTo).catch(() => null);
      const stats = summary?.estatisticas || [];
      // A chave do cache do executivo e uma string de cidade. Num grupo ela
      // passa a ser a lista inteira, ordenada — senao "Grande Florianopolis" e
      // "Florianopolis" dividiriam o mesmo resumo do GPT.
      const chaveCidade = [...cidades].sort().join(',');
      const executive = await getOrGenerateExecutive(chaveCidade, estado, rangeDays, stats);
      res.json(executive);
    } catch (error) {
      logger.error('[Analytics] Executive error:', error);
      res.status(500).json({ error: 'Failed to fetch executive' });
    }
  }
);

// ============================================
// Executive (busca manual) — POST com estatísticas já filtradas no client
// ============================================
// Dashboard lê de `news`; busca manual guarda em `search_results`. Em vez de
// duplicar a query, Flutter manda as estatísticas já em memória + searchId.
// Com searchId, cacheamos por busca (imutável) — 1 GPT call por busca, não por open.
router.post(
  '/analytics/executive/from-stats',
  requireAuth,
  validateBody(schemas.executiveFromStats),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cidade, estado, rangeDays, searchId, estatisticas } = req.body as {
        cidade: string;
        estado: string;
        rangeDays: number;
        searchId?: string;
        estatisticas: Array<{ resumo: string; data_ocorrencia: string; source_url?: string | null }>;
      };

      // Cache hit: busca manual já gerou executive antes pra este searchId.
      // Primeira abertura do relatório = GPT. Próximas = cache hit instantâneo.
      if (searchId) {
        const cached = await db.getExecutiveCache(cidade, estado, rangeDays, searchId);
        if (cached) {
          res.json(cached.data);
          return;
        }
      }

      const stats = estatisticas.map((s) => ({
        resumo: s.resumo,
        data_ocorrencia: s.data_ocorrencia,
        source_url: s.source_url ?? null,
      }));

      const executive = await generateExecutiveFromStatistics(
        stats,
        'manual_search',
        { cidade, estado, rangeDays },
      );

      // Salva cache pro próximo open. Sem searchId (caso edge), pula cache.
      if (searchId) {
        await db.upsertExecutiveCache(cidade, estado, rangeDays, executive, searchId);
      }

      res.json(executive);
    } catch (error) {
      logger.error('[Analytics] Executive from-stats error:', error);
      res.status(500).json({ error: 'Failed to generate executive' });
    }
  }
);

// ============================================
// Map Points (leve, on-demand — pro radar do app)
// ============================================
// Dashboard chama sem searchId → lê de news. Busca manual chama com searchId → lê de search_results.
// Backend geocoda no servidor (cache em memória) e devolve CrimePoint[] pronto.
router.post(
  '/analytics/map-points',
  requireAuth,
  validateBody(schemas.mapPointsQuery),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { estado, dateFrom, dateTo, searchId } = req.body as {
        estado: string;
        dateFrom: string;
        dateTo: string;
        searchId?: string;
      };
      const cidades = resolverCidades(req.body);

      const rawPoints: MapPointRaw[] = searchId
        ? await getSearchMapPointsRaw(searchId).catch(() => [])
        : await getMapPointsRaw(cidades, dateFrom, dateTo).catch(() => []);
      const mapPoints = await buildMapPoints(rawPoints, cidades[0] ?? '', estado);
      res.json({ mapPoints });
    } catch (error) {
      logger.error('[Analytics] Map points error:', error);
      res.status(500).json({ error: 'Failed to fetch map points' });
    }
  }
);

// ============================================
// Generate Shareable Report
// ============================================

router.post(
  '/analytics/report',
  requireAuth,
  validateBody(schemas.generateReport),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { estado, dateFrom, dateTo, searchId, recorte, analytics } = req.body as {
        estado: string;
        dateFrom: string;
        dateTo: string;
        searchId?: string;
        recorte?: RecorteDeclarado;
        analytics?: ContagensDaTela;
      };
      const cidades = resolverCidades(req.body);
      if (cidades.length === 0) {
        res.status(400).json({ error: 'cidade ou cidades e obrigatorio' });
        return;
      }

      // ── as contagens ──────────────────────────────────────────────────
      // Quando o app manda `analytics`, ele ja contou tudo com o recorte que a
      // pessoa mexeu na tela. Reconsultar aqui seria escrever uma segunda
      // implementacao do mesmo recorte e torcer pra elas nao divergirem — que e
      // exatamente como o `cidades.first` passou meses dizendo uma coisa no
      // texto do compartilhamento e outra no documento.
      let contagens: ContagensDaTela;

      if (analytics) {
        contagens = analytics;
      } else {
        // Caminho do painel admin: ninguem contou nada, o backend conta.
        const summary = await getCrimeSummary(cidades, dateFrom, dateTo).catch(() => null);
        const trend = await getCrimeTrend(cidades, dateFrom, dateTo, 'day').catch(() => null);
        const sources = await getNewsSources(cidades, dateFrom, dateTo).catch(() => []);
        const searchReport = searchId
          ? await getSearchResultsAnalytics(searchId).catch(() => null)
          : null;

        const base = searchReport
          ? {
              totalCrimes: searchReport.totalResults,
              byCrimeType: searchReport.byCrimeType,
              byCategory: searchReport.byCategory,
              topBairros: searchReport.topBairros,
            }
          : summary && summary.totalCrimes > 0
            ? summary
            : { totalCrimes: 0, byCrimeType: [], byCategory: [], topBairros: [] };

        const fontes = searchReport
          ? searchReport.sources.map((s) => ({ name: s.name, count: 1, type: s.type }))
          : sources.map((s) => ({ name: s.name, count: s.count, type: s.type }));

        contagens = {
          total: base.totalCrimes,
          totalRegiao: 0,
          semBairro: 0,
          totalEstatisticas: (searchReport ? searchReport.estatisticas : summary?.estatisticas || []).length,
          // `category` aqui, `categoria` no documento — a chave diverge desde a
          // Fase 2 e nao vale mexer nas duas queries por causa disso; o de-para
          // fica nesta linha, que e o unico lugar onde as duas se encontram.
          byCategory: base.byCategory.map((c) => ({ categoria: c.category, count: c.count })),
          byCrimeType: base.byCrimeType.map((t) => ({ tipo_crime: t.tipo_crime, count: t.count })),
          topBairros: base.topBairros,
          serie: searchReport
            ? searchReport.byDate.map((d) => ({ date: d.date, count: d.count }))
            : (trend?.dataPoints || []).map((p) => ({ date: p.period, count: p.total })),
          sourcesOficial: fontes.filter((s) => s.type === 'oficial').map(({ name, count }) => ({ name, count })),
          sourcesMedia: fontes.filter((s) => s.type !== 'oficial').map(({ name, count }) => ({ name, count })),
        };
      }

      // ── o que NAO depende do recorte ──────────────────────────────────
      // Mapa e executivo seguem o recorte fixo da busca, na tela e aqui: o
      // geocode roda contra a cidade da requisicao, entao re-fatiar o mapa
      // pintaria bairro de municipio vizinho dentro da cidade pedida.
      const rawPoints: MapPointRaw[] = searchId
        ? await getSearchMapPointsRaw(searchId).catch(() => [])
        : await getMapPointsRaw(cidades, dateFrom, dateTo).catch(() => []);
      const mapPoints = await buildMapPoints(rawPoints, cidades[0], estado);

      const estatisticasParaExecutive = searchId
        ? (await getSearchResultsAnalytics(searchId).catch(() => null))?.estatisticas || []
        : (await getCrimeSummary(cidades, dateFrom, dateTo).catch(() => null))?.estatisticas || [];

      const rangeDays = recorte?.dias ?? Math.max(
        1,
        Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000),
      );
      const executive = await generateExecutiveFromStatistics(
        estatisticasParaExecutive.map((s) => ({
          resumo: s.resumo,
          data_ocorrencia: s.data_ocorrencia,
          source_url: s.source_url,
        })),
        searchId ? 'manual_search' : 'auto_scan',
        { cidade: cidades[0], estado, rangeDays },
      );

      // ── o documento ───────────────────────────────────────────────────
      const relatorio: RelatorioRenderizavel = {
        cidades,
        estado,
        dateFrom,
        dateTo,
        geradoEm: new Date().toISOString(),
        recorte: recorte ?? null,
        total: contagens.total,
        totalRegiao: contagens.totalRegiao,
        semBairro: contagens.semBairro,
        totalEstatisticas: contagens.totalEstatisticas,
        byCategory: contagens.byCategory,
        byCrimeType: contagens.byCrimeType,
        topBairros: contagens.topBairros,
        serie: contagens.serie,
        mapPoints,
        executive,
        sourcesOficial: contagens.sourcesOficial,
        sourcesMedia: contagens.sourcesMedia,
      };

      const reportId = await createReport({
        search_id: searchId,
        cidade: cidades.join(', '),
        estado,
        date_from: dateFrom,
        date_to: dateTo,
        report_data: relatorio as unknown as Record<string, unknown>,
        sources: [...contagens.sourcesOficial, ...contagens.sourcesMedia] as unknown as Array<Record<string, unknown>>,
      });

      res.json({ reportId, reportUrl: `${urlPublica(req)}/public/report/${reportId}` });
    } catch (error) {
      logger.error('[Analytics] Generate report error:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }
);

// ============================================
// O relatorio publico — HTML, sem auth
// ============================================
// 🚨 Ate 12/08 esta rota devolvia JSON e quem desenhava era uma pagina Next.js
// dentro do painel admin. Duas consequencias que so aparecem no cliente: o link
// so abria se o painel estivesse acordado (no staging ele dorme, e o cliente
// encarava 50s de tela branca), e o documento tinha a cara generica do shadcn,
// nao a do SIMEops. Agora o HTML sai daqui, de um lugar so.

router.get(
  '/public/report/:id',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const report = await getReport(req.params.id);
      if (!report) {
        res.status(404).type('html').send(paginaDeErro(
          'Relatório indisponível',
          'Este relatório não foi encontrado. Confira se o link veio completo.',
        ));
        return;
      }
      // 🚨 `no-cache` nao e "nao guarde", e "revalide antes de usar" — com o
      // ETag do Express, a revalidacao volta 304 e custa quase nada.
      //
      // Sem esta linha o Express manda ETag e nenhum Cache-Control, e o
      // navegador cai no **cache heuristico**: ele inventa um prazo de validade
      // e serve o HTML velho sem nem perguntar. Os dados do relatorio sao
      // imutaveis, mas o RENDER nao e — melhora a cada deploy —, e um cliente
      // com a pagina de dois deploys atras nao tem como saber disso.
      res.set('Cache-Control', 'no-cache');
      res.type('html').send(
        await renderizarRelatorio(
          report.report_data as unknown as RelatorioRenderizavel,
          { paraPdf: req.query.formato === 'pdf' },
        ),
      );
    } catch (error) {
      logger.error('[Analytics] Public report error:', error);
      res.status(500).type('html').send(paginaDeErro(
        'Não foi possível carregar',
        'Tente de novo em alguns instantes.',
      ));
    }
  }
);

// ============================================
// Cities Overview (Dashboard)
// ============================================

router.get(
  '/analytics/cities-overview',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const items = await getCitiesOverview(userId);
      res.json({ items });
    } catch (error) {
      logger.error('[Analytics] Cities overview error:', error);
      res.status(500).json({ error: 'Failed to fetch cities overview' });
    }
  }
);

export default router;
