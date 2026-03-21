# DEVLOG - Sessao 006
**Data**: 2026-03-17
**Foco**: Progresso visual na busca + Push ao concluir + Historico de buscas

---

## Contexto
A busca manual pode demorar minutos. Hoje o usuario ve apenas um spinner generico e precisa ficar no app esperando. Tres melhorias: indicador de progresso por etapa, push notification ao concluir, tela de historico.

## Tarefas

### Passo 0: Setup
- [x] ROADMAP sessao 6 atualizado (sessao 5 marcada como concluida)
- [x] DEVLOG sessao_006.md criado
- [x] Migration 005_search_progress.sql: `ALTER TABLE search_cache ADD COLUMN progress JSONB`
- [x] schema.sql: coluna `progress JSONB DEFAULT NULL` + `expires_at` de 24h para 7 dias

### Passo 1: Backend DB Functions
- [x] queries.ts: `updateSearchProgress(searchId, progress)` — non-fatal (warn, nunca throw)
- [x] queries.ts: `getSearchStatus()` agora retorna `progress` junto com status/total_results
- [x] queries.ts: exportado `updateSearchProgress` no objeto `db`

### Passo 2: Backend Worker Progress
- [x] manualSearchWorker.ts: 6 chamadas `db.updateSearchProgress()` na pipeline:
  - Stage 1: google_search — antes do loop de cidades
  - Stage 2: ssp_scraping — antes do SSP
  - Stage 3: filtering — antes de Filter0+Filter1
  - Stage 4: fetching — antes do Jina fetch
  - Stage 5: analyzing — antes do Filter2
  - Stage 6: saving — antes do save
- [x] Early exit (0 resultados): atualiza para stage 6 antes de completar

### Passo 4: Backend Push — sendPushToUser()
- [x] pushService.ts: extraida logica de batch send para `sendToTokens()` (compartilhada)
- [x] pushService.ts: nova `sendPushToUser(userId, title, body, data?)` — filtra por user_id
- [x] `sendPushNotification()` refatorado para usar `sendToTokens()` internamente

### Passo 5: Backend Worker Push Calls
- [x] manualSearchWorker.ts: import `sendPushToUser`
- [x] Apos `updateSearchStatus('completed')`: push "Busca concluida" com contagem de resultados
- [x] No catch de falha: push "Busca falhou" — sempre non-fatal (try/catch silencioso)
- [x] Data inclui `{ search_id, type: 'manual_search_completed|failed' }` para deep linking futuro

### Passo 3: Flutter Stepper Visual
- [x] manual_search_screen.dart: novo state `_progress` (Map)
- [x] `_startPolling()`: extrai `progress` do response e atualiza state
- [x] `_resetSearch()`: limpa `_progress`
- [x] Novo metodo `_buildProgressStepper()` com 6 etapas:
  - google_search (Icons.search), ssp_scraping (Icons.shield), filtering (Icons.filter_alt)
  - fetching (Icons.download), analyzing (Icons.psychology), saving (Icons.save)
- [x] Cores: cinza=pendente, azul+spinner=atual, verde+check=concluido
- [x] `details` string exibida abaixo da etapa atual
- [x] Botao "Cancelar" mantido abaixo do stepper

### Passo 6: Flutter API Method
- [x] api_service.dart: `getSearchHistory()` — GET /manual-search/history

### Passo 7: Flutter SearchHistoryScreen
- [x] search_history_screen.dart (NOVO): tela completa de historico
  - RefreshIndicator para pull-to-refresh
  - Cards com: status chip (verde/vermelho/azul), estado, cidades, tipo crime, data, resultados
  - Tap em completed/processing: navega para ManualSearchScreen com resumeSearchId
  - Tap em failed: snackbar informativo
  - Empty state: icone search_off + mensagem
  - Error state: botao tentar novamente

### Passo 8: Flutter Historico na AppBar
- [x] ManualSearchScreen: novo parametro opcional `resumeSearchId`
- [x] `_resumeSearch()`: verifica status, carrega resultados ou inicia polling
- [x] Trata resultados expirados com snackbar graceful
- [x] AppBar: IconButton(Icons.history) navega para SearchHistoryScreen

### Verificacao
- [x] Backend: `npx tsc --noEmit` -> 0 erros
- [x] Admin Panel: `npx tsc --noEmit` -> 0 erros

---

## Arquivos Modificados
| Arquivo | Mudanca |
|---------|---------|
| `backend/src/database/schema.sql` | progress JSONB + expires_at 7d |
| `backend/src/database/queries.ts` | updateSearchProgress() + getSearchStatus() com progress |
| `backend/src/jobs/workers/manualSearchWorker.ts` | 6 progress updates + push ao completar/falhar |
| `backend/src/services/notifications/pushService.ts` | sendPushToUser() + refactor sendToTokens() |
| `mobile-app/lib/core/services/api_service.dart` | getSearchHistory() |
| `mobile-app/lib/features/search/screens/manual_search_screen.dart` | stepper visual + resumeSearchId + history button |

## Arquivos Criados
| Arquivo | Descricao |
|---------|-----------|
| `workdesk/Fase 2/SQL/migrations/005_search_progress.sql` | Migration: progress column |
| `mobile-app/lib/features/search/screens/search_history_screen.dart` | Tela de historico de buscas |
