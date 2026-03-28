# Fase 3 — Progresso

## Roadmap

### Bloco A — Bugs criticos
- [x] Criar tabela `pipeline_rejected_urls` (migration 006)
- [x] Fix `Failed to track cost` — CHECK constraint nao incluia 'perplexity' (migration 007)
- [x] Fix Filter1 batch length mismatch — agora ajusta ±1-2 em vez de descartar tudo

### Bloco B — Otimizacoes de pipeline
- [x] Dedup candidate limit 10→50 (queries.ts)
- [~] Date filtering pos-GPT — analisado, nao tem como mover (data vem da extracao). dateRestrict na query ja filtra na fonte
- [x] Budget enforcement — check no inicio de scanPipeline e manualSearchWorker, skip se >= monthly_budget_usd
- [ ] Centralizar custos em config (hardcoded $0.005, $0.002 etc.)

### Bloco C — Qualidade de resultados (PRIORIDADE — pipeline perde muita noticia)
- [x] Multi-source habilitado (Perplexity + RSS + Section Crawler + SSP)
- [x] Filter1 chunking (batches de 30 pra nao crashar com 100+ snippets)
- [x] Section Crawler cache 'none' TTL reduzido pra 3 dias
#### Prioridade ALTA — proximo a implementar
- [x] **Brave News Search API** — implementado como provider. 50 resultados/query, $0.005/query, date range customizado. SEARCH_BACKEND=brave. Migration 008. TESTAR se realmente retorna 50 resultados
- [x] **RSS date pre-filter** — extrai `<pubDate>` no parser RSS e descarta artigos fora do periodoDias ANTES do Jina. Economiza ~$0.07/busca. scanPipeline usa maxAgeDays=7
- [x] **Dedup na busca manual** — dedup leve (cidade+tipo_crime+data) entre resultados da propria busca antes de salvar. Sem embedding, gratis
- [x] **Prompt Brave otimizado** — query antiga trazia 23% de ocorrências reais (lixo: estatísticas). Nova query traz 86% (43/50 reais). Adicionado `safesearch=off` (violência era filtrada!), `ui_lang=pt-BR`, count 20→50. Testado via curl com 50 URLs SP 60d
- [ ] **Subir concorrencia Jina 5→10** — busca levou ~5min, metade foi Jina. config content_fetch_concurrency

#### Prioridade MEDIA
- [ ] **Multiplas queries + dedup consolidado** — Brave e Perplexity retornam max ~15 URLs (limite do indice, nao da API). Solucao: 3 queries por cidade (generica + prisoes + homicidios) → ~40 URLs. Requer dedup com agregacao de fontes: titulo fuzzy Jaccard >=0.7, agrupar mesma ocorrencia de fontes diferentes no mesmo card. Frontend precisa mostrar "N fontes" com links. Bloco grande: dedup + multi-query + frontend
- [ ] **Fallback content fetcher** — Jina vazio em alguns sites. Pesquisar: Firecrawl (API), Puppeteer (self-hosted), newspaper3k
- [ ] **Testar busca em 5+ estados** — mapear taxa de conversao por regiao (SP, RJ, MG, BA, RS, AM)

#### Prioridade BAIXA
- [ ] **Expandir Section Crawler** — mais secoes conhecidas, mais dominios regionais

### Bloco C2 — Consolidacao de ocorrencias (EM ANDAMENTO)
Objetivo: mesma ocorrencia de fontes diferentes consolidada em 1 card no app.
```
┌──────────────────────────────────────┐
│ Operacao em Paraisopolis             │
│ SSP-SP (oficial)                     │
│ G1  Record  Metropoles               │
└──────────────────────────────────────┘
```
- [x] **Dedup embedding intra-batch** — implementado nas 2 pipelines (busca manual + auto-scan). Gera embedding por resultado, clusteriza por cosine >= 0.85, consolida: melhor resumo + todas as fontes. Busca manual SP: 34→28 (6 consolidadas)
- [ ] **Multi-query na busca manual** — 3 queries por cidade (generica + prisoes + homicidios). Dedup embedding já suporta
- [ ] **search_results suporte multi-source** — schema: sources[] array ou tabela search_result_sources
- [ ] **Frontend Flutter** — card com lista de fontes clicaveis, badge por tipo (oficial/noticia)
- [ ] **SSP como fonte direta** — parsear titulo+resumo+data do markdown Jina. Badge "oficial"
- [ ] **Busca manual dedup contra DB** — se usuario busca SP 30d e depois 90d, reaproveitar resultados ja processados. Comparar URLs novas contra search_results existentes antes de processar
- [ ] **Auto-scan race condition** — 2 scans paralelos podem inserir mesma noticia antes do dedup. Lock ou upsert

