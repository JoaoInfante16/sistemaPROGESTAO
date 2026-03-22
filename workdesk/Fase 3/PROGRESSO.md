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
- [ ] **Brave News Search API** — endpoint especifico de NOTICIAS (nao web search generico). $0.005/query (mesmo preco Perplexity), $5/mes gratis (1000 queries). Max 50 resultados/query + paginacao (10 pags). Filtro de data customizado (range exato ex: "2025-12-22to2026-03-22"). Docs: https://api-dashboard.search.brave.com/documentation/services/news-search. TESTAR se realmente retorna 50 resultados. Se sim, substitui Perplexity como fonte principal
- [ ] **RSS date pre-filter** — extrair `<pubDate>` no parser RSS e descartar artigos fora do periodoDias ANTES do Jina. Economiza ~$0.07 por busca (35 URLs velhas × Jina+GPT). Arquivo: GoogleNewsRSSProvider.ts
- [ ] **Dedup na busca manual** — resultados da mesma ocorrencia vindos de fontes diferentes aparecem duplicados, corrompe relatorios. Solucao: dedup leve (cidade+tipo_crime+data) entre resultados da propria busca antes de salvar. Sem embedding, gratis
- [ ] **Subir concorrencia Jina 5→10** — busca levou ~5min, metade foi Jina. config content_fetch_concurrency

#### Prioridade MEDIA
- [ ] **Multiplas queries** — se Brave nao resolver, fazer 3 queries por cidade (generica + prisoes + homicidios). queryTemplates ja existem no scanPipeline
- [ ] **Fallback content fetcher** — Jina vazio em alguns sites. Pesquisar: Firecrawl (API), Puppeteer (self-hosted), newspaper3k
- [ ] **Testar busca em 5+ estados** — mapear taxa de conversao por regiao (SP, RJ, MG, BA, RS, AM)

#### Prioridade BAIXA
- [ ] **Validar SSP por estado** — RJ retornou 0, PR retornou 0. Jina nao extrai links de paginas gov.br dinamicas
- [ ] **Expandir Section Crawler** — mais secoes conhecidas, mais dominios regionais

### Bloco D — Hardening pre-deploy
- [x] Logs verbosos rebaixados pra debug (filter2 content preview, Jina raw response)
- [x] devRoutes — ja protegidas (NODE_ENV check duplo: index.ts + middleware interno)
- [x] Filter1 retry 1x antes de fallback "all true"
- [x] Metricas de dedup por camada (layer stats logadas + salvas no cost tracking)

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
