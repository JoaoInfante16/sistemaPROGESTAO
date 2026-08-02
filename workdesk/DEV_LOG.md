# DEV_LOG — SIMEops (Fase 8)

> Diário de bordo: o que foi feito, decisões tomadas, problemas encontrados.
> Append-only, cronológico (mais recente no topo).
>
> Fases 1 a 7 arquivadas em [Fases/](./Fases/). A Fase 7 (auditoria + conserto da
> busca manual) está em [Fases/Fase 7/](./Fases/Fase%207/) — inclusive o DEV_LOG
> detalhado do dia 30/07 a 02/08, com todas as medições.
>
> Rotação: quando passar de ~1500 linhas, mover conteúdo antigo pra `_archive/`.

---

## 📍 ESTADO DO MUNDO — leia isto primeiro

> Bloco de orientação para instâncias novas do Claude (ou para o João depois de
> um tempo longe). Atualizar quando mudar.

### Onde cada ambiente está

| ambiente | branch | commit | situação |
|---|---|---|---|
| local | `develop` | em dia | tudo desta fase |
| staging | `staging` | `6ff8ba8` | **funcionando** — Salvador devolve 13 resultados |
| **produção** | `main` | `faa38b7` | 🔴 **quebrada em 4 lugares, é o que o cliente usa** |

**Chave da Bright Data:** a de **staging estava expirada** (`SERP error 401: Token expired`) e foi trocada pelo João em 02/08 — era o último bloqueio para validar a busca lá. A de **produção está boa** (confirmado por ele no mesmo dia), então a promoção de `main` não depende de mexer em credencial.

**Produção é a prioridade 1.** `main` está de junho e não tem nada do que foi
consertado. Confirmado lendo o código de `origin/main`:

| o que falta em `main` | efeito |
|---|---|
| `brd_json` (zero ocorrências) | a SERP devolve HTML cru, `JSON.parse` falha **em silêncio** |
| paginação com `perPage=20` + `num` (deprecado) | pula as posições 10-19, perde ~1/3 |
| scraper assíncrono `datasets/v3/trigger` | o Top 100 que foi de 17-70s para 660-978s — **a travada que o cliente relatou** |
| query `allintext:"cidade"` | medido: o Google responde `results_cnt = 0` |

### Como saber QUAL código está rodando (não deduzir — ler)

Custou duas sessões inteiras concluir errado por inferência. Desde 01/08 existe
sinal direto:

- **`GET /health`** devolve `commit` (vem de `RENDER_GIT_COMMIT`, injetado pelo Render).
  Identifica o **serviço web**.
- **`budget_tracking.details`** grava `commit` e `queries` a cada busca.
  Identifica o processo que de fato **processou o job** — que pode não ser o mesmo.

### Armadilha nº 1 do projeto: infra compartilhada

**Staging, produção e dev local usam o MESMO Upstash Redis e o MESMO Supabase.**

Até 01/08 as filas BullMQ tinham nome fixo, então o worker da **produção**
(código velho) competia com o de staging pelos mesmos jobs e ganhava a maioria.
Toda busca de teste do João era processada pelo código quebrado da produção —
por isso Salvador voltava 1 resultado enquanto o mesmo código local achava 18.

Corrigido em `jobs/queueNames.ts`: sufixo por ambiente. **Produção mantém o nome
puro de propósito** — quando `main` atualizar, nada muda para o app do cliente.

Um `npm run dev` local esquecido causava o mesmo roubo (o `.env` local aponta
para o mesmo Redis). Agora ele fica em `-development`.

### Medições que NÃO devem ser refeitas

Todas de 01/08, com o método real do worker (ver [Fases/Fase 7/DEV_LOG.md](./Fases/Fase%207/DEV_LOG.md)):

- **O Google ignora o filtro de data.** `qdr:d`, `qdr:w`, `qdr:m` e até `cdr:1` com
  range explícito devolvem **os mesmos 10 resultados, na mesma ordem**. Só `sbd:1`
  (ordenar por data) é obedecido — e ele pagina cronologicamente com URL real.
- **Query curta ganha de query longa.** `polícia Porto Alegre` → 10/10 dentro da
  janela, a mais recente de 17h atrás. A query longa antiga → 4/10.
