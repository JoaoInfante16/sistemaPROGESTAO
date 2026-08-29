# Pipeline de Busca Manual — Arquitetura Detalhada
## Estado atual pos-Sessao 011

```
┌─────────────────────────────────────────────────────────────────────┐
│  INPUT: usuario escolhe estado, cidades[], periodoDias, tipoCrime?  │
│  Job enfileirado no BullMQ (concurrency: 2, max: 5/min)            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BUDGET CHECK                                                       │
│  Consulta getCurrentMonthCost() vs monthly_budget_usd               │
│  Se >= budget → status='failed', return                             │
│  Custo: $0                                                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
╔═════════════════════════════════════════════════════════════════════╗
║  STAGE 1: MULTI-SOURCE URL COLLECTOR                               ║
║  "Vasculhar a internet atras de noticias"                          ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  1a. PERPLEXITY SEARCH (1 query por cidade)                        ║
║  ┌────────────────────────────────────────────────────────────┐    ║
║  │  Query: "crimes ocorrencias policiais {cidade}, {estado}   │    ║
║  │   {periodoLabel}: noticias individuais de roubo furto      │    ║
║  │   homicidio trafico assalto prisao apreensao com data      │    ║
║  │   e local"                                                 │    ║
║  │                                                            │    ║
║  │  Se tipoCrime: "{tipoCrime} {cidade}, {estado} ..."        │    ║
║  │  dateRestrict: d1/d7/d30/d60/dN (baseado no periodoDias)  │    ║
║  │  max_results: configuravel (default 20, API retorna ~15)   │    ║
║  │  Rate limited via Bottleneck                               │    ║
║  │  Custo: $0.005/cidade                                      │    ║
║  └────────────────────────────────────────────────────────────┘    ║
║       ~15 URLs por cidade                                          ║
║                                                                     ║
║  1b. SSP SCRAPER (1x por estado, toggle: ssp_scraping_enabled)     ║
║  ┌────────────────────────────────────────────────────────────┐    ║
║  │  Acessa portal da SSP do estado via Jina                   │    ║
║  │  Extrai links de artigos (.gov.br)                         │    ║
║  │  27 estados mapeados em sspSources.ts                      │    ║
║  │  LIMITACAO: Jina nao extrai links de sites JS-heavy        │    ║
║  │  (RJ, PR retornam 0 — investigar)                          │    ║
║  │  Custo: $0.002 (1 fetch Jina)                              │    ║
║  └────────────────────────────────────────────────────────────┘    ║
║       0-10 URLs                                                     ║
║                                                                     ║
║  1c. GOOGLE NEWS RSS (por cidade, toggle: google_news_rss_enabled) ║
║  ┌────────────────────────────────────────────────────────────┐    ║
║  │  Feed: news.google.com/rss/search?q={query}&hl=pt-BR      │    ║
║  │  Parser XML proprio (sem dependencia externa)              │    ║
║  │  ★ DATE PRE-FILTER: extrai <pubDate>, descarta artigos     │    ║
║  │    mais velhos que periodoDias ANTES do Jina               │    ║
║  │    (economia: ~$0.07/busca em URLs velhas evitadas)        │    ║
║  │  Custo: $0 (gratis, sem API key)                           │    ║
║  └────────────────────────────────────────────────────────────┘    ║
║       0-50 URLs (apos date filter)                                  ║
║                                                                     ║
║  1d. SECTION CRAWLER (toggle: section_crawling_enabled)            ║
║  ┌────────────────────────────────────────────────────────────┐    ║
║  │  Extrai dominios das URLs ja encontradas                   │    ║
║  │  Tenta secoes conhecidas: /policia/, /seguranca/, /crime/  │    ║
║  │  7 dominios mapeados (G1, UOL, R7, Correio, Gaucha, etc.) │    ║
║  │  Cache Redis: 7 dias (sucesso), 3 dias (falha)            │    ║
║  │  max_domains: configuravel (default 5)                     │    ║
║  │  Custo: $0.002/dominio (Jina)                              │    ║
║  └────────────────────────────────────────────────────────────┘    ║
║       0-20 URLs                                                     ║
║                                                                     ║
║  URL DEDUP (normaliza www/tracking params/fragments)               ║
║                                                                     ║
║  RESULTADO: ~30-100 URLs unicas                                    ║
╚═══════════════════════╪═════════════════════════════════════════════╝
                        │
                        ▼
╔═════════════════════════════════════════════════════════════════════╗
║  STAGE 2: FILTER 0 — REGEX (local, $0)                            ║
║  Toggle: filter0_regex_enabled                                      ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  Bloqueia:                                                          ║
║  ✗ Redes sociais (Facebook, Twitter/X, TikTok, WhatsApp, etc.)    ║
║  ✓ YouTube e Instagram LIBERADOS                                    ║
║  ✗ URLs de categoria (/category/, /tag/, /editorias/, /page/N/)    ║
║  ✗ 37 keywords irrelevantes (esporte, receita, horoscopo, etc.)   ║
║                                                                     ║
║  Rejeitadas salvas com motivo: stage='filter0', reason='regex'     ║
║                                                                     ║
║  ~30-100 → ~25-80 URLs                                             ║
╚═══════════════════════╪═════════════════════════════════════════════╝
                        │
                        ▼
╔═════════════════════════════════════════════════════════════════════╗
║  STAGE 3: FILTER 1 — GPT BATCH (~$0.0002 total)                   ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  1 chamada GPT com TODOS os snippets (batch)                       ║
║  Resposta: [true, false, true, ...]                                 ║
║                                                                     ║
║  Protecoes:                                                         ║
║  - Retry 1x se JSON invalido ou array errado                       ║
║  - Chunks de 30 se >30 snippets (evita crash context window)       ║
║  - Length mismatch: trunca/padda em vez de fallback "all true"     ║
║  - Apos 2 falhas: fallback safe (all true, deixa Filter2 decidir) ║
║  - Rate limited via Bottleneck (provider: openai)                   ║
║                                                                     ║
║  ~25-80 → ~10-40 URLs                                              ║
╚═══════════════════════╪═════════════════════════════════════════════╝
                        │
                        ▼
╔═════════════════════════════════════════════════════════════════════╗
║  STAGE 4: JINA CONTENT FETCH                                       ║
║  Concorrencia: content_fetch_concurrency (default 5)               ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  Para cada URL: https://r.jina.ai/{url}                            ║
║                                                                     ║
║  Cache (CachedContentFetcher):                                      ║
║  - Redis, TTL 24h, key = MD5(url)                                  ║
║  - NAO cacheia conteudo <100 chars (previne cache poisoning)       ║
║  - Graceful degradation se Redis falha                              ║
║                                                                     ║
║  Fallback de campos: data.content → data.text → data.description   ║
║  Conteudo <100 chars: descartado com log + rejectedUrls             ║
║  Custo: $0.002/URL (so se nao cacheado)                            ║
║                                                                     ║
║  ~10-40 → ~8-30 com conteudo valido                                ║
╚═══════════════════════╪═════════════════════════════════════════════╝
                        │
                        ▼
╔═════════════════════════════════════════════════════════════════════╗
║  STAGE 5: FILTER 2 — GPT FULL ANALYSIS (~$0.0005/artigo)          ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  Para cada artigo, GPT extrai:                                      ║
║  ┌──────────────────────────────────────────┐                      ║
║  │  e_crime: true/false                      │                      ║
║  │  tipo_crime: string livre                 │                      ║
║  │  cidade: "Campo Grande"                   │                      ║
║  │  bairro: "Centro" (opcional)              │                      ║
║  │  rua: "Rua 14 de Julho" (opcional)        │                      ║
║  │  data_ocorrencia: "2026-03-15"            │                      ║
║  │  resumo: "Homem de 34 anos..."            │                      ║
║  │  confianca: 0.92                          │                      ║
║  └──────────────────────────────────────────┘                      ║
║                                                                     ║
║  Criterio: qualquer ocorrencia policial REAL e INDIVIDUAL          ║
║  Rejeita: estatisticas, editoriais, categorias, confianca < 0.7   ║
║  Rejeita: data_ocorrencia fora do periodoDias                      ║
║  Trunca conteudo: filter2_max_content_chars (default 4000)         ║
║  Validacao: 7 campos obrigatorios, data YYYY-MM-DD                 ║
║                                                                     ║
║  Rejeitadas salvas com motivo detalhado:                            ║
║  - "e_crime=false", "confianca_baixa=0.5", "tipo_crime_invalido"  ║
║  - "data=2025-01-10 fora do periodo (90d)"                         ║
║                                                                     ║
║  ~8-30 → ~3-15 noticias validas                                   ║
╚═══════════════════════╪═════════════════════════════════════════════╝
                        │
                        ▼
╔═════════════════════════════════════════════════════════════════════╗
║  STAGE 6: DEDUP INTRA-BUSCA ($0, local)                            ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  Chave: cidade|tipo_crime|data_ocorrencia (lowercase, trimmed)     ║
║  Remove: mesma ocorrencia vinda de fontes diferentes               ║
║  (ex: Perplexity + RSS retornam mesma noticia de jornais diff)     ║
║  Mantem primeira ocorrencia, descarta duplicatas                    ║
║                                                                     ║
║  ~3-15 → ~2-12 resultados finais                                  ║
╚═══════════════════════╪═════════════════════════════════════════════╝
                        │
                        ▼
╔═════════════════════════════════════════════════════════════════════╗
║  STAGE 7: SAVE + NOTIFY                                            ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  1. Salva em search_results (JSONB, por usuario)                   ║
║  2. Atualiza search_cache status='completed'                       ║
║  3. Push notification ao usuario (titulo + contagem)               ║
║  4. Cost tracking granular (Perplexity, OpenAI, Jina separados)    ║
║                                                                     ║
║  Se erro fatal: status='failed' + push de falha ao usuario         ║
╚═════════════════════════════════════════════════════════════════════╝
```

