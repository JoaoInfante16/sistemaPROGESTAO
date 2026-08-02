
# SIMEops / PROGESTAO - ARQUITETURA DO SISTEMA
## Documento Tecnico — revisado em 2026-08-02 (fim da Fase 8)

> 📌 **Documento vivo** — descreve o **presente**: como o sistema funciona hoje.
> Editado in-place quando algo estrutural muda, nunca arquivado com a fase. O
> historico de *como se chegou aqui* e o DEV_LOG. Ver [README](./README.md).
>
> **O que mudou nesta revisao** (reforma do backend, 02/08):
> - os assuntos pesquisados sairam do codigo e viraram config editavel no painel
>   (`search_subjects`) — a busca manual roda todos, o auto-scan em rodizio
> - peneira no STAGE 1.5 do auto-scan: URL ja salva e materia velha nao descem
>   mais pro Jina
> - dedup em camadas ligado no auto-scan (era so cosine)
> - contabilidade unica de custo — `calculateCost()` removida
> - concorrencia separada por caminho + timeouts em Jina (20s) e OpenAI (60s)
>
> **Numeros reais medidos em 02/08** (Campo Grande / 60 dias, pelo app):
> `269 URLs -> 241 baixadas -> 151 extraidas -> 77 entregues`, em 5min31s.
> O estagio 4 (Jina) e ~54% do tempo, a ~7,4s por artigo com pool de 10.
>
> Historico e medicoes anteriores: [Fases/](./Fases/). O que falta:
> [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md).

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
|   [Bright Data]   [Google News]   [Brave News]                          |
|   SERP API        RSS Feed        Search API                            |
|   (PRINCIPAL)     Gratis          (legado/fallback)                     |
|   news + web      complementar    so se SEARCH_BACKEND=brave            |
|      |            |               |                                     |
+------+------------+---------------+-------------------------------------+
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
|  BRIGHT DATA SERP API (api.brightdata.com)  — PROVIDER PRINCIPAL    |
|  Selecionado por env SEARCH_BACKEND=brightdata                      |
|                                                                     |
|  Modo NEWS (auto-scan) — API sincrona:                              |
|  - tbm=nws, qdr:d, ~20 resultados por pagina                        |
|  - Rapido (segundos). Custo: $0.0015 por request                    |
|                                                                     |
|  Modo WEB (busca manual) — Dataset API "Top 100":                   |
|  - trigger -> polling -> download de snapshot                       |
|  - ATENCAO: polling de ate 60 x 3s = 180s, com retry 1x             |
|    => ate ~6 MINUTOS por cidade no pior caso                        |
|  - 1 request = ate 100 resultados                                   |
|                                                                     |
|  Tambem usado como fallback do Jina (Web Unlocker) quando o Jina    |
|  falha com 403/422/503/SSL — ex: dominios .gov.br                   |
|                                                                     |
|  Config de max_results por periodo (admin panel):                    |
|    auto-scan: 15 | manual 30d: 50 | 60d: 50 | 90d: 80              |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
|  Google News RSS (complementar, gratis):                            |
|  - Feed RSS sem API key, date pre-filter por pubDate                |
|  - Agrega 1-5 URLs extras por busca                                |
|                                                                     |
|  Brave News Search (legado — so se SEARCH_BACKEND=brave):           |
|  - Ate 50 resultados/request. Custo: $0.005 por query               |
|  - Codigo mantido em BraveNewsProvider.ts, fora do caminho ativo    |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
|  NOMINATIM / OpenStreetMap (geocoding)                              |
|  - Converte bairro/rua em lat/lon pro CrimeRadarMap                 |
|  - Fallback em cascata: rua -> bairro -> cidade                     |
|  - Campo `precisao` persistido no CrimePoint (rua = ponto destacado)|
|  - Gratis, sem API key                                              |
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

> Atualizado em **2026-04-16** apos sessao de fixes (Fase 2).
> Stages compartilhados entre AUTO-SCAN e BUSCA MANUAL — cada pipeline chama essas
> funcoes e customiza via parametros. Setas laterais [X->] indicam rejeicoes.

### Funil de filtros — mapa detalhado

