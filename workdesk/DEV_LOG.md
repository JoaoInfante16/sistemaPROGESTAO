# DEV_LOG — SIMEops (Fase 9)

> 🗂️ **Documento da Fase 9** — arquivado em `Fases/Fase 9/` quando ela fechar.
> Ver [CLAUDE.md](../CLAUDE.md), seção 2.
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

### 🎨 Redesign em curso (08/08) — leia antes de mexer no app

Branch **`feature/design-fio`**, já mergeada em **`staging`** (`1604b5f`). Fora
da `develop` de propósito, porque o release da Play Store está engatilhado.

**Plano completo (fases A-F):** `~/.claude/plans/composed-splashing-raven.md`

| fase | o quê | estado |
|---|---|---|
| A | cor de categoria com fonte única | ✅ feito |
| — | **polimento do fio** (tipografia, tinta, header, card, sanfona) | ✅ feito |
| B | formulário de busca (11 blocos → 5) | 🔨 `seletor_lugar.dart` criado, não ligado |
| C | espera de 7 min + resultados | ⬜ |
| D | remoções (favoritos, arrastar, lembrar senha, senha mín. 8) | ⬜ |
| E | relatório + export HTML A4 | ⬜ |
| F | notificações (migration 030, digest por cidade, tri-estado) | ⬜ |

🚨 **A migration 029 (`news.titulo`) é PRÉ-REQUISITO do staging funcionar.** Sem
ela o backend devolve 400 no feed e no scan — o código já pede a coluna.

**Regras de design que valem como contrato** (nasceram de erro medido, não de
gosto):

- urgência é **peso** (filete branco), não cor — vermelho é da categoria Segurança
- cor mora no chip (`CatChip`, 7px), texto fica em tinta legível
- **mono maiúsculo é campo de máquina, não frase** — prosa vai em
  `SIMEopsType.note()`, que é Archivo em caixa de sentença
- `hairline` (1.8:1) **nunca** pinta texto; piso de qualquer texto é `faint` (4.8:1)
- sinal que aparece sempre não é sinal — "1 FONTE", selo "NOVA" e o ponto verde
  pulsante morreram todos por isso
- **estado do sistema mora no dashboard, uma vez só**; tela de conteúdo mostra conteúdo
- cidade sem novidade vira linha, não bloco
- verde é da interface, nunca do conteúdo
- o local trunca, não quebra

### Em que pé está o projeto (04/08)

**A Fase 8 fechou o backend** (busca manual de 1 para 77 resultados) e **a Fase 9
fechou o app**: os oito campos que o Flutter ignorava são todos consumidos, os
assuntos passaram a ser escolhidos na tela, o fuso foi corrigido e o relatório
declara o próprio recorte.

| ambiente | branch | situação |
|---|---|---|
| local + staging | `develop` = `staging` | ✅ no ar, validado |
| **produção** | `main` (`faa38b7`, **20/05**) | ⚠️ **é a branch de LANÇAMENTO da Play Store — tem 10 commits que a develop NÃO tem** |

🚨 **NÃO é "código de junho quebrado em 4 lugares".** Essa frase estava em três
documentos e era falsa; ver a entrada de 06/08. A `main` tem o `applicationId`
publicado (`com.progestao.simeops`), a config de assinatura, o script de AAB e as
duas páginas exigidas pelo Google Play. **Merge ingênuo destrói o lançamento.**

Migrations **026, 027 e 028 aplicadas** e verificadas no banco (`openai` e `jina`
com `max_concurrent` 20). Custo do mês: **$1,75 de $100**.

**A validação que fecha a fase** — Goiânia, 34 dias, 17 assuntos:

```
619 URLs (eram ~106)  →  393 baixados  →  77 resultados (eram 11)
~$0,295 total  =  $0,0038 por notícia, contra $0,0058 antes
```

Mais volume **e** mais barato por resultado. O tempo (~11 min) é **anterior à
migration 028**; o esperado agora é ~7 min, **ainda não medido** — é o número que
recalibra `_segundosPorAssunto` (hoje 36) em `assuntos_field.dart`.

### As três coisas que exigem decisão do João

1. 🚨 **Migration 025** — o banco aceita leitura **e escrita** pela chave anon,
   que é pública (está no APK e no bundle do admin). Escrita e **não rodada**;
   afeta produção na hora. Ver [ROADMAP](./ROADMAP.md), Prioridade 0.
2. **Promover `main`** — autorizado em princípio, não executado; a CLAUDE.md
   proíbe merge direto. ⚠️ Risco aceito por ele: o APK do cliente deixa escolher
   10 cidades e o backend novo aceita 1 → **400** na janela entre promover e ele
   instalar o app novo.
3. **APK de produção** — `env/prod.json` pronto (git-ignored, com a DSN do
   Sentry mobile). Falta buildar.

### Documentos vivos — ler antes de reconstruir contexto

| doc | para quê |
|---|---|
| [ARQUITETURA.md](./ARQUITETURA.md) | como o sistema funciona e **por quê** |
| [API_CONTRATO.md](./API_CONTRATO.md) | as decisões de contrato que não podem ser desfeitas |
| [FUNIL.md](./FUNIL.md) | onde cada item morre, com números |
| [ROADMAP.md](./ROADMAP.md) | o que falta fazer, e o checklist da promoção da `main` |
| `scripts/diagnostico-banco.ts` | estado REAL do banco (só leitura) — o MIGRATIONS_LOG já mentiu |
| `scripts/diagnostico-funil.ts` | funil da busca manual com motivos de rejeição |

⚠️ **Esses documentos não repetem o código.** Config, shapes e árvore de arquivos
se leem na fonte — a regra está no topo do ARQUITETURA, e nasceu de uma revisão
em que ele se contradizia sozinho.

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
- **A "região metropolitana" do GPT alucina** (medido no cache do Redis, 04/08):
  Goiânia → **Mara Rosa, a 350 km**, Jussara (~300), Caldas Novas (~170); Porto
  Alegre → **Maricá, que fica no Rio**; Campo Grande → **Cristalina, que fica em
  Goiás**. São Paulo e Salvador saem certas (o modelo memorizou as famosas). As
  de outro estado são inofensivas — o pós-filtro exige o estado bater; as do
  mesmo estado, longe, **passam e já foram mostradas ao usuário**.
