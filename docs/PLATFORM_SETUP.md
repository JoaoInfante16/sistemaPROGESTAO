# 🔧 Guia de Setup de Plataformas

Este documento detalha como criar contas e obter API keys para todas as plataformas necessárias.

---

## 1. 🗄️ Supabase (Database + Auth)

### Criar Conta

1. Acesse [https://supabase.com](https://supabase.com)
2. Clique em "Start your project"
3. Faça login com GitHub (recomendado)

### Criar Projeto

1. Clique em "New Project"
2. Nome: `netrios-news`
3. Database Password: gere uma senha forte (salve!)
4. Região: `South America (São Paulo)` (mais próxima)
5. Plano: **Free** (500MB storage, suficiente para MVP)

### Obter Credenciais

1. No dashboard, vá em **Settings** → **API**
2. Copie:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public**: Chave anônima (frontend)
   - **service_role**: Chave de serviço (backend)

3. Vá em **Settings** → **Database**
4. Copie a **Connection String** (formato Postgres):
   ```
   postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```

### Habilitar pgvector

1. Vá em **Database** → **Extensions**
2. Procure por `vector`
3. Clique em **Enable** no pgvector

### Adicionar ao .env

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...
```

---

## 2. 📮 Upstash Redis (Queue - BullMQ)

### Criar Conta

1. Acesse [https://upstash.com](https://upstash.com)
2. Faça login com GitHub ou email

### Criar Database Redis

1. Clique em **Create Database**
2. Nome: `netrios-queue`
3. Tipo: **Regional**
4. Região: `us-east-1` (ou mais próxima com free tier)
5. Plano: **Free** (10k commands/dia, suficiente para MVP)

### Obter Credenciais

1. Clique no database criado
2. Na aba **Details**, copie:
   - **UPSTASH_REDIS_REST_URL**
   - **UPSTASH_REDIS_REST_TOKEN**

3. Ou use a connection string TLS:
   ```
   rediss://default:[PASSWORD]@[HOST]:[PORT]
   ```

### Adicionar ao .env

```bash
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
```

---

## 3. 🚀 Render.com (Hosting Backend)

### Criar Conta

1. Acesse [https://render.com](https://render.com)
2. Faça login com GitHub

### Setup (após desenvolvimento)

1. Clique em **New** → **Web Service**
2. Conecte seu repositório GitHub
3. Configurações:
   - **Name**: `netrios-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: **Starter** ($7/mês)

4. Adicione variáveis de ambiente no dashboard

---

## 4. ▲ Vercel (Hosting Admin Panel)

### Criar Conta

1. Acesse [https://vercel.com](https://vercel.com)
2. Faça login com GitHub

### Setup (após desenvolvimento admin panel)

1. Clique em **Add New** → **Project**
2. Importe repositório GitHub
3. Vercel detecta automaticamente Next.js
4. Configure env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL`

---

## 5. 🔥 Firebase (Push Notifications)

### Criar Conta

1. Acesse [https://console.firebase.google.com](https://console.firebase.google.com)
2. Faça login com Google

### Criar Projeto

1. Clique em **Add Project**
2. Nome: `netrios-news`
3. Desabilite Google Analytics (opcional para MVP)

### Configurar Cloud Messaging

1. No painel, vá em **Project Settings** (⚙️)
2. Aba **Cloud Messaging**
3. Na seção **Cloud Messaging API (Legacy)**, habilite a API

### Obter Service Account

1. Vá em **Project Settings** → **Service Accounts**
2. Clique em **Generate New Private Key**
3. Salve o arquivo JSON (NUNCA commit!)

### Adicionar ao .env

```bash
# Opção 1: JSON inline (escape aspas duplas)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"netrios-news",...}

# Opção 2: Caminho para arquivo
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### Configurar Android App (para mobile)

1. No console, clique em **Add App** → **Android**
2. Package name: `com.netriosnews.app`
3. Baixe `google-services.json`
4. Coloque em `mobile-app/android/app/`

### Configurar iOS App (para mobile)

1. No console, clique em **Add App** → **iOS**
2. Bundle ID: `com.netriosnews.app`
3. Baixe `GoogleService-Info.plist`
4. Coloque em `mobile-app/ios/Runner/`

---

## 6. 🔍 Google Custom Search API

### Criar Projeto Google Cloud

1. Acesse [https://console.cloud.google.com](https://console.cloud.google.com)
2. Crie novo projeto: `netrios-news`

### Habilitar Custom Search API

1. No menu, vá em **APIs & Services** → **Library**
2. Procure por **Custom Search API**
3. Clique em **Enable**

### Criar API Key

1. Vá em **APIs & Services** → **Credentials**
2. Clique em **Create Credentials** → **API Key**
3. Copie a chave gerada
4. (Opcional) Restrinja a chave:
   - **Application restrictions**: None
   - **API restrictions**: Custom Search API

### Criar Search Engine

1. Acesse [https://programmablesearchengine.google.com](https://programmablesearchengine.google.com)
2. Clique em **Add**
3. Configurações:
   - **Sites to search**: `*.com.br/*` (buscar em sites .br)
   - **Language**: Portuguese
   - **Name**: `Netrios News Search`
4. Clique em **Create**
5. Anote o **Search Engine ID** (cx parameter)

### Adicionar ao .env

```bash
GOOGLE_SEARCH_API_KEY=AIzaSy...
GOOGLE_SEARCH_ENGINE_ID=abc123...
```

### Custos

- **3.000 queries/dia**: Grátis
- **Após isso**: $5 por 1.000 queries

---

## 7. 🤖 Jina AI (Content Extraction)

### Criar Conta

1. Acesse [https://jina.ai](https://jina.ai)
2. Faça login com Google ou GitHub

### Obter API Key

1. No dashboard, vá em **API Keys**
2. Clique em **Create New Key**
3. Nome: `netrios-backend`
4. Copie a chave

### Adicionar ao .env

```bash
JINA_API_KEY=jina_...
```

### Custos

- **Free tier**: 1M tokens/mês (suficiente para MVP)
- **Após isso**: $0.002 por request

---

## 8. 🧠 OpenAI (GPT + Embeddings)

### Criar Conta

1. Acesse [https://platform.openai.com](https://platform.openai.com)
2. Faça login ou crie conta

### Adicionar Créditos

1. Vá em **Billing** → **Payment Methods**
2. Adicione cartão de crédito
3. Adicione $5-10 de crédito inicial

### Obter API Key

1. Vá em **API Keys**
2. Clique em **Create New Secret Key**
3. Nome: `netrios-backend`
4. Copie a chave (só aparece uma vez!)

### Adicionar ao .env

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### Custos Estimados (10 cidades)

- **GPT-4o-mini**: ~$3-8/mês
  - Filter 1: ~100 snippets/dia × $0.15/1M tokens
  - Filter 2: ~10 artigos/dia × $0.15/1M tokens
  - Dedup GPT: ~2 confirmações/dia × $0.15/1M tokens

- **Embeddings**: ~$0.50/mês
  - ~10 artigos/dia × $0.02/1M tokens

---

## ✅ Checklist Final

Após criar todas as contas, seu `.env` deve ter:

```bash
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Redis
REDIS_URL=rediss://...

# Search
GOOGLE_SEARCH_API_KEY=AIza...
GOOGLE_SEARCH_ENGINE_ID=abc...

# Content
JINA_API_KEY=jina_...

# LLM
OPENAI_API_KEY=sk-...

# Push
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

---

## 💰 Resumo de Custos

| Plataforma | Plano | Custo/Mês |
|------------|-------|-----------|
| Supabase | Free | $0 |
| Upstash Redis | Free | $0 |
| Render.com | Starter | $7 |
| Vercel | Hobby | $0 |
| Firebase FCM | Free | $0 |
| Google Search | Pay-as-you-go | $5-15 |
| Jina AI | Pay-as-you-go | $2-5 |
| OpenAI | Pay-as-you-go | $3-8 |
| **TOTAL** | | **$17-35/mês** |

---

## 🆘 Troubleshooting

### Erro: "Invalid API Key"
- Verifique se copiou a chave completa (sem espaços)
- Confirme que a API está habilitada no dashboard

### Erro: "Quota Exceeded"
- Verifique limites do free tier
- Configure alertas de budget

### Erro: "Connection Refused" (Redis)
- Confirme que REDIS_URL está correto
- Teste com Redis CLI: `redis-cli -u $REDIS_URL ping`

### Erro: "pgvector not found"
- Habilite a extensão no Supabase: Database → Extensions → vector

---

**Última atualização**: 2026-02-07