```
                +--------------------------------------+
                |  SEARCH PROVIDER (BrightData/Brave)  |
                |  Auto-scan: dateRestrict='d1'        |
                |  Manual:    searchMode web + news    |
                +--------------------------------------+
                                 |
                                 v
                    +--------------------------+
                    |  URL DEDUP               |  [X->] URL ja vista neste batch
                    |  (urlDeduplicator.ts)    |
                    +--------------------------+
                                 |
                                 v
    +----------------------------------------------------------------+
    |  STAGE 1  FILTER 0 (regex, local, $0)                          |
    |  -------------------------------------------------             |
    |  Bloqueia URL se:                                              |
    |  - dominio de rede social / video (11 dominios)                |
    |    facebook, twitter/x, tiktok, linkedin, pinterest,           |  [X->] dominio bloqueado
    |    reddit, whatsapp, INSTAGRAM, YOUTUBE/youtu.be, globoplay   |
    |  - URL de categoria/listagem (18 padroes regex)                |  [X->] pagina de categoria
    |    /tag/, /category/, /editorias/, /policia/, etc              |
    |  - snippet contem keyword nao-crime (17 palavras)              |  [X->] keyword nao-crime
    |    novela, futebol, receita, jogo, tempo, musica...            |
    |                                                                 |
    |  Toggle: filter0_regex_enabled (admin panel)                   |
    +----------------------------------------------------------------+
                                 |
                                 v
    +----------------------------------------------------------------+
    |  STAGE 2  FILTER 1 (GPT-4o-mini batch, ~$0.0002/lote de 30)   |
    |  -------------------------------------------------             |
    |  1 chamada pra cada lote de ate 30 snippets                    |
    |  Pergunta: "each is public safety? YES/NO"                     |
    |  Resposta: array boolean na ordem dos snippets                 |  [X->] GPT diz "nao e crime"
    |                                                                 |
    |  Robustez:                                                      |
    |  - Retry 1x em erro                                             |
    |  - Parse JSON invalido/length mismatch: padding true (safe)    |
    |  - API exception pos retry: THROW (BullMQ retry 5x ate 31min)  |
    |    Nao faz fallback "all true" (explodiria budget downstream)  |
    +----------------------------------------------------------------+
                                 |
                                 v
    +----------------------------------------------------------------+
    |  STAGE 3  CONTENT FETCH (Jina Reader, ~$0.002/artigo)         |
    |  -------------------------------------------------             |
    |  Baixa e extrai texto limpo de cada URL aprovada               |
    |  Concorrencia: auto-scan  content_fetch_concurrency ...... 5   |
    |                busca man. manual_search_fetch_concurrency  10  |
    |  Timeout: 20s no Jina, 30s no fallback Web Unlocker            |
    |  Cache Redis 24h (so se >100 chars)                             |
    |                                                                 |  [X->] fetch falhou
    |  Rejeita:                                                       |  [X->] conteudo <100 chars
    |  - fetch falhou (timeout, 404, etc)                             |
    |  - conteudo < 100 chars (pagina vazia ou categoria)             |
    +----------------------------------------------------------------+
                                 |
                                 v
    +----------------------------------------------------------------+
    |  STAGE 4  FILTER 2 (GPT-4o-mini full, ~$0.0005/artigo)        |
    |  -------------------------------------------------             |
    |  Envia ate 8000 chars do conteudo (config filter2_max_*)       |
    |  GPT extrai JSON estruturado:                                   |
    |  - is_crime, tipo_crime (15 cats + aliases)                    |
    |  - natureza (ocorrencia | estatistica)                         |  [X->] is_crime=false
    |  - cidade, estado, bairro, rua                                  |  [X->] confianca < 0.7
    |  - data_ocorrencia (YYYY-MM-DD, nao pode ser futura)           |  [X->] tipo_crime invalido
    |  - resumo (1-2 frases PT-BR)                                    |  [X->] data invalida/futura
    |  - confianca (>= filter2_confidence_min, 0.7 default)           |
    |                                                                 |
    |  Aliases aceitos (mapeamento feito no filter2GPT.ts):          |
    |  feminicidio->homicidio, estupro/tortura->lesao_corporal,      |
    |  sequestro->outros, corrupcao/extorsao->estelionato,           |
    |  incendio->vandalismo, porte_arma->operacao_policial           |
    +----------------------------------------------------------------+
                                 |
                                 v
    +----------------------------------------------------------------+
    |  STAGE 4.5  POST-FILTER em memoria                             |
    |  -------------------------------------------------             |
    |  (a) Data:                                                      |  [X->] data_ocorrencia antiga
    |      rejeita se data_ocorrencia < hoje - periodoDias            |
    |      auto-scan: 2 dias / manual: periodoDias do user            |
    |                                                                 |
    |  (b) Cidade + Estado:   [FIX 2026-04-16]                       |
    |      (cidadeExata || cidadeParcial) && estadoBate              |  [X->] cidade/estado fora
    |      Sempre exige estado — evita homonimas (SJ/SC vs SJ/SP).   |
    +----------------------------------------------------------------+
                                 |
                                 v
    +----------------------------------------------------------------+
    |  STAGE 5  EMBEDDING 1536-dim (OpenAI text-embedding-3-small)   |
    |  -------------------------------------------------             |
    |  Gera embedding do resumo so das noticias aprovadas            |
    |  Cache Redis 30 dias                                            |
    +----------------------------------------------------------------+
                                 |
                                 v
    +----------------------------------------------------------------+
    |  STAGE 6  DEDUP INTRA-BATCH (embedding clustering, $0)         |
    |  -------------------------------------------------             |
    |  Compara todos do batch atual entre si                          |
    |  Threshold: dedup_similarity_threshold (0.85 default, config)  |
    |  [FIX 2026-04-16: era hardcoded, agora usa mesma config da L2] |
    |                                                                 |
    |  Clusteriza: lead = maior confianca, outros viram sources[]    |
    |  Ex: 34 noticias -> 28 cards (6 mergeadas)                    |
    +----------------------------------------------------------------+
                                 |
                                 v
              +------------------+------------------+
              |                                     |
          AUTO-SCAN                             BUSCA MANUAL
          (STAGE 7 abaixo)                      (salva direto em search_results)
```

