import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { db } from '../database/queries';
import { logger } from '../middleware/logger';

const router = Router();

// GET /groups — lista todos os grupos com cidades-membro
router.get(
  '/groups',
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const groups = await db.getGroups();
      res.json(groups);
    } catch (error) {
      logger.error('[Groups] List error:', error);
      res.status(500).json({ error: 'Failed to fetch groups' });
    }
  }
);

// POST /groups — criar grupo
router.post(
  '/groups',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, locationIds } = req.body as {
        name: string;
        description?: string;
        locationIds?: string[];
      };

      if (!name || name.trim().length === 0) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const id = await db.createGroup(name.trim(), description || null, locationIds || []);
      res.status(201).json({ id, success: true });
    } catch (error) {
      logger.error('[Groups] Create error:', error);
      res.status(500).json({ error: 'Failed to create group' });
    }
  }
);

// PATCH /groups/:id — atualizar grupo
router.patch(
  '/groups/:id',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, active, locationIds } = req.body as {
        name?: string;
        description?: string;
        active?: boolean;
        locationIds?: string[];
      };

      await db.updateGroup(req.params.id, { name, description, active, locationIds });
      res.json({ success: true });
    } catch (error) {
      logger.error('[Groups] Update error:', error);
      res.status(500).json({ error: 'Failed to update group' });
    }
  }
);

// DELETE /groups/:id — deletar grupo
router.delete(
  '/groups/:id',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await db.deleteGroup(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('[Groups] Delete error:', error);
      res.status(500).json({ error: 'Failed to delete group' });
    }
  }
);

export default router;
