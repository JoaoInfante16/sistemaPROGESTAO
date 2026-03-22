
# SIMEops / PROGESTAO - ARQUITETURA DO SISTEMA
## Documento Tecnico Atualizado (Fase 3)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║     S I M E o p s  -  P R O G E S T A O                                     ║
║     Sistema de Monitoramento de Ocorrencias Policiais                       ║
║                                                                              ║
║     "Monitoramento automatico 24/7 de ocorrencias policiais em cidades      ║
║      brasileiras, usando IA para coletar, filtrar e entregar noticias       ║
║      relevantes direto no celular."                                         ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## O QUE O SISTEMA FAZ (Resumo Executivo)

```
   O SIMEops e um "robo jornalista" que:

   1. VARRE a internet brasileira atras de noticias de ocorrencias policiais
   2. FILTRA o que e relevante usando IA (elimina lixo, spam, categorias)
   3. VERIFICA se a noticia ja existe no banco (evita duplicatas)
   4. ENVIA alerta no celular do usuario em tempo real
   5. PERMITE busca manual por cidade, palavra-chave e periodo

   Tudo isso rodando AUTOMATICAMENTE, 24 horas por dia.
```

---

## VISAO GERAL - MAPA DO SISTEMA

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          INTERNET                                       │
│                                                                         │
│   [Perplexity]   [Google News]   [Jornais]   [Policia]                  │
│   Search API     RSS Feed        Secoes de   Sites da SSP               │
│   (principal)    Gratis          Noticias    (Gov.br)                   │
│      │           │              │            │                          │
└──────┼───────────┼──────────────┼────────────┼──────────────────────────┘
       │           │              │            │
       ▼           ▼              ▼            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Backend (Servidor Node.js + TypeScript + Express + BullMQ)            │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │              PIPELINE DE INGESTAO                            │      │
│   │  "Linha de montagem que transforma URL em noticia"           │      │
│   │                                                              │      │
│   │  URL → Filtro → [Filtro  → Leitura → Analise → Dedup → Salva│      │
│   │        Regex    IA Batch]  Jina      IA Full   3 camadas BD  │      │
│   │        (local)  (toggle)  (content)  (GPT)                   │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                          │                                              │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
   ┌─────────────┐ ┌─────────────┐ ┌──────────────┐
   │  SUPABASE   │ │   APP       │ │ ADMIN PANEL  │
   │  (Banco de  │ │   MOBILE    │ │ (Painel de   │
   │   Dados)    │ │  (Flutter)  │ │  Controle)   │
   │             │ │             │ │              │
   │  PostgreSQL │ │  Android    │ │  Next.js 16  │
   │  + pgvector │ │  (celular)  │ │  (webpack)   │
   └─────────────┘ └─────────────┘ └──────────────┘
