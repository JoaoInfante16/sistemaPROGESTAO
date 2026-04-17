# 🗺️ ROADMAP - Sistema de Monitoramento de Notícias de Crime

> **Contexto**: Sistema automatizado que monitora notícias de crimes em múltiplas cidades brasileiras 24/7, filtra com LLMs e envia push notifications em tempo real.

---

## 📊 Visão Geral

### Stack Tecnológico
- **Backend**: Node.js + TypeScript + Express + BullMQ + Supabase + Render.com
- **Admin Panel**: Next.js 14 + Tailwind + shadcn/ui + Vercel
- **Mobile App**: Flutter 3.x + SQLite + Firebase + Riverpod

### Estimativas
- **Tempo de desenvolvimento**: 20-30 dias
- **Custo MVP (10 cidades)**: ~$31/mês
- **Custo escala (1k-10k usuários)**: ~$50-80/mês (após migrar para Hetzner)

---

## 🎯 FASE 0: Setup Inicial (1-2 dias)

### Objetivo
Criar estrutura do projeto e configurar contas em plataformas

### Tarefas

#### 1. Estrutura de Repositório
```bash
mkdir "Netrios News" && cd "Netrios News"
git init
mkdir backend admin-panel mobile-app docs

# Backend
cd backend
npm init -y
npm install express typescript @types/node @types/express
npm install bullmq ioredis @supabase/supabase-js openai axios
npx tsc --init
```

#### 2. Criar Contas (CRÍTICO!)

- [ ] **Supabase** (database + auth)
  - Criar projeto: `netrios-news-prod`
  - Anotar: `SUPABASE_URL` e `SUPABASE_ANON_KEY`
  - Habilitar extensão: `pgvector` em SQL Editor

- [ ] **Upstash Redis** (job queue)
  - Free tier: 10k commands/day
  - Anotar: `REDIS_URL`

- [ ] **Render.com** (hosting backend)
  - Plano: Web Service ($7/mês)
  - Conectar GitHub repo

- [ ] **Vercel** (hosting admin panel)
  - Conectar GitHub repo

- [ ] **Firebase** (push notifications)
  - Criar projeto: `netrios-news`
  - Ativar Cloud Messaging
  - Download: `service-account.json`
  - Configurar apps (iOS + Android)

- [ ] **Google Cloud Console** (Custom Search API)
  - Criar projeto
  - Ativar API: Custom Search JSON API
  - Criar credencial (API key)
  - Criar Custom Search Engine em: https://programmablesearchengine.google.com
  - Anotar: `GOOGLE_SEARCH_API_KEY` e `GOOGLE_SEARCH_ENGINE_ID`

- [ ] **Jina AI** (content extraction)
  - Criar conta em: https://jina.ai
  - Anotar: `JINA_API_KEY`

- [ ] **OpenAI** (LLMs + embeddings)
  - Criar conta em: https://platform.openai.com
  - Adicionar crédito ($10 mínimo)
  - Anotar: `OPENAI_API_KEY`

#### 3. Configurar Variáveis de Ambiente

**Arquivo**: `backend/.env.example`
```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...

# Queue
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379

# APIs Externas
GOOGLE_SEARCH_API_KEY=AIzaSy...
GOOGLE_SEARCH_ENGINE_ID=xxxxx
JINA_API_KEY=jina_xxxxx
OPENAI_API_KEY=sk-proj-xxxxx

# Firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Config
NODE_ENV=development
PORT=3000
MONTHLY_BUDGET_USD=100
```

#### 4. Docker (opcional, recomendado)

**Arquivo**: `backend/Dockerfile`
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### ✅ Critérios de Conclusão
- [ ] Estrutura de pastas criada
- [ ] Todas as 7 contas criadas e API keys obtidas
- [ ] `.env.example` documentado
- [ ] TypeScript compilando sem erros

---

## 🗄️ FASE 1: Database Schema & Abstractions (2-3 dias)

### Objetivo
Implementar banco de dados e abstrações de providers

### 1.1 Database Schema

**Arquivo**: `backend/src/database/schema.sql`

```sql
-- Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Notícias processadas
CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_crime TEXT NOT NULL,
  cidade TEXT NOT NULL,
  bairro TEXT,
  rua TEXT,
  data_ocorrencia DATE NOT NULL,
  resumo TEXT NOT NULL,
  embedding vector(1536),
  confianca DECIMAL(3,2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para similarity search (CRÍTICO!)
CREATE INDEX news_embedding_idx ON news
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Índices adicionais
CREATE INDEX idx_news_cidade ON news(cidade);
CREATE INDEX idx_news_data ON news(data_ocorrencia DESC);
CREATE INDEX idx_news_created ON news(created_at DESC);

-- Fontes agrupadas (para deduplicação)
CREATE TABLE news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  source_name TEXT,
  fetched_at TIMESTAMP DEFAULT NOW()
);

-- Localizações monitoradas
CREATE TABLE monitored_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('state', 'city')),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES monitored_locations(id),
  active BOOLEAN DEFAULT true,
  mode TEXT CHECK (mode IN ('keywords', 'any')) DEFAULT 'any',
  keywords TEXT[],
  scan_frequency_hours INTEGER DEFAULT 1,
  last_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Perfis de usuários (complementa Supabase Auth)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Devices para push notifications
CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  platform TEXT CHECK (platform IN ('ios', 'android')),
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cache de buscas históricas
CREATE TABLE search_cache (
  search_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  params JSONB NOT NULL,
  params_hash TEXT UNIQUE,
  status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
  total_results INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE TABLE search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES search_cache(id) ON DELETE CASCADE,
  offset INTEGER,
  results JSONB
);

-- Logs de operação
CREATE TABLE operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES monitored_locations(id),
  stage TEXT,
  urls_processed INTEGER,
  news_found INTEGER,
  cost_usd DECIMAL(10,6),
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rate Limits configuráveis (FASE 3.5)
CREATE TABLE api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('google', 'jina', 'openai')),
  max_concurrent INTEGER NOT NULL DEFAULT 5,
  min_time_ms INTEGER NOT NULL DEFAULT 100,
  daily_quota INTEGER,
  monthly_quota INTEGER,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Valores iniciais
INSERT INTO api_rate_limits (provider, max_concurrent, min_time_ms, daily_quota, monthly_quota) VALUES
  ('google', 1, 100, 100, 3000),  -- 100/dia grátis, 3k/mês antes de cobrar
  ('jina', 10, 50, NULL, NULL),   -- Sem limite (paga por request)
  ('openai', 5, 200, NULL, NULL); -- Sem quota (paga por token)

-- Tracking de budget (read-only, calculado automaticamente)
CREATE TABLE budget_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('auto_scan', 'manual_search')),
  provider TEXT NOT NULL CHECK (provider IN ('google', 'jina', 'openai')),
  cost_usd DECIMAL(10,6) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_budget_created ON budget_tracking(created_at DESC);

-- View para dashboard de budget
CREATE VIEW budget_summary AS
SELECT
  date_trunc('month', created_at) as month,
  source,
  provider,
  SUM(cost_usd) as total_cost_usd,
  COUNT(*) as total_requests
FROM budget_tracking
GROUP BY date_trunc('month', created_at), source, provider;
```

### 1.2 Provider Abstractions (CRÍTICO!)

**Por que abstrações?** Permite trocar providers sem refatorar código (ex: Google → SerpAPI, Jina → FireCrawl)

**Estrutura**:
```
backend/src/services/
├── search/
│   ├── SearchProvider.ts          # Interface
│   ├── GoogleSearchProvider.ts    # Implementação
│   └── index.ts                   # Factory
├── content/
│   ├── ContentFetcher.ts
│   ├── JinaContentFetcher.ts
│   └── index.ts
├── embedding/
│   ├── EmbeddingProvider.ts
│   ├── OpenAIEmbeddingProvider.ts
│   └── index.ts
```

**Exemplo - SearchProvider**:

`backend/src/services/search/SearchProvider.ts`
```typescript
export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export interface SearchOptions {
  maxResults?: number;
  dateRestrict?: string; // ex: "d7" (últimos 7 dias)
}

export interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
```

`backend/src/services/search/GoogleSearchProvider.ts`
```typescript
import axios from 'axios';
import { SearchProvider, SearchResult, SearchOptions } from './SearchProvider';

export class GoogleSearchProvider implements SearchProvider {
  private apiKey: string;
  private searchEngineId: string;

  constructor() {
    this.apiKey = process.env.GOOGLE_SEARCH_API_KEY!;
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID!;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const url = 'https://www.googleapis.com/customsearch/v1';

    try {
      const response = await axios.get(url, {
        params: {
          key: this.apiKey,
          cx: this.searchEngineId,
          q: query,
          num: options.maxResults || 10,
          dateRestrict: options.dateRestrict || 'd7',
          cr: 'countryBR', // Apenas sites brasileiros
        }
      });

      return response.data.items?.map((item: any) => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet,
      })) || [];
    } catch (error) {
      console.error('Google Search API error:', error);
      throw new Error('Search failed');
    }
  }
}
```

`backend/src/services/search/index.ts`
```typescript
import { SearchProvider } from './SearchProvider';
import { GoogleSearchProvider } from './GoogleSearchProvider';

export function createSearchProvider(): SearchProvider {
  const backend = process.env.SEARCH_BACKEND || 'google';

  switch (backend) {
    case 'google':
      return new GoogleSearchProvider();
    // Futuro: case 'serpapi': return new SerpAPIProvider();
    default:
      throw new Error(`Unknown search backend: ${backend}`);
  }
}

export * from './SearchProvider';
```

**Implementar abstrações similares para**:
- ContentFetcher (Jina AI Reader)
- EmbeddingProvider (OpenAI text-embedding-3-small)

### ✅ Critérios de Conclusão
- [ ] Schema SQL executado no Supabase
- [ ] pgvector extension habilitada
- [ ] Índice IVFFlat criado em `news.embedding`
- [ ] Abstrações de Search, Content e Embedding implementadas
- [ ] Testes unitários das abstrações passando

---

## ⚙️ FASE 2: Pipeline Core (3-4 dias)

### Objetivo
Implementar pipeline de processamento end-to-end (sem deduplicação)

### 2.1 Filtros (3 camadas)

#### Filtro 0 - Regex Local (gratuito, elimina 50%)

`backend/src/services/filters/filter0Regex.ts`
```typescript
const BLOCKED_DOMAINS = [
  'facebook.com', 'instagram.com', 'twitter.com', 'youtube.com',
  'tiktok.com', 'linkedin.com', 'pinterest.com'
];

const NON_CRIME_KEYWORDS = [
  'novela', 'futebol', 'receita', 'horóscopo', 'fofoca',
  'celebridade', 'cinema', 'música', 'jogo', 'filme'
];

export function filter0Regex(url: string, snippet: string): boolean {
  // Bloquear redes sociais
  if (BLOCKED_DOMAINS.some(domain => url.includes(domain))) {
    return false;
  }

  // Bloquear palavras não-crime
  const lowerSnippet = snippet.toLowerCase();
  if (NON_CRIME_KEYWORDS.some(kw => lowerSnippet.includes(kw))) {
    return false;
  }

  return true;
}
```

#### Filtro 1 - GPT Snippet (~$0.0001, elimina 80% restante)

`backend/src/services/filters/filter1GPT.ts`
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function filter1GPT(snippet: string): Promise<boolean> {
  const prompt = `
Analise o seguinte snippet de notícia e responda APENAS "SIM" ou "NÃO":

Snippet: "${snippet}"

Pergunta: Isso é uma notícia de crime policial real (roubo, furto, homicídio, tráfico, etc)?

Resposta:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
      temperature: 0
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase();
    return answer === 'SIM';
  } catch (error) {
    console.error('Filter1 GPT error:', error);
    return false; // Em caso de erro, rejeita
  }
}
```

#### Filtro 2 - GPT Full Analysis (~$0.0005, extração estruturada)

`backend/src/services/filters/filter2GPT.ts`
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface NewsExtraction {
  e_crime: boolean;
  tipo_crime: 'roubo' | 'furto' | 'homicídio' | 'latrocínio' | 'tráfico' | 'assalto' | 'outro';
  cidade: string;
  bairro?: string;
  rua?: string;
  data_ocorrencia: string; // YYYY-MM-DD
  resumo: string;
  confianca: number; // 0.0 a 1.0
}

export async function filter2GPT(content: string): Promise<NewsExtraction | null> {
  const prompt = `
Analise a seguinte notícia e extraia dados estruturados em JSON.

NOTÍCIA:
${content.substring(0, 4000)} // Limitar a 4k chars para economizar

Retorne APENAS um JSON no formato:
{
  "e_crime": true/false,
  "tipo_crime": "roubo" | "furto" | "homicídio" | "latrocínio" | "tráfico" | "assalto" | "outro",
  "cidade": "Nome da Cidade",
  "bairro": "Nome do Bairro" ou null,
  "rua": "Nome da Rua" ou null,
  "data_ocorrencia": "YYYY-MM-DD",
  "resumo": "Resumo em 1-2 frases do que aconteceu",
  "confianca": 0.0 a 1.0 (quão certo você está que é crime)
}

Se não for notícia de crime, retorne: {"e_crime": false}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const data = JSON.parse(response.choices[0].message.content || '{}');

    // Validar
    if (!data.e_crime || data.confianca < 0.7) {
      return null;
    }

    return data as NewsExtraction;
  } catch (error) {
    console.error('Filter2 GPT error:', error);
    return null;
  }
}
```

### 2.2 Orquestração do Pipeline (CRÍTICO!)

`backend/src/jobs/pipeline/scanPipeline.ts`
```typescript
import { createSearchProvider } from '../../services/search';
import { createContentFetcher } from '../../services/content';
import { createEmbeddingProvider } from '../../services/embedding';
import { filter0Regex } from '../../services/filters/filter0Regex';
import { filter1GPT } from '../../services/filters/filter1GPT';
import { filter2GPT, NewsExtraction } from '../../services/filters/filter2GPT';
import pLimit from 'p-limit';

const searchProvider = createSearchProvider();
const contentFetcher = createContentFetcher();
const embeddingProvider = createEmbeddingProvider();

export async function executePipeline(locationId: string) {
  const startTime = Date.now();
  const location = await db.getLocation(locationId);

  console.log(`[Pipeline] Starting scan for ${location.name}`);

  // 1. Build query
  const query = buildQuery(location);
  console.log(`[Pipeline] Query: ${query}`);

  // 2. Google Search
  const searchResults = await searchProvider.search(query, { maxResults: 10 });
  console.log(`[Pipeline] Found ${searchResults.length} URLs`);

  // 3. Filtro 0 - Regex (local, sem custo)
  const afterFilter0 = searchResults.filter(r =>
    filter0Regex(r.url, r.snippet)
  );
  console.log(`[Pipeline] After Filter0: ${afterFilter0.length}/${searchResults.length}`);

  // 4. Filtro 1 - GPT Snippet (paralelizado)
  const filter1Results = await Promise.all(
    afterFilter0.map(async (r) => {
      const passes = await filter1GPT(r.snippet);
      return passes ? r : null;
    })
  );
  const afterFilter1 = filter1Results.filter(Boolean);
  console.log(`[Pipeline] After Filter1: ${afterFilter1.length}/${afterFilter0.length}`);

  if (afterFilter1.length === 0) {
    console.log(`[Pipeline] No URLs passed filters, stopping`);
    return { processed: 0 };
  }

  // 5. Content Fetch (paralelizado, max 10 simultâneos)
  const limit = pLimit(10);
  const contentResults = await Promise.all(
    afterFilter1.map(r =>
      limit(() => contentFetcher.fetch(r.url).catch(err => {
        console.error(`Failed to fetch ${r.url}:`, err);
        return null;
      }))
    )
  );
  const validContents = contentResults.filter(c => c !== null);
  console.log(`[Pipeline] Fetched ${validContents.length} articles`);

  // 6. Filtro 2 - GPT Full Analysis + Embedding
  const extractions: Array<NewsExtraction & { embedding: number[], sourceUrl: string }> = [];

  for (let i = 0; i < validContents.length; i++) {
    const content = validContents[i];
    const sourceUrl = afterFilter1[i].url;

    const extracted = await filter2GPT(content);
    if (!extracted) continue;

    // Gerar embedding
    const embedding = await embeddingProvider.generate(extracted.resumo);

    extractions.push({ ...extracted, embedding, sourceUrl });
  }

  console.log(`[Pipeline] After Filter2: ${extractions.length} valid news`);

  // 7. Save to database (sem dedup por enquanto - Fase 3)
  for (const news of extractions) {
    const newsId = await db.insertNews({
      tipo_crime: news.tipo_crime,
      cidade: news.cidade,
      bairro: news.bairro,
      rua: news.rua,
      data_ocorrencia: news.data_ocorrencia,
      resumo: news.resumo,
      embedding: news.embedding,
      confianca: news.confianca
    });

    await db.insertNewsSource(newsId, news.sourceUrl);
  }

  // 8. Atualizar last_check
  await db.updateLocationLastCheck(locationId, new Date());

  // 9. Log operação
  const duration = Date.now() - startTime;
  await db.insertOperationLog({
    location_id: locationId,
    stage: 'complete',
    urls_processed: searchResults.length,
    news_found: extractions.length,
    duration_ms: duration,
    cost_usd: calculateCost(searchResults.length, afterFilter1.length, extractions.length)
  });

  return { processed: extractions.length };
}

function buildQuery(location: any): string {
  const baseQuery = location.mode === 'keywords'
    ? location.keywords.join(' OR ')
    : 'crime polícia assalto roubo';

  return `${baseQuery} ${location.name} site:.br`;
}

function calculateCost(googleResults: number, jinaFetches: number, gptAnalyses: number): number {
  const googleCost = googleResults > 3000 ? (googleResults - 3000) * 0.005 : 0;
  const jinaCost = jinaFetches * 0.002;
  const gptCost = (googleResults * 0.0001) + (gptAnalyses * 0.0005);
  const embeddingCost = gptAnalyses * 0.00002;

  return googleCost + jinaCost + gptCost + embeddingCost;
}
```

### 2.3 Job Queue (BullMQ)

`backend/src/jobs/workers/scanWorker.ts`
```typescript
import { Worker, Job } from 'bullmq';
import { executePipeline } from '../pipeline/scanPipeline';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null
});

export const scanWorker = new Worker('scan-queue', async (job: Job) => {
  const { locationId } = job.data;

  console.log(`[Worker] Processing job ${job.id} for location ${locationId}`);

  try {
    const result = await executePipeline(locationId);
    return result;
  } catch (error) {
    console.error(`[Worker] Job ${job.id} failed:`, error);
    throw error; // BullMQ fará retry automático
  }
}, {
  connection,
  concurrency: 5, // Máximo 5 jobs em paralelo
  limiter: {
    max: 10,
    duration: 60000 // Máximo 10 jobs por minuto
  },
  settings: {
    backoffStrategy: (attemptsMade) => {
      return Math.min(attemptsMade * 2000, 30000); // Exponential backoff
    }
  }
});

scanWorker.on('completed', (job, returnvalue) => {
  console.log(`[Worker] Job ${job.id} completed:`, returnvalue);
});

scanWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed after all retries:`, err);
});

