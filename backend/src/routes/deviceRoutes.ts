// ============================================
// Device Routes - Push Notification Tokens
// ============================================
// POST /devices - Registrar/atualizar device token (autenticado)

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { db } from '../database/queries';
import { logger } from '../middleware/logger';

const router = Router();

const registerDeviceSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(['ios', 'android']),
});

/**
 * POST /devices
 * Registrar ou atualizar device token para push notifications.
 * UPSERT: se o token já existe, atualiza last_seen.
 */
router.post(
  '/devices',
  requireAuth,
  validateBody(registerDeviceSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, platform } = req.body as { token: string; platform: 'ios' | 'android' };

      await db.upsertDevice(req.user?.id ?? '', token, platform);
      res.json({ success: true });
    } catch (error) {
      logger.error('[Devices] Register error:', error);
      res.status(500).json({ error: 'Failed to register device' });
    }
  }
);

/**
 * DELETE /devices
 * Remove device token (user desativou notificações).
 */
router.delete(
  '/devices',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await db.removeUserDevices(req.user?.id ?? '');
      res.json({ success: true });
    } catch (error) {
      logger.error('[Devices] Remove error:', error);
      res.status(500).json({ error: 'Failed to remove device' });
    }
  }
);

export default router;
