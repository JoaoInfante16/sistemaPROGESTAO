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

### Onde cada ambiente está (02/08, fim da sessão)

| ambiente | branch | commit | situação |
|---|---|---|---|
| local | `develop` | `373cf00` | Fase 8 + achados #1 e #2 da Fase 11 |
| staging | `staging` | `373cf00` | ✅ **validado no app: 54 resultados** (era 1) |
| **produção** | `main` | `faa38b7` | 🔴 **junho, quebrada em 4 lugares — é o que o cliente usa** |

`develop` e `staging` estão idênticas. APK de staging instalado no celular do João.

⚠️ **Os consertos do auto-scan só valem onde o scan roda.** Se o CRON de verdade
roda na `main`, os achados #1 e #2 não mudam nada para o cliente até a promoção.
Conferir na segunda de qual ambiente saem as linhas novas de `operation_logs`.

**Em curso:** os 4 achados da auditoria do auto-scan (Fase 11 do
[ROADMAP](./ROADMAP.md)). A ordem de "não encostar" foi suspensa **para esses
itens**.

| # | achado | estado |
|---|---|---|
| 1 | `São José do Cedro` no feed de `São José` (pós-filtro por substring) | ✅ **corrigido** — igualdade com limpeza, 21/21 no teste |
| 2 | `dateRestrict: 'd1'` vs `scan_period_days: 4` | ✅ **corrigido** — regressão minha de 01/08 |
| 3 | duplicata no `news` (`runIntraBatchDedupLayered` existe, não está ligado no scan) | pendente |
| 4 | custo contado de duas formas incompatíveis | pendente |

As 10 linhas erradas seguem no banco **de propósito** — decisão do João, fase de
teste. `scripts/limpar-cidades-intrusas.ts` está pronto para quando importar.

Achado novo da mesma investigação: **não existe dedup por URL antes do Jina** — o
scan reanalisa o mesmo artigo de hora em hora. Barato hoje ($0,12/mês), mas é
desperdício estrutural. Anotado na Fase 11.

### Documentos desta fase — ler antes de reconstruir contexto

| doc | para quê |
|---|---|
| [API_CONTRATO.md](./API_CONTRATO.md) | rotas e shapes, para quem mexer no app |
| [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md) | o que falta no backend, por consequência |
| [ROADMAP.md](./ROADMAP.md) | Fase 11 com os achados do auto-scan |
| `scripts/diagnostico-banco.ts` | estado REAL do banco (só leitura) — o MIGRATIONS_LOG já mentiu |
| `scripts/diagnostico-funil.ts` | funil da busca manual com motivos de rejeição |

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

### ⚠️ Auto-scan: a ordem mudou no fim do dia

Durante a Fase 8 valia *"N toque no auto scan que ta funcionando!!"* — e ela foi
respeitada: **todo ponto compartilhado virou opt-in** (`pageConcurrency`,
`classificar`, `onProgress`) ou função nova (`runIntraBatchDedupLayered`). A
`runIntraBatchDedup` original segue intacta.

**No fim de 02/08 o João pediu a auditoria e mandou atacar os problemas.** Então
mexer no auto-scan **está liberado para os 4 achados da Fase 11** — e só para eles.
Fora desses, a regra de opt-in continua sendo a mais segura.

E ficou provado que ele **não estava "funcionando"**: 9 das 10 últimas execuções
acharam zero notícias, e havia 10 notícias de uma cidade a 600 km no feed (os
achados #1 e #2 já foram corrigidos; as 10 linhas seguem no banco por decisão do
João, fase de teste).

**Ele NÃO está parado por bug — está fora da janela.** `scan_weekend_enabled = false`,
`scan_weekday_start = 6`, `scan_weekday_end = 18`. Última execução: sexta 31/07
às 20h. 01 e 02/08 são sábado e domingo, então volta na segunda.

📌 **Não caçar fantasma no horário:** `operation_logs.created_at` é **UTC** e a
janela do scan é local. Os logs de 09:00 a 20:00 UTC são 06:00 a 17:00 em Brasília
— batem exatamente com a janela 6–18. Está certo.

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

O resto da Fase 11 (candidatos de melhoria, não os 4 achados) continua valendo a
regra antiga: medir a primeira semana com os templates novos antes de mexer. Ver
[Fase 11 do ROADMAP](./ROADMAP.md).

### Onde o funil está DEPOIS da Fase 8 (Salvador, 30 dias)

```
175 URLs únicas → 168 Filter0 → 155 Filter1 → [teto] → 32 extraídas → 21 entregues
        ↑ alcance: 31 de 30 dias pedidos ✅
```

Antes da Fase 8 era `86 → 68 → 50 (teto cortou 18) → 26 → 13`, cobrindo **3 dias**
e chamando de 30.