scanWorker.on('error', (err) => {
  console.error('[Worker] Error:', err);
});
```

### 2.4 CRON Scheduler

`backend/src/jobs/scheduler/cronScheduler.ts`
```typescript
import cron from 'node-cron';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!);
const scanQueue = new Queue('scan-queue', { connection });

// Executar a cada hora
export function startScheduler() {
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Checking locations to scan...');

    const locations = await db.getActiveLocations();

    for (const location of locations) {
      const hoursSinceLastCheck = location.last_check
        ? (Date.now() - new Date(location.last_check).getTime()) / (1000 * 60 * 60)
        : Infinity;

      if (hoursSinceLastCheck >= location.scan_frequency_hours) {
        await scanQueue.add('scan', { locationId: location.id }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        });

        console.log(`[CRON] Enqueued scan for ${location.name}`);
      }
    }
  });

  console.log('[CRON] Scheduler started (runs every hour)');
}
```

### ✅ Critérios de Conclusão
- [ ] Pipeline completo funciona end-to-end
- [ ] Filtros eliminam ~95% do ruído
- [ ] BullMQ processa jobs com retry automático
- [ ] CRON agenda scans a cada hora
- [ ] Logs estruturados disponíveis
- [ ] Custos medidos: ~$0.01-0.02 por cidade/scan

---

## ⚡ FASE 2.5: Otimizações Críticas (1-2 dias)

### Objetivo
Implementar 3 otimizações que reduzem custos em 85-90% e melhoram arquitetura

**Por que fazer AGORA**: Essas otimizações economizam ~$19/mês e previnem problemas arquiteturais. Implementar antes de escalar é muito mais fácil.

---

### 2.5.1 Cache de Conteúdo Jina + Embeddings

**❌ O QUE NÃO FAZER**: Cachear resultado do Google Search
- Problema: Impede detecção de notícias novas entre scans
- Exemplo: Notícia publicada às 14:25, cache válido até 15:00 → atraso de 35min!

**✅ SOLUÇÃO CORRETA**: Cachear apenas conteúdo baixado (Jina) e embeddings

#### Por quê?

```
Scan 1 (14:00):
  Google API → [URL1, URL2, URL3]
  Jina baixa conteúdos → cache (TTL 24h)
  Salva 3 notícias ✅

🆕 14:25 - NOTÍCIA NOVA publicada (URL4)

Scan 2 (14:30):
  Google API → [URL1, URL2, URL3, URL4] ← DETECTA URL4!
  Jina:
    - URL1-3: ✅ cache HIT (grátis!)
    - URL4: ❌ cache MISS → baixa conteúdo novo
  Salva URL4 → Push enviado ✅

  Notícia detectada em tempo real!
```

#### Implementação

**Arquivo**: `backend/src/services/content/CachedContentFetcher.ts`

```typescript
import crypto from 'crypto';
import { ContentFetcher } from './ContentFetcher';
import { createClient } from 'redis';

export class CachedContentFetcher implements ContentFetcher {
  private realFetcher: ContentFetcher;
  private redis: ReturnType<typeof createClient>;

  constructor(realFetcher: ContentFetcher) {
    this.realFetcher = realFetcher;
    this.redis = createClient({ url: process.env.REDIS_URL });
    this.redis.connect();
  }

  async fetch(url: string): Promise<string> {
    // 1. Hash da URL (key do cache)
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const cacheKey = `content:${urlHash}`;

    // 2. Verificar cache
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      console.log(`[ContentCache] ✅ HIT for ${url}`);
      await this.redis.incr('cache:content:hits');
      return cached;
    }

    // 3. Cache MISS: buscar conteúdo real
    console.log(`[ContentCache] ❌ MISS for ${url}, fetching...`);
    const content = await this.realFetcher.fetch(url);

    // 4. Salvar no cache por 24 HORAS
    //    (Conteúdo de notícia não muda depois de publicado)
    await this.redis.setex(cacheKey, 86400, content);
    await this.redis.incr('cache:content:misses');

    console.log(`[ContentCache] Cached (expires in 24h)`);

    return content;
  }
}
```

**Arquivo**: `backend/src/services/content/index.ts`

```typescript
import { ContentFetcher } from './ContentFetcher';
import { JinaContentFetcher } from './JinaContentFetcher';
import { CachedContentFetcher } from './CachedContentFetcher';

export function createContentFetcher(): ContentFetcher {
  const jinaFetcher = new JinaContentFetcher();

  // Wrap com cache
  return new CachedContentFetcher(jinaFetcher);
}

export * from './ContentFetcher';
```

**Arquivo**: `backend/src/services/embedding/CachedEmbeddingProvider.ts`

```typescript
import crypto from 'crypto';
import { EmbeddingProvider } from './EmbeddingProvider';
import { createClient } from 'redis';

export class CachedEmbeddingProvider implements EmbeddingProvider {
  private realProvider: EmbeddingProvider;
  private redis: ReturnType<typeof createClient>;

  constructor(realProvider: EmbeddingProvider) {
    this.realProvider = realProvider;
    this.redis = createClient({ url: process.env.REDIS_URL });
    this.redis.connect();
  }

  async generate(text: string): Promise<number[]> {
    // Hash do texto (mesmo texto = mesmo embedding)
    const textHash = crypto.createHash('md5').update(text).digest('hex');
    const cacheKey = `embedding:${textHash}`;

    const cached = await this.redis.get(cacheKey);

    if (cached) {
      console.log(`[EmbeddingCache] ✅ HIT`);
      await this.redis.incr('cache:embedding:hits');
      return JSON.parse(cached);
    }

    console.log(`[EmbeddingCache] ❌ MISS, generating...`);
    const embedding = await this.realProvider.generate(text);

    // Salvar por 30 dias (embeddings nunca mudam)
    await this.redis.setex(
      cacheKey,
      2592000,
      JSON.stringify(embedding)
    );
    await this.redis.incr('cache:embedding:misses');

    return embedding;
  }
}
```

**Arquivo**: `backend/src/services/embedding/index.ts`

```typescript
import { EmbeddingProvider } from './EmbeddingProvider';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';
import { CachedEmbeddingProvider } from './CachedEmbeddingProvider';

export function createEmbeddingProvider(): EmbeddingProvider {
  const openaiProvider = new OpenAIEmbeddingProvider();

  // Wrap com cache
  return new CachedEmbeddingProvider(openaiProvider);
}

export * from './EmbeddingProvider';
```

#### Economia

| Item | Antes | Depois | Economia |
|------|-------|--------|----------|
| **Jina fetch** | 1.800 fetches/mês | ~300 fetches/mês | **83%** ($3.00/mês) |
| **Embeddings** | 1.800 embeddings/mês | ~300 embeddings/mês | **83%** ($0.03/mês) |

**Total economizado: ~$3/mês** 💰

---

### 2.5.2 Batch GPT Calls (Filtro 1)

**Problema**: Filtro 1 faz 10 chamadas GPT separadas = 10x o custo + 10x a latência

**Solução**: Enviar TODOS os snippets em UMA ÚNICA chamada GPT

#### Implementação

**Arquivo**: `backend/src/services/filters/filter1GPTBatch.ts`

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function filter1GPTBatch(snippets: string[]): Promise<boolean[]> {
  // Criar prompt com TODOS os snippets numerados
  const prompt = `
Analise os seguintes ${snippets.length} snippets de notícias.
Para cada um, determine se é uma notícia de CRIME POLICIAL REAL.

SNIPPETS:
${snippets.map((snippet, index) => `${index}. "${snippet}"`).join('\n')}

Retorne um JSON com array de true/false:
{
  "results": [true, false, true, ...]
}

IMPORTANTE:
- Retorne EXATAMENTE ${snippets.length} valores booleanos
- true = crime policial real
- false = não é crime (novela, futebol, etc)

JSON:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' }
    });

    const data = JSON.parse(response.choices[0].message.content || '{}');

    // Validar resposta
    if (!data.results || data.results.length !== snippets.length) {
      console.error('[Filter1Batch] Invalid response length');
      // Fallback: assumir todos passam (safe default)
      return snippets.map(() => true);
    }

    return data.results;

  } catch (error) {
    console.error('[Filter1Batch] GPT error:', error);
    // Fallback: assumir todos passam
    return snippets.map(() => true);
  }
}
```

#### Integração no Pipeline

**Modificar**: `backend/src/jobs/pipeline/scanPipeline.ts`

```typescript
// ❌ ANTES (ruim):
const filter1Results = await Promise.all(
  afterFilter0.map(async (r) => {
    const passes = await filter1GPT(r.snippet);
    return passes ? r : null;
  })
);
const afterFilter1 = filter1Results.filter(Boolean);

// ✅ DEPOIS (bom):
import { filter1GPTBatch } from '../../services/filters/filter1GPTBatch';

const snippets = afterFilter0.map(r => r.snippet);
const batchResults = await filter1GPTBatch(snippets); // UMA chamada!

const afterFilter1 = afterFilter0.filter((_, index) => batchResults[index]);
console.log(`[Pipeline] After Filter1 (batch): ${afterFilter1.length}/${afterFilter0.length}`);
```

#### Economia

| Métrica | Antes (individual) | Depois (batch) | Economia |
|---------|-------------------|----------------|----------|
| **API calls** | 14.400/mês | 1.440/mês | **90%** |
| **Latência** | ~5s por scan | ~800ms por scan | **84%** |
| **Custo** | $14.40/mês | $2.16/mês | **$12.24/mês** 💰 |

---

### 2.5.3 Postgres LISTEN/NOTIFY para Push

**Problema**: Pipeline acoplado ao sistema de push. Se Firebase falhar, pipeline falha.

**Solução**: Event-driven architecture com Postgres LISTEN/NOTIFY

#### Arquitetura

```
❌ ANTES (acoplado):
Pipeline → INSERT DB → Enviar Push → Falha = perde notificação

✅ DEPOIS (desacoplado):
Pipeline → INSERT DB ──┐
                       │
                 Postgres NOTIFY
                       │
                       └→ Listener (separado) → Enviar Push
                                                ↓
                                          Retry automático
```

#### Implementação

**1. Trigger no Postgres**

Execute no Supabase SQL Editor:

```sql
-- Função que dispara notificação
CREATE OR REPLACE FUNCTION notify_new_news()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_news',
    json_build_object(
      'id', NEW.id,
      'tipo_crime', NEW.tipo_crime,
      'cidade', NEW.cidade,
      'bairro', NEW.bairro,
      'resumo', NEW.resumo
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que executa após INSERT
CREATE TRIGGER news_inserted_trigger
AFTER INSERT ON news
FOR EACH ROW
EXECUTE FUNCTION notify_new_news();
```

**2. Listener no Backend**

**Arquivo**: `backend/src/services/notifications/pushListener.ts`

```typescript
import { Client } from 'pg';
import { sendPushNotification } from './pushService';

export async function startPushListener() {
  // Conexão SEPARADA só para LISTEN (não pode usar pool!)
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  await client.connect();
  console.log('[PushListener] Connected to Postgres');

  // Escutar canal 'new_news'
  await client.query('LISTEN new_news');
  console.log('[PushListener] Listening for new news events...');

  // Handler de notificações
  client.on('notification', async (msg) => {
    if (msg.channel === 'new_news') {
      try {
        const newsData = JSON.parse(msg.payload || '{}');

        console.log(`[PushListener] Received event: news ${newsData.id}`);

        // Enviar push notification
        await sendPushNotification(newsData.id, newsData);

        console.log(`[PushListener] Push sent for news ${newsData.id}`);

      } catch (error) {
        console.error('[PushListener] Error processing event:', error);

        // Se falhar, adicionar à fila de retry
        await retryQueue.add('push-retry', { newsData }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 }
        });
      }
    }
  });

  // Handler de erros (reconectar automaticamente)
  client.on('error', async (err) => {
    console.error('[PushListener] Connection error:', err);

    setTimeout(() => {
      console.log('[PushListener] Reconnecting...');
      startPushListener();
    }, 5000);
  });

  return client;
}
```

**3. Inicializar no Server**

**Modificar**: `backend/src/server.ts`

```typescript
import { startPushListener } from './services/notifications/pushListener';

async function startServer() {
  // ... configuração express ...

  app.listen(3000, () => {
    console.log('[Server] HTTP server running on port 3000');
  });

  // Iniciar CRON scheduler
  startScheduler();

  // Iniciar Push Listener (NOVO!)
  await startPushListener();

  console.log('[Server] All systems operational ✅');
}

startServer();
```

**4. Remover Push do Pipeline**

**Modificar**: `backend/src/jobs/pipeline/scanPipeline.ts`

```typescript
// ❌ ANTES:
if (!isDuplicate) {
  const newsId = await db.insertNews({...});
  await db.insertNewsSource(newsId, news.sourceUrl);

  // Push acoplado aqui!
  await sendPushNotification(newsId, news);
}

