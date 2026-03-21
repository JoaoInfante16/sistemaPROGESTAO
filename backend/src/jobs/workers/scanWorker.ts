// ============================================
// Scan Worker - BullMQ
// ============================================
// Processa jobs de scan da fila 'scan-queue'.
// Retry automático com exponential backoff.

import { Worker, Job } from 'bullmq';
import { redis } from '../../config/redis';
import { executePipeline } from '../pipeline/scanPipeline';
import { logger } from '../../middleware/logger';

interface ScanJobData {
  locationId: string;
}

export function createScanWorker(): Worker {
  const worker = new Worker<ScanJobData>(
    'scan-queue',
    async (job: Job<ScanJobData>) => {
      const { locationId } = job.data;

      logger.info(`[Worker] Processing job ${job.id} for location ${locationId}`);

      const result = await executePipeline(locationId);
      return result;
    },
    {
      connection: redis,
      concurrency: 3, // Max 3 scans em paralelo
      drainDelay: 30000, // 30s entre polls quando fila vazia (reduz uso Redis idle)
      limiter: {
        max: 10,
        duration: 60000, // Max 10 jobs por minuto
      },
    }
  );

  worker.on('completed', (job, returnvalue) => {
    logger.info(`[Worker] Job ${job.id} completed:`, returnvalue);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`[Worker] Error: ${err.message}`);
  });

  logger.info('[Worker] Scan worker started');
  return worker;
}