O `dedup_similarity_threshold` segue em **0,70** e agora está certo: com a trava
geo-temporal da 8.3, ser permissivo no cosine é seguro. Subir o número
continuaria sendo a solução errada.

### Estado do banco — não deduzir, rodar

`workdesk/SQL/MIGRATIONS_LOG.md` é preenchido à mão e **já desatualizou** (019 e
020 estavam marcadas como pendentes e já tinham sido aplicadas).

**`npx tsx scripts/diagnostico-banco.ts`** — só leitura, olha o estado real:
colunas, tabelas, configs, migrations, buscas presas, últimas execuções do
auto-scan e custo do mês. Verificado em 02/08:

- migrations 019, 020, 021b, 022 **aplicadas**; 021 e 023 **não**
- `manual_search_web_enabled` **não existe no banco** → vale o default do código,
  que é `true`. **O ramo web está LIGADO.** (Um comentário no worker dizia o
  contrário e foi corrigido.)
- `search_max_results` = **20** (não 15, como estava escrito aqui antes)
- `filter2_confidence_min` = **0,5** (o default do código é 0,7)
- 7 configs mortas no banco
- custo do mês: **$0,12** de $100

---

## 2026-08-02 — Fase 11: cortar pela data do SERP antes de baixar o artigo

Segundo conserto do auto-scan, e o que o ROADMAP apontava como **maior ganho de
custo** entre os candidatos.

O `publishedAt` chega do estágio 1 desde a 8.4 e só era usado pra decidir quando
parar de paginar. Agora ele também corta: artigo publicado antes da janela não
desce pro Jina nem pro Filter2 — o pós-filtro ia rejeitar de qualquer forma,
**depois de pago**.

### Duas escolhas conservadoras

`parseSerpDate` é aproximado de propósito (`"1 mês atrás"` = 30 dias), e o preço
de um falso negativo aqui é notícia perdida. Então:

- **sem data legível, mantém** — o corte só age sobre evidência positiva;
- **1 dia de folga** sobre `scan_period_days`, pra imprecisão do parser não
  comer a borda da janela.

Quem decide de verdade continua sendo o Filter2, lendo a data da **ocorrência**
no corpo do texto. Este corte é sobre a data de **publicação** — e a direção que
importa é segura: matéria publicada antes do início da janela não descreve
ocorrência de depois dela.

### Medível sem instrumentar

Os cortados vão pra `pipeline_rejected_urls` com `stage = 'serp_data'` e o motivo
trazendo as duas datas. A coluna é `TEXT` livre (migration 006), então não houve
migration. Contagem também em `budget_tracking.details`
(`velhasPelaSerp` / `analisaveis`).

O `cleanupOldRejectedUrls()` subiu pra antes da peneira — senão o corte gravava
e a limpeza rodava logo em seguida sobre a mesma tabela.

---

## 2026-08-02 — Fase 11, achado #5: dedup por URL antes de qualquer GPT

Decisão do João: *"aplicamos tudo já, com cautela, testo em staging alguns dias
e depois subo tudo pro main"*. Primeiro dos três consertos do auto-scan.

