# Backend - Netrios News

Backend Node.js + TypeScript do sistema de monitoramento de notícias de crime.

## 🛠️ Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.3
- **Framework**: Express.js 4.18
- **Queue**: BullMQ 5.1 + Redis (Upstash)
- **Database**: Supabase Postgres + pgvector
- **Auth**: Supabase Auth
- **Logging**: Winston
- **Testing**: Jest + ts-jest

## 📁 Estrutura de Pastas

```
backend/
├── src/
│   ├── config/              # Configurações e constantes
│   │   ├── index.ts        # Exporta todas configs
│   │   ├── database.ts     # Config Supabase
│   │   └── redis.ts        # Config Redis/Upstash
│   │
│   ├── database/            # Database layer
│   │   ├── index.ts        # Client Supabase
│   │   ├── schema.sql      # Schema completo
│   │   └── migrations/     # Migrations SQL
│   │
│   ├── jobs/                # BullMQ jobs
│   │   ├── pipeline/       # Pipeline core
│   │   │   ├── scanPipeline.ts      # Orquestração principal
│   │   │   └── searchPipeline.ts    # Pipeline de busca manual
│   │   ├── scheduler/      # CRON jobs
│   │   │   └── cronScheduler.ts     # Agendador de scans
│   │   └── workers/        # BullMQ workers
│   │       ├── scanWorker.ts        # Worker de scans
│   │       └── searchWorker.ts      # Worker de buscas
│   │
│   ├── services/            # Core services
│   │   ├── search/         # Search abstraction
│   │   │   ├── SearchProvider.ts           # Interface
│   │   │   ├── GoogleSearchProvider.ts     # Implementação Google
│   │   │   └── index.ts                    # Factory
│   │   │
│   │   ├── content/        # Content fetching
│   │   │   ├── ContentFetcher.ts           # Interface
│   │   │   ├── JinaContentFetcher.ts       # Implementação Jina
│   │   │   └── index.ts                    # Factory
│   │   │
│   │   ├── filters/        # Pipeline filters
│   │   │   ├── filter0Regex.ts             # Filtro 0 - Regex
│   │   │   ├── filter1GPT.ts               # Filtro 1 - GPT Snippet
│   │   │   ├── filter2GPT.ts               # Filtro 2 - GPT Full
│   │   │   └── index.ts                    # Exporta todos
│   │   │
│   │   ├── embedding/      # Embedding generation
│   │   │   ├── EmbeddingProvider.ts        # Interface
│   │   │   ├── OpenAIEmbeddingProvider.ts  # Implementação OpenAI
│   │   │   └── index.ts                    # Factory
│   │   │
│   │   ├── deduplication/  # Dedup system
│   │   │   ├── index.ts                    # 3-layer dedup
│   │   │   └── utils.ts                    # Similarity helpers
│   │   │
│   │   ├── notifications/  # Push notifications
│   │   │   ├── pushService.ts              # Firebase FCM
│   │   │   └── index.ts
│   │   │
│   │   ├── rateLimiter/    # Dynamic rate limiting
│   │   │   ├── DynamicRateLimiter.ts       # Bottleneck wrapper
│   │   │   └── index.ts
│   │   │
│   │   └── budget/         # Budget tracking
│   │       ├── budgetTracker.ts            # Cost tracking
│   │       └── index.ts
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts         # requireAuth, requireAdmin
│   │   ├── validation.ts   # Zod validation
│   │   ├── errorHandler.ts # Global error handler
│   │   └── logger.ts       # Winston logger
│   │
│   ├── routes/              # API routes
│   │   ├── index.ts        # Routes aggregator
│   │   ├── news.ts         # News endpoints
│   │   ├── locations.ts    # Locations endpoints
│   │   ├── search.ts       # Search endpoints
│   │   ├── settings.ts     # Settings endpoints
│   │   ├── users.ts        # Users endpoints
│   │   └── health.ts       # Health check
│   │
│   ├── utils/               # Utilities
│   │   ├── helpers.ts      # Generic helpers
│   │   └── types.ts        # Shared types
│   │
│   └── server.ts            # Express app entry point
│
├── tests/                   # Tests
│   ├── setup.ts            # Jest setup
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
│
├── .env.example            # Environment variables template
├── .eslintrc.json          # ESLint config
├── .prettierrc.json        # Prettier config
├── jest.config.js          # Jest config
├── tsconfig.json           # TypeScript config
├── package.json            # Dependencies
└── README.md               # Este arquivo
```

