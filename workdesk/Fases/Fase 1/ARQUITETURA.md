
# NETRIOS NEWS - ARQUITETURA DO SISTEMA
## Documento Tecnico para Apresentacao

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║     N E T R I O S   N E W S                                                  ║
║     Sistema Inteligente de Monitoramento de Noticias Criminais               ║
║                                                                              ║
║     "Monitoramento automatico 24/7 de crimes em cidades brasileiras,         ║
║      usando Inteligencia Artificial para coletar, filtrar e entregar         ║
║      noticias relevantes direto no celular."                                 ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## O QUE O SISTEMA FAZ (Resumo Executivo)

```
   O Netrios News e um "robo jornalista" que:

   1. VARRE a internet brasileira atras de noticias de crime
   2. FILTRA o que e relevante usando IA (elimina lixo, spam, esportes)
   3. VERIFICA se a noticia ja existe no banco (evita duplicatas)
   4. ENVIA alerta no celular do usuario em tempo real
   5. PERMITE busca manual por cidade, tipo de crime e periodo

   Tudo isso rodando AUTOMATICAMENTE, 24 horas por dia,
   sem ninguem precisar apertar nenhum botao.
```

---

## VISAO GERAL - MAPA DO SISTEMA

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          INTERNET                                       │
│                                                                         │
│   [Google]   [Google News]   [Jornais]   [Policia]                      │
│   Pesquisa   RSS Feed        Secoes de   Sites da SSP                   │
│   Paga       Gratis          Noticias    (Gov.br)                       │
│      │           │              │            │                          │
└──────┼───────────┼──────────────┼────────────┼──────────────────────────┘
       │           │              │            │
       ▼           ▼              ▼            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   ██████  ██████  ██████  ██  ██  ██████  ██████  ██████                │
