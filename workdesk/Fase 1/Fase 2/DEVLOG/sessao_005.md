# Sessao 005 - Busca Multi-Cidade + Import IBGE no Admin
**Data**: 2026-03-17

## Objetivo
1. Busca manual multi-cidade no Flutter (Cliente 2 gera dashboards por conta propria)
2. Import IBGE no admin panel (Cliente 1 gerencia monitoramento conforme demanda)

## Progresso

### Passo 0: ROADMAP + DEVLOG
- [x] ROADMAP atualizado (sessao 4 marcada concluida, sessao 5 adicionada)
- [x] DEVLOG sessao_005.md criado

### Passo 1: Backend Validation (cidade→cidades)
- [x] triggerManualSearch: `cidade: string` → `cidades: z.array().min(1).max(10)`
- [x] bulkImportLocations schema adicionado (state_name, cities max 1000, mode, frequency)

### Passo 2: Backend Route + Job Data
- [x] manualSearchRoutes.ts: extrai `cidades` (array), passa no job data e search_cache params

### Passo 3: Backend Worker Multi-City
- [x] ManualSearchJobData: `cidade: string` → `cidades: string[]`
- [x] Loop Google Search por cidade com dedup de URLs (seenUrls Set)
- [x] SSP scraping roda uma vez por estado (sem duplicar)
- [x] trackCost com cidadesCount
- [x] Pipeline de filtros roda uma vez no set combinado (zero duplicacao de custo GPT)

### Passo 4: Flutter MultiCitySearchField
- [x] Novo widget `multi_city_search_field.dart` criado
- [x] Overlay autocomplete (mesmo pattern do CitySearchField)
- [x] Chips com delete para cidades selecionadas
- [x] Limite configuravel (maxCities=10), contador "X/10 selecionadas"
- [x] Filtra cidades ja selecionadas do overlay
- [x] Limpa selecao ao trocar estado

### Passo 5: Flutter ManualSearchScreen
- [x] Import trocado: city_search_field → multi_city_search_field
- [x] `_selectedCidade: String?` → `_selectedCidades: Set<String>`
- [x] Widget CitySearchField → MultiCitySearchField
- [x] Submit condition: `_selectedCidades.isNotEmpty`
- [x] ReportScreen navigation: `cidades: _selectedCidades.toList()`

### Passo 6: Flutter ApiService
- [x] `triggerManualSearch`: `cidade: String` → `cidades: List<String>`
- [x] Body: `'cidade'` → `'cidades'`

### Passo 7: Flutter ReportScreen
- [x] Constructor: `cidade: String` → `cidades: List<String>`
- [x] Header: `widget.cidades.join(", ")` para exibir lista
- [x] generateReport: usa `cidades.first` (report e por busca, nao por cidade)
- [x] Share text: mostra todas as cidades

### Passo 8: Copiar IBGE JSON
- [x] municipios_br.json copiado para admin-panel/public/data/
- [x] generate_municipios.ts atualizado para gerar em ambos destinos (mobile-app + admin-panel)

### Passo 9: Backend Bulk Import Endpoint
- [x] validation.ts: bulkImportLocations schema (state_name, cities max 1000, mode, frequency)
- [x] locationRoutes.ts: POST /locations/bulk-import
- [x] Logica: find-or-create estado, filtra duplicatas, bulk insert

### Passo 10: Backend DB bulkInsertLocations
- [x] queries.ts: bulkInsertLocations() com batch em chunks de 200
- [x] Adicionado ao export db

### Passo 11: Admin IBGEImportDialog
- [x] ibge-import-dialog.tsx criado
- [x] Fetch de /data/municipios_br.json (client-side, lazy load)
- [x] Select estado → lista cidades com checkboxes
- [x] "Selecionar todas" + filtro de busca + contador
- [x] Cidades ja monitoradas ficam desabilitadas com badge "Ja monitorada"
- [x] Config: modo (any/keywords) + frequencia (15min-24h)
- [x] Botao "Importar X cidades" com loading state

### Passo 12: Admin Locations Page
- [x] Import IBGEImportDialog
- [x] Botao "Importar IBGE" com icone Database ao lado de Estado/Cidade
- [x] Passa states e loadLocations como props

### Passo 13: Admin API Client
- [x] api.ts: bulkImportLocations method (POST /locations/bulk-import)

## Verificacao
- [x] Backend: tsc --noEmit → 0 erros
- [x] Admin Panel: tsc --noEmit → 0 erros

## Decisoes
- Multi-cidade: loop dentro do worker, nao fan-out de jobs (simples, sem migration)
- Dedup de URLs entre cidades antes do pipeline de filtros (Set<string>)
- SSP roda uma vez por estado, independente do numero de cidades
- Max 10 cidades por busca (controle de custo)
- IBGE JSON como asset estatico no admin-panel/public/ (83KB, fetch client-side)
- Bulk import faz find-or-create do estado + filtra duplicatas pre-insert
- Batch de 200 rows por insert para seguranca
- generateReport usa cidades.first (report e por busca, nao por cidade)

## Arquivos criados (3)
- mobile-app/lib/features/search/widgets/multi_city_search_field.dart
- admin-panel/public/data/municipios_br.json (copia do IBGE)
- admin-panel/src/app/(dashboard)/dashboard/locations/ibge-import-dialog.tsx

## Arquivos modificados (11)
- backend/src/middleware/validation.ts (triggerManualSearch cidades + bulkImportLocations)
- backend/src/routes/manualSearchRoutes.ts (cidades array)
- backend/src/jobs/workers/manualSearchWorker.ts (loop multi-cidade + dedup)
- backend/src/routes/locationRoutes.ts (POST /locations/bulk-import)
- backend/src/database/queries.ts (bulkInsertLocations)
- mobile-app/lib/features/search/screens/manual_search_screen.dart (MultiCitySearchField)
- mobile-app/lib/core/services/api_service.dart (cidades array)
- mobile-app/lib/features/search/screens/report_screen.dart (cidade→cidades)
- admin-panel/src/app/(dashboard)/dashboard/locations/page.tsx (botao Importar IBGE)
- admin-panel/src/lib/api.ts (bulkImportLocations)
- scripts/generate_municipios.ts (output para ambos destinos)
