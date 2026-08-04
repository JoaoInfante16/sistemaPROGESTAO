# DEV_LOG — SIMEops (Fase 9)

> 🗂️ **Documento da Fase 9** — arquivado em `Fases/Fase 9/` quando ela fechar.
> Ver [README](./README.md) para a organização da pasta.
>
> Diário de bordo: o que foi feito, decisões tomadas, problemas encontrados.
> **Append-only**, cronológico (mais recente no topo). Não se reescreve o passado:
> se algo estava errado, a correção entra como entrada nova.
>
> Fases 1 a 8 arquivadas em [Fases/](./Fases/). A **Fase 8** (busca manual +
> reforma do backend) está em [Fases/Fase 8/](./Fases/Fase%208/) — inclusive
> todas as medições de 30/07 a 02/08.

---

## 📍 ESTADO DO MUNDO — leia isto primeiro

> Bloco de orientação para instâncias novas do Claude (ou para o João depois de
> um tempo longe). Atualizar quando mudar.

### Em que pé está o projeto

**A Fase 8 fechou o backend.** A busca manual saiu de 1 resultado para **77**
(validado no app em 02/08), o auto-scan teve os quatro achados da auditoria
corrigidos, e o painel admin passou a expor todas as configs vivas.

**A Fase 9 é o app.** O backend entrega oito campos que o Flutter ignora. O
trabalho agora é de frontend, e o material completo está em
[FRONTEND_BRIEFING.md](./FRONTEND_BRIEFING.md).

### Onde cada ambiente está (02/08)

| ambiente | branch | situação |
|---|---|---|
| local + staging | `develop` / `staging` | ✅ Fase 8 completa — **77 resultados validados no app** |
| **produção** | `main` | 🔴 **junho, quebrada em 4 lugares — é o que o cliente usa** |

**Produção é a maior dívida aberta.** Ver [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md),
item 2 — inclui o checklist de promoção.

### As duas coisas que exigem decisão do João

1. 🚨 **Migration 025** — o banco aceita leitura **e escrita** pela chave anon,
   que é pública (está no APK e no bundle do admin). Escrita e **não rodada**;
   afeta produção na hora. Ver [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md), item 1.
2. **Promover `main`** — a CLAUDE.md proíbe merge direto.

### Documentos vivos — ler antes de reconstruir contexto

| doc | para quê |
|---|---|
| [FRONTEND_BRIEFING.md](./FRONTEND_BRIEFING.md) | **entrada da Fase 9** — contexto, números, armadilhas do app |
| [API_CONTRATO.md](./API_CONTRATO.md) | shapes exatos de cada rota |
| [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md) | o que falta no backend, por consequência |
| [ARQUITETURA.md](./ARQUITETURA.md) | como o sistema funciona hoje |
| `scripts/diagnostico-banco.ts` | estado REAL do banco (só leitura) — o MIGRATIONS_LOG já mentiu |
| `scripts/diagnostico-funil.ts` | funil da busca manual com motivos de rejeição |

### Como saber QUAL código está rodando (não deduzir — ler)

Custou duas sessões inteiras concluir errado por inferência.

- **`GET /health`** devolve `commit` (de `RENDER_GIT_COMMIT`). Identifica o
  **serviço web**.
- **`budget_tracking.details.commit`** é gravado a cada busca manual **e a cada
  scan** (o scan ganhou isso em 02/08). Identifica o processo que de fato
  **processou o job** — que pode não ser o mesmo.

### Armadilha nº 1 do projeto: infra compartilhada

**Staging, produção e dev local usam o MESMO Upstash Redis e o MESMO Supabase.**

Até 01/08 as filas BullMQ tinham nome fixo, então o worker da **produção**
(código velho) competia com o de staging pelos mesmos jobs e ganhava a maioria.
Toda busca de teste do João era processada pelo código quebrado da produção.

Corrigido em `jobs/queueNames.ts`: sufixo por ambiente. **Produção mantém o nome
puro de propósito** — quando `main` atualizar, nada muda para o app do cliente.

⚠️ A mesma armadilha vale para **config**: mexer numa chave em staging muda
produção **na hora, sem deploy**. Quando o significado de uma config mudar,
**muda o nome** (foi o que se fez com `manual_search_analysis_cap`).

### Medições que NÃO devem ser refeitas

- **O índice do Google tem teto POR QUERY, ~60-70 itens úteis.** São Paulo/90
  dias tinha 36 páginas de direito e a SERP **secou sozinha na 23**. Não é
  regulável (`num` deprecado, `qdr`/`cdr` ignorados). Pedir mais página do mesmo
  assunto não traz nada — **perguntar outro assunto traz**. É por isso que
  `search_subjects` existe.
- **O Google ignora o filtro de data.** Só `sbd:1` (ordenar por data) é obedecido.
- **Query curta ganha de query longa.** `polícia Porto Alegre` → 10/10 na janela;
  a query longa → 4/10.
- **Não colocar o estado na query.** `polícia São José` trouxe matéria de 44
  minutos atrás; `polícia São José SC` parou em 3 semanas. Quem desambigua cidade
  homônima é o pós-filtro do Filter2.
- **A Bright Data NÃO tem limite de concorrência** — só de vazão, 100 QPS. Uma
  busca faz ~0,07 QPS.
- **O Jina leva ~7,4s por artigo** (medido com pool de 10). A doc antiga dizia
  ~3s e estava otimista.
- **Google News RSS obedece `when:`** mas é inútil como fonte: a URL é redirect
  opaco e o Jina devolve 98 chars de boilerplate. Serve como *índice*, nunca como
  fonte.
- **Nunca fazer retry por contagem baixa.** Retry só sobre **sinal explícito**
  (corpo de 0 bytes, `x-brd-err-code`).

### O funil de hoje (Campo Grande, 60 dias, medido em 02/08)

```
269 URLs → 241 baixadas → 151 extraídas → 77 entregues
   24s        179s            106s
```