│   ██   █  ██   █  ██      ██ ██   ██      ██   █  ██   █               │
│   ██████  ██████  ██      ████    ████    ██   █  ██   █               │
│   ██   █  ██   █  ██      ██ ██   ██      ██   █  ██   █               │
│   ██████  ██   █  ██████  ██  ██  ██████  ██   █  ██████               │
│                                                                         │
│   Backend (Servidor Node.js + TypeScript)                               │
│   "O cerebro do sistema - processa tudo automaticamente"                │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │              PIPELINE DE INGESTAO                            │      │
│   │  "Linha de montagem que transforma URL em noticia"           │      │
│   │                                                              │      │
│   │  URL → Filtro → Filtro → Leitura → Analise → Dedup → Salva  │      │
│   │        Rapido   IA       Artigo    IA        IA       BD     │      │
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
   │  PostgreSQL │ │  Android    │ │  Next.js     │
   │  + pgvector │ │  (celular)  │ │  (navegador) │
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
│   │                                                             │   │
│   │  O que faz:                                                 │   │
│   │  - Guarda TODAS as noticias, usuarios, configs              │   │
│   │  - Autenticacao (login/senha dos admins e usuarios)         │   │
│   │  - pgvector: extensao especial que permite busca            │   │
│   │    por SIMILARIDADE (encontra noticias parecidas)           │   │
│   │  - API automatica (nao precisa escrever SQL manual)         │   │
│   │                                                             │   │
│   │  Por que Supabase e nao MySQL?                              │   │
│   │  → PostgreSQL e mais robusto pra dados complexos            │   │
│   │  → pgvector permite IA de deduplicacao (unico no mercado)   │   │
│   │  → Tem auth pronto (economiza meses de desenvolvimento)     │   │
│   │  → Tier gratis generoso (500MB, 50k rows)                   │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  🔥 FIREBASE (firebase.google.com)                          │   │
│   │  "O servico de notificacoes push"                           │   │
│   │                                                             │   │
│   │  O que faz:                                                 │   │
│   │  - Envia NOTIFICACAO no celular quando sai noticia nova     │   │
│   │  - Funciona mesmo com app fechado                           │   │
│   │  - Gerencia tokens de dispositivo (sabe quem recebe o que)  │   │
│   │  - Remove automaticamente dispositivos inativos             │   │
│   │                                                             │   │
│   │  Como funciona:                                             │   │
│   │  → App registra token do celular no backend                 │   │
│   │  → Quando nova noticia chega, backend manda pro Firebase    │   │
│   │  → Firebase entrega no celular (ate 500 de uma vez)         │   │
│   │  → Gratis ate 10.000 mensagens/mes                          │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  🤖 OPENAI / GPT (openai.com)                               │   │
│   │  "A Inteligencia Artificial que analisa as noticias"        │   │
│   │                                                             │   │
│   │  O que faz:                                                 │   │
│   │  - Filtro 1: Le titulo/resumo e decide "isso e crime?"     │   │
│   │  - Filtro 2: Le artigo inteiro e extrai dados estruturados  │   │
│   │    (tipo do crime, cidade, bairro, data, resumo)            │   │
│   │  - Embeddings: Transforma texto em vetor numerico pra       │   │
│   │    comparar similaridade entre noticias (deduplicacao)      │   │
│   │  - Confirmacao: Quando duas noticias parecem iguais,        │   │
│   │    GPT confirma se sao realmente o mesmo evento             │   │
│   │                                                             │   │
│   │  Modelo usado: GPT-4o-mini (rapido e barato)                │   │
│   │  Embedding: text-embedding-3-small (1536 dimensoes)         │   │
│   │  Custo medio: ~$0.001 por noticia processada                │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  📰 JINA AI (jina.ai)                                       │   │
│   │  "O leitor de paginas web"                                  │   │
│   │                                                             │   │
│   │  O que e "Scraping"?                                        │   │
│   │  → E quando um programa "le" uma pagina da internet         │   │
│   │    como se fosse um humano, mas automaticamente.            │   │
│   │    O problema: paginas tem menus, propagandas, botoes...    │   │
│   │    A gente so quer o TEXTO da noticia.                      │   │
│   │                                                             │   │
│   │  O que o Jina faz:                                          │   │
│   │  - Acessa qualquer URL e extrai SÓ o conteudo util         │   │
│   │  - Remove propagandas, menus, rodapes, pop-ups              │   │
│   │  - Retorna texto limpo em formato Markdown                  │   │
│   │  - Funciona com 99% dos sites de noticias brasileiros       │   │
│   │                                                             │   │
│   │  Custo: $0.002 por pagina lida                              │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  🔍 GOOGLE SEARCH API + GOOGLE NEWS RSS                     │   │
│   │  "Os olhos do sistema - encontram as noticias"              │   │
│   │                                                             │   │
│   │  Google Search API (Pago):                                  │   │
│   │  - Pesquisa no Google como um humano faria                  │   │
│   │  - Ex: "homicidio Curitiba janeiro 2026"                   │   │
│   │  - Retorna URLs dos resultados                              │   │
│   │  - 100 pesquisas/dia gratis, depois $5/1000                 │   │
│   │                                                             │   │
│   │  Google News RSS (Gratis):                                  │   │
│   │  - Acessa o feed de noticias do Google                      │   │
│   │  - Nao precisa de chave de API                              │   │
│   │  - Pega noticias recentes automaticamente                   │   │
│   │  - Complementa a busca paga (economia)                      │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                                                             │   │
│   │  🏛 REDIS (Fila de tarefas)                                  │   │
│   │  "O organizador de filas"                                   │   │
│   │                                                             │   │
│   │  O que e uma "fila de tarefas"?                             │   │
│   │  → Imagina uma fila de banco. Cada cidade que precisa ser   │   │
│   │    escaneada entra na fila. O sistema processa uma por vez  │   │
│   │    (ou ate 3 ao mesmo tempo) sem sobrecarregar.             │   │
│   │                                                             │   │
│   │  O que faz:                                                 │   │
│   │  - Gerencia fila de scans (BullMQ)                          │   │
│   │  - Cache de configuracoes (5 min)                           │   │
│   │  - Lock distribuido (evita escanear mesma cidade 2x)        │   │
│   │  - Cache de conteudo (24h) e embeddings (30 dias)           │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## A PIPELINE - "A LINHA DE MONTAGEM"

