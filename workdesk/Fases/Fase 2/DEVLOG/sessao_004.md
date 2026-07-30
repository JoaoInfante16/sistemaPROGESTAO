# Sessao 004 - SSP na Busca Manual + Fontes Oficiais vs Midia + Badges Feed
**Data**: 2026-03-17

## Objetivo
1. Adicionar SSP scraping na busca manual (hoje so usa Google Search)
2. Separar fontes oficiais (SSP/gov.br) de jornalisticas no dashboard/relatorio
3. Badges "OFICIAL" + UF no feed do Flutter

## Progresso

### Passo 0: ROADMAP + DEVLOG
- [x] ROADMAP atualizado com sprint sessao 4
- [x] DEVLOG sessao_004.md criado

### Passo 1: SSP na Busca Manual
- [x] manualSearchWorker.ts: importa scrapeSSP, chama apos Google Search
- [x] sourceTypeMap (Map<string, 'google' | 'ssp'>) rastreia origem de cada URL
- [x] source_type salvo no JSONB de search_results

### Passo 2: Classificar Fontes
- [x] analyticsQueries.ts: isOfficialSource() exportado (regex .gov.br/.ssp./.seguranca. etc)
- [x] getNewsSources() retorna type: 'oficial' | 'midia'
- [x] getSearchResultsAnalytics() classifica usando source_type + fallback dominio
- [x] deduplicateSources generico <T extends { url: string }>

### Passo 3: Dashboard Fontes Separadas
- [x] analyticsRoutes.ts: separa sourcesOficial/sourcesMedia no reportData JSONB
- [x] sources-section.tsx: 2 secoes (Shield verde oficial + Newspaper azul midia)
- [x] report/[id]/page.tsx: extrai e passa fontes categorizadas
- [x] api.ts: ReportData type com sourcesOficial/sourcesMedia opcionais

### Passo 4: Badges no Feed Flutter
- [x] queries.ts: getCityToUFMap() + STATE_NAME_TO_UF (27 estados)
- [x] queries.ts: getUserNewsFeed tipo corrigido (NewsFeedItem cast)
- [x] newsRoutes.ts: enrichFeedItems() adiciona has_official_source + estado_uf
- [x] newsRoutes.ts: GET /news e GET /news/feed enriquecidos
- [x] news_item.dart: hasOfficialSource (bool) + estadoUf (String?) + fromJson
- [x] news_card.dart: badge verde "OFICIAL" (shield) + badge cinza UF no header Row
- [x] news_detail_sheet.dart: fontes .gov.br com shield verde + tag "GOV"

### Passo 5: Flutter Report Screen
- [x] report_screen.dart: extrai URLs de results, classifica com regex
- [x] Secao "Fontes Oficiais (SSP/Gov)" com shield verde (se houver)
- [x] Secao "Fontes Jornalisticas" com links azuis (max 10 + contador)
- [x] _openSourceUrl() adicionado para abrir fontes no browser

## Verificacao
- [x] Backend: `npx tsc --noEmit` → 0 erros
- [x] Admin Panel: `npx tsc --noEmit` → 0 erros

## Decisoes
- isOfficialSource() usa regex de dominio, nao precisa de migration
- getCityToUFMap() busca monitored_locations por request (tabela pequena, sem cache por ora)
- STATE_NAME_TO_UF normaliza acentos via NFD para match robusto
- getUserNewsFeed cast para NewsFeedItem para preservar tipos no spread
- Fontes no report_screen extraidas client-side dos results (nao depende de endpoint extra)
- Backward compatible: SourcesSection faz fallback se sourcesOficial/sourcesMedia nao existem

## Arquivos modificados (11)
- backend/src/database/queries.ts (getCityToUFMap, STATE_NAME_TO_UF, getUserNewsFeed tipo)
- backend/src/database/analyticsQueries.ts (isOfficialSource, classificacao fontes)
- backend/src/routes/analyticsRoutes.ts (sourcesOficial/sourcesMedia no report)
- backend/src/routes/newsRoutes.ts (enrichFeedItems, has_official_source, estado_uf)
- backend/src/jobs/workers/manualSearchWorker.ts (scrapeSSP + sourceTypeMap)
- admin-panel/src/components/analytics/sources-section.tsx (2 secoes: oficial + midia)
- admin-panel/src/app/report/[id]/page.tsx (fontes categorizadas)
- admin-panel/src/lib/api.ts (ReportData types)
- mobile-app/lib/core/models/news_item.dart (hasOfficialSource + estadoUf)
- mobile-app/lib/features/feed/widgets/news_card.dart (badges OFICIAL + UF)
- mobile-app/lib/features/feed/widgets/news_detail_sheet.dart (shield + GOV tag)
- mobile-app/lib/features/search/screens/report_screen.dart (fontes separadas)

## Estado atual
- Backend + Admin Panel: tsc 0 erros
- Todos os 5 passos do plano concluidos
- Pronto para merge develop → staging