---

## Custo estimado por busca manual (1 estado, 1 cidade, 30 dias)

```
Perplexity Search ............. $0.005  (1 query)
Google News RSS ............... $0.000  (gratis)
SSP Scraper ................... $0.002  (1 fetch Jina)
Section Crawler ............... $0.010  (5 dominios × $0.002)
Filter 1 GPT Batch ........... $0.000  (~gratis)
Jina Content Fetch ........... $0.040  (~20 artigos × $0.002)
Filter 2 GPT Full ............ $0.010  (~20 artigos × $0.0005)
────────────────────────────────────────
TOTAL: ~$0.07 por cidade
```

## Protecoes e resiliencia

```
┌──────────────────────┬──────────────────────────────────────────┐
│ Risco                │ Protecao                                 │
├──────────────────────┼──────────────────────────────────────────┤
│ Budget estouro       │ Check no inicio, rejeita se >= limit     │
│ GPT retorna lixo     │ Retry 1x, fallback safe, validacao JSON  │
│ Jina retorna vazio   │ Cache nao salva <100ch, filtra antes GPT │
│ RSS artigos velhos   │ pubDate pre-filter antes do Jina         │
│ Resultados duplicados│ Dedup intra-busca (cidade|tipo|data)     │
│ API rate limit       │ Bottleneck por provider, daily quota      │
│ Fonte falha          │ try-catch por fonte, continua com outras  │
│ Worker crash         │ BullMQ retry 2x, exponential backoff     │
│ Push falha           │ Non-fatal, logado                         │
│ Redis down           │ Cache graceful degradation                │
│ Filter1 batch grande │ Chunks de 30, length adjustment           │
│ Custo inesperado     │ Cost tracking granular por stage          │
└──────────────────────┴──────────────────────────────────────────┘
```

