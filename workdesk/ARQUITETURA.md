
# SIMEops / PROGESTAO - ARQUITETURA DO SISTEMA
## Documento Tecnico Atualizado (Fase 3 — Sessao 012)

```
+==============================================================================+
|                                                                              |
|     S I M E o p s  -  P R O G E S T A O                                     |
|     Sistema de Monitoramento de Ocorrencias Policiais                       |
|                                                                              |
|     "Monitoramento automatico 24/7 de ocorrencias policiais em cidades      |
|      brasileiras, usando IA para coletar, filtrar e entregar noticias       |
|      relevantes direto no celular."                                         |
|                                                                              |
+==============================================================================+
```

---

## O QUE O SISTEMA FAZ (Resumo Executivo)

```
   O SIMEops e um "robo jornalista" que:

   1. VARRE a internet brasileira atras de noticias de ocorrencias policiais
   2. FILTRA o que e relevante usando IA (elimina lixo, spam, categorias)
   3. CONSOLIDA mesma ocorrencia de fontes diferentes (dedup embedding)
   4. ENVIA alerta no celular do usuario em tempo real
   5. PERMITE busca manual por cidade, palavra-chave e periodo

   Tudo isso rodando AUTOMATICAMENTE, 24 horas por dia.
```

---

## VISAO GERAL - MAPA DO SISTEMA

```
+-------------------------------------------------------------------------+
|                          INTERNET                                       |
|                                                                         |
|   [Brave News]    [Google News]                                         |
|   Search API      RSS Feed                                              |
|   (principal)     Gratis (complementar)                                 |
|      |            |                                                     |
+------+------------+----------------------------------------------------+
       |            |
       v            v
+-------------------------------------------------------------------------+
|                                                                         |
|   Backend (Node.js + TypeScript + Express + BullMQ)                     |
|                                                                         |
|   +--------------------------------------------------------------+     |
|   |              PIPELINE CORE (pipelineCore.ts)                  |     |
|   |  "Stages compartilhados entre auto-scan e busca manual"      |     |
|   |                                                               |     |
|   |  URL -> Filter0 -> Filter1 -> Jina -> Filter2+Embed -> Dedup |     |
|   |         (regex)   (GPT batch) (read)  (GPT full)   (cluster) |     |
|   +--------------------------------------------------------------+     |
|                          |                                              |
+------+-------------------+------+---------------------------------------+
       |                   |      |
       v                   v      v
   +-----------+   +-----------+  +--------------+
   |  SUPABASE |   |   APP     |  | ADMIN PANEL  |
   | PostgreSQL|   |  MOBILE   |  | Next.js 16   |
   | + pgvector|   | (Flutter) |  | (webpack)    |
   +-----------+   +-----------+  +--------------+
```

---

## INFRAESTRUTURA - SERVICOS EXTERNOS