```

---

## INFRAESTRUTURA - "OS TIJOLOS DA CASA"

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   SERVICOS EXTERNOS (o que usamos de terceiros)                     │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  ☁ SUPABASE (supabase.com)                                  │   │
│   │  "O banco de dados na nuvem"                                │   │
│   │  - PostgreSQL + pgvector (busca por similaridade)           │   │
│   │  - Autenticacao (JWT para admins e usuarios)                │   │
│   │  - API automatica (nao precisa escrever SQL manual)         │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  🔥 FIREBASE (firebase.google.com)                          │   │
│   │  "O servico de notificacoes push"                           │   │
│   │  - Envia notificacao no celular quando sai noticia nova     │   │
│   │  - Funciona mesmo com app fechado                           │   │
│   │  - Gratis ate 10.000 mensagens/mes                          │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  🤖 OPENAI / GPT (openai.com)                               │   │
│   │  "A Inteligencia Artificial que analisa as noticias"        │   │
│   │                                                             │   │
│   │  - Filtro 1: Le titulo/resumo e decide "e ocorrencia?"     │   │
│   │    (batch, toggleavel via admin panel)                      │   │
│   │  - Filtro 2: Le artigo inteiro e extrai dados estruturados  │   │
│   │    (tipo livre, cidade, bairro, data, resumo, confianca)    │   │
│   │  - Embeddings: Transforma texto em vetor numerico pra       │   │
│   │    comparar similaridade entre noticias (deduplicacao)      │   │
│   │  - Confirmacao: Quando duas noticias parecem iguais,        │   │
│   │    GPT confirma se sao realmente o mesmo evento             │   │
│   │                                                             │   │
│   │  Modelo: GPT-4o-mini | Embedding: text-embedding-3-small   │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  📰 JINA AI (jina.ai)                                       │   │
│   │  "O leitor de paginas web"                                  │   │
│   │                                                             │   │
│   │  - Acessa qualquer URL e extrai SO o conteudo util          │   │
│   │  - Remove propagandas, menus, rodapes, pop-ups              │   │
│   │                                                             │   │
│   │  LIMITACAO CONHECIDA: Muitos sites retornam 0 chars         │   │
│   │  (paywall, JS rendering, protecao anti-bot).                │   │
│   │  Cache inteligente: NAO cacheia conteudo <100 chars.        │   │
│   │  Worker filtra conteudo vazio antes de enviar pro GPT.      │   │
│   │                                                             │   │
│   │  Custo: $0.002 por pagina lida                              │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  🔍 PERPLEXITY SEARCH API (perplexity.ai)                   │   │
│   │  "Os olhos do sistema - encontram as noticias"              │   │
│   │                                                             │   │
│   │  Perplexity Search API (principal):                         │   │
│   │  - Pesquisa inteligente com IA embutida                     │   │
│   │  - Retorna URLs relevantes com titulo e snippet             │   │
│   │  - Suporta dateRestrict (day/week/month/year)               │   │
│   │  - max_results: ate 20 por busca                            │   │
│   │  - Configuravel via env SEARCH_BACKEND                      │   │
│   │                                                             │   │
│   │  Google News RSS (complementar, gratis):                    │   │
│   │  - Feed de noticias do Google sem API key                   │   │
│   │  - Complementa a busca principal                            │   │
│   │                                                             │   │
│   │  Google Search API (legado, descontinuado na pratica):      │   │
│   │  - Ainda disponivel via env SEARCH_BACKEND=google           │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  🏛 REDIS / Upstash (fila de tarefas + cache)                │   │
│   │                                                             │   │
│   │  - Gerencia fila de scans (BullMQ)                          │   │
│   │  - Cache de configuracoes (5 min refresh)                   │   │
│   │  - Lock distribuido (evita escanear mesma cidade 2x)        │   │
│   │  - Cache de conteudo Jina (24h, so se >100 chars)           │   │
│   │  - Cache de embeddings (30 dias)                            │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## PIPELINE AUTOMATICA (Auto-Scan) - "A LINHA DE MONTAGEM"

```
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 0: COLETA DE URLs                                        ║
  ║  "Vasculhar a internet atras de noticias"                        ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  O sistema busca noticias em 4 FONTES simultaneamente:            ║
  ║                                                                   ║
  ║  ┌─────────────────┐                                             ║
  ║  │ 1. Perplexity   │  Search API principal                      ║
  ║  │    Search API    │  Query com dateRestrict + max 20 results   ║
  ║  └────────┬────────┘                                             ║
  ║           │                                                       ║
  ║  ┌────────┴────────┐                                             ║
  ║  │ 2. Google News  │  RSS gratis, sem API key                   ║
  ║  │    RSS           │  Complementa a busca paga                  ║
  ║  └────────┬────────┘                                             ║
  ║           │                                                       ║
  ║  ┌────────┴────────┐                                             ║
  ║  │ 3. Secoes de    │  Crawling de secoes /policia/, /seguranca/ ║
  ║  │    Jornais      │  (desabilitado por padrao)                  ║
  ║  └────────┬────────┘                                             ║
  ║           │                                                       ║
  ║  ┌────────┴────────┐                                             ║
  ║  │ 4. Sites da SSP │  27 estados cobertos                       ║
  ║  │    (Gov.br)      │  Scraping via Jina                         ║
  ║  └────────┬────────┘                                             ║
  ║           │                                                       ║
  ║           ▼                                                       ║
  ║  ┌─────────────────┐                                             ║
  ║  │ DEDUP DE URLs   │  Normaliza URLs + remove duplicatas         ║
  ║  └────────┬────────┘                                             ║
  ║           │                                                       ║
  ║  Resultado: ~30-80 URLs unicas por cidade                        ║
  ╚═══════════╪═══════════════════════════════════════════════════════╝
              │
              ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 1: FILTRO RAPIDO (Regex) — TOGGLEAVEL                    ║
  ║  "Eliminar o lixo obvio sem gastar dinheiro"                     ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  Bloqueia automaticamente:                                        ║
  ║  ✗ Redes sociais (Facebook, Twitter/X, TikTok, WhatsApp, etc.)  ║
  ║  ✓ YouTube e Instagram LIBERADOS (podem ter reportagens)         ║
  ║  ✗ URLs de paginas de categoria/listagem:                        ║
  ║    /category/, /tag/, /editorias/, /ultimas-noticias/,           ║
  ║    /arquivo/, /page/N/, ?cat=N, /secao/, /topico/                ║
  ║  ✗ Assuntos irrelevantes (esporte, receita, horoscopo, etc.)    ║
  ║                                                                   ║
  ║  Config: filter0_regex_enabled (toggle no admin panel)           ║
  ║  Custo: $0 (roda local)                                          ║
  ║                                                                   ║
  ║  30-80 URLs  ──→  [ REGEX ]  ──→  15-40 URLs                    ║
  ╚═══════════════════════╪═══════════════════════════════════════════╝
                          │
                          ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 2: FILTRO IA (GPT em Lote) — TOGGLEAVEL                  ║
  ║  "A IA le os titulos e decide quais valem a pena"                ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  Manda todos os titulos DE UMA VEZ pro GPT.                      ║
  ║  Resposta: [true, false, true, true, false, ...]                  ║
  ║                                                                   ║
  ║  Config: toggle no admin panel (pode ser desligado)              ║
  ║  Custo: ~$0.0002 por lote                                        ║
  ║                                                                   ║
  ║  15-40 URLs  ──→  [ GPT LOTE ]  ──→  8-20 URLs                  ║
  ╚═══════════════════════╪═══════════════════════════════════════════╝
                          │
                          ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 3: LEITURA DOS ARTIGOS (Jina)                             ║
  ║  "Ler cada noticia completa, limpa e sem propaganda"             ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  Jina acessa cada URL e extrai o texto da noticia.               ║
  ║                                                                   ║
  ║  Cache inteligente:                                               ║
  ║  - Se ja lemos essa URL nas ultimas 24h, usa o cache             ║
  ║  - NAO cacheia conteudo vazio ou <100 chars                      ║
  ║  - Conteudo vazio e descartado ANTES de enviar pro GPT           ║
  ║                                                                   ║
  ║  Concorrencia: 5 artigos em paralelo (configuravel)              ║
  ║  Custo: $0.002 por artigo (so se nao tiver cache)                ║
  ║                                                                   ║
  ║  8-20 URLs  ──→  [ JINA ]  ──→  5-15 textos com conteudo        ║
  ╚═══════════════════════╪═══════════════════════════════════════════╝
                          │
                          ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 4: ANALISE COMPLETA (GPT + Embedding)                    ║
  ║  "A IA le o artigo inteiro e extrai dados estruturados"          ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  Para cada artigo, o GPT extrai:                                  ║
  ║                                                                   ║
  ║  ┌──────────────────────────────────────────────┐                ║
  ║  │  e_crime: true/false                         │                ║
  ║  │  tipo_crime: string livre (qualquer tipo)    │                ║
  ║  │    ex: "roubo", "prisao", "operacao policial"│                ║
  ║  │  cidade: "Sao Paulo"                         │                ║
  ║  │  bairro: "Pinheiros"                         │                ║
  ║  │  data_ocorrencia: "2026-02-08"               │                ║
  ║  │  resumo: "Homem de 34 anos foi..."           │                ║
  ║  │  confianca: 0.92 (92% de certeza)            │                ║
  ║  └──────────────────────────────────────────────┘                ║
  ║                                                                   ║
  ║  CRITERIO: Aceita qualquer ocorrencia policial REAL e INDIVIDUAL ║
  ║  (roubo, furto, homicidio, prisao, apreensao, operacao, etc.)   ║
  ║  Rejeita: estatisticas gerais, editoriais, paginas de categoria  ║
  ║                                                                   ║
  ║  Embedding: Transforma resumo em vetor de 1.536 numeros          ║
  ║  (usado na deduplicacao)                                          ║
  ║                                                                   ║
  ║  5-15 textos  ──→  [ GPT + EMBED ]  ──→  3-10 noticias prontas  ║
  ╚═══════════════════════╪═══════════════════════════════════════════╝
                          │
                          ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 5: DEDUPLICACAO (3 Camadas)                               ║
  ║  "Garantir que a mesma noticia nao apareca 2 vezes"              ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  ┌─── CAMADA 1: Geo-Temporal (SQL) ──────────────────────┐      ║
  ║  │  "Mesma cidade + mesmo crime + mesma data?"            │      ║
  ║  │  Custo: $0 | Elimina: ~70% das duplicatas              │      ║
  ║  └───────────────────────────┬────────────────────────────┘      ║
  ║                              │                                    ║
  ║  ┌─── CAMADA 2: Similaridade Vetorial ───────────────────┐      ║
  ║  │  Compara embeddings (cosine similarity >= 85%)         │      ║
  ║  │  Custo: $0 | Elimina: ~92% das restantes               │      ║
  ║  └───────────────────────────┬────────────────────────────┘      ║
  ║                              │                                    ║
  ║  ┌─── CAMADA 3: Confirmacao GPT ─────────────────────────┐      ║
  ║  │  So ~5% chegam aqui. GPT compara resumos.              │      ║
  ║  │  Custo: $0.001 por comparacao                          │      ║
  ║  └────────────────────────────────────────────────────────┘      ║
  ║                                                                   ║
  ║  Se DUPLICATA: adiciona URL como fonte extra                      ║
  ║  Se NOVA: salva + envia push                                      ║
  ║                                                                   ║
  ║  3-10 noticias  ──→  [ DEDUP 3 CAMADAS ]  ──→  1-5 novas        ║
  ╚═══════════════════════╪═══════════════════════════════════════════╝
                          │
                          ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 6: SALVAR + NOTIFICAR                                     ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  1. SALVA no Supabase (PostgreSQL + pgvector)                    ║
  ║  2. ENVIA PUSH via Firebase (titulo + resumo)                    ║
  ║  3. REGISTRA CUSTOS no budget_tracking                           ║
  ║  4. LOG DE OPERACAO (metricas no admin panel)                    ║
  ║                                                                   ║
  ╚═══════════════════════════════════════════════════════════════════╝