### STAGE 7: DEDUP CONTRA DB (so auto-scan, 3 camadas)

```
  +-----------------------------------------------------------------+
  |  LAYER 1  Geo-temporal (SQL, $0)                                |
  |  Busca em `news`: mesma cidade + estado + tipo + data+-1d       |
  |  + bairro tolerante a NULL  [FIX 2026-04-16]                    |
  |  Limit 200 [FIX 2026-04-16: era 50 — cortava cidades grandes]   |
  |  Sem candidatos -> NEW, insert.                                 |
  +-----------------------------------------------------------------+
                            |
                            v
  +-----------------------------------------------------------------+
  |  LAYER 2  Embedding similarity (cosine, <200ms, $0)             |
  |  Filtra candidatos com embedding dim=1536 valido                |
  |  Calcula cosine contra todos, pega top match                    |
  |  Se score < threshold (0.85, config) -> NEW, insert.            |
  +-----------------------------------------------------------------+
                            |
                            v
  +-----------------------------------------------------------------+
  |  LAYER 3  GPT confirma (so ~5% chegam aqui, ~$0.001)            |
  |  "These two summaries describe the SAME criminal event? YES/NO" |
  |  Prompt validado com scripts/test-dedup-prompt.ts (9/10).       |
  |                                                                  |
  |  Se DUPLICATE:                                                   |
  |  - insere sourceUrl + extraSourceUrls[] como fontes alternativas |
  |    [FIX 2026-04-16: antes perdia extras do cluster intra-batch] |
  |  Se NEW:                                                         |
  |  - insert news + sources + push notification por categoria      |
  +-----------------------------------------------------------------+
```

### Trocas de prompt testadas (e descartadas)

Durante a sessao 2026-04-16 tentei reescrever o prompt da Layer 3 pra reduzir um
suposto vies pro "YES". Teste com 10 pares (script acima) mostrou **regressao**:
prompt novo rigoroso demais, dava NO em casos de mesmo evento com escritas
diferentes (valor core do sistema). Revertido. Prompt antigo validado como base.

---

## AUTO-SCAN (scanPipeline.ts)