- **Não colocar o estado na query**, nem por extenso nem sigla: `polícia São José`
  trouxe matéria de 44 minutos atrás; `polícia São José SC` parou em 3 semanas. O
  estado empurra o ranking para conteúdo institucional. Quem desambigua cidade
  homônima é o pós-filtro do Filter2, lendo cidade **e** estado do corpo do texto.
- **A Bright Data NÃO tem limite de concorrência.** Documentação oficial: SERP API
  sem limite de requisições simultâneas; o limite é de vazão, **100 QPS** por conta
  (1.000 req/min sem saldo), e estourar devolve **HTTP 429**. Uma busca faz ~6
  requisições em 85s = 0,07 QPS. O `serp: 1` visto no console **não é** limite de
  concorrência.
- **Google News RSS obedece `when:`** (`when:30d` → 37 itens, 100% na janela, grátis)
  **mas é inútil como fonte de conteúdo**: a URL é redirect opaco, o Jina devolve 98
  chars de boilerplate e o pipeline descarta abaixo de 100 chars. Serve como
  *índice* (título/data/veículo corretos), nunca como fonte.
- **Nunca fazer retry por contagem baixa.** Não dá para distinguir "fui bloqueado"
  de "essa cidade não tem notícia". Retry só sobre **sinal explícito** (corpo de 0
  bytes, `x-brd-err-code`).

### 🚫 Auto-scan: não encostar

Ordem explícita do João em 02/08: *"N toque no auto scan que ta funcionando!!"*.
Da Fase 8 em diante, **nada de alterar código compartilhado com ele** — se um
stage precisar mudar para a busca manual, criar função nova e deixar a antiga
intacta (vale sobretudo para `runIntraBatchDedup`).

**Ele NÃO está parado por bug — está fora da janela.** `scan_weekend_enabled = false`,
`scan_weekday_start = 6`, `scan_weekday_end = 18`. Última execução: sexta 31/07
às 20h. 01 e 02/08 são sábado e domingo, então volta na segunda.

**O que já foi alterado em 01/08 e afeta o auto-scan** (feito antes da ordem
acima, e declarado nos commits — registrado aqui para não virar surpresa):

| mudança | efeito esperado no auto-scan |
|---|---|
| `queryTemplates.ts` reescrito | **deve melhorar muito** — os templates 1-4 eram frases de Perplexity e devolviam ZERO no Google |
| `sbd:1` + parada de paginação por janela no provider | resultados vêm ordenados por data; ele já filtra ≤2 dias |
| `runFilter2WithEmbedding` paralelizado | mais rápido; mesma saída |
| `queueNames.ts` (sufixo de ambiente) | staging e produção param de disputar a mesma fila |

**Ainda não rodou com essas mudanças** (entraram no fim de sexta/sábado, com o
CRON já fora da janela). A primeira execução real será na segunda — vale
conferir `operation_logs` nesse dia.

Sinal de que as mudanças eram necessárias: nos logs de 31/07 o auto-scan
processava 1 a 10 URLs por scan e achava **0 notícias** em quase todos. Consistente
com os templates mortos. **Esse é o "antes"** da medição da Fase 11 — não perder.

Melhorar o auto-scan **é trabalho previsto, só que depois**: o João pediu no mesmo
dia que ficasse no plano, condicionado a a busca manual passar nos testes. Está na
[Fase 11 do ROADMAP](./ROADMAP.md), com gatilho e candidatos. Até lá, a ordem de
não encostar vale integralmente.

### Onde o funil perde hoje (Salvador, 30 dias, staging)

```
86 URLs → 68 Filter1 → 50 análise (TETO cortou 18) → Filter2 extraiu 26 → dedup entregou 13
```

O dedup está em `dedup_similarity_threshold = 0.70`. O João já testou 0,80 e
**ainda duplicava**, por isso baixou. Causa real: o algoritmo compara só cosine
contra o elemento semente, sem olhar data nem tipo de crime — subir o número não
resolve, é o algoritmo que precisa mudar (ver ROADMAP).

---

## 2026-08-02 — 8.2: parar de descartar ✅

Os dois maiores motivos de rejeição do Filter2 (cidade vizinha e data fora da
janela) deixam de virar descarte e viram **sinalizador** no resultado.

**Medido** (`scripts/diagnostico-funil.ts "Salvador" "Bahia" 30 30`):

