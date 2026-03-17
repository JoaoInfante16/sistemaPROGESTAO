// ============================================
// News Routes - Feed + Busca Manual
// ============================================
// GET /news - Feed de notícias (auth condicional)
// POST /search - Busca em notícias existentes (auth condicional)

import { Router, Request, Response } from 'express';
import { requireAuth, conditionalAuth } from '../middleware/auth';
import { validateQuery, validateBody, schemas } from '../middleware/validation';
import { db } from '../database/queries';
import { isOfficialSource } from '../database/analyticsQueries';
import { logger } from '../middleware/logger';

// Enrich feed items with has_official_source + estado_uf
function enrichFeedItems<T extends { cidade: string; news_sources: Array<{ url: string; source_name: string | null }> }>(
  news: T[],
  cityToUF: Map<string, string>,
) {
  return news.map((item) => ({
    ...item,
    has_official_source: item.news_sources.some((s) => isOfficialSource(s.url)),
    estado_uf: cityToUF.get(item.cidade) || null,
  }));
}

const router = Router();

/**
 * GET /news?cidade=Curitiba&offset=0&limit=20
 * Feed de notícias para o app mobile.
 */
router.get(
  '/news',
  conditionalAuth,
  validateQuery(schemas.pagination),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { offset, limit } = req.query as unknown as { offset: number; limit: number };
      const cidade = req.query.cidade as string | undefined;

      const result = await db.getNewsFeed({ cidade, offset, limit });
      const cityToUF = await db.getCityToUFMap();
      res.json({ ...result, news: enrichFeedItems(result.news, cityToUF) });
    } catch (error) {
      logger.error('[News] Feed error:', error);
      res.status(500).json({ error: 'Failed to fetch news feed' });
    }
  }
);

/**
 * POST /search
 * Busca em notícias existentes (filtro).
 */
router.post(
  '/search',
  conditionalAuth,
  validateBody(schemas.manualSearch),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { query, cidade, tipoCrime, dateFrom, dateTo } = req.body as {
        query: string;
        cidade?: string;
        tipoCrime?: string;
        dateFrom?: string;
        dateTo?: string;
      };

      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await db.searchNews({ query, cidade, tipoCrime, dateFrom, dateTo, offset, limit });
      res.json(result);
    } catch (error) {
      logger.error('[News] Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

/**
 * GET /news/feed?offset=0&limit=20&cidade=Curitiba
 * Feed enriquecido com status de leitura e favoritos.
 */
router.get(
  '/news/feed',
  conditionalAuth,
  validateQuery(schemas.pagination),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as unknown as { user?: { id: string } }).user?.id;
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;
      const cidade = req.query.cidade as string | undefined;

      const cityToUF = await db.getCityToUFMap();

      // Usuario anonimo → feed basico (sem read/favorite status)
      if (!userId) {
        const result = await db.getNewsFeed({ cidade, offset, limit });
        res.json({ ...result, news: enrichFeedItems(result.news, cityToUF) });
        return;
      }

      const result = await db.getUserNewsFeed(userId, { offset, limit, cidade });
      res.json({ ...result, news: enrichFeedItems(result.news, cityToUF) });
    } catch (error) {
      logger.error('[News] User feed error:', error);
      res.status(500).json({ error: 'Failed to fetch user feed' });
    }
  }
);

/**
 * POST /news/:id/read
 * Marcar notícia como lida.
 */
router.post(
  '/news/:id/read',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as unknown as { user: { id: string } }).user.id;
      await db.markAsRead(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('[News] Mark read error:', error);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  }
);

/**
 * POST /news/:id/favorite
 * Favoritar notícia.
 */
router.post(
  '/news/:id/favorite',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as unknown as { user: { id: string } }).user.id;
      await db.addFavorite(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('[News] Favorite error:', error);
      res.status(500).json({ error: 'Failed to favorite' });
    }
  }
);

/**
 * DELETE /news/:id/favorite
 * Remover favorito.
 */
router.delete(
  '/news/:id/favorite',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as unknown as { user: { id: string } }).user.id;
      await db.removeFavorite(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('[News] Unfavorite error:', error);
      res.status(500).json({ error: 'Failed to unfavorite' });
    }
  }
);

/**
 * GET /news/unread-count
 * Contador de notícias não lidas.
 */
router.get(
  '/news/unread-count',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as unknown as { user: { id: string } }).user.id;
      const count = await db.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      logger.error('[News] Unread count error:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  }
);

/**
 * GET /news/favorites?offset=0&limit=20
 * Lista de favoritos do usuário.
 */
router.get(
  '/news/favorites',
  requireAuth,
  validateQuery(schemas.pagination),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as unknown as { user: { id: string } }).user.id;
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await db.getUserFavorites(userId, { offset, limit });
      res.json(result);
    } catch (error) {
      logger.error('[News] Favorites error:', error);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  }
);

export default router;
