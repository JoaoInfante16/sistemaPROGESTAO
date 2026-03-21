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

export const config = {
  // Server
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
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
} as const;

export type Config = typeof config;