- **O funil do baseline perde por GEOGRAFIA, não por extração** (Goiás, 96
  rejeições): **57% são `filter2_location`**, e **32 dessas são cidades do
  próprio Goiás** — Goiatuba 14, Luziânia 4, Anápolis 3. Notícia real, coletada,
  paga e descartada por não ser a capital. Recuperar custa **zero**.

### Decisões que não se reabrem

1. **`manual_search_analysis_cap` fica em 0 = SEM TETO.** Propus fechá-lo para
   ganhar tempo; o João barrou e tinha razão — com cota 50, eram **142
   candidatos dentro da janela virando 50** (Fase 8/ROADMAP:133). **Tempo se
   ataca por vazão, nunca por descarte.**
2. **Multi-cidade não vale a pena.** `1 cidade + região` custa o mesmo que
   `1 cidade`; permitir 10 seria pagar N vezes por algo que já vem junto.
3. **Data de INÍCIO, não intervalo fechado.** O Google só pagina de hoje pra
   trás: "1 a 31 de março" custaria os mesmos 5 meses. O recorte fechado vive no
   relatório, depois, de graça.
4. **Não estender o GPT para raio.** Região metropolitana é fato jurídico
   memorizável; "municípios a 100 km" é conta, e o modelo erra conta.

### O funil de hoje (Campo Grande, 60 dias, medido em 02/08)

```
269 URLs → 241 baixadas → 151 extraídas → 77 entregues
   24s        179s            106s
```

### Estado do banco — não deduzir, rodar

`workdesk/SQL/MIGRATIONS_LOG.md` é preenchido à mão e **já desatualizou**.

**`npx tsx scripts/diagnostico-banco.ts`** — só leitura, olha o estado real.

Verificado em **04/08**: 026, 027 e 028 aplicadas (`openai` e `jina` com
`max_concurrent` 20). **024 e 025 seguem não rodadas.** Custo do mês: **$1,75**
de $100.

---

## 2026-08-09 (madrugada) — o tema era o piso errado, e a foto viu o que a análise não vê

Rodada inteira nascida de **duas fotos do aparelho**. Nenhum dos seis achados
seria pego por `flutter analyze`, por leitura de código ou por mim olhando o
protótipo: todos só existem quando o app está rodando com **os dados reais do
João** (2 cidades, nenhuma não lida).

### 1. 🚨 O tema global nunca recebeu o redesign

**É o achado que mais importa desta sessão.** Queixa do João sobre a tela de
consultas: *"n tá muito pálida? olha a referência como as cores são melhores
utilizadas"*. A causa não estava na tela — estava no `main.dart`:

| peça | estava | virou |
|---|---|---|
| `FilledButton` | teal, canto 12 | **verde**, canto 0, texto escuro |
| `OutlinedButton` | borda teal 60%, canto 12 | filete `ruleStrong`, canto 0 |
| `TextButton` | **Exo 2** | mono teal |
| campo de texto | fundo + borda arredondada | linha com filete |
| barra inferior | cápsula teal atrás do ícone | filete e tinta |
| `Card` | canto 14, borda teal | canto 0 |

**A lição: tema é a camada onde a cor acontece.** Dava pra reescrever cinco
telas inteiras em linguagem de fio e o elemento mais chamativo de cada uma
continuar sendo um botão Material herdado. Eu estava pintando as paredes com o
piso errado, e por seis commits não olhei o `main.dart`.

O verde é a decisão que mais muda a tela: é a única cor saturada do sistema e
passa a marcar **a ação**, uma por tela. Em teal ele brigava com o teal do link
e com o teal do progresso — três coisas na mesma cor querem dizer que nenhuma é
especial. Texto do botão em `#08150A` sobre o verde dá **8.9:1**; branco sobre
verde daria 2.6:1, que é o erro clássico de botão colorido.

### 2. 🚨 Regra de layout desenhada pra 20 cidades, nunca testada em 2

O dashboard do João abriu **vazio**: as duas cidades estavam sem não lidas,
viraram duas linhas de 44px e sobrou meia tela de nada.

A regra "cidade sem novidade vira linha" existe pra fazer as **com** novidade se
destacarem. Se nenhuma tem, não há de que destacar — colapsar só esconde o
produto. Agora: **dia parado, ninguém colapsa**; todas viram bloco inteiro com
os números por categoria.

Vale como padrão de erro: regra de densidade desenhada pro caso grande quebra
calada no caso pequeno, e o caso pequeno é o que o cliente tem hoje.

### 3. Dois SIMEOPS empilhados

Eu pus um cabeçalho no dashboard **sem olhar que o `MainScreen` já tinha uma
`AppBar`** com a marca centralizada. Segunda vez na sessão que mexo sem ler o
que embrulha (a primeira foi apagar `_categoryColors` sem checar consumidores).

A `AppBar` saiu e cada aba virou dona do próprio topo, com o `Masthead`
compartilhado: logotipo no dashboard (é a casa), `Consultas` e `Configurações`
nas outras. Repetir o logotipo em três abas é dizer três vezes em que app a
pessoa está — e a barra fixa centralizada custava 56px em toda tela, sempre.

### 4. `abbrState` faltando em três lugares

`Grande Florianópolis · SANTA CA…` truncado no dashboard, `ALAGOAS · 7 DIAS · 5
ASSUNTOS` estourando no histórico. A função existe e já era usada na tela da
cidade; faltava no `CityCard`, no `QuietCityRow` e no `HistoryCard`. A UF é
desambiguação, não conteúdo — ninguém lê "Minas Gerais" ali, lê "MG".

### 5. A quarta faixa de controle

Pergunta do João: *"esse HEADER, n parece muito poluído?"*. Contando na foto,
eram **quatro faixas** antes da primeira manchete: abas de cidade, cadernos,
chips de categoria e o `NÃO LIDAS`. A referência tem três.

