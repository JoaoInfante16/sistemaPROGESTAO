// ============================================
// News Event Listener (Postgres LISTEN/NOTIFY)
// ============================================
// Escuta eventos 'new_news' disparados pelo trigger do Postgres.
// Desacopla o pipeline do envio de push notifications.
// FASE 4: Integrado com pushService para enviar push real.

import { Client } from 'pg';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { sendPushNotification } from './pushService';

interface NewsEvent {
  id: string;
  tipo_crime: string;
  cidade: string;
  bairro: string | null;
  resumo: string;
}

/**
 * Inicia listener de eventos Postgres para novas notícias.
 * Usa conexão SEPARADA (LISTEN não funciona com pool).
 * Reconecta automaticamente em caso de erro.
 */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30_000;

export async function startNewsEventListener(attempt = 1): Promise<void> {
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });

  try {
    await client.connect();
    logger.info('[NewsListener] Connected to Postgres');

    await client.query('LISTEN new_news');
    logger.info('[NewsListener] Listening for new_news events...');

    client.on('notification', (msg) => {
      if (msg.channel !== 'new_news') return;

      try {
        const newsData = JSON.parse(msg.payload || '{}') as NewsEvent;
        logger.info(
          `[NewsListener] New news: ${newsData.tipo_crime} em ${newsData.cidade}${newsData.bairro ? ' - ' + newsData.bairro : ''}`
        );

        sendPushNotification(newsData).catch((pushErr) => {
          logger.error(`[NewsListener] Push failed: ${(pushErr as Error).message}`);
        });
      } catch (err) {
        logger.error(`[NewsListener] Error parsing event: ${(err as Error).message}`);
      }
    });

    client.on('error', (err) => {
      logger.error(`[NewsListener] Connection error: ${err.message}`);
      setTimeout(() => startNewsEventListener(1).catch(() => {}), RETRY_DELAY_MS);
    });
  } catch (err) {
    if (attempt >= MAX_RETRIES) {
      logger.warn(
        `[NewsListener] Could not connect after ${MAX_RETRIES} attempts. ` +
        'Push notifications via LISTEN/NOTIFY disabled. ' +
        'This is expected on networks without IPv6 support.'
      );
      return;
    }
    logger.warn(`[NewsListener] Connection attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${RETRY_DELAY_MS / 1000}s...`);
    setTimeout(() => startNewsEventListener(attempt + 1).catch(() => {}), RETRY_DELAY_MS);
  }
}