```
+---------------------------------------------------------------------+
|                                                                     |
|  SUPABASE (supabase.com)                                            |
|  - PostgreSQL + pgvector (busca por similaridade)                   |
|  - Autenticacao (JWT para admins e usuarios)                        |
|  - API automatica                                                   |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
|  FIREBASE (firebase.google.com)                                     |
|  - Push notifications no celular (mesmo com app fechado)            |
|  - Gratis ate 10.000 mensagens/mes                                  |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
|  OPENAI / GPT (openai.com)                                         |
|  - Filter1: Le titulos em lote, decide "e ocorrencia?" (toggle)    |
|  - Filter2: Le artigo inteiro, extrai dados estruturados            |
|    (tipo_crime livre, cidade, bairro, data, resumo, confianca)      |
|  - Embeddings: text-embedding-3-small (1536 dims, dedup)           |
|  - Dedup GPT: confirma duplicatas quando similarity >= 0.85        |
|  Modelo: GPT-4o-mini                                                |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
|  JINA AI (jina.ai)                                                  |
|  - Acessa URL e extrai SO o conteudo util (sem ads/menus)           |
|  - Cache inteligente: NAO cacheia <100 chars                        |
|  - Custo: $0.002 por pagina                                        |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
|  BRAVE NEWS SEARCH API (api.search.brave.com)                       |
|  - Search provider PRINCIPAL                                        |
|  - Ate 50 resultados/request, paginacao via offset                  |
|  - Params: country=BR, safesearch=off, ui_lang=pt-BR                |
|  - Custo: $0.005 por query                                         |
|  - Prompt otimizado: "noticias policiais ocorrencias crimes         |
|    assalto roubo homicidio prisao trafico operacao policial          |
|    flagrante {cidade}, {estado}"                                     |
|  - Config de max_results por periodo (admin panel):                  |
|    auto-scan: 15 | manual 30d: 50 | 60d: 50 | 90d: 80              |
|                                                                     |
|  Google News RSS (complementar, gratis):                            |
|  - Feed RSS sem API key, date pre-filter por pubDate                |
|  - Agrega 1-5 URLs extras por busca                                |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
|  REDIS / Upstash                                                    |
|  - Fila de tarefas (BullMQ)                                        |
|  - Cache de configs (5 min refresh)                                 |
|  - Cache de conteudo Jina (24h, so se >100 chars)                   |
|  - Cache de embeddings (30 dias, valida dim=1536)                   |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## PIPELINE CORE (pipelineCore.ts)

```
  Stages compartilhados entre AUTO-SCAN e BUSCA MANUAL.
  Cada pipeline chama essas funcoes e customiza via parametros.

  +==================================================================+
  |  STAGE 1: FILTER0 (Regex, local, $0)                             |
  |  Bloqueia: redes sociais, paginas de categoria, lixo             |
  |  Toggle: filter0_regex_enabled                                    |
  +==================================================================+
                         |
                         v
  +==================================================================+
  |  STAGE 2: FILTER1 (GPT Batch, ~$0.0002/lote)                    |
  |  Manda todos os titulos de uma vez pro GPT                        |
  |  Resposta: [true, false, true, ...]                               |
  |  Retry 1x antes de fallback "all true"                            |
  +==================================================================+
                         |
                         v
  +==================================================================+
  |  STAGE 3: CONTENT FETCH (Jina, $0.002/artigo)                   |
  |  Le cada URL, extrai texto limpo                                  |
  |  Descarta <100 chars antes do GPT                                 |
  |  Concorrencia: 5 paralelos (configuravel)                        |
  +==================================================================+
                         |
                         v
  +==================================================================+
  |  STAGE 4: FILTER2 + EMBEDDING (GPT + OpenAI, ~$0.0005/artigo)   |
  |  Extrai: tipo_crime, cidade, bairro, data, resumo, confianca     |
  |  Gera embedding 1536-dim do resumo                                |
  |  Post-filters opcionais: data fora do periodo, cidade fora        |
  +==================================================================+
                         |
                         v
  +==================================================================+
  |  STAGE 5: DEDUP INTRA-BATCH (Embedding clustering, $0)           |
  |  Compara todos os resultados entre si (cosine >= 0.85)            |
  |  Consolida: melhor confianca como lead, todas as fontes           |
  |  Ex: 34 resultados -> 28 (6 consolidadas)                        |
  +==================================================================+
```

---

## AUTO-SCAN (scanPipeline.ts)

```
  Disparado por CRON (a cada hora).
  Usa pipelineCore + dedup contra DB + push por noticia.

  Fontes: Brave News + Google News RSS
  Query: templates rotativos (queryTemplates.ts, round-robin)
  Multi-query: 2 queries por scan (configuravel)

  Apos pipelineCore:
  +==================================================================+
  |  STAGE 6: DEDUP CONTRA DB (3 camadas)                            |
  |  Layer 1: Geo-temporal (SQL, $0) — mesma cidade+crime+data       |
  |  Layer 2: Embedding similarity (cosine >= 0.85, $0)              |
  |  Layer 3: GPT confirma (~5% dos casos, $0.001)                   |
  |  Se duplicata: adiciona URL como fonte extra                      |
  |  Se nova: salva + push notification                               |
  +==================================================================+
```

---

## BUSCA MANUAL (manualSearchWorker.ts)

```
  Disparada pelo usuario no app mobile.
  Usa pipelineCore + filtro cidade/estado + progress tracking.

  Diferencas do auto-scan:
  - Filtro de cidade/estado pos-Filter2 (Brave traz noticias nacionais)
  - Max results configuravel por periodo (30d/60d/90d no admin panel)
  - Resultados salvos em search_results (JSONB, com sources[])
  - Dedup intra-batch com embedding (consolida fontes no mesmo card)
  - SEM dedup contra DB (por enquanto)
  - Push "busca concluida" pro usuario

  Query otimizada pro Brave:
  - Default: "noticias policiais ocorrencias crimes assalto roubo
    homicidio prisao trafico operacao policial flagrante {cidade}, {estado}"
  - Com keyword: "{tipoCrime} {cidade}, {estado}"

  Pipeline: 7 stages
  1. Search (Brave + RSS, 1 query por cidade)
  2. Filter0 (regex)
  3. Filter1 (GPT batch)
  4. Fetch (Jina)
  5. Filter2 + Embedding (GPT + filtro cidade/data)
  6. Dedup intra-batch (embedding clustering)
  7. Save (search_results)
