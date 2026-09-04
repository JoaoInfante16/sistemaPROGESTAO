# ARQUITETURA — o mapa do SIMEops

> 📌 **Documento vivo.** Descreve o **presente**: como o sistema é hoje e o que
> não pode ser quebrado. Editado in-place quando algo estrutural muda.
> Ver [CLAUDE.md](../CLAUDE.md), seção 2.

---

## 🚪 COMECE POR AQUI

**Este é o único documento de estado do sistema.** Instância nova do Claude, ou
o João depois de um tempo longe: leia daqui até o fim antes de tocar em código.

**É um MAPA, não um diário.** Aqui tudo está no presente: o que é, como se liga,
o que não se faz. *Como se descobriu* cada coisa é o [DEV_LOG](./DEV_LOG.md);
*o que ainda falta* é o [ROADMAP](./ROADMAP.md). Se você for escrever aqui uma
frase com data e verbo no passado, ela pertence ao DEV_LOG.

**Não copie o código para cá.** Stack, árvore de arquivos, valores de config e
shapes de request se leem na fonte, em dois segundos e sempre certos. A cópia
apodrece calada e vira uma segunda verdade. Entra aqui só o que **custa dinheiro
ou tempo para redescobrir**: a razão de uma regra existir, o que foi tentado e
falhou, e o que não se enxerga lendo o código. Número indispensável vem **com a
data da medição**.

