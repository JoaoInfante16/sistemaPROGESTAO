// ============================================
// Middleware de Autenticação - FASE 3.5
// ============================================
// requireAuth: verifica token JWT do Supabase
// requireAdmin: verifica se user é admin no user_profiles

import { Request, Response, NextFunction } from 'express';
import { supabaseAuth, supabase } from '../config/database';
import { configManager } from '../services/configManager';
import { logger } from './logger';

// Extender Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
      };
    }
  }
}

/**
 * Verifica token Bearer no header Authorization.
 * Anexa user ao req.user se válido.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    logger.error('[Auth] Error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Auth condicional: se auth_required=true, funciona como requireAuth.
 * Se false, permite acesso anônimo (tenta extrair user se token presente).
 */
export async function conditionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authRequired = await configManager.getBoolean('auth_required');
  if (!authRequired) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const { data: { user } } = await supabaseAuth.auth.getUser(token);
        if (user) {
          req.user = { id: user.id, email: user.email };
        }
      } catch {
        // Token inválido - acesso anônimo permitido
      }
    }
    next();
    return;
  }
  return requireAuth(req, res, next);
}

/**
 * Verifica permissão de busca manual.
 * Se search_permission='all', permite sem auth.
 * Se 'authorized', exige auth.
 */
export async function requireSearchPermission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const perm = await configManager.get('search_permission');
  if (perm === 'all') {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const { data: { user } } = await supabaseAuth.auth.getUser(token);
        if (user) {
          req.user = { id: user.id, email: user.email };
        }
      } catch {
        // Token inválido - acesso anônimo permitido
      }
    }
    next();
    return;
  }
  return requireAuth(req, res, next);
}

/**
 * Verifica se user autenticado é admin.
 * DEVE ser usado APÓS requireAuth.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !profile || !profile.is_admin) {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    next();
  } catch (error) {
    logger.error('[Auth] Admin check error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
}