### Bloco D — Hardening pre-deploy
- [x] Logs verbosos rebaixados pra debug (filter2 content preview, Jina raw response)
- [x] devRoutes — ja protegidas (NODE_ENV check duplo: index.ts + middleware interno)
- [x] Filter1 retry 1x antes de fallback "all true"
- [x] Metricas de dedup por camada (layer stats logadas + salvas no cost tracking)
- [x] **Refactor: pipelineCore.ts** — stages compartilhados extraidos (filter0, filter1, contentFetch, filter2+embedding, intraBatchDedup). scanPipeline e manualSearchWorker agora usam funções do core. Eliminou ~80% da duplicação de codigo

### Bloco E — Deploy
- [ ] Configurar env vars producao
- [ ] Deploy backend (Render)
- [ ] Deploy admin (Vercel)
- [ ] Teste E2E em producao

### Bloco F — Melhorias esteticas mobile
- [ ] (a definir — quais telas/componentes?)

### Infraestrutura (da Fase 2)
- [x] Reorganizar workdesk (SQL na raiz, ARQUITETURA na raiz, PROGRESSO unificado)
- [x] Atualizar ARQUITETURA.md para refletir estado atual do codigo

## Sessoes

### Sessao 012 (2026-03-26)
- **Refactor: pipelineCore.ts** — extraiu stages compartilhados (filter0, filter1, contentFetch, filter2+embedding, intraBatchDedup). scanPipeline e manualSearchWorker agora usam funcoes do core. Eliminou ~80% da duplicacao de codigo
- **Dedup embedding intra-batch** — implementado nas 2 pipelines. Gera embedding por resultado, clusteriza por cosine >= 0.85, consolida melhor resumo + todas as fontes. Teste SP: 34->28 (6 consolidadas)
- **Fix vector length mismatch** — root cause: Supabase JS nao converte number[] pra pgvector string. Fix: `[${embedding.join(',')}]` no insert + JSON.parse no read
- **Fix filtro cidade/estado** — pos-Filter2, valida cidade extraida vs cidades pedidas (fuzzy, sem acentos). Rejeita noticias de outras cidades
- **Brave News Provider otimizado**:
  - `safesearch=off` (noticias de violencia eram filtradas!)
  - `ui_lang=pt-BR`
  - Paginacao automatica via offset (>50 URLs)
  - Sem cap artificial — admin panel controla
- **Prompt Brave otimizado** — query antiga trazia 23% de ocorrencias reais. Nova query: "noticias policiais ocorrencias crimes assalto roubo homicidio prisao trafico operacao policial flagrante {cidade}, {estado}". Traz 86% de ocorrencias reais (43/50 testado via curl)
- **Max results por periodo** — configs separadas no admin panel: auto-scan (15), manual 30d (50), 60d (50), 90d (80). Sem limite artificial (max 100). Migration 009
- **Removidos SSP Scraper e Section Crawler** — ambos retornavam 0 resultados. SSP quebrado (sites .gov.br sao SPA), Section Crawler sem secoes mapeadas. Deletados: SSPScraper.ts, SectionCrawler.ts, sspSources.ts, sectionCrawler.test.ts. Removidos do admin panel, configManager, schema.sql
- **Fontes ativas agora**: Brave News (principal, 50 URLs) + Google News RSS (complementar, gratis, ~1-5 URLs extras)
- **Teste SP 30d**: Brave 50 URLs + RSS 1 = 51 total -> filter1 52 -> filter2 17 -> dedup 15 resultados. Muito melhor que antes (era 3 com config errada)
- **ARQUITETURA.md atualizada** — reflete estado real do codigo (pipelineCore, Brave, sem SSP/SC, configs por periodo)

