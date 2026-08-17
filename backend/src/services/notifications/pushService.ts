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
import { rotuloTipoCrime } from '../../utils/types';

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

/**
 * 🚨 Aqui viviam duas copias — `TIPO_TO_GRUPO` e `GRUPO_LABELS` — de tabelas
 * que `types.ts` ja tinha, e a copia tinha apodrecido: dizia que `receptacao`
 * era **fraude**, enquanto `TIPO_CRIME_GRUPO` diz **patrimonial** desde que a
 * decisao foi tomada e escrita la. O push anunciava "Fraude em X" para uma
 * noticia que o app lista em Patrimonial — duas verdades sobre a mesma linha.
 *
 * Nada as substitui: o rotulo agora vem de `rotuloTipoCrime`, que e a fonte.
 * A antiga `formatTipoCrime` tambem morreu aqui — o nome prometia o tipo e
 * devolvia a CATEGORIA, e era por isso que um homicidio chegava no celular como
 * "Seguranca em Florianopolis" em vez de "Homicidio em Florianopolis".
 */

export interface PushNewsData {
  id: string;
  tipo_crime: string;
  cidade: string;
  bairro: string | null;
  resumo: string;
  /**
   * A manchete que o Filter2 escreveu. **E ela que vai no corpo do push.**
   *
   * ⚠️ Ate 17/08 este campo nao existia: o push mandava o `resumo`, que e
   * COMPLEMENTAR a manchete por decisao de prompt ("never a paraphrase of it").
   * Ou seja, a notificacao entregava o complemento sem o fato — chegava
   * "A Procuradoria realiza cerca de 30 atendimentos mensais" sem dizer que a
   * materia era sobre aumento da violencia contra a mulher.
   */
  titulo: string | null;
  /** Assunto (`seguranca`, `patrimonial`...). Sem ele nao ha como filtrar. */
  categoria_grupo?: string | null;
  /** `estatistica` e numero/balanco, nao ocorrencia. Muda canal e permissao. */
  natureza?: string | null;
}

/**
 * Os dois canais Android.
 *
 * Existem para dar a alavanca ao proprio Android: com UM canal, o usuario tem
 * um interruptor para tudo; com dois, ele deixa URGENTE com som e ROTINA mudo
 * nas configuracoes do sistema. Decisao do Joao (11/08): o app decide **o que
 * e urgente**, o Android decide **como avisa**.
 *
 * ⚠️ Estes ids tem que bater com os canais criados no Flutter
 * (`push_service.dart`). Canal que o app nao criou faz o Android cair no
 * default e ignorar a separacao inteira, **sem erro nenhum**.
 */
const CANAL_URGENTE = 'simeops_urgente';
const CANAL_ROTINA = 'simeops_rotina';

/**
 * O que sobe pelo canal urgente: **ocorrencia de Seguranca**.
 *
 * Mesmo criterio que o app ja usa para engrossar a manchete no fio
 * (`TakeCard.isUrgent`), menos a janela de 6h — aqui a noticia acabou de ser
 * inserida, entao ela e sempre recente. Reusar o criterio e o ponto: um segundo
 * conceito de urgencia criaria duas verdades sobre a mesma noticia.
 */
function canalDaNoticia(news: PushNewsData): string {
  if (news.natureza === 'estatistica') return CANAL_ROTINA;
  return news.categoria_grupo === 'seguranca' ? CANAL_URGENTE : CANAL_ROTINA;
}

interface PrefsDoUsuario {
  user_id: string;
  cidades: string[] | null;
  categorias: string[] | null;
  estatisticas: boolean;
}

/**
 * Este usuario quer esta noticia?
 *
 * 🚨 **`null` quer dizer "todas", e nao "nenhuma".** Usuario sem linha em
 * `user_notification_prefs` — que sao todos, ate abrirem a tela — recebe tudo,
 * exatamente como antes desta feature existir. Inverter isso calaria todo mundo
 * na hora do deploy, e ninguem reclama de push que nao chega: acha que o
 * produto parou.
 */
function querReceber(prefs: PrefsDoUsuario | undefined, news: PushNewsData): boolean {
  if (!prefs) return true;

  if (news.natureza === 'estatistica' && !prefs.estatisticas) return false;

  if (prefs.cidades !== null && !prefs.cidades.includes(news.cidade)) return false;

  if (prefs.categorias !== null) {
    const cat = news.categoria_grupo || 'institucional';
    if (!prefs.categorias.includes(cat)) return false;
  }

  return true;
}

export interface PushResult {
  sent: boolean;
  reason?: string;
  deviceCount: number;
  successCount: number;
}

/**
 * Como o texto de UMA noticia e montado.
 *
 * Titulo diz **o que e onde**, corpo diz **o que aconteceu**. Antes o titulo
 * trazia a CATEGORIA ("Seguranca em Florianopolis") e o corpo trazia o RESUMO,
 * que por contrato de prompt e complementar a manchete ("never a paraphrase of
 * it") — ou seja, a notificacao entregava o detalhe sem o fato.
 */
