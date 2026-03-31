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

const router = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  is_admin: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
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
      const { email, is_admin, password } = req.body as { email: string; is_admin?: boolean; password?: string };
      const tempPassword = password || generateTempPassword();

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

/**
 * POST /users/:id/reset-password
 * Gera nova senha temporária para o usuário.
 */
router.post(
  '/users/:id/reset-password',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const newPassword = generateTempPassword();

      const { error } = await supabase.auth.admin.updateUserById(req.params.id, {
        password: newPassword,
      });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      // Marcar que usuario precisa trocar senha + limpar pedido de reset
      await db.updateUserProfile(req.params.id, { must_change_password: true, password_reset_requested: false });

      res.json({
        success: true,
        tempPassword: newPassword,
        message: 'Senha redefinida. Compartilhe a nova senha temporária com o usuário.',
      });
    } catch (error) {
      logger.error('[Users] Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// ============================================
// Endpoint publico (user nao autenticado)
// ============================================

const requestResetSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /auth/request-reset
 * User pede reset de senha (publico). Marca flag no perfil pro admin ver.
 * Sempre retorna sucesso pra nao vazar se o email existe.
 */
router.post(
  '/auth/request-reset',
  validateBody(requestResetSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body as { email: string };

      // Buscar user por email
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (data) {
        await db.updateUserProfile(data.id, { password_reset_requested: true });
        logger.info(`[Auth] Password reset requested for ${email}`);
      }

      // Sempre retorna sucesso (seguranca: nao revelar se email existe)
      res.json({ success: true, message: 'Se o email estiver cadastrado, o administrador sera notificado.' });
    } catch (error) {
      logger.error('[Auth] Request reset error:', error);
      res.json({ success: true, message: 'Se o email estiver cadastrado, o administrador sera notificado.' });
    }
  }
);

// ============================================
// Auth endpoints (usuario autenticado, nao admin)
// ============================================

const changePasswordSchema = z.object({
  new_password: z.string().min(6).max(100),
});

/**
 * GET /auth/me
 * Retorna perfil do usuario autenticado (inclui must_change_password).
 */
router.get(
  '/auth/me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, is_admin, must_change_password, active')
        .eq('id', req.user!.id)
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      res.json(data);
    } catch (error) {
      logger.error('[Auth] Me error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  }
);

/**
 * POST /auth/change-password
 * Usuario autenticado troca a propria senha.
 * Marca must_change_password = false apos troca.
 */
router.post(
  '/auth/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { new_password } = req.body as { new_password: string };

      const { error } = await supabase.auth.admin.updateUserById(req.user!.id, {
        password: new_password,
      });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      // Marcar que nao precisa mais trocar senha
      await db.updateUserProfile(req.user!.id, { must_change_password: false });

      res.json({ success: true, message: 'Senha alterada com sucesso.' });
    } catch (error) {
      logger.error('[Auth] Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export default router;
