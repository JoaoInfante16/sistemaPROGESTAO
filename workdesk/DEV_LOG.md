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