### Sessao 011 (2026-03-22)
- **C1: RSS date pre-filter** — GoogleNewsRSSProvider agora extrai `<pubDate>` de cada `<item>`. Novo param `maxAgeDays` descarta artigos velhos ANTES do Jina. manualSearchWorker passa `periodoDias`, scanPipeline passa 7 dias. Economia estimada: ~$0.07/busca (evita Jina+GPT em ~35 URLs velhas)
- **C2: Dedup intra-busca manual** — Dedup leve por chave `cidade|tipo_crime|data_ocorrencia` nos resultados finais antes de salvar. Remove ocorrencias duplicadas vindas de fontes diferentes (ex: Perplexity + RSS retornam mesma noticia). Gratis (sem embedding/GPT)
- **Fix TS**: Removido `VALID_CRIME_TYPES` nao-utilizado (filter2GPT). Fix tipo `data.results` em filter1GPTBatch
- **Fix bug**: manualSearchWorker linha 358 salvava `dedupedResults` (URLs brutas) em vez de `finalResults` (resultados filtrados)
- **PIPELINE_BUSCA_MANUAL.md**: Documento de arquitetura detalhado com 7 stages, custos, protecoes, gargalos, comparacao manual vs auto-scan
- **C3: Brave News Search API** — Novo provider implementado:
  - `BraveNewsProvider.ts`: 50 resultados/query, $0.005/query, date range customizado (YYYY-MM-DDtoYYYY-MM-DD)
  - Config: `SEARCH_BACKEND=brave`, `BRAVE_API_KEY`
  - Rate limiter: 5 concurrent, 100ms spacing, 1000 daily quota
  - Migration 008: adiciona 'brave' nos CHECK constraints de budget_tracking e api_rate_limits
  - Types atualizados (queries.ts, types.ts, schema.sql)
  - .env.example atualizado com Brave como recomendado
  - Comparativo: pesquisou NewsData.io ($200/mes), GNews (~€50/mes), NewsAPI.org ($449/mes) — Brave venceu por preco/volume
  - TESTADO: Brave retorna ~15 URLs por query (limite do indice BR, nao da API). Mesmo volume que Perplexity. Vantagem: date range customizado
- **Fix: BraveNewsProvider search_lang** — API retornava 422, removido param `search_lang` (Brave News so aceita `country`)
- **Fix: Filtro de cidade/estado** — apos Filter2, valida se cidade extraida bate com cidades/estado pedidos (fuzzy, sem acentos). Rejeita noticias de outras cidades (ex: Itagimirim rejeitada em busca de Salvador)
- **Fix: Embedding cache corruption** — CachedEmbeddingProvider valida dim=1536 no cache hit. Cache corrompido (dim=19213) deletado e regenerado. Limpou 47 embeddings corrompidos do Redis
- **Teste Salvador/BA 60d**: Brave 15 + RSS 93→9 (date filter!) = 24 URLs → 10 resultados. Filtro cidade rejeitou Itagimirim e Candeias corretamente
- **Filter1 prompt expandido** — lista de crimes era restritiva (so 6 tipos). Dashboard mostrava noticias de crime rejeitadas como "nao-crime". Expandido pra "qualquer ocorrencia policial" (alinhado com Filter2)
- **Investigacao SSP**: Jina retorna conteudo da SSP-SP (52.884 noticias!) mas links apontam todos pra raiz (site e SPA). Solucao futura: parsear titulo+resumo+data direto do markdown
- **Investigacao fontes**: Brave ~15 URLs, RSS ~93 (84 velhas), SSP 0 (SPA), Section Crawler 0 (dominios sem secao). Google CSE legado/morto
- **Sessao encerrada** com foco em fechar pontas soltas antes de novas features

### Sessao 010 (2026-03-22)
- Auditoria completa do codebase (3 agentes exploraram SSP, dedup/DB, filters/content)
- Diagnostico: 15 issues categorizadas em 6 blocos (A-F)
- **A1**: Migration 006 — criar tabela `pipeline_rejected_urls` (SQL pronto, executar no Supabase)
- **A2**: Migration 007 — fix CHECK constraint `budget_tracking.provider` (faltava 'perplexity')
- **A2 root cause**: `trackCost()` enviava provider='perplexity' mas tabela so aceitava google/jina/openai
- **A3**: Filter1 batch — GPT retornava ±1 item. Agora trunca/padda em vez de fallback "all true"
- **B4**: Dedup candidate limit 10→50 em `findGeoTemporalCandidates`
- **B1**: Analisado — date filtering PRECISA ser pos-GPT (data vem da extracao). Sem mudanca
- Schema.sql atualizado (provider constraint corrigido)
- PROGRESSO.md reorganizado com roadmap completo em blocos A-F
- **D1**: Logs verbosos (filter2 content preview, Jina raw response) rebaixados de info→debug
- **D3**: Filter1 batch agora faz retry 1x antes de fallback "all true"
- **D4**: Dedup agora loga metricas por camada (layer1/2/3 stats) + salva no cost tracking details
- **D2**: devRoutes ja protegidas (NODE_ENV check duplo) — sem mudanca necessaria
- **B2**: Budget enforcement — getCurrentMonthCost() + check no inicio do scanPipeline e manualSearchWorker
- **C5**: Section Crawler cache 'none' TTL reduzido de 7→3 dias
- **Multi-source**: Busca manual agora usa Perplexity + Google News RSS + Section Crawler + SSP (antes so Perplexity + SSP)
- **max_results**: 20→50 (Perplexity retorna max ~15 na pratica, mas config pronta pra outros providers)
- **section_crawling_enabled**: false→true por default
- **Filter1 chunking**: batch dividido em chunks de 30 snippets (110 snippets crashava GPT)
- **Filter0**: +globoplay na blacklist, +patterns de secao (/noticias/slug/, /policia/, /seguranca/, /cidades/)
- **Perplexity dateRestrict**: fix mapping <=90d → 'month' (era 'year', trazia noticias de 1 ano atras)
- **Query com data explicita**: periodo >7d agora usa "desde YYYY-MM-DD" em vez de "nas ultimas X semanas"