// ✅ DEPOIS:
if (!isDuplicate) {
  const newsId = await db.insertNews({...});
  await db.insertNewsSource(newsId, news.sourceUrl);

  // Push é automático via LISTEN/NOTIFY!
  // Trigger do Postgres dispara → Listener envia push
}
```

#### Vantagens

- ✅ **Desacoplamento**: Pipeline não depende de Firebase
- ✅ **Re-processável**: Pode re-disparar eventos manualmente
- ✅ **Múltiplos consumidores**: Webhooks, Slack, etc.
- ✅ **Idempotência**: Não duplica push em caso de retry
- ✅ **Confiabilidade**: 95% → 99.9%

---

### ✅ Critérios de Conclusão - Fase 2.5

- [ ] Cache de Jina implementado e testado
- [ ] Cache de embeddings implementado e testado
- [ ] Batch GPT implementado no Filtro 1
- [ ] Postgres trigger criado
- [ ] Push listener rodando 24/7
- [ ] Pipeline desacoplado de push
- [ ] Economia de 85-90% validada nos logs

### 📊 Resumo de Economia

| Otimização | Economia Mensal | Benefício Extra |
|------------|-----------------|-----------------|
| **Cache Jina + Embeddings** | $3.00 | Mais rápido |
| **Batch GPT** | $12.24 | Menos rate limits |
| **LISTEN/NOTIFY** | $0 | +4.9% confiabilidade |
| **TOTAL** | **$15.24/mês** | Sistema mais robusto |

**Tempo de implementação**: 1-2 dias
**ROI**: Recupera investimento em 2 dias de operação! 🚀

---

## 🔄 FASE 3: Sistema de Deduplicação (2-3 dias)

### Objetivo
Implementar 3 camadas de deduplicação para evitar notícias repetidas

### Por que 3 camadas?

| Camada | Velocidade | Precisão | Custo |
|--------|-----------|----------|-------|
| **1. Geo-Temporal** | Instantâneo | 70% | $0 |
| **2. Embedding Similarity** | <200ms | 92% | $0.00002 |
| **3. GPT Confirmation** | ~500ms | 98% | $0.001 |

**Estratégia**: Eliminar 70% gratuitamente (camada 1), 25% barato (camada 2), apenas 5% usa GPT caro (camada 3).

### Implementação

`backend/src/services/deduplication/index.ts`
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function deduplicateNews(
  newsData: NewsExtraction & { embedding: number[] },
  sourceUrl: string
): Promise<{ isDuplicate: boolean; existingId?: string }> {

  // CAMADA 1: Busca Geo-Temporal (SQL, instantâneo, grátis)
  const candidates = await db.query(`
    SELECT id, resumo, embedding
    FROM news
    WHERE cidade = $1
      AND (bairro = $2 OR bairro IS NULL OR $2 IS NULL)
      AND tipo_crime = $3
      AND data_ocorrencia BETWEEN $4::date - INTERVAL '1 day'
                              AND $4::date + INTERVAL '1 day'
      AND active = true
    LIMIT 10
  `, [
    newsData.cidade,
    newsData.bairro || null,
    newsData.tipo_crime,
    newsData.data_ocorrencia
  ]);

  if (candidates.length === 0) {
    console.log('[Dedup] No geo-temporal candidates, clearly new');
    return { isDuplicate: false };
  }

  console.log(`[Dedup] Found ${candidates.length} geo-temporal candidates`);

  // CAMADA 2: Similarity Search (pgvector cosine, <200ms, barato)
  const similarities = candidates.map(c => ({
    id: c.id,
    resumo: c.resumo,
    score: cosineSimilarity(newsData.embedding, c.embedding)
  }));

  // Ordenar por score decrescente
  similarities.sort((a, b) => b.score - a.score);
  const topMatch = similarities[0];

  console.log(`[Dedup] Top similarity score: ${topMatch.score.toFixed(3)}`);

  if (topMatch.score < 0.85) {
    console.log('[Dedup] Low similarity, clearly different');
    return { isDuplicate: false };
  }

  // CAMADA 3: Confirmação GPT (caro, mas só 5% dos casos)
  console.log('[Dedup] High similarity, confirming with GPT...');
  const isDupe = await confirmDuplicateWithGPT(newsData.resumo, topMatch.resumo);

  if (isDupe) {
    // Adicionar URL como fonte alternativa
    await db.insertNewsSource(topMatch.id, sourceUrl);
    console.log(`[Dedup] Duplicate confirmed, added source to ${topMatch.id}`);
    return { isDuplicate: true, existingId: topMatch.id };
  }

  console.log('[Dedup] GPT says different, creating new entry');
  return { isDuplicate: false };
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function confirmDuplicateWithGPT(resumo1: string, resumo2: string): Promise<boolean> {
  const prompt = `
Estes dois resumos descrevem o MESMO evento criminal?

Resumo 1: "${resumo1}"
Resumo 2: "${resumo2}"

Considere duplicata se:
- Local, data e tipo de crime são idênticos
- Vítimas/suspeitos mencionados são os mesmos
- Detalhes principais coincidem

Responda APENAS "SIM" ou "NÃO":`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
      temperature: 0
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase();
    return answer === 'SIM';
  } catch (error) {
    console.error('[Dedup] GPT error:', error);
    return false; // Em caso de erro, assume não-duplicata (safe default)
  }
}
```

### Integração no Pipeline

`backend/src/jobs/pipeline/scanPipeline.ts` (modificar seção 7)
```typescript
// 7. Save to database COM DEDUPLICAÇÃO
for (const news of extractions) {
  const { isDuplicate, existingId } = await deduplicateNews(news, news.sourceUrl);

  if (!isDuplicate) {
    const newsId = await db.insertNews({
      tipo_crime: news.tipo_crime,
      cidade: news.cidade,
      bairro: news.bairro,
      rua: news.rua,
      data_ocorrencia: news.data_ocorrencia,
      resumo: news.resumo,
      embedding: news.embedding,
      confianca: news.confianca
    });

    await db.insertNewsSource(newsId, news.sourceUrl);
    console.log(`[Pipeline] New article saved: ${newsId}`);
  } else {
    console.log(`[Pipeline] Duplicate detected, source added to ${existingId}`);
  }
}
```

### ✅ Critérios de Conclusão
- [ ] Deduplicação 3 camadas implementada
- [ ] Taxa de falsos positivos < 5% (testar manualmente com ~50 artigos)
- [ ] Custos de dedup medidos: ~$0.001 por confirmação GPT
- [ ] Fontes alternativas sendo agrupadas corretamente
- [ ] Performance: <500ms por artigo em média

---

## 🔒 FASE 3.5: Segurança & Infraestrutura Essencial (1-2 dias)

### Objetivo
Implementar camadas de segurança ANTES de expor APIs (muito mais fácil que refatorar depois)

**Por que fazer AGORA**: Segurança não é "feature", é fundação. Adicionar depois = refatoração massiva.

---

### 3.5.1 Middleware de Autenticação (CRÍTICO!)

**Arquivo**: `backend/src/middleware/auth.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Extender Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Anexar user ao request
    req.user = user;
    next();
  } catch (error) {
    console.error('[Auth] Error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !profile || !profile.is_admin) {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }

    next();
  } catch (error) {
    console.error('[Auth] Admin check error:', error);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}
```

---

### 3.5.2 Validação de Input (Previne SQL Injection, crashes)

**Arquivo**: `backend/src/middleware/validation.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }
      next(error);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }
      next(error);
    }
  };
}
```

**Instalar dependência**:
```bash
npm install zod
```

---

### 3.5.3 Rate Limiter Dinâmico (Previne estouro de budget)

**Arquivo**: `backend/src/services/rateLimiter/DynamicRateLimiter.ts`

```typescript
import Bottleneck from 'bottleneck';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service key para bypass RLS
);

interface RateLimitConfig {
  provider: string;
  max_concurrent: number;
  min_time_ms: number;
  daily_quota?: number;
  monthly_quota?: number;
}

class DynamicRateLimiter {
  private limiters: Map<string, Bottleneck> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private lastRefresh: Date = new Date(0);

  async getLimiter(provider: string): Promise<Bottleneck> {
    // Refresh config a cada 5 minutos
    const now = new Date();
    if (now.getTime() - this.lastRefresh.getTime() > 5 * 60 * 1000) {
      await this.refreshConfigs();
    }

    if (!this.limiters.has(provider)) {
      await this.createLimiter(provider);
    }

    return this.limiters.get(provider)!;
  }

  private async refreshConfigs() {
    const { data, error } = await supabase
      .from('api_rate_limits')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('[RateLimiter] Failed to refresh configs:', error);
      return;
    }

    for (const config of data) {
      this.configs.set(config.provider, config);

      // Recriar limiter se config mudou
      if (this.limiters.has(config.provider)) {
        await this.limiters.get(config.provider)!.stop();
        this.limiters.delete(config.provider);
      }

      await this.createLimiter(config.provider);
    }

    this.lastRefresh = new Date();
    console.log('[RateLimiter] Configs refreshed:', data.length);
  }

  private async createLimiter(provider: string) {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`No rate limit config for provider: ${provider}`);
    }

    const limiter = new Bottleneck({
      maxConcurrent: config.max_concurrent,
      minTime: config.min_time_ms,
      reservoir: config.daily_quota || null,
      reservoirRefreshAmount: config.daily_quota || null,
      reservoirRefreshInterval: config.daily_quota ? 24 * 60 * 60 * 1000 : null,
    });

    limiter.on('depleted', () => {
      console.warn(`[RateLimiter] ${provider} quota depleted!`);
    });

    this.limiters.set(provider, limiter);
  }

  async schedule<T>(provider: string, fn: () => Promise<T>): Promise<T> {
    const limiter = await this.getLimiter(provider);
    return limiter.schedule(fn);
  }
}

export const rateLimiter = new DynamicRateLimiter();
```

**Instalar dependência**:
```bash
npm install bottleneck
```

**Integrar no Pipeline**:
```typescript
// backend/src/jobs/pipeline/scanPipeline.ts

import { rateLimiter } from '../../services/rateLimiter/DynamicRateLimiter';

// ANTES:
const searchResults = await searchProvider.search(query);

// DEPOIS:
const searchResults = await rateLimiter.schedule('google', () =>
  searchProvider.search(query)
);
```

---

### 3.5.4 Budget Tracker (Tracking automático de custos)

**Arquivo**: `backend/src/services/budget/BudgetTracker.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

class BudgetTracker {
  async trackCost(
    source: 'auto_scan' | 'manual_search',
    provider: 'google' | 'jina' | 'openai',
    costUsd: number,
    details: any = {}
  ) {
    await supabase.from('budget_tracking').insert({
      source,
      provider,
      cost_usd: costUsd,
      details
    });

    console.log(`[Budget] Tracked $${costUsd.toFixed(6)} for ${provider} (${source})`);
  }

  async getMonthlyTotal(): Promise<number> {
    const { data } = await supabase
      .from('budget_summary')
      .select('total_cost_usd')
      .eq('month', new Date().toISOString().slice(0, 7))
      .single();

    return data?.total_cost_usd || 0;
  }
}

export const budgetTracker = new BudgetTracker();
```

**Integrar no Pipeline**:
```typescript
// Após cada operação, trackear custos
await budgetTracker.trackCost('auto_scan', 'google', costs.google, {
  location_id: locationId,
  queries: searchResults.length
});

await budgetTracker.trackCost('auto_scan', 'jina', costs.jina, {
  fetches: afterFilter1.length
});

await budgetTracker.trackCost('auto_scan', 'openai', costs.openai, {
  gpt_calls: extractions.length
});
```

---

### 3.5.5 CORS Configuration

**Arquivo**: `backend/src/server.ts`

```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    process.env.ADMIN_URL || 'http://localhost:3001',
    'https://admin.netriosnews.com', // Produção
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Instalar dependência**:
```bash
npm install cors @types/cors
```

---

### 3.5.6 Logs Estruturados

**Arquivo**: `backend/src/utils/logger.ts`

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Substituir todos os console.log por logger
// console.log('[Pipeline] Starting...')
// → logger.info('[Pipeline] Starting...')
```

**Instalar dependência**:
```bash
npm install winston
```

---

### ✅ Critérios de Conclusão
- [ ] Middleware `requireAuth` e `requireAdmin` funcionando
- [ ] Validação com Zod em todos endpoints
- [ ] Rate limiter dinâmico implementado
- [ ] Budget tracker registrando custos automaticamente
- [ ] CORS configurado corretamente
- [ ] Logs estruturados com Winston
- [ ] Testes manuais: token inválido retorna 401, não-admin retorna 403

---

## 🚀 FASE 4: API REST & Push Notifications (2-3 dias)

### Objetivo
Criar endpoints para admin/app consumirem e sistema de notificações push

### 4.1 API Endpoints

`backend/src/routes/index.ts`
```typescript
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = express.Router();

// ========== PUBLIC ENDPOINTS ==========

router.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    worker: scanWorker.isRunning(),
    timestamp: new Date().toISOString()
  };

  const allHealthy = Object.values(checks).slice(0, 3).every(c => c === true);
  res.status(allHealthy ? 200 : 503).json(checks);
});

// ========== AUTHENTICATED ENDPOINTS ==========

// Feed de notícias (mobile app)
router.get('/news', requireAuth, async (req, res) => {
  const { cidade, offset = '0', limit = '100' } = req.query;

  const news = await db.query(`
    SELECT
      n.*,
      json_agg(json_build_object('url', ns.url, 'source', ns.source_name)) as sources
    FROM news n
    LEFT JOIN news_sources ns ON ns.news_id = n.id
    WHERE ($1::text IS NULL OR n.cidade = $1)
      AND n.active = true
    GROUP BY n.id
    ORDER BY n.created_at DESC
    OFFSET $2 LIMIT $3
  `, [cidade || null, parseInt(offset as string), parseInt(limit as string)]);

  res.json({
    news,
    has_more: news.length === parseInt(limit as string)
  });
});

// Registrar device token (push notifications)
router.post('/devices', requireAuth, async (req, res) => {
  const { token, platform } = req.body;
  const userId = req.user.id;

  await db.query(`
    INSERT INTO user_devices (user_id, device_token, platform, last_seen)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (device_token)
    DO UPDATE SET last_seen = NOW()
  `, [userId, token, platform]);

  res.json({ success: true });
});

// Busca histórica on-demand
router.post('/search', requireAuth, async (req, res) => {
  const { cidade, crime, dias } = req.body;
  const userId = req.user.id;

  // Criar hash dos params
  const paramsHash = crypto
    .createHash('md5')
    .update(JSON.stringify({ cidade, crime, dias }))
    .digest('hex');

  // Verificar cache
  const cached = await db.getSearchCache(paramsHash);
  if (cached && cached.status === 'completed') {
    return res.json({ search_id: cached.search_id, status: 'completed' });
  }

  // Criar nova busca
  const searchId = await db.createSearchCache(userId, { cidade, crime, dias }, paramsHash);

  // Enfileirar job
  await searchQueue.add('historical-search', {
    search_id: searchId,
    cidade,
    crime,
    dias
  });

  res.json({ search_id: searchId, status: 'processing' });
});

router.get('/search/:search_id/results', requireAuth, async (req, res) => {
  const { search_id } = req.params;
  const { offset = '0', limit = '100' } = req.query;

  const results = await db.getSearchResults(
    search_id,
    parseInt(offset as string),
    parseInt(limit as string)
  );

  res.json(results);
});

// ========== ADMIN ENDPOINTS ==========

// Localizações monitoradas
router.get('/locations', requireAuth, requireAdmin, async (req, res) => {
  const locations = await db.getLocationsHierarchy();
  res.json(locations);
});

router.post('/locations', requireAuth, requireAdmin, async (req, res) => {
  const { type, name, parent_id, mode, keywords, scan_frequency_hours } = req.body;

  const location = await db.insertLocation({
    type, name, parent_id, mode, keywords, scan_frequency_hours
  });

  res.json(location);
});

router.patch('/locations/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  await db.updateLocation(id, updates);
  res.json({ success: true });
});

// Usuários
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await db.getAllUsers();
  res.json(users);
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { email } = req.body;

  // Criar usuário no Supabase Auth
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: generateTempPassword()
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Enviar email com credenciais
  await sendWelcomeEmail(email, tempPassword);

  res.json({ success: true, user_id: data.user.id });
});

// Dashboard stats
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  const stats = await db.getDashboardStats();
  res.json(stats);
});

router.get('/logs/recent', requireAuth, requireAdmin, async (req, res) => {
  const logs = await db.getRecentLogs(50);
  res.json(logs);
});

// ========== SETTINGS ENDPOINTS (FASE 3.5) ==========

// Rate Limits (configurável)
router.get('/settings/rate-limits', requireAuth, requireAdmin, async (req, res) => {
  const { data } = await supabase
    .from('api_rate_limits')
    .select('*')
    .order('provider');

  res.json(data);
});

router.patch('/settings/rate-limits/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { max_concurrent, min_time_ms, daily_quota, monthly_quota } = req.body;

  const { data, error } = await supabase
    .from('api_rate_limits')
    .update({
      max_concurrent,
      min_time_ms,
      daily_quota,
      monthly_quota,
      updated_at: new Date().toISOString(),
      updated_by: req.user.id
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Budget Summary (read-only)
router.get('/settings/budget/summary', requireAuth, requireAdmin, async (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data } = await supabase
    .from('budget_summary')
    .select('*')
    .eq('month', currentMonth);

  // Agregar por source
  const summary = {
    auto_scans: data?.filter(d => d.source === 'auto_scan').reduce((sum, d) => sum + parseFloat(d.total_cost_usd), 0) || 0,
    manual_searches: data?.filter(d => d.source === 'manual_search').reduce((sum, d) => sum + parseFloat(d.total_cost_usd), 0) || 0,
    by_provider: {
      google: data?.filter(d => d.provider === 'google').reduce((sum, d) => sum + parseFloat(d.total_cost_usd), 0) || 0,
      jina: data?.filter(d => d.provider === 'jina').reduce((sum, d) => sum + parseFloat(d.total_cost_usd), 0) || 0,
      openai: data?.filter(d => d.provider === 'openai').reduce((sum, d) => sum + parseFloat(d.total_cost_usd), 0) || 0
    }
  };

  summary.total = summary.auto_scans + summary.manual_searches;

  res.json(summary);
});

router.get('/settings/budget/daily', requireAuth, requireAdmin, async (req, res) => {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data } = await supabase
    .from('budget_tracking')
    .select('created_at, cost_usd')
    .gte('created_at', `${currentMonth}-01`)
    .order('created_at');

  // Agrupar por dia
  const dailyMap = new Map();
  for (const row of data || []) {
    const date = row.created_at.slice(0, 10);
    const current = dailyMap.get(date) || 0;
    dailyMap.set(date, current + parseFloat(row.cost_usd));
  }

  const result = Array.from(dailyMap.entries()).map(([date, cost_usd]) => ({
    date,
    cost_usd: parseFloat(cost_usd.toFixed(6))
  }));

  res.json(result);
});

export default router;
```

