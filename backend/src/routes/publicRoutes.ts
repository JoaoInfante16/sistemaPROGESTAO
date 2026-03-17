// ============================================
// Public Routes - Sem autenticação
// ============================================
// GET /public/auth-required - Verifica se auth é obrigatória (para Flutter)

import { Router, Request, Response } from 'express';
import { configManager } from '../services/configManager';
import { db } from '../database/queries';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * GET /public/auth-required
 * Retorna se autenticação é obrigatória no app mobile.
 * Usado pelo Flutter para decidir se mostra tela de login.
 */
router.get(
  '/public/auth-required',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const authRequired = await configManager.getBoolean('auth_required');
      res.json({ authRequired });
    } catch (error) {
      // Fallback: se config não existe, assume que é obrigatória
      res.json({ authRequired: true });
    }
  }
);

/**
 * GET /public/locations
 * Retorna hierarquia de estados/cidades ativas (para dropdown do Flutter).
 * Sem autenticação - dados públicos (apenas id + nome).
 */
router.get(
  '/public/locations',
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const hierarchy = await db.getPublicLocationsHierarchy();
      res.json(hierarchy);
    } catch (error) {
      logger.error('[Public] Locations error:', error);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  }
);

export default router;
