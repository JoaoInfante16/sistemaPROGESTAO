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

/**
 * Teto da janela de analytics, em dias.
 *
 * Era **365**, e isso derrubava a opcao `TUDO` do relatorio (que o app manda
 * como uma data bem antiga) com um 400 — a tela ficava vazia sem explicar. Dez
 * anos e teto de sanidade, nao de produto: o banco comecou em 2026, entao na
 * pratica `TUDO` varre tudo o que existe.
 */
const JANELA_MAXIMA_DIAS = 3700;

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
    // UMA cidade por busca (02/08). A regiao metropolitana vem junto de graca —
    // desde a 8.2 as cidades vizinhas ja saem das MESMAS queries, marcadas como
    // `cidade_vizinha`, em vez de serem descartadas. Ou seja: "1 cidade + regiao"
    // custa o mesmo que "1 cidade" custava.
    //
    // O motivo de nao ser 10: o custo por cidade e linear, mas o TEMPO tambem —
    // e o app desiste em 10 min. Uma cidade em 180 dias leva ~7 min; tres
    // estouram. Voltar a permitir varias so depois da 8.5 (desistir por
    // estagnacao, nao por relogio).
    //
    // ⚠️ O APK que o cliente tem hoje deixa escolher ate 10 (MultiCitySearchField,
    // maxCities). Backend e app tem que subir JUNTOS, senao quem escolher 2
    // cidades toma 400.
    cidades: z.array(z.string().min(2).max(100)).min(1).max(1),
    // Teto de 180 dias (6 meses) desde 02/08. O backend inteiro ja funciona com
    // qualquer periodo — quem limita e o APP: ele desiste de esperar em 10 min
    // (_maxPolls=200 x 3s), e com o teto de analise aberto uma busca de 1 ano
    // numa capital passa disso. Subir pra 365 depois da 8.5 (desistir por
    // estagnacao, nao por relogio) e so mudar este numero.
    periodo_dias: z.number().int().min(1).max(180).default(30),
    // ASSUNTOS ESCOLHIDOS NA TELA (03/08). Cada um vira uma query `<assunto>
    // <cidade>` e um teto novo de ~60-70 itens no indice do Google. Sao termos
    // livres de proposito: os templates da taxonomia sao so uma sugestao boa, e
    // o usuario pode digitar o que quiser (`greve`, `queda de energia`).
    //
    // Ausente = a lista do painel (`search_subjects`), que e o comportamento de
    // antes — o APK que o cliente tem hoje nao manda nada e continua igual.
    //
    // Teto de 20: cada assunto custa ~1 min de busca numa capital. Nao e limite
    // de custo (a SERP e ~$0.0015 por pagina) — e limite de paciencia. Quem
    // mostra o preco em minutos e a tela, antes de disparar.
    assuntos: z.array(z.string().min(2).max(60)).min(1).max(20).optional(),
    // Compat: a versao anterior mandava UM tipo. Continua aceito e vira uma
    // lista de um item na rota.
    tipo_crime: z.string().min(2).max(50).optional(),
  }),

  // Bulk import de cidades do IBGE para monitoramento
  bulkImportLocations: z.object({
    state_name: z.string().min(2).max(100),
    cities: z.array(z.string().min(2).max(100)).min(1).max(1000),
    mode: z.enum(['keywords', 'any']).default('any'),
    scan_frequency_minutes: z.number().int().min(5).max(1440).default(60),
  }),

  // Analytics: dateFrom <= dateTo, e a janela limitada por JANELA_MAXIMA_DIAS.
  //
  // As consultas aceitam `cidade` (uma) OU `cidades` (lista separada por
  // virgula). A lista existe para o relatorio de GRUPO — ver o comentario no
  // topo de `analyticsQueries.ts`.
  analyticsQuery: z.object({
    cidade: z.string().min(2).max(100).optional(),
    cidades: z.string().min(2).max(2000).optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).refine(
    (d) => Boolean(d.cidade || d.cidades),
    { message: 'cidade ou cidades e obrigatorio', path: ['cidade'] }
  ).refine(
    (d) => new Date(d.dateFrom) <= new Date(d.dateTo),
    { message: 'dateFrom must be before or equal to dateTo', path: ['dateFrom'] }
  ).refine(
    (d) => (new Date(d.dateTo).getTime() - new Date(d.dateFrom).getTime()) / (1000 * 60 * 60 * 24) <= JANELA_MAXIMA_DIAS,
    { message: `Date range cannot exceed ${JANELA_MAXIMA_DIAS} days`, path: ['dateTo'] }
  ),

  analyticsTrend: z.object({
    cidade: z.string().min(2).max(100).optional(),
    cidades: z.string().min(2).max(2000).optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    groupBy: z.enum(['day', 'week', 'month']).default('week'),
  }).refine(
    (d) => Boolean(d.cidade || d.cidades),
    { message: 'cidade ou cidades e obrigatorio', path: ['cidade'] }
  ).refine(
    (d) => new Date(d.dateFrom) <= new Date(d.dateTo),
    { message: 'dateFrom must be before or equal to dateTo', path: ['dateFrom'] }
  ).refine(
    (d) => (new Date(d.dateTo).getTime() - new Date(d.dateFrom).getTime()) / (1000 * 60 * 60 * 24) <= JANELA_MAXIMA_DIAS,
    { message: `Date range cannot exceed ${JANELA_MAXIMA_DIAS} days`, path: ['dateTo'] }
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
    cidade: z.string().min(2).max(100).optional(),
    cidades: z.string().min(2).max(2000).optional(),
    estado: z.string().min(2).max(100),
    // Ate 3700 pelo mesmo motivo da JANELA_MAXIMA_DIAS: o `TUDO` do relatorio
    // manda uma janela de anos, e 365 devolvia 400.
    rangeDays: z.coerce.number().int().min(7).max(JANELA_MAXIMA_DIAS).default(30),
  }).refine(
    (d) => Boolean(d.cidade || d.cidades),
    { message: 'cidade ou cidades e obrigatorio', path: ['cidade'] }
  ),

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
    cidade: z.string().min(2).max(100).optional(),
    cidades: z.string().min(2).max(2000).optional(),
    estado: z.string().min(2).max(100),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    searchId: z.string().uuid().optional(),
  }).refine(
    (d) => new Date(d.dateFrom) <= new Date(d.dateTo),
    { message: 'dateFrom must be before or equal to dateTo', path: ['dateFrom'] }
  ),
};