### 4.2 Push Notifications (Firebase)

`backend/src/services/notifications/pushService.ts`
```typescript
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)
  )
});

export async function sendPushNotification(newsId: string, newsData: NewsExtraction) {
  // Buscar todos device tokens ativos (últimos 30 dias)
  const devices = await db.query(`
    SELECT device_token, platform
    FROM user_devices
    WHERE last_seen > NOW() - INTERVAL '30 days'
  `);

  if (devices.length === 0) {
    console.log('[Push] No active devices');
    return;
  }

  const title = `${newsData.tipo_crime} em ${newsData.cidade}${newsData.bairro ? ' - ' + newsData.bairro : ''}`;
  const body = newsData.resumo.substring(0, 100) + '...';

  const message = {
    notification: { title, body },
    data: {
      news_id: newsId,
      cidade: newsData.cidade,
      tipo_crime: newsData.tipo_crime
    }
  };

  // Firebase suporta até 500 tokens por batch
  const batches = chunkArray(devices.map(d => d.device_token), 500);

  for (const batch of batches) {
    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        ...message
      });

      console.log(`[Push] Sent: ${response.successCount}/${batch.length} succeeded`);

      // Remover tokens inválidos
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(batch[idx]);
          }
        });

        await db.removeInvalidTokens(failedTokens);
        console.log(`[Push] Removed ${failedTokens.length} invalid tokens`);
      }
    } catch (error) {
      console.error('[Push] Error:', error);
    }
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

### Integração no Pipeline

`backend/src/jobs/pipeline/scanPipeline.ts` (modificar seção 7)
```typescript
// 7. Save to database COM DEDUPLICAÇÃO + PUSH
for (const news of extractions) {
  const { isDuplicate, existingId } = await deduplicateNews(news, news.sourceUrl);

  if (!isDuplicate) {
    const newsId = await db.insertNews({...});
    await db.insertNewsSource(newsId, news.sourceUrl);

    // 🔔 ENVIAR PUSH NOTIFICATION
    await sendPushNotification(newsId, news);

    console.log(`[Pipeline] New article saved + push sent: ${newsId}`);
  }
}
```

### 4.3 Deploy no Render.com

`backend/render.yaml`
```yaml
services:
  - type: web
    name: netrios-news-backend
    env: node
    region: oregon
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DATABASE_URL
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: REDIS_URL
        sync: false
      - key: GOOGLE_SEARCH_API_KEY
        sync: false
      - key: GOOGLE_SEARCH_ENGINE_ID
        sync: false
      - key: JINA_API_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: FIREBASE_SERVICE_ACCOUNT
        sync: false
    healthCheckPath: /health
```

**Deploy**:
```bash
# 1. Commitar código
git add .
git commit -m "Backend ready for deploy"
git push origin main

# 2. No Render.com dashboard:
# - New → Web Service
# - Connect repository
# - Render detecta render.yaml automaticamente
# - Adicionar env vars manualmente
# - Deploy!
```

### ✅ Critérios de Conclusão
- [ ] API REST com todos endpoints funcionando
- [ ] Push notifications enviadas corretamente (testar com 2+ devices)
- [ ] Deploy no Render.com bem-sucedido
- [ ] Health check retornando 200
- [ ] Logs estruturados no Render dashboard
- [ ] Pipeline rodando 24/7 sem dormir

---

## 🎨 FASE 5: Admin Panel - Setup & Auth (1-2 dias)

### Objetivo
Criar projeto Next.js e implementar autenticação

### Tarefas

```bash
cd admin-panel
npx create-next-app@latest . --typescript --tailwind --app --eslint
npx shadcn-ui@latest init

# Instalar dependências
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install recharts date-fns
```

`admin-panel/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

`admin-panel/app/(auth)/login/page.tsx`
```tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      setError(authError.message);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center">Admin Panel</h2>
          <p className="mt-2 text-center text-gray-600">Netrios News</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
```

`admin-panel/middleware.ts` (proteger rotas)
```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Redirecionar para login se não autenticado
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*']
};
```

### Deploy Vercel

```bash
# 1. Commitar
git add .
git commit -m "Admin panel auth ready"
git push

# 2. No Vercel:
# - Import repository
# - Adicionar env vars:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   NEXT_PUBLIC_API_URL (backend Render URL)
# - Deploy!
```

### ✅ Critérios de Conclusão
- [ ] Next.js + shadcn/ui funcionando
- [ ] Login/logout OK
- [ ] Middleware protegendo rotas
- [ ] Deploy no Vercel funcionando

---

## 📊 FASE 6: Admin Panel - Features Completas (3-4 dias)

**Por questões de espaço, vou resumir - a implementação completa está no plano oficial**

### Features a Implementar

#### 6.1 Dashboard
- Métricas: notícias/mês, cidades ativas, custo, taxa de sucesso
- Gráfico de notícias por dia (últimos 30 dias)
- Logs em tempo real (atualiza a cada 5s)

#### 6.2 Configuração de Monitoramentos
- Lista hierárquica: Estado → Cidades
- Toggle on/off por cidade
- Editar keywords, frequência
- Indicador de última varredura

#### 6.3 Gestão de Usuários
- Criar usuário (gera senha temporária)
- Listar usuários (email, status, último acesso)
- Ativar/desativar usuário

#### 6.4 Configurações - Rate Limits

**Arquivo**: `admin-panel/app/(dashboard)/settings/rate-limits/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function RateLimitsPage() {
  const [limits, setLimits] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadLimits();
  }, []);

  const loadLimits = async () => {
    const data = await api.get('/settings/rate-limits');
    setLimits(data);
  };

  const providerNames = {
    google: 'Google Custom Search',
    jina: 'Jina AI Reader',
    openai: 'OpenAI (GPT + Embeddings)'
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Rate Limits</h1>
      <p className="text-gray-600 mb-8">
        Configure limites de requisições para cada API. Mudanças aplicam em até 5 minutos.
      </p>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-left font-semibold">Provider</th>
              <th className="p-4 text-left font-semibold">Max Concorrente</th>
              <th className="p-4 text-left font-semibold">Min Intervalo (ms)</th>
              <th className="p-4 text-left font-semibold">Quota Diária</th>
              <th className="p-4 text-left font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {limits.map(limit => (
              <tr key={limit.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">
                  {providerNames[limit.provider]}
                </td>
                <td className="p-4">
                  {editingId === limit.id ? (
                    <input
                      type="number"
                      defaultValue={limit.max_concurrent}
                      className="w-20 px-2 py-1 border rounded"
                      id={`concurrent-${limit.id}`}
                    />
                  ) : limit.max_concurrent}
                </td>
                <td className="p-4">
                  {editingId === limit.id ? (
                    <input
                      type="number"
                      defaultValue={limit.min_time_ms}
                      className="w-24 px-2 py-1 border rounded"
                      id={`mintime-${limit.id}`}
                    />
                  ) : limit.min_time_ms}
                </td>
                <td className="p-4">
                  {editingId === limit.id ? (
                    <input
                      type="number"
                      defaultValue={limit.daily_quota || ''}
                      placeholder="Ilimitado"
                      className="w-24 px-2 py-1 border rounded"
                      id={`daily-${limit.id}`}
                    />
                  ) : (limit.daily_quota || '—')}
                </td>
                <td className="p-4">
                  {editingId === limit.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await api.patch(`/settings/rate-limits/${limit.id}`, {
                            max_concurrent: parseInt(document.getElementById(`concurrent-${limit.id}`).value),
                            min_time_ms: parseInt(document.getElementById(`mintime-${limit.id}`).value),
                            daily_quota: document.getElementById(`daily-${limit.id}`).value || null
                          });
                          setEditingId(null);
                          loadLimits();
                        }}
                        className="text-green-600 hover:underline text-sm font-medium"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-600 hover:underline text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingId(limit.id)}
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">💡 Dicas:</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• <strong>Max Concorrente</strong>: Quantas requisições simultâneas permitidas</li>
          <li>• <strong>Min Intervalo</strong>: Tempo mínimo (ms) entre cada requisição</li>
          <li>• <strong>Quota Diária</strong>: Deixe vazio para ilimitado (cuidado com custos!)</li>
          <li>• Mudanças aplicam automaticamente em até 5 minutos</li>
        </ul>
      </div>
    </div>
  );
}
```

---

#### 6.5 Configurações - Budget Dashboard

**Arquivo**: `admin-panel/app/(dashboard)/settings/budget/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function BudgetPage() {
  const [summary, setSummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);

  useEffect(() => {
    loadBudgetData();
  }, []);

  const loadBudgetData = async () => {
    const [summaryData, daily] = await Promise.all([
      api.get('/settings/budget/summary'),
      api.get('/settings/budget/daily')
    ]);

    setSummary(summaryData);
    setDailyData(daily);
  };

  if (!summary) return <div>Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Budget Tracking</h1>
      <p className="text-gray-600 mb-8">
        Monitoramento de gastos com APIs externas (calculado automaticamente)
      </p>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Total do Mês</div>
          <div className="text-3xl font-bold text-blue-600">
            ${summary.total.toFixed(2)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Varreduras Automáticas</div>
          <div className="text-2xl font-bold">
            ${summary.auto_scans.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {((summary.auto_scans / summary.total) * 100).toFixed(0)}% do total
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Buscas Manuais (App)</div>
          <div className="text-2xl font-bold">
            ${summary.manual_searches.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {((summary.manual_searches / summary.total) * 100).toFixed(0)}% do total
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">Projeção (30 dias)</div>
          <div className="text-2xl font-bold text-orange-600">
            ${(summary.total * 1.5).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Estimativa baseada em uso atual
          </div>
        </div>
      </div>

      {/* Gasto por Provider */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Gasto por Provider</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded">
            <div className="text-sm text-gray-600">Google Search</div>
            <div className="text-2xl font-bold text-blue-600">
              ${summary.by_provider.google.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {((summary.by_provider.google / summary.total) * 100).toFixed(0)}% do total
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded">
            <div className="text-sm text-gray-600">Jina AI</div>
            <div className="text-2xl font-bold text-purple-600">
              ${summary.by_provider.jina.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {((summary.by_provider.jina / summary.total) * 100).toFixed(0)}% do total
            </div>
          </div>

          <div className="p-4 bg-green-50 rounded">
            <div className="text-sm text-gray-600">OpenAI</div>
            <div className="text-2xl font-bold text-green-600">
              ${summary.by_provider.openai.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {((summary.by_provider.openai / summary.total) * 100).toFixed(0)}% do total
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico Diário */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Gasto Diário</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => `$${value}`} />
            <Line type="monotone" dataKey="cost_usd" stroke="#3b82f6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-semibold mb-2">💰 Sobre o Budget:</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• Budget é <strong>calculado automaticamente</strong> baseado em uso real</li>
          <li>• <strong>Varreduras Automáticas</strong>: Custos de scans agendados por cidade</li>
          <li>• <strong>Buscas Manuais</strong>: Custos quando usuários fazem buscas no app</li>
          <li>• Para controlar custos, ajuste a <strong>frequência de varreduras</strong> em Monitoramentos</li>
        </ul>
      </div>
    </div>
  );
}
```

**Adicionar ao menu**:
```tsx
// admin-panel/app/(dashboard)/layout.tsx
<nav>
  ...
  <Link href="/dashboard">Dashboard</Link>
  <Link href="/locations">Monitoramentos</Link>
  <Link href="/users">Usuários</Link>
  <Link href="/settings/rate-limits">⚙️ Rate Limits</Link>
  <Link href="/settings/budget">💰 Budget</Link>
  <Link href="/feedback">Reportes</Link>
</nav>
```

---

### ✅ Critérios de Conclusão
- [ ] Dashboard com todas métricas
- [ ] CRUD de monitoramentos completo
- [ ] CRUD de usuários completo
- [ ] **Settings → Rate Limits funcionando**
- [ ] **Settings → Budget mostrando custos**
- [ ] UI responsiva e intuitiva
- [ ] Deploy atualizado no Vercel

---

---

### 6.5.1 Schema Adicional

```sql
-- Agregações pré-calculadas (performance)
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  cidade TEXT,
  tipo_crime TEXT,
  count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, cidade, tipo_crime)
);

CREATE INDEX idx_daily_stats_date ON daily_stats(date DESC);
CREATE INDEX idx_daily_stats_cidade ON daily_stats(cidade);
```

---

### 6.5.2 Backend - Endpoint de Analytics

**Arquivo**: `backend/src/routes/analytics.ts`