```
  Como uma noticia vira informacao util? Passo a passo:


  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 0: COLETA DE URLs                                        ║
  ║  "Vasculhar a internet atras de noticias"                        ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  O sistema busca noticias em 4 FONTES simultaneamente:            ║
  ║                                                                   ║
  ║  ┌─────────────────┐  O que e "Crawling"?                        ║
  ║  │ 1. Google Search │  → Navegar pela internet seguindo links,   ║
  ║  │    (API paga)    │    como uma aranha tecendo sua teia.       ║
  ║  │    $0.005/busca  │    O robo "rasteja" de pagina em pagina.   ║
  ║  └────────┬────────┘                                             ║
  ║           │          O que e "Scraping"?                          ║
  ║  ┌────────┴────────┐ → Extrair dados de uma pagina web,         ║
  ║  │ 2. Google News  │   como "raspar" informacao da tela.        ║
  ║  │    RSS (gratis)  │   O robo le a pagina e pega o que          ║
  ║  │    $0            │   interessa (titulo, texto, data).         ║
  ║  └────────┬────────┘                                             ║
  ║           │          O que e "RSS"?                               ║
  ║  ┌────────┴────────┐ → "Really Simple Syndication" - um         ║
  ║  │ 3. Secoes de    │   formato padrao que sites de noticia      ║
  ║  │    Jornais      │   usam pra distribuir conteudo.            ║
  ║  │    (crawling)    │   E tipo um "cardapio" de noticias.       ║
  ║  │    $0.002/site   │                                            ║
  ║  └────────┬────────┘ O que e "SSP"?                              ║
  ║           │          → Secretaria de Seguranca Publica.          ║
  ║  ┌────────┴────────┐   Cada estado tem a sua, e publicam        ║
  ║  │ 4. Sites da SSP │   notas sobre operacoes policiais          ║
  ║  │    (27 estados) │   e apreensoes no site oficial.            ║
  ║  │    ~$0.002       │                                            ║
  ║  └────────┬────────┘                                             ║
  ║           │                                                       ║
  ║           ▼                                                       ║
  ║  ┌─────────────────┐                                             ║
  ║  │ DEDUP DE URLs   │  Remove URLs repetidas entre as 4 fontes   ║
  ║  │ (instantaneo)   │  Ex: mesma noticia aparece no Google e     ║
  ║  └────────┬────────┘  no RSS → mantém so 1                      ║
  ║           │                                                       ║
  ║  Resultado: ~30-80 URLs unicas por cidade                        ║
  ╚═══════════╪═══════════════════════════════════════════════════════╝
              │
              ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 1: FILTRO RAPIDO (Regex)                                  ║
  ║  "Eliminar o lixo obvio sem gastar dinheiro"                     ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  O que e "Regex"?                                                 ║
  ║  → "Expressao Regular" - um padrao de texto.                     ║
  ║    Ex: se a URL tem "facebook.com" ou "instagram.com",           ║
  ║    nao e noticia de jornal. DESCARTA.                            ║
  ║                                                                   ║
  ║  Bloqueia automaticamente:                                        ║
  ║  ✗ Redes sociais (Facebook, Instagram, Twitter, TikTok)          ║
  ║  ✗ Videos (YouTube, Vimeo)                                        ║
  ║  ✗ Assuntos irrelevantes (esporte, receita, horoscopo)           ║
  ║                                                                   ║
  ║  Custo: $0 (roda local, sem API)                                  ║
  ║  Velocidade: instantaneo                                          ║
  ║  Eliminacao: ~50% das URLs                                        ║
  ║                                                                   ║
  ║  30-80 URLs  ──→  [ REGEX ]  ──→  15-40 URLs                    ║
  ╚═══════════════════════╪═══════════════════════════════════════════╝
                          │
                          ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 2: FILTRO IA (GPT em Lote)                                ║
  ║  "A IA le os titulos e decide quais valem a pena"                ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  O que e "GPT em Lote"?                                          ║
  ║  → Em vez de perguntar pro GPT 40 vezes "isso e crime?",        ║
  ║    mandamos os 40 titulos DE UMA VEZ e ele responde tudo         ║
  ║    numa unica chamada. Economia de ~90% no custo!                ║
  ║                                                                   ║
  ║  O que perguntamos:                                               ║
  ║  "Analise estes titulos. Para cada um, diga se e sobre           ║
  ║   crime/violencia/seguranca publica no Brasil."                  ║
  ║                                                                   ║
  ║  Resposta: [true, false, true, true, false, ...]                  ║
  ║                                                                   ║
  ║  Custo: ~$0.0002 por lote (independente do tamanho!)              ║
  ║  Eliminacao: ~50% das URLs restantes                              ║
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
  ║  O que acontece:                                                  ║
  ║  → Para cada URL que passou nos filtros, o Jina acessa o site    ║
  ║    e extrai SOMENTE o texto da noticia (sem anuncios, menus,     ║
  ║    pop-ups, cookies, etc.)                                        ║
  ║                                                                   ║
  ║  O que e "Cache"?                                                 ║
  ║  → Memoria temporaria. Se ja lemos essa URL nas ultimas 24h,    ║
  ║    usamos o texto que ja temos. Nao paga de novo.                ║
  ║                                                                   ║
  ║  Concorrencia: 5 artigos lidos ao mesmo tempo (paralelo)          ║
  ║  Custo: $0.002 por artigo (so se nao tiver cache)                ║
  ║                                                                   ║
  ║  8-20 URLs  ──→  [ JINA ]  ──→  8-20 textos completos           ║
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
  ║  │  tipo_crime: "homicidio" | "roubo" | "furto" │                ║
  ║  │             "trafico" | "latrocinio" | etc.  │                ║
  ║  │  cidade: "Sao Paulo"                         │                ║
  ║  │  bairro: "Pinheiros"                         │                ║
  ║  │  data_ocorrencia: "2026-02-08"               │                ║
  ║  │  resumo: "Homem de 34 anos foi..."           │                ║
  ║  │  confianca: 0.92 (92% de certeza)            │                ║
  ║  └──────────────────────────────────────────────┘                ║
  ║                                                                   ║
  ║  O que e "Embedding"?                                             ║
  ║  → Transformar texto em NUMEROS. Cada noticia vira um vetor      ║
  ║    de 1.536 numeros. Noticias sobre o MESMO assunto terao        ║
  ║    numeros parecidos. Assim o sistema sabe que:                  ║
  ║    "Homem morto a tiros no Capao" e "Assassinato no Capao        ║
  ║     Redondo" sao a MESMA noticia, mesmo com palavras diferentes. ║
  ║                                                                   ║
  ║  Custo: ~$0.0005 por artigo (GPT) + $0.00002 (embedding)         ║
  ║                                                                   ║
  ║  8-20 textos  ──→  [ GPT + EMBED ]  ──→  5-15 noticias prontas  ║
  ╚═══════════════════════╪═══════════════════════════════════════════╝
                          │
                          ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 5: DEDUPLICACAO (3 Camadas)                               ║
  ║  "Garantir que a mesma noticia nao apareca 2 vezes"              ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  Por que 3 camadas? Porque nenhuma sozinha e 100% confiavel:      ║
  ║                                                                   ║
  ║  ┌─── CAMADA 1: Geo-Temporal (SQL) ──────────────────────┐      ║
  ║  │                                                        │      ║
  ║  │  "Mesma cidade + mesmo crime + mesma data?"            │      ║
  ║  │                                                        │      ║
  ║  │  Busca no banco: "ja existe noticia de ROUBO em        │      ║
  ║  │  SAO PAULO no dia 08/02/2026?"                         │      ║
  ║  │                                                        │      ║
  ║  │  Custo: $0 (consulta no banco, instantaneo)            │      ║
  ║  │  Elimina: ~70% das duplicatas                          │      ║
  ║  └───────────────────────────┬────────────────────────────┘      ║
  ║                              │ (as que parecem duplicadas)        ║
  ║                              ▼                                    ║
  ║  ┌─── CAMADA 2: Similaridade Vetorial ───────────────────┐      ║
  ║  │                                                        │      ║
  ║  │  "Os embeddings sao parecidos?"                        │      ║
  ║  │                                                        │      ║
  ║  │  O que e "Similaridade de Cosseno"?                    │      ║
  ║  │  → Compara os 1.536 numeros de cada noticia.           │      ║
  ║  │    Se a semelhanca e >= 85%, provavelmente e igual.    │      ║
  ║  │    Pense como "impressao digital" do texto.            │      ║
  ║  │                                                        │      ║
  ║  │  Custo: $0 (calculo matematico local)                  │      ║
  ║  │  Elimina: ~92% das duplicatas restantes                │      ║
  ║  └───────────────────────────┬────────────────────────────┘      ║
  ║                              │ (as que ainda tem duvida)          ║
  ║                              ▼                                    ║
  ║  ┌─── CAMADA 3: Confirmacao GPT ─────────────────────────┐      ║
  ║  │                                                        │      ║
  ║  │  "GPT, essas duas noticias sao o mesmo evento?"        │      ║
  ║  │                                                        │      ║
  ║  │  So ~5% das noticias chegam aqui.                      │      ║
  ║  │  O GPT le os dois resumos e confirma ou nega.          │      ║
  ║  │                                                        │      ║
  ║  │  Se DUPLICATA: adiciona a URL como fonte extra          │      ║
  ║  │  Se DIFERENTE: cria noticia nova                        │      ║
  ║  │                                                        │      ║
  ║  │  Custo: $0.001 (so quando necessario)                  │      ║
  ║  └────────────────────────────────────────────────────────┘      ║
  ║                                                                   ║
  ║  5-15 noticias  ──→  [ DEDUP 3 CAMADAS ]  ──→  3-10 novas       ║
  ╚═══════════════════════╪═══════════════════════════════════════════╝
                          │
                          ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  ETAPA 6: SALVAR + NOTIFICAR                                     ║
  ║  "Guardar no banco e avisar os usuarios"                         ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                   ║
  ║  Para cada noticia NOVA (que nao e duplicata):                   ║
  ║                                                                   ║
  ║  1. SALVA no Supabase (PostgreSQL + pgvector)                    ║
  ║     → Dados estruturados + embedding de 1.536 dimensoes          ║
  ║     → URLs de origem (de quais jornais veio)                     ║
  ║                                                                   ║
  ║  2. ENVIA PUSH via Firebase                                       ║
  ║     → Titulo: "Homicidio em Sao Paulo - Capao Redondo"           ║
  ║     → Corpo: "Homem de 34 anos foi encontrado..."                ║
  ║     → Chega no celular em segundos                                ║
  ║                                                                   ║
  ║  3. REGISTRA CUSTOS no budget_tracking                            ║
  ║     → Quanto gastou de Google, Jina, OpenAI                       ║
  ║     → Visivel no painel admin                                     ║
  ║                                                                   ║
  ║  4. LOG DE OPERACAO                                               ║
  ║     → Quantas URLs coletou, filtrou, salvou                       ║
  ║     → Tempo de execucao total                                     ║
  ║     → Historico completo no admin panel                           ║
  ║                                                                   ║
  ╚═══════════════════════════════════════════════════════════════════╝
```

