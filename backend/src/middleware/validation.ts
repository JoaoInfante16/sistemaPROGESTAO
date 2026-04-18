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

  // Feed com paginacao + filtros opcionais de cidade/estado.
  // Zod por padrao descarta campos nao listados no req.query. Sem este schema,
  // `cidade`/`cidades`/`estado` sumiam antes de chegar no handler (bug 2026-04-17).
  feedQuery: z.object({
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cidade: z.string().optional(),
    cidades: z.string().optional(),
    estado: z.string().optional(),
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

  // Busca manual multi-cidade (dispara pipeline)
  triggerManualSearch: z.object({
    estado: z.string().min(2).max(100),
    cidades: z.array(z.string().min(2).max(100)).min(1).max(10),
    periodo_dias: z.number().int().min(1).max(365).default(30),
    tipo_crime: z.string().min(2).max(50).optional(),
    profundidade: z.number().min(0.5).max(2.0).default(1.0),
  }),

  // Bulk import de cidades do IBGE para monitoramento
  bulkImportLocations: z.object({
    state_name: z.string().min(2).max(100),
    cities: z.array(z.string().min(2).max(100)).min(1).max(1000),
    mode: z.enum(['keywords', 'any']).default('any'),
    scan_frequency_minutes: z.number().int().min(5).max(1440).default(60),
  }),

  // Analytics (com validacao: dateFrom <= dateTo, max 365 dias)
  analyticsQuery: z.object({
    cidade: z.string().min(2).max(100),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).refine(
    (d) => new Date(d.dateFrom) <= new Date(d.dateTo),
    { message: 'dateFrom must be before or equal to dateTo', path: ['dateFrom'] }
  ).refine(
    (d) => (new Date(d.dateTo).getTime() - new Date(d.dateFrom).getTime()) / (1000 * 60 * 60 * 24) <= 365,
    { message: 'Date range cannot exceed 365 days', path: ['dateTo'] }
  ),

  analyticsTrend: z.object({
    cidade: z.string().min(2).max(100),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    groupBy: z.enum(['day', 'week', 'month']).default('week'),
  }).refine(
    (d) => new Date(d.dateFrom) <= new Date(d.dateTo),
    { message: 'dateFrom must be before or equal to dateTo', path: ['dateFrom'] }
  ).refine(
    (d) => (new Date(d.dateTo).getTime() - new Date(d.dateFrom).getTime()) / (1000 * 60 * 60 * 24) <= 365,
    { message: 'Date range cannot exceed 365 days', path: ['dateTo'] }
  ),

  generateReport: z.object({
    cidade: z.string().min(2).max(100),
    estado: z.string().min(2).max(100),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    searchId: z.string().uuid().optional(),
  }).refine(
    (d) => new Date(d.dateFrom) <= new Date(d.dateTo),
    { message: 'dateFrom must be before or equal to dateTo', path: ['dateFrom'] }
  ),

  executiveQuery: z.object({
    cidade: z.string().min(2).max(100),
    estado: z.string().min(2).max(100),
    rangeDays: z.coerce.number().int().min(7).max(365).default(30),
  }),

  // Busca manual: estatísticas já filtradas no client, backend cacheia por
  // searchId (busca é imutável, 1 GPT call por busca em vez de N por open).
  executiveFromStats: z.object({
    cidade: z.string().min(2).max(100),
    estado: z.string().min(2).max(100),
    rangeDays: z.number().int().min(1).max(365).default(30),
    searchId: z.string().uuid().optional(),
    estatisticas: z.array(
      z.object({
        resumo: z.string().min(1),
        data_ocorrencia: z.string(),
        source_url: z.string().nullable().optional(),
      }),
    ).max(50),
  }),

  mapPointsQuery: z.object({
    cidade: z.string().min(2).max(100),
    estado: z.string().min(2).max(100),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    searchId: z.string().uuid().optional(),
  }).refine(
    (d) => new Date(d.dateFrom) <= new Date(d.dateTo),
    { message: 'dateFrom must be before or equal to dateTo', path: ['dateFrom'] }
  ),
};