A barra de chips era a pior: cinco fichas com cor, nome e contagem mais um
toggle, **permanentes**, pra um filtro que quase sempre está desligado — pagar o
custo do caso raro em todo uso do caso comum. Virou o `FILTRAR` no espaço vazio
da linha de cadernos + a `FolhaFiltro`. A linha que descreve o recorte só
aparece **quando existe recorte**.

O estado virou `FeedFiltro` (ChangeNotifier) na tela da cidade, não no
`FeedScreen`: o botão que abre está nos cadernos, e assim o recorte sobrevive à
troca de cidade dentro do grupo.

### 6. Meu erro de vocabulário: "PRAÇAS"

Escrevi `7 PRAÇAS` no topo do dashboard. Praça é o nome que **jornal** dá à
cidade que cobre — jargão de redação, e o usuário é gente de segurança pública.

⚠️ **A metáfora do fio decide FORMA, nunca as palavras da tela.** Se um termo
precisa ser explicado, não entra. Está anotado no `dashboard_screen.dart`.

### O que a primeira tentativa errou, e por quê

Antes das fotos eu tinha **apagado** `SC`, `18 NOVAS` e o ponto verde do
cabeçalho da cidade, por serem repetição da tela anterior. Errado: a referência
tem os mesmos dados. O que fazia a linha dela funcionar é ser **uma tinta só,
costurada por `·`** — no app eram três widgets em três cores. **O peso era a
cor, não o dado.** Restaurado monocromático.

### Pendente, dito pelo João

*"depois vamos arrumar as copys que estão horríveis"* — revisão de texto de todo
o app, **depois** do design. Não começar antes de fechar as fases.

### Verificação

`flutter analyze` limpo (os 3 infos preexistentes), `npx tsc --noEmit` limpo,
APK de staging instalado no A57 e validado pelo João na tela.

---

## 2026-08-08 (noite) — a prosa honesta era o texto mais difícil de ler

Revisão do protótipo de referência (`workdesk/Frontend Fio Completo`) contra o
código, a pedido do João: *"se ainda houver polimentos que vc perceba vamos
discutir sobre"*. Saíram oito achados, três deles com número. Tudo discutido e
aprovado antes de codar.

### 1. Mono maiúsculo estava sendo usado para prosa

O sistema diz "mono = metadado", mas ele pintava **frases inteiras** — e justo
as que sustentam a credibilidade do produto: `NÃO SAI E-MAIL AUTOMÁTICO`,
`CITAÇÃO NA MATÉRIA — NÃO É ONDE O FATO OCORREU`, `SE TROCAR DE CELULAR (...) O
ACESSO SÓ VOLTA COM UMA REDEFINIÇÃO`.

Caixa alta destrói o formato da palavra, que é como se lê rápido; mono a 9px com
entrelinha 1.7 é ótimo pra coluna alinhada e péssimo pra frase corrida. Ou seja:
**as ressalvas metodológicas eram o texto mais lento de ler do app.** Honestidade
decorativa.

`SIMEopsType.note()` deixou de ser mono 9 e virou **Archivo 13 em caixa de
sentença**, tinta `muted`. A regra ficou mais nítida, não mais frouxa: mono é
campo de máquina; Archivo é coisa que se lê. O único bloco de várias linhas que
segue em mono maiúsculo é a `tagline()` sob o logotipo — que é acessório de
marca, não prosa.

### 2. `hairline` estava pintando texto que precisa ser lido

Contraste medido sobre o navy: `white` 17.8:1 · `muted` 8.0:1 · `faint` 4.8:1 ·
**`hairline` 1.8:1**. E o hairline pintava duas coisas:

- **placeholder** dos campos (`voce@orgao.gov.br`) — é instrução de formato;
- na tela de espera, o passo pendente estava em `muted` a 45% de alfa, que
  compõe **2.5:1** — a tela em que a pessoa encara 7 minutos, e os passos que
  faltam são a prova de que a busca tem plano.

Ambos foram pra `faint`. `hairline` ficou restrito a ornamento (o `— 30 —`).

### 3. `OUTRAS` no card de cidade era uma mentira estrutural

As categorias são **exatamente cinco**, e o card mostrava as quatro maiores +
`OUTRAS`. Logo `OUTRAS` nunca agregava nada: era a 5ª categoria escondida atrás
de um rótulo genérico — e pintada com `categoryColor('institucional')`, que
podia ser justamente outra. Chip que mente é pior que chip nenhum.

Agora mostra toda categoria com contagem > 0, no máximo cinco. Cabe: 412 − 36 de
margem − 4×13 de gap = 324px ÷ 5 = 65px por coluna, e `PATRIM.` em mono 9.5
ocupa ~40px mais o chip. De quebra o `fontSize: 8.5` sumiu.

### 4. O cabeçalho repetia em quatro telas o que a tela anterior já dissera

Queixa do João: *"esse 'varredura há x' em todas as telas ficou meio poluído"*.
Eram seis faixas antes da primeira manchete, e a linha de estado carregava
quatro dados. Saíram três:

- **`SC`** — você chegou tocando um card que dizia `SC · GRANDE FLORIANÓPOLIS`,
  e a fila logo abaixo nomeia as cidades.
- **`18 NOVAS`** — o card do dashboard acabou de dizer, e o feed separa lida de
  não-lida pela tinta. Terceira aparição do mesmo fato. E o cabeçalho **nem fica
  na tela**: rola embora, então não é readout persistente, é um cumprimento.
- **`● ÚLTIMA HÁ 2H`** — o ponto verde nunca apagava. Sinal que aparece sempre
  não é sinal; é a mesma armadilha do "1 FONTE". E a validade já está no
  conteúdo: o divisor diz `HOJE · 04 AGO` e o item diz a hora.