```
  Disparado por CRON — schedule vem da env SCAN_CRON_SCHEDULE (*/5 em prod).
  ATENCAO: a config `scan_cron_schedule` no DB e IGNORADA pelo scheduler.
  Usa pipelineCore + dedup contra DB + push por noticia.

  JANELA DE OPERACAO (timezone America/Sao_Paulo, forcado via Intl):
  - seg-sex 6h-18h ligado | sab-dom desligado por default
  - Fora da janela o tick inteiro e pulado (nada enfileira, nada e marcado)
  - Configs: scan_weekday_start/end, scan_weekend_enabled/start/end

  Fontes: Bright Data (modo news) + Google News RSS
  Query: assuntos do painel (config `search_subjects`), em rodizio
         - o rodizio anda 1 por execucao (scanIndex / scan_frequency_minutes),
           entao cobre a lista inteira ao longo do dia
         - location com mode='keywords' usa as palavras dela, nao a lista
  Multi-query: 2 assuntos por scan (search_queries_per_scan)
  Periodo de busca: scan_period_days (4 dias — cobre recuperacao de fim de semana)

  STAGE 1.5 — peneira barata, antes de qualquer GPT (02/08):
    - URL ja em news_sources ......... descartada (ja virou noticia salva)
    - publicada antes da janela ...... descartada (com 1 dia de folga;
                                       sem data legivel, MANTEM)
    Metricas em budget_tracking.details: jaVistas / ineditas /
    velhasPelaSerp / analisaveis

  Apos pipelineCore:
  +==================================================================+
  |  STAGE 5.5: DEDUP INTRA-BATCH EM CAMADAS (desde 02/08)           |
  |  runIntraBatchDedupLayered — o mesmo da busca manual (8.3)       |
  |  Layer 1: trava geo-temporal em memoria ($0)                     |
  |  Layer 2: cosine com dedup_similarity_threshold                  |
  |  Layer 3: GPT so na faixa duvidosa, atras de config (off)        |
  |  (era runIntraBatchDedup, so cosine — fundia crimes de datas     |
  |   diferentes e deixava passar o mesmo evento por 2 veiculos)     |
  +==================================================================+
  |  STAGE 6: DEDUP CONTRA DB (3 camadas)                            |
  |  Layer 1: Geo-temporal (SQL, $0) — mesma cidade+crime+data       |
  |  Layer 2: Embedding similarity (cosine >= 0.85, $0)              |
  |  Layer 3: GPT confirma (~5% dos casos, cobrado por TOKEN real)   |
  |  Se duplicata: adiciona URL como fonte extra                      |
  |  Se nova: salva + push notification                               |
  +==================================================================+

  CUSTO — uma contabilidade so (desde 02/08):
    `custoDoRun` acumula exatamente o que cada estagio grava em
    budget_tracking, e e ele que vai pro operation_logs.cost_usd.
    A funcao `calculateCost()` (formula paralela, taxas fixas a mao)
    foi REMOVIDA — os dois numeros discordavam por construcao.
```

---

## BUSCA MANUAL (manualSearchWorker.ts)