---

## O AGENDADOR - "O RELOGIO DO SISTEMA"

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  CRON SCHEDULER                                                 │
  │  "Despertador que acorda o sistema a cada X minutos"            │
  │                                                                 │
  │  O que e "CRON"?                                                │
  │  → Um relogio programavel. Voce diz "rode isso a cada 1 hora"  │
  │    e ele executa automaticamente, sem parar, 24/7.              │
  │                                                                 │
  │  Fluxo:                                                         │
  │                                                                 │
  │  TICK! (a cada intervalo configuravel)                          │
  │    │                                                            │
  │    ├─→ Quais cidades precisam ser escaneadas?                   │
  │    │   (verifica "last_checked" de cada cidade)                 │
  │    │                                                            │
  │    ├─→ Adquire LOCK no Redis                                    │
  │    │   ("Eu to cuidando de Curitiba, ninguem mais mexa!")       │
  │    │                                                            │
  │    ├─→ Coloca na FILA (BullMQ)                                  │
  │    │                                                            │
  │    └─→ WORKER processa (ate 3 cidades ao mesmo tempo)           │
  │        - 10 scans por minuto no maximo                          │
  │        - 3 tentativas se falhar (com espera entre elas)         │
  │                                                                 │
  │  Configuravel pelo admin:                                       │
  │  - Frequencia do scan (padrao: 1 hora)                          │
  │  - Concorrencia maxima (padrao: 3)                              │
  │  - Taxa por minuto (padrao: 10)                                 │
  │  - Tempo do lock (padrao: 30 min)                               │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## CONTROLE DE CUSTOS - "O CAIXA"

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  BUDGET TRACKER                                                 │
  │  "Quanto estamos gastando?"                                     │
  │                                                                 │
  │  Cada chamada de API registra automaticamente:                  │
  │  - Qual servico usou (Google, Jina, OpenAI)                     │
  │  - Quanto custou (em dolares)                                   │
  │  - Se foi scan automatico ou busca manual                       │
  │                                                                 │
  │  ┌───────────────────────────────────────────────────────┐      │
  │  │  CUSTO ESTIMADO POR SCAN (1 cidade)                   │      │
  │  │                                                       │      │
  │  │  Google Search ........... $0.005  (1 pesquisa)       │      │
  │  │  Google News RSS ......... $0.000  (gratis)           │      │
  │  │  Jina (leitura) .......... $0.020  (~10 artigos)      │      │
  │  │  OpenAI Filtro 1 ......... $0.000  (~gratis)          │      │
  │  │  OpenAI Filtro 2 ......... $0.005  (~10 artigos)      │      │
  │  │  OpenAI Embeddings ....... $0.000  (~gratis)          │      │
  │  │  OpenAI Dedup GPT ........ $0.001  (quando necessario)│      │
  │  │  ─────────────────────────────────────────────        │      │
  │  │  TOTAL POR SCAN: ~$0.03                               │      │
  │  │                                                       │      │
  │  │  10 cidades × 24 scans/dia × 30 dias                 │      │
  │  │  = 7.200 scans/mes                                    │      │
  │  │  = ~$216/mes no cenario maximo                        │      │
  │  │  = ~$50-80/mes no cenario realista (com cache)        │      │
  │  └───────────────────────────────────────────────────────┘      │
  │                                                                 │
  │  Protecoes:                                                     │
  │  - Orcamento mensal configuravel (ex: $100)                     │
  │  - Alerta quando chega em 80% do limite                         │
  │  - Pausa automatica se ultrapassar o orcamento                  │
  │  - Tudo visivel no painel admin (graficos diarios)              │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## RATE LIMITER - "O CONTROLE DE VELOCIDADE"

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  DYNAMIC RATE LIMITER                                           │
  │  "Nao bater no muro de API"                                    │
  │                                                                 │
  │  O que e "Rate Limit"?                                          │
  │  → Todo servico de internet tem um limite de uso.               │
  │    Google permite 100 pesquisas/dia gratis.                     │
  │    Se passar, bloqueia. O Rate Limiter garante que              │
  │    NUNCA ultrapassamos o limite.                                │
  │                                                                 │
  │  ┌────────────────┬──────────┬────────────┬──────────────┐     │
  │  │ Servico        │ Paralelo │ Intervalo  │ Limite       │     │
  │  ├────────────────┼──────────┼────────────┼──────────────┤     │
  │  │ Google Search  │ 1        │ 100ms      │ 100/dia      │     │
  │  │ Jina           │ 10       │ 50ms       │ ilimitado    │     │
  │  │ OpenAI         │ 5        │ 200ms      │ ilimitado    │     │
  │  │ Google RSS     │ 2        │ 1000ms     │ ilimitado    │     │
  │  └────────────────┴──────────┴────────────┴──────────────┘     │
  │                                                                 │
  │  "Paralelo" = quantos ao mesmo tempo                            │
  │  "Intervalo" = tempo minimo entre chamadas                      │
  │                                                                 │
  │  Tudo configuravel pelo admin em tempo real!                    │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## AS 3 PLATAFORMAS

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  1. APP MOBILE (Flutter/Android)                                │
  │  "O que o usuario final usa"                                    │
  │                                                                 │
  │  ┌─────────────────────────────────────────────────────┐       │
  │  │                                                     │       │
  │  │  [Feed]  [Favoritos]  [Busca]  [Config]             │       │
  │  │                                                     │       │
  │  │  - Feed de noticias por cidade                      │       │
  │  │  - Notificacao push em tempo real                   │       │
  │  │  - Favoritar noticias                               │       │
  │  │  - Marcar como lida                                 │       │
  │  │  - Busca por cidade, tipo de crime, periodo         │       │
  │  │  - Busca manual (dispara pipeline sob demanda)      │       │
  │  │  - Funciona offline (cache local SQLite)            │       │
  │  │  - Login via Supabase Auth (email/senha)            │       │
  │  │                                                     │       │
  │  └─────────────────────────────────────────────────────┘       │
  │                                                                 │
  │  Tecnologias: Flutter, Dart, Firebase Messaging,                │
  │               Supabase Auth, SQLite, Provider                   │
  │                                                                 │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  2. ADMIN PANEL (Next.js)                                       │
  │  "O painel de controle do operador"                             │
  │                                                                 │
  │  ┌─────────────────────────────────────────────────────┐       │
  │  │                                                     │       │
  │  │  [Dashboard]  [Cidades]  [Config]  [Usuarios]       │       │
  │  │                                                     │       │
  │  │  - Dashboard com estatisticas em tempo real         │       │
  │  │  - Gerenciar cidades monitoradas (CRUD)             │       │
  │  │  - Configurar rate limits por servico               │       │
  │  │  - Configurar 20 parametros do sistema              │       │
  │  │  - Ver orcamento (mensal + diario + por servico)    │       │
  │  │  - Ver logs de operacao (historico de scans)        │       │
  │  │  - Gerenciar usuarios admin                         │       │
  │  │  - Disparar scan manual de uma cidade               │       │
  │  │  - Dev Tools (seed mock, push teste, cleanup)       │       │
  │  │                                                     │       │
  │  └─────────────────────────────────────────────────────┘       │
  │                                                                 │
  │  Tecnologias: Next.js 15, React, TypeScript, Tailwind CSS,     │
  │               Supabase SSR Auth, shadcn/ui                      │
  │                                                                 │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  3. BACKEND (Node.js + TypeScript)                              │
  │  "O motor que faz tudo funcionar"                               │
  │                                                                 │
  │  ┌─────────────────────────────────────────────────────┐       │
  │  │                                                     │       │
  │  │  16 rotas de API (REST)                             │       │
  │  │  Pipeline de ingestao (6 etapas)                    │       │
  │  │  4 fontes de coleta de noticias                     │       │
  │  │  3 filtros (regex + GPT batch + GPT full)           │       │
  │  │  3 camadas de deduplicacao                          │       │
  │  │  Sistema de filas (BullMQ + Redis)                  │       │
  │  │  Rate limiter dinamico (4 provedores)               │       │
  │  │  Config manager (20 configs, cache 5min)            │       │
  │  │  Push notifications (Firebase Admin SDK)            │       │
  │  │  Budget tracking automatico                         │       │
  │  │  163+ testes automatizados                          │       │
  │  │  0 erros de TypeScript (modo strict)                │       │
  │  │                                                     │       │
  │  └─────────────────────────────────────────────────────┘       │
  │                                                                 │
  │  Tecnologias: Node.js, TypeScript (strict), Express,            │
  │               BullMQ, Redis, Bottleneck, Winston, Zod,          │
  │               Firebase Admin SDK, OpenAI SDK                    │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## SEGURANCA

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  CAMADAS DE SEGURANCA                                           │
  │                                                                 │
  │  Autenticacao:                                                  │
  │  ✓ JWT (JSON Web Token) em todas as rotas protegidas            │
  │  ✓ Supabase Auth (bcrypt, rate limiting, email verification)    │
  │  ✓ Roles: admin vs usuario comum                               │
  │  ✓ Modo anonimo opcional (configuravel)                         │
  │                                                                 │
  │  Validacao:                                                     │
  │  ✓ Zod schema validation em todos os inputs                    │
  │  ✓ Sanitizacao de queries SQL (Supabase client)                │
  │  ✓ Rate limiting por IP nas rotas publicas                     │
  │                                                                 │
  │  Dados:                                                         │
  │  ✓ Senhas nunca armazenadas em texto plano                     │
  │  ✓ Tokens JWT com expiracao                                    │
  │  ✓ CORS configurado (so origens permitidas)                    │
  │  ✓ HTTPS obrigatorio em producao                                │
  │                                                                 │
  │  Operacional:                                                   │
  │  ✓ Logs estruturados (Winston)                                 │
  │  ✓ Health check endpoint (/health)                             │
  │  ✓ Graceful shutdown                                           │
  │  ✓ Retry com backoff exponencial                                │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## NUMEROS DO PROJETO

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  METRICAS DE DESENVOLVIMENTO                                    │
  │                                                                 │
  │  Backend:                                                       │
  │  - ~40 arquivos TypeScript                                      │
  │  - 163+ testes automatizados                                    │
  │  - 0 erros de TypeScript (modo strict)                          │
  │  - 16 rotas de API                                              │
  │  - 20 configuracoes editaveis                                   │
  │  - 6 etapas na pipeline                                         │
  │  - 4 fontes de dados                                            │
  │  - 3 filtros progressivos                                       │
  │  - 3 camadas de deduplicacao                                    │
  │                                                                 │
  │  Admin Panel:                                                   │
  │  - Next.js 15 com App Router                                    │
  │  - 6 paginas (dashboard, cidades, config, budget, users, logs)  │
  │  - Responsivo (desktop + mobile)                                │
  │  - Dark mode                                                    │
  │                                                                 │
  │  App Mobile:                                                    │
  │  - Flutter (Android)                                            │
  │  - 4 abas (feed, favoritos, busca, config)                      │
  │  - Push notifications                                           │
  │  - Cache offline (SQLite)                                       │
  │  - Login/registro                                               │
  │                                                                 │
  │  Infraestrutura:                                                │
  │  - 6 servicos externos integrados                               │
  │  - Cache em 3 niveis (Redis, Supabase, SQLite)                  │
  │  - Fila de tarefas com retry automatico                         │
  │  - Monitoramento de custos em tempo real                        │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

