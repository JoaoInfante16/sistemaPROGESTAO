# Netrios News - ROADMAP Fase 2

## Estado Herdado da Fase 1
- Codigo 100% pronto (FASES 0-9), 210 testes, 0 erros TS
- Nunca foi deployed - falta config de contas e deploy
- Push usa hotfix sincrono (LISTEN/NOTIFY falhou com Supabase)
- Dev Tools (mock data) devem ser removidas antes do deploy

---

## Sprint Ativo: Lancamento (FASE 10)

### Etapa 1: Contas e API Keys
- [ ] Supabase: habilitar pgvector, executar schema.sql
- [ ] Upstash: criar database Redis
- [ ] Google Cloud: ativar Custom Search API, criar engine
- [ ] Jina AI: criar conta, obter API key
- [ ] OpenAI: criar conta, adicionar creditos, gerar key
- [ ] Firebase: criar projeto, gerar service account JSON
- [ ] Render.com: criar conta, conectar GitHub
- [ ] Vercel: criar conta, conectar GitHub

### Etapa 2: Teste Local
- [ ] Preencher backend/.env com credenciais
- [ ] Backend local: health check OK
- [ ] Preencher admin-panel/.env.local
- [ ] Admin local: login funciona
- [ ] Criar usuario admin no Supabase Auth + user_profiles
- [ ] Adicionar 1-2 cidades, aguardar scan, verificar noticias

### Etapa 3: Deploy Producao
- [ ] Deploy backend no Render (env vars)
- [ ] curl health check -> "ok"
- [ ] Deploy admin panel na Vercel (env vars)
- [ ] CORS_ORIGIN atualizado com URL Vercel
- [ ] Login admin em producao OK
- [ ] Build APK Flutter com URLs producao
- [ ] Testar app no celular

### Etapa 4: Soft Launch
- [ ] 1-2 cidades ativas, frequencia 1h
- [ ] Monitorar 24h (custos, success rate, erros)
- [ ] Validar custo real vs estimado
- [ ] UptimeRobot monitorando /health

### Pre-deploy obrigatorio
- [ ] Remover devRoutes.ts
- [ ] Remover import devRoutes em routes/index.ts
- [ ] Remover metodos mock do admin api.ts
- [ ] Remover aba Dev Tools do admin settings
- [ ] DELETE FROM news WHERE resumo LIKE '[MOCK]%'
- [ ] flutter analyze -> 0 issues

---

## Validacoes Pos-Deploy (so com sistema rodando)
- [ ] Economia de cache validada nos logs
- [ ] Taxa de falsos positivos dedup < 5%
- [ ] Push latencia < 5s
- [ ] Success rate scans > 95%
- [ ] Custos reais vs estimados alinhados

---

## Backlog

### Alta Prioridade (pos-lancamento)
- [ ] Supabase Realtime API para push (substituir hotfix sincrono)
- [ ] Testes de integracao E2E
- [ ] Monitoring producao (UptimeRobot, logs)

### Media Prioridade
- [ ] Smart Scheduling (frequencia por horario, reduz custo ~30%)
- [ ] Keyword Auto-Expansion (aliases/girias regionais)
- [ ] Domain Reputation Scoring
- [ ] Relatorios Executivos no admin
- [ ] Sistema de Report de Erros (usuario reporta noticia incorreta)

### Post-MVP
- [ ] Telegram Channels Monitoring
- [ ] News Aggregator APIs (NewsAPI, Bing News)
- [ ] iOS support
- [ ] Sentry Error Tracking
- [ ] CI/CD GitHub Actions
- [ ] Dead Letter Queue
- [ ] Database Migrations (db-migrate)
- [ ] Performance Testing (10+ cidades)
- [ ] Search history no Flutter
- [ ] User profile management no Flutter
