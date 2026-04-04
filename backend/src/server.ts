import * as Sentry from '@sentry/node';
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

// ============================================
// Sentry — Error Tracking
// ============================================
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.nodeEnv === 'production' ? 0.2 : 1.0,
    integrations: [Sentry.expressIntegration()],
  });
  logger.info(`[Sentry] Initialized (env: ${config.nodeEnv})`);
} else {
  logger.info('[Sentry] Disabled (SENTRY_DSN not set)');
}

// Capturar crashes globais
process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason);
  logger.error(`[UnhandledRejection] ${reason}`);
});
process.on('uncaughtException', (err) => {
  Sentry.captureException(err);
  logger.error(`[UncaughtException] ${err.message}`);
});

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

// Sentry error handler (ANTES do errorHandler customizado)
if (config.sentryDsn) {
  Sentry.setupExpressErrorHandler(app);
}

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
