// ============================================
// Settings Routes - Rate Limits, Budget, Config, Stats
// ============================================
// GET    /settings/rate-limits       - Listar rate limits (admin)
// PATCH  /settings/rate-limits/:id   - Atualizar rate limit (admin)
// GET    /settings/budget/summary    - Resumo orçamento mês atual (admin)
// GET    /settings/budget/daily      - Custos diários do mês (admin)
// GET    /settings/config            - Listar todas as configs (admin)
// PATCH  /settings/config/:key       - Atualizar uma config (admin)
// GET    /stats                      - Dashboard stats (admin)
// GET    /logs/recent                - Logs recentes (admin)

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateBody, schemas } from '../middleware/validation';
import { db } from '../database/queries';
import { supabase } from '../config/database';
import { configManager } from '../services/configManager';
import { logger } from '../middleware/logger';

const router = Router();

// ============================================
// Auth Config (público, sem auth)
// ============================================

router.get(
  '/settings/auth-config',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const authRequired = await configManager.getBoolean('auth_required');
      const searchPermission = await configManager.get('search_permission');
      res.json({ authRequired, searchPermission });
    } catch (error) {
      logger.error('[Settings] Auth config error:', error);
      res.status(500).json({ error: 'Failed to fetch auth config' });
    }
  }
);

const updateConfigSchema = z.object({
  value: z.string().min(1).max(500),
});

// ============================================
// Rate Limits
// ============================================

router.get(
  '/settings/rate-limits',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('api_rate_limits')
        .select('*')
        .order('provider');

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      logger.error('[Settings] Rate limits fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch rate limits' });
    }
  }
);

router.patch(
  '/settings/rate-limits/:id',
  requireAuth,
  requireAdmin,
  validateBody(schemas.updateRateLimit),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('api_rate_limits')
        .update({
          ...req.body,
          updated_at: new Date().toISOString(),
          updated_by: req.user!.id,
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json(data);
    } catch (error) {
      logger.error('[Settings] Rate limit update error:', error);
      res.status(500).json({ error: 'Failed to update rate limit' });
    }
  }
);

// ============================================
// Budget
// ============================================

router.get(
  '/settings/budget/summary',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      const { data } = await supabase
        .from('budget_summary')
        .select('*')
        .eq('month', `${currentMonth}-01T00:00:00.000Z`);

      const rows = data || [];
      const byProvider: Record<string, number> = {};
      let autoScans = 0;
      let manualSearches = 0;

      for (const row of rows) {
        const cost = parseFloat(String(row.total_cost_usd));
        const provider = row.provider as string;
        const source = row.source as string;

        byProvider[provider] = (byProvider[provider] || 0) + cost;

        if (source === 'auto_scan') autoScans += cost;
        if (source === 'manual_search') manualSearches += cost;
      }

      const monthlyBudget = await configManager.getNumber('monthly_budget_usd');
      const total = autoScans + manualSearches;

      res.json({
        month: currentMonth,
        total: parseFloat(total.toFixed(4)),
        autoScans: parseFloat(autoScans.toFixed(4)),
        manualSearches: parseFloat(manualSearches.toFixed(4)),
        byProvider,
        budget: monthlyBudget,
        budgetUsedPercent: monthlyBudget > 0 ? parseFloat(((total / monthlyBudget) * 100).toFixed(1)) : 0,
      });
    } catch (error) {
      logger.error('[Settings] Budget summary error:', error);
      res.status(500).json({ error: 'Failed to fetch budget summary' });
    }
  }
);

router.get(
  '/settings/budget/daily',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      const { data } = await supabase
        .from('budget_tracking')
        .select('created_at, cost_usd')
        .gte('created_at', `${currentMonth}-01`)
        .order('created_at');

      const dailyMap = new Map<string, number>();
      for (const row of data || []) {
        const date = (row.created_at as string).slice(0, 10);
        const current = dailyMap.get(date) || 0;
        dailyMap.set(date, current + parseFloat(String(row.cost_usd)));
      }

      const result = Array.from(dailyMap.entries()).map(([date, costUsd]) => ({
        date,
        cost_usd: parseFloat(costUsd.toFixed(6)),
      }));

      res.json(result);
    } catch (error) {
      logger.error('[Settings] Budget daily error:', error);
      res.status(500).json({ error: 'Failed to fetch daily budget' });
    }
  }
);

