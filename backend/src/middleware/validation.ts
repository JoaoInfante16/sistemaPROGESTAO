// ============================================
// Middleware de Validação - FASE 3.5
// ============================================
// Usa Zod para validar body e query params.
// Previne SQL injection, crashes, e dados inválidos.

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

/**
 * Valida req.body contra um schema Zod.
 * Retorna 400 com detalhes dos erros se inválido.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * Valida req.query contra um schema Zod.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    req.query = result.data;
    next();
  };
}

// ============================================
// Schemas reutilizáveis
// ============================================

export const schemas = {
  // Paginação
  pagination: z.object({
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // Criar/atualizar localização
  createLocation: z.object({
    type: z.enum(['state', 'city']),
    name: z.string().min(2).max(100),
    parent_id: z.string().uuid().nullable().optional(),
    mode: z.enum(['keywords', 'any']).default('any'),
    keywords: z.array(z.string()).nullable().optional(),
    scan_frequency_minutes: z.number().int().min(5).max(1440).default(60),
  }),

  updateLocation: z.object({
    active: z.boolean().optional(),
    mode: z.enum(['keywords', 'any']).optional(),
    keywords: z.array(z.string()).nullable().optional(),
    scan_frequency_minutes: z.number().int().min(5).max(1440).optional(),
  }),

  // Rate limits (admin)
  updateRateLimit: z.object({
    max_concurrent: z.number().int().min(1).max(50).optional(),
    min_time_ms: z.number().int().min(10).max(10000).optional(),
    daily_quota: z.number().int().min(1).nullable().optional(),
    monthly_quota: z.number().int().min(1).nullable().optional(),
  }),

  // Busca manual
  manualSearch: z.object({
    query: z.string().min(3).max(200),
    cidade: z.string().min(2).max(100).optional(),
    tipoCrime: z.string().min(2).max(50).optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),

  // Busca manual individual (dispara pipeline)
  triggerManualSearch: z.object({
    estado: z.string().min(2).max(100),
    cidade: z.string().min(2).max(100),
    periodo_dias: z.number().int().min(1).max(365).default(30),
    tipo_crime: z.string().min(2).max(50).optional(),
  }),
};