```typescript
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Tendências (semana atual vs anterior)
router.get('/analytics/trends', requireAuth, requireAdmin, async (req, res) => {
  const thisWeek = await db.query(`
    SELECT
      COUNT(*) as total,
      tipo_crime,
      COUNT(*) FILTER (WHERE tipo_crime = 'roubo') as roubos,
      COUNT(*) FILTER (WHERE tipo_crime = 'furto') as furtos,
      COUNT(*) FILTER (WHERE tipo_crime = 'homicídio') as homicidios
    FROM news
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY tipo_crime
  `);

  const lastWeek = await db.query(`
    SELECT
      COUNT(*) as total,
      tipo_crime
    FROM news
    WHERE created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
    GROUP BY tipo_crime
  `);

  const trend = calculateTrend(thisWeek.rows, lastWeek.rows);

  res.json({
    this_week: thisWeek.rows,
    last_week: lastWeek.rows,
    trend: trend // { total: "+15%", roubos: "+20%", furtos: "-10%" }
  });
});

// Breakdown por cidade
router.get('/analytics/by-city', requireAuth, requireAdmin, async (req, res) => {
  const { days = 30 } = req.query;

  const breakdown = await db.query(`
    SELECT
      cidade,
      COUNT(*) as total,
      json_object_agg(tipo_crime, count) as by_type
    FROM (
      SELECT cidade, tipo_crime, COUNT(*) as count
      FROM news
      WHERE created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY cidade, tipo_crime
    ) subq
    GROUP BY cidade
    ORDER BY total DESC
  `);

  res.json(breakdown.rows);
});

// Hotspots (bairros com mais crimes)
router.get('/analytics/hotspots', requireAuth, requireAdmin, async (req, res) => {
  const { cidade, days = 30 } = req.query;

  const hotspots = await db.query(`
    SELECT
      bairro,
      cidade,
      COUNT(*) as total,
      tipo_crime
    FROM news
    WHERE ($1::text IS NULL OR cidade = $1)
      AND bairro IS NOT NULL
      AND created_at >= NOW() - INTERVAL '${days} days'
    GROUP BY bairro, cidade, tipo_crime
    ORDER BY total DESC
    LIMIT 10
  `);

  res.json(hotspots.rows);
});

// Séries temporais (para gráficos)
router.get('/analytics/timeseries', requireAuth, requireAdmin, async (req, res) => {
  const { days = 30 } = req.query;

  const series = await db.query(`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE tipo_crime = 'roubo') as roubos,
      COUNT(*) FILTER (WHERE tipo_crime = 'homicídio') as homicidios
    FROM news
    WHERE created_at >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  res.json(series.rows);
});

function calculateTrend(thisWeek: any[], lastWeek: any[]) {
  const thisTotal = thisWeek.reduce((sum, r) => sum + parseInt(r.total), 0);
  const lastTotal = lastWeek.reduce((sum, r) => sum + parseInt(r.total), 0);

  const change = ((thisTotal - lastTotal) / lastTotal) * 100;

  return {
    total: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
    is_increasing: change > 0
  };
}

export default router;
```

---

### 6.5.3 Admin Panel - Dashboard de Relatórios

**Arquivo**: `admin-panel/app/(dashboard)/reports/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { api } from '@/lib/api';

export default function ReportsPage() {
  const [trends, setTrends] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any[]>([]);
  const [hotspots, setHotspots] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [trendsData, seriesData, hotspotsData] = await Promise.all([
      api.get('/analytics/trends'),
      api.get('/analytics/timeseries'),
      api.get('/analytics/hotspots'),
    ]);

    setTrends(trendsData);
    setTimeseries(seriesData);
    setHotspots(hotspotsData);
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Relatórios Executivos</h1>

      {/* Resumo Semanal */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Resumo Semanal</h2>
        {trends && (
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-4xl font-bold">
                {trends.this_week[0]?.total || 0}
              </div>
              <div className="text-gray-500">Total esta semana</div>
              <div className={`text-sm ${trends.trend.is_increasing ? 'text-red-600' : 'text-green-600'}`}>
                {trends.trend.total} vs semana anterior
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {trends.this_week.find(t => t.tipo_crime === 'roubo')?.count || 0}
              </div>
              <div className="text-gray-500">Roubos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {trends.this_week.find(t => t.tipo_crime === 'furto')?.count || 0}
              </div>
              <div className="text-gray-500">Furtos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-black">
                {trends.this_week.find(t => t.tipo_crime === 'homicídio')?.count || 0}
              </div>
              <div className="text-gray-500">Homicídios</div>
            </div>
          </div>
        )}
      </div>

      {/* Gráfico de Séries Temporais */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Evolução (Últimos 30 dias)</h2>
        <LineChart width={900} height={300} data={timeseries}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="total" stroke="#8884d8" name="Total" />
          <Line type="monotone" dataKey="roubos" stroke="#ef4444" name="Roubos" />
          <Line type="monotone" dataKey="homicidios" stroke="#000000" name="Homicídios" />
        </LineChart>
      </div>

      {/* Hotspots */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Top 10 Bairros com Mais Crimes</h2>
        <BarChart width={900} height={300} data={hotspots.slice(0, 10)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bairro" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="total" fill="#8884d8" />
        </BarChart>
      </div>

      {/* Botão de Export */}
      <div className="flex gap-4">
        <button
          onClick={() => exportPDF()}
          className="bg-blue-600 text-white px-6 py-2 rounded"
        >
          📄 Exportar PDF
        </button>
        <button
          onClick={() => scheduleEmail()}
          className="bg-green-600 text-white px-6 py-2 rounded"
        >
          📧 Agendar Email Semanal
        </button>
      </div>
    </div>
  );
}

async function exportPDF() {
  // TODO: Implementar com jsPDF ou Puppeteer
  alert('Gerando PDF...');
}

async function scheduleEmail() {
  await api.post('/analytics/schedule-email');
  alert('Email semanal agendado para segundas às 08:00!');
}
```

---

### 6.5.4 Email Semanal Automático

**Arquivo**: `backend/src/jobs/scheduler/reportsScheduler.ts`

```typescript
import cron from 'node-cron';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Toda segunda-feira às 08:00
export function startReportsScheduler() {
  cron.schedule('0 8 * * 1', async () => {
    console.log('[Reports] Gerando relatório semanal...');

    const report = await generateWeeklyReport();
    const admins = await db.getAdminEmails();

    for (const admin of admins) {
      await sendWeeklyReport(admin.email, report);
    }

    console.log(`[Reports] Enviado para ${admins.length} admins`);
  });
}

async function generateWeeklyReport() {
  const trends = await fetch(`${API_URL}/analytics/trends`).then(r => r.json());
  const hotspots = await fetch(`${API_URL}/analytics/hotspots`).then(r => r.json());

  return {
    total: trends.this_week[0]?.total || 0,
    trend: trends.trend.total,
    roubos: trends.this_week.find(t => t.tipo_crime === 'roubo')?.count || 0,
    homicidios: trends.this_week.find(t => t.tipo_crime === 'homicídio')?.count || 0,
    hotspots: hotspots.slice(0, 5),
  };
}

async function sendWeeklyReport(email: string, report: any) {
  const html = `
    <h1>📊 Relatório Semanal - Netrios News</h1>

    <h2>Resumo</h2>
    <ul>
      <li><strong>${report.total} crimes</strong> esta semana (${report.trend})</li>
      <li>🔴 ${report.roubos} roubos</li>
      <li>⚫ ${report.homicidios} homicídios</li>
    </ul>

    <h2>Top 5 Bairros Mais Perigosos</h2>
    <ol>
      ${report.hotspots.map(h => `<li>${h.bairro} (${h.total} crimes)</li>`).join('')}
    </ol>

    <p><a href="https://admin.netriosnews.com/reports">Ver relatório completo →</a></p>
  `;

  await transporter.sendMail({
    from: '"Netrios News" <no-reply@netriosnews.com>',
    to: email,
    subject: `📊 Relatório Semanal - ${report.total} crimes`,
    html,
  });
}
```

---

### ✅ Critérios de Conclusão - Fase 6.5

- [ ] Endpoints de analytics implementados
- [ ] Dashboard com gráficos funcionando (Recharts)
- [ ] Tendências (semana vs semana) calculadas
- [ ] Hotspots identificados corretamente
- [ ] Export PDF funcional
- [ ] Email semanal agendado e enviado
- [ ] UI responsiva e clara

---

## 📱 FASE 7: Mobile App - Setup & Auth (1-2 dias)

> **Nota**: FASE 6.5 (Relatórios Executivos) foi movida para Post-MVP

```bash
flutter create mobile_app
cd mobile_app
```

`pubspec.yaml`:
```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.0.0
  firebase_messaging: ^14.0.0
  sqflite: ^2.3.0
  provider: ^6.1.0
  http: ^1.0.0
  flutter_local_notifications: ^17.0.0
```

**Implementar**:
- AuthService (Supabase)
- LoginScreen
- Firebase setup (android/ios)

### ✅ Critérios de Conclusão
- [ ] Flutter rodando em emulador
- [ ] Login funcionando
- [ ] Firebase configurado

---

## 📰 FASE 8: Mobile App - Features Completas (3-4 dias)

**Features**:
- SQLite cache local
- Feed principal (scroll infinito)
- Filtros client-side (cidade, data, keyword)
- Push notifications
- Busca histórica on-demand

### ✅ Critérios de Conclusão
- [ ] Feed carregando do SQLite
- [ ] Sync com backend OK
- [ ] Push recebidas e exibidas
- [ ] Busca histórica funcional
- [ ] APK release testado

---

## 🎨 FASE 8.5: UX Avançada - Tabs + Cards + Swipe (2-3 dias)

### Objetivo
Implementar interface mobile moderna com navegação por tabs, cards interativos, swipe actions e sistema de notícias não lidas

**Por que fazer**: UX é diferencial competitivo. Interface intuitiva = mais engajamento.

---

### 8.5.1 Schema Adicional (Backend)

**Arquivo**: Execute no Supabase SQL Editor

```sql
-- Sistema de notícias não lidas
CREATE TABLE user_news_read (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, news_id)
);

CREATE INDEX idx_user_news_read ON user_news_read(user_id, news_id);
CREATE INDEX idx_user_news_read_user ON user_news_read(user_id);

-- Resumo agregado de múltiplas fontes
ALTER TABLE news ADD COLUMN IF NOT EXISTS resumo_agregado TEXT;

-- Favoritos
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  favorited_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, news_id)
);

CREATE INDEX idx_user_favorites ON user_favorites(user_id);
```

---

### 8.5.2 Endpoints Backend (API)

**Arquivo**: `backend/src/routes/index.ts` (adicionar)

```typescript
// Feed com contador de não lidas
router.get('/news/feed', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { offset = '0', limit = '50' } = req.query;

  const news = await db.query(`
    SELECT
      n.*,
      json_agg(DISTINCT jsonb_build_object(
        'url', ns.url,
        'source', ns.source_name
      )) as sources,
      CASE WHEN unr.news_id IS NULL THEN true ELSE false END as is_unread,
      CASE WHEN uf.news_id IS NOT NULL THEN true ELSE false END as is_favorite
    FROM news n
    LEFT JOIN news_sources ns ON ns.news_id = n.id
    LEFT JOIN user_news_read unr ON unr.news_id = n.id AND unr.user_id = $1
    LEFT JOIN user_favorites uf ON uf.news_id = n.id AND uf.user_id = $1
    WHERE n.active = true
    GROUP BY n.id, unr.news_id, uf.news_id
    ORDER BY n.created_at DESC
    OFFSET $2 LIMIT $3
  `, [userId, parseInt(offset as string), parseInt(limit as string)]);

  res.json({
    news,
    has_more: news.length === parseInt(limit as string)
  });
});