// ============================================
// Cost Estimate (para calculadora no admin)
// ============================================

router.get(
  '/settings/cost-estimate',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Cost breakdown by provider this month
      const { data: costData } = await supabase
        .from('budget_tracking')
        .select('provider, cost_usd')
        .eq('source', 'auto_scan')
        .gte('created_at', `${currentMonth}-01`);

      const rows = costData || [];
      const totalCost = rows.reduce(
        (sum: number, row: { cost_usd: unknown }) => sum + parseFloat(String(row.cost_usd)),
        0
      );

      // Aggregate by provider
      const byProvider: Record<string, number> = { google: 0, jina: 0, openai: 0 };
      for (const row of rows) {
        const r = row as { provider: string; cost_usd: unknown };
        const provider = r.provider;
        if (provider in byProvider) {
          byProvider[provider] += parseFloat(String(r.cost_usd));
        }
      }

      // Count distinct scans (operation_logs with stage='complete')
      const { data: logData } = await supabase
        .from('operation_logs')
        .select('id')
        .eq('stage', 'complete')
        .gte('created_at', `${currentMonth}-01`);

      const totalScans = logData?.length || 0;
      const avgCostPerScan = totalScans > 0 ? totalCost / totalScans : 0.01;

      // Active cities count
      const { data: locData } = await supabase
        .from('monitored_locations')
        .select('id')
        .eq('active', true)
        .eq('type', 'city');

      const activeCities = locData?.length || 0;

      res.json({
        avgCostPerScan: parseFloat(avgCostPerScan.toFixed(6)),
        totalScansThisMonth: totalScans,
        totalCostThisMonth: parseFloat(totalCost.toFixed(4)),
        avgCostByProvider: {
          google: parseFloat(byProvider.google.toFixed(4)),
          jina: parseFloat(byProvider.jina.toFixed(4)),
          openai: parseFloat(byProvider.openai.toFixed(4)),
        },
        activeCities,
      });
    } catch (error) {
      logger.error('[Settings] Cost estimate error:', error);
      res.status(500).json({ error: 'Failed to fetch cost estimate' });
    }
  }
);

// ============================================
// System Config (tudo centralizado no admin panel)
// ============================================

router.get(
  '/settings/config',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const configs = await configManager.getAll();

      // Agrupar por categoria para frontend
      const grouped: Record<string, typeof configs> = {};
      for (const cfg of configs) {
        if (!grouped[cfg.category]) {
          grouped[cfg.category] = [];
        }
        grouped[cfg.category].push(cfg);
      }

      res.json(grouped);
    } catch (error) {
      logger.error('[Settings] Config fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch configs' });
    }
  }
);

router.patch(
  '/settings/config/:key',
  requireAuth,
  requireAdmin,
  validateBody(updateConfigSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const { value } = req.body as { value: string };

      await configManager.set(key, value, req.user!.id);

      // Configs que requerem restart
      const restartRequired = [
        'scan_cron_schedule',
        'worker_concurrency',
        'worker_max_per_minute',
      ];

      res.json({
        success: true,
        restartRequired: restartRequired.includes(key),
        message: restartRequired.includes(key)
          ? 'Config atualizada. Requer restart do servidor para ter efeito.'
          : 'Config atualizada. Terá efeito em até 5 minutos.',
      });
    } catch (error) {
      logger.error('[Settings] Config update error:', error);
      res.status(500).json({ error: 'Failed to update config' });
    }
  }
);

// ============================================
// Dashboard Stats
// ============================================

router.get(
  '/stats',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = await db.getDashboardStats();
      res.json(stats);
    } catch (error) {
      logger.error('[Stats] Error:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }
);

router.get(
  '/logs/recent',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const logs = await db.getRecentLogs(50);
      res.json(logs);
    } catch (error) {
      logger.error('[Logs] Error:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  }
);

export default router;