```

---

## PIPELINE DE BUSCA MANUAL

```
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  BUSCA MANUAL (via app mobile)                                    ║
  ║  "O usuario escolhe cidade, periodo e palavra-chave"             ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  Diferencas do auto-scan:                                         ║
  ║  - Resultados salvos em tabela separada (search_results)         ║
  ║  - SEM deduplicacao contra noticias universais                   ║
  ║  - SEM embedding                                                  ║
  ║  - Push so pro criador da busca                                   ║
  ║  - 1 query por cidade (nao multi-query)                          ║
  ║  - dateRestrict baseado no periodo escolhido                      ║
  ║  - max_results: 20 (configuravel)                                 ║
  ║                                                                   ║
  ║  Pipeline: 6 stages                                               ║
  ║  1. Search (Perplexity, 1 query por cidade)                      ║
  ║  2. SSP Scraping (opcional)                                       ║
  ║  3. Filter0 (regex) + Filter1 (GPT batch, toggle)               ║
  ║  4. Jina fetch (conteudo vazio descartado)                       ║
  ║  5. Filter2 (GPT full analysis + filtro de data)                 ║
  ║  6. Salva em search_results                                       ║
  ║                                                                   ║
  ║  Query reformulada:                                               ║
  ║  "crimes ocorrencias policiais {cidade}, {estado} nos ultimos    ║
  ║   {periodo}: noticias individuais de roubo furto homicidio       ║
  ║   trafico assalto prisao apreensao com data e local"             ║
  ║                                                                   ║
  ╚═══════════════════════════════════════════════════════════════════╝
