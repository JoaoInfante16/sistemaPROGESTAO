// ============================================
// Push Notification Service (Firebase Cloud Messaging)
// ============================================
// Envia push notifications para todos os dispositivos ativos.
// Firebase é inicializado lazy (só quando necessário).
// Se FIREBASE_SERVICE_ACCOUNT não estiver configurado, push é desabilitado.

import admin from 'firebase-admin';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { supabase } from '../../config/database';
import { configManager } from '../configManager';

let firebaseInitialized = false;

/**
 * Inicializa Firebase Admin SDK (lazy, uma vez).
 * Retorna false se não configurado.
 */
function ensureFirebase(): boolean {
  if (firebaseInitialized) return true;

  if (!config.firebaseServiceAccount) {
    logger.warn('[Push] FIREBASE_SERVICE_ACCOUNT env var not set - push disabled');
    return false;
  }

  // Validar JSON antes de passar ao Firebase
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(config.firebaseServiceAccount) as Record<string, unknown>;
  } catch (parseErr) {
    logger.error(`[Push] FIREBASE_SERVICE_ACCOUNT contains invalid JSON: ${(parseErr as Error).message}`);
    logger.error('[Push] Verify the env var contains a valid Firebase service account JSON');
    return false;
  }

  if (!credentials.project_id || !credentials.private_key) {
    logger.error('[Push] FIREBASE_SERVICE_ACCOUNT missing required fields (project_id, private_key)');
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(credentials as admin.ServiceAccount),
    });
    firebaseInitialized = true;
    logger.info(`[Push] Firebase Admin initialized (project: ${credentials.project_id})`);
    return true;
  } catch (err) {
    logger.error(`[Push] Firebase init failed: ${(err as Error).message}`);
    return false;
  }
}

interface PushNewsData {
  id: string;
  tipo_crime: string;
  cidade: string;
  bairro: string | null;
  resumo: string;
}

export interface PushResult {
  sent: boolean;
  reason?: string;
  deviceCount: number;
  successCount: number;
}

/**
 * Envia push notification para todos os dispositivos ativos (últimos 30 dias).
 * @param options.force - Ignora check de push_enabled (para dev tools)
 */
export async function sendPushNotification(
  newsData: PushNewsData,
  options?: { force?: boolean }
): Promise<PushResult> {
  // Verificar se push está habilitado no admin panel (skip se force)
  if (!options?.force) {
    const pushEnabled = await configManager.getBoolean('push_enabled');
    if (!pushEnabled) {
      logger.debug('[Push] Disabled via config');
      return { sent: false, reason: 'push_enabled esta desativado nas configuracoes', deviceCount: 0, successCount: 0 };
    }
  }

  if (!ensureFirebase()) {
    return { sent: false, reason: 'Firebase nao configurado. Defina FIREBASE_SERVICE_ACCOUNT no .env com o JSON da service account do Firebase.', deviceCount: 0, successCount: 0 };
  }

  // Buscar device tokens ativos (últimos 30 dias)
  const { data: devices, error } = await supabase
    .from('user_devices')
    .select('device_token')
    .gte('last_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    logger.error(`[Push] Failed to fetch devices: ${error.message}`);
    return { sent: false, reason: `Erro ao buscar dispositivos: ${error.message}`, deviceCount: 0, successCount: 0 };
  }

  logger.info(`[Push] Devices query result: ${devices?.length ?? 0} devices found`);

  if (!devices || devices.length === 0) {
    return { sent: false, reason: 'Nenhum dispositivo registrado. Abra o app no celular e faca login para registrar.', deviceCount: 0, successCount: 0 };
  }

  const title = `${newsData.tipo_crime} em ${newsData.cidade}${newsData.bairro ? ' - ' + newsData.bairro : ''}`;
  const body = newsData.resumo.length > 100
    ? newsData.resumo.substring(0, 100) + '...'
    : newsData.resumo;

  const tokens = devices.map((d) => d.device_token as string);
  return sendToTokens(tokens, title, body, {
    news_id: newsData.id,
    cidade: newsData.cidade,
    tipo_crime: newsData.tipo_crime,
  });
}

/**
 * Envia push notification para um usuário específico (por user_id).
 * Usado para notificar conclusão de busca manual.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<PushResult> {
  if (!ensureFirebase()) {
    return { sent: false, reason: 'Firebase nao configurado', deviceCount: 0, successCount: 0 };
  }

  const { data: devices, error } = await supabase
    .from('user_devices')
    .select('device_token')
    .eq('user_id', userId)
    .gte('last_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    logger.error(`[Push] Failed to fetch user devices: ${error.message}`);
    return { sent: false, reason: `Erro: ${error.message}`, deviceCount: 0, successCount: 0 };
  }

  if (!devices || devices.length === 0) {
    logger.debug(`[Push] No active devices for user ${userId}`);
    return { sent: false, reason: 'Nenhum dispositivo registrado', deviceCount: 0, successCount: 0 };
  }

  const tokens = devices.map((d) => d.device_token as string);
  return sendToTokens(tokens, title, body, data);
}

/**
 * Lógica compartilhada de envio por batch de tokens FCM.
 */
async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<PushResult> {
  const batches = chunkArray(tokens, 500); // Firebase: max 500 por batch

  let totalSuccess = 0;
  for (const batch of batches) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: data || {},
      });

      totalSuccess += response.successCount;
      logger.info(`[Push] Sent: ${response.successCount}/${batch.length} succeeded`);

      // Remover tokens inválidos
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(batch[idx]);
          }
        });

        if (failedTokens.length > 0) {
          await removeInvalidTokens(failedTokens);
          logger.info(`[Push] Removed ${failedTokens.length} invalid tokens`);
        }
      }
    } catch (err) {
      logger.error(`[Push] Batch send error: ${(err as Error).message}`);
    }
  }

  return { sent: totalSuccess > 0, deviceCount: tokens.length, successCount: totalSuccess };
}

async function removeInvalidTokens(tokens: string[]): Promise<void> {
  for (const token of tokens) {
    await supabase
      .from('user_devices')
      .delete()
      .eq('device_token', token);
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