#### Teste de eficiencia — Rio de Janeiro, 90 dias
```
Perplexity:      15 URLs (max_results=50 mas API retorna max ~15)
RSS:            +100 URLs (gratis!)
SSP RJ:           0 (portal nao retorna artigos via Jina)
Section Crawler:  0 (nenhum dominio tinha secao policial)
Total:          115 URLs
Filter0:        115 → 110 (5 regex: globoplay, categorias)
Filter1:        110 → 55  (55 GPT nao-crime — RSS traz muito lixo)
Jina:            55 → 50  (4 conteudo vazio, 1 fetch fail)
Filter2:         50 → 8   (35 data fora do periodo, 5 e_crime/cidade, 2 outros)
RESULTADO:       8 noticias em 310s (~5min)
```

#### Gargalos identificados (PRECISA REFINAR)
1. **RSS traz noticias velhas** — 35 rejeitadas por data APOS Jina+GPT (desperdicou ~$0.07). Filtrar data do RSS ANTES do Jina
2. **Perplexity retorna so ~15 URLs** — API limita independente do max_results. Precisamos de mais queries ou outro search provider
3. **SSP nao funciona pra RJ** — Jina nao extrai links da pagina gov.br. Testar outros estados
4. **Section Crawler 0** — dominios encontrados nao tinham secoes conhecidas. Expandir lista de secoes
5. **8 resultados pra RJ em 3 meses e MUITO POUCO** — deve haver centenas de ocorrencias publicadas. Pipeline esta perdendo a maioria na fonte (poucas URLs) e no filtro de data (RSS velho)

### Sessao 009 (2026-03-22)
- Inicio da Fase 3
- Reorganizacao workdesk: SQL/ movido pra raiz, ARQUITETURA.md na raiz, PROGRESSO.md unificado
- Arquitetura atualizada com 10 divergencias corrigidas (Perplexity, filter0 category patterns, filter2 tipo_crime livre, Jina limitacoes, busca manual pipeline, etc.)

---

## PONTAS SOLTAS — fechar antes de novas features

### Codigo (feito mas nao validado em producao)
- [ ] **Filter1 prompt corrigido** — expandiu pra "qualquer ocorrencia policial". TESTAR: rodar busca e checar dashboard admin, nao deve rejeitar crimes reais
- [ ] **Filtro de cidade/estado** — testou 1x (Salvador). TESTAR: buscar SP e ver se vem so SP
- [ ] **Embedding cache validation** — fix aplicado (dim=1536 check). Bug raiz: POR QUE corrompeu? Investigar se Jina ou OpenAI retornou embedding errado, ou se Redis truncou
- [ ] **Migration 008** — brave provider constraint. Confirmar que rodou no Supabase
- [ ] **Brave como SEARCH_BACKEND** — funciona mas retorna ~15 URLs (igual Perplexity). Decidir: manter Brave ou voltar Perplexity?

### Auto-scan (CRON)
- [x] **Vector length mismatch** — TESTADO OK. 14 noticias salvas sem erro de vector
- [x] **Auto-scan com pipelineCore** — TESTADO OK. SP: 30 URLs → 22 filter1 → 22 filter2 → 19 intra-dedup → 14 novas + 5 dupes ($0.065, 165s)
- [x] **Intra-batch dedup no auto-scan** — TESTADO OK. 22→19 (3 consolidadas)
- [x] **Dedup contra DB** — TESTADO OK. 5 dupes detectadas (scores 0.895-1.000), fontes adicionadas
- [x] **Pipeline skip disabled location** — adicionado check `location.active` no inicio do runPipeline
- [ ] **Filter1 batch length mismatch** — "expected 23, got 24" ainda aparece. Nao e critico (ajusta automaticamente) mas indica que GPT retorna 1 item a mais

