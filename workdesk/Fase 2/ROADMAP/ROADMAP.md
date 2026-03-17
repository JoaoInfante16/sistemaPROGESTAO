# Netrios News - ROADMAP Fase 2

## Estado Herdado da Fase 1
- Codigo 100% pronto (FASES 0-9), 210 testes, 0 erros TS
- Nunca foi deployed - falta config de contas e deploy
- Push usa hotfix sincrono (LISTEN/NOTIFY falhou com Supabase)
- Dev Tools (mock data) devem ser removidas antes do deploy

---

## Concluido na Sessao 2

### Feature: Busca Autonoma de Cidades (qualquer cidade BR)
- [x] Script IBGE: 27 estados, 5571 municipios (83KB JSON)
- [x] Classe BrazilianLocations (singleton, lazy load, busca com diacriticos)
- [x] Widget CitySearchField (autocomplete com overlay, debounce 300ms)
- [x] ManualSearchScreen refatorado para dados estaticos (zero dependencia de API)
- [x] pubspec.yaml atualizado (asset + fl_chart + share_plus)

### Feature: Dashboard de Risco Exportavel
- [x] Migration 004: tabela reports + indices analytics
- [x] Backend: analyticsQueries.ts (6 funcoes de agregacao)
- [x] Backend: analyticsRoutes.ts (6 endpoints: summary, trend, comparison, search-report, generate, public)
- [x] Backend: validation schemas (analyticsQuery, analyticsTrend, analyticsComparison, generateReport)
- [x] Admin Panel: 5 componentes recharts (bar, line, pie, comparison, sources)
- [x] Admin Panel: pagina publica /report/[id] (link compartilhavel, sem auth)
- [x] Admin Panel: pagina interna /dashboard/analytics (gerar relatorios)
- [x] Admin Panel: pdf-export.ts (html2canvas + jspdf, A4 landscape)
- [x] Admin Panel: sidebar atualizado (novo item "Analise de Risco")
- [x] Flutter: ReportScreen com fl_chart (bar chart, trend chart, bairros, fontes)
- [x] Flutter: mini_bar_chart.dart + mini_trend_chart.dart
- [x] Flutter: api_service.dart (generateReport, getSearchAnalytics)
- [x] Flutter: botao "Gerar Relatorio de Risco" nos resultados da busca

---

## Concluido na Sessao 3

### Cleanup: Correcao de 5 Issues Criticos
- [x] Fix #1: Remover IP hardcoded 192.168.1.3 do Flutter env.dart (trocado por 10.0.2.2 + comentarios)
- [x] Fix #2: Remover dev tools do admin api.ts (seedNews, triggerNotification, clearMock)
- [x] Fix #2b: Remover aba Dev Tools inteira do admin settings page + imports nao usados
- [x] Fix #3: Documentar CORS no .env com exemplos por ambiente (dev/staging/prod)
- [x] Fix #4: Validacao de date range em todos os schemas analytics (dateFrom <= dateTo, max 365 dias)
- [x] Fix #5: Substituir req.user! por req.user?.id ?? '' em 5 routes (userRoutes, deviceRoutes, settingsRoutes)

### Expansao: SSP de 5 para 23 Estados
- [x] Sudeste: SP, RJ (URL atualizada), MG, ES (novo)
- [x] Sul: RS, PR (novo), SC (novo)
- [x] Nordeste: BA, CE (novo), PE (novo), MA (novo), AL (novo), SE (novo), PB (novo), PI (novo)
- [x] Centro-Oeste: GO (novo), MT (novo), MS (novo), DF (novo)
- [x] Norte: AM (novo), PA (novo), TO (novo)

### Verificacao
- [x] Backend: tsc --noEmit -> 0 erros
- [x] Admin Panel: tsc --noEmit -> 0 erros

### Revertido: Dev Tools
- [x] Dev tools revertidos no admin (api.ts + settings page) - necessarios pra testes staging
- [x] Disclaimers adicionados nos rate limits (explicacao de impacto por campo)

---

## Concluido na Sessao 4

### Feature: SSP na Busca Manual
- [x] manualSearchWorker.ts: scrapeSSP() + sourceTypeMap + source_type no JSONB
- [x] SSP URLs passam pelo mesmo pipeline (Filter0→1→Fetch→Filter2)

### Feature: Separar Fontes Oficiais vs Jornalisticas
- [x] isOfficialSource() helper exportado (.gov.br/.ssp./.seguranca. etc)
- [x] analyticsQueries.ts: classificacao em getNewsSources() + getSearchResultsAnalytics()
- [x] analyticsRoutes.ts: report_data com sourcesOficial + sourcesMedia
- [x] sources-section.tsx: 2 secoes (Oficial verde Shield + Midia azul Newspaper)
- [x] report/[id]/page.tsx: fontes categorizadas
- [x] api.ts: ReportData com sourcesOficial/sourcesMedia opcionais

