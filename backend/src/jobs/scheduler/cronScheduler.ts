// ============================================
// CRON Scheduler
// ============================================
// Verifica periodicamente quais localizações precisam de scan.
// Enfileira jobs no BullMQ para processamento assíncrono.
// FIX #11: Redis lock para evitar race condition (jobs duplicados).

import cron from 'node-cron';
import { Queue } from 'bullmq';
import { redis } from '../../config/redis';
import { config } from '../../config';
import { db } from '../../database/queries';
import { logger } from '../../middleware/logger';
import { configManager } from '../../services/configManager';

const scanQueue = new Queue('scan-queue', { connection: redis });

// TTL do lock = tempo estimado de um scan (30 min)
const SCAN_LOCK_TTL_MS = 30 * 60 * 1000;

let scheduledTask: cron.ScheduledTask | null = null;

/**
 * Tenta adquirir lock Redis para uma localização.
 * Retorna true se conseguiu (pode enfileirar), false se já está rodando.
 */
async function acquireScanLock(locationId: string): Promise<boolean> {
  const lockKey = `scan-lock:${locationId}`;
  const result = await redis.set(lockKey, '1', 'PX', SCAN_LOCK_TTL_MS, 'NX');
  return result === 'OK';
}

/**
 * Checa se o momento atual está dentro da janela de operação configurada
 * (horário de Brasília). Fora da janela: CRON pula o tick.
 * Retorna { active: boolean, reason: string } pra logar motivo do skip.
 */
async function isWithinActiveWindow(): Promise<{ active: boolean; reason: string }> {
  // Força TZ Brasília independente do host (Render roda UTC).
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(new Date());
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0';
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
  const hour = parseInt(hourStr, 10);
  const isWeekend = weekdayStr === 'Sat' || weekdayStr === 'Sun';

  let start: number, end: number;
  if (isWeekend) {
    const enabled = await configManager.getBoolean('scan_weekend_enabled');
    if (!enabled) return { active: false, reason: `weekend off (${weekdayStr})` };
    start = await configManager.getNumber('scan_weekend_start');
    end = await configManager.getNumber('scan_weekend_end');
  } else {
    start = await configManager.getNumber('scan_weekday_start');
    end = await configManager.getNumber('scan_weekday_end');
  }

  // Janela contínua [start, end). Se start >= end, config inválida — liga por segurança.
  if (start >= end) return { active: true, reason: 'invalid window (fallback on)' };

  if (hour < start || hour >= end) {
    return { active: false, reason: `${hour}h fora de ${start}h-${end}h` };
  }
  return { active: true, reason: `${hour}h dentro de ${start}h-${end}h` };
}

export function startScheduler(): void {
  scheduledTask = cron.schedule(config.scanCronSchedule, async () => {
    // Pula o tick inteiro se fora da janela configurada (ex: madrugada, fim de semana).
    // Lock Redis não é tocado — nada enfileira, nada é marcado.
    const window = await isWithinActiveWindow();
    if (!window.active) {
      logger.info(`[CRON] Skipping tick — ${window.reason}`);
      return;
    }

    logger.info('[CRON] Checking locations to scan...');

    try {
      const allLocations = await db.getActiveLocations();
      // Só escanear cidades (type=city), não estados/grupos (type=state)
      const locations = allLocations.filter(l => l.type === 'city');

      let enqueued = 0;
      let skipped = 0;

      for (const location of locations) {
        const minutesSinceLastCheck = location.last_check
          ? (Date.now() - new Date(location.last_check).getTime()) / (1000 * 60)
          : Infinity;

        if (minutesSinceLastCheck >= location.scan_frequency_minutes) {
          // FIX #11: Lock Redis para evitar scans duplicados
          const gotLock = await acquireScanLock(location.id);
          if (!gotLock) {
            logger.info(`[CRON] Skipped ${location.name} (already running)`);
            skipped++;
            continue;
          }

          await scanQueue.add(
            'scan',
            { locationId: location.id },
            {
              attempts: 5,
              backoff: {
                type: 'exponential',
                delay: 60000, // 1min -> 2min -> 4min -> 8min -> 16min (~31min de tolerancia pra OpenAI voltar)
              },
            }
          );

          enqueued++;
          logger.info(`[CRON] Enqueued scan for ${location.name}`);
        }
      }

      logger.info(`[CRON] Enqueued ${enqueued}, skipped ${skipped}/${locations.length} locations`);
    } catch (error) {
      logger.error(`[CRON] Error: ${(error as Error).message}`);
    }
  });

  logger.info(`[CRON] Scheduler started (schedule: ${config.scanCronSchedule})`);
}

export function stopScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('[CRON] Scheduler stopped');
  }
}

// Permite enfileirar scan manualmente (útil para testes e admin panel)
export async function enqueueScan(locationId: string): Promise<string> {
  const job = await scanQueue.add(
    'scan',
    { locationId },
    {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 60000, // 1min -> 2min -> 4min -> 8min -> 16min (~31min de tolerancia pra OpenAI voltar)
      },
    }
  );

  logger.info(`[CRON] Manual scan enqueued for location ${locationId}, job ${job.id}`);
  return job.id || 'unknown';
}
