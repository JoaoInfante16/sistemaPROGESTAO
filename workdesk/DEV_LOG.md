# DEV_LOG — SIMEops (Fase 11: produção de verdade)

> 🗂️ **Documento da Fase 11** — arquivado em `Fases/Fase 11/` quando ela fechar.
> Ver [CLAUDE.md](../CLAUDE.md), seção 2.
>
> **Passado.** Diário de bordo: o que foi feito, decisões tomadas, problemas
> encontrados. Append-only, cronológico (mais recente no topo). Não se reescreve
> o passado: se algo estava errado, a correção entra como entrada nova.
>
> 🚨 **O estado atual do sistema NÃO mora aqui.** Como o sistema funciona hoje,
> as medições e as armadilhas: [ARQUITETURA.md](./ARQUITETURA.md) — é por lá que
> se começa uma sessão. Este arquivo é histórico.
>
> Fases 1 a 10 arquivadas em [Fases/](./Fases/).

---

## 🚦 ONDE PARAMOS — 27/08

> Única seção deste arquivo que se **sobrescreve** em vez de acumular.
> Teto: ~25 linhas. Passou disso, é porque virou arquitetura ou virou roadmap —
> mande para o documento certo. Este bloco já teve 376 linhas e três respostas
> diferentes para "a migration 025 rodou?".

**`develop` = `staging` = `origin/*` = `2c0f928`.** Staging tem banco próprio
desde 26/08, migration **035** rodada nos dois bancos (RLS 19/19) e
`auth_required` de volta em `true`.

**`main` = `e1aa6ef`, três commits atrás:** `7553f40` (banco de staging),
`1c718c8` (035) e `2c0f928` (auth_required). Os três são de infra de staging —
decidir o que vai para produção antes de promover, não promover no automático.

⬜ **Pendente desde 26/08: `Manual Deploy → Deploy latest commit` no Render**
(a `main` não tem auto-deploy) e conferir `commit` no `/health`.

🚨 **O APK não pode ser buildado antes do deploy — o teste engana.** A folha só
mostra texto próprio em notícia **nova**, gravada pelo backend novo; linha antiga
cai no `resumo`, que é o comportamento atual. Ordem obrigatória:

```
1. Manual Deploy no Render
2. esperar o scan rodar algumas vezes com o backend novo
3. build-prod.bat  (versão já está em 1.2.1+6 no pubspec)
4. testar no A57, device físico via LAN IP, flutter clean antes
```

⬜ **A workdesk foi reorganizada em 27/08** (fases 9, 10 e 11 recortadas; ESTADO
DO MUNDO dissolvido; WORKFLOW dissolvido no CLAUDE.md; hook de onboarding novo).
O hook `SessionStart` **ainda não foi visto rodando** — a prova é a próxima
sessão. Se o onboarding não aparecer, abrir `/hooks` uma vez ou reiniciar.

---

## 2026-08-27 — a workdesk tinha dois documentos do presente, e o desatualizado era o que mandava ler primeiro

O João abriu a sessão dizendo que a documentação saiu do controle: DEV_LOG imenso,
ROADMAP imenso, "e ninguém tá sabendo usar". O diagnóstico não foi "cresceu
demais" — foi **a Fase 9 nunca ter fechado**.

### O que estava errado, medido

A Fase 8 durou 4 dias e 1.464 linhas de DEV_LOG. A "Fase 9" estava com **25 dias,
63 entradas e 5.053 linhas** (265 KB), cobrindo **seis trabalhos** que nunca
tiveram nada a ver um com o outro: o app consumir os oito campos (02–06/08), o
redesign (08–14/08), o deploy e a auth (16/08), o volume 15× (17/08), o dedup
(24–26/08) e a infra de staging (26/08).

E o pior: o bloco **ESTADO DO MUNDO**, no topo do DEV_LOG, tinha crescido para
**376 linhas em 15 subseções**, datadas de 02, 04, 08, 17 e 26/08 empilhadas. Ele
é o documento do *presente* e tinha virado append-only — exatamente o que não
podia ser. Três achados, os três verificados no código antes de mexer em nada:

| o que o bloco dizia | o que a fonte diz |
|---|---|
| 🐛 "ACHADO NÃO CORRIGIDO — o relatório do grupo mostra só uma cidade" | corrigido em **09/08**, nas duas pontas: `analyticsQueries.ts` usa `.in('cidade')` nas quatro consultas e o app manda `_cidadesDoRelatorio` |
| "Migrations 025 a 033 todas aplicadas" (linha 260) | a 025 rodou em 16/08 |
| "🚨 Migration 025 — escrita e NÃO RODADA, exige decisão do João" (linha 276) | ⬆️ contradiz a linha 260 |
| "024 e 025 seguem não rodadas" (linha 387) | ⬆️ contradiz as duas |

