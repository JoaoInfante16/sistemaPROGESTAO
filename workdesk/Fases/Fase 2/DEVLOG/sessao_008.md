# DEVLOG - Sessao 008
**Data**: 2026-03-22
**Foco**: Redesign mobile UX + Pipeline debug + Otimizacao de busca

---

## Contexto
Sessao com foco em polir a UX do app mobile e diagnosticar por que buscas manuais retornavam 0 resultados mesmo com artigos sendo baixados. Descoberta: Perplexity retornava paginas de categoria/tag (ex: metropoles.com/tag/policia-civil) em vez de noticias individuais de crime.

## Parte 1: Mobile UX Redesign

### Login Screen
- [x] Titulo: "SIMEops - PROGESTAO" + subtitulo "Sistema de Monitoramento de Ocorrencias Policiais"

### Tab Busca (SearchScreen) — Rewrite completo
- [x] Removida barra de pesquisa "buscar noticias" + filtros
- [x] Adicionado botao "Nova Busca" (FilledButton.icon, full width) no topo
- [x] Historico de buscas anteriores com cards (HistoryCard)
- [x] Pull-to-refresh + refresh ao voltar de ManualSearchScreen
- [x] Removido FAB do MainScreen (botao agora esta na tab)

### HistoryCard — Widget publico extraido
- [x] Extraido `_HistoryCard` de search_history_screen.dart para widgets/history_card.dart
- [x] Reutilizado em SearchScreen e SearchHistoryScreen

### Nova Busca — Keyword field
- [x] Removido dropdown de tipo de crime (lista fixa)
- [x] Adicionado campo de texto com checkbox toggle:
  - Desmarcado: campo desabilitado, hint "Todos", fundo cinza (tema)
  - Marcado: campo habilitado, usuario digita palavra-chave livre
- [x] Backend ja aceita texto livre no campo tipo_crime (2-50 chars)
- [x] Cor corrigida para dark mode (surfaceContainerHighest)

### MultiCitySearchField — Dropdown de cidades
- [x] Ao tocar no campo vazio, mostra todas as cidades do estado selecionado
- [x] Icone de seta dropdown adicionado
- [x] Hint atualizado: "Toque para ver cidades ou digite..."
- [x] Max height do overlay aumentado (200 → 250px)

## Parte 2: Pipeline Debug

### Logs detalhados de rejeicao
- [x] filter2GPT: nova funcao `filter2GPTWithReason` que retorna motivo da rejeicao
  - `e_crime=false`, `confianca=X (min=Y)`, `tipo_crime_invalido=Z`, `data_invalida=X`, etc.
- [x] manualSearchWorker: log em cada etapa com contagem
  - `filter0: 10 → 6 (4 rejeitadas)`
  - `filter1: 6 → 5 (1 rejeitadas)`
  - `filter2 REJEITOU url... motivo: e_crime=false`
  - Resumo final com todos os motivos

### Diagnostico (busca SP, 30 dias)
Pipeline: 10 URLs → filter0: 6 → filter1: 5 → filter2: **0**
- Filter0: 4 bloqueadas (regex — social media)
- Filter1: 1 bloqueada (GPT snippet nao-crime)
- Filter2: 5 bloqueadas (TODAS com e_crime=false)
- **Causa raiz**: Perplexity retorna paginas de categoria/tag em vez de noticias individuais
  - agenciasp.sp.gov.br/editoria/seguranca-publica/ (pagina de secao)
  - metropoles.com/tag/policia-civil-de-sao-paulo (pagina de tag)
  - rj.gov.br/isp/node/2278 (portal de estatisticas)

## Parte 3: Otimizacao de busca (PENDENTE — proximo passo)

### Problema identificado
A query "Resumo completo de TODAS ocorrencias policiais em X" e muito generica.
Perplexity retorna paginas agregadas (portais, tags, categorias) em vez de noticias individuais.

### Solucoes planejadas
1. **search_recency_filter**: Passar `dateRestrict` baseado no `periodoDias` do usuario para Perplexity priorizar noticias recentes
2. **Query reformulada**: Mudar de "resumo completo de ocorrencias" para pedir noticias individuais recentes de crime
3. **search_max_results**: Subir default para 20 (Perplexity aceita ate 20)

---

## Arquivos Modificados
| Arquivo | Mudanca |
|---------|---------|
| `mobile-app/.../login_screen.dart` | Textos atualizados |
| `mobile-app/.../search_screen.dart` | Rewrite: botao Nova Busca + historico |
| `mobile-app/.../main_screen.dart` | Removido FAB + import |
| `mobile-app/.../manual_search_screen.dart` | Keyword field + removido history icon |
| `mobile-app/.../multi_city_search_field.dart` | Show all cities on tap |
| `mobile-app/.../search_history_screen.dart` | Usa HistoryCard publico |
| `backend/src/services/filters/filter2GPT.ts` | filter2GPTWithReason + motivos |
| `backend/src/jobs/workers/manualSearchWorker.ts` | Logs detalhados de rejeicao |

## Arquivos Criados
| Arquivo | Descricao |
|---------|-----------|
| `mobile-app/.../widgets/history_card.dart` | Widget publico HistoryCard |
| `workdesk/Fase 2/DEVLOG/sessao_008.md` | Este devlog |
