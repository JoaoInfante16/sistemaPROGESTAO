
# SIMEops / PROGESTAO — ARQUITETURA DO SISTEMA
## Documento tecnico — revisado em 2026-08-04

> 📌 **Documento vivo** — descreve o **presente**: como o sistema funciona hoje.
> Editado in-place quando algo estrutural muda, nunca arquivado com a fase.
> O historico de *como se chegou aqui* e o [DEV_LOG](./DEV_LOG.md).
> Ver [CLAUDE.md](../CLAUDE.md), secao 2.

---

## Regra deste documento (2026-08-04)

**Aqui NAO entra o que o codigo ja diz.** Nada de stack, arvore de arquivos,
lista de chaves de config, shapes de rota ou valores numericos que vivem no
`configManager`. Isso se le na fonte, em dois segundos, e sempre certo.

O motivo nao e economia de espaco — e que a copia **apodrece calada**. Na revisao
de 04/08 este documento afirmava, ao mesmo tempo, que a busca aceitava 10 cidades
(aceita 1), que o Stage 5 rodava em serie (foi paralelizado), que nenhuma chamada
externa tinha timeout (o proprio cabecalho, 470 linhas acima, listava os
timeouts) e que os tetos eram por faixa 30d/60d/90d (sao por raiz quadrada). Tudo
isso estava dentro de uma caixa escrita **"LEIA ANTES DE MEXER"**.

Entao a regra e:

| entra | fica de fora |
|---|---|
| **por que** algo e assim | o que a linha de codigo faz |
| o que foi tentado e **falhou** | a lista de arquivos e pastas |
| medicoes que custaram dinheiro | valores de config (leia o `configManager`) |
| armadilhas que ja custaram tempo | shapes de request/response (leia o zod) |
| coisas que eu **nao enxergo** do codigo | versoes de dependencia (leia o package.json) |

Quando um numero for indispensavel para o raciocinio, ele vem **com a data da
medicao** e com o ponteiro pra fonte viva.

---

## O que o sistema faz

Um robo jornalista: varre a imprensa brasileira atras de ocorrencias policiais,
filtra com IA, consolida a mesma ocorrencia vinda de veiculos diferentes, e
entrega no celular — por push automatico (auto-scan) ou sob demanda (busca
manual).

**O que o produto entrega e "o que a imprensa publicou sobre criminalidade na
cidade", NAO "a criminalidade da cidade".** Sao coisas diferentes, e a segunda e
muito maior. Isso precisa estar alinhado com o cliente, porque e a origem de toda
frustracao com volume baixo.

---

## Mapa do sistema

```
   Bright Data SERP API  ---+
   (PRINCIPAL: news + web)  |
   Google News RSS ---------+
   (complementar, gratis)   |
                            v
        +-------------------------------------------------------+
        |   Backend (Node + TypeScript + Express + BullMQ)      |
        |                                                        |
        |   PIPELINE CORE — compartilhado pelos dois caminhos    |
        |   URL -> Filter0 -> Filter1 -> Jina -> Filter2 -> Dedup|
        |          (regex)   (GPT lote) (read) (GPT full)        |
        +-------------------------------------------------------+
             |                  |                 |
             v                  v                 v
        Supabase           App Flutter       Admin Next.js
        (PG + pgvector)    (Android)         (configuracao)
```

`BraveNewsProvider.ts` existe mas esta **fora do caminho ativo** (so com
`SEARCH_BACKEND=brave`). Se voce achar o Brave citado em algum calculo de custo,
o calculo e velho.

---

## Servicos externos — so o que surpreende

O que cada servico *e* esta no proprio nome. O que morde:

