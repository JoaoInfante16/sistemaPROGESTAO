# Netrios News - Roadmap 2

## Sumario
- [Sistema](#sistema) | [Sprint Ativo](#sprint-ativo-auditoria--cleanup) | [Backlog](#backlog) | [Concluidos](#sprints-concluidos)

---

## Sistema

- **Produto**: Monitoramento de noticias criminais para cidades brasileiras
- **Stack**: Backend (Node.js+TS+Express+BullMQ) | Admin (Next.js 15) | Mobile (Flutter)
- **Infra**: Supabase (DB+Auth), Upstash Redis, Firebase (push), Google/Jina/OpenAI APIs
- **Estado**: FASE 0-10 completas, Ingestao Robusta implementada, pre-lancamento
- **Referencia historica**: DEV_LOG.md (1368 linhas), ROADMAP.md (5361 linhas)

---

## Sprint Ativo: Lancamento (FASE 10)

**Objetivo**: Deploy em producao e primeiro teste real

### Tarefas
- [ ] Deploy backend no Render (Node.js)
- [ ] Configurar variaveis de ambiente em producao
- [ ] Config DNS + HTTPS
- [ ] Seed localizacoes reais (cidades monitoradas)
- [ ] Build APK Flutter release + instalar no celular
- [ ] Testar pipeline completo em producao (scan real)
- [ ] Configurar monitoramento (UptimeRobot, logs no admin)

### Checklist de Verificacao
- [x] `npx tsc --noEmit` -> 0 erros
- [x] `npx jest` -> 210 testes OK
- [x] `npm run build` (admin) -> clean
- [ ] `flutter analyze` -> sem issues

---

## Backlog

### Alta Prioridade
- FASE 10 Lancamento: deploy Render, config DNS, seed dados reais
- Supabase Realtime API para push (substituir hotfix sincrono)
- Testes de integracao end-to-end (pipeline completo)
- Monitoring em producao (UptimeRobot, logs)

### Media Prioridade
- Smart Scheduling (frequencia por horario do dia, reduz custo ~30%)
- Keyword Auto-Expansion (aliases e girias regionais via embeddings)
- Domain Reputation Scoring (pontuar dominios por confiabilidade)
- Relatorios Executivos no admin panel

### Post-MVP
- Telegram Channels Monitoring (canais publicos de policia, gratuito)
- News Aggregator APIs (NewsAPI, Bing News como fallback)
- iOS Firebase config (suporte Apple)
- Sentry Error Tracking
- CI/CD com GitHub Actions
- Dead Letter Queue para jobs falhados
- Database Migrations (db-migrate)
- Performance Testing (10+ cidades simultaneas)
- Search history no Flutter
- User profile management no Flutter

---

## Sprints Concluidos

- 2026-02-07: FASE 0-3 (setup, schema, pipeline core, dedup)
- 2026-02-08: FASE 3.5-9 (auth, API, admin panel, mobile app, deploy scripts, 77 testes)
- 2026-02-09: Ingestao Robusta (4 fontes, 46 testes, admin tab ingestao, calculadora custos)
- 2026-02-09: Push Notification Hotfix (sincrono do pipeline, LISTEN/NOTIFY desabilitado)
- 2026-02-09: Auditoria + Cleanup (8 fixes: public locations, getUnreadCount, push error handling, logger, logs tab, env port, esqueci senha, iOS docs)