```

---

## CONFIGURACOES DO ADMIN PANEL

```
  +-------------------------------------------------------------+
  |  CONFIG KEYS (configManager, cache 5 min)                    |
  |                                                              |
  |  Pipeline:                                                   |
  |  - search_max_results ............. 15 (auto-scan)           |
  |  - manual_search_max_results_30d .. 50                       |
  |  - manual_search_max_results_60d .. 50                       |
  |  - manual_search_max_results_90d .. 80                       |
  |  - content_fetch_concurrency ...... 5                        |
  |  - filter0_regex_enabled .......... toggle                   |
  |  - filter2_confidence_min ......... 0.7                      |
  |  - filter2_max_content_chars ...... 4000                     |
  |  - dedup_similarity_threshold ..... 0.85                     |
  |                                                              |
  |  Fontes:                                                     |
  |  - multi_query_enabled (auto-scan)                           |
  |  - search_queries_per_scan ........ 2                        |
  |  - google_news_rss_enabled                                   |
  |                                                              |
  |  Sistema:                                                    |
  |  - monthly_budget_usd ............. 100                      |
  |  - budget_warning_threshold ....... 0.9                      |
  |  - scan_cron_schedule ............. 0 * * * *                |
  |  - worker_concurrency ............. 3                        |
  |  - push_enabled ................... true                     |
  |  - auth_required .................. true                     |
  |                                                              |
  +-------------------------------------------------------------+
```

---

## STACK TECNOLOGICO

```
  +-------------------------------------------------------------+
  |                                                              |
  |  Backend:  Node.js + TypeScript + Express + BullMQ           |
  |  Admin:    Next.js 16.1.6 + shadcn/ui + Tailwind v4         |
  |  Mobile:   Flutter / Android                                 |
  |  DB:       Supabase PostgreSQL + pgvector                    |
  |  Cache:    Redis (Upstash)                                   |
  |  Push:     Firebase Cloud Messaging                          |
  |  IA:       OpenAI GPT-4o-mini + text-embedding-3-small       |
  |  Scraping: Jina AI Reader                                    |
  |  Busca:    Brave News Search API (principal)                 |
  |            Google News RSS (complementar, gratis)            |
  |                                                              |
  +-------------------------------------------------------------+
```

---

## CONTROLE DE CUSTOS

```
  +-------------------------------------------------------------+
  |  CUSTO ESTIMADO POR SCAN (auto-scan, 1 cidade)              |
  |                                                              |
  |  Brave News Search ......... $0.005  (1 query, 15 URLs)     |
  |  Google News RSS ........... $0.000  (gratis)                |
  |  Jina (leitura) ............ $0.014  (~7 artigos)            |
  |  OpenAI Filtro 1 ........... $0.000  (~gratis)               |
  |  OpenAI Filtro 2 ........... $0.004  (~7 artigos)            |
  |  OpenAI Embeddings ......... $0.000  (~gratis)               |
  |  -----------------------------------------------             |
  |  TOTAL POR SCAN: ~$0.02                                      |
  |                                                              |
  |  CUSTO POR BUSCA MANUAL (50 URLs, 30d)                      |
  |  Brave News Search ......... $0.005                          |
  |  Jina ...................... $0.060  (~30 artigos)            |
  |  OpenAI .................... $0.015                           |
  |  -----------------------------------------------             |
  |  TOTAL POR BUSCA: ~$0.08                                     |
  |                                                              |
  |  Protecoes: orcamento mensal, alerta 90%, pausa automatica   |
  |                                                              |
  +-------------------------------------------------------------+
```

---

## CODIGO — ARQUIVOS PRINCIPAIS

```
  backend/src/
    jobs/pipeline/
      pipelineCore.ts ......... Stages compartilhados (filter0-dedup)
      scanPipeline.ts ......... Auto-scan (CRON + dedup DB + push)
    jobs/workers/
      manualSearchWorker.ts ... Busca manual (filtro cidade + progress)
    services/
      search/
        BraveNewsProvider.ts .. Brave News API (paginacao, safesearch=off)
        GoogleNewsRSSProvider.ts  RSS gratis (date pre-filter)
        queryTemplates.ts ..... Templates de query (auto-scan)
        urlDeduplicator.ts .... Normaliza e dedup URLs
      filters/
        filter0Regex.ts ....... Regex local (domains, categorias)
        filter1GPTBatch.ts .... GPT batch (titulos, toggle)
        filter2GPT.ts ......... GPT full (extracao estruturada)
      embedding/
        OpenAIEmbeddingProvider.ts
        CachedEmbeddingProvider.ts  (Redis, valida dim=1536)
      deduplication/
        index.ts .............. 3 camadas (geo+embed+GPT)
      content/
        JinaContentFetcher.ts
        CachedContentFetcher.ts (NAO cacheia <100 chars)
    database/
      queries.ts .............. Embedding como pgvector string
```
