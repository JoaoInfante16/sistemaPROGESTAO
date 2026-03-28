// ============================================
// Location Routes - Admin CRUD + Scan Manual
// ============================================
// GET    /locations         - Listar hierarquia (admin)
// POST   /locations         - Criar localização (admin)
// PATCH  /locations/:id     - Atualizar localização (admin)
// POST   /locations/:id/scan - Disparar scan manual (admin)

import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateBody, schemas } from '../middleware/validation';
import { db } from '../database/queries';
import { enqueueScan } from '../jobs/scheduler/cronScheduler';
import { logger } from '../middleware/logger';

const router = Router();

/**
 * GET /locations
 * Retorna estados com cidades aninhadas.
 */
router.get(
  '/locations',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const hierarchy = await db.getLocationsHierarchy();
      res.json(hierarchy);
    } catch (error) {
      logger.error('[Locations] Hierarchy error:', error);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  }
);

/**
 * POST /locations
 * Criar nova localização (estado ou cidade).
 */
router.post(
  '/locations',
  requireAuth,
  requireAdmin,
  validateBody(schemas.createLocation),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const location = await db.insertLocation(req.body);
      res.status(201).json(location);
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('unique_location')) {
        res.status(409).json({ error: 'Location already exists' });
        return;
      }
      logger.error('[Locations] Create error:', error);
      res.status(500).json({ error: 'Failed to create location' });
    }
  }
);

/**
 * PATCH /locations/:id
 * Atualizar localização (active, mode, keywords, scan_frequency_minutes).
 */
router.patch(
  '/locations/:id',
  requireAuth,
  requireAdmin,
  validateBody(schemas.updateLocation),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await db.updateLocation(req.params.id, req.body);
      res.json({ success: true });
    } catch (error) {
      logger.error('[Locations] Update error:', error);
      res.status(500).json({ error: 'Failed to update location' });
    }
  }
);

/**
 * DELETE /locations/:id
 * Deletar localização (cidade ou estado).
 */
router.delete(
  '/locations/:id',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await db.deleteLocation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('[Locations] Delete error:', error);
      res.status(500).json({ error: 'Failed to delete location' });
    }
  }
);

/**
 * POST /locations/:id/scan
 * Disparar scan manual para uma localização.
 */
router.post(
  '/locations/:id/scan',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const jobId = await enqueueScan(req.params.id);
      res.json({ success: true, jobId });
    } catch (error) {
      logger.error('[Locations] Manual scan error:', error);
      res.status(500).json({ error: 'Failed to enqueue scan' });
    }
  }
);

/**
 * POST /locations/bulk-import
 * Importar cidades do IBGE em lote para monitoramento.
 */
router.post(
  '/locations/bulk-import',
  requireAuth,
  requireAdmin,
  validateBody(schemas.bulkImportLocations),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { state_name, cities, mode, scan_frequency_minutes } = req.body as {
        state_name: string;
        cities: string[];
        mode: 'keywords' | 'any';
        scan_frequency_minutes: number;
      };

      // Find or create state
      let stateId: string;
      const hierarchy = await db.getLocationsHierarchy();
      const existingState = hierarchy.find(
        (s) => s.name.toLowerCase() === state_name.toLowerCase()
      );

      if (existingState) {
        stateId = existingState.id;
      } else {
        const newState = await db.insertLocation({ type: 'state', name: state_name });
        stateId = newState.id;
      }

      // Find existing cities for this state to skip duplicates
      const existingCities = new Set(
        (existingState?.cities || []).map((c) => c.name.toLowerCase())
      );

      const newCities = cities.filter(
        (c) => !existingCities.has(c.toLowerCase())
      );

      // Bulk insert new cities
      if (newCities.length > 0) {
        await db.bulkInsertLocations(stateId, newCities, mode, scan_frequency_minutes);
      }

      logger.info(`[Locations] Bulk import: ${newCities.length} imported, ${cities.length - newCities.length} skipped for ${state_name}`);
      res.status(201).json({
        imported: newCities.length,
        skipped: cities.length - newCities.length,
        total: cities.length,
      });
    } catch (error) {
      logger.error('[Locations] Bulk import error:', error);
      res.status(500).json({ error: 'Failed to bulk import locations' });
    }
  }
);

export default router;