## 🚀 Setup

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
# Edite .env e preencha com suas credenciais
```

### 3. Criar Database Schema

```bash
# Execute o schema.sql no Supabase Dashboard
# Ou use CLI:
supabase db push
```

### 4. Rodar em Desenvolvimento

```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3000`

## 📝 Scripts Disponíveis

```bash
# Desenvolvimento (hot reload)
npm run dev

# Build para produção
npm run build

# Rodar produção
npm start

# Testes
npm test
npm run test:watch
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Formatação
npm run format

# Type checking
npm run type-check
```

## 🔌 API Endpoints

### Public

- `GET /health` - Health check

### Autenticados (requireAuth)

#### News
- `GET /news` - Feed de notícias
  - Query params: `cidade`, `offset`, `limit`

#### Search
- `POST /search` - Busca histórica on-demand
- `GET /search/:search_id/results` - Resultados da busca

### Admin (requireAdmin)

#### Locations
- `GET /locations` - Listar localizações
- `POST /locations` - Criar localização
- `PATCH /locations/:id` - Atualizar localização
- `DELETE /locations/:id` - Deletar localização

#### Users
- `GET /users` - Listar usuários
- `POST /users` - Criar usuário
- `PATCH /users/:id` - Atualizar usuário

#### Settings
- `GET /settings/rate-limits` - Configurações de rate limit
- `PATCH /settings/rate-limits/:id` - Atualizar rate limit
- `GET /settings/budget/summary` - Dashboard de budget

#### Stats
- `GET /stats` - Estatísticas gerais
- `GET /logs/recent` - Logs recentes

Ver documentação completa em `docs/API.md` _(em breve)_

## 🧪 Testes

### Rodar Todos os Testes

```bash
npm test
```

### Rodar Testes Específicos

```bash
npm test -- filters
npm test -- pipeline
```

### Coverage Report

```bash
npm run test:coverage
```

## 📦 Build & Deploy

### Build Local

```bash
npm run build
node dist/server.js
```

### Deploy no Render.com

1. Conecte o repositório GitHub ao Render.com
2. Configure as env vars no dashboard
3. Deploy automático via Git push

Ver guia completo em `docs/DEPLOYMENT.md` _(em breve)_

## 🔧 Arquitetura do Pipeline

```
┌─────────────┐
│ CRON        │
│ Scheduler   │ (A cada hora)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ BullMQ      │
│ Queue       │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│        PIPELINE CORE                │
├─────────────────────────────────────┤
│ 1. Google Search (URLs)             │
│ 2. Filtro 0 - Regex (95% eliminado) │
│ 3. Filtro 1 - GPT Snippet           │
│ 4. Jina Content Fetch               │
│ 5. Filtro 2 - GPT Full Analysis     │
│ 6. Embedding Generation             │
│ 7. Deduplicação (3 camadas)         │
│ 8. Save Database                    │
│ 9. Push Notification                │
└─────────────────────────────────────┘
```

## 🔐 Segurança

- **Auth**: Tokens JWT via Supabase Auth
- **Validation**: Zod schema validation
- **Rate Limiting**: Bottleneck + DB config
- **CORS**: Configurável via env vars
- **Logging**: Winston structured logs

## 💰 Cost Tracking

O sistema rastreia automaticamente os custos em `budget_tracking`:

```sql
SELECT * FROM budget_summary WHERE month = date_trunc('month', NOW());
```

Budget alertas configuráveis via env vars:
- `MONTHLY_BUDGET_USD`
- `BUDGET_WARNING_THRESHOLD`

## 🐛 Debug

### Logs

```bash
# Ver logs em tempo real
tail -f logs/app.log

# Filtrar por nível
grep "ERROR" logs/app.log
```

### Health Check

```bash
curl http://localhost:3000/health
```

### BullMQ Dashboard

```bash
npm install -g bull-board
bull-board
```

## 📚 Recursos

- [Express.js Docs](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [BullMQ Guide](https://docs.bullmq.io/)
- [Supabase Docs](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

---

**Desenvolvido com ❤️ por Netrios Team**
