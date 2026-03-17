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
      const { estado, cidade, periodo_dias, tipo_crime } = req.body as {
        estado: string;
        cidade: string;
        periodo_dias: number;
        tipo_crime?: string;
      };

      const userId = req.user?.id || 'anonymous';

      // Criar registro na search_cache
      const searchId = await db.createSearchCache({
        user_id: userId,
        params: { estado, cidade, periodo_dias, tipo_crime },
      });

      // Enfileirar job
      await manualSearchQueue.add(
        'manual-search',
        {
          searchId,
          userId,
          estado,
          cidade,
          periodoDias: periodo_dias,
          tipoCrime: tipo_crime,
        },
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 3000 },
        }
      );

      logger.info(`[ManualSearch] Created search ${searchId} for ${cidade}, ${estado}`);
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

export default router;
