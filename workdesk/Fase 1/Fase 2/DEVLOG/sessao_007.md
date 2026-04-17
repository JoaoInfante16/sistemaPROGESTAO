# DEVLOG - Sessao 007
**Data**: 2026-03-21
**Foco**: Trocar Google Custom Search por Perplexity Search API

---

## Contexto
O Google Programmable Search Engine descontinuou a opcao "Pesquisar em toda a Web" em janeiro de 2026. Engines novas sao limitadas a no maximo 50 dominios hardcoded, inviabilizando o sistema de monitoramento de noticias que precisa descobrir fontes diversas. Solucao: migrar para Perplexity Search API ($5/1K queries, busca web inteira, filtros por pais/idioma nativos).

## Tarefas

### Passo 1: Config + .env
- [x] config/index.ts: `perplexityApiKey: optionalEnv('PERPLEXITY_API_KEY', '')`
- [x] .env: `PERPLEXITY_API_KEY=` + `SEARCH_BACKEND=perplexity`

### Passo 2: PerplexitySearchProvider
- [x] PerplexitySearchProvider.ts (NOVO): implementa SearchProvider
  - POST `https://api.perplexity.ai/search`
  - Remove `site:.br` da query (usa `country: 'BR'` no body)
  - Mapeia dateRestrict (d7) para search_recency_filter (week)
  - Response `{ url, title, snippet }` mapeia direto para SearchResult

### Passo 3: Factory
- [x] index.ts: case `perplexity` no switch + import + export

### Passo 4: Tipos + Cost Tracking + Rate Limiter
- [x] types.ts: `'perplexity'` adicionado ao union type provider (2 interfaces)
- [x] queries.ts: `'perplexity'` no TrackCostParams
- [x] DynamicRateLimiter.ts: defaults para perplexity (2 concurrent, 200ms, 1000/dia)
- [x] manualSearchWorker.ts: `config.searchBackend` no trackCost + rateLimiter.schedule
- [x] scanPipeline.ts: `config.searchBackend` no trackCost + rateLimiter.schedule

### Passo 5: Flutter (cosmetico)
- [x] manual_search_screen.dart: label "Pesquisando na web" (era "Pesquisando Google")

### Verificacao
- [x] Backend: `npx tsc --noEmit` -> 0 erros
- [x] Admin Panel: `npx tsc --noEmit` -> 0 erros

---

## Arquivos Modificados
| Arquivo | Mudanca |
|---------|---------|
| `backend/src/config/index.ts` | perplexityApiKey |
| `backend/.env` | PERPLEXITY_API_KEY + SEARCH_BACKEND=perplexity |
| `backend/src/services/search/index.ts` | case perplexity no factory |
| `backend/src/utils/types.ts` | 'perplexity' no union type |
| `backend/src/database/queries.ts` | 'perplexity' no TrackCostParams |
| `backend/src/services/rateLimiter/DynamicRateLimiter.ts` | defaults perplexity |
| `backend/src/jobs/workers/manualSearchWorker.ts` | cost tracking + rate limiter dinamicos |
| `backend/src/jobs/pipeline/scanPipeline.ts` | cost tracking + rate limiter dinamicos |
| `mobile-app/.../manual_search_screen.dart` | label "Pesquisando na web" |
| `workdesk/Fase 2/ROADMAP/ROADMAP.md` | sessao 6 concluida + sessao 7 |

## Arquivos Criados
| Arquivo | Descricao |
|---------|-----------|
| `backend/src/services/search/PerplexitySearchProvider.ts` | Provider Perplexity Search API |
| `workdesk/Fase 2/DEVLOG/sessao_007.md` | Este devlog |
