import { Router } from 'express';
import healthRouter from './health';
import publicRouter from './publicRoutes';
import newsRouter from './newsRoutes';
import locationRouter from './locationRoutes';
import userRouter from './userRoutes';
import settingsRouter from './settingsRoutes';
import deviceRouter from './deviceRoutes';
import manualSearchRouter from './manualSearchRoutes';

const router = Router();

// Rotas públicas
router.use(healthRouter);
router.use(publicRouter);

// Rotas autenticadas (mobile app)
router.use(newsRouter);
router.use(deviceRouter);
router.use(manualSearchRouter);

// Rotas admin
router.use(locationRouter);
router.use(userRouter);
router.use(settingsRouter);

// Dev tools (TEMPORARIO - remover antes do deploy)
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const devRouter = require('./devRoutes').default;
  router.use(devRouter);
}

export default router;
