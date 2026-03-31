# Fase 4 — Polimento & Produção

## Objetivo
Polir o sistema inteiro: admin panel, app Flutter, cost tracking. Deixar tudo production-ready.

## Roadmap

### Bloco A — Cost Tracking & Admin Panel ✅ COMPLETO
- [x] Fix provider 'brave' no cost tracking
- [x] Fix embedding cost na busca manual
- [x] Centralizar custos reais na calculadora ($0.005 Brave, $0.002 Jina, etc)
- [x] Dashboard de custos mostra provider correto (Brave/Jina/OpenAI)
- [x] SSP/SectionCrawler removidos do admin e do banco

### Bloco B — Admin Panel UI/UX (por tela) ✅ COMPLETO
- [x] **Dashboard** — 5 cards + custo real por provider + expectativa mensal + URLs rejeitadas
- [x] **Monitoramentos** — IBGE only, delete estado, borda verde
- [x] **Usuarios** — senha temporaria, redefinir, copiar
- [x] **Configuracoes** — 3 grupos (auto-scan, busca manual, filtros AI), frequencia global, custos reais
- [ ] **Noticias** — fixes rapidos pendentes (fragment key, URL parsing). Depende do B2 pra categorias

### Bloco B2 — Padronizacao de tipos de crime (Filter2 + Frontend)
Objetivo: tipos de crime padronizados em categorias fixas pro gerenciamento de risco corporativo.

**Categorias (5 grupos, 15 tipos):**

Patrimonial (afetam lojas diretamente):
- `roubo/furto` — assalto a comercio, furto em loja, arrastao
- `vandalismo` — depredacao, quebra-quebra
- `invasao` — ocupacao, saque

Seguranca de pessoas:
- `homicidio` — no entorno, afeta percepcao de seguranca
- `latrocinio` — roubo seguido de morte (gravissimo)
- `lesao corporal` — agressoes, brigas

Operacional (afetam logistica/funcionamento):
- `trafico de drogas` — no entorno, afeta clientes e funcionarios
- `operacao policial` — interdicoes, tiroteios, lojas fecham
- `manifestacao/protesto` — bloqueia acessos, risco de vandalismo
- `bloqueio de via` — afeta logistica de abastecimento

Fraude/Financeiro:
- `estelionato` — golpes envolvendo a marca
- `receptacao` — venda de produtos roubados no entorno

Institucional:
- `crime ambiental` — multas, interdicao
- `trabalho escravo/irregular` — risco reputacional
- `outros` — nao se encaixa nas categorias acima

**Classificacao por natureza:**
- `ocorrencia` — fato individual (roubo na loja X, homicidio no bairro Y)
- `estatistica` — dado agregado (roubos sobem 20%, letalidade policial cresce 33%)

Ambos entram no pipeline. Filter2 hoje rejeita estatisticas como e_crime=false — mudar pra aceitar com flag `natureza: 'estatistica'`. No app/admin, cliente ve os dois mas pode filtrar. Estatisticas podem virar card separado "Indicadores da regiao".

**Implementacao:**
- [ ] Atualizar prompt Filter2 com lista fixa de categorias + natureza + categoria_grupo
- [ ] Atualizar types.ts (NewsExtraction) e queries.ts (insertNews) com novos campos
- [ ] Validacao no backend: tipo_crime deve ser uma das 15 categorias
- [ ] Filter2: aceitar estatisticas com natureza='estatistica' (hoje rejeita)
- [ ] Admin panel: cores/filtros por categoria na tela Noticias
- [ ] Admin panel: filtro por natureza (ocorrencia vs estatistica)
- [ ] Frontend Flutter: cards com icone/cor por categoria
- [ ] Frontend Flutter: filtro ocorrencia vs estatistica
- [x] Schema: coluna `natureza` e `categoria_grupo` adicionadas (migration 013)
- [x] Schema: coluna `must_change_password` em user_profiles (migration 013)