### Estado do banco — não deduzir, rodar

`workdesk/SQL/MIGRATIONS_LOG.md` é preenchido à mão e **já desatualizou**.

**`npx tsx scripts/diagnostico-banco.ts`** — só leitura, olha o estado real.
Verificado em 02/08: migrations 019, 020, 021b, 022 aplicadas; **021, 023, 024 e
025 não**. Custo do mês: **$0,12** de $100.

---

## 2026-08-04 — o relatório para de mentir sem querer

### O que o João viu

*"no relatório o usuário pode se enganar achando que aquilo tudo de notícias
encontradas foram do período que ele estipulou"* — e estava certo, em três
frentes independentes.

### 1. O relatório não declarava o próprio recorte

O chip `+ antigas (34)` somava aquele balde nos totais, e a partir daí **nada**
distinguia: donut, ranking de bairros, total. E o horizonte é de **180 dias** —
então um relatório pedido de **30 dias** podia conter matéria de **cinco meses
atrás**, sem uma linha dizendo.

É um documento que o cliente manda pra outra pessoa. Agora ele declara o que
tem dentro, em datas concretas, e a declaração muda junto com os toggles:

```
12/07/2026 a 11/08/2026 · 30 dias
Goiânia
+ 34 anteriores a 12/07 (até 180 dias atrás)
+ 8 de Aparecida de Goiânia, Senador Canedo e mais 1
```

Os chips também: `+ antigas (34)` virou **`+ 34 anteriores a 12/07`**. Adjetivo
não deixa ninguém auditar nada.

### 2. A região metropolitana não chegava ao relatório

`ReportScreen` recebia `results` e `foraDoPeriodo` — **e não `regiao`**. O balde
sumia dos números sem aviso, que é a pior das três opções possíveis (entrar,
não entrar, ou não entrar em silêncio). Agora entra como toggle simétrico ao de
antigas.

⚠️ E bairro de município vizinho passou a levar o nome da cidade no ranking
(`Centro · Aparecida de Goiânia`). Sem isso, com "+região" ligado, o ranking de
bairros — que é justamente o que alguém lê pra decidir onde reforçar operação —
misturava municípios sem dizer.

### 3. O relatório jogava fora 35% das fontes (medido)

| | |
|---|---|
| itens analisados | 221, em 12 buscas |
| com **mais de uma** fonte | 60 (**27%**) |
| fontes existentes | **341** |
| fontes que o relatório lia | **221** — só a primeira |
| selo OFICIAL mostrado | 6 |
| selo OFICIAL existente | **10** → **4 perdidos** |

`getSearchResultsAnalytics` lia `r.source_url`, singular. O dado completo sempre
esteve em `sources[]` — o dedup intra-lote consolida os veículos do mesmo evento
num card só. Era bug de leitura, e destruía justamente o sinal de credibilidade:
"três veículos confirmaram" virava "um veículo". E como o portal de notícia é
indexado antes do site da SSP, a fonte oficial costumava ser a segunda — e o
selo se perdia.

O caminho do auto-scan (`getNewsSources`) sempre leu a tabela `news_sources`
inteira. Este lado é que estava atrás.

### 4. O mapa nunca carregava — e isso explicava a comparação

Pergunta do João: *"os relatórios do auto scan me parecem muito mais completos"*.

`buildMapPoints` geocodifica num `for` sequencial; o Nominatim exige **1,1s**
entre chamadas (política deles, não dá pra paralelizar) e cada ponto custa até 3
delas no fallback rua→bairro→cidade.

```
77 pontos × 1,1s  =   85s     melhor caso
77 pontos × 3,3s  =  254s     pior caso
timeout do app    =    15s
```

**Nunca chegava.** E o `catch` só apagava o loading: mapa vazio, sem erro.

A razão de os relatórios do auto-scan parecerem melhores é que o cache era um
`Map` **em memória**: as 4 cidades monitoradas o mantinham quente e eram as
únicas que terminavam a tempo. Não eram mais ricos — eram os únicos que
chegavam. E no Render free, que hiberna, o cache morre várias vezes por dia.

**Feito:**
- cache de duas camadas, com **Redis** na L2 (TTL de 90 dias — rua não se move).
  Grava inclusive o `null`: "o OSM não conhece este lugar" custou 1,1s e não
  deve ser reperguntado.
- a busca **aquece o geocode depois de entregar** — depois de gravar os
  resultados, marcar concluída e mandar o push. O usuário já tem o que pediu; o
  aquecimento roda enquanto ele navega. Colocar antes acrescentaria ~85s a uma
  busca que ele está olhando.
- timeout próprio de 90s nessa rota (era 15s).

### Correção de documentação

`manual_search_horizon_days` está documentado como **365** em dois lugares da
Fase 8. O valor real, no `configManager` e no `schema.sql`, sempre foi **180**.
Corrigido nos dois — a regra do workdesk é que doc desatualizada é bug.

---

## 2026-08-03 — a tela, o tempo, e o funil que apontou pro lugar errado

### O baseline respondeu a pergunta — e não era o que a gente supunha

A busca das 22:02 (Goiás/30d) gravou **96 rejeições**, as primeiras desde que a
migration 026 foi aplicada. O funil:

| estágio | rejeitadas | |
|---|---|---|
| **filter2_location** | **55** | **57%** |
| filter1 (`gpt_nao_crime`) | 31 | 32% |
| filter2 | 5 | 5% |
| filter2_date | 2 | 2% |
| filter0 + fetch | 3 | 3% |

**A perda de Goiânia é geográfica, não de qualidade de extração.** E dentro das
55: **32 são cidades do próprio Goiás** — Goiatuba **14**, Luziânia 4, Anápolis
3, Formosa 2, Itumbiara 2, Catalão, Crixás, Planaltina, Bom Jesus, Cocalzinho,
Santo Antônio do Descoberto, Mozarlândia. As outras 23 são fora do estado (BH,
Balsas/MA, Ilhéus, João Pessoa) e foram descartadas **corretamente**.

