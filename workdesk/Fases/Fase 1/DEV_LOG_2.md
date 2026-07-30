# Netrios News - Dev Log 2 (Fase Producao)

## Sumario
- [Status](#status-snapshot) | [Arquitetura](#arquitetura-rapida) | [Trabalho Recente](#trabalho-recente)
- [Issues](#issues-conhecidas) | [Decisoes](#decisoes-tecnicas) | [Fila de Tarefas](#fila-de-tarefas)

---

## Status Snapshot

- **Data**: 2026-02-09
- **Backend**: 0 erros TS, 210 testes passing (18 suites)
- **Admin Panel**: build clean
- **Flutter**: pendente `flutter analyze` (scripts .bat disponiveis)
- **Foco atual**: Auditoria CONCLUIDA. Proximo: FASE 10 lancamento

---

## Arquitetura Rapida

**Stack**: Backend (Node.js+TS+Express) | Admin (Next.js 15+shadcn) | Mobile (Flutter+Supabase)

**Pipeline (scanPipeline.ts)**: Multi-Source Collect -> Filter0(regex) -> Filter1(GPT batch) -> Fetch(Jina) -> Filter2(GPT full) -> Dedup(3-layer) -> Save+Push

**Key files**:
- Backend: `routes/index.ts` (10 route files), `database/queries.ts` (766 linhas), `services/configManager/index.ts` (20 keys)
- Admin: `settings/page.tsx` (settings+ingestao+budget), `lib/api.ts` (19 funcoes)
- Flutter: `api_service.dart` (13 funcoes), `main.dart` (AuthGate), 5 screens

**Rotas backend**: health, public, news, locations, users, settings, devices, manual-search, dev

**Auth**: Supabase JWT em todos os 3 sistemas. Middleware: requireAuth, conditionalAuth, requireAdmin, requireSearchPermission

**Push**: Hotfix direto do pipeline (sendPushNotification apos insertNews). LISTEN/NOTIFY desabilitado (Supabase Realtime planejado para Post-MVP).

---

## Trabalho Recente

### 2026-02-09: Auditoria Completa + Todos os Fixes
- Auditoria profunda dos 3 sistemas (Backend, Admin, Flutter)
- Coesao verificada: 19/19 rotas, 20/20 configs, 13/13 tabelas OK
- 11 issues identificadas e TODAS resolvidas (3 sprints):
  - Sprint 1: `GET /public/locations`, reescrita `getUnreadCount()`, push error handling
  - Sprint 2: logger padronizado (queries.ts, redis.ts), tab Logs no admin, .env.local.example porta
  - Sprint 3: "Esqueci senha" UI no Flutter, iOS documentado como nao suportado no MVP
- Criado DEV_LOG_2.md e ROADMAP_2.md (workflow anti-frankenstein)
- Corrigido tipo triggerNotification (campo `devices` faltando)
- **Verificacao**: tsc OK, jest 210/210, admin build OK

### 2026-02-09: Push Notification Hotfix
- LISTEN/NOTIFY falhou (Supabase bloqueia conexao direta)
- Hotfix: sendPushNotification() direto do scanPipeline.ts apos insertNews
- Supabase Realtime API adicionado ao roadmap Post-MVP
- **Arquivos**: scanPipeline.ts, DEV_LOG.md, ROADMAP.md

### 2026-02-09: Ingestao Robusta
- 4 novas fontes: Multi-Query, Google News RSS, Section Crawling, SSP Scraping
- 6 novos arquivos backend + 46 testes
- Admin panel: tab Ingestao com toggles + calculadora de custos
- **Verificacao**: tsc OK, jest 210/210, admin build OK

---

## Issues Conhecidas

| # | Sev. | Issue | Status |
|---|------|-------|--------|
| - | - | Nenhuma issue aberta | LIMPO |

Todas as 8 issues da auditoria foram resolvidas em 2026-02-09.

---

## Decisoes Tecnicas

| Decisao | Motivo | Alternativa Rejeitada |
|---------|--------|-----------------------|
| Manter filter1GPT.ts como fallback | Pode servir para debug de snippets individuais | Deletar (perderia fallback) |
| Manter componentes shadcn nao usados | Pre-instalados, uteis para features futuras | Deletar (teria que reinstalar) |
| Push hotfix sincrono no pipeline | LISTEN/NOTIFY nao funciona com Supabase | Polling (mais complexo, delay) |
| Criar endpoint publico para locations | Users normais precisam da lista de cidades | Mudar auth do endpoint admin (inseguro) |
| DEV_LOG_2 + ROADMAP_2 concisos | Arquivos antigos muito grandes para AI | Comprimir antigos (perda de historico) |

---

## Fila de Tarefas

### Proximo Sprint: Lancamento (FASE 10)

- [ ] Deploy backend no Render
- [ ] Config DNS + HTTPS
- [ ] Seed dados reais (localizacoes)
- [ ] Build APK Flutter release
- [ ] Testar pipeline completo em producao
- [ ] Monitoramento (UptimeRobot)