// Marcar como lida
router.post('/news/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await db.query(`
    INSERT INTO user_news_read (user_id, news_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, news_id) DO NOTHING
  `, [userId, id]);

  res.json({ success: true });
});

// Favoritar/desfavoritar
router.post('/news/:id/favorite', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await db.query(`
    INSERT INTO user_favorites (user_id, news_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, news_id) DO NOTHING
  `, [userId, id]);

  res.json({ success: true });
});

router.delete('/news/:id/favorite', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await db.query(`
    DELETE FROM user_favorites
    WHERE user_id = $1 AND news_id = $2
  `, [userId, id]);

  res.json({ success: true });
});

// Contador de não lidas
router.get('/news/unread-count', requireAuth, async (req, res) => {
  const userId = req.user.id;

  const result = await db.query(`
    SELECT COUNT(*) as count
    FROM news n
    LEFT JOIN user_news_read unr ON unr.news_id = n.id AND unr.user_id = $1
    WHERE n.active = true AND unr.news_id IS NULL
  `, [userId]);

  res.json({ count: parseInt(result.rows[0].count) });
});
```

---

### 8.5.3 Implementação Flutter - Tab Navigation

**Arquivo**: `mobile-app/lib/features/feed/presentation/main_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'feed_tab.dart';
import 'favorites_tab.dart';
import 'search_tab.dart';

class MainScreen extends StatefulWidget {
  @override
  _MainScreenState createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  final List<Widget> _tabs = [
    FeedTab(),      // Tab 0: Feed principal
    FavoritesTab(), // Tab 1: Favoritos
    SearchTab(),    // Tab 2: Busca
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _tabs,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: [
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Feed',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.favorite),
            label: 'Favoritos',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.search),
            label: 'Busca',
          ),
        ],
      ),
    );
  }
}
```

---

### 8.5.4 Feed Tab com Cards + Swipe Actions

**Arquivo**: `mobile-app/lib/features/feed/presentation/feed_tab.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import '../../../core/services/api_service.dart';
import '../models/news_item.dart';

class FeedTab extends StatefulWidget {
  @override
  _FeedTabState createState() => _FeedTabState();
}

class _FeedTabState extends State<FeedTab> {
  List<NewsItem> _news = [];
  bool _isLoading = false;
  int _offset = 0;
  final int _limit = 20;

  @override
  void initState() {
    super.initState();
    _loadNews();
  }

  Future<void> _loadNews({bool refresh = false}) async {
    if (_isLoading) return;

    setState(() => _isLoading = true);

    if (refresh) _offset = 0;

    final newNews = await ApiService().getNewsFeed(offset: _offset, limit: _limit);

    setState(() {
      if (refresh) {
        _news = newNews;
      } else {
        _news.addAll(newNews);
      }
      _offset += _limit;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Feed'),
        actions: [
          // Badge de não lidas
          FutureBuilder<int>(
            future: ApiService().getUnreadCount(),
            builder: (context, snapshot) {
              if (snapshot.hasData && snapshot.data! > 0) {
                return Stack(
                  children: [
                    IconButton(
                      icon: Icon(Icons.notifications),
                      onPressed: () {},
                    ),
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        padding: EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        constraints: BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          '${snapshot.data}',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                  ],
                );
              }
              return SizedBox.shrink();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _loadNews(refresh: true),
        child: ListView.builder(
          itemCount: _news.length + 1,
          itemBuilder: (context, index) {
            if (index == _news.length) {
              return _isLoading
                  ? Center(child: CircularProgressIndicator())
                  : TextButton(
                      onPressed: _loadNews,
                      child: Text('Carregar mais'),
                    );
            }

            final news = _news[index];
            return NewsCard(
              news: news,
              onRead: () => _markAsRead(news.id),
              onFavorite: () => _toggleFavorite(news),
            );
          },
        ),
      ),
    );
  }

  Future<void> _markAsRead(String newsId) async {
    await ApiService().markAsRead(newsId);
    setState(() {
      final index = _news.indexWhere((n) => n.id == newsId);
      if (index != -1) {
        _news[index].isUnread = false;
      }
    });
  }

  Future<void> _toggleFavorite(NewsItem news) async {
    if (news.isFavorite) {
      await ApiService().unfavorite(news.id);
    } else {
      await ApiService().favorite(news.id);
    }

    setState(() {
      final index = _news.indexWhere((n) => n.id == news.id);
      if (index != -1) {
        _news[index].isFavorite = !_news[index].isFavorite;
      }
    });
  }
}
```

---

### 8.5.5 News Card com Swipe Actions

**Arquivo**: `mobile-app/lib/features/feed/widgets/news_card.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import '../models/news_item.dart';
import 'news_detail_bottom_sheet.dart';

class NewsCard extends StatelessWidget {
  final NewsItem news;
  final VoidCallback onRead;
  final VoidCallback onFavorite;

  const NewsCard({
    required this.news,
    required this.onRead,
    required this.onFavorite,
  });

  @override
  Widget build(BuildContext context) {
    return Slidable(
      // Swipe esquerda: marcar como lida
      endActionPane: ActionPane(
        motion: ScrollMotion(),
        children: [
          SlidableAction(
            onPressed: (_) => onRead(),
            backgroundColor: Colors.grey,
            foregroundColor: Colors.white,
            icon: Icons.check,
            label: 'Lida',
          ),
        ],
      ),
      // Swipe direita: favoritar
      startActionPane: ActionPane(
        motion: ScrollMotion(),
        children: [
          SlidableAction(
            onPressed: (_) => onFavorite(),
            backgroundColor: news.isFavorite ? Colors.grey : Colors.amber,
            foregroundColor: Colors.white,
            icon: news.isFavorite ? Icons.favorite : Icons.favorite_border,
            label: news.isFavorite ? 'Remover' : 'Favoritar',
          ),
        ],
      ),
      child: Card(
        margin: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        elevation: news.isUnread ? 4 : 1,
        child: InkWell(
          onTap: () => _showDetails(context),
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  children: [
                    _getCrimeIcon(news.tipoCrime),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        news.tipoCrime.toUpperCase(),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: _getCrimeColor(news.tipoCrime),
                        ),
                      ),
                    ),
                    if (news.isUnread)
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          'NOVA',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    if (news.isFavorite)
                      Icon(Icons.favorite, color: Colors.amber, size: 16),
                  ],
                ),
                SizedBox(height: 8),
                // Resumo
                Text(
                  news.resumoAgregado ?? news.resumo,
                  style: TextStyle(fontSize: 14),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: 8),
                // Metadados
                Row(
                  children: [
                    Icon(Icons.location_on, size: 14, color: Colors.grey),
                    SizedBox(width: 4),
                    Text(
                      '${news.cidade}${news.bairro != null ? " · ${news.bairro}" : ""}',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                    Spacer(),
                    Icon(Icons.access_time, size: 14, color: Colors.grey),
                    SizedBox(width: 4),
                    Text(
                      _formatTime(news.createdAt),
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ],
                ),
                SizedBox(height: 4),
                Text(
                  '${news.sources.length} fonte(s)',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showDetails(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => NewsDetailBottomSheet(news: news),
    );
  }

  Icon _getCrimeIcon(String tipo) {
    switch (tipo.toLowerCase()) {
      case 'roubo':
      case 'assalto':
        return Icon(Icons.warning, color: Colors.red);
      case 'homicídio':
      case 'assassinato':
        return Icon(Icons.dangerous, color: Colors.black);
      case 'furto':
        return Icon(Icons.remove_circle, color: Colors.orange);
      case 'tráfico':
        return Icon(Icons.local_pharmacy, color: Colors.blue);
      default:
        return Icon(Icons.info, color: Colors.grey);
    }
  }

  Color _getCrimeColor(String tipo) {
    switch (tipo.toLowerCase()) {
      case 'roubo':
      case 'assalto':
        return Colors.red;
      case 'homicídio':
      case 'assassinato':
        return Colors.black;
      case 'furto':
        return Colors.orange;
      case 'tráfico':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  String _formatTime(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}min atrás';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h atrás';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d atrás';
    } else {
      return '${date.day}/${date.month}';
    }
  }
}
```

---

### 8.5.6 Bottom Sheet de Detalhes

**Arquivo**: `mobile-app/lib/features/feed/widgets/news_detail_bottom_sheet.dart`

```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/news_item.dart';

class NewsDetailBottomSheet extends StatelessWidget {
  final NewsItem news;

  const NewsDetailBottomSheet({required this.news});

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(20),
              topRight: Radius.circular(20),
            ),
          ),
          child: Column(
            children: [
              // Handle
              Container(
                margin: EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Conteúdo
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: EdgeInsets.all(24),
                  children: [
                    // Título
                    Text(
                      news.tipoCrime.toUpperCase(),
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: _getCrimeColor(news.tipoCrime),
                      ),
                    ),
                    SizedBox(height: 8),
                    // Localização e data
                    Row(
                      children: [
                        Icon(Icons.location_on, size: 16, color: Colors.grey),
                        SizedBox(width: 4),
                        Text(
                          '${news.cidade}${news.bairro != null ? " · ${news.bairro}" : ""}',
                          style: TextStyle(color: Colors.grey),
                        ),
                        SizedBox(width: 16),
                        Icon(Icons.calendar_today, size: 16, color: Colors.grey),
                        SizedBox(width: 4),
                        Text(
                          _formatDate(news.dataOcorrencia),
                          style: TextStyle(color: Colors.grey),
                        ),
                      ],
                    ),
                    SizedBox(height: 24),
                    // Resumo agregado
                    Text(
                      news.resumoAgregado ?? news.resumo,
                      style: TextStyle(fontSize: 16, height: 1.5),
                    ),
                    SizedBox(height: 32),
                    // Fontes
                    Text(
                      'Fontes (${news.sources.length}):',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 16),
                    ...news.sources.map((source) => _buildSourceCard(source)),
                    SizedBox(height: 32),
                    // Ações
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              // TODO: Ver no mapa
                            },
                            icon: Icon(Icons.map),
                            label: Text('Ver no Mapa'),
                          ),
                        ),
                        SizedBox(width: 16),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () {
                              // TODO: Compartilhar
                            },
                            icon: Icon(Icons.share),
                            label: Text('Compartilhar'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildSourceCard(Map<String, dynamic> source) {
    return Card(
      margin: EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(Icons.article, color: Colors.blue),
        title: Text(source['source'] ?? 'Fonte'),
        trailing: Icon(Icons.open_in_new, size: 16),
        onTap: () => _launchURL(source['url']),
      ),
    );
  }

  Future<void> _launchURL(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Color _getCrimeColor(String tipo) {
    switch (tipo.toLowerCase()) {
      case 'roubo':
      case 'assalto':
        return Colors.red;
      case 'homicídio':
      case 'assassinato':
        return Colors.black;
      case 'furto':
        return Colors.orange;
      case 'tráfico':
        return Colors.blue;
      default:
        return Colors.grey;
    }
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}
```

---

### 8.5.7 Dependências Flutter

**Arquivo**: `mobile-app/pubspec.yaml` (adicionar)

```yaml
dependencies:
  flutter_slidable: ^3.0.0      # Swipe actions
  url_launcher: ^6.2.0          # Abrir URLs
```

Instalar:
```bash
cd mobile-app
flutter pub get
```

---

### 8.5.8 Deep Linking (Push → Notícia)

**Modificar**: `mobile-app/lib/core/services/notification_service.dart`

```dart
void _handleNotificationTap(NotificationResponse response) {
  if (response.payload != null) {
    final data = json.decode(response.payload!);
    final newsId = data['news_id'];

    // Navegar para notícia específica
    navigatorKey.currentState?.push(
      MaterialPageRoute(
        builder: (context) => NewsDetailScreen(newsId: newsId),
      ),
    );
  }
}
```

**Arquivo**: `mobile-app/lib/features/feed/presentation/news_detail_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../../../core/services/api_service.dart';
import '../models/news_item.dart';
import '../widgets/news_detail_bottom_sheet.dart';

class NewsDetailScreen extends StatelessWidget {
  final String newsId;

  const NewsDetailScreen({required this.newsId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Detalhes')),
      body: FutureBuilder<NewsItem>(
        future: ApiService().getNewsDetail(newsId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(child: Text('Erro ao carregar notícia'));
          }

          return NewsDetailBottomSheet(news: snapshot.data!);
        },
      ),
    );
  }
}
```

---

### ✅ Critérios de Conclusão - Fase 8.5

- [ ] Tab navigation implementada (Feed, Favoritos, Busca)
- [ ] Cards com swipe actions funcionando
- [ ] Sistema de não lidas (badges) operacional
- [ ] Bottom sheet de detalhes implementado
- [ ] Deep linking de push notifications funcional
- [ ] Ícones por tipo de crime
- [ ] Formatação de tempo relativo (2h atrás, 3d atrás)
- [ ] Links externos abrindo corretamente
- [ ] UI responsiva e fluida (60 FPS)

---

### 🎨 Resultado Visual

```
┌─────────────────────────────────────┐
│  Feed                        🔔 3   │
├─────────────────────────────────────┤
│                                     │
│  🔴 ROUBO                   [NOVA]  │ ← Swipe →
│  Dupla armada assalta farmácia...  │   Marcar lida
│  📍 Curitiba · Batel                │
│  🕐 2h atrás · 3 fontes             │
│                                     │
│  ⚫ HOMICÍDIO                    ⭐  │ ← Swipe ←
│  Corpo encontrado em residência... │   Favoritar
│  📍 São Paulo · Mooca               │
│  🕐 1d atrás · 4 fontes             │
│                                     │
│  🔵 TRÁFICO                         │
│  PM apreende 50kg de drogas...     │
│  📍 Curitiba · Centro               │
│  🕐 3d atrás · 1 fonte              │
│                                     │
└─────────────────────────────────────┘
  [Feed] [Favoritos] [Busca]
```

**Tempo de implementação**: 2-3 dias
**Impacto na UX**: 🚀🚀🚀🚀🚀 (game changer!)

---

## 🚩 FASE 8.6: Sistema de Report de Erros (1 dia)

### Objetivo
Permitir que usuários reportem erros e admin corrija manualmente no painel

**Por que fazer**: GPT erra ~5% dos casos. Com feedback dos usuários, admin identifica e corrige rapidamente.

---

### 8.6.1 Schema Adicional (SIMPLES!)

```sql
-- Reportes de erro de usuários
CREATE TABLE news_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES user_profiles(id),
  report_type TEXT CHECK (report_type IN ('wrong_city', 'wrong_type', 'wrong_date', 'not_crime', 'other')),
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'corrected', 'dismissed')) DEFAULT 'pending',
  reported_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_reports_status ON news_reports(status);
CREATE INDEX idx_news_reports_news ON news_reports(news_id);
```

**Só isso!** Sem tabelas de aprendizado, sem complexidade.

---

### 8.6.2 Backend - Endpoints Simples

**Arquivo**: `backend/src/routes/feedback.ts`

```typescript
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Reportar erro (mobile app)
router.post('/news/:id/report', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { report_type, description } = req.body;
  const userId = req.user.id;

  await db.query(`
    INSERT INTO news_reports (news_id, reported_by, report_type, description)
    VALUES ($1, $2, $3, $4)
  `, [id, userId, report_type, description]);

  res.json({ success: true, message: 'Obrigado pelo feedback!' });
});

// Listar reportes pendentes (admin)
router.get('/feedback/reports', requireAuth, requireAdmin, async (req, res) => {
  const reports = await db.query(`
    SELECT
      nr.*,
      n.id as news_id,
      n.resumo,
      n.cidade,
      n.tipo_crime,
      n.bairro,
      n.data_ocorrencia,
      u.email as reporter_email
    FROM news_reports nr
    JOIN news n ON n.id = nr.news_id
    JOIN user_profiles u ON u.id = nr.reported_by
    WHERE nr.status = 'pending'
    ORDER BY nr.reported_at DESC
  `);

  res.json(reports.rows);
});

// Marcar como corrigido (simples!)
router.patch('/feedback/:report_id', requireAuth, requireAdmin, async (req, res) => {
  const { report_id } = req.params;
  const { status } = req.body; // 'corrected' ou 'dismissed'

  await db.query(`
    UPDATE news_reports
    SET status = $1
    WHERE id = $2
  `, [status, report_id]);

  res.json({ success: true });
});

// Admin pode editar notícia direto (fora do sistema de reports)
router.patch('/news/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { cidade, tipo_crime, bairro, data_ocorrencia } = req.body;

  await db.query(`
    UPDATE news
    SET
      cidade = COALESCE($1, cidade),
      tipo_crime = COALESCE($2, tipo_crime),
      bairro = COALESCE($3, bairro),
      data_ocorrencia = COALESCE($4, data_ocorrencia)
    WHERE id = $5
  `, [cidade, tipo_crime, bairro, data_ocorrencia, id]);

  res.json({ success: true });
});

export default router;
```

**Só isso! Simples e direto.** ✅

---

### 8.6.3 Mobile App - Botão de Report

**Modificar**: `mobile-app/lib/features/feed/widgets/news_detail_bottom_sheet.dart`

```dart
// Adicionar ao AppBar ou na lista de ações
IconButton(
  icon: Icon(Icons.flag, color: Colors.orange),
  onPressed: () => _showReportDialog(context),
)

// Dialog de report
void _showReportDialog(BuildContext context) {
  String? selectedType;
  final descriptionController = TextEditingController();

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Reportar Erro'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<String>(
            decoration: InputDecoration(labelText: 'Tipo de erro'),
            items: [
              DropdownMenuItem(value: 'wrong_city', child: Text('Cidade errada')),
              DropdownMenuItem(value: 'wrong_type', child: Text('Tipo de crime errado')),
              DropdownMenuItem(value: 'wrong_date', child: Text('Data incorreta')),
              DropdownMenuItem(value: 'not_crime', child: Text('Não é crime')),
              DropdownMenuItem(value: 'other', child: Text('Outro')),
            ],
            onChanged: (value) => selectedType = value,
          ),
          SizedBox(height: 16),
          TextField(
            controller: descriptionController,
            decoration: InputDecoration(
              labelText: 'Descrição (opcional)',
              hintText: 'Ex: É Colombo, não Curitiba',
            ),
            maxLines: 3,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () async {
            if (selectedType == null) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Selecione o tipo de erro')),
              );
              return;
            }

            await ApiService().reportNews(
              news.id,
              selectedType!,
              descriptionController.text,
            );

            Navigator.pop(context);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Obrigado! Erro reportado.')),
            );
          },
          child: Text('Enviar'),
        ),
      ],
    ),
  );
}
```

**Arquivo**: `mobile-app/lib/core/services/api_service.dart` (adicionar)

```dart
Future<void> reportNews(String newsId, String reportType, String description) async {
  await http.post(
    Uri.parse('$baseUrl/news/$newsId/report'),
    headers: {'Authorization': 'Bearer $token'},
    body: json.encode({
      'report_type': reportType,
      'description': description,
    }),
  );
}
```

---

### 8.6.4 Admin Panel - Lista Simples de Reports

**Arquivo**: `admin-panel/app/(dashboard)/feedback/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function FeedbackPage() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const data = await api.get('/feedback/reports');
    setReports(data);
  };

  const markAs = async (reportId, status) => {
    await api.patch(`/feedback/${reportId}`, { status });
    loadReports();
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">
        Reportes de Usuários ({reports.length})
      </h1>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="border-b">
            <tr>
              <th className="p-4 text-left">Tipo</th>
              <th className="p-4 text-left">Notícia</th>
              <th className="p-4 text-left">Descrição</th>
              <th className="p-4 text-left">Reportado por</th>
              <th className="p-4 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(report => (
              <tr key={report.id} className="border-b hover:bg-gray-50">
                <td className="p-4">
                  <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm">
                    {report.report_type}
                  </span>
                </td>
                <td className="p-4">
                  <div className="font-semibold">{report.resumo.substring(0, 60)}...</div>
                  <div className="text-sm text-gray-500">
                    {report.cidade} · {report.tipo_crime}
                  </div>
                </td>
                <td className="p-4 text-sm">{report.description || '-'}</td>
                <td className="p-4 text-sm">{report.reporter_email}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <a
                      href={`/news/${report.news_id}/edit`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Editar
                    </a>
                    <button
                      onClick={() => markAs(report.id, 'corrected')}
                      className="text-green-600 hover:underline text-sm"
                    >
                      Marcar OK
                    </button>
                    <button
                      onClick={() => markAs(report.id, 'dismissed')}
                      className="text-gray-600 hover:underline text-sm"
                    >
                      Ignorar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Simples!** Admin vê reports, clica "Editar" (vai pra tela de edição de notícia), corrige, e marca como OK.

---

### ✅ Critérios de Conclusão - Fase 8.6

- [ ] Botão "Reportar" implementado no app
- [ ] Endpoint de report funcionando
- [ ] Admin panel lista reports
- [ ] Admin pode marcar como "corrigido" ou "ignorado"
- [ ] Admin pode editar notícia corrigindo dados

**Tempo**: 1 dia (SIMPLES!)
**Impacto**: 🚩🚩🚩 (feedback básico funcional)

---

## 🔧 FASE 8.7: Features Complementares (2-3 dias)

### Objetivo
Adicionar 5 features complementares: frequência granular de scans, filtros avançados no app, busca manual individual, toggle de autenticação e calculadora de custos.

### Conceitos-chave
- **Scan automático** = UNIVERSAL (todos veem, com push). Dados na tabela `news`.
- **Busca manual** = INDIVIDUAL (só quem buscou vê). Dados em `search_cache`/`search_results`.
- **Filtro** = buscar em notícias universais já existentes (grátis, instantâneo).
- **Busca** = disparar NOVO pipeline Google Search (custa dinheiro, demora, por usuário).

---

### 📋 Auditoria: O que JÁ EXISTE e será REUTILIZADO

| Componente | Arquivo | Status | Detalhe |
|---|---|---|---|
| `search_cache` tabela | schema.sql:98-107 | ✅ Pronta | Já tem `user_id`, `params_hash`, TTL 24h, campo `status` |
| `search_results` tabela | schema.sql:109-114 | ✅ Pronta | Resultados paginados em JSONB |
| `budget_tracking.source` | schema.sql:161 | ✅ Pronta | Já aceita `'manual_search'` como source |
| Dashboard budget separado | settingsRoutes.ts:91-137 | ✅ Pronto | Já separa autoScans vs manualSearches |
| `searchNews()` backend | queries.ts:225-265 | ✅ Pronta | Já aceita `cidade`, `dateFrom`, `dateTo` - Flutter não usa |
| `POST /search` rota | newsRoutes.ts:41-64 | ✅ Pronta | Já recebe todos os filtros - Flutter só manda `query` |
| `enqueueScan()` | cronScheduler.ts:81-96 | ✅ Pronta | Enfileira job manual |
| `executePipeline()` | scanPipeline.ts:29-262 | ✅ Adaptável | Core reutilizável, acoplado a locationId |
| `ConfigManager` | configManager/index.ts | ✅ Pronto | 12 configs, cache 5min, métodos get/set |
| `trackCost()` | queries.ts:163-178 | ✅ Pronta | Aceita `source: 'manual_search'` |
| `calculateCost()` | scanPipeline.ts:283-297 | ✅ Pronta | Custos por etapa hardcoded |

---

### 8.7.1 Frequência Granular de Scans (hours → minutes)

**Problema**: `scan_frequency_hours` (INTEGER, min 1h) não suporta "5x por hora" ou "a cada 12 minutos".

**Solução**: Renomear coluna + ajustar 7 arquivos. Suportar linguagem natural ("5x/hora") E intervalo ("a cada 12 min").

#### Migração SQL
```sql
ALTER TABLE monitored_locations
  RENAME COLUMN scan_frequency_hours TO scan_frequency_minutes;
ALTER TABLE monitored_locations
  ALTER COLUMN scan_frequency_minutes SET DEFAULT 60;
-- Converter valores existentes: 1h→60, 2h→120, etc.
UPDATE monitored_locations SET scan_frequency_minutes = scan_frequency_minutes * 60;
```

#### Arquivos a ajustar (JÁ EXISTEM, só mudar nome do campo)

| Arquivo | Mudança |
|---|---|
| `backend/src/database/schema.sql` (linha 62) | `scan_frequency_hours` → `scan_frequency_minutes DEFAULT 60` |
| `backend/src/middleware/validation.ts` (linhas 75, 82) | `scan_frequency_hours` → `scan_frequency_minutes`, min(5), max(1440) |
| `backend/src/database/queries.ts` | `insertLocation`, `updateLocation`, `getActiveLocations` |
| `backend/src/jobs/scheduler/cronScheduler.ts` (linhas 41-45) | Cálculo hours→minutes, CRON `*/5 * * * *` |
| `backend/src/services/configManager/index.ts` (linha 28) | Default `scan_cron_schedule: '*/5 * * * *'` |
| `admin-panel/src/lib/api.ts` (linhas 57, 169, 182) | `MonitoredLocation`, `createLocation`, `updateLocation` |
| `admin-panel/src/app/(dashboard)/dashboard/locations/page.tsx` | Select com opções granulares |

#### Opções do Select (admin panel)
```
12 min  → "5x por hora (12 min)"
15 min  → "4x por hora (15 min)"
20 min  → "3x por hora (20 min)"
30 min  → "2x por hora (30 min)"
60 min  → "A cada 1 hora"
120 min → "A cada 2 horas"
240 min → "A cada 4 horas"
360 min → "A cada 6 horas"
720 min → "A cada 12 horas"
1440 min → "A cada 24 horas"
```

---

### 8.7.2 Toggle de Autenticação

**Problema**: App sempre exige login. Admin quer controlar se auth é obrigatório.

**Solução**: 2 configs novas no `system_config` + middleware condicional + check no Flutter.

#### O que JÁ EXISTE
- `system_config` tabela (schema.sql:188-211) - só adicionar 2 INSERTs
- `ConfigManager` (configManager/index.ts) - só adicionar 2 defaults
- `requireAuth` middleware (auth.ts:27-58) - base para `conditionalAuth`

#### Novos INSERTs no schema.sql
```sql
INSERT INTO system_config (key, value, description, category, value_type) VALUES
  ('auth_required', 'true', 'Se o app exige login para acessar', 'auth', 'boolean'),
  ('search_permission', 'authorized', 'Quem pode fazer buscas manuais: all ou authorized', 'auth', 'string');
```

#### Novos defaults no ConfigManager
```typescript
auth_required: 'true',
search_permission: 'authorized',
```

#### Novo middleware em auth.ts
```typescript
// conditionalAuth: se auth_required=true → requireAuth normal. Se false → passa sem auth.
export async function conditionalAuth(req, res, next) {
  const authRequired = await configManager.getBoolean('auth_required');
  if (!authRequired) { next(); return; }
  return requireAuth(req, res, next);
}

// requireSearchPermission: se search_permission=authorized → requireAuth. Se 'all' → passa.
export async function requireSearchPermission(req, res, next) {
  const perm = await configManager.get('search_permission');
  if (perm === 'all') { next(); return; }
  return requireAuth(req, res, next);
}
```

#### Novo endpoint público em settingsRoutes.ts
```typescript
// GET /settings/auth-config (SEM auth - público)
router.get('/settings/auth-config', async (req, res) => {
  const authRequired = await configManager.getBoolean('auth_required');
  const searchPermission = await configManager.get('search_permission');
  res.json({ authRequired, searchPermission });
});
```

#### Ajustes nas rotas existentes
- `newsRoutes.ts`: GET /news, GET /news/feed, POST /search → `conditionalAuth` em vez de `requireAuth`
- Endpoints de escrita (mark read, favorite): manter `requireAuth`
- Busca manual (POST /manual-search): usar `requireSearchPermission`

#### Flutter - AuthGate (main.dart)
- Chamar `GET /settings/auth-config` ao iniciar
- Se `authRequired=false` → ir direto para MainScreen sem login
- Se `authRequired=true` → manter flow atual (LoginScreen)

---

### 8.7.3 Filtro Avançado no Flutter (busca em notícias universais)

**Problema**: SearchScreen só envia `query` texto. Backend JÁ aceita `cidade`, `dateFrom`, `dateTo` mas Flutter não usa.

**Solução**: Expandir UI da SearchScreen com filtros + enviar params que backend JÁ suporta.

#### O que JÁ EXISTE e NÃO precisa mudar
- `POST /search` rota (newsRoutes.ts:41-64) ✅
- `searchNews()` queries.ts (aceita cidade, dateFrom, dateTo) ✅
- `schemas.manualSearch` validation (aceita cidade, dateFrom, dateTo) ✅

#### O que precisa de AJUSTE MÍNIMO
| Arquivo | Mudança |
|---|---|
| `backend/src/middleware/validation.ts` | Adicionar `tipoCrime` ao schema `manualSearch` |
| `backend/src/database/queries.ts` | Adicionar filtro `tipo_crime ILIKE` em `searchNews()` |
| `backend/src/routes/newsRoutes.ts` | Passar `tipoCrime` para `db.searchNews()` |
| `mobile-app/lib/core/services/api_service.dart` | Expandir `searchNews()` para enviar cidade, dateFrom, dateTo, tipoCrime |
| `mobile-app/lib/features/search/screens/search_screen.dart` | Adicionar dropdowns de filtro na UI |

#### Flutter API - NÃO existe, precisa criar
```dart
// api_service.dart - Novo método para buscar localizações (necessário para dropdown de cidades)
Future<List<Map<String, dynamic>>> getLocations() async {
  final res = await http.get(Uri.parse('$_baseUrl/locations'), headers: _headers);
  _checkResponse(res);
  return (jsonDecode(res.body) as List<dynamic>).cast<Map<String, dynamic>>();
}
```

#### Flutter SearchScreen - UI expandida
- Manter campo texto (query)
- Adicionar: Dropdown cidade (vem de `/locations`), Dropdown tipo crime (hardcoded: Roubo, Assalto, Furto, Homicídio, Tráfico, Todos), Seletor de período (7d, 30d, 60d, customizado)
- Resultados: reusar `NewsCard` existente

---

### 8.7.4 Busca Manual Individual (dispara novo pipeline)

**Problema**: Não existe busca que dispara Google Search sob demanda, por usuário individual.

**Solução**: Novo worker + rotas + tela Flutter. Reutiliza pipeline existente + tabelas `search_cache`/`search_results` que JÁ EXISTEM.

#### O que JÁ EXISTE e será REUTILIZADO
- `search_cache` tabela com `user_id`, `status`, `params` ✅
- `search_results` tabela com JSONB ✅
- `budget_tracking` com `source: 'manual_search'` ✅
- `scanQueue` BullMQ (cronScheduler.ts:15) ✅
- Pipeline core: search→filter0→filter1→fetch→filter2→embed (scanPipeline.ts) ✅
- `trackCost()` função (queries.ts:163-178) ✅

#### Novo arquivo: `backend/src/routes/manualSearchRoutes.ts`
```typescript
// POST /manual-search - Cria busca, enfileira job
// GET /manual-search/:id/status - Polling de status
// GET /manual-search/:id/results - Resultados paginados
// GET /manual-search/history - Histórico do usuário
```

#### Novo arquivo: `backend/src/jobs/workers/manualSearchWorker.ts`
- Reutiliza: `searchProvider.search()`, `filter0Regex()`, `filter1GPTBatch()`, `contentFetcher.fetch()`, `filter2GPT()`, `embeddingProvider.generate()`
- NÃO faz: dedup contra `news` universal, push notifications, updateLocationLastCheck
- Salva em: `search_results` (JSONB) vinculado ao `search_cache.search_id`
- Registra custo: `trackCost({ source: 'manual_search', ... })`

#### Ajustes em arquivos existentes
| Arquivo | Mudança |
|---|---|
| `backend/src/middleware/validation.ts` | Novo schema `triggerManualSearch` |
| `backend/src/database/queries.ts` | Funções: `createSearchCache()`, `updateSearchStatus()`, `insertSearchResults()`, `getSearchResults()`, `getUserSearchHistory()` |
| `backend/src/routes/index.ts` | Registrar manualSearchRoutes |
| `backend/src/server.ts` | Criar manualSearchWorker |

#### Novo arquivo Flutter: `mobile-app/lib/features/search/screens/manual_search_screen.dart`
- Wizard: Estado → Cidade → Período → Tipo Crime
- Aviso de custo antes de confirmar
- Polling de status a cada 3s
- Exibir resultados com `NewsCard` reusável

#### Ajustes Flutter existentes
| Arquivo | Mudança |
|---|---|
| `api_service.dart` | Métodos: `triggerManualSearch()`, `getManualSearchStatus()`, `getManualSearchResults()` |
| `main_screen.dart` | Tab Busca com 2 opções: "Filtrar notícias" + "Nova busca" |

---

### 8.7.5 Calculadora de Custos Previstos (Admin Panel)

**Problema**: Admin não sabe quanto vai custar configurar X cidades com Y frequência.

**Solução**: Calculadora client-side na tab Orçamento. Custo médio por scan vem do backend.

#### O que JÁ EXISTE
- Tab Orçamento (settings/page.tsx) com cards de custo real ✅
- `budget_tracking` com dados reais de custo ✅
- `operation_logs` com contagem de scans ✅

#### Novo endpoint: `GET /settings/cost-estimate`
```typescript
// settingsRoutes.ts
// Retorna: { avgCostPerScan: number, totalScansThisMonth: number }
// Calcula: SUM(cost_usd) WHERE source='auto_scan' / COUNT(DISTINCT de scans) deste mês
```

#### Calculadora na tab Orçamento (settings/page.tsx)
```
Inputs:
  - Cidades ativas: [input number, default = total atual]
  - Frequência média: [select com opções da Feature 1]
  - Buscas manuais/dia: [input number, default 0]

Fórmula (client-side):
  scans_por_dia = cidades * (1440 / frequencia_min)
  custo_auto = scans_por_dia * 30 * avgCostPerScan
  custo_manual = buscas_dia * 30 * avgCostPerScan
  custo_total = custo_auto + custo_manual

Output:
  "Custo estimado: $X.XX / mês"
  "  - Scans automáticos: $Y.YY"
  "  - Buscas manuais: $Z.ZZ"
```

---

### ✅ Critérios de Conclusão - Fase 8.7

- [ ] `scan_frequency_minutes` funcionando em todo o stack (DB, backend, admin, CRON)
- [ ] Admin pode configurar frequência granular (5x/hora, 3x/hora, etc.)
- [ ] `auth_required` e `search_permission` configs no DB e admin panel
- [ ] App abre sem login quando `auth_required=false`
- [ ] Filtro no Flutter com cidade, tipo crime, período (usa backend existente)
- [ ] Busca manual dispara pipeline individual (resultados por usuário)
- [ ] Calculadora de custos funcional no admin panel
- [ ] Backend: 0 erros TS, 86+ testes passando
- [ ] Admin: build sem erros
- [ ] Flutter: analyze sem issues

### Ordem de implementação
1. Feature 1 (frequência granular) - migra DB, base para tudo
2. Feature 3 (toggle auth) - configs + middleware novo
3. Feature 2A (filtro Flutter) - ajuste mínimo, backend já suporta
4. Feature 2B (busca manual) - feature mais complexa
5. Feature 5 (calculadora) - UI pura no admin

---

## ✅ FASE 9: Deploy & Testes Básicos (1 dia)

### Objetivo
Scripts de deploy e testes essenciais para produção MVP

---

### 9.1 Sentry (Error Tracking)

**Setup**:
```bash
cd backend
npm install @sentry/node @sentry/profiling-node
```

**Arquivo**: `backend/src/utils/sentry.ts`

```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1, // 10% das transações
    profilesSampleRate: 0.1,
    integrations: [
      new ProfilingIntegration(),
    ],
  });

  console.log('[Sentry] Initialized');
}