Ou seja: 32 notícias reais de crime foram coletadas, baixadas, analisadas,
**pagas** — e jogadas fora por não serem a capital. A seção REGIÃO
METROPOLITANA não alcança nenhuma delas (Goiatuba fica a 200 km).

Isso explica Salvador (79% de aproveitamento) contra Goiânia (36%) melhor que
qualquer hipótese sobre o pipeline: a Bahia tem imprensa centrada na capital,
Goiás tem imprensa espalhada pelo interior. **Recuperá-las custa zero** — está
no ROADMAP como "abrangência".

⚠️ **Goiatuba com 14 numa cidade de 35 mil é anômalo** e ficou em aberto —
cheira a portal regional muito indexado, ou Filter2 lendo cidade errada.

⚠️ A linha da busca em `search_cache` **não existe mais** (histórico apagado no
app), mas as rejeições sobreviveram: `search_id` não tem FK com cascade. Salvou
o dado desta vez; como regra, acumula lixo sem os params pra interpretar.

### A tela: escolher assuntos, com o preço na frente

Decisão do João: em vez de a gente escolher a lista, **o usuário escolhe** —
templates da taxonomia + palavra-chave livre — e paga o tempo da própria
escolha.

O ganho não é de UX, é estrutural: escolher assunto deixa de ser mexer em
`search_subjects`, que é config no banco compartilhado e muda o auto-scan do
cliente na hora, sem deploy.

Duas correções de layout vieram do João durante a construção:
- **"Essencial" sozinho não informa nada** → cada preset mostra a própria conta
  (`5 assuntos · ~4 min`) mais a linha do que inclui. O `(?)` ficou pro *porquê*.
- **Chips de período viraram marcas na régua**, e a caixa da estimativa foi pra
  logo abaixo do slider — arrastar o período mexe nos minutos na frente de quem
  escolhe.

Estimativa ancorada em medição: Campo Grande 60d/5 assuntos = 5min31 → **47s por
assunto**, escalando por √(período/30), a mesma curva dos tetos do backend.

### O erro que o João barrou

