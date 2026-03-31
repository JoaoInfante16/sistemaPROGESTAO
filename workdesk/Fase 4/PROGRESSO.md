# Fase 4 — Polimento & Produção

## Objetivo
Polir o sistema inteiro: admin panel, app Flutter, cost tracking. Deixar tudo production-ready.

## Roadmap

### Bloco A — Cost Tracking & Admin Panel
- [ ] Fix provider 'brave' no cost tracking (scanPipeline registra como 'google')
- [ ] Fix embedding cost faltando na busca manual
- [ ] Fix dedup GPT cost faltando no calculateCost total
- [ ] Centralizar constantes de custo ($0.005, $0.002 etc.) em config
- [ ] Fix sourceTypeMap no auto-scan (fontes marcadas como 'google')
- [ ] Verificar dashboard de custos no admin — mostra provider correto?
- [ ] Verificar toggles de config — SSP/SectionCrawler removidos do admin?
- [ ] Verificar monitoramentos — metricas corretas?

### Bloco B — Admin Panel UI/UX (por tela)
- [x] **Dashboard** — 5 cards (noticias enviadas, cidades ativas, custo mensal, taxa sucesso, scans hoje). Badges novos (Local errado, Data antiga). Botao limpar URLs rejeitadas. Motivos curtos e legíveis
- [ ] **Noticias** — OK por enquanto. Depende do Bloco B2 (tipos padronizados)
- [ ] **Monitoramentos** — (a avaliar)
- [x] **Usuarios** — botao redefinir senha, senha temporaria no dialog de criacao (8 chars), dialog de nova senha com copiar
- [ ] **Configuracoes** — EM ANDAMENTO, ver detalhes abaixo

### Bloco B3 — Tela Configuracoes (detalhado)
- [ ] Remover aba "Dev Tools" e endpoints de mock (deletar devRoutes.ts se possivel)
- [ ] Renomear "Custos" → "Configuracao de Custos" ou similar
- [ ] Calculadora: trocar "Perplexity Search" → "Brave News" (provider ativo)
- [ ] Calculadora: "Cidades ativas" deve puxar valor real do banco (nao 0)
- [ ] Custo real por provider: mostrar Brave em vez de Perplexity
- [ ] Custo real: mostrar real-time (atualizar automaticamente ou botao refresh)
- [ ] Aba Configuracoes: revisar cada threshold — disclaimer legivel pra leigo (quando aumentar/diminuir)
- [ ] Limpar toggles de SSP/SectionCrawler que nao existem mais
- [ ] Verificar se todos os configs do configManager aparecem e funcionam

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
- [ ] Atualizar prompt Filter2 com lista fixa de categorias
- [ ] Validacao no backend: tipo_crime deve ser uma das categorias
- [ ] Frontend Flutter: cards com icone/cor por categoria
- [ ] Admin panel: filtro por categoria na tela Noticias
- [ ] Analytics: agrupamento por categoria patrimonial/operacional/institucional
- [ ] Filter2: aceitar estatisticas com natureza='estatistica' (hoje rejeita)
- [ ] Schema: adicionar coluna `natureza` (ocorrencia/estatistica) na tabela news
- [ ] Frontend Flutter: filtro ocorrencia vs estatistica, card "Indicadores da regiao"
- [ ] Admin: filtro por natureza na tela Noticias

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

**Pendente (proxima sessao):**
- Fixes rapidos tela Noticias (fragment key, URL parsing)
- Bloco B2: padronizacao tipos de crime (15 categorias em 5 grupos)
- Bloco C: Flutter (primeiro login, biometria, troca senha)
- Rodar migration 012 no Supabase
