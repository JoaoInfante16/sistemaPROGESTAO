# Fase 6 — Dashboard de Monitoramento por Cidade

## Status: EM DEBUG (cards ok, city detail crasha)

## Visao
Transformar o app de feed-first para dashboard de monitoramento. Cards por cidade com metricas acumuladas, relatorio organico. Suporte a grupos de cidades.

## Fase A: Backend (grupos + cities-overview)
- [x] Migration 018: city_groups + city_group_members
- [x] Rodar SQL 018 no Supabase
- [x] CRUD grupos: GET/POST/PATCH/DELETE /groups (groupRoutes.ts)
- [x] Queries: getGroups, createGroup, updateGroup, deleteGroup, getGroupMembers
- [x] Endpoint GET /analytics/cities-overview (getCitiesOverview)
- [x] Cities-overview filtra cidades que pertencem a grupo (sem duplicar)
- [x] Toggle grupo cascateia on/off pra cidades-membro
- [x] Total acumulado (totalCrimes) em vez de so 30d
- [x] Tendencia removida do card (fica so no overview)
- [x] Type check OK

## Fase B: Flutter — Dashboard + Cards
- [x] Model CityOverview com totalCrimes (acumulado)
- [x] API methods: getCitiesOverview, getCrimeSummary, getCrimeTrend, getCrimeComparison
- [x] DashboardScreen (lista vertical, pull-to-refresh com AlwaysScrollableScrollPhysics)
- [x] CityCard redesenhado no estilo do NewsCard (elevation, badges, chevron)
- [x] Card mostra: nome, icone cidade/grupo, badge NOVA(S), chip ocorrencias, estado, seta
- [x] Removido: tendencia, crime type chip (card mais limpo)
- [x] Tabs: Dashboard / Busca / Config (3 tabs)
- [x] Grid background com animacao continua infinita
- [x] Versao 1.1.0+2
- [x] Pull-to-refresh funcionando (novas cidades aparecem)

## Fase C: Flutter — City Detail Screen
- [x] CityDetailScreen com 2 tabs (Noticias, Overview)
- [x] Tab Noticias: FeedScreen com cityFilter + ValueKey
- [x] Tab Overview: crime breakdown bars + trend bars + comparativo + top bairros
- [x] Suporte a drill-down em grupos (chips de sub-cidades)
- [x] catchError em todas as chamadas de analytics (nao crasha se backend falha)
- [x] FeedScreen empty state agora e ListView (scrollable, compativel com TabBarView)
- [ ] **BUG: Clicar no card crasha (tela branca). Precisa debug — provavelmente FeedScreen dentro de TabBarView conflitando**

## Fase D: Push → Cidade
- [x] _handleNotificationTap le message.data['cidade'] e navega pra CityDetailScreen
- [x] Rota /city registrada no main.dart com _CityRouteWrapper
- [ ] Nao testado ainda

## Fase E: Admin — Gestao de Grupos
- [x] Grupos integrados dentro de Monitoramentos (dentro do card do estado)
- [x] Hierarquia: Estado > Grupo (expandivel com seta) > Cidades
- [x] Checkbox "Criar grupo" no import IBGE (aparece com 2+ cidades)
- [x] Toggle grupo = cascata on/off nas cidades
- [x] Scan grupo = scan em todas cidades-membro
- [x] Editar/deletar grupo com dialog multi-select
- [x] Info de frequencia e ultimo scan no card do grupo
- [x] Cidades que pertencem a grupo nao aparecem soltas no estado

## Pendente (proxima sessao)
- [ ] **PRIORIDADE: Fix crash ao clicar card — debugar CityDetailScreen**
- [ ] Testar flow completo: cards → tap cidade → feed + overview
- [ ] Testar push deep linking
- [ ] Deploy staging apos tudo funcionar
- [ ] Problema de build: builds sem clean as vezes nao pegam mudancas