```
  Disparada pelo usuario no app mobile.
  Usa pipelineCore + filtro cidade/estado + progress tracking.

  Diferencas do auto-scan:
  - Filtro de cidade/estado pos-Filter2 (a busca traz noticias nacionais)
  - Roda TODOS os assuntos de `search_subjects` (o auto-scan roda N por vez)
  - Tetos derivados do periodo por raiz quadrada, SEM faixas
    (manualSearchCaps.ts). Teto de analise: manual_search_analysis_cap,
    0 = sem teto, que e o default desde 02/08
  - Concorrencia propria no estagio 4 (manual_search_fetch_concurrency = 10)
  - Resultados salvos em search_results (JSONB, com sources[])
  - Dedup intra-batch com embedding (consolida fontes no mesmo card)
  - SEM dedup contra DB (por enquanto)
  - Push "busca concluida" pro usuario
  - Progress tracking persistido (JSONB `progress` com history de stages)

  DUAL-SOURCE por cidade, em PARALELO (Promise.allSettled):
  - Web Top 100 (volume):   allintext:"{cidade}" (ocorrencia OR crime OR ...)
  - News paginado (qualidade): "noticias policiais ... {cidade} {estado}"
  Ate 80 URLs por cidade (50 web + 30 news no periodo de 30d).

  Pipeline: 7 stages
  1. Search (Bright Data web + news, 2 queries paralelas por cidade)
  2. Filter0 (regex)
  3. Filter1 (GPT batch)
  4. Fetch (Jina)
  5. Filter2 + Embedding (GPT + filtro cidade/data)
  6. Dedup intra-batch (embedding clustering)
  7. Save (search_results)

  +==================================================================+
  |  DUAS FONTES, CONFIABILIDADES DIFERENTES (medido em 2026-07-30)  |
  |                                                                   |
  |  NEWS (tbm=nws, via zone) = ALICERCE                              |
  |    Estavel: 20 resultados por cidade em TODAS as medicoes.        |
  |    E o que sustenta o auto-scan e o piso da busca manual.         |
  |                                                                   |
  |  WEB (organico, via scraper) = BONUS                              |
  |    Erratico: 85, 10, 1, 11, 98... com requisicao IDENTICA.        |
  |    NAO e instabilidade — e o Google BLOQUEANDO trafego raspado    |
  |    (respondeu results_cnt=1 pra query com 61500 resultados).      |
  |    O indice organico e o dado mais raspado da internet (SEO),     |
  |    entao e o que o Google mais defende. Independe do transporte:  |
  |    scraper e zone oscilam igual.                                  |
  |                                                                   |
  |  >>> NAO ADICIONAR RETRY POR CONTAGEM BAIXA <<<                   |
  |  Nao da pra distinguir "fui bloqueado" de "essa cidade nao tem    |
  |  noticia": Florianopolis ~26/mes, Santos 1, Aguas da Prata 1.     |
  |  Gatilho apertado queima dinheiro em cidade pequena; frouxo nao   |
  |  dispara quando precisa. Regra: repetir sobre SINAL explicito     |
  |  (x-brd-err-code), nunca sobre suspeita.                          |
  |                                                                   |
  |  PAGINACAO DO NEWS: `num` foi deprecado pelo Google (set/2025) e  |
  |  a SERP devolve ~10 por pagina. Paginar com `start` de 10 em 10.  |
  |  Com incremento de 20 o codigo PULA as posicoes 10-19 de cada     |
  |  pagina — perde ~1/3 do material. E `brd_json=1` e OBRIGATORIO    |
  |  na URL, senao vem HTML bruto e o JSON.parse falha em silencio.   |
  |                                                                   |
  |  TETO DE MATERIA-PRIMA (medido com paginacao correta, Floripa,    |
  |  30 dias): 10, 10, 10, 1, 0, 0 = **31 noticias unicas**.          |
  |  Aumentar config alem disso nao cria noticia que nao existe.      |
  |  O produto entrega "o que a imprensa publicou sobre criminalidade |
  |  na cidade", NAO "a criminalidade da cidade". Sao coisas          |
  |  diferentes, e a segunda e muito maior. Alinhar isso com cliente. |
  +==================================================================+

  +==================================================================+
  |  PERFORMANCE — LEIA ANTES DE MEXER  (auditoria 2026-07-30)       |
  |                                                                   |
  |  A validacao aceita ATE 10 CIDADES por busca (validation.ts).     |
  |  10 cidades = ate 800 URLs = 200+ artigos chegando ao Filter2.    |
  |                                                                   |
  |  O STAGE 5 RODA EM SERIE: o `for` em pipelineCore.ts faz 2 awaits |
  |  OpenAI por artigo, um de cada vez. O rate limiter permite 5      |
  |  simultaneas — a capacidade existe e NAO e usada.                 |
  |    30 artigos ~3min | 60 ~6min | 150 ~15min | 250 ~25min          |
  |                                                                   |
  |  O Flutter desiste em 10 MIN (_maxPolls=200 x 3s). Busca          |
  |  multi-cidade estoura isso => usuario ve "carregando" pra sempre. |
  |  ESTE E O BUG REPORTADO PELO CLIENTE. Detalhes e plano de fix:    |
  |  AUDITORIA_2026-07-30.md                                          |
  |                                                                   |
  |  Nenhuma chamada externa (Jina, Bright Data, OpenAI) tem timeout. |
  +==================================================================+
```

---

## CONFIGURACOES DO ADMIN PANEL