// Capturar erros no pipeline
export function captureError(error: Error, context: any = {}) {
  Sentry.captureException(error, {
    extra: context
  });
}
```

**Integrar no server**:
```typescript
// backend/src/server.ts
import { initSentry } from './utils/sentry';

initSentry();

// Error handler
app.use((err, req, res, next) => {
  Sentry.captureException(err);
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

---

### 9.2 Health Checks Completos

**Arquivo**: `backend/src/routes/health.ts`

```typescript
import express from 'express';
import { supabase } from '../database/client';
import { redis } from '../services/redis';
import { scanWorker } from '../jobs/workers/scanWorker';

const router = express.Router();

router.get('/health', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      worker: await checkWorker(),
      apis: {
        google: await checkGoogleAPI(),
        jina: await checkJinaAPI(),
        openai: await checkOpenAIAPI()
      }
    }
  };

  const isHealthy = Object.values(checks.checks).every(c =>
    typeof c === 'object' ? c.status === 'ok' : c
  );

  checks.status = isHealthy ? 'healthy' : 'degraded';

  res.status(isHealthy ? 200 : 503).json(checks);
});

async function checkDatabase() {
  const start = Date.now();
  try {
    await supabase.from('news').select('id').limit(1);
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

async function checkRedis() {
  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

async function checkWorker() {
  try {
    const jobCounts = await scanWorker.getJobCounts();
    return {
      status: 'ok',
      active: jobCounts.active,
      waiting: jobCounts.waiting,
      failed: jobCounts.failed
    };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

async function checkGoogleAPI() {
  try {
    // Fazer uma query simples
    const response = await searchProvider.search('test', { maxResults: 1 });
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

async function checkJinaAPI() {
  try {
    const response = await fetch('https://r.jina.ai/https://example.com', {
      headers: { 'Authorization': `Bearer ${process.env.JINA_API_KEY}` }
    });
    return { status: response.ok ? 'ok' : 'error' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

async function checkOpenAIAPI() {
  try {
    const response = await openai.models.list();
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

export default router;
```

---

### 9.3 Graceful Shutdown

**Arquivo**: `backend/src/server.ts`

```typescript
let isShuttingDown = false;

// Middleware para bloquear requests durante shutdown
app.use((req, res, next) => {
  if (isShuttingDown) {
    return res.status(503).json({
      error: 'Server shutting down',
      message: 'Please retry in a few seconds'
    });
  }
  next();
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received, starting graceful shutdown...`);
  isShuttingDown = true;

  // 1. Parar de aceitar novos requests
  server.close(() => {
    console.log('[Shutdown] HTTP server closed');
  });

  // 2. Esperar jobs atuais terminarem (timeout 30s)
  console.log('[Shutdown] Waiting for jobs to complete (30s timeout)...');
  await scanWorker.close();

  // 3. Fechar conexões
  console.log('[Shutdown] Closing connections...');
  await redis.quit();
  await supabase.removeAllChannels();

  console.log('[Shutdown] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Timeout: forçar shutdown após 35s
setTimeout(() => {
  if (isShuttingDown) {
    console.error('[Shutdown] Timeout! Forcing exit...');
    process.exit(1);
  }
}, 35000);
```

---

### 9.4 Dead Letter Queue

**Arquivo**: `backend/src/jobs/workers/deadLetterWorker.ts`

```typescript
import { Worker, Queue } from 'bullmq';
import { redis } from '../../services/redis';
import nodemailer from 'nodemailer';

const deadLetterQueue = new Queue('dead-letter', { connection: redis });

// Capturar jobs que falharam permanentemente
scanWorker.on('failed', async (job, err) => {
  if (job && job.attemptsMade >= 3) {
    await deadLetterQueue.add('dead-job', {
      original_job: {
        id: job.id,
        data: job.data,
        queue: 'scan-queue'
      },
      error: {
        message: err.message,
        stack: err.stack
      },
      failed_at: new Date().toISOString()
    });

    console.error(`[DLQ] Job ${job.id} moved to dead letter queue`);

    // Alertar admins
    await sendAdminAlert(job, err);
  }
});

// Worker para revisar dead letter queue
const dlqWorker = new Worker('dead-letter', async (job) => {
  console.log('[DLQ] Processing dead job:', job.id);
  // Admin pode manualmente re-tentar via dashboard
}, { connection: redis });

async function sendAdminAlert(job: any, error: Error) {
  const { data: admins } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('is_admin', true);

  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  for (const admin of admins || []) {
    await transporter.sendMail({
      from: 'alerts@netriosnews.com',
      to: admin.email,
      subject: `🚨 Job Failed Permanently - ${job.data.locationId}`,
      html: `
        <h2>Job Failed After 3 Attempts</h2>
        <p><strong>Job ID:</strong> ${job.id}</p>
        <p><strong>Location:</strong> ${job.data.locationId}</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <pre>${error.stack}</pre>
        <p><a href="${process.env.ADMIN_URL}/dead-letter">Review in Admin Panel</a></p>
      `
    });
  }
}

export { deadLetterQueue, dlqWorker };
```

---

### 9.5 Database Migrations

**Setup**:
```bash
npm install db-migrate db-migrate-pg
npm install --save-dev @types/db-migrate
```

**Arquivo**: `backend/database.json`

```json
{
  "dev": {
    "driver": "pg",
    "connectionString": {"ENV": "DATABASE_URL"}
  },
  "production": {
    "driver": "pg",
    "connectionString": {"ENV": "DATABASE_URL"}
  }
}
```

**Criar migração**:
```bash
npx db-migrate create initial-schema --sql-file
```

**Arquivo**: `migrations/sqls/20250207-initial-schema-up.sql`

```sql
-- Copiar todo o schema da FASE 1 aqui
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE news (...);
-- etc
```

**Aplicar migração**:
```bash
npx db-migrate up --env production
```

---

### 9.6 Backup Automático

**Arquivo**: `backend/scripts/backup.sh`

```bash
#!/bin/bash

# Backup diário do Postgres
DATE=$(date +%Y%m%d)
BACKUP_FILE="netrios-backup-$DATE.sql.gz"

echo "[Backup] Starting backup..."

# Fazer dump
pg_dump $DATABASE_URL | gzip > /tmp/$BACKUP_FILE

# Upload para S3 (ou serviço similar)
aws s3 cp /tmp/$BACKUP_FILE s3://netrios-backups/$BACKUP_FILE

# Limpar arquivo local
rm /tmp/$BACKUP_FILE

echo "[Backup] Complete: $BACKUP_FILE"

# Manter apenas últimos 30 backups
aws s3 ls s3://netrios-backups/ | sort | head -n -30 | awk '{print $4}' | \
  xargs -I {} aws s3 rm s3://netrios-backups/{}
```

**CRON no Render.com** (via render.yaml):
```yaml
services:
  - type: cron
    name: daily-backup
    env: shell
    schedule: "0 3 * * *"  # 3 AM diário
    command: bash scripts/backup.sh
```

---

### 9.7 UptimeRobot

1. Criar conta em: https://uptimerobot.com
2. Adicionar monitor:
   - **URL**: `https://netrios-backend.onrender.com/health`
   - **Tipo**: HTTP(s)
   - **Intervalo**: 5 minutos
   - **Alertas**: Email para admins
3. Configurar alertas:
   - Down por 2 minutos → enviar email
   - Up after down → enviar email de recuperação

---

### 9.8 Testes Unitários

**Setup**:
```bash
npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
npx ts-jest config:init
```

**Arquivo**: `backend/__tests__/filters.test.ts`

```typescript
import { filter0Regex } from '../src/services/filters/filter0Regex';
import { filter1GPT } from '../src/services/filters/filter1GPT';

describe('Filter0 - Regex', () => {
  it('should block social media URLs', () => {
    expect(filter0Regex('https://facebook.com/post', 'crime')).toBe(false);
    expect(filter0Regex('https://instagram.com/post', 'crime')).toBe(false);
  });

  it('should block non-crime keywords', () => {
    expect(filter0Regex('url.com', 'Receita de bolo')).toBe(false);
    expect(filter0Regex('url.com', 'Novela das 8')).toBe(false);
  });

  it('should pass crime-related snippets', () => {
    expect(filter0Regex('g1.com', 'Assalto em Curitiba')).toBe(true);
    expect(filter0Regex('g1.com', 'Homicídio no Centro')).toBe(true);
  });
});

describe('Filter1 - GPT Snippet', () => {
  it('should reject non-crime snippets', async () => {
    const result = await filter1GPT('Receita de bolo de chocolate delicioso');
    expect(result).toBe(false);
  }, 10000);

  it('should accept crime snippets', async () => {
    const result = await filter1GPT('Assalto à mão armada deixa 2 feridos em Curitiba');
    expect(result).toBe(true);
  }, 10000);
});
```

**Arquivo**: `backend/__tests__/api.test.ts`

```typescript
import request from 'supertest';
import { app } from '../src/server';

describe('API Endpoints', () => {
  let authToken: string;

  beforeAll(async () => {
    // Login e obter token
    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    authToken = response.body.token;
  });

  it('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  it('GET /news without auth should return 401', async () => {
    const response = await request(app).get('/news');
    expect(response.status).toBe(401);
  });

  it('GET /news with auth should return 200', async () => {
    const response = await request(app)
      .get('/news')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.news)).toBe(true);
  });
});
```

**Rodar testes**:
```bash
npm test
```

---

### 9.9 CI/CD Pipeline (GitHub Actions)

**Arquivo**: `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd backend
          npm ci

      - name: Run tests
        run: |
          cd backend
          npm test
        env:
          NODE_ENV: test
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Lint
        run: |
          cd backend
          npm run lint

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Render
        run: |
          curl -X POST https://api.render.com/deploy/srv-xxxxx?key=${{ secrets.RENDER_DEPLOY_HOOK }}

  deploy-admin:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

### 9.10 Performance Testing

**Arquivo**: `backend/__tests__/load.test.ts`

```typescript
import { executePipeline } from '../src/jobs/pipeline/scanPipeline';

describe('Performance Tests', () => {
  it('should handle 10 concurrent scans', async () => {
    const locationIds = Array.from({ length: 10 }, (_, i) => `location-${i}`);

    const start = Date.now();

    await Promise.all(
      locationIds.map(id => executePipeline(id))
    );

    const duration = Date.now() - start;

    console.log(`10 concurrent scans completed in ${duration}ms`);
    expect(duration).toBeLessThan(60000); // Menos de 1 minuto
  }, 120000);
});
```

---

### ✅ Critérios de Conclusão

- [ ] Health check retornando 200
- [ ] Script `deploy-upgrade.sh` funcionando
- [ ] Script `deploy-reset.sh` funcionando
- [ ] Testes incrementais passando em cada fase concluída
- [ ] UptimeRobot monitorando /health
- [ ] Deploy no Render.com estável

**Features avançadas movidas para Post-MVP**: Sentry, Graceful Shutdown, Dead Letter Queue, Migrations, Backup, CI/CD, Performance Testing

---

## 🚀 FASE 10: Lançamento (1-2 dias)

- Soft launch (1-2 cidades)
- Monitoramento 24h
- Escala gradual

---

## 📦 BACKLOG - Features Pós-MVP

> **Nota**: Features abaixo foram removidas do MVP para acelerar lançamento. Implementar conforme necessidade.

---

### 🆕 FASE 6.5: Relatórios Executivos (2 dias)

**Objetivo**: Dashboards com gráficos, tendências e insights para C-level

**Features**:
- Analytics endpoints (trends, hotspots, timeseries)
- Gráficos Recharts (Line charts, Bar charts)
- Breakdown por cidade e tipo de crime
- Comparação semana vs semana
- Export PDF
- Email semanal automatizado

**Valor**: Permite decisões estratégicas baseadas em dados

**Arquivo de referência**: Ver linhas 2729-3100 do ROADMAP.md (versão completa)

---

### 🚩 FASE 8.6: Sistema de Report de Erros (1 dia)

**Objetivo**: Usuários podem reportar erros de classificação

**Features**:
- Botão "Reportar" no app mobile
- Tipos: cidade errada, tipo errado, não é crime, etc
- Admin panel lista reports pendentes
- Admin pode corrigir manualmente e marcar como resolvido

**Valor**: Melhoria contínua da qualidade dos dados

**Arquivo de referência**: Ver linhas 3478-3714 do ROADMAP.md (versão completa)

---

### 🔧 FASE 9+: Ferramentas Avançadas de Produção

**Sentry (Error Tracking)**
- Captura automática de exceções
- Stack traces completos
- Alertas por email
- Profiling de performance

**Graceful Shutdown**
- Parar de aceitar novos requests
- Aguardar jobs atuais terminarem
- Fechar conexões gracefully
- Previne perda de dados

**Dead Letter Queue**
- Captura jobs que falharam 3x
- Admin pode revisar e re-tentar manualmente
- Alertas por email

**Database Migrations**
- db-migrate para versionamento de schema
- Rollback automático
- Histórico de mudanças

**Backup Automático**
- Dump diário do Postgres
- Upload para S3
- Retenção de 30 dias
- Script de restore

**CI/CD (GitHub Actions)**
- Testes automatizados em cada PR
- Deploy automático em merge para main
- Lint e type checking
- Build verification

**Performance Testing**
- Load testing com 10+ cidades simultâneas
- Monitoramento de latência
- Otimização de queries
- Profiling de gargalos

**Valor**: Sistema enterprise-grade com zero-downtime e observabilidade completa

---

### 🔮 Ideias Adicionais de Ingestão (Futuro)

> **Contexto**: Durante implementação de "Ingestão Robusta", geramos ideias complementares para aumentar ainda mais a cobertura de notícias.

**Smart Scheduling (Agendamento Inteligente)**
- Ajustar frequência por horário do dia (mais scans à tarde/noite quando mais crimes ocorrem)
- Configurar janelas de alta/baixa prioridade por cidade
- Exemplo: 3 scans/hora no horário comercial, 1 scan/hora de madrugada
- **Valor**: Reduz custo (~30%) mantendo cobertura nos horários críticos

**Keyword Auto-Expansion (Expansão Automática de Termos)**
- Detectar aliases e gírias regionais automaticamente (ex: "roubo" → "furto", "assalto")
- Usar embeddings para encontrar termos similares
- Cache de expansões por estado/região
- **Valor**: Cobre variações linguísticas sem configuração manual

**Telegram Channels Monitoring**
- Monitorar canais públicos de polícia/prefeituras no Telegram
- Extrair notícias via Telegram Bot API (gratuito)
- Filtrar mensagens com palavras-chave de crime
- **Valor**: Fonte oficial adicional, gratuita, tempo-real

**Domain Reputation Scoring**
- Pontuar domínios por confiabilidade (G1, UOL = alta; blogs = baixa)
- Ajustar `confianca` do GPT baseado na fonte
- Priorizar crawling de domínios de alta reputação
- **Valor**: Melhora qualidade das notícias, reduz false positives

**News Aggregator APIs**
- Integrar NewsAPI, Bing News Search API
- Alternativas pagas mas com cobertura global
- Fallback quando Google Search quota esgota
- **Valor**: Redundância e cobertura adicional

**Implementação sugerida**: Após 1-2 meses de operação, avaliar quais fontes trazem melhor ROI (notícias/custo).

---

### 🔔 Supabase Realtime API para Push Notifications

> **Contexto**: Atualmente usando hotfix síncrono (push enviado diretamente do pipeline). LISTEN/NOTIFY do PostgreSQL não funciona no Supabase devido a restrições de rede/firewall.

**Problema Atual (Hotfix Temporário)**:
- Push notifications enviadas de forma síncrona após `db.insertNews()`
- Pipeline fica ~100-200ms mais lento por notícia salva
- Não é escalável para alto volume

**Solução Proposta: Supabase Realtime API**:
- Substitui LISTEN/NOTIFY nativo por WebSocket do Supabase
- Escuta eventos `INSERT` na tabela `news` via Realtime API
- Envia push de forma assíncrona e desacoplada
- Mantém arquitetura event-driven original

**Implementação**:
```typescript
// backend/src/services/notifications/newsEventListener.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

export async function startNewsEventListener() {
  const channel = supabase
    .channel('news_changes')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'news' },
      (payload) => {
        const newsData = payload.new as NewsEvent;
        sendPushNotification(newsData).catch((err) => {
          logger.error(`[NewsListener] Push failed: ${err.message}`);
        });
      }
    )
    .subscribe();
}
```

**Benefícios**:
- ✅ Desacopla push do pipeline (performance)
- ✅ Usa infraestrutura oficial do Supabase
- ✅ Reconnect automático em caso de falha
- ✅ Não requer conexão direta ao PostgreSQL

**Custo**: Incluído no plano Supabase (sem custo adicional)

**Prioridade**: Média (após MVP estabilizar)

---

## 🎯 Próximos Passos Imediatos

1. ✅ Plano aprovado
2. ⏭️ **Criar contas nas plataformas** (Fase 0 - 2h)
3. ⏭️ **Implementar database schema** (Fase 1 - 1 dia)
4. ⏭️ **Pipeline core funcionando** (Fase 2 - 3 dias)

**Está pronto para começar?** 🚀