Dimensionando 17 assuntos × 180 dias × capital, cheguei em **~20 min e ~$1,05**,
e propus fechar o teto de análise (`manual_search_analysis_cap`). **O João
lembrou que isso já tinha sido decidido ao contrário** e mandou procurar a doc.
Estava em [Fase 8/ROADMAP.md:133](./Fases/Fase%208/ROADMAP.md#L133):

> agora é o teto de análise (**142 candidatos dentro da janela para uma cota de
> 50**)

Com teto 50, **92 notícias dentro da janela pedida morriam sem ninguém olhar**.
Proposta retirada. **O teto continua em 0.**

O certo era atacar vazão, não descarte:

| alavanca | ganho | perde notícia? |
|---|---|---|
| Filter1: chunks de 30 rodavam **em série** | ~3min → ~40s | não |
| `openai.max_concurrent` 5 → 20 (migration 027) | ~6min → ~1,5min | não |
| `attempts` 2 → 1 na busca manual | evita cobrar o dobro | não |

O Filter1 serial era desperdício puro: quem controla a vazão da OpenAI é o
`rateLimiter`, uma camada acima — o `for` com `await` só segurava chunks sem
motivo. E `openai.max_concurrent = 5` era chute de fev/2026 nunca revisado, **e
é o mesmo Bottleneck do auto-scan**: uma busca longa deixava o scan do cliente
na fila o tempo todo.

### Região metropolitana: de escondida a visível

`REGIÃO +8` no sumário, tag `REGIÃO` no card, e a seção **nasce aberta**. Era o
que fazia Goiânia com 19 resultados parecer ter 11.

### Auto-scan

`search_subjects` passa a ser a taxonomia inteira (17), vinda de `taxonomia.ts`
pra não haver duas verdades. **O custo recorrente não sobe**: o scan roda 2 por
vez em rodízio, então mais assuntos alargam o ciclo (~8,5h em vez de ~2,5h por
assunto) e a janela de 2 dias cobre o intervalo.

### Fuso horário: 3h adiantado

As colunas `created_at` são `TIMESTAMP` (sem time zone) com `DEFAULT NOW()`, e o
Supabase roda em UTC → o Postgres serializa `2026-07-21T15:43:54.493171`, **sem
sufixo**. `DateTime.parse` de string sem sufixo devolve um DateTime marcado como
LOCAL com os números de UTC dentro, e `.toLocal()` vira no-op.

`parseApiDate` declara o UTC antes de converter e aceita os dois formatos que a
API mistura (o `Z` do Node em `started_at`, o cru do Postgres em `created_at`).
Corrigido no app e não no schema — as colunas vivem no banco que a `main` lê.

---

## 2026-08-03 — quem escolhe o que perguntar passa a ser o usuário (backend)

### A decisão

Vinha de "vamos adicionar greve e manifestação aos assuntos". Investigando,
apareceu que **9 dos 16 tipos da taxonomia nunca viram query** — só entram de
carona nas 5 perguntas existentes. E como o índice do Google tem teto **por
query**, cada assunto que não se pergunta é um teto de 60-70 itens que se
deixa na mesa.

O caminho óbvio era engordar `search_subjects`. O João propôs outro: **a escolha
sobe pra tela**, com templates da taxonomia + palavra-chave livre, e o usuário
paga o tempo da própria escolha.

**É melhor por um motivo que não é de UX:** `search_subjects` é config no banco
compartilhado — mexer nela muda o auto-scan do cliente na hora, sem deploy (a
armadilha nº 1 deste projeto). Escolha por busca não toca config nenhuma.

### O que já existia — e estava mudo

`tipo_crime` já viajava de ponta a ponta: `api_service.dart` → `validation.ts` →
worker → `buildManualSearchQueries`. **Ninguém nunca preenchia**, e quando
preenchesse rodaria **uma query só**. Não foi feature nova; foi destravar
encanamento parado.

| antes | agora |
|---|---|
| `tipo_crime?: string` → 1 query | `assuntos?: string[]` → N queries, até 20 |
| lista fixa do painel | lista da tela, painel como fallback |

O formato antigo continua aceito na rota e no worker — o Redis é compartilhado e
não esvazia no deploy, então job enfileirado antes chegaria com o campo velho.

### A armadilha que quase custou a feature inteira

O plano dizia "corrigir o Filter2 pra aceitar greve". **O Filter2 nem seria
alcançado.** O [Filter1](../backend/src/services/filters/filter1GPTBatch.ts#L66)
é o portão anterior e mais restritivo: aceita `protesto **violento**`. Greve de
ônibus, bloqueio pacífico ou qualquer termo fora do vocabulário de crime morre
ali — **antes do Jina**, barato e em silêncio. Adicionaríamos o assunto e
concluiríamos que "greve não rende".

A correção não foi engordar a lista de palavras dos dois prompts, e sim
**passar os assuntos escolhidos como contexto** — "o usuário pediu por: greve,
bloqueio". Vale pra qualquer termo que ele digite, hoje e no futuro, sem
precisar adivinhar. Sem assuntos escolhidos (auto-scan), o prompt fica idêntico
ao de sempre — mesmo padrão opt-in do `classificar`.

Independente disso, `manifestacao` no Filter2 ganhou `strike, labor stoppage`, e
a regra 1 ganhou greve: o auto-scan também vai coletar isso.

### [taxonomia.ts](../backend/src/utils/taxonomia.ts) — catálogo novo

17 assuntos (termo curto, label, tipo, categoria) + cores e ordem das
categorias, servidos em **`GET /settings/taxonomia`**. A relação assunto→tipo é
N:1 de propósito: "greve" e "manifestação" são perguntas diferentes que
classificam no mesmo `manifestacao`.

Existe **pra não nascer hardcoded no Dart** — se a lista morasse no app,
acrescentar assunto viraria build de APK, e a taxonomia é justamente o que se
quer poder mexer. Torná-la editável no painel (hoje é default de código) é o
próximo passo, no ROADMAP.

### Ainda não medido

Se 17 assuntos rendem o volume esperado, e quanto isso custa em minutos. A busca
de baseline (Goiânia/30d com os 5 assuntos atuais) roda antes, pra não mudar
duas variáveis de uma vez.

---

## 2026-08-03 — o funil ganha memória (e um documento)

### O que disparou

Primeira busca no app novo: **Goiânia/30d → 11 resultados**. Pergunta do João:
*"cadê aquele monte que tava vindo antes?"*. A investigação achou a resposta e,
no caminho, uma lacuna de observabilidade que já custava dinheiro.

### Duas correções factuais que a investigação produziu

1. **Não existe dedup contra o banco na busca manual.** Eu tinha afirmado que
   buscar Porto Alegre renderia menos por já ter 88 notícias no banco — **errado**,
   e o João corrigiu na hora. Verificado no
   `manualSearchWorker`: os dois dedups (`deduplicateResults` e
   `runIntraBatchDedupLayered`) olham só o próprio lote. O dedup contra `news` é
   do auto-scan.
2. **Goiânia entregou 19, não 11.** São 11 principal + 8 de cidade vizinha
   (6 Aparecida de Goiânia, 1 Pontalina, 1 Caldas Novas). Os 8 estão na seção
   REGIÃO METROPOLITANA que a 9.4 criou — recolhida, então parecem não existir.

### Onde a diferença nasce (medido, não estimado)

| | coleta (URLs) | conteúdo → extração | entregue |
|---|---|---|---|
| Salvador 30d | 202 | 159 → 125 (**79%**) | 54 |
| Goiânia 30d | **106** | 74 → **27** (**36%**) | 11 |

Dois lugares distintos: metade da **coleta** (teto do índice do Google por
cidade) e menos da metade do aproveitamento na **extração** — e o segundo era
inexplicável, porque:

### A lacuna: a busca manual jogava fora os motivos de rejeição

`rejectedUrls[]` era preenchido por todos os stages e **descartado no fim** —
só o auto-scan persistia em `pipeline_rejected_urls`. Descobrir onde uma busca
perdeu exigia `scripts/diagnostico-funil.ts`, que **re-roda o pipeline pagando
Jina + GPT**. O dado já estava em memória; gravar é de graça.

**Feito:**
- `RejectedUrl` ganhou `search_id` (e `location_id` virou opcional) — uma
  rejeição vem OU do auto-scan OU da busca manual, nunca das duas.
- O worker persiste ao fim do pipeline, em `try/catch` best-effort: falhar aqui
  não pode derrubar busca que já deu certo.
- [Migration 026](./SQL/migrations/026_rejected_urls_search_id.sql) — `ADD COLUMN`
  nullable + índice parcial. Aditiva e reversível, **não aplicada** (aguarda
  autorização). Sem a coluna o insert cai no catch e nada quebra.

⚠️ A tabela amarrava tudo a `location_id` (FK para `monitored_locations`) — e
busca manual roda em cidade **fora** do monitoramento. Era por isso que não
persistia: não havia onde pendurar a linha.

### [FUNIL.md](./FUNIL.md) — documento vivo novo

Pedido do João: *"quero dar uma olhada geral nesse funil, fizemos muitas
mudanças"*. Reúne os 7 estágios com custo e contador, os **números reais de 5
buscas** medidas, todos os motivos de descarte de cada estágio, o diagrama de
decisão do pós-filtro (principal / vizinha / fora do período / descarte) e a
tabela de qual alavanca mexe em quê.

Registra também o que **não** se deve tentar: mais página do mesmo assunto não
traz nada (teto por query), e nunca retry por contagem baixa.

---

## 2026-08-02 — 9.7: o push abre direto o resultado da busca

O push de conclusão/falha sempre mandou `search_id`
(`manualSearchWorker.ts` → `{ search_id, type: 'manual_search_*' }`) e o app
ignorava. Agora `_handleNotificationTap` reconhece `search_id` e navega para
a rota nova `/search` (padrão da `/city` que já existia), que abre
`ManualSearchScreen(resumeSearchId: ...)` — a tela já sabia retomar, faltava
o caminho. Com isso a Fase 9 (9.1 a 9.7) está **toda implementada**; falta o
teste no device físico contra staging.

QA de cores fechado por grep: `Colors.red` do estado de falha da busca virou
`alert`. Restam `Colors.*` crus só em telas fora do escopo desta rodada
(login, settings, history_card, risk/credibility widgets) — anotado no
ROADMAP como acabamento.

---

## 2026-08-02 — Relatório web: o mapa entra no PDF (decisão do João)

O PDF real sempre foi `window.print()` na página pública do relatório — e o
mapa estava `print:hidden`, então o item mais visual nunca chegava no
documento que o cliente compartilha. Decisão do João: **o mapa vai no PDF**.

- **Captura no clique de "Baixar PDF"**: html2canvas (já instalado) fotografa
  só o container do mapa (`useCORS` — o TileLayer já tinha
  `crossOrigin="anonymous"` de um plano antigo abandonado) e injeta um
  `<img>` print-only; aí sim `window.print()`. Falhou a captura → fallback
  textual ("N ocorrências geolocalizadas — mapa na versão web"), o PDF nunca
  quebra inteiro. Botão mostra "Preparando…" durante a captura.
- **`break-inside-avoid` em todas as seções** — gráfico não é mais fatiado no
  meio da quebra de página.
- **`pdf-export.ts` deletado** — html2canvas+jsPDF do dashboard inteiro,
  exportado e nunca importado. `jspdf` desinstalado junto (18 pacotes a
  menos); html2canvas fica, é o motor da captura do mapa.

`npx tsc --noEmit` limpo.

---

## 2026-08-02 — Mapa: os pontos ganham voz (tap, legenda, enquadramento)

`CrimeRadarMap` (city_detail + report):

- **Tap no ponto → mini-card** com tipo, bairro/rua e data. O `CircleLayer`
  não tem onTap; resolve-se pelo ponto visível mais próximo do toque, com
  raio de acerto de ~24px convertido pra metros no zoom atual. Anel branco
  marca o selecionado. Antes o mapa mostrava ONDE mas não O QUÊ.
- **Fit-to-bounds** (`CameraFit.coordinates`, maxZoom 15) no lugar do zoom
  fixo 12 centrado na média — que errava feio com pontos espalhados.
- **Legenda da precisão**: RUA/BAIRRO/CIDADE com os três tamanhos de ponto.
  A codificação tamanho/brilho existia e o usuário não tinha como saber.
- Esconder uma categoria nos chips limpa a seleção se o ponto era dela.

Fica anotado (já estava no plano): `_loadMapPoints`/`_loadExecutive` usam
`cidades.first` — quando multi-cidade destravar, mapa e executivo precisam
iterar ou agregar. Não mexi: hoje toda busca é de 1 cidade.

---

## 2026-08-02 — 9.6: o relatório vira função do recorte (re-fatiar de graça)

`_computeAnalytics` deixou de ser `late final` calculado 1x no `initState` —
agora é função de um subconjunto, recalculada a cada mudança de recorte:

- **Chips de período no relatório** (7d/15d/30d/... + o período completo):
  re-fatiam client-side o que a busca já trouxe. **"+ antigas (N)"** inclui o
  balde `fora_do_periodo` — é o que paga a busca longa: gasta-se uma vez,
  re-fatia infinitas vezes.
- **Legenda do donut tocável**: selecionar categorias re-computa bairros,
  tendência, fontes e o total. O donut continua mostrando TODAS as categorias
  (senão a filtrada some da legenda e não volta); fatias não selecionadas
  ficam esmaecidas.
- ReportScreen ganhou o parâmetro `foraDoPeriodo` (cru, separado — nunca
  concatenado em results).
- ⚠️ Mapa e executivo seguem o recorte FIXO da busca de propósito (armadilha
  6.5: geocode roda contra a cidade da requisição). Comentado no código.

---

## 2026-08-02 — O recorte único: grupos colapsáveis + filtros no feed e na busca (inclui 9.4)

A tese do 9.6 ("lista e relatório viram função de um recorte") virou a espinha
das duas listas. Três peças novas compartilhadas em `core/`:

- **`date_grouping.dart`** — últimos 7 dias agrupam por DIA (HOJE, ONTEM,
  SEXTA...), o resto por SEMANA ("21–27 JUL"); semanas nascem recolhidas.
- **`group_header.dart`** — o `Divider — LABEL — Divider` do feed, agora
  tocável, com contagem e chevron; `accent` para seções destacadas.
- **`category_filter_bar.dart`** — chips por categoria com contagem, mesma
  linguagem dos chips do mapa. Vazio = tudo; some quando só há 1 categoria.

**Busca (o dossiê):** sumário em readouts (OCORRÊNCIAS · PERÍODO ·
INDICADORES — estatística NÃO conta como ocorrência), chips de recorte,
grupos por data colapsáveis, e três seções recolhidas no fim: INDICADORES
(slate), REGIÃO METROPOLITANA e MAIS OCORRÊNCIAS (teal) — **o 9.4 saiu junto**,
alimentado pelos baldes da 9.1. Conversão `fromSearchResult` agora é 1x no
ingest, não por itemBuilder. Estado cru consolidado num `ManualSearchResults`
(o `.foraDoPeriodo` cru fica à mão pro re-fatiamento da 9.6).

**Feed:** mesmos grupos colapsáveis + chips de categoria + toggle "Não lidas".
Callbacks de ler/favoritar passaram de índice para ITEM — com filtro ativo os
índices da lista visível não batem com os do estado (bug latente que o filtro
exporia). Indicadores continuam inline no feed (cronologia importa lá; a
separação em seção é da busca, onde há contagem).

**Form:** período virou **slider livre 1–180** com readout mono + presets
(7/30/60/90/180) — decisão do briefing, chips fixos 30/60/90 morreram.

---

## 2026-08-02 — CityCard: o dashboard para de jogar fora metade do modelo

`CityOverview` sempre trouxe `trendPercent`, `topCrimeType`, `topCrimePercent`,
`lastNewsAt` e `cityNames` — e o card só mostrava o total. Agora:

- **Linha de readouts**: total (mono teal) · **tendência 30 dias** (▲12% em
  `alert` quando sobe, ▼ em `official` quando cai) · **crime predominante**
  com percentual.
- **Última atividade** no rodapé, mono ("há 2h" / "há 3d").
- **Grupos mostram preview dos nomes** ("Florianópolis, São José +3"), não só
  a contagem.
- Badge NOVAS no tom `alert` da paleta (era `Colors.red` chapado).
- Mapa `crimeLabels` local deletado — era código morto (definido e nunca
  usado); labels vêm de `crime_labels.dart`.

---

## 2026-08-02 — NewsCard e detail sheet: o tipo granular vira o título

O card compartilhado (feed, favoritos, busca) foi redesenhado:

- **Título = tipo granular + bairro** (`HOMICÍDIO · Kobrasol`, Rajdhani caps).
  Antes o card liderava com a categoria genérica ("SEGURANÇA") e o tipo só
  aparecia abrindo o detalhe — era a informação errada em destaque.
- **Trilho de cor de 4px à esquerda** carrega a categoria (substitui o badge).
- **Badges no orçamento de dois**: NOVA (`alert`) e OFICIAL (`official`).
  `estatistica` vira título "INDICADOR" com trilho slate — some o badge azul.
- **Rodapé denso**: cidade/UF · veículo (`g1 +2`, via `sourceName`/hostname —
  antes era "3 fontes") · data em mono.
- Detail sheet na mesma língua: fundo navyMid, tag do tipo na cor da
  categoria, data mono, fontes por NOME de veículo (não URL crua), GOV verde
  `official`, régua teal nas seções. Mapa local de labels deletado —
  `crime_labels.dart` é a fonte.

---

## 2026-08-02 — Linguagem visual: tokens, escala única de categoria, hierarquia de botões

Fundação do redesign (tom definido pelo João: **corporativo operacional** —
tecnológico e tático sem estética de jogo).

- **`core/theme/simeops_colors.dart`** — a paleta sai do `main.dart` (15
  arquivos importavam `../main.dart` só pra pegar cor; dois deles com
  `../../../main.dart` que resolvia por acaso). Ganhou semânticas: `alert`
  (vermelho dessaturado pro navy, substitui `Colors.red` do badge NOVA),
  `official` (=green) e `bookmark` (teal, substitui o indigo).
- **Escala de categoria unificada**: `category_colors.dart` adota os hexes
  refinados que só o report tinha (`#EF4444`, `#F97316`, `#3B82F6`, `#8B5CF6`,
  `#64748B`); o report deleta os mapas locais e consome a fonte única. Chips,
  mapa e donut agora pintam igual.
- **Hierarquia de botões no tema, uma regra só**: primária = FilledButton
  **teal** (era verde no tema e metade do app sobrescrevia pra teal);
  secundária = OutlinedButton teal (tema novo); terciária = TextButton muted.
  INICIAR BUSCA e CANCELAR perderam os overrides locais.
- Hexes hardcoded do feed (FAB `0xFF1A8F9A`, `_DateHeader` `0xFF5A6A7A`)
  viraram tokens.

Cards e detail sheet ainda têm `Colors.*` cru — morrem nas etapas de redesign
deles (próximas). QA final da varredura: grep por `Colors\.` no fim do bloco B.

---

## 2026-08-02 — 9.3: o polling desiste por estagnação, não por relógio

`_maxPolls = 200` (10 min de relógio) morreu. Regra nova no
`manual_search_screen`: a cada poll bem-sucedido monta-se a assinatura
`stage_num|feitos|atualizado_em`; se mudou, a busca está viva. Parada por
**2 min** com status ainda `processing` → falha, com mensagem apontando o
histórico. Erros de rede continuam no contador próprio (60s de tolerância,
que cobre cold-start do Render — inalterado).

⚠️ **O que NÃO foi feito de propósito:** subir os limites do backend
(`periodo_dias` 180→365, cidades 1→10 em `validation.ts`). Backend e APK
têm que subir **juntos** — o APK do cliente deixa escolher 10 cidades e
tomaria 400 se o backend continuar em max(1). Fica para um deploy
coordenado com aval do João.

---

## 2026-08-02 — 9.2 + 9.5: a tela de carregamento vira funil ao vivo

O "passo 4 de 7" parado por 3 minutos morreu. A tela de progresso agora segue o
desenho que o João aprovou no briefing:

- **7 estágios colapsados em 5 blocos** (`BUSCANDO`, `TRIAGEM RÁPIDA`,
  `LEITURA`, `ANÁLISE`, `AGRUPAMENTO`) — funil, não checklist.
- **Contador vivo** nos blocos 4 e 5: `34 de 241` (mono, teal) direto de
  `progress.feitos/total`, com **ETA** estimada pela taxa observada
  (`~2min`, só aparece com ≥5 feitos pra não chutar no escuro).
- **Barra de progresso fracionária**: avança DENTRO dos estágios com contador
  (`(stage-1 + feitos/total)/7`), não só na troca de estágio.
- **Achados ao vivo**: `progress.achados` (5 mais recentes) numa caixa
  "ÚLTIMOS ACHADOS" — tipo · bairro + data relativa ("há 2 dias").
- **"Pode fechar o app — avisamos quando terminar."** acima do CANCELAR (o
  push de conclusão já existia; agora a tela diz isso).
- Novo `core/utils/crime_labels.dart` — labels de tipo_crime, fonte única
  (era pré-requisito dos achados; detail sheet e city_card migram na etapa
  dos cards).

Timestamps `[HH:MM:SS]` e durações por bloco mantidos — é a parte "sala de
operações" que já funcionava.

---

## 2026-08-02 — Fase 9 em execução: 9.1, os três baldes chegam ao app

Plano da fase fechado com o João nesta sessão (decisões: feed e busca juntos,
card redesenhado com hierarquia "corporativo operacional", ordem do roadmap
mantida, mapa OBRIGATÓRIO no PDF). Escopo ampliado além do briefing: relatórios,
card de grupos, PDF, mapas, e uma etapa de linguagem visual (tokens, tipografia,
hierarquia de botões).

### 9.1 implementado

- **`ManualSearchResults`** (model novo em `core/models/`): os três baldes de
  `GET /manual-search/:id/results` — `results`, `regiao`, `fora_do_periodo` —
  sempre separados, com o porquê documentado no próprio arquivo.
- `api_service.getManualSearchResults` deixou de descartar `extras`.
- `manual_search_screen` guarda `_regiao`/`_foraDoPeriodo` no estado (a UI das
  seções expansíveis é a 9.4 — por ora ficam com `// ignore: unused_field`).
- `NewsItem.fromSearchResult` agora preenche `estadoUf` (via `abbrState` — o
  item da busca manda `estado` por extenso) e lê `source_type`; `NewsSource`
  ganhou `type` (`news`/`web`).

`flutter analyze` limpo (3 infos pré-existentes, nenhum novo).

### Achados da investigação de planejamento (valem registro)

- **`pdf-export.ts` do admin é código morto** — html2canvas+jsPDF exportado e
  nunca importado. O caminho real do PDF é `window.print()` na página pública
  do relatório. Remoção prevista na etapa do relatório web.
- **Duas escalas de cor de categoria divergem**: `category_colors.dart` (que se
  declara fonte única) usa Material cru; o `report_screen` tem hexes refinados
  próprios. Chips/mapa pintam diferente do donut. Unificação prevista na etapa
  de linguagem visual.
- **`CityCard` joga fora metade do `CityOverview`**: `trendPercent`,
  `topCrimeType`, `lastNewsAt`, `cityNames` chegam e não aparecem.
- **Mapa mobile**: pontos sem tap, zoom fixo 12, codificação de precisão sem
  legenda; `_loadMapPoints`/`_loadExecutive` usam só `cidades.first` (gap
  latente para multi-cidade).

---

## 2026-08-02 — o encerramento de fase, como o João faz (e eu tinha errado)

Correção dele: *"quando acaba a fase, as pastas da raiz que documentam tudo
daquela fase, são recortadas dali e colocado na pasta fases. Daí coloca o DEVLOG
e roadmap, arquitetura, e o readme"*.

Eu tinha escrito que a `ARQUITETURA` **nunca** é arquivada. Errado — e a prova
estava na própria pasta: **`Fases/Fase 1/` já tem `ARQUITETURA.md`** e
**`Fases/Fase 2/` já tem `WORKFLOW.md`**. A convenção já era essa desde o começo;
eu inventei uma regra nova em cima de um padrão que já existia, sem olhar.

**A distinção que faltava:** a `ARQUITETURA` é **copiada**, não movida. A cópia é
um *retrato do sistema no fim daquela fase*; a viva continua na raiz sendo
editada. Recortá-la deixaria o projeto sem documento do presente.

### O princípio por trás

Cada `Fases/Fase N/` tem que ser **auto-contida** — quem abrir entende a fase
inteira sem precisar da raiz. É o que justifica o retrato da arquitetura junto: um
DEV_LOG que fala de `runIntraBatchDedupLayered` não significa nada sem saber como
o sistema era montado naquele momento.

### Feito para a Fase 8

- `ARQUITETURA.md` copiada para [Fases/Fase 8/](./Fases/Fase%208/)
- [README da Fase 8](./Fases/Fase%208/README.md) escrito, e ele carrega o que
  mais importa preservar: as **descobertas que valem para sempre** (o teto por
  query do Google, o Jina a 7,4s, nunca pôr o estado na query) e os **três erros
  que a fase cometeu** — reaproveitar chave de config com significado novo, a
  ordem de dois `push` que era load-bearing, e a medição feita com script que não
  espelhava o worker e quase levou à conclusão errada.

As Fases 1 a 7 são anteriores à convenção e têm formatos variados. **Ficam como
estão** — reescrever histórico não agrega, e o README da raiz registra isso para
ninguém achar que é inconsistência por descuido.

### Efeito colateral de mover: 26 links quebrados

Os documentos da Fase 8 foram escritos quando moravam na raiz, então todo
`](./API_CONTRATO.md)` e `](../backend/...)` passou a apontar para o nada depois
do recorte. **26 links**, achados por script.

Corrigidos com `sed`: `./` virou `../../` e `../backend/` virou
`../../../backend/`. Verificação final nas duas pastas: **zero quebrados**.

📌 **Vale como checklist de encerramento:** recortar documento quebra todo link
relativo dentro dele. Rodar a verificação depois de mover, sempre.

---

## 2026-08-02 — workdesk coerente: cada doc diz o que é e quando morre

Pergunta do João depois da reorganização: *"o que ta na raiz do workdesk seria a
base da fase 9?"*. **Não** — e a resposta expôs uma incoerência que eu tinha
acabado de introduzir.

A raiz tem **dois tipos** de documento, e a diferença só aparece no fim da fase:

| tipo | o que acontece no encerramento |
|---|---|
| 📌 **vivo** | fica na raiz, editado in-place, para sempre |
| 🗂️ **da fase** | vai para `Fases/Fase N/` |

**O erro que eu tinha cometido:** classifiquei o `FRONTEND_BRIEFING` como vivo,
junto do `API_CONTRATO`. Está errado, e o critério é claro: o briefing descreve um
estado que **deixa de ser verdade** quando o trabalho acaba — hoje ele afirma "o
app ignora oito campos", e no dia em que o app parar de ignorar a frase vira
mentira. Documento vivo não pode envelhecer assim. O `API_CONTRATO`, por
contraste, continua verdadeiro depois de a Fase 9 fechar.

Então o briefing é **da Fase 9** e será arquivado com ela.

### O que ficou

- **[README.md](./README.md) novo** — o mapa da pasta: os dois tipos, o ciclo de
  uma fase em diagrama, as regras que não podem ser quebradas e o histórico das
  fases. É a porta de entrada de quem chega sem contexto.
- **Cada documento declara o próprio tipo** no cabeçalho, com 📌 ou 🗂️. Verificado:
  7 de 7 declaram.
- `WORKFLOW.md` perdeu o "(Fase 2 em diante)" do título — ele é a constituição,
  não pertence a fase nenhuma.
- `API_CONTRATO` apontava para "Prioridade 1" do ROADMAP, que virou **Prioridade 0**
  na Fase 9.
- CLAUDE.md aponta para o README e traz a regra dos dois tipos.

Todos os links relativos foram verificados por script: workdesk→workdesk,
workdesk→código e CLAUDE.md→workdesk. **Zero quebrados.**

---

## 2026-08-02 — workdesk reorganizado + briefing do frontend

Pedido do João: *"Vamos arrumar workdesk agora que ta tudo funcionando. Iniciar
uma nova fase, colocar a arquitetura, no roadmap pode colocar essa ideia da jina
já, e também tudo o que um designer do flutter vai precisar."*

### A numeração estava confusa, e ele apontou

`Fases/` tinha até a **Fase 7** arquivada, e os docs da raiz eram da **Fase 8** —
mas o ROADMAP usava "Fase 9", "Fase 10" e "Fase 11" para blocos de plano *dentro*
da Fase 8. Duas numerações concorrentes, e a mesma palavra significando coisas
diferentes.

**Convenção, agora explícita na CLAUDE.md:** fase encerrada vira
`Fases/Fase N/` (DEV_LOG + ROADMAP daquela fase), e a raiz recomeça na seguinte.
A Fase 8 foi arquivada; estamos na **Fase 9 — frontend**.

Os antigos blocos "Fase 9/10" (Flutter e calendário) viraram **9.1 a 9.7**, na
ordem em que destravam uns aos outros — e o 9.1 (`getManualSearchResults`
devolver os três baldes) é pré-requisito de dois outros.

### [FRONTEND_BRIEFING.md](./FRONTEND_BRIEFING.md) — o entregável principal

Documento de entrada para quem for desenhar o app. O que ele tem que o
API_CONTRATO não tinha:

- **números reais para calibrar a UI** — 24s/20s/179s/106s por etapa, e as três
  consequências de design que saem daí (a busca dura minutos; os estágios 4 e 5
  são 85% do tempo e são os únicos com contador; 241 lidas viram 77 cards, e isso
  precisa parecer funil e não perda);
- **mapa dos 41 arquivos** do Flutter, com linhas e papel de cada um;
- os **oito campos** que chegam e o app descarta, com o arquivo e a linha exatos
  onde cada um se perde;
- as **decisões de UI já tomadas** pelo João, para não serem re-decididas;
- **cinco armadilhas**, cada uma com a consequência real — a primeira sendo
  "nunca misturar `extras` dentro de `results`", que quebraria o APK do cliente
  em silêncio.

O ponto de encaixe nº 1 ficou nominal: [api_service.dart:226-235](../mobile-app/lib/core/services/api_service.dart#L226)
faz `return body['results']` e joga `extras` fora inteiro.

### A ideia do Jina entrou como Fase 10

Adiada por decisão do João (*"Coloca isso pra proxima fase"*), mas com o
diagnóstico inteiro escrito, porque o caro é redescobrir: são **dois limitadores
em série** (o pool e o Bottleneck), ambos em 10, e subir só um não acelera nada.
E o passo 1 tem que ser tratar o 429 — hoje ele vira "fetch falhou" e **perde o
artigo em silêncio**.

### Consertos de link

`ARQUITETURA.md` ainda apontava para `AUDITORIA_2026-07-30.md` na raiz do
workdesk, que foi para `Fases/Fase 7/` — link quebrado desde então. Cabeçalho
atualizado de 30/07 para 02/08, com o resumo do que a reforma mudou e os números
medidos. Todos os links relativos dos cinco docs vivos foram verificados.

---

## 2026-08-02 — Fase 8 encerrada e arquivada

A Fase 8 vai para [Fases/Fase 8/](./Fases/Fase%208/) com o DEV_LOG e o ROADMAP
completos: busca manual reescrita (8.1 a 8.5), auditoria do auto-scan e a reforma
do backend do dia 02/08.

O que ela entregou, em uma tabela:

| | antes | depois |
|---|---|---|
| resultados por busca | 1 | **77** |
| assuntos pesquisados | 3, fixos em código | lista editável no painel |
| alcance de "30 dias" | 3 dias | o período pedido, de verdade |
| auto-scan | 9 de 10 execuções com zero notícia | 4 achados corrigidos |
| custo | duas contabilidades que discordavam | uma só, por token real |
| configs no painel | 20 de 34 | **todas as vivas** |

Fica registrado o que **não** foi feito, para não virar surpresa: a migration 025
(RLS), a promoção da `main`, e o retry de 429 no Jina. Os três estão no
[BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md) e no [ROADMAP](./ROADMAP.md).
