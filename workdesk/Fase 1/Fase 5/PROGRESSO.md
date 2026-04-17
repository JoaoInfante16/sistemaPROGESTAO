# Fase 5 — Sentry + Deploy + Dev Panel + Billing

## Status: COMPLETA

## O que foi feito

### Sentry (monitoramento de erros)
- [x] @sentry/node instalado no backend
- [x] Sentry.init em server.ts com environment e tracesSampleRate
- [x] Sentry.captureException em: scanPipeline, manualSearchWorker, BrightDataSERPProvider, JinaContentFetcher, filter1GPTBatch, filter2GPT
- [x] Sentry error handler no Express (antes do errorHandler customizado)
- [x] process.on unhandledRejection/uncaughtException com Sentry
- [x] SENTRY_DSN no .env e render env vars
- [x] Plano Team contratado ($29/mes) — so em producao

### Deploy Staging (Render)
- [x] Backend: https://simeops-backend.onrender.com (Docker, branch staging)
- [x] Admin: https://sistemaprogestao.onrender.com (Node, branch staging)
- [x] Dockerfile corrigido: npm install em vez de npm ci
- [x] CORS fix: callback function para proper origin matching
- [x] Todas env vars configuradas no Render
- [x] Workflow: develop → staging → main

### Dev Panel (projeto separado)
- [x] Projeto em c:/Projetos/dev-panel/ (Next.js + shadcn/ui + dark theme)
- [x] Dashboard com cards de apps (health check, Sentry errors, deploy info)
- [x] Pagina detalhada com tabs: Overview, Erros, Metricas, Billing, Config
- [x] API routes agregando Sentry + Render + Health check
- [x] Auto-refresh 60s, cache local
- [x] Atalho DevPanel.bat no Desktop
- [x] VSCode workspace (simeops.code-workspace)
- [x] Repo: github.com/JoaoInfante16/devpanel

### Billing
- [x] Tabela billing_history no Supabase
- [x] billingScheduler.ts — cron diario, fecha mes no dia configurado
- [x] Endpoints: GET /billing/history, POST /billing/close
- [x] Tela de billing no admin panel (custos fixos, historico, config dia fechamento)
- [x] Billing no Dev Panel (custo no card + tab detalhada)
- [x] Formatacao BR (virgula nos precos)
- [x] billing_close_day configuravel via admin

### Limpeza de codigo
- [x] Removidos 6 type assertions desnecessarios em newsRoutes.ts
- [x] Padronizado error handling em settingsRoutes.ts (nao vaza error.message)
- [x] URLs Vercel removidas (3 arquivos: analyticsRoutes, report_screen, manual_search_screen)
- [x] "Ver Relatorio" abre dentro do app (nao no browser)
- [x] .gitignore atualizado (flutter generated files)