### Bloco C — Flutter App UI/UX
- [ ] **Primeiro login**: apos login com senha temporaria, redirecionar pra tela "Crie sua nova senha"
- [ ] **Flag must_change_password**: backend marca true na criacao/reset, Flutter checa apos login
- [ ] **Biometria**: opcao de usar padrao do dispositivo (fingerprint/face) em vez de senha
- [ ] **Endpoint POST /auth/change-password**: backend atualiza senha via Supabase Auth
- [ ] (mais itens a mapear quando abrir o app)

### Bloco D — Deploy & Produção
- [ ] Configurar env vars produção
- [ ] Deploy backend (Render)
- [ ] Deploy admin (Vercel)
- [ ] Build release APK
- [ ] Teste E2E em produção
- [ ] Rodar migrations 010 + 011 em produção

## Sessoes

### Sessao 015 (2026-03-28/30) — Inicio Fase 4 + Polimento Admin
**Backend fixes:**
- Fix provider cast: 'brave' agora registrado no cost tracking (era 'google')
- Fix embedding cost na busca manual (+extractions*0.00002)
- getDashboardStats: novo campo scansToday
- clearRejectedUrls + DELETE /dashboard/rejected-urls endpoint
- Motivos legiveis: "URL bloqueada (regex)", "Nao criminal", "Local errado: {cidade}", "Data antiga: {data}"
- Reset password endpoint: POST /users/:id/reset-password
- createUser aceita password do frontend (8 chars, sem ambiguos)
- generateTempPassword: 8 chars alfanumericos (sem 0/O/1/l)

**Dashboard:**
- 5 cards: Noticias enviadas, Cidades ativas, Custo mensal, Taxa sucesso, Scans hoje
- Grid lg:grid-cols-5
- Badges novos: Local errado (laranja), Data antiga (azul), Fetch falhou (cinza)
- Botao Limpar URLs rejeitadas

**Monitoramentos:**
- Removidos botoes "+Estado" e "+Cidade" (so Importar IBGE agora)
- Botao delete de estado (lixeira no header do card)
- Card com borda verde quando tem cidades ativas, badge verde/cinza

**Usuarios:**
- Senha temporaria gerada no dialog de criacao (8 chars, refresh, copiar)
- Botao redefinir senha (chave azul) com dialog de nova senha
- Backend aceita password do frontend

**Pendente (proxima sessao):**
- Bloco B2: padronizacao tipos de crime (15 categorias em 5 grupos)
- Bloco C: Flutter (primeiro login, biometria, troca senha)

### Sessao 016 (2026-03-30) — Configuracoes + Custos + Auditoria

**Configuracoes (polish completo):**
- Deletado devRoutes.ts (backend) + removida tab Dev Tools do admin
- Removidos metodos mock da api.ts (seedNews, triggerNotification, clearMock)
- Removido import condicional de devRoutes no routes/index.ts
- Renomeada tab "Custos" → "Configuracao de Custos"
- Trocado "Perplexity Search" → "Brave News" em toda a UI
- Reorganizada tab Configuracoes em 3 grupos claros:
  1. **Monitoramento Automatico** — frequencia (select global, atualiza todas cidades), URLs por busca, estimativa custo/cidade/mes
  2. **Busca Manual** — URLs por periodo (30d/60d/90d) com custo estimado por busca
  3. **Filtros AI** — confianca minima, similaridade deduplicacao
- Removidos cards de providers (Brave News, Google RSS) e toggle Regex da UI
- Frequencia de scan: novo endpoint GET/PATCH /locations/scan-frequency (movido antes de /:id pra evitar conflito de rota)

**Cost Tracking fix:**
- Backend /settings/cost-estimate: provider agora usa { brave, jina, openai } (era { perplexity })
- Mapeamento legacy: google/perplexity → brave
- Removido filtro .eq('source', 'auto_scan') — agora mostra custo total (auto + manual)
- Custos reais por operacao na calculadora:
  - Brave: $0.005/query
  - Jina: $0.002/URL
  - OpenAI Filter1: $0.0002/batch
  - OpenAI Filter2: $0.0005/URL
  - OpenAI Embedding: $0.00002/embedding
