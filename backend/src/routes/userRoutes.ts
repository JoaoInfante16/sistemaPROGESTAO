// ============================================
// User Routes - Admin CRUD
// ============================================
// GET    /users      - Listar usuários (admin)
// POST   /users      - Criar usuário (admin)
// PATCH  /users/:id  - Atualizar usuário (admin)
// DELETE /users/:id  - Deletar usuário (admin)

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { db } from '../database/queries';
import { supabase } from '../config/database';
import { logger } from '../middleware/logger';
import crypto from 'crypto';

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  is_admin: z.boolean().optional(),
});

const updateUserSchema = z.object({
  active: z.boolean().optional(),
});

/**
 * GET /users
 * Listar todos os usuários com perfil.
 */
router.get(
  '/users',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await db.getAllUsers();
      res.json(users);
    } catch (error) {
      logger.error('[Users] List error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

/**
 * POST /users
 * Criar novo usuário no Supabase Auth + user_profiles.
 * Gera senha temporária que o admin deve compartilhar.
 */
router.post(
  '/users',
  requireAuth,
  requireAdmin,
  validateBody(createUserSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, is_admin } = req.body as { email: string; is_admin?: boolean };
      const tempPassword = generateTempPassword();

      // Criar no Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      // Criar perfil no user_profiles
      await db.createUserProfile(data.user.id, email, req.user?.id ?? '', is_admin ?? false);

      res.status(201).json({
        success: true,
        userId: data.user.id,
        tempPassword,
        message: 'Compartilhe a senha temporária com o usuário. Ele deve alterá-la no primeiro login.',
      });
    } catch (error) {
      logger.error('[Users] Create error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
);

/**
 * PATCH /users/:id
 * Ativar/desativar usuário.
 */
router.patch(
  '/users/:id',
  requireAuth,
  requireAdmin,
  validateBody(updateUserSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await db.updateUserProfile(req.params.id, req.body);
      res.json({ success: true });
    } catch (error) {
      logger.error('[Users] Update error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

/**
 * DELETE /users/:id
 * Deletar usuário do Supabase Auth + user_profiles.
 * Não permite deletar a si mesmo.
 */
router.delete(
  '/users/:id',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Não permitir deletar a si mesmo
      if (req.params.id === req.user?.id) {
        res.status(400).json({ error: 'Voce nao pode deletar sua propria conta' });
        return;
      }

      // Deletar do user_profiles primeiro
      await db.deleteUserProfile(req.params.id);

      // Deletar do Supabase Auth
      const { error } = await supabase.auth.admin.deleteUser(req.params.id);
      if (error) {
        logger.error('[Users] Auth delete error:', error);
        // Profile já foi deletado, loga mas não falha
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('[Users] Delete error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

function generateTempPassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}

export default router;