**Três respostas para "a migration 025 rodou?" no mesmo bloco de 376 linhas** — e
o CLAUDE.md mandava ler esse bloco primeiro. É o acidente de 04/08 outra vez (a
ARQUITETURA com quatro afirmações falsas dentro de uma caixa "LEIA ANTES DE
MEXER"), mudando só de arquivo.

🚨 **A causa raiz:** existiam **dois documentos do presente competindo**, e o
desatualizado era o que o CLAUDE.md apontava. A ARQUITETURA estava mais correta
que o ESTADO DO MUNDO — a parte de infra compartilhada dela já tinha sido
corrigida em 26/08, com a ressalva certa sobre dev local e staging.

### O que foi feito

**O recorte, sem perder uma linha.** 5.053 − 391 (o cabeçalho e o bloco morto) =
4.662 linhas, e a soma das três partes bate exata:

| fase | período | linhas |
|---|---|---|
| [Fase 9](./Fases/Fase%209/) — o app à altura do backend | 02–06/08 | 962 |
| [Fase 10](./Fases/Fase%2010/) — o redesign "fio de agência" | 08–14/08 | 2.600 |
| **Fase 11** (viva, na raiz) — produção de verdade | 16/08 → hoje | 1.100 |

Cada pasta ficou auto-contida: DEV_LOG e ROADMAP recortados, o retrato da
ARQUITETURA **recuperado do git** na data certa (não a de hoje) e um README com o
que a fase resolveu, as descobertas e os erros. Mais um [índice das
fases](./Fases/README.md).

⚠️ **A ARQUITETURA da Fase 10 é a de 04/08, e não é engano:** o arquivo não foi
tocado **nenhuma vez** entre 04/08 e 16/08. O redesign inteiro passou sem que o
documento do "presente" mudasse — foi essa janela que criou o ESTADO DO MUNDO.
Documento vivo que ninguém edita gera um segundo documento vivo.

**O ESTADO DO MUNDO foi dissolvido**, cada pedaço para o dono certo: as
armadilhas novas (`PGRST205` e `select head:true` não populando `error`; o
`process.exit(0)` obrigatório em script que fala com Redis) para a ARQUITETURA;
as decisões que não se reabrem para o API_CONTRATO; as regras visuais para o
DESIGN_CONTRATO novo; o resto morreu por já estar em outro documento ou por ser
falso. Sobrou **ONDE PARAMOS, com teto de ~25 linhas e sobrescrito**, nunca
acumulado.

**A ARQUITETURA virou a porta de entrada**, com um bloco `🚪 COMECE POR AQUI` e
uma tabela de ordem de leitura por tipo de trabalho.

**Nasceu o [DESIGN_CONTRATO.md](./DESIGN_CONTRATO.md)** com as regras que a Fase
10 descobriu. 🚨 **Ele não copia um hex sequer** — e por pouco: eu ia transcrever
os cinco hexes de categoria, até ler o comentário do `category_colors.dart`, que
diz que o Dart é **fallback** e a fonte é o backend (`CATEGORIA_CORES` em
`taxonomia.ts`). Duas cópias dessa tabela já puseram dois violetas de Fraude no
mesmo APK em 08/08. A terceira cópia seria o mesmo erro com mais etapas.

**O ROADMAP foi de 493 para 349 linhas** e virou 🔴 AGORA / 🟡 DEPOIS / 🔵 IDEIAS.
Ele se declarava "só o FUTURO" na terceira linha e tinha **quatro seções ✅**,
incluindo a maior do arquivo. Item feito agora **sai**. A "Fase 10 — acelerar o
estágio 4" foi renumerada para **Fase 12**, porque 10 e 11 passaram a existir.

**Saíram da raiz:** o `BRIEFING_DESIGN.md` (descrevia um redesign que terminou em
14/08) e o `Frontend Fio Completo` — 58 KB de HTML **sem extensão**, que era o
protótipo do fio e virou `Fase 10/mockup-fio-completo.html`.

### O WORKFLOW.md não estava sendo ignorado — ele contradizia o CLAUDE.md

Achado que responde a queixa do João de que "tentou deixar ali pro Claude ler e
não rolou". O `WORKFLOW.md` §3 mandava arquivar o DEV_LOG em
`_archive/DEV_LOG_YYYY-MM.md`, **por mês**; o CLAUDE.md §2 manda arquivar em
`Fases/Fase N/`, **por fase**. Duas regras para o mesmo ato, e a pasta `_archive/`
**nunca foi criada**. Quando duas instruções conflitam, nenhuma roda: o DEV_LOG
foi de 1.500 a 5.053 linhas com a regra de rotação escrita, em vigor e ignorada.

O segundo motivo é estrutural: **regra de comportamento num arquivo que não
carrega sozinho depende de um ato de vontade para ser lida.** O próprio topo do
WORKFLOW já reconhecia isso ao mandar a filosofia para o CLAUDE.md "porque
repetir cria duas versões para manter em sincronia" — e parou no meio do caminho.

Então ele foi **dissolvido dentro do CLAUDE.md**, que passou a ter a definição de
"pronto" como seção própria, e ganhou as regras que esta sessão ensinou:
**verificar na fonte antes de afirmar**; **a fase fecha quando o trabalho que dá
nome a ela termina**, não quando o mês vira; **duas respostas para a mesma
pergunta se resolvem no mesmo turno**; **documento arquivado não se reescreve**.

### E um hook, porque texto só vale se for lido

`.claude/settings.json` (novo, versionado) ganhou um **SessionStart** que roda
`.claude/hooks/workdesk-onboarding.cjs` e injeta o bloco de onboarding da
ARQUITETURA em toda sessão. Injeta **só o bloco**, não o arquivo inteiro: a
ARQUITETURA vai crescer com o app e 500+ linhas em toda sessão não escala. Se os
marcadores sumirem, o hook avisa em vez de calar; se o arquivo sumir, ele reporta
o erro e sai com 0 — nunca derruba a sessão.

⬜ **Ainda não provado no ar.** `SessionStart` só dispara fora deste turno: o
pipe-test passou e o JSON foi validado, mas a confirmação de verdade é a próxima
sessão. Se não aparecer, abrir `/hooks` uma vez (recarrega a config) ou reiniciar.

### O que eu errei nesta sessão

**Vendi um corte de ~87 linhas duplicadas entre a ARQUITETURA e o FUNIL, e a
duplicata não existia.** O João pediu para eu conferir no código em vez de
confiar nos documentos, reli os dois blocos e a sobreposição real eram **duas
linhas**. A ARQUITETURA guarda o *porquê* (Filter1 nunca faz fallback "aprova
tudo"; as 3 camadas do dedup separadas por **custo**, não por precisão; a camada
1 é portão e não veredito; o limiar vem do banco e não do
`DEFAULT_SIMILARITY_THRESHOLD`; a camada 3 tem de ser testada nas duas ordens) —
nada disso está no FUNIL. Se eu tivesse executado o que propus, teria apagado
conhecimento medido. Os dois ficaram, ligados por ponteiro cruzado.


## 2026-08-26 (3) — o `auth_required=false` durou algumas horas

**Correção da entrada abaixo.** Staging entrou com `auth_required = false`
(decisão do João, e eu recomendei). Estava errado, e o erro só apareceu quando
ele perguntou se dava pra não buildar o APK de staging.

**O que eu não tinha dito na hora da escolha:** `auth_required=false` faz o app
**pular o login e nunca pegar token** (`main.dart:358`). E `requireAuth` ignora
essa config — sempre exige token válido (`auth.ts:28`). Medido no staging, sem
token:

| rota | |
|---|---|
| `/news/feed` (`conditionalAuth`) | **200** |
| `/news/unread-count` (`requireAuth`) | **401** |

O mesmo 401 valia para registro de push, preferências de notificação, marcar
como lido e **todo o `/analytics/*`, inclusive o relatório**. Sobrava feed e
busca. **Staging que não testa o que produção faz não serve de staging** — e
rebuildar o APK não resolveria, porque o problema não era o binário, era não ter
login.

Revertido: `auth_required = true` nos dois bancos. Os `system_config` agora são
**byte a byte idênticos** (mesmo md5). Criado usuário `joao.infante16@gmail.com`
no staging com `must_change_password = true` — o app abre a `ChangePasswordScreen`
no primeiro login e o João define a própria senha. Senha temporária entregue no
chat, some no primeiro acesso.

⚠️ O `semear-staging.ts` **forçava** `auth_required='false'` no destino: rodar de
novo desfaria isto em silêncio. A linha saiu; o valor agora vem copiado da
origem como qualquer outra config.

🚨 **O que o João achava e não era:** ele quis ligar de volta para "não ter
conflito ao subir pra `main`". `auth_required` é **dado no banco**, não código —
nunca sobe por git, não gera conflito nenhum. A conclusão estava certa pela razão
errada, e a razão certa é melhor: staging tem que se comportar como produção.

---

## 2026-08-26 (2) — separar o banco de staging: o que foi medido antes de codar

Pedido do João: *"separar o banco de dados do main e do staging, tá tudo no
main"*. Sessão nova, então a primeira coisa foi conferir no banco em vez de na
doc. Nada abaixo foi lido em documento — tudo saiu de consulta ao Postgres, da
chave anon ou de grep no código.

### Confirmado: um projeto Supabase só

`uywvrkiujzcmfmoxbwna`, apontado por `backend/.env`, `admin-panel/.env` e pelo
default **compilado** do Flutter (`env.dart:4`). Dev local, staging e produção
escrevem os três na `news` que alimenta o cliente. PG 17.6, pgvector 0.8 no
schema `public`, 19 tabelas, 9 usuários em `auth.users`.

### 🚨 Quatro tabelas abertas para a chave anon

Medido com a `SUPABASE_ANON_KEY` do próprio `.env`, **com caso de controle**
(tabela inexistente devolveu `PGRST205`, então a sonda vale):

| tabela | RLS | anon |
|---|---|---|
| `reports` | ❌ | leu 3 linhas — conteúdo de relatório de cliente |
| `billing_history` | ❌ | leu 3 — `total_cost_usd`, `breakdown` |
| `city_groups` / `city_group_members` | ❌ | leu |

E o grant do role `anon` **em todas as 20 relações** é
`SELECT,INSERT,UPDATE,DELETE,TRUNCATE`. Onde a RLS está desligada não existe
trava nenhuma — e a chave anon vai dentro do APK.

**Por que escaparam:** a 025 afirma, no comentário da linha 65, que `reports` já
estava fechada. **Não estava.** As outras três nem são citadas. Virou a
**migration 035**, para rodar nos dois bancos.

### Auditoria de tabelas × código: nada morto

As 19 tabelas são todas usadas pelo backend. Quase reportei três colunas como
mortas e **estava errado nas três** — a assinatura "sempre NULL" é fraca:

- `news.corpo` — a 034 rodou; só notícia nova recebe. ✅ **E isso confirma que o
  deploy de produção não aconteceu** (prod roda `5654361`, uptime 9 dias)
- `reports.expires_at` — é exatamente o que a 033 mandou fazer
- `pipeline_rejected_urls.search_id` — a tabela é janela de 24h
  (`cleanupOldRejectedUrls`), as 308 linhas são todas do auto-scan. O código
  **grava sim** (`manualSearchWorker.ts:429`)

Ociosas de verdade, sem serem defeito: `monitored_locations.keywords` (o modo
`keywords` funciona, nunca foi configurado) e `api_rate_limits.updated_by`.

**Consequência prática: não há o que podar antes de clonar.**

### Três caminhos descartados, com o motivo

- **Replay das migrations** — `schema.sql` declara 14 tabelas e o banco tem 19
  (faltam `city_groups`, `city_group_members`, `billing_history`,
  `executive_cache`, `user_notification_prefs`). Reconstrói errado.
- **`pg_dump` / `psql` / Supabase CLI** — nenhum existe nesta máquina, e o
  `supabase db dump` exige Docker, que também não há.
- **Branch do Supabase** (pedido do João) — a doc é literal: *"New branches do
  not start with any data from your main project"*. Ela **roda as migrations**,
  que são justamente as quebradas. Sairia vazia **e torta**. E custa
  `$0,01344`/h ≈ **$35/mês** com o Pro obrigatório, sobre $43 de custo fixo:
  **+81% por um banco pior.** Descartada com o argumento aceito.

### O que foi construído

Quatro scripts, todos com `process.exit()` explícito (regra da casa):

- `exportar-schema.ts` — **só leitura.** Gera o DDL a partir dos emissores do
  próprio Postgres (`pg_get_constraintdef`, `indexdef`, `viewdef`,
  `functiondef`, `triggerdef`) — as mesmas funções que o `pg_dump` chama por
  dentro, então não é aproximação. Saída em `workdesk/SQL/schema_staging.sql`:
  19 tabelas, 140 colunas, 54 constraints, 25 índices (inclui o HNSW do
  pgvector), 1 view, 1 função, 1 trigger, 3 policies, 60 grants.
- `aplicar-schema.ts` — **três travas**: destino sai de `STAGING_DATABASE_URL`,
  aborta se o host for igual ao de `DATABASE_URL`, aborta se o destino já tiver
  tabela. Roda em transação.
- `comparar-bancos.ts` — o **portão**. Inventaria os dois bancos e diffa.
  Autoteste: apontado para produção dos dois lados, **350 objetos, idênticos**.
- `semear-staging.ts` — copia só config + cidades + grupos + `news`/
  `news_sources`, em ordem de FK.

### Armadilha achada ao escrever a semeadura

**`system_config.updated_by` é FK para `auth.users` e 13 das 26 linhas têm
valor.** Como `auth.users` não é copiada (credencial de cliente real não vai
para ambiente de teste), as 13 quebrariam na inserção. O script **anula** a
coluna na cópia. Mesmo tratamento em `api_rate_limits.updated_by`.
`monitored_locations.parent_id` aponta para a própria tabela — a leitura é
ordenada `parent_id nulls first`.

### Decidido com o João

- **Projeto free separado**, não branch. Produção não é tocada em momento algum
- Staging entra com **`auth_required = false`** — mecanismo que já existe ponta
  a ponta (`middleware/auth.ts:70` → `/public/config` → `main.dart:358`) e tem
  toggle no painel. Zero código
- **`news` inteira (324)**, não amostra de 30d: filtrar dá mais trabalho que
  copiar e rende material pior para testar o dedup
- **Redis continua compartilhado, de propósito.** As chaves são endereçadas por
  conteúdo (`content:<urlHash>`, `embedding:<textHash>`, `geo:`) — compartilhar
  reaproveita Jina e OpenAI já pagos. O roubo de job já foi resolvido pelo
  `queueNames.ts`. Separar só faria repagar

### Também neste turno

- `.gitignore`: as regras eram `.env`, `.env.local` e `.env.*.local` — **nenhuma
  das três pega `.env.staging`**. Um arquivo com `service_role` key entraria no
  commit sem aviso. Passou a `.env.*` com exceção para `.example`
- MIGRATIONS_LOG: a 034 estava marcada **pendente** e já tinha rodado (`news.corpo`
  existe). Corrigida com a evidência junto
- `develop` estava **81 commits atrás** de `staging` e zero à frente —
  fast-forward limpo. `develop = staging = main = e1aa6ef`

### ✅ Executado no mesmo dia — staging de pé

Projeto novo: **`amrpitduoogfzhonfugu`**, PG 17.6 (mesma versão de produção). A
conexão **direta** funcionou — a preocupação com IPv6 não se aplicou, não
precisou da Session pooler.

| passo | resultado |
|---|---|
| aplicar schema | 19 tabelas, em transação |
| **comparar bancos** | **350 objetos dos dois lados, ZERO diferença** |
| semear | 26 config, 5 rate limits, 6 cidades, 2 grupos, 3 membros, 324 news, 576 fontes — todas batendo |
| 035 no staging | RLS **19/19** |
| sonda anon | staging fechado nas 6 tabelas testadas; controle deu `PGRST205` |
| caminho real | backend local → `/public/auth-required` = `false`, `/public/locations` e `/news/feed` devolvendo dado de staging |

**O embedding foi conferido byte a byte:** md5 dos 324 vetores concatenados é
**idêntico** nos dois bancos. Ele passou por JSON no caminho
(`json_populate_recordset`) e não perdeu precisão. `vector_dims` 1536 dos dois
lados.

**Só uma diferença sobra entre os bancos**, e é a intencional: `auth_required`
(`true` em prod, `false` em staging). Confirmado comparando as 26 chaves uma a
uma.

### 🚨 O painel admin nasceria inacessível — achado durante a execução

O app resolve login com `auth_required=false`, mas **o painel admin não tem esse
mecanismo**: o `middleware.ts` exige sessão do Supabase e redireciona pro
`/login`, ponto. Como `auth.users` não foi copiada, staging nascia com o painel
morto. Criado um admin **só no staging** (credenciais em `backend/.env.staging`),
com login verificado pela chave anon — o mesmo caminho que o painel usa.

### Repontado

- `backend/.env` → **staging**. O dev local parou de escrever na `news` do
  cliente. As credenciais de produção foram para `backend/.env.production` com
  prefixo **`PROD_`**, e os quatro scripts passaram a lê-las de lá
- `admin-panel/.env` → staging, **as três variáveis juntas**: token emitido pelo
  Supabase de staging não vale no backend de produção, que valida contra o
  Supabase dele. Misturar dá 401 sem explicação na tela
- `env/dev.json` e `env/staging.json` ganharam `SUPABASE_URL`/`ANON_KEY`. O
  default do `env.dart` **continua produção de propósito** — build de prod não
  define nada e cai nele; o inverso faria o APK do cliente autenticar em teste
- `config/index.ts` e `render.yaml`: o comentário da guarda do auto-scan dizia
  "os três ambientes usam o mesmo Supabase". Reescrito com o motivo novo — a
  guarda fica **por custo** (scan gasta OpenAI/BrightData/Jina de verdade) e
  porque dev local e staging ainda dividem o banco de staging entre si

⚠️ **Trava adicionada depois de quase errar:** o `comparar-bancos.ts` agora
recusa comparar um banco consigo mesmo. Sem isso, dois apontamentos iguais dão
**falso verde** no portão principal — ele diria "idênticos" e a separação
pareceria verificada sem nunca ter sido. O autoteste legítimo virou `--autoteste`.

### ✅ Render repontado — a separação está no ar

| | medido |
|---|---|
| staging `/public/auth-required` | **`false`** — valor que só existe no banco novo |
| produção `/public/auth-required` | `true` |
| staging `/news/feed` | devolve notícia do banco novo |
| staging `/health` | `database: ok`, `redis: ok`, `environment: staging` |
| admin staging | `307 → /login` (middleware de pé) |
| **produção `/health`** | `commit 5654361`, uptime **783.894s (9 dias)** — **nunca reiniciou** |

O uptime de produção é a prova de que ela não foi tocada: 9 dias de pé, o mesmo
processo desde 17/08, atravessando a separação inteira sem um restart.

🚨 **Armadilha que custou um boot quebrado:** o editor em massa do Render
**substitui TODAS** as variáveis pelo bloco colado. O primeiro handoff que eu
gerei tinha só as 4 do Supabase — colar apagou `REDIS_URL` e o resto, e o
staging subiu com `Missing required environment variable: REDIS_URL`. Handoff de
env var para o Render tem que ser **sempre o conjunto completo**, nunca o delta.
Refeito em `backend/.env.render-staging` (24 variáveis) e
`admin-panel/.env.render-staging` (3).

⚠️ E o `FIREBASE_SERVICE_ACCOUNT` mora entre aspas simples no `.env` — o dotenv
as remove ao ler, o campo do Render **não**. Colado cru, as aspas virariam parte
do valor e o `JSON.parse` do `pushService.ts:32` quebraria o push inteiro, com
erro só no log. O bloco gerado tira as aspas, e o JSON foi validado antes de
entregar.

### ✅ 035 aplicada em produção — o buraco fechou

Autorizada pelo João no mesmo dia. Medido antes e depois:

- RLS **19/19** em produção (era 15/19)
- a chave anon devolve **0 linhas** nas quatro; o controle seguiu dando
  `PGRST205`, então a sonda continua valendo
- **as contagens não mudaram** (`reports` 20, `billing_history` 4, `city_groups`
  2, `city_group_members` 3). RLS é acesso, não apaga dado — medido de
  propósito, porque "ligar segurança" soa destrutivo e não é
- produção **não reiniciou**: uptime de 784.457s (9 dias) atravessou a migration
- `comparar-bancos.ts`: **350 objetos, ZERO diferença** entre os dois bancos

Commit da separação: **`7553f40`** em `develop`.

### O que fica valendo desta sessão

- **Sonda de banco precisa de caso de controle.** "Sempre NULL" e "tabela
  ausente" mentem sem ele. Três colunas quase foram reportadas como mortas
- **Documento dentro de arquivo `.sql` apodrece igual.** A 025 afirmava que
  `reports` estava fechada; a afirmação sobreviveu meses porque ninguém mediu
- **Handoff de env var pro Render é o conjunto completo, nunca o delta** — o
  editor em massa substitui tudo
- **Nem toda separação vale a pena.** O Redis segue compartilhado por decisão:
  as chaves são endereçadas por conteúdo, e separar só faria repagar Jina e
  OpenAI

---

## 2026-08-25 — tocar num card não entregava nenhuma palavra a mais

Pedido do João: *"faça o corpo do texto dentro do card melhor quando o user
clicar"*. Investigando, o problema não era de formatação.

🚨 **A folha aberta no toque mostrava o MESMO texto do card, caractere por
caractere.** O card imprime o `resumo` INTEIRO — decisão do João em 09/08, e
continua certa: se o parágrafo cabe todo, não precisa de sanfona, e o toque passa
a ter um significado só. O efeito colateral nunca tinha sido fechado: a folha
repetia manchete e resumo e só acrescentava a ficha (rua, tipo, fontes). O
cabeçalho de `news_detail_sheet.dart` já registrava que ela quase morreu por isso.

O teto de 190 do `resumo` é **do card** e não pode subir sem quebrar o ritmo
vertical da lista. Então o texto de leitura virou campo próprio.

### Por que custa ~zero, que é o que decidiu

A Jina já busca o artigo inteiro e o Filter2 já lê até `filter2_max_content_chars`
(6000) para extrair cidade, data e tipo. **O conteúdo estava em mãos e era
descartado.** Escrever ~900 caracteres a mais sai no MESMO request: ~200 tokens
de saída, algo como US$ 0,0001 por matéria. Nenhuma chamada nova, nenhum fetch
novo.

⚠️ **Ficou mais necessário depois do dedup de ontem.** Agora vários relatos do
mesmo caso são FUNDIDOS num texto só, e a união de três veículos não cabe em 190
caracteres — sem o corpo, consolidar significaria escolher o que jogar fora. Por
isso a fusão consolida o `corpo` junto, e é lá que a união realmente cabe.

### O que entrou

| | |
|---|---|
| migration **034** | `news.corpo` TEXT, nullable, aditiva |
| Filter2 | regras 17-21: o corpo tem que **ganhar o toque** — o que o resumo não teve espaço de dizer, em 2-4 parágrafos |
| dedup | `FusaoParams.corpo`, consolidado na mesma chamada da fusão |
| API | as 3 queries do feed devolvem o campo |
| app | `corpoDeLeitura` cai no `resumo` quando não há corpo; `_Corpo` renderiza parágrafos com o primeiro em lide |

**NULL nas linhas antigas de propósito**, pelos mesmos dois motivos da 029: não
vale reprocessar (custaria Jina + GPT de novo por item), e item novo sem corpo
**não é rejeitado** — jogar fora uma ocorrência já paga em SERP + Jina por um
campo de leitura seria o pior negócio possível. A folha cai no resumo, que é o
comportamento de hoje.

### 🚨 A ordem do deploy não pode inverter

**A 034 tem que rodar ANTES do backend subir.** Com `corpo` no INSERT e a coluna
inexistente, **toda gravação de notícia falha** e o scan para de salvar.

É o espelho do erro de 16/08, onde as migrations foram na frente e o código velho
ficou atrás rodando contra um banco novo. Aqui o risco é o oposto e pior:
lá o efeito era três rotas de favoritos quebradas, aqui seria o produto inteiro
parando de gravar.

Sequência: **034 no Supabase → commit → deploy**.

### Nome completo de vítima: a regra existia e era desobedecida

Achado ontem, na revisão da fusão: há uma menina de **4 anos morta identificada
pelo nome inteiro** no resumo, junto com o nome do suspeito.

⚠️ **A regra 15 já proibia isso** ("no victim/suspect full names") — estava
enterrada no meio de uma lista de três proibições, e o modelo passava por cima.
Virou regra própria (**15b**), enfática, valendo para manchete, resumo e corpo,
com o caso real citado dentro dela.

Isso é o mesmo padrão de ontem no prompt do dedup: **sinal que não deve pesar
precisa ser proibido em destaque, não mencionado de passagem.** Regra que divide
espaço com outras duas não é lida como regra.

⚠️ Vale só para linha nova. As gravadas seguem com os nomes.

---

## 2026-08-24 — o dedup parou de usar como portão o que o próprio GPT inventou

Uma semana depois do conserto de 17/08 o João disse *"tá duplicando muito"*. E
estava: **~17% do feed era repetição** — 7 clusters, ~10 linhas excedentes nas 59
notícias que entraram desde o deploy.

⚠️ **O conserto de 17/08 funcionou no que mirava:** zero manchete idêntica
repetida desde então (as duas que existem são de 17/08, pré-deploy). O que
sobrou é a mesma ocorrência entrando com manchete **diferente**.

🚨 **Por que era prioridade e não cosmética:** `getCrimeSummary` monta
`byCrimeType` **contando linhas**. As três cópias do carro que invadiu uma loja em
Palhoça viravam **três ocorrências** na estatística, espalhadas em `vandalismo`,
`invasao` e `outros`. Número errado num documento que chega ao cliente do cliente.
Argumento do João, e é o certo: *"se repetir, corrompe o relatório; se sumir,
reduz a qualidade dele"*.

### A doença, em uma frase

**O pipeline extraía `tipo_crime`, `data_ocorrencia` e `bairro` com o GPT, e
usava esses mesmos campos como PORTÃO de igualdade para achar duplicata.**

É circular: a duplicata nasce exatamente quando o GPT é inconsistente, que é
exatamente quando o portão fecha. Em 17/08 isso apareceu na **data** e foi tratado
alargando a janela — sem que ninguém percebesse que era um caso particular de uma
doença maior. Em 24/08 apareceu no **tipo**, e aí não dá para "alargar" uma
igualdade de string.

**5 dos 7 clusters morriam na camada 1.** O par mais constrangedor diferia em
**uma letra** no título:

```
"Seis pessoas são presas em operação contra roubos de veículos"  -> operacao_policial
"Seis pessoas são presas em operação contra roubo de veículos"   -> roubo_furto
```

Sobraram no portão `cidade` + `estado` + janela de 3 dias. Cidade resiste porque é
pós-filtrada contra a localização monitorada — conferido, o banco inteiro tem
cinco valores e todos são municípios reais.

### O segundo modo: contagem lida como contradição

Dois clusters chegavam à camada 3 e o GPT reprovava:

```
"Operação Boreal ... seis suspeitos"  x  "Operação Boreal ... cinco prisões"  -> NO
"chacina ... prendeu oito"            x  "operação Ad Extremum ... sete"      -> NO
```

O nome da operação aparecia **por extenso nos dois resumos** e o modelo separava
mesmo assim, porque 6≠5 lê como fato contraditório. Veículos contam presos de
forma diferente, e o número muda ao longo do dia.

### 🚨 O que finalmente resolveu, depois de duas tentativas erradas

Registrado porque o caminho torto é a parte cara:

1. **"âncora de identidade é evidência forte"** → não bastou. O modelo via
   "Operação Boreal" nos dois lados e ainda dizia NO.
2. **"isto não faz de toda atividade policial um caso só"** → consertou um
   `DIFERENTE` e **quebrou** um `IGUAL` que já passava. Whack-a-mole de prompt.
3. ✅ **O que funcionou foi parar de "tolerar" e mandar IGNORAR:** a contagem de
   presos deixou de ser "não é contradição" e passou a ser *"não é evidência em
   direção nenhuma; não deixe isso produzir um NO"*. Junto, o nome da operação
   virou **decisivo**, não indício.

Resultado: **13/14 e zero assimetria** — todos os pares concordam nas duas ordens.

⚠️ Regra que sai daqui: *tolerar* um sinal ruim não impede o modelo de usá-lo.
Sinal que não deve pesar precisa ser proibido, não permitido com ressalva.

### A fusão passou a consolidar, e isso nasceu de um defeito que o conserto ia AGRAVAR

Fundir chamava só `insertNewsSource`: guardava a URL e **jogava fora a manchete e
o resumo novos**. Com o feed antigo isso era raro; com a camada 1 alargada, fundir
virou rotina — e a linha sobrevivente seria sempre a **primeira**.

Na prática: *"Menina de 4 anos é morta após maus-tratos"* ficaria no feed para
sempre e a prisão do tio viraria uma URL invisível. **Consertar a detecção sem
consertar a fusão pioraria o produto.** Decisão do João: um GPT reescreve os dois
relatos num só, e o `tipo_crime` consolida junto (agressão que virou homicídio tem
que virar homicídio, senão o relatório subnotifica).

🚨 **A primeira versão da reescrita PERDEU informação, e só apareceu no segundo
caso testado:**

```
A: "...chacina que deixou quatro mortos E QUATRO FERIDOS... desmantelar facções"
B: "...operação Ad Extremum... sete suspeitos... quatro mortos"
consolidado: "...Ad Extremum... sete pessoas... quatro mortos"   <- feridos sumiram
```

Ela **adotou o relato novo** em vez de unir. O conserto foi mandar explicitamente
que o resultado é **união**: todo fato concreto presente em qualquer um dos lados
sobrevive, com ordem de prioridade quando o teto de 190 aperta (vítimas → o que
houve e onde → desfecho → nome da operação → valores). E figura que diverge mantém
a da linha **publicada**, para não reescrever a história a cada fusão.

⚠️ O `embedding` é regravado junto, com a **mesma fórmula**. Trocar o resumo sem
regerar o vetor faria os dois deixarem de corresponder e degradaria as comparações
futuras em silêncio.

### A rede de proteção, que é o que muda o método

[`scripts/dedup-casos-reais.ts`](../backend/scripts/dedup-casos-reais.ts) — **15
pares reais de produção, rotulados à mão**, guardando `id` + rótulo + o **porquê**;
o texto vem do banco na hora de rodar, nunca copiado.
[`scripts/test-dedup-gabarito.ts`](../backend/scripts/test-dedup-gabarito.ts) roda
os 15 **nas duas ordens** e falha o processo se algum cobrado quebrar.

Sem isso, cada uma das três tentativas de prompt acima teria parecido uma
melhoria.

### Três coisas que eu afirmei e estavam erradas

- **"o par morreu na camada 2 por 0.016"** (17/08) — eu usei o
  `DEFAULT_SIMILARITY_THRESHOLD = 0.85` do código; o que roda é o
  `dedup_similarity_threshold` do painel, que está em **0.70**. Constante com nome
  de default que não é o default efetivo.
- **"a cidade gravada difere entre `Palhoça` e `SC`"** — o campo diz
  `Florianópolis`; o "SC" estava só no texto da manchete. O caso continua sendo
  duplicata invisível, mas por outro motivo (fato estadual pendurado na cidade que
  disparou a query), e isso virou item de ROADMAP.
- **"o pipeline pega por transitividade"** — testei: `A+B x C` continua NO. Era
  teoria, não fato. O par ficou marcado como falha conhecida.

### Dois achados soltos

- 🚨 **Nome completo de vítima e suspeito no resumo.** O Filter2 proíbe nome
  completo na **manchete**, e a regra nunca foi estendida ao **resumo** — há uma
  menina de 4 anos morta identificada pelo nome inteiro, junto com o do suspeito.
  A fusão herda e perpetua. Não corrigido nesta rodada.
- **Script que importa `pipelineCore` nunca termina sozinho.** O import abre
  conexão com o Redis e segura o event loop; o `Redis connected` no log é a
  pista. Todo script de diagnóstico precisa de `process.exit(0)` explícito — dois
  timeouts foram gastos até eu ler o log em vez de suspeitar da lógica.

---

## 2026-08-17 — o volume subiu 15× e mostrou quatro defeitos que sempre existiram

Entraram **31 notícias** hoje. A média histórica é **2,0/dia** (medida em 11/08,
21 dias de janela). Nada foi construído para esse número, e quatro coisas que
estavam erradas desde o começo ficaram visíveis de uma vez.

⚠️ **Um dia não prova padrão.** Pode ser o novo normal — o backend de produção só
foi deployado ontem, depois de meses rodando código de 3 de julho — ou pode ser
recuperação de fila. O que segue vale nos dois volumes, então não esperei medir
mais.

### 🚨 `manifestacao` era um balde de "gente reunida por causa de algo"

O João relatou: *"o GPT tá pegando manifestação como qualquer coisa"*. Medido
contra as 254 linhas do banco:

| tipo | linhas |
|---|---|
| `manifestacao` | **3** |
| `bloqueio_via` | **1** |

E as 3 de `manifestacao`, na íntegra:

```
17/08 [Porto Alegre]   Fórum discute violência doméstica em condomínios
17/08 [Florianópolis]  Campanha Agosto Lilás promove reflexão sobre violência contra a mulher
01/05 [Porto Alegre]   (sem título)
```

Um fórum e uma campanha. **Nenhuma manifestação.**

🚨 **Trocar o nome do balde não resolveria nada, e essa foi a descoberta que
mudou o conserto.** Se `manifestacao` sumisse sozinha, aquelas duas cairiam em
`outros` — que já guardava exatamente o mesmo tipo de coisa: *"Defesa Civil
alerta para tempestades"*, *"Mulheres com medida protetiva podem mudar local de
votação"*, *"Uma em cada dez brasileiras sofre violência digital"*.

A causa estava uma camada acima, na **regra 1 do Filter2**:

> `"is_crime": true for ANY public safety content: ... protests, strikes`

Campanha sobre violência contra a mulher **é** "public safety content". O modelo
estava obedecendo. Então a regra 1 passou a exigir **evento concreto**, e a regra
2 ganhou a lista negativa que faltava (campanha, data comemorativa, fórum,
seminário, palestra, debate, aviso de serviço, alerta meteorológico).

**Medido com `filter2GPTWithReason`, o caminho real:**

| lote | resultado |
|---|---|
| as 4 matérias que o João reclamou | **4/4 rejeitadas** (`e_crime=false`) |
| controle (roubo, tráfico, homicídio) | **3/3 entraram**, tipo certo |

### `greve` virou tipo próprio, e não foi para institucional

O João sugeriu `institucional`. Discordei com argumento e ele topou o pacote:
**`institucional` é o balde do "vale saber"** — crime ambiental, trabalho
irregular, estatística. Contexto. **Greve de ônibus não é contexto: é o
funcionário do cliente não chegando no turno**, que é a tese do produto.

E apontar `greve` para `bloqueio_via` seria mentira na tela — greve de ônibus não
fecha rodovia nenhuma.

O que fez `manifestacao` apodrecer foi a palavra ser **elástica**: cabe fórum,
campanha, passeata, ato. `greve` não é elástica. A taxonomia **não inflou**: saiu
um tipo, entrou outro.

⚠️ `manifestacao` **continua no enum**, congelado. Há linha gravada apontando pra
ele, e tipo sem rótulo imprime a chave crua na tela. Ele só parou de receber
gente nova — saiu da lista do Filter2, então o modelo não consegue mais escolhê-lo.

✅ **Sem migration.** Testei inserindo `tipo_crime = 'greve'` direto: a coluna é
texto livre, sem `CHECK` nem enum de Postgres. A linha de teste foi removida.

### 🚨 O push nunca mandou a manchete — e o título dizia a categoria

O João pediu "manda a manchete na notificação", achando que era feature nova. Era
**conserto**. É assim que a notificação saía, de verdade, hoje:

```
Institucional em Florianópolis
Mulheres com medida protetiva de urgência podem solicitar mudança de local de vot...
```

Dois erros numa notificação só:

1. **`formatTipoCrime` tinha nome enganoso e devolvia a CATEGORIA.** Um homicídio
   chegava como *"Segurança em Florianópolis"*. O aviso disso já estava escrito
   em `types.ts` desde 14/08 — e ninguém tinha ligado o aviso ao push.
2. **O corpo era o `resumo`**, que por contrato de prompt é *"never a paraphrase"*
   da manchete: ele **complementa**. A notificação entregava o complemento sem o
   fato. A manchete estava gravada, ao lado, e `PushNewsData` nem carregava o campo.

🚨 **E havia uma cópia podre.** `pushService.ts` tinha `TIPO_TO_GRUPO` e
`GRUPO_LABELS` locais, duplicando `types.ts`. A cópia dizia que `receptacao` era
**fraude**; `TIPO_CRIME_GRUPO` diz **patrimonial** desde que a decisão foi tomada
e escrita. O push anunciava "Fraude em X" para o que o app lista em Patrimonial.
As duas morreram — o rótulo agora vem de `rotuloTipoCrime`, que é a fonte. Regra
zero da workdesk acontecendo dentro do código.

### 🚨 Um push por notícia: 31 vibrações onde cabiam 15

A Fase F **descartou o digest com medição** (2,0/dia) e deixou o gatilho escrito:
*"acima de ~10/dia ele volta à mesa com número"*. Hoje deu **31**. O documento
funcionou: a regra existia e disparou sozinha.

Medido nas rodadas reais de hoje (cidade + janela de 10 min):

```
9 de 15 rodadas agrupariam
25 de 31 noticias cairiam num push agrupado
ANTES 31 pushes  ->  DEPOIS 15 pushes
```

O push saía de **dentro do laço que grava**, um por notícia. Saiu do laço:
`scanPipeline` agora acumula em `paraNotificar` e chama `sendPushForBatch` uma
vez, no fim da rodada.

🚨 **O agrupamento é POR USUÁRIO, e não dá para ser de outro jeito.** O recorte de
`querReceber` (cidade, assunto, estatística) é individual: das 5 notícias de uma
rodada, o cliente A pode querer 3 e o B só 1 — *"quantas chegaram"* é pergunta
diferente para cada um. Agrupar antes de filtrar mandaria "5 notícias" para quem
pediu 1. Aparelhos com o **mesmo** recorte compartilham uma chamada ao FCM, então
no caso comum continua sendo um multicast só.

**Formato:** uma notícia → `Roubo em Moinhos de Vento, Porto Alegre` + manchete no
corpo. Várias → `Porto Alegre · 4 noticias` + as manchetes que couberem em 130
caracteres + `+N`. O lote sobe pelo canal **urgente** se qualquer notícia dele for
urgente. `cidade` continua no payload (é o que abre a tela certa no toque), e sai
quando o lote tem mais de uma cidade — sem destino único, não se inventa um.

**`dryRun` novo, e ele existe por um motivo:** push é a única parte do sistema que
não dá para conferir sem incomodar o cliente — o caminho real termina no bolso de
quem está trabalhando. Com ele, rodei a função **de verdade** sobre as 31 notícias
de hoje e li as 15 notificações que teriam chegado, sem disparar nenhuma.

### 🚨 Duas duplicatas no feed, e os dois motivos eram diferentes

Achado no meio da medição, sem ninguém ter pedido — duas manchetes idênticas
entraram duas vezes hoje. Investigar as duas como "o dedup falhou" teria
consertado no máximo uma.

**Caso 1 — `Operação Olimpo`: o prompt do dedup é SENSÍVEL À ORDEM.**

O caminho: camada 1 devolveu o candidato certo (confirmado rodando
`findGeoTemporalCandidates` real), cosine **0.8343** contra limiar **0.70** —
passou. Foi ao GPT, e o GPT disse **NO**.

Só que rodando o par manualmente eu tinha tido **YES**. A diferença era a ordem
dos argumentos. Medido, 5 rodadas de cada lado, temperature 0:

```
prompt atual  (resumo antigo, resumo novo):  YES YES YES YES YES
prompt atual  (resumo novo, resumo antigo):  NO  NO  NO  NO  NO   <- a ordem do codigo
prompt novo   nos dois sentidos:             YES x10
```

Determinístico, não ruído. O modelo lia **detalhe que só um resumo tem** como
fato divergente — e o código chama sempre `(nova, existente)`, sendo a nova
justamente a mais detalhada, porque é o follow-up. Duas notas no prompt
resolveram: *detalhe presente em só um lado não é contradição* e *a pergunta é
simétrica*.

⚠️ **Um prompt que acerta num sentido e erra no outro passa em qualquer bateria
que só teste um lado** — foi o que aconteceu com os 10 pares validados em 04/16.

🚨 **Correção de rota registrada:** eu disse ao João, com o número na mão, que o
par tinha morrido na camada 2 por 0.016. Estava errado — usei o
`DEFAULT_SIMILARITY_THRESHOLD` (0.85) do código, e o valor que roda em produção é
o `dedup_similarity_threshold` do painel: **0.70**. Constante em código com nome
de default, mas o que vale vem do banco.

**Caso 2 — `Bancário desaparece`: a janela de ±1 dia da camada 1.**

A mesma matéria, lida com 2h de diferença, foi gravada com `data_ocorrencia`
**17/08** numa linha e **15/08** na outra. Dois dias de distância, janela de um:
a linha antiga **nunca virou candidata**, e as camadas 2 e 3 — que acertariam,
medido YES 5/5 nas duas ordens — nunca foram consultadas.

A causa da divergência é a **regra 4 do prompt do Filter2**: *"If unsure, use
today's date"*. Fallback que muda conforme a hora do scan. Enquanto ele existir,
a mesma matéria pode divergir em até `scan_period_days`. Janela virou
`DEDUP_JANELA_DIAS = 3`, com o porquê colado.

⚠️ Alargar a camada 1 **não** afrouxa o critério: só amplia quem é *perguntado*.
Quem decide continua sendo o cosine e o GPT, e o GPT lê "same time frame".

### A manchete era cortada no meio da palavra

Apareceu no teste do push, porque a manchete virou o corpo e ficou sozinha na
tela de bloqueio:

```
Corpo de mulher é encontrado em área de difícil acesso em Florianópoli
Torcedores do Inter são presos por tentativa de homicídio em Porto Ale
```

Exatos 70 caracteres, sem reticência, sem aviso: `headline.substring(0, 70)`.
Ao lado, no mesmo arquivo, `cortarNaFrase` existia justamente para não fazer isso
com o resumo — e o comentário dela até dizia *"reticências no fim de um titulo
são toleráveis"*, sem que o código as colocasse.

Agora `cortarNaPalavra` corta na palavra, tira conector pendurado (`...acesso em…`
→ `...acesso…`) e marca com reticência. **Só vale para linha nova** — as gravadas
continuam cortadas.

### Consequências e o que NÃO foi feito

- **`outros` não está na taxonomia** (o João perguntou). É tipo, não assunto:
  nunca vira pergunta ao Google, só recebe o que o Filter2 não classifica. Hoje
  guarda **desaparecimento**, **suspeita de bomba** e **sequestro/tortura** — três
  ocorrências legítimas sem tipo próprio. Vale decidir se merecem um; ficou no
  ROADMAP.
- **Estatística nacional entra como se fosse local.** *"Uma em cada dez
  brasileiras sofre violência digital"* foi gravada com `cidade = Florianópolis`
  porque a query era sobre Florianópolis. A lista negativa nova não cobre isso.
  Não mexi — é defeito de localização, não de classificação.
- **A taxonomia foi de 17 para 16 assuntos.** Menos uma pergunta ao índice, e cada
  pergunta é um teto novo de ~60 itens. Perda deliberada: era cobertura de lixo.
  Efeito colateral bom — com `assuntos.max(20)` na validação, a folga para
  palavra-chave subiu de 3 para 4.

---

## 2026-08-16 (5) — o deploy final: a `main` tinha divergido, e quase levamos junto

Fase 9 chegou ao cliente. `main ← staging`, as quatro migrations, o backend de
produção no ar e o AAB `1.2.0+5` publicado na faixa Alpha. O que segue é o que
quase deu errado — que é a única parte que vale guardar.

### 🚨 A `main` NÃO era ancestral da `staging`

`git log --oneline origin/main..staging` → 140. E o inverso → **11**. As duas se
separaram em `330db85` e a `main` seguiu recebendo commit.

Esse erro **já tinha sido cometido e documentado** nesta mesma workdesk (entrada
de 06/08: *"a premissa que eu tinha repetido a sessão inteira era falsa"*), e a
regra escrita lá — *"antes de qualquer merge para `main`, rodar `git log`"* — é o
que me fez rodar. Documento funcionou.

**O que só existia na `main`,** e teria sido apagado por um merge resolvido no
automático:

| | por que dói |
|---|---|
| `applicationId = com.progestao.simeops` | 🚨 é a identidade na loja. Buildar da `staging` produziria **outro app**: não atualiza, instala do lado, sessão zerada |
| `signingConfig` de release lendo `key.properties` | sem ele o pacote sai com chave de debug e o Play recusa |
| `privacy` + `delete-account` | exigência da Google para publicar |
| `createSearchCache` checando `processing` | tocar 2× em INICIAR CONSULTA **apagava a linha com o worker rodando**, e ele seguia gastando Jina e GPT gravando em lugar nenhum |
| prompt do dedup (Layer 3) | o `identical` fazia o GPT dizer NO para dois veículos cobrindo o mesmo caso — ocorrência repetida no feed |
| `signOut({clearCredentials})` | expirar token apagava o cofre de quem não pediu para sair |
| `beforeSend` do Sentry | cota é paga; "Failed host lookup" enchia a fila |
| `node >=22`, tema do painel, `build-aab-prod.bat` | |

**A estratégia foi inverter quem decide.** Em vez de mergear 140 commits e
revisar o que o git resolveu, apliquei as 205 linhas **à mão**, conferindo cada
uma contra `git diff staging...origin/main`, e depois `git merge -s ours
origin/main` só para registrar a ancestralidade. Com 4 arquivos de pipeline
reescritos dos dois lados, essa inversão é o que separa "deu certo" de
"descobrimos em produção".

⚠️ **Quatro coisas da `main` eu deliberadamente NÃO trouxe**, porque a `staging`
já tinha versão melhor: geocoding de grupo (refeito com cidade vizinha), resumo
multi-cidade (a `main` fazia `Future.wait` no cliente; a `staging` agrega no
backend), `Dockerfile` (já em node:22) e `login_screen` — a mudança da `main` ali
é o pré-preenchimento do "lembrar senha", feature que a Fase D matou por guardar
senha em texto claro.

### 🚨 O auto-deploy do backend de produção está DESLIGADO

O `git push` para `main` foi aceito e **nada aconteceu**. O serviço seguiu `Live`
no commit `8fcda24`, de **3 de julho** — nem o `faa38b7` (o bump 1.1.1+4, que
três documentos chamavam de "a branch de lançamento") tinha rodado. O painel
admin faz auto-deploy normal; só o backend não.

Isso inverteu a segurança da sequência: as migrations já tinham rodado, então
por ~40 minutos **produção rodou código de julho contra um banco sem
`user_favorites`**. Efeito real pequeno (as três rotas de favoritos, e a única
alcançável tem o erro engolido por um `catch`), mas é descasamento de verdade.
Registrado na ARQUITETURA.

### O `google-services.json` versionado estava errado desde março

Build de release morreu em `processReleaseGoogleServices`: o arquivo só tinha
`com.netriosnews.netrios_news`, e o app publicado é `com.progestao.simeops`.
Última alteração dele: **28/03**.

Conclusão: **o AAB que virou o `versionCode 4` na loja foi montado com um
`google-services.json` que existiu só na máquina do João e nunca foi commitado.**
Um `checkout` trouxe o antigo de volta e ninguém viu, porque o arquivo é
rastreado. Qualquer clone limpo gerava build apontado pro Firebase errado.

⚠️ Antes de trocar, conferi `project_id` e `project_number` — o novo é do **mesmo
projeto** (`simeops-e8cdc` / `890579135223`). Se fosse projeto novo seria
migração disfarçada: token FCM é amarrado ao sender ID, então mataria o push dos
**4 aparelhos** registrados e exigiria trocar a `FIREBASE_SERVICE_ACCOUNT` no
Render.

### Auditoria do banco, contra o catálogo do Postgres

O João desconfiou das migrations 26 e 27. **As duas estão corretas no banco** — o
que estava errado era o **cabeçalho da 026**, que dizia `Status: NAO APLICADA`
enquanto o log dizia aplicada em 04/08 e o banco confirmava o log. A REGRA ZERO
da workdesk acontecendo dentro de uma migration.

Resultado das quatro do dia, medido e não relatado:

| | |
|---|---|
| **025** | RLS `true` nas 12 tabelas restantes |
| **031** | `user_favorites` não existe mais |
| **032** | `user_notification_prefs` criada |
| **033** | 20 de 20 sem prazo, **0 vencidos** — 4 relatórios mortos voltaram a abrir |

### Consequências novas, registradas para não surpreender depois

- **Staging e produção são o mesmo app no aparelho.** O `applicationId` vale para
  todas as variantes, então instalar um substitui o outro. Separar pede
  `applicationIdSuffix` **mais** um cliente Firebase para o sufixo.
- **Existe um admin só.** O João se trancou fora da conta hoje e a única saída
  foi um script com a service key. Sem segundo admin, repete sem socorro.
- **O `.jks` não tem backup fora da máquina.** É o mesmo arquivo que já se perdeu
  uma vez.

---

## 2026-08-16 (4) — o botão "Sair da conta" era um botão de perder a conta

João, testando o desbloqueio meia hora depois de ele passar a funcionar:
*"Quando muda a senha pelo aparelho, as 32 são criadas, e depois… o user se
fechar a sessão não consegue mais abrir."* E, junto, o desenho certo: *"Criar
senha + registrar biometria. A biometria vai pra facilitar no próprio celular a
entrada, e a senha caso mude de aparelho."*

Ele mesmo ficou trancado — do app **e** do painel admin, que usam o mesmo
usuário do Supabase.

### O defeito

Quem escolhia o desbloqueio recebia uma senha de **32 caracteres sorteada** que
nunca via, trocada no servidor e guardada só no Keystore. O cofre era a **única
cópia dela no universo**. Quatro caminhos apagavam esse cofre, e todos trancavam
a conta em definitivo:

| # | caminho | gravidade |
|---|---|---|
| 1 | `signOut()` faz `clearSavedCredentials()` **antes** de deslogar | o botão `Sair da conta` era um botão de perder a conta |
| 2 | `_tryAutoLogin` → `catch (_)` que limpa o cofre | 🚨 **abrir o app sem internet destruía a senha** |
| 3 | `_handleUnlock` → o mesmo `catch (_)` | idem |
| 4 | limpar dados do app / trocar de aparelho | previsto, mas sem saída |

O 2 é o pior: `signInWithDeviceAuth` levanta em qualquer falha de rede, e o
`catch` não distinguia "senha inválida" de "sem sinal".

### A correção é do João, e ela dissolve os quatro de uma vez

**Senha + biometria, não senha OU biometria.** A senha é a credencial — sempre
conhecida por quem a criou, válida em qualquer aparelho. O desbloqueio é
**conveniência local**, um atalho pra não digitar. Com isso o cofre vira
**cache**, e cache pode ser apagado à vontade.

A tela virou uma coluna só: `NOVA SENHA`, `REPITA A SENHA`, uma caixa marcada por
padrão `Entrar com o desbloqueio do aparelho · Padrão · PIN · Rosto`, e um
`SALVAR`. Morreram `_generateStrongPassword()`, `_handleDeviceAuth()` e o
`_SectionRule` — dois caminhos concorrentes viraram um campo e um atalho.

⚠️ O diálogo do Android continua vindo **antes** de qualquer escrita no servidor,
e recusá-lo **não cancela a troca**: só desliga o atalho. A senha já foi digitada
e conferida; abortar por causa do atalho seria punir a pessoa pelo opcional.

### Ninguém mais estava exposto, e dá pra provar

- `origin/main` não tem o caminho: `authenticateWithDevice` aparece **0 vezes**
  na tela de senha de produção;
- `origin/main` é `FlutterActivity`, então mesmo no login o `authenticate()`
  sempre devolveu `NOT_FRAGMENT_ACTIVITY`.

O desbloqueio **nunca funcionou para ninguém** até `8906275`, hoje 12h25. O João
foi o primeiro a conseguir usá-lo e o primeiro a cair na armadilha, na mesma
hora. **O bug do `FlutterActivity` estava protegendo todo mundo do bug pior** —
o que é sorte, não desenho.

### Recuperação

Sem caminho pelo produto: o `Esqueci a senha` do app abre chamado para o
administrador, e o administrador é ele. Redefinido pelo mesmo mecanismo da rota
oficial (`userRoutes.ts:151`): `auth.admin.updateUserById` + `must_change_password
= true`, com a mesma convenção de senha temporária de 8 caracteres. Ele cai
direto na tela nova.

🚨 **Fica a lacuna:** o único admin é `joao.infante16@gmail.com`. Se essa conta
se perder, não há segundo admin para redefinir nada — a saída passa a ser a
service key. Vale um segundo admin antes do deploy.

---

## 2026-08-16 (3) — o desbloqueio pelo aparelho nunca funcionou, e a tela parou de explicar

João: *"o botão usar o desbloqueio de celular não existe"*. Depois, vendo a
tela: *"Imagino que seja a mesma tela que o user vai ver né? Porra o user n é
burro… Deixa usar o desbloqueio do dispositivo. Padrão - pin - rosto. E tira
esses disclaimer tudo."*

### 🚨 `MainActivity` era `FlutterActivity`, e isso mata o `local_auth` inteiro

`local_auth` usa `androidx.biometric.BiometricPrompt`, que só sabe se hospedar
numa `FragmentActivity`. Lendo o fonte do plugin no pub cache
(`local_auth_android-2.0.7/…/LocalAuthPlugin.java:112`):

```java
if (!(activity instanceof FragmentActivity)) {
  result.success(new AuthResult.Builder().setCode(AuthResultCode.NOT_FRAGMENT_ACTIVITY).build());
  return;
}
```

O app declarava `class MainActivity : FlutterActivity()`. Ou seja: **o
desbloqueio pelo aparelho nunca funcionou neste app** — nem no primeiro acesso,
nem no login. E falhava do pior jeito possível: o erro voltava como `false`, que
`authenticateWithDevice()` não distingue de desistência, então a tela dizia
*"Desbloqueio cancelado. Nada foi alterado."* — culpando a pessoa por um defeito
de configuração do Android.

Corrigido para `FlutterFragmentActivity`. O tema não entra na conta: o
`LaunchTheme` não é AppCompat, mas a partir do API 28 o `BiometricPrompt` usa o
diálogo do **sistema** e não infla view própria.

⚠️ Isto **não** explica o botão sumido — `isDeviceSupported()` é
`isDeviceSecure() || canAuthenticateWithBiometrics()` e não olha o tipo da
activity. Medido no A57: `locksettings get-disabled` = `false` (tem bloqueio) e
`dumpsys biometric` mostra Nubank, Itaú e WhatsApp autenticando com sucesso.
Então a capacidade existe e a visibilidade tem outra causa — **a confirmar no
log**, não deduzir.

### Duas falhas que se manifestavam como ausência

- `isDeviceAuthAvailable()` tinha `catch (_) { return false; }`. Engolia o motivo
  e o efeito era um botão que não nascia: sem log, sem erro, sem nada pra
  investigar. Agora imprime as duas capacidades e a exceção.
- `_checkDeviceAuth()` tinha **dois `await` sem proteção** antes de um único
  `setState` (o segundo, `hasDeviceAuthEnabled()`, entrou hoje mesmo). Qualquer
  um levantando deixa `_deviceAuthAvailable` **null pra sempre**, e null não
  desenha nada.

🚨 **A lição é a mesma das duas últimas caçadas:** o defeito não apareceu como
erro, apareceu como **ausência** — igual ao `INICIAR CONSULTA` fora da tela e ao
`convertHtml` que respondia `false`. Ausência não deixa rastro, e por isso todo
`catch` que apaga um elemento da interface precisa falar.

### A tela parou de explicar

Tinha quatro blocos de prosa: o que é a senha provisória, o que é biometria, o
que acontece se trocar de aparelho, e um rodapé dizendo que aparecia uma vez só.
Saíram todos. Sobraram duas seções, `Padrão · PIN · Rosto` e dois botões.

⚠️ A ressalva sobre reset do administrador saiu **com razão de ser, não por
corte cego**: ela era verdade enquanto a escolha era permanente, e o `Mudar
senha` no Ajustes acabou de torná-la reversível. Registrado no doc da classe: se
essa porta sumir do Ajustes, o aviso volta junto.

---

## 2026-08-16 (2) — a tela de senha tinha uma porta só, e ela fechava pra sempre

O João: *"A tela de mudança de senha… Tem que ter a opção de desbloquear com a
senha do aparelho. Se usar essa opção, pede confirmação no padrão do android, e
depois ele entra sempre assim."* E, antes de tudo: *"N vi ainda. Coloca 'Mudar
senha' em configurações"*.

### Três dos quatro pedidos já existiam

Medido antes de escrever qualquer linha:

| pedido | estado |
|---|---|
| opção de desbloquear com a senha do aparelho | **já existia** — e é a opção **primária**, marcada `RECOMENDADO` |
| confirmação no padrão do Android | **já existia** — `_localAuth.authenticate(biometricOnly: false)`, o diálogo do sistema, que aceita digital, rosto, PIN e padrão |
| "depois ele entra sempre assim" | **já existia** — senha de 32 caracteres sorteada com `Random.secure()`, trocada no servidor, guardada no Keystore; `_handleUnlock` no login desbloqueia e entra |
| ser um popup | não existia, e ele ainda não viu a tela |

O `local_auth` e o `flutter_secure_storage` estão no `pubspec` e ligados desde
antes. A confirmação do Android é chamada **antes** de qualquer escrita no
servidor, de propósito: desistir no diálogo do sistema não deixa rastro.

### O buraco que estava lá, e que ninguém tinha nomeado

🚨 **A tela só tinha uma porta: o gate do `main.dart`**, que a devolve enquanto
`must_change_password` for verdadeiro — ou seja, **uma vez na vida**. Quem
escolhesse o desbloqueio pelo celular no primeiro acesso e depois quisesse uma
senha de verdade, ou trocasse de aparelho, **só voltava com redefinição do
administrador**.

Isso é pior do que parece pelo desenho da própria feature: quem escolhe esse
caminho **não sabe a própria senha** (são 32 caracteres que ele nunca vê). A
escolha é permanente, e é feita no minuto em que a pessoa menos conhece o
produto. O Ajustes tinha `Sair da conta` e mais nada.

Agora tem `Mudar senha`, logo acima do sair.

### Uma tela, dois modos — e por que não duas telas

`ChangePasswordScreen` ganhou `primeiroAcesso` (default `true`). No **portão**
nada muda. Na **visita** ela ganha `Masthead` com seta, perde o *"Esta tela
aparece uma única vez"* (que ali seria mentira) e troca a conversa sobre senha
provisória por `A forma que você usa hoje para de valer assim que a nova for
salva.` — que é o que `_apply` de fato faz.

⚠️ **Não virou uma segunda tela de propósito.** `_apply` troca a senha no
servidor e depois **ou** grava a nova no cofre (desbloqueio) **ou** limpa o cofre
(senha digitada). Duplicar isso criaria um segundo lugar onde essa regra pode
divergir — e é justamente ela que, divergindo, deixa alguém trancado fora da
conta: cofre com a senha velha faz o login automático falhar em silêncio.

Dois detalhes que só aparecem na visita:

- **`_concluir()`.** No portão, quem decide o que vem depois é o gate. Na visita
  não há gate: sem isto a tela ficaria **parada** depois de a senha já ter
  mudado — sem erro e sem sinal de sucesso, que é o pior estado possível numa
  tela de credencial (a pessoa não sabe se pode sair, e tentar de novo é trocar
  duas vezes). Agora ela devolve `true` e o Ajustes confirma no retorno.
- **`RECOMENDADO` vira `É COMO VOCÊ ENTRA HOJE`** quando `hasDeviceAuthEnabled()`
  é verdadeiro. Chamar de recomendado o caminho que já está em uso responde a
  pergunta errada: quem abre isto pelo Ajustes quer saber primeiro **como entra
  hoje**.

⚠️ Duas `_LinhaDeToque` encostadas somam o filete de baixo de uma com o de cima
da outra e desenham traço duplo — daí os 12px entre `Mudar senha` e `Sair da
conta`.

### Verificação

`flutter analyze` no baseline. APK de staging com `flutter clean`, instalado no
A57. **Falta o teste no aparelho**, e ele tem duas metades que precisam ser
feitas nesta ordem: trocar por senha digitada e conferir que o login pede senha;
depois trocar pelo desbloqueio e conferir que o login volta a desbloquear.

---

## 2026-08-16 — a estimativa saiu escrita na vertical, e o culpado era o tema

O João mandou a captura da Nova consulta com `~11 min · 18 ASSUNTOS` escrito **de
cima pra baixo, uma letra por linha**, e o `INICIAR CONSULTA` fora da tela. Junto,
dois pedidos: *"temos que padronizar os 2 ícones ? que existem… eu queria um ?
mais reto, esse é muito estilizado"* e *"faz um merge do disclaimer, os 2 têm
coisas boas e ruins"*.

### O bug não estava na tela — estava no tema, desde sempre

`main.dart:136` define `minimumSize: Size.fromHeight(54)` para o `FilledButton`.
E **`Size.fromHeight(h)` é `Size(double.infinity, h)`**: largura mínima
infinita. Num `Row`, o filho não-flexível recebe `maxWidth: infinity`, então o
botão pediu a tela inteira, o `Expanded` da conta ficou com largura zero e o
texto quebrou caractere a caractere.

**Por que só agora.** Todos os outros `FilledButton` do app vivem em
`SizedBox(width: double.infinity)` (login, troca de senha, filtro de feed, as
duas folhas) ou em `actions:` de diálogo, onde `OverflowBar` empilha sozinho —
e aí largura mínima infinita é exatamente o comportamento desejado. A barra da
Nova consulta, criada em 14/08, foi **a primeira vez que um `FilledButton` teve
vizinho** em quatro meses de app.

**Zerar a mínima não resolveria.** Medido: `~11 min · 18 ASSUNTOS` em mono 9.5 com
tracking 1.24 = ~146px; `INICIAR CONSULTA` em mono 13 com tracking 2.86, mais o
padding do Material = ~219px; margens 36px; total **412px**. Não cabe em celular
nenhum (A-series ficam entre 384 e 411dp). A barra virou duas linhas — conta em
cima, botão de largura cheia embaixo. Custa 22px de altura, e o botão fica *mais*
visível, não menos.

⚠️ **A lição, e ela vale para o tema inteiro:** `Size.fromHeight` num
`ButtonThemeData` é uma decisão de layout global escondida num parâmetro de
altura. Funciona enquanto todo botão for de largura cheia; quebra silenciosamente
no primeiro que não for, e quebra de um jeito que não parece bug de botão.

### Os dois `?` viraram um

Havia duas cópias do mesmo ícone com **cinco diferenças**: 23px × 19px, aro
`teal` × `faint`, tinta `tealLight` × `faint`, corpo 12 × 9.5, e um
`letterSpacing: 1.24` sobrando no do formulário — tracking é espaço *depois* da
letra, então num texto de um caractere ele empurrava o `?` para a esquerda dentro
do círculo. Agora é [`BotaoAjuda`](../mobile-app/lib/core/widgets/botao_ajuda.dart),
com duas mudanças sobre o padrão do monitoramento:

- **o `?` saiu do JetBrains Mono e foi para o Archivo** — o mono tem a haste
  angulosa e o bico cortado na diagonal, desenho de fonte de código, e num glifo
  solto isso lê como enfeite. É o "mais reto" que o João pediu;
- **o aro é teal nas duas casas** — em `faint` o botão veste a cor que o sistema
  inteiro usa para dizer *desabilitado*, e sumia no navy.

### O disclaimer: tronco comum, fecho de cada casa

Os dois textos tinham metade certa cada um. O do monitoramento dizia **onde** o
sistema procura e **de quem é a chave** para mudar a lista, mas em voz passiva
(*"são feitas varreduras"*). O da consulta dizia a tese do produto — um assunto é
uma pergunta, teto de ~60 notícias por pergunta, perguntar mais é a única alavanca
— mas chamava o mecanismo de **"o buscador"**, peça que não existe em lugar nenhum
do produto.

🚨 **Não viraram um texto só, e isso foi decisão, não preguiça.** Os dois `?`
respondem perguntas diferentes: no monitoramento, *"o que esse negócio fica
fazendo o dia todo"*; na consulta, *"o que esta consulta vai perguntar, e o que
isso me custa"*. Texto único ou põe custo em minutos numa tela onde ninguém
espera, ou põe *"fale com o administrador"* numa tela onde a pessoa mexe na lista
sozinha. Nos dois casos o texto que devia dar confiança vira ruído.

O tronco virou a constante `comoOSistemaPergunta` (em `folha_taxonomia.dart`),
importada pelas duas folhas — **uma constante e não duas cópias** porque foi
exatamente a divergência entre duas cópias que produziu "varreduras" de um lado e
"o buscador" do outro. Cada folha acrescenta uma frase própria: `A lista roda
sozinha, todo dia. Para incluir ou tirar um assunto, fale com o administrador.`
no monitoramento; `Cada assunto acrescenta cerca de meio minuto à consulta.` na
consulta.

⚠️ **"Meio minuto" e não "35 segundos" de propósito.** O número real mora em
`_segundosPorAssunto`, já recalibrado duas vezes (47 → 36) e com nova queda
prevista pela migration 028. Texto de tela que promete precisão que a constante
não tem apodrece calado — a precisão fica na barra da consulta, que lê a
constante; na folha fica a ordem de grandeza.

### Verificação

`flutter analyze` no baseline (1 info em `type_helpers.dart`). APK de staging
buildado com `flutter clean` e instalado no A57 (`Success`, 58.2MB).

---

