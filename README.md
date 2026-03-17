# 🚨 Netrios News

Sistema de monitoramento de notícias de crime em tempo real para múltiplas cidades brasileiras.

## 📋 Visão Geral

O Netrios News automatiza o monitoramento 24/7 de notícias de crimes através de:
- **Varreduras periódicas** em fontes de notícia via Google Search
- **Filtragem inteligente** com LLMs (elimina 95% do ruído)
- **Notificações em tempo real** via push notifications
- **Feed unificado** com filtros, busca histórica e cache offline

**Resultado**: Economia de ~20h/semana de monitoramento manual + alertas em minutos após publicação.

## 🏗️ Arquitetura

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Admin     │────▶│   Backend    │────▶│  Mobile App  │
│   Panel     │     │   (Node.js)  │     │  (Flutter)   │
│  (Next.js)  │     └──────┬───────┘     └──────────────┘
└─────────────┘            │
                           │
                ┌──────────┼──────────┐
                │          │          │
          ┌─────▼────┐ ┌──▼─────┐ ┌──▼──────┐
          │ Supabase │ │ Upstash│ │Firebase │
          │ Postgres │ │  Redis │ │   FCM   │
          └──────────┘ └────────┘ └─────────┘
```

## 📁 Estrutura do Projeto

```
netrios-news/
├── backend/              # Node.js + TypeScript + Express
│   ├── src/
│   │   ├── config/      # Configurações e env vars
│   │   ├── database/    # Supabase client e migrations
│   │   ├── jobs/        # BullMQ workers e pipeline
│   │   ├── services/    # Core services (search, filters, etc)
│   │   ├── middleware/  # Auth, validation, logging
│   │   ├── routes/      # API REST endpoints
│   │   └── server.ts    # Express app
│   └── tests/           # Testes unitários e E2E
│
├── admin-panel/         # Next.js 14 + shadcn/ui
│   ├── app/            # App Router pages
│   ├── components/     # UI components
│   └── lib/            # API client e utils
│
├── mobile-app/         # Flutter 3.x
│   ├── lib/
│   │   ├── core/       # Database, services, auth
│   │   └── features/   # Feed, search, auth screens
│   └── test/           # Widget e integration tests
│
├── docs/               # Documentação adicional
├── ROADMAP.md         # 📌 Single Source of Truth
├── DEV_LOG.md         # 📝 Diário de bordo do desenvolvimento
└── README.md          # Este arquivo
```

## 🚀 Quick Start

### Pré-requisitos

- Node.js 20+
- Flutter 3.x
- Git
- Contas em: Supabase, Upstash, Render.com, Vercel, Firebase, Google Cloud, Jina AI, OpenAI

### Setup Backend

```bash
cd backend
npm install
cp .env.example .env
# Preencha o .env com suas credenciais
npm run dev
```

### Setup Admin Panel

```bash
cd admin-panel
npm install
cp .env.example .env.local
npm run dev
```

### Setup Mobile App

```bash
cd mobile-app
flutter pub get
flutter run
```

## 📖 Documentação

- **[ROADMAP.md](./ROADMAP.md)** - Plano completo de implementação (Single Source of Truth)
- **[DEV_LOG.md](./DEV_LOG.md)** - Diário de bordo do desenvolvimento
- **[docs/API.md](./docs/API.md)** - Documentação da API REST _(em breve)_
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Decisões arquiteturais _(em breve)_
- **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Guia de deploy _(em breve)_

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express.js
- **Queue**: BullMQ + Redis (Upstash)
- **Database**: Supabase Postgres + pgvector
- **Hosting**: Render.com ($7/mês)

### APIs Externas
- Google Custom Search API
- Jina AI Reader API
- OpenAI GPT-4o-mini + text-embedding-3-small
- Firebase Cloud Messaging

### Admin Panel
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **Auth**: Supabase Auth
- **Hosting**: Vercel (grátis)

### Mobile App
- **Framework**: Flutter 3.x
- **State**: Riverpod
- **Local DB**: SQLite
- **Auth**: Supabase Auth

## 💰 Custos Estimados

| Item | Custo/Mês (10 cidades) |
|------|------------------------|
| Render.com | $7 |
| Google Search | $5-15 |
| Jina AI | $2-5 |
| OpenAI | $3-8 |
| Firebase FCM | Grátis |
| Supabase | Grátis (free tier) |
| Upstash Redis | Grátis (free tier) |
| Vercel | Grátis |
| **TOTAL** | **$17-35/mês** |

*Path de migração para Hetzner VPS (€4-30/mês) quando escalar para 1k+ usuários.*

## 📊 Roadmap de Desenvolvimento

- [x] **FASE 0**: Setup Inicial (1-2 dias)
- [ ] **FASE 1**: Database Schema & Core Services (2-3 dias)
- [ ] **FASE 2**: Pipeline Core (3-4 dias)
- [ ] **FASE 2.5**: Sistema de Cache (1 dia)
- [ ] **FASE 3**: Sistema de Deduplicação (2-3 dias)
- [ ] **FASE 3.5**: Segurança & Infraestrutura (1-2 dias)
- [ ] **FASE 4**: API REST & Push Notifications (2-3 dias)
- [ ] **FASE 5**: Admin Panel - Setup & Auth (1-2 dias)
- [ ] **FASE 6**: Admin Panel - Features Completas (3-4 dias)
- [ ] **FASE 7**: Mobile App - Setup & Auth (1-2 dias)
- [ ] **FASE 8**: Mobile App - Features Completas (3-4 dias)
- [ ] **FASE 8.5**: UX Avançada (1-2 dias)
- [ ] **FASE 9**: Deploy & Testes Básicos (1 dia)
- [ ] **FASE 10**: Lançamento (1-2 dias)

**Tempo total estimado**: 22-32 dias

Ver detalhes completos em [ROADMAP.md](./ROADMAP.md)

## 🧪 Testes

```bash
# Backend
cd backend
npm test
npm run test:coverage

# Admin Panel
cd admin-panel
npm test

# Mobile App
cd mobile-app
flutter test
```

## 🚢 Deploy

### Backend (Render.com)

```bash
cd backend
npm run build
# Deploy automático via GitHub integration
```

### Admin Panel (Vercel)

```bash
cd admin-panel
vercel --prod
```

### Mobile App

```bash
cd mobile-app
flutter build apk --release
flutter build ios --release
```

## 🤝 Contribuindo

Este é um projeto privado. Para dúvidas ou sugestões, entre em contato com a equipe Netrios.

## 📄 Licença

UNLICENSED - Todos os direitos reservados © 2026 Netrios Team

---

**Status do Projeto**: 🚧 Em Desenvolvimento Ativo

**Última Atualização**: 2026-02-07

**Desenvolvido com ❤️ e ☕ por**: Claude Sonnet 4.5 + Netrios Team
