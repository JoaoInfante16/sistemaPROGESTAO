// ============================================
// Manual Search Routes - Busca individual
// ============================================
// POST /manual-search - Cria busca, enfileira job
// GET /manual-search/:id/status - Polling de status
// GET /manual-search/:id/results - Resultados
// GET /manual-search/history - Histórico do usuário

import { Router, Request, Response } from 'express';
import { requireSearchPermission } from '../middleware/auth';
import { validateBody, schemas } from '../middleware/validation';
import { db } from '../database/queries';
import { supabase } from '../config/database';
import { manualSearchQueue } from '../jobs/workers/manualSearchWorker';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * POST /manual-search
 * Cria uma busca manual e enfileira o job.
 */
router.post(
  '/manual-search',
  requireSearchPermission,
  validateBody(schemas.triggerManualSearch),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { estado, cidades, periodo_dias, tipo_crime, profundidade } = req.body as {
        estado: string;
        cidades: string[];
        periodo_dias: number;
        tipo_crime?: string;
        profundidade?: number;
      };

      const userId = req.user?.id || 'anonymous';

      // Verificar se já tem busca em andamento
      const history = await db.getUserSearchHistory(userId);
      const running = history.find((s: { status: string }) => s.status === 'processing');
      if (running) {
        res.status(409).json({ error: 'Já existe uma busca em andamento. Cancele antes de iniciar outra.' });
        return;
      }

      // Criar registro na search_cache
      const searchId = await db.createSearchCache({
        user_id: userId,
        params: { estado, cidades, periodo_dias, tipo_crime },
      });

      // Enfileirar job
      await manualSearchQueue.add(
        'manual-search',
        {
          searchId,
          userId,
          estado,
          cidades,
          periodoDias: periodo_dias,
          tipoCrime: tipo_crime,
          profundidade: profundidade || 1.0,
        },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 3000 },
        }
      );

      logger.info(`[ManualSearch] Created search ${searchId} for ${cidades.length} cidades in ${estado}`);
      res.status(201).json({ searchId, status: 'processing' });
    } catch (error) {
      logger.error('[ManualSearch] Create error:', error);
      res.status(500).json({ error: 'Failed to create search' });
    }
  }
);

/**
 * GET /manual-search/:id/status
 * Polling de status da busca.
 */
router.get(
  '/manual-search/:id/status',
  requireSearchPermission,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const status = await db.getSearchStatus(req.params.id);
      res.json(status);
    } catch (error) {
      logger.error('[ManualSearch] Status error:', error);
      res.status(404).json({ error: 'Search not found' });
    }
  }
);

/**
 * GET /manual-search/:id/results
 * Resultados da busca.
 */
router.get(
  '/manual-search/:id/results',
  requireSearchPermission,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const results = await db.getSearchResults(req.params.id);
      res.json({ results });
    } catch (error) {
      logger.error('[ManualSearch] Results error:', error);
      res.status(500).json({ error: 'Failed to get results' });
    }
  }
);

/**
 * GET /manual-search/history
 * Histórico de buscas do usuário.
 */
router.get(
  '/manual-search/history',
  requireSearchPermission,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id || 'anonymous';
      const history = await db.getUserSearchHistory(userId);
      res.json({ history });
    } catch (error) {
      logger.error('[ManualSearch] History error:', error);
      res.status(500).json({ error: 'Failed to get history' });
    }
  }
);

/**
 * POST /manual-search/:id/cancel
 * Cancela uma busca em andamento.
 */
router.post(
  '/manual-search/:id/cancel',
  requireSearchPermission,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const searchId = req.params.id;
      const userId = req.user?.id || 'anonymous';

      // Marcar como cancelled no DB
      await db.updateSearchStatus(searchId, 'cancelled');

      // Remover jobs pendentes da fila
      const jobs = await manualSearchQueue.getJobs(['active', 'waiting', 'delayed']);
      for (const job of jobs) {
        if (job.data?.searchId === searchId) {
          await job.remove().catch(() => {});
        }
      }

      logger.info(`[ManualSearch] Cancelled search ${searchId} by user ${userId}`);
      res.json({ success: true });
    } catch (error) {
      logger.error('[ManualSearch] Cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel search' });
    }
  }
);

/**
 * DELETE /manual-search
 * Deleta buscas por lista de IDs. Cascade deleta search_results e reports.
 */
router.delete(
  '/manual-search',
  requireSearchPermission,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids array required' });
        return;
      }

      const userId = req.user?.id || 'anonymous';

      // Deletar apenas buscas do proprio usuario
      const { error } = await supabase
        .from('search_cache')
        .delete()
        .in('search_id', ids)
        .eq('user_id', userId);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      logger.info(`[ManualSearch] Deleted ${ids.length} searches for user ${userId}`);
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
      logger.error('[ManualSearch] Delete error:', error);
      res.status(500).json({ error: 'Failed to delete searches' });
    }
  }
);

export default router;