**Na dúvida factual, não deduza — meça.** `GET /health` diz o commit no ar,
`backend/scripts/diagnostico-banco.ts` diz o schema, `git log` diz o código. Ver
[§11](#11-quando-der-ruim--o-que-rodar).

---

## 📑 Sumário

| # | seção | para quê |
|---|---|---|
| 1 | [O produto](#1-o-produto--o-que-promete-e-o-que-não-promete) | o que o sistema entrega, e o que ele **não** entrega |
| 2 | [🚨 O que não se quebra](#2--o-que-não-se-quebra) | **leia antes de mudar qualquer coisa** |
| 3 | [Como as peças se ligam](#3-como-as-peças-se-ligam) | sistema, ambientes, os dois caminhos, dados |
| 4 | [O funil](#4-o-funil--pipeline-core) | como uma URL vira notícia, e por que cada estágio existe |
| 5 | [O dedup](#5-o-dedup--três-camadas-por-custo) | como a mesma ocorrência vira um item só |
| 6 | [Auto-scan](#6-auto-scan) | o que é próprio do caminho automático |
| 7 | [Busca manual](#7-busca-manual) | o que é próprio do caminho sob demanda |
| 8 | [Serviços externos](#8-serviços-externos--só-o-que-morde) | o que cada um cobra, demora e esconde |
| 9 | [Configuração](#9-configuração--o-que-não-está-no-código) | onde os valores moram e como mudam |
| 10 | [Armadilhas](#10-armadilhas-que-já-custaram-tempo) | por área: deploy, app, banco, ambiente |
| 11 | [Quando der ruim](#11-quando-der-ruim--o-que-rodar) | os comandos que respondem "como está agora?" |
| 12 | [Onde procurar o resto](#12-onde-procurar-o-resto) | qual documento responde qual pergunta |

---

## 1. O produto — o que promete e o que não promete

Um robô jornalista: varre a imprensa brasileira atrás de ocorrências policiais,
filtra com IA, consolida a mesma ocorrência vinda de veículos diferentes e
entrega no celular — por push automático (**auto-scan**) ou sob demanda
(**busca manual**).

🚨 **O produto entrega "o que a imprensa publicou sobre criminalidade na cidade",
NÃO "a criminalidade da cidade".** São coisas diferentes, e a segunda é muito
maior. Isso precisa estar alinhado com o cliente: é a origem de toda frustração
com volume baixo. Uma cidade pode ter 40 ocorrências e 2 notícias.

**Quem usa:** profissionais de segurança pública e gestão de risco. Não é app de
notícia para o público geral — o que se vende é o recorte e a consolidação.

---

## 2. 🚨 O que não se quebra

As regras abaixo custaram dinheiro, tempo ou um cliente vendo coisa errada. Cada
uma tem a razão colada; a história está no [DEV_LOG](./DEV_LOG.md).

| # | regra | por quê |
|---|---|---|
| 1 | **Escanear só `type='city'`, nunca `state`** | escanear estado polui o banco com cidades erradas |
| 2 | **Filter2 exige cidade + estado juntos** | sem estado, São José (SC) vira São José (SP) |
| 3 | **Cidade casa por igualdade, nunca por substring** | `includes` já pôs 10 notícias de São José do Cedro no feed de São José |
| 4 | **Nunca fazer retry por contagem baixa** | não dá para distinguir "fui bloqueado" de "essa cidade não tem notícia". Só sobre sinal explícito (`x-brd-err-code`, corpo de 0 bytes) |
| 5 | **`gpt-5-nano` não funciona** — manter `gpt-4o-mini` | reasoning tokens |
| 6 | **CORS no Render exige callback function** | array direto não funciona em produção |
| 7 | **Tempo se ataca por vazão, nunca por descarte** | descartar candidato joga fora coleta já paga (com cota 50: 142 candidatos viraram 50) |
| 8 | **Filter1 nunca faz fallback "aprova tudo"** | aprovar tudo por segurança explode o orçamento nos estágios caros que vêm depois |
| 9 | **Todo script que fala com Redis termina em `process.exit(0)`** | `main();` solto pendura o processo — já custou dois timeouts |
| 10 | **Mudança de schema vira migration + entrada no log, no mesmo turno** | escrita direta pelo Bash é bloqueada, e o log é o que a próxima instância lê |
| 11 | **Recorte de quem-vê-o-quê mora numa camada só, nunca na tela** | filtro na tela é filtro que uma tela esquece. Com dado sensível de pessoa atendida, tela esquecida não é bug — é incidente, e é o erro que nenhum deploy desfaz (§3.5) |

⚠️ **Antes de "otimizar" qualquer coisa aqui, leia o [FUNIL](./FUNIL.md).** As
alavancas que parecem óbvias (mais páginas, teto menor, retry) já foram medidas e
não fazem o que parecem fazer.

---

## 3. Como as peças se ligam

### 3.1 O sistema

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

`BraveNewsProvider.ts` existe mas está **fora do caminho ativo** (só com
`SEARCH_BACKEND=brave`). Cálculo de custo que cite Brave é velho.

### 3.2 Ambientes e bancos — a armadilha nº 1

| branch | serviço Render | banco Supabase | deploy |
|---|---|---|---|
| `develop` | — (só local) | **staging** `amrpit…` | n/a |
| `staging` | `simeops-backend` | **staging** `amrpit…` | automático |
| `main` | `…-production` | **produção** `uywvrk…` | 🚨 **MANUAL** |
| `main` | `admin-panel` | — | automático |

🧊 **DURANTE A FASE 12, A `main` ESTÁ CONGELADA** (decidido pelo João em
30/08). O trabalho de multi-plataforma e níveis de acesso vive em `develop` e
`staging`; nada sobe para produção até ele terminar.

O motivo é o tamanho da mudança: níveis de acesso mexem em quem enxerga o quê, e
uma versão pela metade em produção mostraria dado errado para cliente pagante —
que é o único erro deste sistema que não dá para desfazer com um deploy.

**A exceção é conserto de produção.** Se quebrar o que está no ar, o conserto vai
para a `main` na hora, sozinho, sem carregar o trabalho da fase junto. Foi
exatamente o que se fez em 29/08 com o `/goto`.

Quando a fase fechar, `main` volta ao fluxo normal e esta caixa sai daqui.

| arquivo de env | aponta para | quem lê |
|---|---|---|
| `backend/.env` (local) | **staging** | o servidor local — mexer aqui não atinge o cliente |
| `backend/.env.production` (`PROD_*`) | **produção** | só scripts, **nunca** o servidor |

**Redis/Upstash é UM SÓ, compartilhado de propósito.** As chaves são endereçadas
por **conteúdo**, então compartilhar reaproveita fetch e embedding já pagos:

| chave | o que guarda |
|---|---|
| `content:<urlHash>` | corpo do artigo (Jina) |
| `embedding:<textHash>` | vetor 1536-dim (OpenAI) |
| `geo:<chave>` | geocode (Nominatim, 90 dias) |
| filas BullMQ | **sufixo por ambiente** (`queueNames.ts`) — produção mantém o nome puro de propósito |

🚨 **O backend de produção NÃO tem auto-deploy.** `git push` para `main` é aceito
e **nada acontece**. Depois de empurrar: dashboard do Render →
`Manual Deploy → Deploy latest commit`, e conferir no `/health` que o
`uptime_seconds` zerou e o `commit` é o novo. O painel admin sobe sozinho; só o
backend não.

⚠️ **Dev local e staging dividem o mesmo banco** — a disputa pela coluna
`last_check` continua entre esses dois, mas o estrago fica fora do feed do
cliente.

⚠️ **Config é compartilhada dentro de cada banco.** Mudar uma chave no painel
vale **na hora, sem deploy**. Se o significado de uma config mudar, **mude o
nome** — não reaproveite a chave.

🚨 **O `defaultValue` de `SUPABASE_URL`/`SUPABASE_ANON_KEY` no app é PRODUÇÃO**
(escolha deliberada — ver o comentário em `env.dart`). Build sem
`--dart-define-from-file` não falha: autentica no banco do **cliente** e abre
normal, sem sinal nenhum. Para staging, `env/staging.json` é obrigatório.

### 3.3 Os dois caminhos

| | auto-scan | busca manual |
|---|---|---|
| **dispara** | CRON, env `SCAN_CRON_SCHEDULE` (a config do banco é **ignorada**) | o usuário, no app |
| **quando** | só na janela de operação: dias úteis, horário comercial, `America/Sao_Paulo` forçado | qualquer hora |
| **alvo** | todas as `type='city'` | 1 cidade (+ região junto) |
| **assuntos** | em rodízio, cobrindo a lista ao longo do dia | escolhidos na tela |
| **coleta** | News paginado | dual-source em paralelo: Web Top 100 (volume) + News paginado (qualidade) |
| **peneira própria** | **STAGE 1.5**: URL já em `news_sources` → fora; fora da janela → fora; **sem data legível → MANTÉM** | — |
| **dedup contra o banco** | ✅ 3 camadas (§5) | ❌ **não faz** |
| **grava em** | `news` + `news_sources` | `search_results` (JSONB) |
| **push** | 1 por **rodada**, agrupado por usuário | de conclusão, com deep link |

### 3.4 Modelo de dados

```
  monitored_locations           city_groups
    id, name, type              id, name
    parent_id ---+                 ^
    (cidade -> estado)             |
    last_check   |            city_group_members
    keywords[]   |              group_id --+
                 |              location_id -----+
                 +---------------------------------+

  news                          news_sources
    id                            id
    cidade  <<< TEXTO             news_id ------> news.id
    estado                        url  (unica)
    titulo / resumo / corpo       source_name
    tipo_crime                    fetched_at
    categoria_grupo
    data_ocorrencia             (1 noticia : N fontes)
    hora_publicacao
    embedding vector(1536)
    natureza (ocorrencia|estatistica)
    confianca / active
```

🚨 **`news` NÃO tem chave estrangeira para `monitored_locations`** — a ligação é
o **texto** da coluna `cidade`. É por isso que cidade homônima é problema de
pós-filtro (§4) e não do banco, e por isso o relatório de um grupo precisa de
`.in('cidade', [...])` com a lista de nomes.

⚠️ **Sem `parent_id` não há pós-filtro nenhum** (`locationPostFilter =
undefined`): a cidade aceitaria notícia de qualquer lugar. Hoje as cidades
monitoradas têm pai — é latente, não ativo.

As outras 13 tabelas (`budget_tracking`, `reports`, `user_notification_prefs`,
`pipeline_rejected_urls`, `search_cache`, `executive_cache`…) estão em
[SQL/schema_staging.sql](./SQL/schema_staging.sql). **Não deduza schema: rode
`backend/scripts/diagnostico-banco.ts`.**

---

### 3.5 A fronteira — o que pode depender de quê

Um sistema que serve públicos diferentes apodrece de um jeito conhecido: `se for
consultor… senão se for gerente…` espalhado por dentro de cada tela e cada
endpoint. A conta é cruel — cada papel novo multiplica **todas** as telas que já
existem, e chega o dia em que ninguém consegue mais responder quem enxerga o quê.
Esta seção é o antídoto. *Quais* públicos existem e onde cada um mora é decisão de
produto, e mora no [ROADMAP](./ROADMAP.md).

**A ordem das camadas no backend:**

```
routes  →  services  →  database
jobs entra pelo lado: usa services e database, nunca routes
```

**Nada aponta para cima.** `database` não conhece rota; serviço não conhece rota.

⚠️ **A exceção de hoje é acidental — não é dependência de verdade.** O logger mora
em `middleware/logger.ts`, e por isso `database/queries.ts`,
`database/analyticsQueries.ts` e `config/redis.ts` importam de `middleware`. É
arquivo na gaveta errada: o lugar dele é `utils/`. Quem for mexer nesses três,
mova junto.

#### Módulo é capacidade. Papel é dado.

- **Módulo** = uma capacidade do sistema — notícias, formulário, relatório,
  indicador. Pasta própria, tabelas próprias, endpoints próprios. 🚨 **Um módulo
  não sabe quem está usando ele.** Essa é a regra inteira.
- **Papel** = uma linha no banco dizendo quais módulos a pessoa recebe e **qual
  fatia do dado** ela enxerga.

🚨 **O teste de que a fronteira está viva: criar um papel novo é inserir uma
linha, não fazer um deploy.** No dia em que "adicionar supervisor regional" exigir
editar código de tela, ela já foi rompida.

E as duas metades não têm o mesmo peso. *Quais módulos eu vejo* é navegação — erro
ali é constrangimento. *Quais linhas eu vejo dentro do módulo* é a regra 11 do §2
— erro ali é vazamento, e é por isso que o recorte mora numa camada só.

#### Onde isso está hoje

**Papel não existe.** A identidade que o backend carrega é `{ id, email }`
(`middleware/auth.ts`) e o único portão é `is_admin`, em `user_profiles`.
`requireSearchPermission` não é papel: é um interruptor global
(`search_permission`), igual para todo mundo.

Isso não é dívida a pagar — é fundação que ainda não foi construída, e é a
primeira coisa que entra no banco quando for.

---

## 4. O funil — pipeline core

> 📍 Este bloco diz **por que cada estágio existe**. Onde cada item morre, com
> números medidos e custo por estágio, é o [FUNIL.md](./FUNIL.md) — número de
> mortalidade vai lá, razão de regra vem para cá.

O desenho é o **modelo mental** do sistema. Os valores de corte são config e
mudam; a **ordem** e a **razão de cada estágio** não.

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
  (+ dedup contra DB,           (salva em search_results)
   + push da RODADA)
```

### Por que cada estágio é assim

**Filter1 nunca faz fallback "aprova tudo".** Se a API falhar depois do retry,
ele **lança** e deixa o BullMQ retentar. Aprovar tudo por segurança explodiria o
orçamento nos estágios seguintes, que são os caros. Já parse inválido ou tamanho
de array errado faz padding `true` — ali o custo de errar é um artigo a mais, não
o orçamento inteiro.

**O Filter2 SEMPRE exige cidade + estado juntos.** Sem o estado, São José (SC)
vira São José (SP). Não relaxar isso.

**A regra 1 do Filter2 exige EVENTO, e a regra 2 tem lista negativa.** Só "public
safety content" fazia entrar campanha de conscientização, fórum, palestra, aviso
de votação e alerta de tempestade — tudo caindo em `manifestacao`, que virou
balde de qualquer ajuntamento e por isso está **congelada**. Quem herdou o que
interessa: `bloqueio_via` (protesto que fecha via) e `greve`, hoje tipo próprio.

**Os assuntos escolhidos pelo usuário entram como contexto nos prompts do Filter1
e do Filter2.** Sem isso o Filter1 mata `greve` e `bloqueio` pacífico **antes do
Jina**, em silêncio: são assuntos que o modelo não considera "segurança pública".
**A regra do usuário vence a regra de crime.**

**Trocas de prompt já testadas e DESCARTADAS:** reescrever o prompt da camada 3
do dedup para reduzir um suposto viés pró-"YES" deu **regressão** no teste de 10
pares (`scripts/test-dedup-prompt.ts`) — o prompt mais rigoroso passou a dar NO
para o mesmo evento escrito de formas diferentes, que é o valor central do
sistema. Não refazer sem um teste melhor.

---

## 5. O dedup — três camadas por custo

As camadas são separadas **por custo, não por precisão**: a barata elimina a
maioria, e o GPT só vê o que sobra.

```
  candidato novo
        |
        v
  [1] GEO-TEMPORAL em SQL .... $0 ...... << E UM PORTAO, NAO UM VEREDITO
        |   mesma cidade, dentro de           quem esta consulta nao
        |   DEDUP_JANELA_DIAS = 3 dias        devolve, ninguem mais
        |   (nao 1 — ver abaixo)              examina
        v
  [2] COSINE sobre embedding . $0 ...... limiar 0.70
        |                                 !! vem do BANCO
        |                                 (dedup_similarity_threshold)
        v
  [3] GPT, so o TOP match .... ~5% ..... pergunta SIMETRICA
        |                                 por construcao do prompt
        v
   duplicata? -> vira source[] do lead (maior confianca)
```

🚨 **A camada 1 é um PORTÃO.** Por isso a janela de data é de **3 dias** e não de
1: a `data_ocorrencia` da mesma matéria pode divergir entre scans, porque a regra
4 do Filter2 manda usar a data de hoje quando não acha a de publicação. Janela
curta deixa duplicata passar sem que as camadas 2 e 3 sejam sequer consultadas.

🚨 **O limiar da camada 2 vem do BANCO** (`dedup_similarity_threshold` = 0.70),
**não** do `DEFAULT_SIMILARITY_THRESHOLD = 0.85` que está no código. O default
tem nome de verdade e não é a verdade — conferir no painel antes de raciocinar
com ele.

🚨 **A camada 3 pergunta de forma simétrica, e isso é load-bearing.** Antes não
era: `(A,B)` dava YES e `(B,A)` dava NO para o mesmo par, deterministicamente.
Quem mexer no prompt tem que testar **nas duas ordens**.

---

## 6. Auto-scan

**Quem manda no horário é a env `SCAN_CRON_SCHEDULE`** — a config
`scan_cron_schedule` no banco é **ignorada**.

Roda só na **janela de operação** (timezone `America/Sao_Paulo` forçado via
`Intl`): dias úteis, horário comercial, fim de semana desligado por default. Fora
da janela o tick inteiro é pulado — nada enfileira, nada é marcado.

**Escaneia apenas `type='city'`.** Escanear `state` polui o banco com cidades
erradas.

**Os assuntos rodam em rodízio**, alguns por execução, cobrindo a lista inteira
ao longo do dia. Por isso levar a taxonomia inteira para `search_subjects`
**não aumenta o custo recorrente** — aumenta a cobertura ao longo do dia.

**STAGE 1.5, a peneira barata antes de qualquer GPT:** URL que já está em
`news_sources` cai fora, e matéria publicada antes da janela cai fora com 1 dia
de folga. **Sem data legível, MANTÉM** — na dúvida paga-se o Jina, não se perde a
notícia. As métricas vão em `budget_tracking.details`.

**A contabilidade de custo tem uma fonte só:** `custoDoRun` acumula exatamente o
que cada estágio grava em `budget_tracking`. Não recriar cálculo por fórmula com
taxas na mão — dois números que se calculam por caminhos diferentes discordam por
construção.

### O push

**Sai UMA VEZ POR RODADA, depois do laço que grava.** Nunca de dentro do laço:
com média de 2,0 notícias/dia isso é invisível, e num dia de 31 vira 31 vibrações
onde cabem 15.

🚨 **O agrupamento acontece POR USUÁRIO, nunca por lote.** O recorte de
`querReceber` (cidade, assunto, estatística) é individual, então "quantas
chegaram" é pergunta diferente para cada pessoa — agrupar antes de filtrar
mandaria "5 notícias" para quem pediu 1. Aparelhos com o **mesmo** recorte
dividem uma chamada ao FCM.

⚠️ **Push é a única parte do sistema que não dá para conferir sem incomodar o
cliente** — o caminho real termina no bolso de quem está trabalhando. Por isso
`sendPushForBatch(…, { dryRun: true })`: monta título, corpo, canal e alvos, loga
e para antes do FCM. Não prova canal nem som; prova o texto.

---

## 7. Busca manual

Mesmo pipeline core, mais: filtro de cidade/estado pós-Filter2, progress
persistido em JSONB, push de conclusão, e **sem** dedup contra o banco.

**Dual-source por cidade, em paralelo** (`Promise.allSettled`): Web Top 100 para
volume, News paginado para qualidade.

🚨 **As duas fontes têm confiabilidades diferentes** (medido 30/07):

| | NEWS | WEB (Top 100) |
|---|---|---|
| **papel** | **alicerce** | **loteria** |
| **comportamento** | estável: 20 resultados por cidade em **todas** as medições | errático: 85, 10, 1, 11, 98… com requisição **idêntica** |
| **sustenta** | o auto-scan inteiro, e é o piso da busca manual | volume extra, quando vem |

**O erratismo do web não é instabilidade — é o Google bloqueando tráfego
raspado.** Ele respondeu `results_cnt=1` para uma query com 61.500 resultados. O
índice orgânico é o dado mais raspado da internet, então é o que o Google mais
defende.

🚨 **NÃO ADICIONAR RETRY POR CONTAGEM BAIXA.** Não dá para distinguir "fui
bloqueado" de "essa cidade não tem notícia": Florianópolis rende ~26/mês, Santos
1, Águas da Prata 1. Gatilho apertado queima dinheiro em cidade pequena; gatilho
frouxo não dispara quando precisa. Repetir só sobre **sinal explícito**
(`x-brd-err-code`, corpo de 0 bytes), nunca sobre suspeita.

**Os tetos derivam do período por raiz quadrada, sem faixas**
(`manualSearchCaps.ts`).

**O teto de análise (`manual_search_analysis_cap`) é 0 = SEM TETO, e isso é
deliberado.** Com cota de 50, mediu-se **142 candidatos dentro da janela virando
50** (medido na Fase 8). Tempo se ataca por **vazão**, nunca por descarte — quem
descarta joga fora notícia já coletada e paga.

**Quem escolhe os assuntos é o usuário, na tela.** O catálogo único vive em
[`backend/src/utils/taxonomia.ts`](../backend/src/utils/taxonomia.ts) e é servido
por `GET /settings/taxonomia` — a mesma lista alimenta as queries, a tela e a
classificação.

**A validação aceita 1 cidade por busca.** `1 cidade + região` custa o mesmo que
`1 cidade`, então permitir N seria pagar N vezes por algo que já vem junto.

### Região metropolitana — hoje é por GPT, e ela alucina

A lista de cidades vizinhas vem de um GPT com cache, e o pipeline compara por
**nome**, nunca por coordenada. Medido no cache do Redis (04/08):

| capital | cidade devolvida | realidade |
|---|---|---|
| Goiânia | Mara Rosa | **350 km** |
| Goiânia | Jussara / Caldas Novas | ~300 km / ~170 km |
| Porto Alegre | Maricá | fica no **Rio de Janeiro** |
| Campo Grande | Cristalina | fica em **Goiás** |

São Paulo e Salvador saem corretas — o modelo memorizou as famosas.

⚠️ **As de outro estado são inofensivas** (o pós-filtro exige o estado bater).
**As do mesmo estado, longe, passam** e chegam ao usuário rotuladas como região
metropolitana. Substituir por raio geográfico está no
[ROADMAP](./ROADMAP.md); não estender o GPT para isso é decisão fechada no
[API_CONTRATO](./API_CONTRATO.md) — raio é conta, e o modelo erra conta.

---

## 8. Serviços externos — só o que morde

O que cada serviço *é* está no próprio nome. O que morde:

**Bright Data — dois modos com custo e latência muito diferentes.** O modo *news*
(`tbm=nws`) é síncrono e responde em segundos. O modo *web* ("Top 100") é uma
Dataset API: trigger, polling, download de snapshot. **O polling vai a até 60
tentativas de 3s, com 1 retry — até ~6 minutos por cidade no pior caso.** É o
maior sumidouro de tempo isolado do sistema. Não tem limite de concorrência, só
de vazão: **100 QPS**, e uma busca faz ~0,07.

**O teto do índice do Google é por QUERY e não é regulável.** Medido com
paginação correta (Floripa, 30 dias, 04/08): 10, 10, 10, 1, 0, 0 = **31 notícias
únicas**. Aumentar config além disso não cria notícia que não existe. **Mais
assuntos é a única alavanca real de alcance** — cada assunto é um teto novo.

**Paginação do news:** `num` foi deprecado pelo Google (set/2025) e a SERP devolve
~10 por página — paginar com `start` de 10 em 10. Incremento de 20 **pula as
posições 10–19 de cada página** e perde ~1/3 do material. E `brd_json=1` é
**obrigatório** na URL: sem ele vem HTML bruto e o `JSON.parse` falha em silêncio.

**O Google ignora o filtro de data.** Só `sbd:1` (ordenar por data) é obedecido.

**Query curta ganha de query longa, e nunca colocar o estado na query** — o
estado empurra o resultado para conteúdo institucional. Quem desambigua cidade
homônima é o pós-filtro do Filter2.

**Jina** leva **~7,4s por artigo** (medido com pool de 10) e tem fallback Web
Unlocker (Bright Data) para 403/422/503/SSL — tipicamente domínios `.gov.br`. O
cache **não guarda respostas com menos de 100 chars**, senão uma página vazia
envenenaria o cache por 24h. Trata `429` lendo o `Retry-After`.

**Google News RSS obedece `when:`** mas é inútil como fonte: a URL é redirect
opaco e o Jina devolve ~98 chars de boilerplate. Serve como *índice*, nunca como
fonte.

**Nominatim/OpenStreetMap** é grátis e a política de uso é **1 requisição por
segundo — não paralelizável**. Por isso o geocode tem cache em duas camadas
(memória + Redis, 90 dias) e o aquecimento roda **depois** da entrega, nunca
antes: sequencial × 1,1s × até 3 lookups por ponto estoura qualquer timeout de
cliente.

**Redis/Upstash** carrega fila (BullMQ), cache de config, de conteúdo e de
embedding. Os TTLs estão no código.

---

## 9. Configuração — o que não está no código

As chaves e seus valores estão em
[`configManager/index.ts`](../backend/src/services/configManager/index.ts). O que
**não** dá para deduzir lendo aquele arquivo:

- **O painel mescla banco + DEFAULTS** e marca `origem='default'` nas chaves que
  só existem em código. Sem isso elas somem da tela, e um toggle vazio lê como
  DESLIGADO enquanto o backend o usa LIGADO.
- **As configs de rate limit vivem na tabela `api_rate_limits`**, por provider
  (`max_concurrent`, `min_time_ms`), e alimentam um Bottleneck.
- **Config vale na hora, sem deploy** — e é compartilhada por todos que falam com
  aquele banco. Significado novo exige **nome novo**.

---

## 10. Armadilhas que já custaram tempo

### App / Flutter

| armadilha | o que fazer |
|---|---|
| **`--dart-define-from-file` é resolvido em tempo de COMPILAÇÃO** | `flutter run` deixa instalado um APK apontando pro IP da LAN que **abre e loga normal** e só morre nas chamadas ao backend. Conferir com `adb shell dumpsys package com.progestao.simeops` |
| **O `defaultValue` do Supabase no app é PRODUÇÃO** | build sem o arquivo de env autentica no banco do cliente sem sinal nenhum. Para staging, passar `env/staging.json` |
| **O pacote é `com.progestao.simeops`** | `com.netriosnews.netrios_news` sobrevive só no `namespace` (pacote Kotlin da `MainActivity`) |
| **Staging e produção são o MESMO app no aparelho** | instalar um substitui o outro. Separar exige `applicationIdSuffix` por variante **mais** um cliente Firebase para o sufixo — sem os dois, o build morre em `processReleaseGoogleServices` |
| **`MainActivity` tem que ser `FlutterFragmentActivity`** | o `local_auth` usa `BiometricPrompt`, que só se hospeda numa `FragmentActivity`. Com a `FlutterActivity` comum o plugin devolve `NOT_FRAGMENT_ACTIVITY` sem abrir diálogo, e o app lê isso como "a pessoa cancelou" |
| **Timestamps do Postgres vêm sem fuso** (`TIMESTAMP` + `DEFAULT NOW()`) | o Dart parseia como local e adianta 3h. A conversão mora em `core/utils/datas.dart` |
| **Testar sempre em device físico via LAN IP** | emulador não simula push real |

### Banco e migrations

| armadilha | o que fazer |
|---|---|
| **O `MIGRATIONS_LOG.md` já mentiu** | é preenchido à mão. Antes de assumir schema, rodar `backend/scripts/diagnostico-banco.ts` |
| **O cabeçalho dentro do `.sql` também já mentiu** | quatro migrations diziam "NÃO RODADA" e tinham rodado. O log e o arquivo são pistas; o banco é a prova |
| **`select("*", { head: true })` NÃO popula `error` quando a tabela não existe** | a sondagem volta limpa e a tabela ausente aparece como existente. Checagem de tabela precisa de `select` de verdade, com linha |
| **O código de "tabela não encontrada" é `PGRST205`, não `42P01`** | `42P01` é do Postgres; o PostgREST tem os seus. Quem checa o código errado lê "existe" |
| **Escrita direta no banco pelo Bash é bloqueada** | mudança de schema vira migration em [SQL/migrations/](./SQL/migrations/) + entrada no [MIGRATIONS_LOG](./SQL/MIGRATIONS_LOG.md) no mesmo turno, e o João roda |

### Ambiente de trabalho

| armadilha | o que fazer |
|---|---|
| **`.bat` via `cmd.exe /c` não executa de verdade** aqui | chamar o `flutter build` direto |
| **Script que fala com Redis precisa de `process.exit(0)`** | `main();` solto pendura o processo — já custou dois timeouts |
| **Não dá para ver o Flutter renderizado** | pedir foto do aparelho ao João; a tela passa no analyzer e reprova na foto |

---

## 11. Quando der ruim — o que rodar

**Nunca deduza o estado do sistema de documento nenhum, inclusive este.**

| pergunta | como responder de verdade |
|---|---|
| que código está no ar? | `GET /health` → `commit` e `uptime_seconds`. Identifica o **serviço web** |
| que código processou este job? | `budget_tracking.details.commit`, gravado a cada busca manual **e** a cada scan. Pode não ser o mesmo do `/health` |
| **este documento ainda bate com o código?** | `node workdesk/scripts/verificar-workdesk.cjs` — confere identificadores e links dos documentos persistentes. Roda sozinho a cada sessão |
| o schema tem a coluna X? | `npx tsx backend/scripts/diagnostico-banco.ts` (só leitura) |
| onde a busca perdeu os itens? | `npx tsx backend/scripts/diagnostico-funil.ts` — funil com motivos de rejeição |
| quanto já gastamos este mês? | tabela `budget_tracking`; o Dev Panel (`localhost:3100`) mostra consolidado |
| o push sairia certo? | `sendPushForBatch(…, { dryRun: true })` — prova o texto, não o canal |
| o app está falando com qual banco? | `adb shell dumpsys package com.progestao.simeops` + conferir o env do build |

⚠️ **Concluir por inferência qual código está rodando já custou duas sessões
inteiras.** São dois minutos de comando contra horas de raciocínio errado.

---

## 12. Onde procurar o resto

| pergunta | documento |
|---|---|
| o que cada rota recebe e devolve, e as decisões que não se desfazem | [API_CONTRATO.md](./API_CONTRATO.md) |
| onde cada item do funil morre, com números e custo | [FUNIL.md](./FUNIL.md) |
| cor, tipografia, o que a tela pode e não pode fazer | [DESIGN_CONTRATO.md](./DESIGN_CONTRATO.md) |
| as três coletas de campo da SIC, as perguntas e o que as bases medem | [FORMULARIOS_SIC.md](./Protótipo/FORMULARIOS_SIC.md) |
| onde o app sai do instrumento da SIC, e o porquê de cada diferença | [MUDANCAS.md](./Protótipo/MUDANCAS.md) |
| o que falta fazer, e o risco de cada item | [ROADMAP.md](./ROADMAP.md) |
| **como** se chegou a cada decisão, com a data | [DEV_LOG.md](./DEV_LOG.md) |
| a sessão em curso, em ~25 linhas | bloco **ONDE PARAMOS**, topo do [DEV_LOG](./DEV_LOG.md) |
| história das fases fechadas | [Fases/README.md](./Fases/README.md) |
| que rotas existem | [`backend/src/routes/`](../backend/src/routes/) |
| o que cada rota aceita, e **por que** aquele limite | [`validation.ts`](../backend/src/middleware/validation.ts) |
| como o item de resultado é montado | [`manualSearchWorker.ts`](../backend/src/jobs/workers/manualSearchWorker.ts) |
| como o app lê tudo isso | [`news_item.dart`](../mobile-app/lib/core/models/news_item.dart) |
| como trabalhamos (regras, "pronto", disciplina) | [CLAUDE.md](../CLAUDE.md) |