⚠️ **O `_LiveDot` não volta sem dado novo.** Ele só se justificaria podendo ficar
âmbar, e para isso precisa da **hora da varredura** — que não existe. O que o app
tem é `lastNewsAt`, o `created_at` da ocorrência mais recente, que mede a
imprensa e não o robô. Semáforo de saúde em cima disso seria reintroduzir a mesma
mentira que o rótulo "VARREDURA HÁ" já contou. Está anotado no fim do
`city_detail_screen.dart`.

Regra que saiu daí: **estado do sistema mora no dashboard, uma vez só.** O
dashboard **não tinha cabeçalho nenhum** — abria direto no primeiro card. Ganhou
um: logotipo + `7 PRAÇAS · ÚLTIMA HÁ 2H`, com o rótulo dizendo exatamente o que
o dado é.

### 5. O cabeçalho passou a encolher — e era mais barato do que eu tinha escrito

Em 08/08 registrei que encolher exigia `NestedScrollView` + `SliverAppBar` e era
arriscado, porque o corpo é um `TabBarView` cujos filhos têm scroll e
`RefreshIndicator` próprios. **Reavaliei e estava exagerando:** um
`NotificationListener<ScrollNotification>` por fora do `TabBarView` escuta a
rolagem que sobe dos filhos **sem tomar posse do controller de nenhum deles**.
Zero mudança no `FeedScreen`. Devolve ~85px durante a leitura.

Dois detalhes que custam bug se esquecidos: filtrar `metrics.axis ==
Axis.vertical` (o arrasto horizontal entre abas também emite notificação, e sem
o filtro trocar de aba encolhe o cabeçalho), e histerese 56/24 pra não tremer
quando a rolagem para no limiar.

### 6. O card do feed: forma fixa, e o crédito em tinta única

Duas coisas estavam erradas — a estrutura não.

**Os limites.** `maxLines: 3` na manchete **e** na lide: um item podia ter 6
linhas e o vizinho 2. Numa lista de 18, altura que oscila assim mata o ritmo
vertical — e o ritmo é a única razão de a lista ser varrida em vez de lida.
Medindo: Archivo 23 em 376px úteis dá ~32 caracteres por linha. E havia
incoerência minha: **o prompt pede 70 caracteres e o código truncava em 90.**
Agora manchete em `maxLines: 2` e o corte alinhado em 70.

**O crédito.** Era a faixa mais barulhenta e a menos útil: até quatro fichas em
três matizes — veículo em teal, `OFICIAL` em verde, `REGIÃO` em cinza, `3 FONTES`
em verde-claro. **Dois verdes diferentes significando coisas diferentes a 9.5px**,
e conteúdo vestido de verde, contra a regra que o próprio projeto já tinha
escrito. Agora: veículo e contagem viraram um fato só em tinta única, `OFICIAL` é
o único token colorido, e `REGIÃO` saiu (a slug logo acima já nomeia a cidade).

**A data.** A lista é agrupada por `HOJE · 04 AGO` e cada item recarimbava
`31/07` dentro do grupo `31 JUL`. Parâmetro `groupedByDate`: no feed mostra só a
hora; nos resultados da busca — onde os grupos são baldes, não datas — a data
continua.

### 7. A sanfona substituiu a tela de detalhe

Decisão do João depois de comparar as duas opções. Tocar na matéria **expande no
lugar** em vez de subir o `NewsDetailSheet` por cima de tudo.

O motivo não é visual: numa tela em que a pessoa está *varrendo* 18 itens atrás
do que importa, cada modal quebra a varredura — sai da lista, lê, fecha e tem que
reencontrar onde parou. A sanfona cresce **pra baixo** do ponto tocado, então a
manchete que está sendo lida não se move.

Aberta, a matéria mostra o resumo inteiro e a lista de fontes, cada uma abrindo
no **navegador externo** (nem WebView nem Custom Tab: conteúdo de terceiros não
deve ser emoldurado como se fosse do app). É também onde o teal volta a fazer
sentido — ali o nome do veículo é de fato clicável, o que no crédito fechado não
era.

**Pré-requisito atendido no mesmo turno:** o `resumo` do Filter2 passou de "1-2
frases" para **2-3**, com a primeira obrigatoriamente auto-suficiente (é a que
aparece truncada na lista) e as seguintes carregando o que um analista quer em
seguida — quantos envolvidos, o que foi apreendido, quem agiu. Sem isso a
sanfona revelaria meia linha e seria um toque que faz o card tremer.

⚠️ `news_detail_sheet.dart` **continua no repositório** — o `manual_search_screen`
ainda o chama. Morre na Fase D, junto com o resto.

### 8. O que ficou anotado e não foi feito

- **As abas de cidade não dizem onde está a notícia.** O dashboard inteiro se
  apoia em "o número te diz onde olhar", e aí a fila `TODAS · FLORIANÓPOLIS ·
  PALHOÇA` fica muda: tem que tocar uma por uma. Bastava `SÃO JOSÉ 4`. **Falta
  verificar se o feed devolve não-lidas por cidade-filha** — vai para a Fase C.
- **Os achados ao vivo da espera mostram menos do que o protótipo desenha.**
  `AchadoProgresso` (`queries.ts:1104`) tem `tipo_crime`, `bairro` e
  `data_ocorrencia`; falta `categoria_grupo`, `cidade` e `titulo` — os três já
  existem no Filter2 no exato momento em que o achado é montado. E o worker
  guarda só os 5 últimos (`ACHADOS_VISIVEIS`), descartando o resto: como o app
  faz polling de 3s, **ele pode acumular localmente** e deduplicar, sem custo de
  rede nem migration. Fase C.

### Verificação

`flutter analyze` limpo (os mesmos 3 infos preexistentes), `npx tsc --noEmit`
limpo, APK de staging buildado com `flutter clean` e instalado no A57 físico.

---

## 2026-08-08 (tarde) — a cor tinha três donos, e o card perdeu dado

### As telas que fecharam

Login, troca de senha, dashboard, feed, casca da cidade, histórico de consultas
e configurações. Commits `6c730bb` → `1604b5f` na `feature/design-fio`.

Achados que não eram estética:

