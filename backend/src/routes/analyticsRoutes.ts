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
import { db } from '../database/queries';
import { logger } from '../middleware/logger';

const router = Router();

// Monta CrimePoint[] a partir de raws + geocode. Usado por /analytics/map-points
// (leve, on-demand) E por /analytics/report (persiste no relatório).
async function buildMapPoints(
  rawPoints: MapPointRaw[],
  cidade: string,
  estado: string,
): Promise<CrimePoint[]> {
  const out: CrimePoint[] = [];
  for (const p of rawPoints) {
    const geo = await geocodePoint(p.rua, p.bairro, cidade, estado);
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
      const { cidade, dateFrom, dateTo } = req.query as {
        cidade: string;
        dateFrom: string;
        dateTo: string;
      };
      const [result, sources] = await Promise.all([
        getCrimeSummary(cidade, dateFrom, dateTo),
        getNewsSources(cidade, dateFrom, dateTo).catch(() => []),
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
      const { cidade, dateFrom, dateTo, groupBy } = req.query as {
        cidade: string;
        dateFrom: string;
        dateTo: string;
        groupBy: 'day' | 'week' | 'month';
      };
      const result = await getCrimeTrend(cidade, dateFrom, dateTo, groupBy);
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
      const { cidade, estado, rangeDays } = req.query as unknown as {
        cidade: string;
        estado: string;
        rangeDays: number;
      };

      const now = new Date();
      const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
      const dateFrom = from.toISOString().split('T')[0];
      const dateTo = now.toISOString().split('T')[0];

      const summary = await getCrimeSummary(cidade, dateFrom, dateTo).catch(() => null);
      const stats = summary?.estatisticas || [];
      const executive = await getOrGenerateExecutive(cidade, estado, rangeDays, stats);
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
      const { cidade, estado, dateFrom, dateTo, searchId } = req.body as {
        cidade: string;
        estado: string;
        dateFrom: string;
        dateTo: string;
        searchId?: string;
      };

      const rawPoints: MapPointRaw[] = searchId
        ? await getSearchMapPointsRaw(searchId).catch(() => [])
        : await getMapPointsRaw(cidade, dateFrom, dateTo).catch(() => []);
      const mapPoints = await buildMapPoints(rawPoints, cidade, estado);
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
      const { cidade, estado, dateFrom, dateTo, searchId } = req.body;

      // Build report data from available sources
      let summary;
      let trend;
      let sources: Array<{ name: string; count: number; urls: string[]; type: 'oficial' | 'midia' }> = [];
      let searchReport;

      // Try to get data from news table (monitored cities)
      try {
        summary = await getCrimeSummary(cidade, dateFrom, dateTo);
      } catch {
        summary = null;
      }

      try {
        trend = await getCrimeTrend(cidade, dateFrom, dateTo, 'week');
      } catch {
        trend = null;
      }

      try {
        sources = await getNewsSources(cidade, dateFrom, dateTo);
      } catch {
        sources = [];
      }

      // If searchId provided, also include manual search results
      if (searchId) {
        try {
          searchReport = await getSearchResultsAnalytics(searchId);
        } catch {
          searchReport = null;
        }
      }

      // Merge data: se veio de busca manual (searchId), priorizar searchReport
      const mergedSummary = searchReport
        ? {
            totalCrimes: searchReport.totalResults,
            byCrimeType: searchReport.byCrimeType,
            byCategory: searchReport.byCategory,
            topBairros: searchReport.topBairros,
          }
        : summary && summary.totalCrimes > 0
          ? summary
          : { totalCrimes: 0, byCrimeType: [], byCategory: [], topBairros: [] };

      const mergedSources = searchReport
        ? searchReport.sources.map(s => ({ name: s.name, count: 1, urls: [s.url], type: s.type }))
        : sources && sources.length > 0
          ? sources
          : [];

      // Separar fontes oficiais vs midia
      const sourcesOficial = mergedSources.filter(s => s.type === 'oficial');
      const sourcesMedia = mergedSources.filter(s => s.type === 'midia');

      const rawPoints: MapPointRaw[] = searchId
        ? await getSearchMapPointsRaw(searchId).catch(() => [])
        : await getMapPointsRaw(cidade, dateFrom, dateTo).catch(() => []);
      const mapPoints = await buildMapPoints(rawPoints, cidade, estado);

      // Executive section — gerada aqui e embutida no report (snapshot imutável).
      // Busca manual: estatísticas do searchReport (search_results table). Dashboard:
      // de summary (news table). Custo rastreado como source=manual_search ou auto_scan.
      const statsForExecutive = (searchReport
        ? searchReport.estatisticas
        : (summary?.estatisticas || [])
      ).map((s) => ({
        resumo: s.resumo,
        data_ocorrencia: s.data_ocorrencia,
        source_url: s.source_url,
      }));
      const rangeDays = Math.max(
        1,
        Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)),
      );
      const executive = await generateExecutiveFromStatistics(
        statsForExecutive,
        searchId ? 'manual_search' : 'auto_scan',
        { cidade, estado, rangeDays },
      );

      const reportData = {
        cidade,
        estado,
        dateFrom,
        dateTo,
        generatedAt: new Date().toISOString(),
        summary: {
          totalCrimes: mergedSummary.totalCrimes,
          topCrimeType: mergedSummary.byCrimeType[0]?.tipo_crime || 'N/A',
        },
        byCrimeType: mergedSummary.byCrimeType,
        byCategory: mergedSummary.byCategory,
        trend: trend?.dataPoints || (searchReport?.byDate.map(d => ({
          period: d.date,
          label: formatDateLabel(d.date),
          total: d.count,
          breakdown: {},
        })) || []),
        topBairros: mergedSummary.topBairros,
        sources: mergedSources,
        sourcesOficial,
        sourcesMedia,
        mapPoints,
        executive,
        // Estatísticas brutas (texto completo + fonte) — pra renderizar no público
        // similar ao in-app. Executive resume/curador; isso mostra o dado cru.
        estatisticas: statsForExecutive,
      };

      const reportId = await createReport({
        search_id: searchId,
        cidade,
        estado,
        date_from: dateFrom,
        date_to: dateTo,
        report_data: reportData,
        sources: mergedSources as Array<Record<string, unknown>>,
      });

      // ADMIN_PANEL_URL é obrigatória — sem ela, não faz sentido compartilhar
      // (o link apontaria pra lugar nenhum). Antes tinha fallback hardcoded
      // pro staging, que causava prod misdirecting silencioso quando a var
      // não estava setada.
      const adminUrl = process.env.ADMIN_PANEL_URL;
      if (!adminUrl) {
        logger.error('[Analytics] ADMIN_PANEL_URL not configured — cannot share report');
        res.status(500).json({ error: 'Report sharing not configured (ADMIN_PANEL_URL missing)' });
        return;
      }
      res.json({ reportId, reportUrl: `${adminUrl}/report/${reportId}` });
    } catch (error) {
      logger.error('[Analytics] Generate report error:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }
);

function formatDateLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  return parts[2] && parts[1] ? `${parts[2]}/${parts[1]}` : dateStr;
}

// ============================================
// Public Report (no auth - shareable link)
// ============================================

router.get(
  '/public/report/:id',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const report = await getReport(req.params.id);
      if (!report) {
        res.status(404).json({ error: 'Relatório não encontrado ou expirado' });
        return;
      }
      res.json(report);
    } catch (error) {
      logger.error('[Analytics] Public report error:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
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