```
  +-------------------------------------------------------------+
  |  CONFIG KEYS (configManager, cache 5 min)                    |
  |                                                              |
  |  Pipeline:                                                   |
  |  - search_max_results ............. 15 (auto-scan)           |
  |  - manual_search_analysis_cap ..... 0  (0 = SEM TETO)        |
  |  - manual_search_horizon_days ..... 180                      |
  |  - content_fetch_concurrency ...... 5  (auto-scan)           |
  |  - manual_search_fetch_concurrency  10 (busca manual)        |
  |  - filter0_regex_enabled .......... toggle                   |
  |  - filter2_confidence_min ......... 0.7                      |
  |  - filter2_max_content_chars ...... 8000                     |
  |  - dedup_similarity_threshold ..... 0.85                     |
  |  - dedup_gpt_confirm_enabled ...... false (camada 3)         |
  |                                                              |
  |  Fontes:                                                     |
  |  - search_subjects ................ lista de assuntos,       |
  |      um por linha. Busca manual roda TODOS; auto-scan roda   |
  |      search_queries_per_scan por vez, em rodizio             |
  |  - manual_search_web_enabled ...... true (indice organico)   |
  |  - multi_query_enabled (auto-scan)                           |
  |  - search_queries_per_scan ........ 2                        |
  |  - google_news_rss_enabled ........ false                    |
  |                                                              |
  |  >>> O painel MESCLA banco + DEFAULTS desde 02/08. Chave     |
  |  que so existe em codigo aparece marcada origem='default'.   |
  |  Antes ela sumia da tela, e um toggle vazio lia como         |
  |  DESLIGADO enquanto o backend a usava LIGADA.                |
  |                                                              |
  |  >>> `manual_search_max_results_30d/60d/90d` NAO sao mais    |
  |  lidas por este codigo. Ficam no DEFAULTS porque a `main`    |
  |  (producao) le a _30d como teto de COLETA — significado      |
  |  diferente, mesmo banco. Somem quando a main for promovida.  |
  |                                                              |
  |  Janela do auto-scan (LIDAS, com UI no admin):               |
  |  - scan_weekday_start / end ....... 6 / 18                   |
  |  - scan_weekend_enabled ........... false                    |
  |  - scan_weekend_start / end ....... 6 / 18                   |
  |  - scan_period_days ............... 4                        |
  |                                                              |
  |  Sistema (LIDAS, mas SEM UI no admin — editar no Supabase):  |
  |  - monthly_budget_usd ............. 100                      |
  |  - push_enabled ................... true                     |
  |  - search_permission .............. authorized               |
  |  - auth_required .................. true  (tem UI)           |
  |                                                              |
  |  >>> CONFIGS MORTAS — existem no schema, NADA as le: <<<     |
  |  - scan_cron_schedule ..... scheduler usa a ENV, nao o DB    |
  |  - worker_concurrency ..... hardcoded 3 em scanWorker.ts     |
  |  - worker_max_per_minute .. hardcoded 10 em scanWorker.ts    |
  |  - scan_lock_ttl_minutes .. hardcoded 30min em cronScheduler |
  |  - budget_warning_threshold ...... nada consome              |
  |  (as 3 primeiras aparecem na lista `restartRequired` do      |
  |   settingsRoutes — a mensagem "requer restart" e enganosa:   |
  |   mesmo com restart, nao tem efeito nenhum)                  |
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
  |  Scraping: Jina AI Reader (+ Bright Data Unlocker fallback)  |
  |  Busca:    Bright Data SERP API (PRINCIPAL — news + web)     |
  |            Google News RSS (complementar, gratis)            |
  |            Brave News Search (legado, fora do caminho ativo) |
  |  Geocode:  Nominatim / OpenStreetMap (gratis)                |
  |  Erros:    Sentry (backend + admin + mobile, so producao)    |
  |                                                              |
  |  Deploy:   Render — backend e admin, Starter $7 cada         |
  |            develop (local) -> staging (free) -> main (prod)  |
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
    jobs/scheduler/
      cronScheduler.ts ........ CRON + janela de operacao + lock Redis
      billingScheduler.ts ..... Fechamento mensal de custo
    services/
      search/
        BrightDataSERPProvider.ts  PRINCIPAL — dual mode (news sync / web Top100)
        BraveNewsProvider.ts .. Legado (so se SEARCH_BACKEND=brave)
        GoogleNewsRSSProvider.ts  RSS gratis (date pre-filter)
        queryTemplates.ts ..... Assuntos pesquisados (config search_subjects,
                                editavel no painel). Fallback de fabrica em
                                ASSUNTOS_PADRAO. Busca manual roda TODOS;
                                auto-scan roda N por vez, em rodizio
        urlDeduplicator.ts .... Normaliza e dedup URLs
      executive/
        index.ts .............. Resumo executivo via GPT (cards + paragrafo)
                                Cache por cidade+estado+range e por searchId
      geocoding/
        nominatim.ts .......... lat/lon com fallback rua->bairro->cidade
      notifications/
        pushService.ts ........ Firebase FCM, filtro por categoria
      rateLimiter/
        DynamicRateLimiter.ts . Bottleneck por provider, configs do DB
                                ATENCAO: instancia unica compartilhada
                                entre auto-scan e busca manual
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
