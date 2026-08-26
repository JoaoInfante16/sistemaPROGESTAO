import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * As tarefas agendadas (auto-scan e fechamento de billing) sao SINGLETON: tem
 * que rodar em UM ambiente so por banco.
 *
 * ⚠️ O MOTIVO DESTA GUARDA MUDOU EM 26/08. Ate essa data os tres ambientes
 * usavam o MESMO Supabase, e como o gatilho do scan e a coluna `last_check` de
 * `monitored_locations`, eles se revezavam escaneando — a `news` que alimenta o
 * feed do cliente recebia resultado de codigo de teste. Isso acabou: producao
 * tem banco proprio (`uywvrkiujzcmfmoxbwna`) e staging tem o dele
 * (`amrpitduoogfzhonfugu`). Producao nao disputa mais com ninguem.
 *
 * A guarda continua, por DOIS motivos novos:
 *
 * 1. CUSTO. Scan em staging gasta OpenAI, BrightData e Jina de verdade — nao ha
 *    ambiente de teste para essas APIs. Ligar staging 24/7 e dinheiro queimado
 *    sem ninguem lendo o resultado.
 * 2. Dev local e o Render de staging apontam para o MESMO banco de staging,
 *    entao a disputa por `last_check` ainda existe entre esses dois. A
 *    diferenca e que agora o estrago fica em staging, nao no feed do cliente.
 *
 * O `queueNames.ts` resolve o roubo de JOBS e segue necessario: o Redis
 * continua compartilhado de proposito (cache endereçado por conteudo — ver o
 * comentario la).
 *
 * Default derivado do NODE_ENV de proposito: se fosse `false` fixo e producao
 * esquecesse de setar, o scan do cliente morreria calado. Setar
 * AUTO_SCAN_ENABLED=true em staging agora e seguro para o cliente — so custa.
 */
function tarefasAgendadasHabilitadas(): boolean {
  const explicito = process.env.AUTO_SCAN_ENABLED;
  if (explicito !== undefined && explicito !== '') return explicito === 'true';
  return optionalEnv('NODE_ENV', 'development') === 'production';
}

export const config = {
  // Server
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  scheduledJobsEnabled: tarefasAgendadasHabilitadas(),
  port: parseInt(optionalEnv('PORT', '3000'), 10),

  // Database (Supabase)
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_KEY'),
  databaseUrl: requireEnv('DATABASE_URL'),

  // Redis (Upstash)
  redisUrl: requireEnv('REDIS_URL'),

  // Search Provider (optional - pipeline won't run without them)
  searchBackend: optionalEnv('SEARCH_BACKEND', 'google'),
  googleApiKey: optionalEnv('GOOGLE_SEARCH_API_KEY', ''),
  googleSearchEngineId: optionalEnv('GOOGLE_SEARCH_ENGINE_ID', ''),
  perplexityApiKey: optionalEnv('PERPLEXITY_API_KEY', ''),
  braveApiKey: optionalEnv('BRAVE_API_KEY', ''),
  brightdataApiKey: optionalEnv('BRIGHTDATA_API_KEY', ''),
  brightdataZone: optionalEnv('BRIGHTDATA_ZONE', 'simeopss'),

  // Content Fetcher (optional - pipeline won't run without it)
  contentBackend: optionalEnv('CONTENT_BACKEND', 'jina'),
  jinaApiKey: optionalEnv('JINA_API_KEY', ''),

  // LLM (OpenAI) (optional - pipeline won't run without it)
  openaiApiKey: optionalEnv('OPENAI_API_KEY', ''),
  openaiModel: optionalEnv('OPENAI_MODEL', 'gpt-4o-mini'),
  openaiEmbeddingModel: optionalEnv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),

  // Firebase (opcional até FASE 4 - push notifications)
  firebaseServiceAccount: optionalEnv('FIREBASE_SERVICE_ACCOUNT', ''),

  // Budget
  monthlyBudgetUsd: parseInt(optionalEnv('MONTHLY_BUDGET_USD', '100'), 10),
  budgetWarningThreshold: parseFloat(optionalEnv('BUDGET_WARNING_THRESHOLD', '0.9')),

  // Cache TTL (seconds)
  cacheJinaContentTtl: parseInt(optionalEnv('CACHE_JINA_CONTENT_TTL', '86400'), 10),
  cacheEmbeddingTtl: parseInt(optionalEnv('CACHE_EMBEDDING_TTL', '2592000'), 10),

  // CRON
  scanCronSchedule: optionalEnv('SCAN_CRON_SCHEDULE', '0 * * * *'),

  // Security
  corsOrigin: optionalEnv('CORS_ORIGIN', 'http://localhost:3001'),

  // Logging
  logLevel: optionalEnv('LOG_LEVEL', 'info'),

  // Sentry (opcional — skip se vazio)
  sentryDsn: optionalEnv('SENTRY_DSN', ''),
} as const;

export type Config = typeof config;
