import { Router } from 'express';
import healthRouter from './health';
import publicRouter from './publicRoutes';
import newsRouter from './newsRoutes';
import locationRouter from './locationRoutes';
import userRouter from './userRoutes';
import settingsRouter from './settingsRoutes';
import deviceRouter from './deviceRoutes';
import manualSearchRouter from './manualSearchRoutes';
import analyticsRouter from './analyticsRoutes';
import groupRouter from './groupRoutes';

const router = Router();

// Rotas públicas
router.use(healthRouter);
router.use(publicRouter);

// Rotas autenticadas (mobile app)
router.use(newsRouter);
router.use(deviceRouter);
router.use(manualSearchRouter);

// Rotas admin + analytics
router.use(locationRouter);
router.use(userRouter);
router.use(settingsRouter);
router.use(analyticsRouter);
router.use(groupRouter);

export default router;