- Estimativa auto-scan usa custos reais × URLs config × frequencia × cidades
- Estimativa busca manual usa custos reais × URLs por periodo

**Dashboard:**
- Adicionado card "Custo real este mes por provider" (Brave, Jina, OpenAI)
- Adicionado card "Expectativa mensal" com scans/dia reais (backend calcula 1440/freq por cidade)
- Backend retorna estimatedScansPerDay no /settings/cost-estimate

**Migration 012:**
- 012_ensure_manual_search_configs.sql — garante configs de busca manual no banco + fix default search_max_results

**Verificacao thresholds:**
- Todos 9 thresholds funcionando (filter2_confidence_min, dedup_similarity_threshold, search_max_results, manual_search 30/60/90d, filter0_regex_enabled, google_news_rss_enabled, auth_required)
- 3 configs de busca manual faltavam no schema (migration 012 corrige)

**Auditoria completa (3 agentes paralelos):**
- Backend: 17 issues reportados → verificados → TODOS falsos alarmes ou by-design
- Admin: 29 issues reportados → maioria P2 (nice-to-have)
- Flutter: 23 issues reportados → verificados → Supabase anon key e publica, token refresh automatico pelo SDK

**Tela Noticias (pendente — fixes rapidos):**
- [ ] Fragment sem key na linha 168 (React warning)
- [ ] try/catch no new URL(src.url) (pode crashar com URL invalida)
- [ ] Filtro de cidade poderia ser select com cidades do banco
- [ ] CRIME_COLORS vai mudar com Bloco B2 (15 categorias)

### Sessao 017 (2026-03-30) — Auditoria SQL + Migration 013

**Auditoria completa de migrations (001-012):**
- Verificado: todas as tabelas, colunas, FK, indexes, configs alinhados com codigo
- 7 issues encontrados e corrigidos na migration 013

**Migration 013 criada e rodada (prepare_b2_c_fixes.sql):**
- UNIQUE constraint em api_rate_limits.provider
- Deletado provider 'perplexity' do rate_limits (legado, usamos brave)
- scan_cron_schedule corrigido: '0 * * * *' → '*/5 * * * *'
- manual_search_max_results_30d corrigido: 15 → 50
- Limpeza configs mortas: ssp_scraping_enabled, section_crawling_enabled/max_domains
- CASCADE adicionado em monitored_locations.parent_id (delete estado = deleta cidades)
- Nova coluna news.natureza (ocorrencia/estatistica) — prep B2
- Nova coluna news.categoria_grupo (patrimonial/seguranca/operacional/fraude/institucional) — prep B2
- Nova coluna user_profiles.must_change_password — prep Bloco C

**Migrations 011 + 012 + 013 rodadas no Supabase e verificadas.**

**Schema.sql atualizado** pra refletir estado final do banco.

**Bloco B2 implementado (backend + admin):**
- types.ts: TipoCrime (15 categorias), CategoriaGrupo (5 grupos), Natureza, mapa TIPO_CRIME_GRUPO
- filter2GPT.ts: prompt novo com categorias explicitas, aceita estatisticas, valida tipo_crime
- queries.ts: insertNews aceita natureza + categoria_grupo
- scanPipeline.ts + manualSearchWorker.ts: passam novos campos
- api.ts: NewsItem atualizado
- news/page.tsx: cores por grupo, filtros categoria/natureza, fix fragment key, fix URL parsing

**Pendente (proxima sessao):**
- [ ] Testar B2 com scan real (ativar cidade, rodar, ver categorias)
- [ ] Bloco C: Flutter (primeiro login, troca senha, biometria)
- [ ] Bloco D: Deploy