### Feature: Badges OFICIAL + UF no Feed Flutter
- [x] newsRoutes.ts: enrichFeedItems() com has_official_source + estado_uf
- [x] queries.ts: getCityToUFMap() + STATE_NAME_TO_UF (27 estados)
- [x] news_item.dart: hasOfficialSource + estadoUf + fromJson
- [x] news_card.dart: badge verde OFICIAL (shield) + badge cinza UF
- [x] news_detail_sheet.dart: fontes .gov.br com shield + tag GOV
- [x] report_screen.dart: fontes separadas (oficial/midia)

### Verificacao
- [x] Backend: tsc --noEmit -> 0 erros
- [x] Admin Panel: tsc --noEmit -> 0 erros
- [x] DEVLOG sessao_004.md completo

---

## Sessao 5: Busca Multi-Cidade + Import IBGE no Admin

### Feature: Busca Manual Multi-Cidade (Flutter, Cliente 2)
- [ ] validation.ts: cidade→cidades (array, max 10)
- [ ] manualSearchRoutes.ts: cidades array no job data
- [ ] manualSearchWorker.ts: loop Google Search por cidade + SSP uma vez + dedup URLs
- [ ] multi_city_search_field.dart: widget multi-select com chips
- [ ] manual_search_screen.dart: usar MultiCitySearchField
- [ ] api_service.dart: cidades array
- [ ] report_screen.dart: cidade→cidades

### Feature: Import IBGE no Admin Panel (Cliente 1)
- [ ] Copiar municipios_br.json para admin-panel/public/data/
- [ ] validation.ts: bulkImportLocations schema
- [ ] locationRoutes.ts: POST /locations/bulk-import
- [ ] queries.ts: bulkInsertLocations() (batch em chunks de 200)
- [ ] ibge-import-dialog.tsx: dialog com estado dropdown + checkboxes cidades
- [ ] locations/page.tsx: botao Importar IBGE
- [ ] api.ts: bulkImportLocations method

### Verificacao
- [ ] Backend: tsc --noEmit -> 0 erros
- [ ] Admin Panel: tsc --noEmit -> 0 erros
- [ ] DEVLOG sessao_005.md atualizado

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

### Etapa 2: Teste Local (Staging)
- [ ] Preencher backend/.env com credenciais reais
- [ ] Backend local: health check OK
- [ ] Preencher admin-panel/.env.local
- [ ] Admin local: login funciona
- [ ] Criar usuario admin no Supabase Auth + user_profiles
- [ ] Adicionar 1-2 cidades, aguardar scan, verificar noticias
- [ ] Aplicar migration 004 no Supabase
- [ ] Testar busca autonoma (cidade fora do monitoramento)
- [ ] Testar gerar relatorio -> link -> PDF

### Etapa 3: Deploy Producao
- [ ] Deploy backend no Render (env vars)
- [ ] curl health check -> "ok"
- [ ] Deploy admin panel na Vercel (env vars)
- [ ] CORS_ORIGIN atualizado com URL Vercel
- [ ] Login admin em producao OK
- [ ] Atualizar URL do report no Flutter (ReportScreen._reportUrl)
- [ ] Build APK Flutter com --dart-define=API_URL=https://...
- [ ] Testar app no celular

### Etapa 4: Soft Launch
- [ ] 1-2 cidades ativas, frequencia 1h
- [ ] Monitorar 24h (custos, success rate, erros)
- [ ] Validar custo real vs estimado
- [ ] UptimeRobot monitorando /health
- [ ] Testar busca autonoma (cidade nao monitorada)
- [ ] Testar gerar relatorio -> link compartilhavel -> PDF
- [ ] Verificar SSP scraping nos 23 estados (quais retornam dados)

### Pre-deploy obrigatorio
- [x] Remover metodos mock do admin api.ts
- [x] Remover aba Dev Tools do admin settings
- [ ] Remover devRoutes.ts do backend
- [ ] Remover import devRoutes em routes/index.ts
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
- [ ] Rate limiting em rotas publicas (/public/report/:id)

### Media Prioridade
- [ ] Smart Scheduling (frequencia por horario, reduz custo ~30%)
- [ ] Keyword Auto-Expansion (aliases/girias regionais)
- [ ] Domain Reputation Scoring
- [ ] Sistema de Report de Erros (usuario reporta noticia incorreta)
- [ ] Cleanup de reports expirados (cron job)
- [ ] Expandir SSP para estados faltantes (RN, RO, RR, AP, AC)

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