## Gargalos conhecidos

```
1. VOLUME DE URLs: Perplexity retorna max ~15 URLs independente de max_results
   → Investigar Brave News Search API (promete ate 50/query)
   → RSS complementa mas traz muito lixo/artigos velhos

2. JINA VAZIO: Alguns sites retornam 0 chars (paywall, JS-heavy, anti-bot)
   → Fallback content fetcher nao implementado (Firecrawl? Puppeteer?)
   → Cache inteligente mitiga repeticao mas nao resolve raiz

3. SSP QUEBRADO: RJ, PR retornam 0 URLs (sites .gov.br dinamicos)
   → Jina nao renderiza JS — precisaria Puppeteer ou API especifica

4. TEMPO: ~3-5 minutos por busca (dominado por Jina sequential + GPT)
   → Subir concorrencia Jina 5→10 (config ja existe)
```

## Diferencas: Busca Manual vs Auto-Scan

```
┌──────────────────────┬───────────────────┬───────────────────────┐
│ Aspecto              │ Busca Manual      │ Auto-Scan             │
├──────────────────────┼───────────────────┼───────────────────────┤
│ Trigger              │ Usuario (app)     │ Cron (*/5 * * * *)    │
│ Concorrencia         │ 2 workers         │ 3 workers             │
│ Queries              │ 1/cidade          │ N rotacionadas        │
│ Fontes               │ 4 (todas)         │ 4 (todas)             │
│ RSS date filter      │ ✓ (periodoDias)   │ ✓ (7 dias fixo)      │
│ Dedup universal      │ ✗                 │ ✓ (3 camadas)         │
│ Dedup intra-busca    │ ✓                 │ ✗ (dedup universal ja)│
│ Embedding            │ ✗                 │ ✓ (pra dedup)         │
│ Destino              │ search_results    │ news (universal)      │
│ Push                 │ So pro usuario    │ Broadcast todos       │
│ Budget check         │ ✓                 │ ✓ + warning 90%       │
│ Custo medio          │ ~$0.07/cidade     │ ~$0.03/scan           │
└──────────────────────┴───────────────────┴───────────────────────┘
```
