// ============================================
// Analytics Routes - FASE 2 (Dashboard de Risco)
// ============================================
// GET    /analytics/crime-summary            - Contagem por tipo, bairros, confiança
// GET    /analytics/crime-trend              - Série temporal agrupada
// GET    /analytics/crime-comparison          - Comparação entre 2 períodos
// GET    /analytics/search-report/:searchId   - Analytics de busca manual
// POST   /analytics/report                    - Gera relatório compartilhável
// GET    /public/report/:id                   - Retorna relatório (público, sem auth)

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateQuery, validateBody, schemas } from '../middleware/validation';
import {
  getCrimeSummary,
  getCrimeTrend,
  getCrimeComparison,
  getSearchResultsAnalytics,
  getNewsSources,
  createReport,
  getReport,
} from '../database/analyticsQueries';
import { logger } from '../middleware/logger';

const router = Router();

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
      const result = await getCrimeSummary(cidade, dateFrom, dateTo);
      res.json(result);
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
// Crime Comparison (two periods)
// ============================================

router.get(
  '/analytics/crime-comparison',
  requireAuth,
  validateQuery(schemas.analyticsComparison),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cidade, period1Start, period1End, period2Start, period2End } =
        req.query as {
          cidade: string;
          period1Start: string;
          period1End: string;
          period2Start: string;
          period2End: string;
        };
      const result = await getCrimeComparison(
        cidade,
        period1Start,
        period1End,
        period2Start,
        period2End
      );
      res.json(result);
    } catch (error) {
      logger.error('[Analytics] Crime comparison error:', error);
      res.status(500).json({ error: 'Failed to fetch crime comparison' });
    }
  }
);

// ============================================
// Search Report (from manual search results)
// ============================================

router.get(
  '/analytics/search-report/:searchId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { searchId } = req.params;
      const result = await getSearchResultsAnalytics(searchId);
      res.json(result);
    } catch (error) {
      logger.error('[Analytics] Search report error:', error);
      res.status(500).json({ error: 'Failed to fetch search report' });
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
      let comparison;
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

      // Auto-calculate comparison: current period vs previous period of same length
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      const prevEnd = new Date(from);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - diffDays);

      try {
        comparison = await getCrimeComparison(
          cidade,
          prevStart.toISOString().split('T')[0],
          prevEnd.toISOString().split('T')[0],
          dateFrom,
          dateTo
        );
      } catch {
        comparison = null;
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

      // Merge data: prefer news table data, supplement with search results
      const mergedSummary = summary && summary.totalCrimes > 0
        ? summary
        : searchReport
          ? {
              totalCrimes: searchReport.totalResults,
              byCrimeType: searchReport.byCrimeType,
              topBairros: searchReport.topBairros,
              avgConfianca: 0,
            }
          : { totalCrimes: 0, byCrimeType: [], topBairros: [], avgConfianca: 0 };

      const mergedSources = sources && sources.length > 0
        ? sources
        : searchReport
          ? searchReport.sources.map(s => ({ name: s.name, count: 1, urls: [s.url], type: s.type }))
          : [];

      // Separar fontes oficiais vs midia
      const sourcesOficial = mergedSources.filter(s => s.type === 'oficial');
      const sourcesMedia = mergedSources.filter(s => s.type === 'midia');

      const reportData = {
        cidade,
        estado,
        dateFrom,
        dateTo,
        generatedAt: new Date().toISOString(),
        summary: {
          totalCrimes: mergedSummary.totalCrimes,
          avgConfianca: mergedSummary.avgConfianca,
          topCrimeType: mergedSummary.byCrimeType[0]?.tipo_crime || 'N/A',
          comparisonDelta: comparison?.overallDelta || 'N/A',
        },
        byCrimeType: mergedSummary.byCrimeType,
        trend: trend?.dataPoints || (searchReport?.byDate.map(d => ({
          period: d.date,
          label: formatDateLabel(d.date),
          total: d.count,
          breakdown: {},
        })) || []),
        topBairros: mergedSummary.topBairros,
        comparison: comparison || null,
        sources: mergedSources,
        sourcesOficial,
        sourcesMedia,
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

      const adminUrl = process.env.ADMIN_PANEL_URL || 'https://simeops-admin.vercel.app';
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

export default router;