O scan roda de hora em hora sobre a **mesma janela** (`scan_period_days` = 4
desde o conserto #2), então a SERP devolve os mesmos links rodada após rodada. E
o pipeline nunca perguntava ao banco se já conhecia aquela URL: o Jina tem cache
no Redis, mas **Filter1 e Filter2 não têm nenhum**. O mesmo artigo era reanalisado
até 24×/dia.

`db.findKnownSourceUrls(urls)` — `SELECT url FROM news_sources WHERE url IN (...)`,
em lotes de 100 porque o `.in()` do PostgREST viaja na query string e algumas
centenas de URLs longas estouram o tamanho do request.

### Duas decisões dentro do conserto

**Roda antes do Filter0, não só antes do Jina.** Estar em `news_sources` significa
que a URL **já virou notícia salva** — não existe estágio seguinte capaz de mudar
essa conclusão. Cortar no estágio 4, como estava planejado, ainda pagaria o
Filter1 (GPT em lote) por artigo que já está no banco.

**`urls_processed` do `operation_logs` não muda de significado.** Continua sendo
`searchResults.length`, o que a SERP entregou — é com esse número que o baseline
de 31/07 foi medido, e trocá-lo agora inutilizaria a comparação. Quem segue no
pipeline é a lista filtrada; a economia aparece em `budget_tracking.details`
(`jaVistas` / `ineditas`), que é JSONB livre e não precisa de migration.

**Falha degrada para "não conheço nenhuma"** em vez de derrubar o scan: erro
nessa consulta custa dinheiro (reanalisa), nunca corretude.

---

## 2026-08-02 — Fase 11, achados #1 e #2 corrigidos

Os dois primeiros da auditoria do auto-scan. Os dois mexem em código
**compartilhado com a busca manual** — o plano foi mostrado ao João e aprovado
antes de codar.

### #1 — cidade por igualdade, nunca por substring

Confirmado no banco antes de mexer:

```
monitored_locations: Florianópolis, Porto Alegre, São José, Palhoça
news "São José / SC" .......... 24
news "São José do Cedro / SC" . 10   ← ninguém monitora essa cidade
```

Fontes das 10: `portalsmo.com.br`, `portaltri.com.br`, `jornaldafronteira.com.br`
— imprensa do extremo-oeste catarinense, ~600 km de São José. **29% do que o
scan de São José salvou era de outra cidade.**

Entravam por [pipelineCore.ts](../backend/src/jobs/pipeline/pipelineCore.ts):

```ts
const cidadeParcial = cidadesLower.some(c => cidadeExtraida.includes(c) || c.includes(cidadeExtraida));
```

`"são josé do cedro".includes("são josé")` → `true`, estado bate, entra. E a
linha é gravada com `cidade: "São José do Cedro"` — então **some do filtro por
cidade e aparece no feed sem filtro**, que é o que o app abre.

**Por que o parcial existia:** o Filter2 devolve `"Salvador (BA)"`,
`"São José - SC"`, `"Município de Palhoça"`. Um `===` cru rejeitaria os três.

**Conserto:** `limparNomeCidade` + `mesmaCidade` em
[utils/helpers.ts](../backend/src/utils/helpers.ts) — limpa parênteses, sufixo de
UF/estado depois de separador e o prefixo `município|cidade de`, e **só então
compara exato**. Usado nos dois pontos do pós-filtro (principal e vizinha).

Decisão registrada: **não cortar no hífen.** `Embu-Guaçu` e `Embu` são municípios
distintos de SP — cortar ali trocaria um falso positivo por outro.

`scripts/test-match-cidade.ts`, sem rede nem banco: **21/21**. Cobre o bug
original, os dois sentidos do substring, o ruído do GPT, os hifenados e os
degenerados.

**Medição do aperto, de graça:** quando a regra antiga teria aceitado, a rejeição
é gravada com ` [parcial]` no motivo. Fica em `rejected_urls` e responde depois
se o aperto derrubou notícia boa, sem instrumentar nada.

Verificado que o problema era só ali: `intraBatchDedupLayered` e `metroRegion` já
comparavam por igualdade.

### #2 — o `d1` hardcoded, e por que o prazo era hoje

O scan não roda desde **sexta 31/07 20:00**. Isso está certo:
`scan_weekend_enabled = false` e 01–02/08 foram sábado e domingo.

E é exatamente para isso que o `scan_period_days` existe. O comentário no
[configManager](../backend/src/services/configManager/index.ts) diz com todas as
letras: `// janela do BrightData (era 2; 4 permite recuperar sáb/dom na segunda)`.

Só que a coleta mandava `dateRestrict: 'd1'` **hardcoded**, e o config só era
lido lá embaixo, no pós-filtro do Filter2.

Até 01/08 isso era inofensivo — o Google ignora o `qdr`. Depois que a paginação
passou a cortar pela janela (`inicioDaJanela`), o `d1` virou trava real: **a
coleta parava em 24h.** Segunda de manhã o scan pegaria só a sexta à noite e o
fim de semana inteiro se perderia. Regressão minha de 01/08, com prazo de
segunda 9h.

Agora `scanPeriodDays` entra no `pipelineConfig` e a coleta e o pós-filtro olham
para o **mesmo** período.

### Achado novo, não consertado: não existe dedup por URL

O scan roda de hora em hora (`scan_frequency_minutes` default 60) e **não
consulta `news_sources` antes do estágio 4**. O mesmo artigo é reanalisado no
Filter2 a cada rodada — hoje até 24×/dia; com `d4`, mais. O Jina é cacheado
(Redis), o GPT não.

Não bloqueia: o custo do mês é **$0,12 de $100**. Combinado com o João deixar
separado — #2 tinha prazo, isso é melhoria. Anotado na Fase 11.

### Banco — medido, e deliberadamente NÃO limpo

`scripts/limpar-cidades-intrusas.ts` (dry-run por default, `--aplicar`,
`--reverter`). Compara cada notícia com as cidades monitoradas **pela regra
nova** e marca `active = false` nas que ninguém pediu — não deleta, o feed já
filtra por `active` e a volta é um UPDATE.

Dry-run: **10 intrusas, todas de São José do Cedro.** Nenhuma outra cidade
vazou — 192 das 202 são legítimas. O escopo do bug é estreito.

**Decisão do João: não rodar o `--aplicar` agora** — fase de teste e o cliente
sabe. O script fica pronto para quando o dado importar (antes de produção valer
de verdade). O conserto no código já impede que o número cresça.

---

## 2026-08-02 — 🎉 FASE 8 VALIDADA NO APP: 54 resultados

Teste do João no celular, APK de staging contra `81733a9`. **54 resultados.**

```
início do dia (queixa original) .....  1
depois da chave da Bright Data ...... 13
depois da Fase 8 .................... 54
```

Não foi uma correção — foram cinco, e cada uma escondia a seguinte:

| # | o que era | ganho |
|---|---|---|
| 8.1 | 3 queries em série por medo infundado | estágio 1: 23,7s → 9,0s |
| 8.4 | teto de coleta fixo em 20 → "30 dias" cobria 3 | 59 → 175 URLs, alcance real |
| teto aberto | análise parava em 50 artigos | ~155 analisados |
| 8.3 | dedup só por cosine comia metade | 32→16 vira 32→21 |
| web | ramo web furava a fila do teto | news deixa de perder vaga |

### O que ainda NÃO foi verificado

**Qualidade.** 54 é volume; ninguém conferiu se são 54 notícias boas. O que vale
olhar, em ordem:

1. **Região metropolitana** — o GPT devolveu 9 municípios para Salvador e só foi
   verificado que Feira de Santana (corretamente) ficou de fora. Nenhum dos 9 foi
   conferido um a um.
2. **Duplicata** — a trava geo-temporal deveria ter acabado com a queixa antiga.
3. **Relevância** — `filter2_confidence_min` está em **0,5** no banco (o default
   do código é 0,7). Mais permissivo do que parece. Se aparecer notícia fraca,
   este é o primeiro número a olhar.
4. **`natureza: "estatistica"`** — não é ocorrência e pode estar inflando a
   contagem visual.

⚠️ **Produção continua em `faa38b7`.** O cliente ainda usa a versão de junho —
nada disto chegou nele. Ver [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md), item 1.

---

## 2026-08-02 — teto aberto de verdade: chave nova em vez de chave reaproveitada

O teto foi decidido aberto e o código já tinha default `0` — **mas não estava
valendo**. A linha no banco (`50`) sobrepõe o default, e ninguém podia mudá-la:
pôr `0` ali faria a busca manual de **produção** coletar zero URL.

O erro foi meu e é anterior: **reaproveitei uma chave cujo significado mudou.**
`manual_search_max_results_30d` era "teto de coleta do stage 1" e virou "teto de
análise". Com o banco compartilhado e duas versões no ar, uma chave não podia
significar duas coisas.

**Chave nova, `manual_search_analysis_cap`.** Cada versão lê a sua:

| | chave que lê | valor | efeito |
|---|---|---|---|
| produção (`main`) | `manual_search_max_results_30d` = 50 | intacta | nada muda |
| staging/develop | `manual_search_analysis_cap` (ausente) | default `0` | **teto aberto** |

**Zero mudança no banco.** Como a linha não existe, vale o default do código — o
teto já nasce aberto no deploy, sem painel, sem SQL, sem coordenar com produção.
Para ter fusível de volta, é só pôr um número no painel.

Isto também aposenta o "bloco 3" da migration 024 (apagar a linha para resolver o
conflito): não é mais necessário.

**Regra que fica:** quando o significado de uma config muda, **muda o nome**. Com
banco compartilhado e duas versões no ar, reaproveitar chave é criar acoplamento
invisível entre ambientes.

---

## 2026-08-02 — staging atualizado + a config que NÃO pode ser tocada

`staging` foi de `6ff8ba8` para `f105656` — toda a Fase 8.

### 🚨 `manual_search_max_results_30d`: NÃO mexer até `main` subir

São **dois painéis admin** (serviços separados no Render), o que engana — mas eles
escrevem na **mesma** tabela `system_config`. Uma linha por chave, lida pelos dois
backends. Mexer "pra testar em staging" muda produção **na hora, sem deploy**.

E esta chave especificamente **mudou de significado** entre as versões:

| | o que a chave significa | efeito de pôr `0` |
|---|---|---|
| `main` (produção) | teto de **coleta** no stage 1 (`searchMaxResults`) | coleta **zero URL** → busca manual do cliente devolve nada |
| `develop`/`staging` | teto de **análise**, `0` = sem teto | analisa tudo |

Verificado em `git show origin/main:backend/src/jobs/workers/manualSearchWorker.ts`
(linha 68: `searchMaxResults: Math.round(baseMaxResults * profundidade)`).

**Deixar em 50** até `main` ser promovida. Staging testa com teto de 50 (180 dias
→ 122) — cap real, mas suficiente e mais barato.

### Para testar, não precisa configurar nada

As duas configs novas **não existem na `main`**, então são inofensivas — e o
código já tem os defaults certos:

| config | default no código | precisa setar? |
|---|---|---|
| `manual_search_horizon_days` | 180 | não |
| `dedup_gpt_confirm_enabled` | false | não |

**Regra que fica:** antes de mudar config compartilhada, conferir como a `main`
usa aquela chave.

---

## 2026-08-02 — configs no painel em vez de SQL

Ideia do João: *"Pq a gente n coloca tudo isso no painel admin dai eu rodo só o 22"*.

**Ele está certo, e nem o 22 precisa** — a 022 já estava aplicada (verificado no
banco). E a 023 **só mexe em `system_config`**: o `PATCH /settings/config/:key`
usa `configManager.set`, que é **upsert** — cria a chave se não existir. Logo, dá
para fazer tudo pelo painel e **não rodar SQL nenhum**.

`value_type` e `category` não afetam leitura (`getNumber` faz `parseFloat`,
`getBoolean` compara com `'true'`), então criar config pelo painel é equivalente
ao INSERT.

Adicionados em **Configurações → Busca Manual**:

| campo | tipo | valor |
|---|---|---|
| Artigos analisados — base (30 dias) | número, min **0** | **0** = sem teto |
| Horizonte de "fora do período" | número (dias) | 180 |
| Confirmar duplicatas com IA | toggle | desligado |

O toggle da **Fonte Web** já existia — o João lembrou certo.

Dois detalhes que o card genérico errava:
- o custo estimado tratava **todo** campo como contagem de URL. Com "horizonte em
  dias" isso viraria número sem significado → só aparece no teto de artigos
- com o teto em `0`, mostrava **"~$0.000/busca"** — exatamente o contrário do que
  acontece, já que sem teto é o cenário mais caro. Agora diz **"sem teto —
  analisa tudo"**

A migration 023 continua no repo para instalação nova, marcada como **opcional**.

---

## 2026-08-02 — o ramo web medido: fica ligado, mas passou a ser o último da fila

Pergunta do João: *"desligo o web ou n?"*. Medido em vez de opinado.

### O defeito que a medição revelou

`collectManualSearchUrls` empilha o **web ANTES** do news. Como o teto de análise
corta pelo fim da lista, **o web ocupava as primeiras vagas**. Ninguém decidiu
isso — é a ordem de dois `push` seguidos.

Medido (Salvador / 30 dias, teto de 40):

```
web  → 29 URLs coletadas, consumiu ~29 das 40 vagas, entregou  1 de 23
news → 173 URLs, ficou com o que sobrou,           entregou  22 de 23
```

Está acontecendo **em produção agora**: a migration 023 não rodou, então o teto é
50, e o web come mais da metade dele para devolver ~1 resultado.

**Corrigido:** o `prioridade()` do teto passou a desempatar por fonte —
`foraDaJanela * 2 + ehWeb`. Dentro da janela, news primeiro; web depois. O índice
orgânico é complemento, não pode passar na frente do alicerce.

### E o web em si? Fica ligado

Com o teto aberto (023) a ordem deixa de importar, porque tudo é analisado. Aí o
web é puramente aditivo: **~$0,05 por busca** (coleta $0,0045 + Jina/GPT dos
sobreviventes) por conteúdo que, por definição, **não aparece no índice de
notícias** — portal local, prefeitura, comunicado de polícia. E roda em paralelo
com o news, então não custa tempo de parede.

⚠️ Uma medição só, e o histórico do projeto diz que o web é loteria. Se em três ou
quatro buscas ele seguir entregando ~1, aí vale desligar. O `source_type` já vem
em cada resultado, então dá pra conferir sem instrumentar nada.

**Não rodar a migration 021** — ela desligaria o web.

### Erro meu no meio do caminho

A primeira medição deu "web entregou 0 de 22" e estava **errada**: meu script
empilhava o web depois do news, ao contrário do worker. O teto cortava justamente
o web, e eu quase concluí que ele não servia para nada. Script corrigido para
espelhar o worker — a ordem de concatenação é load-bearing.

---

## 2026-08-02 — 8.5: progresso ao vivo, 409 informativo, busca fantasma ✅ (backend)

Fecha a Fase 8 no backend. Tudo aqui é **matéria-prima para o app** — a tela nova
é Fase 9.

### Contador dentro do estágio

Até aqui o progresso era 7 degraus. Dentro do estágio 4 nada se mexia por dezenas
de segundos — numa busca de 180 dias, por minutos. É exatamente aí que parece
travado, e é o que faz o usuário matar o app.

`runContentFetch` e `runFilter2WithEmbedding` ganharam `onProgress` **opcional**.
O auto-scan chama as duas sem passar nada e não muda em nada.

O JSONB `progress` ganhou `feitos`, `total`, `achados` e `atualizado_em`. Sem
migration — já foi expandido assim antes.

Dois detalhes que evitam mentira na barra:
- **conta rejeitado e erro também** (`finally`, não no caminho feliz). Contar só o
  que deu certo faria a barra travar justamente na busca que mais rejeita
- **o último item sempre escreve**, ignorando o estrangulamento — é o que fecha
  em 100%

### Achados ao vivo

Conforme o Filter2 extrai, os últimos 5 (`tipo · bairro · data`) entram no
progresso. O dado já está em memória: **custo zero**. É o que transforma barra de
carregamento em algo que dá vontade de olhar.

### Escrita estrangulada — e a corrida que ela criou

1 escrita a cada 2s (o app faz polling a cada 3s; mais que isso não aparece para
ninguém). Sem isso, 300 artigos = 300 escritas no Supabase por estágio.

Mas escrever sem `await` abriu uma corrida real: a escrita do **estágio 4** podia
chegar ao banco **depois** da do estágio 5 e sobrescrevê-la — o app veria o
progresso **andar para trás**. Resolvido com `progresso.aguardar()` na troca de
estágio: alguns milissegundos, três vezes por busca.

### 409 informativo

Devolvia só `{ error }`. Agora devolve `searchId`, `params` e `progress`, para o
app poder oferecer *"Salvador em andamento (42%) — ver progresso / cancelar"* em
vez de um beco sem saída. Só acrescenta campos: o APK atual não regride.

### Busca fantasma — virou load-bearing

Com **uma busca por vez**, um job morto prendia o usuário **para sempre**. E o
Render reinicia o serviço sozinho no free tier, então isso acontece de verdade.

O critério é melhor que relógio: **sem avanço de progresso** por 20 min. Busca
longa que está trabalhando escreve a cada ~2s e nunca é morta por engano; busca
morta para de escrever e cai no TTL. Buscas antigas, sem `atualizado_em`, caem no
`created_at`.

⚠️ Falta o outro lado: o app ainda desiste por relógio (`_maxPolls = 200` × 3s).
O backend já emite o contador que permite trocar isso por estagnação — é Fase 9.

---

## 2026-08-02 — uma cidade por busca (+ região metropolitana)

Decisão do João: *"Melhor limitar a uma cidade + região metropolitana no max
então"*, depois de entender que o limite virou tempo.

**A parte elegante: não custa nada.** Desde a 8.2 as cidades vizinhas saem das
**mesmas queries**, marcadas como `cidade_vizinha`, em vez de descartadas. Então
"1 cidade + região" custa exatamente o que "1 cidade" já custava — a região é
resultado que estava sendo jogado fora.

E resolve o problema de tempo pela raiz: o custo por cidade é linear, mas o
**tempo também**. Uma cidade em 180 dias ≈ 7 min; três estouram os 10 min do app.

### ⚠️ Backend e app têm que subir JUNTOS

O APK que o cliente tem hoje deixa escolher até **10** cidades
(`MultiCitySearchField`, `maxCities: 10`). Com o backend em `max(1)`, quem
escolher 2 toma **400**.

Mudados os dois no mesmo commit:

| | antes | agora |
|---|---|---|
| `validation.ts` | `.max(10)` | `.max(1)` |
| `multi_city_search_field.dart` | `maxCities = 10` | `maxCities = 1` |

Copy do app ajustada junto: label "Cidade" no singular, e o rodapé passou a
dizer **"A região metropolitana é incluída automaticamente"** em vez de
"1/1 cidades selecionadas" — responde sozinho a pergunta "por que só uma?".

Voltar a permitir várias é só mudar os dois números, **depois da 8.5**.

---

## 2026-08-02 — 8.3: dedup em camadas ✅

**Medido no funil real** (Salvador / 30 dias, mesmas 32 extrações, mesmo
threshold 0,70):

| dedup | resultado |
|---|---|
| antigo (só cosine) | 32 → **16** |
| camadas (8.3) | 32 → **21** |

**5 ocorrências reais que o antigo fundia por engano** — +31%. A trava
geo-temporal barrou **273 pares** antes de qualquer cosine, de graça.

### Por que subir o threshold nunca ia resolver

O algoritmo antigo compara **só cosine**, sem olhar data nem tipo de crime. Isso
erra nos dois sentidos ao mesmo tempo:

- **funde demais** — dois homicídios *diferentes*, em datas diferentes, têm
  resumos quase idênticos ("homem é morto a tiros em Salvador") e batem 0,70+
- **funde de menos** — o mesmo evento por dois veículos com ângulos editoriais
  diferentes às vezes não chega ao limiar

Por isso o João testou 0,80, continuou duplicando, e baixou pra 0,70. Nenhum
número resolvia: era o algoritmo. A camada 1 conserta a primeira falha de graça,
e por isso permite ser permissivo na segunda sem medo.

### As três camadas (mesma estratégia que o auto-scan já usa contra o banco)

1. **Trava geo-temporal**, em memória e grátis: mesma cidade, mesmo estado, mesmo
   tipo de crime, data ±1 dia. Bairro tolerante a nulo, igual ao
   `findGeoTemporalCandidates`.
2. **Cosine**, com o `dedup_similarity_threshold` de sempre.
3. **Confirmação GPT** só na faixa duvidosa (entre o threshold e 0,92), atrás de
   `dedup_gpt_confirm_enabled` (**default false**). Acima de 0,92 o cosine decide
   sozinho — pedir GPT ali seria gastar à toa. GPT fora degrada pra camada 2.

🚫 `runIntraBatchDedup` **não foi tocada** — arquivo novo
([intraBatchDedupLayered.ts](../backend/src/jobs/pipeline/intraBatchDedupLayered.ts)),
usado só pelo `manualSearchWorker`. O auto-scan segue no caminho de sempre.

### Sinalizadores inclusivos — e o fim do dedup por balde

O cluster **não herda os flags do líder**. Basta um membro ser do período pedido
para o cluster inteiro ser:

```
fora_do_periodo = TODOS os membros são fora   (não: o líder é)
cidade_vizinha  = TODOS os membros são vizinha
```

Sem isso, um evento na fronteira da janela (veículos divergem um dia na data)
podia sumir da lista principal e reaparecer em "fora do período" ao sabor de um
decimal de confiança. Foi por esse risco que a 8.2 teve de deduplicar cada balde
separado — **agora os baldes voltaram a ser deduplicados juntos**, o que também
eliminou a matéria repetida entre principal e extras que a 8.2 deixou.

### Regressão sem rede

[`scripts/test-dedup-camadas.ts`](../backend/scripts/test-dedup-camadas.ts) —
10 casos, embeddings sintéticos, camada 3 desligada, roda em milissegundos.
**10/10.** Trava o caso que quebrava (datas diferentes), o que tem que continuar
fundindo, a tolerância de 1 dia, bairro, tipo de crime, cidade vizinha e a regra
inclusiva na fronteira.

---

## 2026-08-02 — teto de período: 6 meses por enquanto

Decisão do João depois de ver que o limite virou tempo, não dinheiro: *"deixa
limite 6 meses então por enquanto"*.

`periodo_dias` passa de `.max(365)` para **`.max(180)`**, e
`manual_search_horizon_days` acompanha (180) — regra simples: **nada mais velho
que 6 meses entra no sistema**, qualquer que seja a busca.

**O limite mora só na validação.** As fórmulas de teto não têm faixa nem máximo
próprio: funcionam para 365 igual. Subir depois da 8.5 é mudar um número em
[validation.ts](../backend/src/middleware/validation.ts), sem tocar em cálculo
nenhum.

Por que 180 e não 365 (extrapolado de Salvador/30d, com o teto de análise aberto):

| período | artigos/cidade | custo | tempo |
|---|---|---|---|
| 180d | ~300 | ~$0,75 | **~7 min** |
| 365d | ~470 | ~$1,20 | ~10 min |

O app desiste em 10 minutos. 365 raspava o teto; 180 dá folga — **mas só para uma
cidade**. Multi-cidade ainda passa de 10 min, então a 8.5 continua sendo
pré-requisito para o seletor ficar realmente livre.

⚠️ Os outros `365` de `validation.ts` são de analytics (leem a tabela `news`, que
o auto-scan acumula) e **continuam 365** de propósito.

---

## 2026-08-02 — teto de análise ABERTO + tracking real

Decisão do João: *"vamos deixar o teto de análise aberto... nosso custo tá baixo,
só manter o track certinho, ver se isso não tá atrapalhando auto scan, e é isso,
deixar a opção de regular ali no painel adm"*.

### `0` = sem teto, e é o default

O mecanismo continua inteiro no código — o que mudou é o valor. Voltar a ter
fusível é **uma config no admin, sem deploy**. Migration
[023](./SQL/migrations/023_manual_search_teto_aberto.sql) aplica no banco (mudar
o default em código não altera a linha que já existe lá).

O painel travava em `min: 1` e não deixaria escolher 0 — corrigido, junto com o
label (dizia "URLs", são artigos analisados) e a remoção das faixas `_60d`/`_90d`,
que o backend não lê mais.

**O que fica sem freio** (medido, Salvador): ~$1,20 por cidade numa busca de 1 ano
(~470 artigos) e ~10 min por cidade. O `monthly_budget_usd` **não protege disso**
— é checado uma vez, no início do job, e não interrompe busca cara já em curso.

⏱️ **O limite real hoje não é dinheiro, é tempo:** o app desiste em 10 minutos
(`_maxPolls = 200` × 3s). Uma busca de 1 ano numa capital chega perto disso, e
multi-cidade passa. **Isso torna a 8.5 pré-requisito pra ligar 365 no app** —
desistir por estagnação, não por relógio.

### Tracking passou a ser real, não estimativa

Era `queries × páginas máximas`. Com o teto de coleta escalando e a paginação
parando sozinha ao sair da janela, isso errava para cima em cidade pequena e para
baixo quando o retry de corpo vazio gastava request extra.

Agora vem do `requestCount` do provider, que já existia e era descartado
(`search()` joga fora, `searchWithMeta()` devolve). Conta paginação real, páginas
especulativas e retries. O teto antigo continua gravado em `details.tetoEstimado`
para dar pra comparar os dois, e `periodoDias` entrou no registro.

### Auto-scan: verificado, não afetado

| verificação | resultado |
|---|---|
| usa config/função da busca manual? | **nenhuma ocorrência** |
| `pageConcurrency`? | não passa → paginação serial de sempre |
| `classificar`? | não passa → pós-filtros descartam como antes |
| teto próprio | `search_max_results` = 20 (valor real no banco), intocado |

Única herança: `parseNewsResults` agora preenche `publishedAt`. O scan ignora o
campo.

---

## 2026-08-02 — 8.4: período livre e respeitado ✅ (backend)

Feito **antes da 8.3**, por decisão do João: o dedup perde 26→13, mas o teto de
coleta estava perdendo **semanas inteiras**. Buraco maior primeiro.

**Medido**, Salvador / 30 dias, mesma query, só mudando o teto de coleta:

| | antes | depois |
|---|---|---|
| URLs únicas | 59 | **156** |
| alcance da coleta | 30/07 (**3 dias**) | 05/07 (**29 de 30 dias**) |
| passaram no Filter1 | ~68 | 142 |

### Sem degraus — pedido explícito do João

> *"se é possível fazer 1 ano, então o usuário deveria poder escolher o período
> que quiser, esse período pode ficar preparado pra ficar flexível e não hardcoded"*

A primeira versão que escrevi tinha escada (30/60/90/180/365) e foi refeita. Hoje
**não existe faixa em lugar nenhum** do caminho: se o usuário pedir 47 dias, 47
dias tem teto próprio.

Três lugares tinham degrau escondido, todos removidos:

1. teto de coleta — era a constante `20` para qualquer período
2. teto de análise — eram 3 configs por faixa (`_30d`, `_60d`, `_90d`)
3. `dateRestrict` — arredondava para cima: 45 dias virava `d60` e paginava 15
   dias a mais do que o pedido

Ambos os tetos agora são **funções contínuas da raiz do período** — o índice do
Google rareia conforme se volta no tempo, então dobrar o período não dobra o que
existe pra achar.

```
dias | coleta/query | análise | custo/cidade
  30 |           70 |      50 |  $0,16
  90 |          110 |      87 |  $0,27
 180 |          150 |     122 |  $0,37
 365 |          220 |     174 |  $0,53
```

**Uma alavanca só no admin:** `manual_search_max_results_30d` passa a ser a
**base** (quantos artigos valem 30 dias) e todo o resto escala dela. `_60d` e
`_90d` ficaram sem uso — entraram na lista de configs mortas do ROADMAP.

### Prioridade antes do corte

O teto cai depois do Filter1, mas a classificação em baldes só acontece no
Filter2 — sem ordenar, matéria de oito meses consumia a cota e matava uma do
período pedido. O `publishedAt` da SERP (já lido para cortar a paginação e antes
descartado) passa a viajar no `SearchResult` e ordena dentro-da-janela primeiro.
Quem não tem data **não é penalizado**: não saber não é motivo pra descer na fila.

### Onde o gargalo foi parar

Não sumiu — **mudou de lugar**, e agora está no teto de análise: 142 candidatos
dentro da janela para uma cota de 50. Isso é escolha de custo, não bug, e é
ajustável numa config. A diferença é que antes o limite era invisível e mentia
sobre o período; agora ele é explícito e o log diz quantos cortados estavam
dentro da janela.

`manualSearchCaps.ts` ficou em módulo próprio **sem efeito colateral**: importar
o `manualSearchWorker` cria uma Queue do BullMQ, então um script que só quisesse
consultar os números abria conexão com o Redis e travava. Aconteceu comigo.

⚠️ **Não testado com 365 dias ainda** — o João vai testar no app. A curva está
dimensionada mas o alcance real de um ano não foi medido.

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
provider é **compartilhado com o auto-scan**, e `search_max_results = 20` (valor real no banco) faz ele
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