## GLOSSARIO - "DICIONARIO TECH"

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  API (Application Programming Interface)                        │
  │  → "Porta de entrada" de um servico. Como um garcom num         │
  │    restaurante: voce faz o pedido, ele leva pra cozinha         │
  │    e traz a resposta.                                           │
  │                                                                 │
  │  Backend                                                        │
  │  → A parte do sistema que o usuario NAO ve. O "motor"           │
  │    que processa dados nos bastidores.                           │
  │                                                                 │
  │  Cache                                                          │
  │  → Memoria temporaria pra nao repetir trabalho.                 │
  │    Como guardar o troco no bolso pra nao ir ao caixa toda hora. │
  │                                                                 │
  │  CRON                                                           │
  │  → Relogio programavel. "Faca X a cada Y minutos."              │
  │                                                                 │
  │  Crawling                                                       │
  │  → Navegar pela internet seguindo links, como uma aranha        │
  │    tecendo sua teia. O robo "rasteja" de pagina em pagina.      │
  │                                                                 │
  │  Embedding                                                      │
  │  → Transformar texto em numeros pra comparar similaridade.      │
  │    Como uma "impressao digital" do significado do texto.        │
  │                                                                 │
  │  Endpoint                                                       │
  │  → Um "endereco" especifico da API. Ex: /news e o endereco     │
  │    pra buscar noticias, /devices pra registrar celular.         │
  │                                                                 │
  │  JWT (JSON Web Token)                                           │
  │  → "Cracha digital". Depois do login, o sistema te da um       │
  │    cracha que voce mostra em cada pedido pra provar quem e.     │
  │                                                                 │
  │  Pipeline                                                       │
  │  → Linha de montagem. Cada etapa faz uma coisa e passa          │
  │    o resultado pra proxima. URL → Filtro → Analise → Salvar.   │
  │                                                                 │
  │  Push Notification                                              │
  │  → Alerta que aparece no celular mesmo com o app fechado.       │
  │    O servidor "empurra" a mensagem pro dispositivo.             │
  │                                                                 │
  │  Rate Limit                                                     │
  │  → Limite de velocidade. "No maximo 100 pesquisas por dia."     │
  │    O sistema respeita automaticamente pra nao ser bloqueado.    │
  │                                                                 │
  │  Redis                                                          │
  │  → Banco de dados ultra-rapido (na memoria RAM).                │
  │    Usado pra filas, cache e locks temporarios.                  │
  │                                                                 │
  │  REST API                                                       │
  │  → Padrao de comunicacao entre sistemas via HTTP.               │
  │    O app manda GET /news e o servidor responde com noticias.    │
  │                                                                 │
  │  RSS (Really Simple Syndication)                                │
  │  → Formato padrao que sites usam pra distribuir noticias.       │
  │    E como um "cardapio" atualizado automaticamente.             │
  │                                                                 │
  │  Scraping                                                       │
  │  → Extrair dados de uma pagina web automaticamente.             │
  │    Como "raspar" a informacao util da tela.                     │
  │                                                                 │
  │  TypeScript (Strict Mode)                                       │
  │  → Linguagem de programacao com verificacao rigorosa.           │
  │    O compilador avisa ANTES de rodar se algo esta errado.       │
  │    "Strict" = nivel maximo de rigor. Menos bugs.                │
  │                                                                 │
  │  pgvector                                                       │
  │  → Extensao do PostgreSQL que permite guardar e buscar          │
  │    vetores (embeddings). Essencial pra deduplicacao por IA.     │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

---

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║  Desenvolvido com:                                                           ║
║  Node.js + TypeScript | Next.js | Flutter | PostgreSQL + pgvector            ║
║  Supabase | Firebase | OpenAI GPT | Jina AI | Redis + BullMQ               ║
║  Google Search API | Google News RSS                                         ║
║                                                                              ║
║  163+ testes | 0 erros TS | 20 configs | 4 fontes | 3 filtros | 3 dedups   ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```