**Bright Data — dois modos com custo e latencia muito diferentes.**
O modo *news* (`tbm=nws`) e sincrono e responde em segundos. O modo *web* ("Top
100") e uma Dataset API: trigger, polling, download de snapshot. **O polling vai
a ate 60 tentativas de 3s, com 1 retry — ou seja, ate ~6 minutos por cidade no
pior caso.** Esse e o maior sumidouro de tempo isolado do sistema.

**O teto do indice do Google e por QUERY, e nao e regulavel.** Medido com
paginacao correta (Floripa, 30 dias): 10, 10, 10, 1, 0, 0 = **31 noticias
unicas**. Aumentar config alem disso nao cria noticia que nao existe. **Mais
assuntos e a unica alavanca real de alcance** — cada assunto e um teto novo. Foi
isso que levou a taxonomia inteira para a busca (03/08).

**Paginacao do news:** `num` foi deprecado pelo Google (set/2025) e a SERP
devolve ~10 por pagina — paginar com `start` de 10 em 10. Com incremento de 20 o
codigo **pula as posicoes 10-19 de cada pagina** e perde ~1/3 do material. E
`brd_json=1` e OBRIGATORIO na URL: sem ele vem HTML bruto e o `JSON.parse` falha
em silencio.

**Jina** e o fallback Web Unlocker (Bright Data) para quando o Jina leva
403/422/503/SSL — tipicamente dominios `.gov.br`. O cache **nao guarda respostas
com menos de 100 chars**, senao uma pagina vazia envenenaria o cache por 24h.
Desde 04/08 trata `429` lendo o `Retry-After`.

**Nominatim/OpenStreetMap** e gratis e a politica de uso e **1 requisicao por
segundo** — nao paralelizavel. Foi isso que fez o mapa do relatorio nunca
carregar: geocode sequencial x 1,1s x ate 3 lookups por ponto dava 85-254s contra
um timeout de 15s no cliente. Corrigido em 04/08 com cache em duas camadas
(memoria + Redis, 90 dias) e aquecimento **depois** da entrega.

**Redis/Upstash** carrega fila (BullMQ), cache de config, de conteudo e de
embedding. Os TTLs estao no codigo.

---

## Pipeline core — o funil

Este desenho e o **modelo mental** do sistema: onde cada item morre. Os valores
de corte sao config e mudam; a **ordem** e a **razao de cada estagio** nao.

```
  SEARCH PROVIDER
        |
        v
  URL DEDUP ............................. [X] URL repetida no batch
        |
        v
  STAGE 1  FILTER 0 — regex local, $0 ... [X] dominio social/video
        |                                 [X] pagina de categoria/listagem
        |                                 [X] snippet com keyword nao-crime
        v
  STAGE 2  FILTER 1 — GPT em lote ....... [X] "nao e ocorrencia"
        |
        v
  STAGE 3  CONTENT FETCH — Jina ......... [X] fetch falhou
        |                                 [X] conteudo < 100 chars
        v
  STAGE 4  FILTER 2 — GPT artigo inteiro  [X] is_crime = false
        |    extrai: tipo_crime, cidade,  [X] confianca abaixo do minimo
        |    estado, bairro, rua, data,   [X] tipo_crime invalido
        |    resumo, confianca            [X] data ausente ou futura
        v
  STAGE 4.5  POST-FILTER em memoria ..... [X] data fora do periodo pedido
        |    (a) data  (b) cidade+estado  [X] cidade/estado nao batem
        v
  STAGE 5  EMBEDDING (1536-dim)
        |
        v
  STAGE 6  DEDUP INTRA-BATCH em camadas
        |    lead = maior confianca; os outros viram sources[]
        v
   +----+----------------------------+
   |                                 |
  AUTO-SCAN                     BUSCA MANUAL
  (+ dedup contra DB, + push)   (salva em search_results)
```

### Por que cada regra do funil existe

**Filter1 nunca faz fallback "aprova tudo".** Se a API falhar depois do retry,
ele **lanca** e deixa o BullMQ retentar. Aprovar tudo por seguranca explodiria o
orcamento nos estagios seguintes, que sao os caros. Ja parse invalido ou tamanho
de array errado faz padding `true` — ali o custo de errar e um artigo a mais, nao
o orcamento inteiro.

**O Filter2 SEMPRE exige cidade + estado juntos.** Sem o estado, Sao Jose (SC)
vira Sao Jose (SP). Nao relaxar isso.

**Os assuntos escolhidos pelo usuario entram como contexto nos prompts do Filter1
e do Filter2** (03/08). Sem isso o Filter1 matava `greve` e `bloqueio` pacifico
**antes do Jina**, em silencio: sao assuntos que o modelo nao considera
"seguranca publica". A regra do usuario vence a regra de crime.

**Dedup contra DB tem 3 camadas por custo, nao por precisao:** geo-temporal em
SQL ($0) elimina a maioria, cosine ($0) resolve quase todo o resto, e o GPT so
ve os ~5% duvidosos.

### Trocas de prompt testadas e DESCARTADAS

Em 16/04 tentei reescrever o prompt da Layer 3 do dedup para reduzir um suposto
vies pro "YES". O teste com 10 pares (`scripts/test-dedup-prompt.ts`) mostrou
**regressao**: o prompt novo, mais rigoroso, dava NO para o mesmo evento escrito
de formas diferentes — que e exatamente o valor central do sistema. Revertido.

---

## Auto-scan

Disparado por CRON. **A config `scan_cron_schedule` no banco e IGNORADA** — quem
manda e a env `SCAN_CRON_SCHEDULE`.

Roda so em **janela de operacao** (timezone `America/Sao_Paulo` forcado via
`Intl`): dias uteis, horario comercial, fim de semana desligado por default.
Fora da janela o tick inteiro e pulado — nada enfileira, nada e marcado.

**Escaneia apenas `type='city'`.** Escanear `state` polui o banco com cidades
erradas.

Os assuntos rodam **em rodizio**, alguns por execucao, cobrindo a lista inteira
ao longo do dia. Por isso levar a taxonomia inteira para `search_subjects` (03/08)
**nao aumenta o custo recorrente** — aumenta a cobertura ao longo do dia.

**STAGE 1.5 — peneira barata antes de qualquer GPT** (02/08): URL que ja esta em
`news_sources` cai fora, e materia publicada antes da janela cai fora com 1 dia
de folga. **Sem data legivel, MANTEM** — na duvida paga-se o Jina, nao se perde a
noticia. As metricas vao em `budget_tracking.details`.

**Contabilidade de custo e uma so** (02/08): `custoDoRun` acumula exatamente o
que cada estagio grava em `budget_tracking`. A antiga `calculateCost()`, que
recalculava por formula com taxas fixas na mao, foi **removida** — os dois
numeros discordavam por construcao.

---

## Busca manual

Disparada pelo usuario no app. Mesmo pipeline core, mais: filtro de cidade/estado
pos-Filter2, progress persistido em JSONB, push de conclusao, e **sem** dedup
contra o banco.

**Dual-source por cidade, em paralelo** (`Promise.allSettled`): Web Top 100 para
volume, News paginado para qualidade.

```
  +==================================================================+
  |  AS DUAS FONTES TEM CONFIABILIDADES DIFERENTES (medido 30/07)    |
  |                                                                   |
  |  NEWS = ALICERCE. Estavel: 20 resultados por cidade em TODAS as   |
  |  medicoes. Sustenta o auto-scan e e o piso da busca manual.       |
  |                                                                   |
  |  WEB = LOTERIA. Erratico: 85, 10, 1, 11, 98... com requisicao     |
  |  IDENTICA. NAO e instabilidade — e o Google BLOQUEANDO trafego    |
  |  raspado (respondeu results_cnt=1 pra query com 61500            |
  |  resultados). O indice organico e o dado mais raspado da          |
  |  internet, entao e o que o Google mais defende.                   |
  |                                                                   |
  |  >>> NAO ADICIONAR RETRY POR CONTAGEM BAIXA <<<                   |
  |  Nao da pra distinguir "fui bloqueado" de "essa cidade nao tem    |
  |  noticia": Florianopolis ~26/mes, Santos 1, Aguas da Prata 1.     |
  |  Gatilho apertado queima dinheiro em cidade pequena; frouxo nao   |
  |  dispara quando precisa. Repetir sobre SINAL explicito            |
  |  (x-brd-err-code), nunca sobre suspeita.                          |
  +==================================================================+
```

**Os tetos derivam do periodo por raiz quadrada, sem faixas**
(`manualSearchCaps.ts`).

**O teto de analise (`manual_search_analysis_cap`) e 0 = SEM TETO, e isso e
deliberado.** Com cota de 50, mediu-se **142 candidatos dentro da janela virando
50** (Fase 8). Tempo se ataca por **vazao**, nunca por descarte — quem descarta
joga fora noticia que ja foi coletada e paga.

**Quem escolhe os assuntos e o usuario, na tela** (03/08). O `tipo_crime` (uma
string, uma query) virou `assuntos: string[]`. O catalogo unico vive em
[`backend/src/utils/taxonomia.ts`](../backend/src/utils/taxonomia.ts) e e servido
por `GET /settings/taxonomia` — a mesma lista alimenta as queries, a tela e a
classificacao.

**A validacao aceita 1 cidade por busca.** Nao vale a pena subir: `1 cidade +
regiao` custa o mesmo que `1 cidade`, entao permitir N seria pagar N vezes por
algo que ja vem junto. ⚠️ O APK que o cliente tem hoje ainda deixa escolher 10 —
enquanto ele nao atualizar, 2+ cidades da **400**.

---

## Regiao metropolitana — hoje e por GPT, e ela alucina

A lista de cidades vizinhas vem de um GPT com cache. Medido no cache do Redis
(04/08):

| capital | cidade devolvida | realidade |
|---|---|---|
| Goiania | Mara Rosa | **350 km** |
| Goiania | Jussara / Caldas Novas | ~300 km / ~170 km |
| Porto Alegre | Marica | fica no **Rio de Janeiro** |
| Campo Grande | Cristalina | fica em **Goias** |

Sao Paulo e Salvador saem corretas — o modelo memorizou as famosas. As de outro
estado sao inofensivas (o pos-filtro exige o estado bater); as do mesmo estado,
longe, **passam** e ja foram exibidas ao usuario como "regiao metropolitana".

**Decidido: substituir por raio geografico** (dataset de municipios com lat/lng +
haversine, ~30 km conurbacao, ~100 km regiao). **Nao estender o GPT pra isso** —
regiao metropolitana e fato juridico memorizavel, "municipios a 100 km" e conta,
e o modelo erra conta. O raio produz a **lista de nomes**; o pipeline continua
comparando por nome, nao por coordenada.

---

## Configuracao — o que nao esta no codigo

As chaves e seus valores estao em
[`backend/src/services/configManager/index.ts`](../backend/src/services/configManager/index.ts).
O que **nao** da pra deduzir lendo aquele arquivo:

**O painel MESCLA banco + DEFAULTS desde 02/08**, e marca `origem='default'` nas
chaves que so existem em codigo. Antes elas sumiam da tela — e um toggle vazio
lia como DESLIGADO enquanto o backend o usava LIGADO.

**`manual_search_max_results_30d/60d/90d` nao sao mais lidas por este codigo, mas
nao podem ser apagadas:** a `main` (producao) le a `_30d` como teto de **COLETA**
— significado diferente, mesmo banco. Elas so somem quando a `main` for
promovida.

**As configs de rate limit vivem na tabela `api_rate_limits`**, por provider
(`max_concurrent`, `min_time_ms`), e alimentam um Bottleneck cuja instancia e
**unica e compartilhada** entre auto-scan e busca manual. Mexer ali afeta os dois
caminhos ao mesmo tempo.

---

## Armadilhas que ja custaram tempo

**Infra compartilhada — a numero 1.** Staging, producao e dev usam o **mesmo**
Redis e o **mesmo** Supabase. Mudar config atinge producao **na hora, sem
deploy**. Producao chegou a roubar jobs de staging, ate o prefixo de fila.

**Nao deduzir qual codigo esta rodando.** `/health` devolve o commit;
`budget_tracking.details.commit` diz qual processo processou o job.

**O `MIGRATIONS_LOG.md` ja mentiu.** Antes de assumir schema, rodar
`scripts/diagnostico-banco.ts`.

**`gpt-5-nano` nao funciona** (reasoning tokens) — manter `gpt-4o-mini`.

**CORS no Render exige callback function**, nao array direto. Array nao funciona
em producao.

**Timestamps do Postgres vem sem fuso** (`TIMESTAMP` + `DEFAULT NOW()`), e o Dart
parseia como local — dava 3h adiantado no app. Resolvido em
`mobile-app/lib/core/utils/datas.dart`.

**`--dart-define-from-file` e resolvido em tempo de COMPILACAO.** `flutter run`
deixa instalado um APK apontando pro IP da LAN que **abre e loga normal** (o
Supabase tem defaultValue) e so morre nas chamadas ao backend. Conferir com
`adb shell dumpsys package com.netriosnews.netrios_news`.

**Escrita direta no banco pelo Bash e bloqueada** pelo classificador de
permissoes. Mudanca de schema vira migration em [SQL/migrations/](./SQL/migrations/)
+ entrada no [MIGRATIONS_LOG.md](./SQL/MIGRATIONS_LOG.md) no mesmo turno, e o
Joao roda.

**`.bat` via `cmd.exe /c` nao executa de verdade** neste ambiente — chamar o
`flutter build` direto.

---

## Onde procurar o resto

| pergunta | documento |
|---|---|
| o que cada rota recebe e devolve | [API_CONTRATO.md](./API_CONTRATO.md) |
| onde cada item do funil morre, com numeros | [FUNIL.md](./FUNIL.md) |
| o que falta fazer e o risco de cada item | [ROADMAP.md](./ROADMAP.md) |
| **por que** cada decisao foi tomada | [DEV_LOG.md](./DEV_LOG.md) |
| historico das fases fechadas | [Fases/](./Fases/) |