```

---

## CONFIGURACOES DO ADMIN PANEL

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  CONFIG KEYS (configManager, cache 5 min)                       │
  │                                                                 │
  │  Pipeline:                                                      │
  │  - search_max_results ........... 20 (Perplexity max)          │
  │  - content_fetch_concurrency .... 5                             │
  │  - filter0_regex_enabled ........ toggle                        │
  │  - filter2_confidence_min ....... 0.7                           │
  │  - filter2_max_content_chars .... 4000                          │
  │  - dedup_similarity_threshold ... 0.85                          │
  │                                                                 │
  │  Fontes (todas toggleaveis):                                    │
  │  - multi_query_enabled                                          │
  │  - search_queries_per_scan ...... 2                             │
  │  - google_news_rss_enabled                                      │
  │  - section_crawling_enabled ..... false (padrao)                │
  │  - ssp_scraping_enabled ......... true                          │
  │                                                                 │
  │  Sistema:                                                       │
  │  - monthly_budget_usd ........... 100                           │
  │  - budget_warning_threshold ..... 0.9                           │
  │  - scan_cron_schedule ........... */5 * * * *                   │
  │  - worker_concurrency ........... 3                             │
  │  - push_enabled ................. true                          │
  │  - auth_required ................ true                          │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## STACK TECNOLOGICO

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  Backend:  Node.js + TypeScript + Express + BullMQ              │
  │  Admin:    Next.js 16.1.6 + shadcn/ui + Tailwind v4 (webpack)  │
  │  Mobile:   Flutter / Android                                    │
  │  DB:       Supabase PostgreSQL + pgvector                       │
  │  Cache:    Redis (Upstash)                                      │
  │  Push:     Firebase Cloud Messaging                             │
  │  IA:       OpenAI GPT-4o-mini + text-embedding-3-small          │
  │  Scraping: Jina AI Reader                                       │
  │  Busca:    Perplexity Search API (principal)                    │
  │            Google News RSS (complementar, gratis)               │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## CONTROLE DE CUSTOS

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  CUSTO ESTIMADO POR SCAN (1 cidade)                             │
  │                                                                 │
  │  Perplexity Search ......... $0.005  (1 pesquisa)              │
  │  Google News RSS ........... $0.000  (gratis)                  │
  │  Jina (leitura) ............ $0.020  (~10 artigos)             │
  │  OpenAI Filtro 1 ........... $0.000  (~gratis, se ligado)      │
  │  OpenAI Filtro 2 ........... $0.005  (~10 artigos)             │
  │  OpenAI Embeddings ......... $0.000  (~gratis)                 │
  │  OpenAI Dedup GPT .......... $0.001  (quando necessario)       │
  │  ─────────────────────────────────────────────                  │
  │  TOTAL POR SCAN: ~$0.03                                         │
  │                                                                 │
  │  Protecoes: orcamento mensal, alerta 80%, pausa automatica     │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```