- **`settings_screen.dart` tinha a versão CHUMBADA** como `'1.1.0'` no meio do
  widget — e já estava errada (o `pubspec` dizia 1.1.1). Passou a vir do
  `PackageInfo` (dep nova: `package_info_plus`).
- **`history_card.dart` usava `Colors.green/red/blueGrey/grey` crus**, contra a
  regra escrita no cabeçalho do próprio `simeops_colors.dart`.
- **A hierarquia do histórico estava invertida**: "Bahia" grande, "Salvador"
  pequeno e apagado. Quem varre o histórico procura a *cidade* — o estado não
  discrimina nada.
- **"VARREDURA HÁ 2H" era mentira minha.** Escrevi esse rótulo em cima de
  `lastNewsAt`, que é o `created_at` da ocorrência mais recente, **não** a hora
  da varredura. Cidade quieta há 3 dias exibiria "VARREDURA HÁ 3D" com o
  auto-scan tendo rodado há 20 minutos. Virou "ÚLTIMA HÁ 3D". O comentário do
  campo em `analyticsQueries.ts` agora avisa.

### A cor de categoria tinha TRÊS fontes divergentes

Achado na auditoria, e é o tipo de bug que não dá erro — só pinta errado:

| onde | valores |
|---|---|
| `backend/src/utils/taxonomia.ts` | Tailwind (`#EF4444`, `#F97316`, `#3B82F6`, `#8B5CF6`, `#64748B`) |
| `mobile-app/.../category_colors.dart` | validadas |
| `city_detail_screen.dart` (const privada!) | Tailwind de novo |

No mesmo APK, **Fraude era violeta Tailwind na tela de busca, violeta validado
no feed, e Tailwind outra vez no donut da tela de cidade**.

A causa está escrita no arquivo: o `taxonomia.ts` dizia *"espelham
category_colors.dart"*. Era uma cópia, e apodreceu no instante em que o Dart
trocou de paleta. **É a regra zero da workdesk acontecendo dentro do código** —
espelho de dado não se mantém sozinho.

Resolvido invertendo a direção: **o backend é a fonte** (com os hexes validados),
o Dart virou *fallback* pra quando a taxonomia não carrega, e o `main_screen`
publica as cores na entrada via `aplicarCoresDaTaxonomia()`.

⚠️ Os hexes são **medidos**, não escolhidos. Os antigos reprovavam em 4 de 5
checagens — pior caso operacional × fraude com **ΔE 1,3 sob deuteranopia** (a
mesma cor pra ~8% dos homens, no mapa e no donut e nos chips). Azul e violeta
não coexistem: por isso institucional virou verde-escuro, não cinza. Revalidar
com `validate_palette.js` da skill `dataviz` antes de mexer.

### O erro de método: entregar menos calado

O protótipo mostra `25 SEGUR. / 44 PATRIM. / 28 OPERAC. / 10 OUTRAS` por cidade
no dashboard. Eu entreguei o card **sem esse bloco**, porque o `CityOverview` não
tinha a quebra por categoria — e **não avisei**. O João percebeu olhando o
protótipo lado a lado com o app.

A lição não é "faltou um dado". É que **protótipo mostra o que o desenhista
quis; a API mostra o que existe**, e quando os dois divergem isso tem que virar
conversa, não simplificação silenciosa.

Corrigido: `categorias30d` sai da **mesma varredura que já rodava** —
`categoria_grupo` entrou no `select` (as mesmas linhas, uma coluna a mais) e a
contagem acontece no loop existente. **Zero query nova.** No mesmo movimento,
a query redundante que relia tudo só pra somar 30 dias foi deletada.

Aplicando a mesma lição em seguida: **as tags de região metropolitana do
protótipo (`+ LAURO DE FREITAS + CAMAÇARI...`) são ficção.** A região é resolvida
por **GPT no backend na hora da busca** (`metroRegion.ts`, cache Redis de 30
dias) — o app não sabe os nomes antes de buscar. Dessa vez foi pego **antes** de
codar. Expor isso exigiria uma rota nova e uma chamada de GPT na tela de
formulário; não feito, decisão do João pendente.

### A janela da contagem: 60/90 nasceram e morreram no mesmo dia

Pedido: seta no `107 EM 30D` pra filtrar 30/60/90/total. Implementado — e 60/90
saíram por decisão do João ao ver funcionando: com quatro opções o menu virava
decisão a cada abertura, e aquele número é orientação, não análise. Ficaram
30 dias e total. **Os campos saíram do backend junto** — campo de API que
ninguém consome é entulho.

O ganho de performance ficou: a consolidação da query (um round-trip a menos por
carregamento do dashboard) é independente da feature.

### Desbloqueio do aparelho na troca de senha

A infra **já existia inteira** no `AuthService` (`local_auth` +
`flutter_secure_storage`, com `biometricOnly: false`), só não era oferecida na
tela de troca. Agora: o usuário escolhe criar senha **ou** delegar ao Android —
nesse caso o app sorteia 32 caracteres com `Random.secure()`, troca no servidor
e guarda no Keystore. Ele nunca vê nem digita.

A senha provisória **tem** que morrer nos dois caminhos: o administrador a
conhece. E o custo está escrito **na tela, colado na opção** — quem escolhe isso
não sabe a própria senha, e perder o celular significa reset pelo admin.

**Decisão do João sobre recuperação de acesso:** o fluxo atual fica. Solicitação
→ badge "Pediu reset" no painel → admin gera outra senha e envia. Foi levantado
que guardar a senha permanente legível no painel exigiria uma coluna em claro,
que **nasceria legível pela chave anon** (pública, dentro do APK, migration 025
ainda não rodada); ele optou por não guardar. **Não existe mailer no backend** —
o envio do e-mail é manual até hoje.

### Staging recebeu tudo

`staging` = `1604b5f` (fast-forward, 12 commits, zero conflito). Autorizado
explicitamente.