```
região metropolitana resolvida: 12 municípios (GPT, cacheado 30d)
PRINCIPAL ............. 21
EXTRAS — antes eram descartados:
  região metropolitana .. 3   (Camaçari ×2, Lauro de Freitas)
  fora do período ....... 0
```

Feira de Santana (3 matérias) **continuou rejeitada** — não é região
metropolitana. É o comportamento certo: vizinha não virou "qualquer cidade da BA".

### 🔴 Achado do teste: o período não está sendo respeitado em capital

A notícia mais antiga do principal é de **30/07** — numa busca de **30 dias**.
Cobriu 3 dias e chamou de 30.

Causa: `MANUAL_NEWS_MAX_PER_QUERY = 20` é constante e limita a **coleta**, não a
análise. Com `sbd:1` ordenando por data, 20 resultados numa capital não passam de
uns poucos dias. **Em Salvador, pedir 30 ou 90 dias devolve a mesma coisa.**

Não é regressão da 8.2 (é anterior, e a 8.1 não mexe nisso), e não é bug de
código — é teto mal dimensionado. É exatamente o que a **8.4** conserta, e sobe
de "melhoria" para **pré-requisito**: sem isso o seletor de período é decorativo
em cidade grande, e `fora_do_periodo` nasce vazio porque a coleta nem chega lá.

### O que mudou

1. **`classificar` é opt-in** em `PostFilter2Options`. ⚠️ O auto-scan chama a
   **mesma** `runFilter2WithEmbedding` passando `postFilter` — sem o opt-in ele
   passaria a gravar cidade vizinha e notícia velha na tabela `news`, a mesma
   poluição de escanear `type='state'`. Sem a opção, o caminho é byte a byte o de antes.
2. **Dois sinalizadores + `estado`** no resultado (`estado` vinha do Filter2 e era
   descartado na montagem). Booleanos independentes, porque Camaçari de três meses
   atrás é as duas coisas.
3. **`metroRegion.ts`** — GPT (`gpt-4o-mini`) + cache no Redis, TTL 30 dias, uma
   chamada por busca. Cacheia **inclusive lista vazia**. Qualquer falha → lista
   vazia e a busca segue como antes. Teto de 45 municípios contra alucinação.
4. **Vizinha ainda exige o estado bater** — sem isso Camaçari/SP entraria como
   vizinha de Salvador/BA, o mesmo erro de homônima que o filtro existe pra evitar.
5. **Horizonte** (`manual_search_horizon_days`, 365) é o descarte de verdade.

### Três leitores de `search_results`, não um

O contrato retrocompatível (`results` só o principal + `extras` ao lado) não
bastava: existem **três** caminhos de leitura, e os outros dois regrediriam calados.

| leitor | o que aconteceria | feito |
|---|---|---|
| rota `/results` | extras na lista do APK atual | `results` intacto, extras em `extras` |
| `getSearchResultsAnalytics` | donut, bairros e tendência contando extras | filtra na leitura |
| `getSearchMapPointsRaw` | **pino no lugar errado** | filtra na leitura |

O do mapa era o pior: `buildMapPoints` geocodifica contra a cidade **da
requisição**, não a do item — bairro de Camaçari viraria pino dentro de Salvador.

### Dedup por balde (provisório, e por quê)

`runIntraBatchDedup` elege o líder do cluster por confiança. Deduplicando tudo
junto, uma notícia principal podia se fundir com uma de cidade vizinha e **sumir**
do principal. Por balde isso é impossível.

O preço é matéria repetida entre principal e extras — visível só numa seção
recolhida, e bem menos grave que perder resultado. A **8.3** resolve com a trava
geo-temporal. 🚫 `runIntraBatchDedup` **não foi alterada** (compartilhada com o auto-scan).

Sem migration: `search_results.results` é JSONB livre.

---

## 2026-08-02 — 8.1: paralelizar de volta ✅

Desfeita a serialização de 01/08. Ela tinha sido feita com base na suspeita
(errada) de que a zone SERP aceitava ~1 requisição por vez; a documentação oficial
diz que **não há limite de concorrência**, só vazão de 100 QPS por conta.

**Medido pelo caminho real** (`scripts/test-search-providers.ts`, que agora roda
os dois modos e compara), Salvador / 30 dias:

| modo | tempo | URLs | requests |
|---|---|---|---|
| série (como era) | 23,7s | 59 | 6 |
| paralelo (como ficou) | **9,0s** | **59** | **6** |

