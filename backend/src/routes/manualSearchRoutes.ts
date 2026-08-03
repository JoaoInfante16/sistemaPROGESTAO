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
import { supabase } from '../config/database';
import { manualSearchQueue } from '../jobs/workers/manualSearchWorker';
import { logger } from '../middleware/logger';

const router = Router();

// Sem avanço de progresso por este tempo, a busca é considerada morta e o
// usuário é liberado. Generoso de propósito: o estágio 1 pode ficar minutos sem
// escrever nada, e matar busca viva é pior que esperar um pouco mais.
const BUSCA_FANTASMA_MS = 20 * 60 * 1000;

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
      const { estado, cidades, periodo_dias, assuntos, tipo_crime } = req.body as {
        estado: string;
        cidades: string[];
        periodo_dias: number;
        assuntos?: string[];
        tipo_crime?: string;
      };

      // Uma lista so daqui pra frente. `tipo_crime` (uma string) era o formato
      // antigo e vira lista de um item — assim o worker, as queries e os prompts
      // dos filtros tem um caminho unico.
      const assuntosEscolhidos = assuntos?.length
        ? assuntos
        : tipo_crime
          ? [tipo_crime]
          : undefined;

      const userId = req.user?.id || 'anonymous';

      // Verificar se já tem busca em andamento
      const history = await db.getUserSearchHistory(userId);
      const running = history.find((s: { status: string }) => s.status === 'processing');

      if (running) {
        // BUSCA FANTASMA (8.5). O job pode morrer sem marcar nada — o Render
        // reinicia o serviço sozinho no free tier. Antes disto, a busca ficava
        // `processing` PARA SEMPRE e o usuário nunca mais conseguia buscar; com
        // uma busca por vez, isso é uma armadilha permanente.
        //
        // O critério é melhor que relógio: **sem avanço de progresso**. Uma busca
        // longa que está trabalhando escreve a cada ~2s e nunca é morta por
        // engano; uma morta para de escrever e cai no TTL. Buscas antigas, sem
        // `atualizado_em`, caem no `created_at`.
        const status = await db.getSearchStatus(running.search_id).catch(() => null);
        const ultimoSinal = Date.parse(
          (status?.progress?.atualizado_em as string) || running.created_at
        );
        const paradaHa = Number.isNaN(ultimoSinal) ? 0 : Date.now() - ultimoSinal;

        if (paradaHa > BUSCA_FANTASMA_MS) {
          logger.warn(`[ManualSearch] Busca ${running.search_id} sem avanço há ${Math.round(paradaHa / 60000)} min — marcando como failed e liberando o usuário`);
          await db.updateSearchStatus(running.search_id, 'failed').catch(() => {});
        } else {
          // 409 INFORMATIVO: devolve com o que o app precisa pra oferecer "ver
          // progresso / cancelar" em vez de um beco sem saída.
          res.status(409).json({
            error: 'Já existe uma busca em andamento.',
            searchId: running.search_id,
            params: running.params,
            progress: status?.progress ?? null,
          });
          return;
        }
      }

      // Criar registro na search_cache
      // `params` alimenta o card do historico no app. Guarda os assuntos pra
      // uma busca antiga poder dizer o que perguntou — sem isso, duas buscas da
      // mesma cidade com escolhas diferentes ficam indistinguiveis na lista.
      const searchId = await db.createSearchCache({
        user_id: userId,
        params: { estado, cidades, periodo_dias, assuntos: assuntosEscolhidos, tipo_crime },
      });

      // Enfileirar job
      //
      // A linha em `search_cache` já existe neste ponto, com status `processing`.
      // Se o Redis estiver fora e o enfileiramento falhar, ela fica órfã: nada
      // vai processá-la, e o usuário toma 409 ("já existe uma busca em
      // andamento") nas próximas tentativas até o TTL de busca fantasma expirar,
      // 20 minutos depois. Marcar `failed` na hora libera o usuário na hora.
      try {
        await manualSearchQueue.add(
          'manual-search',
          {
            searchId,
            userId,
            estado,
            cidades,
            periodoDias: periodo_dias,
            assuntos: assuntosEscolhidos,
          },
          {
            attempts: 2,
            backoff: { type: 'exponential', delay: 3000 },
          }
        );
      } catch (enqueueError) {
        logger.error(`[ManualSearch] Falha ao enfileirar ${searchId}: ${(enqueueError as Error).message}`);
        try {
          await db.updateSearchStatus(searchId, 'failed');
        } catch (statusError) {
          logger.error(`[ManualSearch] Falha ao marcar ${searchId} como failed: ${(statusError as Error).message}`);
        }
        throw enqueueError;
      }

      logger.info(`[ManualSearch] Created search ${searchId} for ${cidades.length} cidades in ${estado}`);
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
      const todos = (await db.getSearchResults(req.params.id)) as Array<Record<string, unknown>>;

      // CONTRATO RETROCOMPATIVEL (8.2) — nao mexer sem olhar o app.
      //
      // O Flutter le `body['results']` como a lista da tela. Se os extras
      // entrassem ai, o APK que ja esta na mao do cliente passaria a exibir
      // cidade vizinha e materia velha misturadas no meio, e a conta-las nas
      // estatisticas. Entao `results` continua sendo SO o principal, identico ao
      // de antes, e o que a 8.2 acrescentou vai pendurado em `extras`.
      //
      // Cada item aparece em exatamente um lugar. Quem e vizinha E velha conta
      // como vizinha — os dois sinalizadores viajam no proprio item, entao o app
      // sabe a verdade completa de qualquer forma.
      const results = todos.filter((r) => !r.fora_do_periodo && !r.cidade_vizinha);
      const regiao = todos.filter((r) => r.cidade_vizinha);
      const foraDoPeriodo = todos.filter((r) => r.fora_do_periodo && !r.cidade_vizinha);

      res.json({
        results,
        extras: { regiao, fora_do_periodo: foraDoPeriodo },
      });
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

/**
 * POST /manual-search/:id/cancel
 * Cancela uma busca em andamento.
 */
router.post(
  '/manual-search/:id/cancel',
  requireSearchPermission,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const searchId = req.params.id;
      const userId = req.user?.id || 'anonymous';

      // Marcar como cancelled no DB
      await db.updateSearchStatus(searchId, 'cancelled');

      // Remover jobs pendentes da fila
      const jobs = await manualSearchQueue.getJobs(['active', 'waiting', 'delayed']);
      for (const job of jobs) {
        if (job.data?.searchId === searchId) {
          await job.remove().catch(() => {});
        }
      }

      logger.info(`[ManualSearch] Cancelled search ${searchId} by user ${userId}`);
      res.json({ success: true });
    } catch (error) {
      logger.error('[ManualSearch] Cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel search' });
    }
  }
);

/**
 * DELETE /manual-search
 * Deleta buscas por lista de IDs. Cascade deleta search_results e reports.
 */
router.delete(
  '/manual-search',
  requireSearchPermission,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'ids array required' });
        return;
      }

      const userId = req.user?.id || 'anonymous';

      // Deletar apenas buscas do proprio usuario
      const { error } = await supabase
        .from('search_cache')
        .delete()
        .in('search_id', ids)
        .eq('user_id', userId);

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      logger.info(`[ManualSearch] Deleted ${ids.length} searches for user ${userId}`);
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
      logger.error('[ManualSearch] Delete error:', error);
      res.status(500).json({ error: 'Failed to delete searches' });
    }
  }
);

export default router;