🚨 **O staging fica com erro até a migration 029 rodar.** O código faz `insert` e
`select` de `news.titulo`; sem a coluna, o PostgREST devolve 400 em toda consulta
ao feed e em todo insert do scan. Foi avisado antes do merge e o João optou por
subir mesmo assim, rodando a 029 em seguida.

### Onde a Fase B parou

Criado `features/search/widgets/seletor_lugar.dart` — **ainda não ligado** ao
`manual_search_screen`. Substitui o `MultiCitySearchField` (que tinha
`maxCities = 1` mas ainda desenhava chip removível, contador "1/1 cidades" e
mensagem de limite: três peças pra um caso impossível) e troca o overlay
ancorado por uma folha, que no celular não briga com o teclado.

**Diagnóstico medido da poluição** do formulário, pra não se perder:

- o tempo estimado aparece **4 vezes** (3 cards de preset + caixa de estimativa)
- **11 blocos** empilhados antes do botão
- **5 tratamentos** diferentes de caixa arredondada
- o 3º preset "ESCOLHER" **finge ser preset** — é porta, não atalho

O plano completo das fases A-F está em
`~/.claude/plans/composed-splashing-raven.md`.

---

## 2026-08-08 — o redesign começa pela fundação, e a manchete não existia

Branch **`feature/design-fio`**, criada a partir da `develop`. O redesign NÃO
entra na develop enquanto o release está engatilhado: `main.dart`,
`login_screen.dart` e `city_detail_screen.dart` são três dos sete arquivos que
já conflitam no merge pra `main`, e mandar visual novo e não testado pra Play
Store no lugar do que funciona seria trocar o certo pelo duvidoso.

### A descoberta que mudou o plano: não existe manchete

O `NewsItem` tem `tipo_crime` e `resumo`. **Não tem título.** O card antigo
mostrava `HOMICÍDIO · Kobrasol` em caixa alta como "título" e o resumo embaixo.

O desenho do fio de agência tem a manchete como peça central, então isso era
bloqueante. As três saídas avaliadas:

| saída | custo | problema |
|---|---|---|
| primeira frase do `resumo` | zero | resumo é parágrafo; a 1ª frase passa de 150 char = 5 linhas em corpo de manchete |
| compor de tipo + bairro | zero | vira rótulo grande, perde a voz — mas é curto e nunca quebra |
| **Filter2 escrever a manchete** | ~0 marginal | escolhida |

Escolhida a terceira: **o Filter2 já lê o artigo inteiro** pra extrair
cidade/data/tipo, então a manchete sai no mesmo request. Nenhuma chamada nova,
algumas dezenas de tokens de saída por item.

**Decisão de produto:** o GPT **escreve** a manchete, não copia a do veículo.
Imprensa policial brasileira titula no sensacional ("VEJA O VÍDEO", "EXECUTADO
A SANGUE FRIO") e o produto é ferramenta sóbria pra quem lida com isso o dia
inteiro — copiar importaria o tom que o app existe pra não ter. Regras 9-11 do
prompt do Filter2: presente jornalístico, sem caixa alta, sem nome completo de
vítima, e a manchete tem que se sustentar sozinha (não é resumo encurtado).

**Nullable em duas frentes, de propósito:** as linhas antigas ficam sem título e
não são reprocessadas (custaria Jina + GPT de novo por item, pra um campo
cosmético), e item novo sem headline **não é rejeitado** — jogar fora uma
ocorrência já paga em SERP + Jina por causa de um título seria o pior negócio
possível. O app compõe pelo getter `NewsItem.headline`.

Achado de brinde: a busca manual descartava o campo no mapeamento final, o
**mesmo bug** que já tinha comido o `estado` (tem comentário sobre isso na linha
de cima). Campo que o Filter2 extrai e o mapeamento esquece some sem erro nenhum.

### As cores de categoria eram Tailwind cru

O comentário no `category_colors.dart` dizia "hexes calibrados pro navy". Não
eram: `red-500`, `orange-500`, `blue-500`, `violet-500`, `slate-500` — a paleta
padrão do Tailwind, que é literalmente o lugar-comum estético que o redesign
existe pra escapar. Rodadas no validador, reprovam em **4 das 5** checagens:

```
operacional × fraude    ΔE 1.3  (deuteranopia)  ← a MESMA cor pra ~8% dos homens
segurança × patrimonial ΔE 10.4 (visão normal)  ← vermelho e laranja encostados
institucional           croma 0.041             ← lê como cinza, não identifica
```

O ΔE 1.3 é o grave: valia no mapa, no donut e nos chips do feed ao mesmo tempo.

Substituídas por hexes **medidos**, não escolhidos a olho — banda de luminosidade
OKLCH 0.48–0.67, croma ≥0.10, ΔE deuteranopia 8.0, ΔE visão normal 19.3:

```
seguranca #DA4358 · patrimonial #B39026 · operacional #1F98AB
fraude    #8F62CB · institucional #4E8F45
```

Institucional virou **verde-escuro** porque azul e violeta simplesmente não
coexistem sob deuteranopia — não existe par de passos que salve. A adjacência é
conferida na ordem do `categoryOrder`; **trocar a ordem exige revalidar**, porque
num empilhado só vizinhos se encostam.

### Fundação

- `simeops_colors.dart` ganhou escala de tinta com contraste medido sobre navy:
  `faint` 4.8:1 (piso pra texto), `hairline` 1.9:1 (só decoração), `rule` e
  `ruleStrong`. O metadado carrega bairro e hora, e o app roda no sol.
- `simeops_type.dart` (novo) — os tamanhos estavam espalhados em **140 chamadas**
  de `GoogleFonts.*`. Três famílias, um trabalho cada: Archivo (manchete e
  corpo), JetBrains Mono (todo metadado), Rajdhani (**só** a marca).
- **Exo 2 sai do corpo** — geométrica techy, o lugar-comum. `textTheme` do
  `main.dart` virou Archivo; as 67 chamadas diretas de `exo2` somem conforme as
  telas migram. Botões passaram de Rajdhani pra mono com tracking largo.
- `take_card.dart` (novo) — a matéria no fio. Sem caixa, sem borda, sem canto
  arredondado: filete e espaço. Urgência é **peso** (filete branco na margem +
  manchete 30% maior), nunca cor — vermelho já é a categoria Segurança e não
  pode fazer dois papéis. Contador de fontes só aparece com **> 1**: "1 FONTE"
  estava em 100% dos itens e rótulo que aparece sempre não informa.

`npx tsc --noEmit` limpo, `flutter analyze` com os 3 infos que já existiam.

**Migration 029 escrita e NÃO rodada** — ver MIGRATIONS_LOG.

---

## 2026-08-06 — a `main` não era o que estava escrito, e o keystore tinha sumido

### A descoberta que quase virou desastre

O João pediu bump de versão e build para subir na Play Store. Antes de buildar
fui olhar a `main` — e a premissa que eu tinha repetido a sessão inteira era
**falsa**.

`git rev-list --left-right --count origin/main...origin/develop` → **`10  79`**.
A `main` tinha **10 commits que a `develop` nunca viu**, de 20/04 a **20/05** (não
"junho"). E não eram commits quaisquer:

| só na `main` | o que teria acontecido no build |
|---|---|
| `applicationId = com.progestao.simeops` | a `develop` tem `com.netriosnews.netrios_news` — **outro app** para o Google |
| config de assinatura lendo `key.properties` | eu ia "consertar" isso do zero, já existia |
| `build-aab-prod.bat` (gera **AAB**) | o Play não aceita APK |
| página de **política de privacidade** | exigência obrigatória do Play |
| página de **exclusão de conta** | exigência obrigatória do Play |
| versão **1.1.1+4** | a `develop` está em 1.1.0+3 — `versionCode` menor é rejeitado |
| 5 fixes de produção (20/05) | mapa de grupo, Sentry, signOut offline, Node 22, geocoding |

**O erro foi meu, e é do tipo que este documento existe para impedir.** Eu tinha
acabado de escrever no CLAUDE.md "não deduzir qual código roda, ler" — apliquei ao
backend e não apliquei à branch. Pior: na faxina de 04/08 eu **reescrevi** a frase
"main de junho, quebrada em 4 lugares" em três documentos sem verificar uma linha.
Auditei dez mentiras e digitei a maior.

**Regra:** antes de qualquer merge para `main`, rodar
`git log --oneline origin/develop..origin/main`. Nunca confiar na descrição.

### O merge não é automático

Merge-base é de **18/04**. Nove arquivos foram tocados dos dois lados:
`backend/Dockerfile`, `analyticsQueries.ts`, `queries.ts`,
`deduplication/index.ts`, `main.dart`, `login_screen.dart`,
`city_detail_screen.dart`, e os dois da workdesk (ruído).

### O Layer 3 do dedup — resolvido, era alarme falso meu

Levantei como "contradição" e não era. Lendo os dois arquivos:

- **`develop`** tem o prompt **velho e rígido**: *"Consider duplicate if: Location,
  date and crime type are **identical**"*. Exige tudo igual.
- **`main`** tem o prompt **melhor**: *"same **approximate** location, same time
  frame... details do not contradict"*, mais a linha que resolve o caso real —
  *"articles may cover different angles of the same event (victim found vs suspect
  arrested, early report vs follow-up) — these still count as the SAME incident"*.

