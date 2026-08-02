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
com os templates mortos.

### Onde o funil perde hoje (Salvador, 30 dias, staging)

```
86 URLs → 68 Filter1 → 50 análise (TETO cortou 18) → Filter2 extraiu 26 → dedup entregou 13
```

O dedup está em `dedup_similarity_threshold = 0.70`. O João já testou 0,80 e
**ainda duplicava**, por isso baixou. Causa real: o algoritmo compara só cosine
contra o elemento semente, sem olhar data nem tipo de crime — subir o número não
resolve, é o algoritmo que precisa mudar (ver ROADMAP).

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
