import express from 'express';
import cors from 'cors';
import { Worker } from 'bullmq';
import { config } from './config';
import { logger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import { createScanWorker } from './jobs/workers/scanWorker';
import { createManualSearchWorker } from './jobs/workers/manualSearchWorker';
import { startScheduler, stopScheduler } from './jobs/scheduler/cronScheduler';
import { startNewsEventListener } from './services/notifications/newsEventListener';
import { redis } from './config/redis';

const app = express();

// Middleware
app.use(
  cors({
    origin: config.corsOrigin.split(','),
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use(routes);

// Error handler (deve ser o ultimo middleware)
app.use(errorHandler);

// Track resources for graceful shutdown
let scanWorker: Worker;
let manualSearchWorker: Worker;
let isShuttingDown = false;

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} (${config.nodeEnv})`);
  logger.info(`Health check: http://localhost:${config.port}/health`);

  // Iniciar workers, scheduler e event listener
  scanWorker = createScanWorker();
  manualSearchWorker = createManualSearchWorker();
  startScheduler();
  startNewsEventListener().catch((err) => {
    logger.warn(`[Server] NewsEventListener failed to start: ${(err as Error).message}`);
  });
});

// ============================================
// Graceful Shutdown
// ============================================

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`[Shutdown] ${signal} received. Starting graceful shutdown...`);

  // 1. Stop accepting new connections
  server.close(() => {
    logger.info('[Shutdown] HTTP server closed');
  });

  // 2. Stop scheduler (no new jobs)
  stopScheduler();

  // 3. Close workers (wait for current jobs to finish)
  const WORKER_TIMEOUT = 30_000;
  try {
    await Promise.race([
      Promise.all([
        scanWorker?.close(),
        manualSearchWorker?.close(),
      ]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), WORKER_TIMEOUT)
      ),
    ]);
    logger.info('[Shutdown] Workers closed');
  } catch {
    logger.warn('[Shutdown] Workers did not close in time, forcing...');
  }

  // 4. Close Redis
  try {
    await redis.quit();
    logger.info('[Shutdown] Redis disconnected');
  } catch {
    logger.warn('[Shutdown] Redis disconnect failed');
  }

  logger.info('[Shutdown] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