O que me confundiu: **os dois arquivos carregam o mesmo comentário** dizendo que
uma reescrita foi testada e revertida. Mas aquela reescrita revertida enviesava
pro **NO** ("na dúvida, não é duplicata"); a da `main` vai na direção oposta. São
mudanças diferentes — o comentário só ficou fora de lugar na `main`.

**Resolução do merge:** fica o **texto do prompt da `main`** + a **linha de export
da `develop`** (`export { confirmDuplicateWithGPT }`, que a busca manual usa no
dedup em camadas e a `main` não tem). Não competem. E apagar o comentário obsoleto
da `main`.

### Versão do próximo release

O Play confirma **`versionCode` 4 (1.1.1)** como a última enviada. O próximo build
tem que ser **≥ 5**. Decidido: **`1.2.0+5`** — não é patch, é a Fase 8 + Fase 9
inteiras chegando ao cliente. O `pubspec.yaml` **não** está entre os arquivos que
conflitam, então o merge preserva o `1.1.1+4` da `main` sozinho e o bump entra por
cima, num lugar só.

**Fila do release:** (1) Google aprovar a chave nova → (2) merge com os 7 arquivos
→ (3) bump `1.2.0+5` → (4) `build-aab-prod.bat`.

### O keystore tinha se perdido

O notebook do João quebrou e levou o `simeops-release.jks` junto. Sem ele, um app
publicado **nunca mais pode ser atualizado**.

Salvou o fato de a **Assinatura de Apps do Google Play estar ativa**: o Google
guarda a chave que assina o app de verdade, e o que se perdeu foi só a **chave de
upload**, que se redefine. Confirmado no console em *Protegido com o Google Play →
Proteção da Google Play Store → "Versões assinadas pelo Google Play"*.

Gerado keystore novo (RSA 4096, 10.000 dias, alias `upload`) em
`mobile-app/android/simeops-release.jks`, com `key.properties` ao lado. **A senha
mora no `key.properties`** — que é git-ignored, então some se a máquina morrer.
Pedido de redefinição enviado ao Google em 06/08; aprovação leva até 2 dias úteis.

`.gitignore` da raiz ganhou `*.jks`, `*.keystore` e `key.properties` — o do
`mobile-app/android/` já cobria, mas a raiz não.

⚠️ **O `.jks` precisa de backup fora desta máquina.** É o mesmo arquivo que já se
perdeu uma vez, e nenhuma regra de git protege contra notebook quebrado.

---

## 2026-08-04 — a workdesk para de copiar o código

### A pergunta do João

*"Você tem memória interna no Claude. Então minha pasta workdesk acaba sendo
inútil, certo? Tô anotando tudo..."*