function textoDeUma(n: PushNewsData): { title: string; body: string } {
  const local = n.bairro ? `${n.bairro}, ${n.cidade}` : n.cidade;
  // Manchete vazia so acontece em linha antiga; o resumo e o menos pior.
  const manchete = n.titulo?.trim() || n.resumo;
  // `outros` nao e rotulo: "Outros em Florianopolis" nao diz nada a ninguem.
  // Sem tipo util, o lugar sozinho ja e mais informativo.
  return {
    title: n.tipo_crime === 'outros' ? local : `${rotuloTipoCrime(n.tipo_crime)} em ${local}`,
    body: manchete.length > 140 ? `${manchete.slice(0, 137)}...` : manchete,
  };
}

/**
 * Como o texto de VARIAS e montado: quantas e de onde no titulo, as manchetes
 * que couberem no corpo e `+N` para o resto.
 *
 * O limite e de caractere, nao de quantidade: manchete tem teto de 70 no prompt
 * do Filter2, entao cabem duas na pratica. A primeira entra sempre, mesmo
 * estourando — push sem nenhuma manchete nao diria nada.
 */
function textoDeVarias(noticias: PushNewsData[]): { title: string; body: string } {
  const cidades = [...new Set(noticias.map((n) => n.cidade))];
  const title = cidades.length === 1
    ? `${cidades[0]} · ${noticias.length} noticias`
    : `${noticias.length} noticias em ${cidades.length} cidades`;

  const LIMITE = 130;
  const cabem: string[] = [];
  let usado = 0;
  for (const n of noticias) {
    const t = n.titulo?.trim() || n.resumo;
    const custo = (cabem.length > 0 ? 3 : 0) + t.length;
    if (cabem.length > 0 && usado + custo > LIMITE) break;
    cabem.push(t);
    usado += custo;
  }
  const sobraram = noticias.length - cabem.length;
  return { title, body: sobraram > 0 ? `${cabem.join(' · ')} · +${sobraram}` : cabem.join(' · ') };
}

/** Um lote sobe pelo canal urgente se QUALQUER noticia dele for urgente. */
function canalDoLote(noticias: PushNewsData[]): string {
  return noticias.some((n) => canalDaNoticia(n) === CANAL_URGENTE) ? CANAL_URGENTE : CANAL_ROTINA;
}

/**
 * Envia UM push por aparelho para o lote inteiro de uma rodada de scan.
 *
 * 🚨 **O agrupamento e POR USUARIO, e nao da para ser de outro jeito.** O
 * recorte de `querReceber` (cidade, assunto, estatistica) e individual: das 5
 * noticias de uma rodada, o cliente A pode querer 3 e o B so 1 — entao "quantas
 * chegaram" e uma pergunta diferente para cada um. Agrupar antes de filtrar
 * mandaria "5 noticias" para quem so pediu 1.
 *
 * Aparelhos com o MESMO recorte compartilham uma chamada ao FCM, entao no caso
 * comum (ninguem mexeu nas preferencias) isso continua sendo um multicast so.
 *
 * ⚠️ **Por que isto existe:** ate 17/08 o push saia de dentro do laco que grava,
 * um por noticia. A media historica de 2,0/dia deixava o custo disso invisivel —
 * em 17/08 entraram **31 noticias**, e 25 delas cairiam em rodadas com irmas
 * (9 de 15 rodadas). Sao 31 vibracoes no bolso do cliente onde cabiam 15.
 */