**2,6x mais rápido com saída idêntica** — mesmas URLs, mesmo custo. Era tempo
jogado fora, não troca.

### O que mudou

1. **3 queries em paralelo** no `manualSearchWorker` (`Promise.allSettled` — uma
   query ruim continua não derrubando as outras, que era o que o `try/catch`
   dentro do `for` garantia).
2. **Paginação em lote** no provider: os offsets `start` são independentes, então
   as páginas de uma query vão juntas.
3. **Retry de corpo vazio** — 0 bytes com HTTP 200 e sem `x-brd-err-code` (visto
   em 01/08, ainda sem explicação) repete **uma** vez. Não contradiz a regra de
   nunca repetir por contagem baixa: lá o sinal é ambíguo, aqui não é.

### Duas decisões de desenho que valem lembrar

**A paginação em lote é opt-in (`pageConcurrency`, default 1 = serial).** O
provider é **compartilhado com o auto-scan**, e `search_max_results = 15` faz ele
paginar 2 páginas. Ligado por padrão, o CRON passaria a pedir sempre as duas em
vez de às vezes parar na primeira — mudança de custo e de comportamento nele. Só
a busca manual opta.

**O lote consome as páginas em ordem, com a mesma regra de parada de antes.** Se
a parada cai no meio do lote, o resto é descartado. Isso mantém o resultado
**idêntico** ao serial; o preço é $0,0015 por página especulativa, e o provider
loga quantas foram. Em Salvador foram zero — a janela de 30 dias não fecha antes
da página 2.

Commit próprio, `main`/auto-scan intocados.

---

## 2026-08-02 — abertura da Fase 8

Fase 7 fechou com a busca manual funcionando ponta a ponta em staging. A Fase 8
ataca o que sobrou de perda no funil e abre a busca de período longo.

**Escopo acordado com o João** (detalhamento no [ROADMAP](./ROADMAP.md)):

1. **Parar de descartar** — as duas maiores causas de rejeição do Filter2 são data
   e cidade vizinha, e as duas são informação que o usuário quer. Passam a ser
   classificadas em baldes (`fora_do_periodo`, `cidade_vizinha`) em vez de jogadas
   fora. Região metropolitana resolvida por GPT com cache em Redis.
2. **Dedup em camadas** — reusar a estratégia que o auto-scan já usa e que funciona:
   trava geo-temporal (mesma cidade + mesmo tipo + data ±1 dia) antes do cosine.
3. **Escada de períodos até 1 ano** — 30/60/90/180/365. Coletar fundo é barato
   (~$0,04); o custo é a análise, controlada por teto por período.
4. **Progresso granular** — contador dentro do estágio e achados ao vivo, para a
   tela de carregamento mostrar o funil andando em vez de 7 passos com check.
5. **Paralelizar de volta** — as 3 queries foram serializadas em 01/08 com base na
   suspeita (errada) de limite de concorrência. Desfazer: o estágio 1 cai de ~85s
   para ~30s, e a busca de 1 ano de ~8 min para ~3.

**Decisões de produto tomadas:**

- **Não expor controle de custo ao cliente.** O período já é essa alavanca, em termos
  que ele entende, e quem paga a conta é o João. Tetos ficam no admin.
- **Uma busca por vez** (mantém a trava atual). A UI é que precisa explicar, e o 409
  passa a devolver o `searchId` e o progresso para o app oferecer "ver progresso"
  em vez de um erro seco.
- **Flutter fica para depois**, documentado — são três telas e um card compartilhado
  com feed e favoritos. Conceito de UI do João registrado no ROADMAP: linha
  divisória destacada no fim da lista, no mesmo padrão do `_DateHeader` do feed,
  que expande ao toque.

**Ideia levantada e ainda não decidida:** fontes oficiais por estado (SSP/Polícia
Civil — 27 fontes, não 5.570 cidades, encaixando no `type='state'` que já existe
no schema). Motivo: o RSS grátis enxerga matéria que o SERP pago não surface, o
que sugere que a via raspada dá visão pior do índice do Google do que o feed
aberto. É projeto, não remendo — fazer só depois de medir o ganho do que está
acima.

**Ideia rejeitada, com o motivo** (para não ressuscitar): a busca manual ler o
próprio banco em vez de buscar na internet. O João vetou com razão — só ajudaria
em cidade já monitorada, que é exatamente onde a busca manual não faz falta.