### Painel Admin
- [x] **Delete de cidade/estado** — rota DELETE + botao lixeira no admin (com confirmacao)
- [x] **Trigger manual de scan** — TESTADO OK via admin panel (SP, job 10)
- [ ] **Dashboard URLs rejeitadas** — verificar se mostra dados corretos apos todas as mudancas
- [ ] **Configuracoes** — verificar se toggles de fontes (RSS, SSP, Section Crawler) foram limpos (SSP/SC removidos)
- [ ] **Budget tracking** — verificar se mostra provider='brave' corretamente
- [ ] **Monitoramentos** — verificar se scans automaticos aparecem com metricas corretas

### Decisoes pendentes
- [ ] Brave vs Perplexity vs dual — qual provider principal?
- [ ] Dedup: embeddings vs titulo fuzzy — qual implementar?
- [ ] SSP: parsear direto vs abandonar — quando fazer?
- [ ] Concorrencia Jina 5→10 — subir agora?

---

## Testes Pendentes

### T1 — Validacao pos-fix (rodar apos reiniciar backend)
- [ ] Busca manual Campo Grande/MS — confirmar que `Failed to track cost` sumiu
- [ ] Checar tabela `budget_tracking` no Supabase — deve ter registros com provider='perplexity'
- [ ] Checar tabela `pipeline_rejected_urls` — dashboard admin nao deve dar erro
- [ ] Busca com muitos resultados — confirmar que Filter1 batch nao faz fallback "all true" desnecessario

### T2 — Eficiencia do pipeline (busca manual em 5+ estados)
- [ ] SP (Sao Paulo) — estado grande, muitas noticias
- [ ] RJ (Rio de Janeiro) — estado grande
- [ ] MG (Belo Horizonte) — estado medio
- [ ] BA (Salvador) — nordeste
- [ ] RS (Porto Alegre) — sul
- [ ] AM (Manaus) — norte
- **Anotar para cada**: total URLs, filter0 rejeitadas, filter1 rejeitadas, Jina vazio, filter2 rejeitadas, resultados finais
- **Meta**: entender taxa de conversao real do pipeline e onde mais se perde

### T3 — Validacao SSP Scraper
- [ ] Testar SSP scraping para SP, RJ, MG, BA, RS
- [ ] Verificar se URLs .gov.br sao retornadas
- [ ] Verificar se Jina consegue extrair conteudo dessas URLs
- [ ] Anotar quais estados tem SSP funcional vs quebrado

### T4 — Validacao Google News RSS
- [ ] Busca com RSS habilitado vs desabilitado — compara resultados
- [ ] Verificar se URLs redirect do Google News resolvem via Jina
- [ ] Se nao resolvem, investigar middleware de redirect

### T5 — Dedup (quando tiver volume)
- [ ] Rodar 2 buscas iguais para mesma cidade/periodo
- [ ] Checar logs de dedup: quantas duplicatas? Qual camada pegou?
- [ ] Verificar que layer stats aparecem no log

### T6 — Budget enforcement
- [ ] Setar monthly_budget_usd pra valor baixo ($0.01) no admin panel
- [ ] Rodar busca manual — deve ser rejeitada com log de budget exceeded
- [ ] Restaurar budget pra $100

### T7 — Jina content vazio (investigacao)
- [ ] Coletar lista de URLs que retornam 0 chars
- [ ] Testar mesmas URLs no browser — tem conteudo?
- [ ] Testar com User-Agent diferente
- [ ] Pesquisar alternativas: Firecrawl (API), Puppeteer (self-hosted), newspaper3k (Python)
- [ ] Se encontrar alternativa viavel, implementar FallbackContentFetcher

### T8 — Carga e custo (estimativa)
- [ ] Calcular custo medio por busca manual (basear nos dados reais de T2)
- [ ] Estimar custo mensal com N localizacoes ativas em scan automatico
- [ ] Validar que budget de $100/mes e suficiente para uso esperado

---

### Sessao 008 (2026-03-22) — ultima da Fase 2
- Mobile UX redesign (login, tab busca, keyword field, city dropdown)
- Pipeline debug: diagnosticou Jina retornando 0 chars, cache guardando vazio
- Fix: cache inteligente (nao cacheia <100 chars), query reformulada, dateRestrict, max_results 20
- Fix admin panel: Turbopack CSS bug → trocou pra --webpack
- Resultado: busca manual funcionando (2 resultados Campo Grande/MS)