Não é inútil, mas ele estava certo sobre o desperdício. Os números:
a memória tem **15 arquivos, ~350 linhas**; a raiz da workdesk tinha **~150 KB**.
São órgãos diferentes — a memória guarda quem ele é e como trabalhar com ele, e
**não está no git** (troca de máquina, some). A workdesk guarda o raciocínio do
projeto, versionado junto com o código que explica.

**A prova de que ela se paga:** foi `Fases/Fase 8/ROADMAP.md:133` que me impediu
de fechar o teto de análise em 03/08. A memória não tinha isso e nunca teria.

### O que a auditoria encontrou

**As seções que copiavam o código eram exatamente as apodrecidas.** A caixa
`PERFORMANCE — LEIA ANTES DE MEXER` do ARQUITETURA afirmava, em sequência: que a
busca aceitava 10 cidades (aceita 1), que o Stage 5 rodava em série (foi
paralelizado), e que **nenhuma chamada externa tinha timeout** — enquanto o
cabeçalho do mesmo arquivo, 470 linhas acima, listava os timeouts. O documento se
contradizia sozinho, e a parte errada era a que gritava "LEIA ANTES DE MEXER".

Mais: `manual 30d: 50 | 60d: 50 | 90d: 80` (são por raiz quadrada, e a linha 410
do próprio arquivo dizia isso), `fetch_concurrency 10` (é 20 desde a 028),
`15 cats` de tipo_crime (a taxonomia tem 17 assuntos), e uma tabela de custo
baseada no **Brave**, que está fora do caminho ativo — errada por 3,7x contra a
medição de 03/08.

E o `MIGRATIONS_LOG` mentia **de novo, em tempo real**: 026, 027 e 028 marcadas
como "Pendente — o João vai rodar", todas aplicadas. É a armadilha nº 1
documentada acontecendo enquanto se lia a documentação dela.

### A regra nova

**Documento vivo não copia o que o código já diz.** Sem stack, árvore de
arquivos, lista de chaves de config ou shapes de request — isso se lê na fonte,
em dois segundos, e sempre certo. O motivo não é espaço: **a cópia apodrece
calada**, e uma segunda fonte da verdade me faz errar com confiança.

Fica o que **custa dinheiro ou tempo para redescobrir**: medições, o porquê das
decisões, o que foi tentado e falhou, e o estado do que não se enxerga do código.

Achado que reforça: os comentários do `validation.ts` explicam o porquê de
`cidades: max(1)` **melhor** do que o API_CONTRATO explicava. **O porquê que é
sobre uma linha mora colado nela.** A workdesk guarda o porquê que atravessa
arquivos.

### O que mudou

| doc | antes | depois | o que saiu |
|---|---|---|---|
| ARQUITETURA | 659 | **360** | stack, árvore, chaves de config, custos do Brave, a caixa PERFORMANCE inteira |
| API_CONTRATO | 243 | **162** | shapes de request, lista de rotas, a tabela "o que o app ainda ignora" (a Fase 9 implementou tudo) |
| WORKFLOW | 112 | **81** | filosofia e segurança, que já estão no CLAUDE.md |
| FUNIL | 216 | **250** | *ganhou* a tabela de custo por estágio e a resposta da lacuna |
| DEV_LOG | — | — | intocado abaixo do ESTADO DO MUNDO: é o único 100% irrecuperável |

**Estado num lugar só.** O bloco `Estado em 04/08` do ROADMAP foi absorvido pelo
`ESTADO DO MUNDO` do DEV_LOG, e o handoff em `~/.claude/plans/` foi apagado —
eram quatro cópias do mesmo estado, prontas para divergir. O ROADMAP volta a ser
só futuro.

**`FRONTEND_BRIEFING` arquivado** em `Fases/Fase 9/`. Ele dizia "o app ignora
oito campos"; o app consome todos desde hoje. Documento que descreve problema
resolvido é pior que documento nenhum — e ele ainda era apontado como "documento
de entrada" em três lugares.

**Lacunas fechadas de quebra:** o FUNIL agora tem a resposta dos 47 de Goiânia
(57% `filter2_location`, 32 do próprio Goiás — perda **geográfica**, não de
extração) e a tabela de custo por estágio que só existia no handoff.

### Segunda passada: dois arquivos apagados

O João olhou o resultado e disse *"ainda tá cheio de doc, não vamos deletar
nada?"*. Tinha razão — eu tinha aparado, não removido.

**`BACKEND_PENDENTE.md` era um segundo ROADMAP.** Cinco das oito seções eram
duplicata literal: migration 025, promover `main`, bugs conhecidos, dívida
técnica e "precisa de decisão". E o que **não** era duplicata estava errado: §3
dizia que o app não lê o que o backend manda (lê, desde ontem), citava
`_maxPolls = 200` (não existe mais) e afirmava que `cidades` "deveria ser até
10" — **contradizendo a decisão que o João tomou em 04/08**. §8 listava seis
achados todos fechados. §6 agendava uma verificação para "segunda, 03/08".

Salvo o que era único — o checklist de promoção da `main`, a tabela do que falta
lá, e quatro verificações em aberto — tudo movido para o ROADMAP. Arquivo
apagado.

**`README.md` era o CLAUDE.md §2 em outras palavras.** Os três papéis, os dois
tipos 📌/🗂️ e o ciclo da fase já estavam lá, mais curtos. Apagado, e os seis
links que apontavam pra ele agora apontam pro CLAUDE.md.

**O CLAUDE.md ganhou a regra zero da workdesk** — "documento não copia o que o
código já diz" — porque é ele que carrega em toda sessão. A regra no rodapé de um
documento que ninguém abre não impede nada.

**Raiz: de 8 arquivos e ~150 KB para 6 arquivos e 2163 linhas.** Nenhum link
quebrado (verificado).

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

- **`README.md` novo** — o mapa da pasta: os dois tipos, o ciclo de
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

### [FRONTEND_BRIEFING.md](./Fases/Fase%209/FRONTEND_BRIEFING.md) — o entregável principal

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
`BACKEND_PENDENTE.md` (absorvido pelo [ROADMAP](./ROADMAP.md) em 04/08).