export async function sendPushForBatch(
  noticias: PushNewsData[],
  options?: { force?: boolean; dryRun?: boolean },
): Promise<PushResult> {
  if (noticias.length === 0) {
    return { sent: false, reason: 'Nada para notificar', deviceCount: 0, successCount: 0 };
  }

  // Verificar se push está habilitado no admin panel (skip se force)
  if (!options?.force) {
    const pushEnabled = await configManager.getBoolean('push_enabled');
    if (!pushEnabled) {
      logger.debug('[Push] Disabled via config');
      return { sent: false, reason: 'push_enabled esta desativado nas configuracoes', deviceCount: 0, successCount: 0 };
    }
  }

  if (!options?.dryRun && !ensureFirebase()) {
    return { sent: false, reason: 'Firebase nao configurado. Defina FIREBASE_SERVICE_ACCOUNT no .env com o JSON da service account do Firebase.', deviceCount: 0, successCount: 0 };
  }

  // Buscar device tokens ativos (últimos 30 dias)
  const { data: devices, error } = await supabase
    .from('user_devices')
    .select('device_token, user_id')
    .gte('last_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    logger.error(`[Push] Failed to fetch devices: ${error.message}`);
    return { sent: false, reason: `Erro ao buscar dispositivos: ${error.message}`, deviceCount: 0, successCount: 0 };
  }

  if (!devices || devices.length === 0) {
    return { sent: false, reason: 'Nenhum dispositivo registrado. Abra o app no celular e faca login para registrar.', deviceCount: 0, successCount: 0 };
  }

  // Falha no lado seguro: se a consulta de preferencias der erro, `prefs` fica
  // vazio e `querReceber` devolve `true` para todo mundo. Erro de banco nao
  // pode virar silencio — e melhor um push a mais que um alerta que sumiu.
  const userIds = [...new Set(devices.map((d) => d.user_id as string).filter(Boolean))];
  const prefsPorUsuario = new Map<string, PrefsDoUsuario>();
  if (userIds.length > 0) {
    const { data: prefs, error: prefsErr } = await supabase
      .from('user_notification_prefs')
      .select('user_id, cidades, categorias, estatisticas')
      .in('user_id', userIds);
    if (prefsErr) {
      logger.error(`[Push] Failed to fetch prefs, sending to everyone: ${prefsErr.message}`);
    } else {
      for (const p of prefs || []) prefsPorUsuario.set(p.user_id as string, p as PrefsDoUsuario);
    }
  }

  // Um recorte por conjunto de noticias desejadas; aparelhos iguais se juntam.
  const porRecorte = new Map<string, { lote: PushNewsData[]; tokens: string[] }>();
  for (const d of devices) {
    const querem = noticias.filter((n) => querReceber(prefsPorUsuario.get(d.user_id as string), n));
    if (querem.length === 0) continue;
    const chave = querem.map((n) => n.id).join('|');
    const existente = porRecorte.get(chave);
    if (existente) existente.tokens.push(d.device_token as string);
    else porRecorte.set(chave, { lote: querem, tokens: [d.device_token as string] });
  }

  if (porRecorte.size === 0) {
    return {
      sent: false,
      reason: 'Nenhum aparelho pediu para receber esta cidade/assunto.',
      deviceCount: 0,
      successCount: 0,
    };
  }

  let deviceCount = 0;
  let successCount = 0;
  let enviouAlgo = false;
  for (const { lote, tokens } of porRecorte.values()) {
    const { title, body } = lote.length === 1 ? textoDeUma(lote[0]) : textoDeVarias(lote);
    const cidades = [...new Set(lote.map((n) => n.cidade))];

    // `cidade` e o que o app usa para abrir a tela certa no toque
    // (`push_service.dart` → `_navigateToCity`). Num lote de varias cidades nao
    // ha destino unico, entao ela fica de fora e o toque so abre o app.
    const payload: Record<string, string> = { total: String(lote.length) };
    if (cidades.length === 1) payload.cidade = cidades[0];
    if (lote.length === 1) {
      payload.news_id = lote[0].id;
      payload.tipo_crime = lote[0].tipo_crime;
    }

    const canal = lote.length === 1 ? canalDaNoticia(lote[0]) : canalDoLote(lote);

    // `dryRun` monta tudo e para antes do FCM. Existe porque push e a unica
    // parte do sistema que nao da para conferir sem incomodar o cliente: o
    // caminho real termina no bolso de quem esta trabalhando.
    if (options?.dryRun) {
      logger.info(`[Push][dry] ${tokens.length} aparelho(s) · ${canal}
    TITULO: ${title}
    CORPO : ${body}`);
      deviceCount += tokens.length;
      successCount += tokens.length;
      enviouAlgo = true;
      continue;
    }

    const r = await sendToTokens(tokens, title, body, payload, canal);
    deviceCount += r.deviceCount;
    successCount += r.successCount;
    enviouAlgo = enviouAlgo || r.sent;
  }

  logger.info(
    `[Push] lote de ${noticias.length} noticia(s) → ${porRecorte.size} recorte(s), ${successCount}/${deviceCount} aparelhos`,
  );
  return { sent: enviouAlgo, deviceCount, successCount };
}

/**
 * Uma noticia so. Continua existindo porque nem todo disparo vem de uma rodada
 * de scan — e um lote de um passa pelo mesmo caminho, sem segundo formato.
 */
export async function sendPushNotification(
  newsData: PushNewsData,
  options?: { force?: boolean },
): Promise<PushResult> {
  return sendPushForBatch([newsData], options);
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
  data?: Record<string, string>,
  /** Canal Android. Sem ele o sistema usa o default e os dois canais viram um. */
  canal: string = CANAL_ROTINA,
): Promise<PushResult> {
  const batches = chunkArray(tokens, 500); // Firebase: max 500 por batch

  let totalSuccess = 0;
  for (const batch of batches) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: data || {},
        android: { notification: { channelId: canal } },
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
  if (tokens.length === 0) return;
  await supabase
    .from('user_devices')
    .delete()
    .in('device_token', tokens);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
