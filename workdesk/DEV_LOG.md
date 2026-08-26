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

### 🧾 26/08 — quatro migrations diziam "NAO RODADA" e tinham rodado

O Joao olhou a 031 aberta no editor, leu `Status: ESCRITA, NAO RODADA` e
concluiu que faltava rodar 031, 032, 033 e 034. Conclusao razoavel — o arquivo
diz isso. **Medido no banco, so a 034 falta:**

| | o arquivo dizia | o banco diz |
|---|---|---|
| 025 | `NAO APLICADA` | ✅ a chave anon le `news` sem erro e recebe **zero linha** (a tabela tem 324) — RLS ativa |
| 031 | `ESCRITA, NAO RODADA` | ✅ `user_favorites` nao existe mais |
| 032 | `ESCRITA, NAO RODADA` | ✅ `user_notification_prefs` existe, com `estatisticas` |
| 033 | `ESCRITA, NAO RODADA` | ✅ 20 relatorios, **0** com `expires_at` |
| 034 | — | ❌ `news.corpo` nao existe |

O MIGRATIONS_LOG estava **certo** nas quatro. Quem apodreceu foi o cabecalho
dentro do proprio `.sql` — o lugar onde se olha primeiro. Corrigidos os quatro,
com a evidencia junto em vez de so a data.

⚠️ **A primeira sondagem minha deu falso positivo:** `select("*", { head: true })`
nao popula `error` quando a tabela sumiu, entao `user_favorites` apareceu como
existente. E o codigo do PostgREST pra tabela ausente e **`PGRST205`**, nao
`42P01`. Todo script de diagnostico que checa tabela precisa de `select` de
verdade e do codigo certo.

🚨 **A simulacao do dedup depende da 034.** Rodou e morreu em
`findGeoTemporalCandidates`: o SELECT novo pede `corpo`. Entao o portao de
verificacao **nao roda antes da migration** — a fila inteira e uma so, e comeca
nela. Eu tinha dito o contrario no mesmo dia; estava errado.

Junto: `simular-dedup.ts` terminava em `main();` sem `process.exit(0)` — a
armadilha do Redis que ja custou dois timeouts, no script que e justamente o
portao.

---
### 🚦 ONDE PARAMOS — 26/08

**`staging` = `main` = `origin/staging` = `origin/main` = `c4f17e6`.** A
migration **034 rodou** (confirmada no banco) e os dois portoes do dedup
passaram. O codigo esta no GitHub.

⬜ **FALTA SO O `Manual Deploy → Deploy latest commit` no Render** (a `main` nao
tem auto-deploy) e conferir `commit` no `/health`. Ate isso, producao segue
rodando `5654361`, de 17/08.

🚨 **O APK NAO PODE SER BUILDADO ANTES DO DEPLOY — e o teste vai enganar.** Do
que mudou desde o que esta na loja, so `6283cef` toca o app (a folha com
`corpo`); o dedup e 100% backend. Mas a folha so mostra texto proprio em
noticia **NOVA**, gravada pelo backend novo — linha antiga cai no `resumo`, que
e o comportamento atual. Ordem obrigatoria:

```
1. Manual Deploy no Render
2. esperar o scan rodar algumas vezes com o backend novo
3. build-prod.bat  (versao ja esta em 1.2.1+6 no pubspec)
4. testar no A57, device fisico via LAN IP, flutter clean antes
```

Buildar e testar antes do passo 2 mostra a folha identica ao card, e a conclusao
errada e "nao funcionou".

**Os dois portoes, com numero (26/08):**

| portao | resultado |
|---|---|
| `npx tsx scripts/simular-dedup.ts` | **70 noticias → 13 fusoes**, 50 chamadas ao GPT (0,71/noticia). As 13 explicadas uma a uma. **Zero fusao indevida** |
| `npx tsx scripts/test-dedup-gabarito.ts` | **15/16**, zero assimetria. Sai com **exit 1** de proposito — ver abaixo |

⚠️ Era 13/14 mais cedo no mesmo dia. Subiu para 15/16 porque a simulacao achou
**dois clusters reais que a revisao a mao de 24/08 tinha perdido** (a extorsao
da adolescente, com o titulo dizendo "Ubirata" que e a cidade da VITIMA; e a
TERCEIRA linha do confronto de Palhoca — aquele cluster e de tres). Os dois
entraram no gabarito e passam nas duas ordens.

🚨 **A bateria sai vermelha e isso e correto.** O caso que falha e
`5d1a9168/b04c143b` ("chacina" x "operacao contra faccao"): mesmo bairro e dia,
mas **nenhuma ancora aparece nos dois titulos** — nao ha nome de operacao para
reconhecer nem contagem divergente para ignorar. **Nao marcar como
`falhaConhecida` para a bateria ficar verde**; isso seria fraudar o portao. O
erro e para o lado seguro (funde de MENOS: sobra uma linha duplicada), e o
cluster do Rubem Berta funde assim mesmo pelos outros pares.

✅ **O que o dedup novo destravou, medido:** das 13 fusoes, **8 tinham
`tipo_crime` diferente** entre os dois lados e **nunca chegavam a ser
comparadas** — o portao antigo filtrava por tipo. Outras 2 eram as que o prompt
antigo reprovava por ler "cinco x seis presos" como contradicao. **10 das 13
eram invisiveis por construcao.**

⚠️ **O caminho de ESCRITA nunca rodou contra dado real.** A simulacao e
read-only: ela prova a deteccao, nao a fusao (reescrever textos, somar fontes,
regravar embedding). A primeira execucao de verdade sera em producao — por isso
o passo 8 do plano (acompanhar 2-3 dias) e obrigatorio: alvo **zero cluster
novo** e, tao importante quanto, **nenhuma queda estranha no total diario**, que
seria sinal de fusao a mais.

**Dois buracos conhecidos, aceitos, no ROADMAP:** o caso sem ancora comum acima,
e o fato de alcance estadual (a denuncia do MP gravada em duas cidades) — o GPT
acerta esse, o portao de cidade bloqueia antes de perguntar.

⚠️ **Script que importa `pipelineCore` nunca termina sozinho** — o import abre
conexao com o Redis e segura o event loop. Todo script de diagnostico precisa de
`process.exit(0)` explicito. Dois timeouts foram gastos ate eu ler o log em vez
de desconfiar da logica.

⚠️ **Sonda de banco:** o codigo do PostgREST para tabela ausente e **`PGRST205`**
(nao `42P01`), e `select(..., { head: true })` **nao popula `error`** quando a
tabela sumiu — da falso positivo de "existe". Toda sonda precisa de um **caso de
controle** (uma tabela que sabidamente nao existe) antes de confiar no
resultado.

---

### 🎨 Redesign em curso (08/08) — leia antes de mexer no app

Branch **`feature/design-fio`** = **`staging`** = **`main`** desde 16/08. O
release saiu: `1.2.0+5` está na faixa Alpha da Play Store. O redesign **chegou ao
cliente** — o que segue abaixo é histórico das fases, não fila de trabalho.

**Plano completo (fases A-F):** ⚠️ o arquivo de plano foi SOBRESCRITO (slot unico).<br>O que sobreviveu esta no ROADMAP, secao "Redesign fio de agencia".

| fase | o quê | estado |
|---|---|---|
| A | cor de categoria com fonte única | ✅ feito |
| — | **polimento do fio** (tipografia, tinta, header, card) | ✅ feito |
| — | **tema global** em linguagem de fio (era o "pálido") | ✅ feito |
| B | formulário de busca (11 blocos → 5) | ✅ feito |
| C | espera de 7 min + resultados | ✅ feito |
| D | remoções (favoritos, arrastar, lembrar senha, senha mín. 8) | ✅ feito |
| E | relatório (as **duas** telas) | ✅ feito |
| E2 | relatório vira documento HTML A4, servido pelo backend | ✅ feito |
| F | notificações (dois canais, preferência) — migration **032** | ✅ feito |
| — | **revisão de todas as copys** (pedido do João, DEPOIS das fases) | ⬜ **única que falta** |

⚠️ Esta tabela dizia D, E2 e F por fazer **depois das três estarem prontas**, e
apontava a migration da F como 031 (é a **032**; a 031 é o DROP dos favoritos).
Corrigida em 12/08. Tabela de estado que não é corrigida no mesmo turno vira a
segunda verdade que a regra zero da workdesk descreve.

**`staging` = `feature/design-fio` = `47b8cd8`**, ambas empurradas em 09/08.

### 📈 17/08 — o volume mudou de ordem de grandeza

**31 notícias num dia**, contra média histórica de **2,0/dia**. Todo o desenho de
notificação e de dedup foi feito para o número antigo. Um dia não prova padrão —
pode ser o novo normal (o backend de produção só saiu do código de 3 de julho
ontem) ou recuperação de fila. **Vale reconferir em 3-4 dias.**

O que mudou por causa disso, tudo em `staging` (ver entrada de 17/08):

- push **agrupado por rodada**, com a manchete no corpo — 31 pushes viraram 15
- `manifestacao` **congelada**, `greve` virou tipo próprio, regra 2 do Filter2
  ganhou lista negativa (campanha, fórum, alerta meteorológico)
- dedup: prompt **simétrico** (era sensível à ordem) e janela da camada 1 em 3 dias

🚨 **Nada disso está em produção.** O auto-deploy do backend está DESLIGADO no
Render — depois do merge para `main`, é `Manual Deploy → Deploy latest commit` e
conferir o `commit` no `/health`.

✅ **029 e 030 aplicadas** (confirmadas pelo João em 09/08). O banco tem
`news.titulo` e `news.hora_publicacao`, e o staging está inteiro.

⏳ **Ainda não medido:** nenhuma varredura nem busca manual rodou com o prompt
novo. Então o feed segue mostrando manchete **composta** (`Homicídio no
Kobrasol`) e o resumo antigo — o que o João apontou como errado ainda aparece,
não porque falhou, mas porque só vale pra item novo. A primeira busca manual é
o teste de verdade: manchete escrita, resumo de até 190 complementando, e hora
do veículo.

⚠️ **A 030 do plano original era a de notificações — renumerar pra 031.** A hora
de publicação entrou na frente porque era correção de bug em produção de dado.

### 🐛 ACHADO NÃO CORRIGIDO — o relatório do GRUPO mostra só uma cidade

Medido em 09/08 na Grande Florianópolis: o cabeçalho diz **21 EM 30D** e o
relatório abre com **12**. Não é arredondamento — são coisas diferentes.

`getCrimeSummary` (`analyticsQueries.ts:96`) filtra com `.eq('cidade', cidade)`,
uma cidade só. E o `_activeCidade` do `city_detail_screen.dart`, com a aba
`TODAS` selecionada, devolve **a primeira cidade do grupo**. Então o relatório
de um grupo de quatro cidades é o relatório de Florianópolis, e nada na tela
diz isso. Vale para os quatro endpoints: `crime-summary`, `crime-trend`,
`news-sources` e `map-points`.

Conserto: aceitar `cidades` (lista) e trocar `.eq` por `.in` nas quatro
consultas — aditivo e retrocompatível. O app já sabe fazer isso no feed
(`FeedScreen(citiesFilter:)`); só a analytics não sabe.


### O que falta na Fase E (o export)

- o botão `COMPARTILHAR RELATÓRIO` ainda **manda um link de texto** para o
  admin-panel (`generateReport` → `reportUrl`). O que falta é o documento:
  HTML autocontido, arquivo único, fontes em base64, **tema claro** (o app é
  escuro, o documento não), imprimível em A4, marca do cliente numa variável só
  (`--marca`) e o aviso de cobertura no rodapé — quem recebe nunca viu a tela.
- candidato a mandar pra instância da web (ela não precisa do repo). O briefing
  **precisa** levar os cinco hexes validados, senão volta Tailwind: `#DA4358`
  segurança, `#B39026` patrimonial, `#1F98AB` operacional, `#8F62CB` fraude,
  `#4E8F45` institucional.
- `news_detail_sheet.dart` **não morre** (decisão do João em 09/08) — saiu da
  lista de remoções da Fase D.

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
| local + staging | `staging` | ✅ no ar |
| **produção** | `main` = `staging` desde **16/08** (`e0d3fed`) | ✅ **alinhadas.** A divergência acabou — ver a entrada de 16/08 (5) |
| Play Store | `1.2.0+5`, faixa **Teste fechado — Alpha** | ✅ publicado em 16/08 |

A `main` tinha **11 commits** que a `staging` nunca viu, e eles carregavam o
`applicationId` publicado, a config de assinatura, as duas páginas exigidas pelo
Google e quatro fixes de produção. Foram trazidos **à mão**, um a um, e a
ancestralidade registrada com `merge -s ours` — nada foi perdido dos dois lados.
**Se as branches divergirem de novo, repetir esse método, não mergear.**

🚨 **O auto-deploy do backend de produção está DESLIGADO no Render.** Empurrar
para `main` não sobe nada: tem que clicar `Manual Deploy` e conferir o `commit`
no `/health`. Só o backend — o painel admin sobe sozinho.

Migrations **025 a 033 todas aplicadas** e verificadas no catálogo do Postgres.
Pendentes e **opcionais**: 021, 023, 024. Custo do mês: **$1,75 de $100**.

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

## 2026-08-14 (noite, 2) — Nova consulta: o formulário para de se explicar

O João, olhando a tela no A57: *"Muitos disclaimers, tira todos. Linguagem zoada
também. Muito confusa, ux estranha. Palavra chave deve ser acessível e não ficar
escondida."* Depois: *"sobre esse essencial e completa eu tô achando estranho…
deixamos só 'busca personalizada' onde fica as categorias"*, *"sempre faz busca
completa"*, *"palavra chave podemos colocar a opção de buscar somente a palavra
chave"*.

### O que a captura mostrava, e o código confirmou

🚨 **O `INICIAR CONSULTA` não aparecia na tela**, e o número da estimativa estava
cortado ao meio pelos três botões do Android. Duas falhas somadas: `ListView` com
40px de padding inferior dentro de um `SafeArea(bottom: false)` **sem
`bottomNavigationBar`**. Abaixo da dobra *e* atrás da barra do sistema. **A folha
de assuntos tinha o mesmo defeito** — o `USAR ESTES` cortado igual.

O resto do "ux estranha" tinha nome: o campo montava `Row[ Expanded(valor),
rotulo ]`, então lia-se `Escolher estado … UF` — **rótulo à direita, valor à
esquerda**, sem seta, sem caixa. Um filete sob texto cinza parece legenda.

### Três caminhos pro mesmo campo

O redesenho de 09/08 tinha percebido metade: tirou o `ESCOLHER` da fila dos
cartões porque *"botão que se parece com os vizinhos mas faz outra coisa é
armadilha"*. Mas continuaram **três** caminhos — `Essencial`, `Completa` e a
porta. Agora há **um**: `Busca personalizada`, cujo estado inicial é o catálogo
inteiro. O que era `Essencial` deixou de existir e o que era `Completa` virou o
padrão.

O rótulo da seção passou a ser **a própria contagem** (`17 ASSUNTOS`), em verde
do OPS, porque é o número que se move com a escolha. Ao lado, um `?` abre a lista
**só de leitura**.

⚠️ **Informar e editar viraram peças separadas** (`FolhaOsAssuntos` ×
`FolhaAssuntos`). Era exatamente a confusão que fazia a porta parecer preset.

### O que "sempre completa" custa — medido antes de decidir

| | 30 dias | 180 dias |
|---|---|---|
| antes (5 assuntos) | ~3 min | ~7 min |
| **agora (17)** | **~10 min** | **~25 min** |

Tempo é proxy de custo: cada assunto é uma pergunta a mais ao buscador, e o que
ela traz passa por Jina e por dois estágios de GPT. **~3,4× por consulta.** Dito
ao João com o número na frente; decisão dele.

### Duas travas que só apareceram porque eu fui ao backend

- 🚨 **Lista vazia não pode sair.** `buildManualSearchQueries`
  (`queryTemplates.ts:146`) faz `assuntos.length > 0 ? assuntos : getAssuntos()`
  — mandar vazio faz o backend buscar **a lista padrão inteira, calado**, que é o
  oposto do que o "buscar só palavra-chave" promete. O modo só liga com palavra
  na lista e **se desliga sozinho** quando a última sai.
- 🚨 **O teto é 20.** `assuntos: z.array(...).min(1).max(20)`
  (`validation.ts:157`). Com o padrão em 17, a **4ª palavra-chave** estoura e a
  consulta toma 400 — algo que quase nunca acontecia com o padrão em 5. O
  `ADICIONAR` recusa e explica, em vez de deixar a busca falhar depois do toque.

### Um defeito que eu mesmo criei e peguei antes de subir

Ao exigir `n > 0` pro botão, **tranquei a busca quando o catálogo não carrega**:
sem rede, `n` é 0 pra sempre. Antes disso a busca funcionava — o app manda a lista
vazia, `triggerManualSearch` omite o campo e o backend cai na lista do painel.
Agora a barra mostra `LISTA PADRÃO` e o botão continua vivo. **Defeito de rede não
pode virar tela travada.**

### Vocabulário: o erro que o João pegou no plano

Eu tinha escrito o toggle como *"Buscar só estas palavras"*. Ele: *"não, muito
ruim kkk que merda. Buscar só palavra chave sim"*. E está certo — a seção logo
acima se chama `PALAVRA-CHAVE`, e eu inventei um sinônimo **uma linha abaixo do
termo**. É a doença de vocabulário do app inteiro, em miniatura.

**Regra que fica:** o controle usa o termo do campo que ele controla, sem
sinônimo. Os rótulos viraram palavras comuns — `LOCAL`, `ASSUNTOS`, `PERÍODO` no
lugar de `ONDE`, `O QUE PERGUNTAR`, `DESDE QUANDO`.

### Os quatro parágrafos, e onde os fatos foram parar

| texto | destino |
|---|---|
| "A região metropolitana vem junto…" | virou **parte do valor**: `Florianópolis + região` |
| `_descricao` ("Crime comum: roubo e furto…") | virou o `?` |
| `ESTIMATIVA, NÃO GARANTIA` | o `~` de `~10 min` já diz |
| "Consulta longa. Pode fechar o app…" | **duplicata** — a tela de espera já diz `PODE FECHAR O APP`, e lá é acionável |
| `UMA CIDADE · REGIÃO INCLUSA` (masthead) | mesma informação do campo, dita em slug de 9px |

Zero parágrafo na tela, zero informação perdida.

### E o período virou um controle só

`Escolher data exata … OU DATA EXATA` era uma linha separada, com rótulo à
direita e mecânica própria, pro **mesmo campo** dos cinco retângulos. Virou o
**sexto retângulo** da fileira: a posição diz o que o rótulo dizia.

---

## 2026-08-14 (noite) — o documento aprende a ser lido no celular

Consequência direta da reversão do PDF: o botão passou a compartilhar **link**, e
o documento estreou no celular — onde quase nunca tinha sido aberto, porque até
ontem o plano era virar arquivo. O João, no A57: *"a margem tá zoada"*,
*"Distribuição de categoria todo quebrado"*, *"mapa de ocorrências quebrado"*.

E o diagnóstico dele foi o certo: *"olha como tá o relatório do MAIN, lá tava
funcionando TOP"*.

### Ele tinha razão, e dá pra medir

A página que isto substituiu (`origin/main:admin-panel/src/app/report/[id]/page.tsx`)
usava `sm:p-6`, `lg:p-10`, `lg:grid-cols-2`, `sm:flex-row`. E Tailwind é
**mobile-first por construção**: os cinco componentes de gráfico funcionavam com
**zero** breakpoints porque nasciam fluidos.

🚨 **A folha nova é o oposto: nasceu A4 e corrige pra baixo.** `estilo.ts` não
tinha **um único** `@media (max-width)` — só `@media print`. A ordem está
invertida em relação a como se faz hoje, e este commit é o pagamento mínimo, não
a quitação.

### Três sintomas, uma causa

`* { box-sizing: border-box }`, e `.folha { max-width: 178mm; padding: …14mm }` dá
**150mm de conteúdo (~567px)**. Num aparelho de 412px, tudo que era coluna fixa
estourava: `.duas` (62mm 1fr), `.recorte` (40mm 1fr), `.indicadores` e `.fontes`
em duas colunas sempre.

⚠️ **O `730%` da tabela nunca foi número errado.** Era `7` e `30%` com a coluna
colada pelo aperto — 7+11+4+1 = 23 e 30+48+17+4 = 99%. **O dado estava certo, e
o layout fez o cliente duvidar do número em vez do CSS.** É o pior tipo de bug
visual: ele desacredita o produto, não a folha de estilo.

### O mapa estava errado nas DUAS direções, desde sempre

`mapaImpresso` montava o quadro com `L = 635px` (168mm) — o comentário dizia
"168mm × 105mm na folha". Mas a folha tem **150mm** de conteúdo. Eram 68px a mais,
e `.mapa { overflow: hidden }` comia **11% do mapa em qualquer tela**, calado. No
desktop sumia margem vazia e ninguém notou por dois dias.

No celular a caixa cai pra ~376px e sumiam **40%**: a captura do João mostrava
Santo Amaro da Imperatriz e mato porque aquilo era a **borda oeste** de um quadro
que cobre a região inteira, com Florianópolis, São José e Palhoça cortadas fora
da tela. Não era enquadramento ruim — era recorte.

E na impressão o erro invertia: a A4 dá 184mm de conteúdo e o mapa usava 168mm.

**Solução: o mapa não tem mais nenhuma medida absoluta.** `aspect-ratio: 635/397`
e **todas** as coordenadas em % — tiles em % da camada, pinos em % do quadro. Sem
breakpoint: vale pra qualquer largura, incluindo a folha impressa, que agora usa
os 184mm inteiros.

⚠️ **O tamanho do pino continua em px**, e é a mesma regra do raio-zero levada ao
fim: *onde* o pino está é relativo ao mapa, *quanto* ele mede não é. Se encolhesse
junto, num telefone dois vizinhos deixariam de ser legíveis como dois.

`L` e `A` deixaram de ser "o tamanho na folha" e passaram a ser a **proporção do
quadro** e a referência de zoom do `enquadrar`. A crença errada estava no
comentário, e era ela que cortava o mapa.

### A chave crua do banco no documento do cliente

`secaoCategorias` emitia `esc(t.tipo_crime)` — o documento imprimia `roubo_furto`,
`lesao_corporal`, `trafico`, com underline. O app traduz isso desde sempre
(`crime_labels.dart`); o backend **não tinha** mapa equivalente. `formatTipoCrime`
(pushService) tem nome enganoso: devolve o rótulo da **categoria**.

Entrou `TIPO_CRIME_LABEL` em `utils/types.ts`, colado no `TIPO_CRIME_GRUPO` que já
morava lá com a mesma forma.

⚠️ **Não dá pra derivar de `ASSUNTOS_CATALOGO`**: lá a relação é N:1 de propósito
— `lesao_corporal` é "Violência doméstica" **e** "Agressão", porque são perguntas
diferentes ao Google que classificam no mesmo tipo. Derivar dali escolheria uma
das duas por ordem de array.

**`roubo_furto` passa a se chamar "Roubo"** (pedido do João), nos três lugares que
exibem rótulo. 🚨 **A chave não muda** — nada de migration, de prompt do Filter2
ou de linha regravada. Fica registrado que o rótulo chama de roubo um tipo que
também contém furto: crimes distintos (com e sem violência), e quem vai reparar é
um leitor que faça a distinção jurídica. Foi dito ao João e aceito.

Dívida anotada: a tabela de rótulos existe em **três cópias** (backend,
`crime_labels.dart`, painel admin). `GET /settings/taxonomia`, que o app já
consome, é o caminho pra unificar.

### O disclaimer estava em outra voz

*"Este documento mede o que a imprensa publicou, não o que a polícia registrou…"*
— mesma informação da tela, registro diferente: **o app afirma, o documento
explicava**. Agora abre com a frase que a tela já usa, literal, e segue no mesmo
compasso curto. O glossário do produto inteiro fica pra depois, por decisão do
João.

### A armadilha que o próprio arquivo avisa, e eu caí

`estilo.ts` é um template literal, e tem escrito nele: *"crase dentro do CSS fecha
a string"*. Escrevi o comentário do bloco novo com `` `Nº` ``, `` `%` `` e
`` `screen and` `` entre crases e quebrei o arquivo — 8 erros de sintaxe de uma
vez. **O aviso estava 180 linhas acima do lugar onde eu estava editando.**

### Medido no documento renderizado

| | |
|---|---|
| altura fixa inline no mapa | 0 |
| tiles em px / em % | 0 / 9 |
| pinos em px / em % | 0 / 20 |
| `@media screen and (max-width` | 1 |
| `@media (max-width` **sem** `screen` | **0** — é o que impede a impressão de herdar o layout de celular |
| chave crua (`roubo_furto` etc.) no HTML | nenhuma |

⚠️ Detalhe que só a conta pega: `.barras`/`.eixo` são flex, e item flex **não
encolhe abaixo do próprio conteúdo** por padrão. Com 14 baldes de 5 caracteres a
régua pede ~390px num corpo de 328 — daí o `min-width: 0`, que autoriza a coluna a
apertar em vez de empurrar a página inteira.

---

## 2026-08-14 — o PDF no aparelho foi revertido: 90s não é uma opção

**Desfecho do spike: reprovado.** Não por não funcionar — por demorar.

O log do A57, textual: `TimeoutException after 0:01:30.000000`. A WebView
carrega, a conversão começa, e **não termina em 90 segundos**. Os três defeitos
consertados ontem eram reais e o caminho passou a ser exercitado de verdade; o
que apareceu embaixo deles foi o custo.

### De onde vem o tempo — medido, não estimado

| | |
|---|---|
| documento inteiro | 906 KB |
| **12 tiles do mapa em `@2x`** | **797 KB — 88% do peso** |
| 2 fontes embutidas | 86 KB |
| todo o resto (texto, tabelas, gráficos SVG) | 22 KB |

**O documento é um mapa com um relatório em volta.** 20 pinos, 12 tiles.

🚨 **E a lição não é "otimizar o mapa".** Tirar o `@2x` derrubaria pra ~310 KB,
e talvez a conversão coubesse em 30s — só que **30 segundos de spinner para uma
ação que o usuário espera ser instantânea continua sendo o produto errado**.
Otimizar aqui seria consertar o número sem consertar a experiência.

### O que ficou

O botão voltou a compartilhar o **link**, que chega em ~1s. Quem quer o arquivo
aperta **Baixar PDF** dentro da página — que no Android abre o diálogo nativo de
impressão: **a mesma engine**, mas com barra de progresso do sistema e botão de
cancelar, em vez de um spinner do app sem previsão nenhuma. O sistema operacional
já resolve isso melhor do que eu ia resolver.

Saíram `printing`, `pdf` e 5 dependências transitivas do pubspec.

### O que NÃO mudou, e por quê

O João propôs devolver a página pro **painel admin**. Discordei, e ele derrubou
metade do meu argumento na hora — eu disse que o painel dorme, e **produção é
Starter nos dois serviços** ($7 cada); quem dorme é o staging. Estava errado.

O que sobrou de pé, e bastou: a página do painel foi **apagada** na Fase E2, e
voltar pra lá é reconstruir um **segundo renderizador do mesmo documento** — foi
exatamente ali que morou o `cidade: cidades.first`, com o texto do
compartilhamento dizendo "Florianópolis, São José e Palhoça" enquanto a página
entregava Florianópolis sozinha. E não havia o que ganhar: a página do backend
**já é** link que abre em qualquer lugar, com "Baixar PDF" dentro, no desenho
aprovado, e com uma URL igualmente feia.

### O que sobreviveu do trabalho descartado

- **`?formato=pdf`** continua na rota — autocontida, custo zero quando ninguém
  pede, e é o ponto de partida pronto se o PDF voltar ou se o documento precisar
  ser gerado fora do navegador. Marcada no código como não-chamada.
- **As fontes embutidas** e o **embutimento de tiles** ficam com ela.
- O `resolverCidades` e o botão do auto-scan eram consertos independentes e
  **continuam valendo** — o 500 acabou, e o relatório do monitoramento agora sai
  da tela.

⚠️ **Para quem for tentar de novo:** as três armadilhas estão mapeadas no dia
13-14/08 — `canConvertHtml` é sempre `false` no Android (a flag mente, a
capacidade existe), não há timeout em lugar nenhum do plugin, e `onPageFinished`
não espera a rede. Nenhuma delas é o problema. **O problema é o tamanho.**

---

## 2026-08-13 (noite, terceiro round) — "montando o documento" para sempre

O João apertou o botão e a tela ficou em **MONTANDO O DOCUMENTO… indefinidamente**.

### O defeito meu: um `await` sem timeout

**Não existe timeout em lugar nenhum deste caminho.** Do lado Android,
`PrintingJob.convertHtml` só reage a `onPageFinished`; `PdfConvert.print` só
trata `onLayoutFinished` — **nem `onLayoutFailed`, nem `onLayoutCancelled`**. Se
a WebView engasga, ninguém chama de volta e o `await` fica pendurado.

O logcat mostrou a WebView **criada às 19:44:23 e destruída às 19:45:08**, sem
nenhum retorno no meio. Ou seja: o guard corrigido funcionou (a conversão foi
tentada de verdade, pela primeira vez), e o que falta é ela terminar.

Agora tem `.timeout(90s)`, e estourar cai no link como qualquer outra falha.
**Botão que trava para sempre é pior que botão que falha** — o usuário não tem
nem o que tentar de novo. 90s porque o A57 é o piso do parque e o documento
carrega os tiles do mapa embutidos.

### As fontes: de "decisão do João" para caminho crítico

Medido no documento real (`?formato=pdf`, relatório de Porto Alegre):
**840 KB e três URLs de `fonts.googleapis.com`/`gstatic` ainda no `<head>`.**

Como o Android converte em `onPageFinished`, que não espera a rede, essas três
URLs eram duas coisas ao mesmo tempo: a tipografia virando **cara ou coroa** e um
candidato plausível a causa do próprio travamento.

Embutidas. E o custo real ficou **muito** abaixo do que eu tinha estimado:

| | estimado | real |
|---|---|---|
| fontes em base64 | ~300 KB | **88 KB** |

O que explica a diferença: as duas são **fontes variáveis** (um arquivo cobre
todos os pesos) e só o subconjunto **latin** importa — todo acento do português
vive em U+0000-00FF. O CSS do Google entrega até 6 subconjuntos por família
(vietnamese, cyrillic, greek, latin-ext), e copiar tudo era o caro.

`font-display: block` no bloco embutido, o oposto do `swap` do Google: aqui não
há espera de rede pra disfarçar, e o que importa é o texto **nunca** ser pintado
com a fonte errada.

⚠️ **Só a variante de impressão muda.** No navegador o `<link>` continua — ali a
página repinta quando a fonte chega, e o cache do Google é melhor que 88 KB em
toda visita.

Licença conferida: as duas são **OFL 1.1**, redistribuir embutido é permitido.

### Medição final das duas variantes

| variante | tamanho | URLs externas |
|---|---|---|
| navegador | 23 KB | fontes + tiles do CartoDB |
| `formato=pdf` | **928 KB** | **nenhuma** |

⚠️ 928 KB é muito HTML pra uma WebView engolir, e segue sendo o suspeito nº 1 se
o timeout de 90s estourar. Os tiles do mapa são quase tudo. Se estourar, as
alavancas na ordem: tile sem `@2x` (4x menor, mais borrado no papel) e depois
reencodar em JPEG (dependência nova — deixar por último).

### Uma ferramenta que faltava o tempo todo

O `npm run dev` rodava no terminal do João, e em dev o winston **só escreve no
console** (`logger.ts:25` — os transports de arquivo são condicionados a
`nodeEnv === 'production'`). Resultado: durante toda a caçada ao 500 eu não tinha
como ler o erro do servidor, e reconstruí o caminho na mão com script.

O dev server agora roda sob a sessão, com o log legível. O que achou os dois
defeitos anteriores em minutos foi o `adb logcat` — a mesma ideia, do outro lado.

---

## 2026-08-13 (noite, depois) — o botão nunca tinha funcionado, por dois motivos empilhados

O João apertou COMPARTILHAR RELATÓRIO e recebeu *"Não foi possível montar o
relatório"*. Investigado pelo **logcat do aparelho**, não por leitura de código —
foi o que deu as duas respostas em minutos.

### Defeito 1 — 500 no POST: o app fala dois dialetos com o mesmo backend

`ApiException(500): Failed to generate report`.

`resolverCidades` é compartilhada entre as rotas GET e as POST, e foi escrita só
pro formato das GET (`?cidades=A,B,C`). Nos POST o campo chega como **array
JSON**, porque o schema declara `z.array(z.string())`. `.split()` num array
levanta `q.cidades.split is not a function`, o `try` da rota engole, 500.

🚨 **Por que passou por três verificações:**

1. o tipo dizia `cidades?: string` e o call site passa `req.body`, que é `any` —
   o TypeScript não tinha o que conferir;
2. testei a **validação** contra o schema (passa) e o **documento** pela rota
   GET, com a linha gravada direto no banco pelo `createReport`. Testei as duas
   pontas e não o meio: **o POST nunca rodou de ponta a ponta**;
3. `map-points`, o outro POST, manda `cidades.join(',')` — string dentro do
   corpo. Por isso o mapa sempre funcionou, e por isso a hipótese "o POST está
   ok, o app manda certo" parecia confirmada.

### Defeito 2 — o guard perguntava pra uma flag que mente

Com o 500 resolvido, o log seguinte:
`[Documento] plataforma sem suporte (convertHtml=false, share=true)`.

O `printingInfo()` do lado **Android** do `printing` (5.14.3,
`PrintingJob.java:81`) devolve `directPrint`, `dynamicLayout`, `canPrint`,
`canShare` e `canRaster` — e **nunca** `canConvertHtml`. Do lado Dart,
`PrintingInfo.fromMap` faz `map['canConvertHtml'] ?? false`.

**Logo: em todo aparelho Android a flag é `false`, sempre.** O guard
`if (!info.canConvertHtml)` desligava o PDF em 100% dos aparelhos — a feature
nunca teve chance de rodar uma vez.

E `convertHtml` **está implementado** no Android, no mesmo pacote:
`PrintingHandler.java:61` → `PrintingJob.convertHtml`, com `WebView` de verdade,
`loadDataWithBaseURL` e `onPageFinished`. A capacidade existe; quem mente é a
descrição dela.

A lição, que vale além deste caso: **capability flag é declaração, não medição.**
Onde existe a chance de tentar e falhar barato, tentar é a prova melhor — e aqui
já havia `try/catch` + checagem de bytes vazios cobrindo a queda.

### O que isso revelou de sério sobre as fontes

Lendo o `convertHtml` do Android para entender o defeito 2, apareceu o desenho da
conversão: `onPageFinished` → `createPrintDocumentAdapter`. Esse evento dispara
quando o **documento principal** terminou — **sem esperar o que ainda está vindo
pela rede**.

O `<head>` do relatório ainda tem o `<link>` do Google Fonts, sem condicional
(`html.ts:596-598`). Os tiles do mapa foram embutidos na Fase E2; as fontes não.
Com `display=swap`, o texto pinta na hora com fonte de sistema e troca quando a
fonte chega — e o retrato pode sair antes.

⚠️ Isso não é "pode falhar", é **cara ou coroa**: a versão intermitente passa no
teste de hoje e falha no aparelho do cliente. Embutir Archivo e JetBrains Mono em
base64 deixou de ser opcional. Custo: ~300KB de binário no repositório do
backend, porque o app usa o pacote `google_fonts`, que baixa em runtime e não
deixa arquivo pra reaproveitar. As duas são OFL — redistribuir é permitido.

**Pendente, aguardando o João.**

### O que já ficou provado no caminho

- o POST gera relatório de verdade (o link compartilhado trouxe um `reportId`
  real, `4d798cd5-…`);
- o **plano B funciona como desenhado** — avisou por snackbar e entregou o link
  em vez de morrer. Foi o comportamento correto diante de um defeito meu.

---

## 2026-08-13 (noite) — o relatório do monitoramento também sai da tela

O pedido do João, textual: *"tem que ter compartilhar relatório nos relatórios do
auto scan tbm, tem que seguir o filtro de periodo"*. A consulta manual ganhou o
botão na Fase E2; o relatório do **monitoramento** — que é o que o cliente abre
todo dia — não tinha como sair do aparelho.

### O que travava: o recorte era obrigatório demais

`RecorteDeclarado` exigia `antigas`, `regiao` e `categorias`. **Essas três coisas
não existem na tela do monitoramento**, que só tem seletor de período. Pra o
botão funcionar, o app teria que inventar valores — e a capa imprimiria
*"Municípios vizinhos: fora da contagem"* num documento onde ninguém excluiu
vizinho nenhum, porque o conceito não está lá.

Ruído que parece informação é pior que campo ausente: quem lê conclui que alguém
tomou uma decisão que nunca foi tomada.

Os três viraram opcionais, e `linhasDoRecorte` passou a **imprimir só o que
veio**. Entrou também `origem: 'monitoramento' | 'consulta'`, e ela vai **antes**
do período na capa, de propósito: "30 dias de varredura contínua" e "30 dias de
uma consulta pontual" são coberturas diferentes do mesmo intervalo, e o leitor
não tem como inferir isso dos números.

### O que a prova mostrou (schema real + render real, não leitura de código)

| caso | capa |
|---|---|
| monitoramento | Origem · Período · Gerado em |
| consulta | Origem · Período · Categorias · Vizinhos · Anteriores · Gerado em |
| **legado** (salvo antes desta mudança) | Período · Categorias · Vizinhos · Anteriores · Gerado em |
| `origem: 'chute'` | recusado — `Invalid enum value` |

A terceira linha é a que quase passou batido, e virou obrigatória por causa da
**033**: relatório não expira mais, então linha de `reports` gravada semanas
atrás continua sendo aberta por link. Se o render assumisse `origem`, todos eles
quebrariam de uma vez, em silêncio.

### O botão, e as duas diferenças de propósito

Mesmo texto, mesmo lugar, mesma peça (`DocumentoDeRisco`). Mas:

1. **não manda `analytics`.** A consulta manual tem os itens em memória e conta
   na tela; aqui a tela recebeu números **já agregados pelo backend** e
   reempacotá-los seria transportar cópia de um dado que o servidor tem de
   primeira mão. Sem `analytics`, o backend consulta o banco — o caminho que a
   Fase E2 já tinha deixado pronto pro painel admin, agora com segundo usuário.
2. **o recorte é só `dias` + origem.**

O par que alimenta o documento é `_cidadesDoRelatorio` + `_relatorioRangeDays`,
que é **exatamente** o que alimenta as quatro rotas da tela. Qualquer outra conta
aqui recriaria a divergência que o `TUDO` já causou uma vez — cabeçalho dizendo
21, corpo dizendo 12.

O botão **some** quando a cidade não tem `parentState`: sem estado o documento
sai sem mapa e sem indicadores. Botão que não pode funcionar é pior que botão
ausente.

### Dois textos que tinham envelhecido

Na consulta manual, o comentário de `_publicar()` ainda explicava *"por que link
e não arquivo"* — e a linha embaixo do botão prometia *"vira PDF pelo botão
Baixar PDF de dentro da página"*. As duas descreviam o desenho de **anteontem**,
e sobreviveram à mudança que as tornou falsas porque ninguém releu o texto ao
lado do código que mexeu. É a REGRA ZERO da workdesk acontecendo dentro do
código-fonte.

### Sobrou também

`share_plus` estava importado sem uso em `relatorio_de_risco.dart` — resto do
caminho do link, que mudou de casa pro `DocumentoDeRisco`. `flutter analyze`
voltou ao baseline (1 info em `type_helpers.dart`).

---

## 2026-08-13 — o relatório vira PDF no aparelho (spike em curso) + a tela de alerta enxuga

### 🚧 ESTADO: o spike do PDF está NO APARELHO, esperando o teste do João

Se esta entrada ainda estiver assim, **o teste não foi feito**. O que ele
responde, em ordem:

1. a folha do Android abre com **arquivo** (aparece Drive / "Salvar em Arquivos")?
2. o PDF tem **mapa**?
3. a tipografia é Archivo/JetBrains ou virou fonte de sistema?

APK de **dev** instalado no A57 (`--dart-define-from-file=env/dev.json`),
apontando pro backend local por LAN. O backend precisa estar rodando.

### Por que o link deixou de ser a entrega

Dois argumentos do João, ambos certos:

- **"o link tá foda de resolver"** — e é verdade: o link arrasta junto o
  domínio (o de hoje é subdomínio do Render), a expiração e a dependência de o
  servidor estar acordado. **Se o que viaja é arquivo, nada disso existe.**
- **"clica em compartilhar, abre o próprio sistema do Android ou iPhone para
  enviar para alguém ou só baixar"** — e *"só baixar"* **não aparecia**: a
  folha estava compartilhando texto, e `Salvar em Arquivos` / Drive só surge
  quando o que se compartilha é arquivo.

### O que foi descartado, com o motivo

| | por que não |
|---|---|
| redesenhar o relatório em Dart (pacote `pdf`) | dois desenhos do mesmo documento, pra sempre — e o João aprovou **aquele** documento |
| Chromium (Puppeteer) no backend atual | mora na mesma caixa do CRON 24/7, pico ~250MB em 512MB: OOM não derruba o relatório, derruba o monitoramento |
| serviço separado de PDF no Render | resolve, mas +$7/mês, e o caminho de graça ainda não foi descartado |
| anexo `.html` | Drive mostra o **código-fonte**; e-mail corporativo trata como phishing |

### O que foi construído

**Backend — `GET /public/report/:id?formato=pdf`.** O *mesmo* renderizador com
um parâmetro; duas funções seria o começo de dois documentos.

- `embutirTiles()` em `mapa.ts` — os tiles viram `data:` URI, com cache por
  `z/x/y` (relatórios da mesma cidade pedem os mesmos). Falha de um tile deixa
  **um quadrado vazio**, não derruba o mapa.
- a barra de ações **não é emitida**, em vez de ficar escondida por
  `@media print` — depender disso seria apostar que a WebView aplica print
  styles.
- 🚨 O motivo de tudo isso: a WebView tira a foto **antes** de as imagens da
  rede chegarem, e o mapa sairia branco, calado. É a armadilha do html2canvas
  que a Fase E2 removeu, entrando por outra porta.

**Medido em 13/08:** 31 KB (web) → **271 KB** (PDF). Muito abaixo dos 1-3 MB
que eu tinha estimado no plano.

**App — `core/services/documento_de_risco.dart`**, peça compartilhada pelas duas
telas de relatório. `printing` **travado em 5.14.3, sem `^`**.

⚠️ **Não é a 5.15.0**: ela puxa `pdf` 3.13 → `xml ^7`, e o
`flutter_local_notifications` 20 puxa `xml ^6`. O conflito vem por
`flutter_local_notifications_WINDOWS` — pacote de Windows, num app que só roda
Android. A outra saída que o pub sugere é subir o local_notifications de 20 pra
22: **dois majors no pacote de push recém-reescrito na Fase F**. Não vale.

O caminho: `generateReport` → `GET ?formato=pdf` → `convertHtml` → `sharePdf`.
**Toda falha cai no link** — plataforma sem suporte (`Printing.info()`),
exceção, PDF vazio. O botão nunca morre, e a tela **diz** quando caiu, em vez
de entregar um link calado no lugar de um arquivo.

🚨 `convertHtml` está **depreciado** (5.12.0), e ainda presente na 5.14.3.
Verificado no changelog antes de virar recomendação.

### A tela de alerta, enxugada até o osso

Pedido do João olhando o aparelho: *"É toggle on off - tudo, cidade 1 on off,
cidade 2, cidade 3. Só isso."*

Saíram os **5 assuntos**, a chave de **balanços** e o parágrafo sobre os canais
URGENTE/ROTINA. O backend continua sabendo filtrar por categoria
(`querReceber`); o app só não manda mais essa preferência, e `null` = todas.
Nada quebra, e o dia em que a escolha voltar, o outro lado está pronto.

**E os grupos deixaram de se separar.** *"Os grupos nunca se separam"* — a lista
vinha de `getLocations()` e quebrava a Grande Florianópolis em três linhas. A
fonte virou `getCitiesOverview()`, **a mesma do dashboard**: a unidade que a
pessoa enxerga é a unidade que ela configura. Um interruptor por lugar; por
baixo, grava os municípios membros, porque o filtro do backend compara com
`news.cidade`, que é sempre município.

`_lugarLigado` usa **`any`, não `every`**: grupo com estado pela metade (APK
antigo, preferência gravada antes) aparece ligado. Mostrar desligado enquanto
chega notificação é a pior mentira que uma tela de alerta pode contar.

### 🚨 Defeito real achado pela foto do aparelho

A tela dizia *"Não foi possível carregar as cidades e os assuntos"*. **Não era
o deploy faltando.** As três cargas estavam num `try` só, em sequência, com
`getPreferenciasDeAlerta` no meio — e como a tabela `user_notification_prefs`
ainda não existe (032 escrita, não rodada), ela falhava e **derrubava a lista de
cidades junto**, que não tem nada a ver com ela.

Agora cada falha custa só o que ela é: preferência que falha cai no padrão
(tudo ligado, que é o comportamento de quem nunca abriu a tela), e só cidade
que falha é falha de verdade.

### Miudezas do mesmo dia

- **O `?` do monitoramento virou círculo.** Solto, era lido como sujeira de
  renderização — nada dizia que era botão. Mesma exceção dos pinos do mapa:
  raio zero é regra de **caixa**, e aquilo é uma marca.
- **Um botão só no relatório.** Eu tinha partido em ABRIR / ENVIAR sem ninguém
  pedir; o João pediu duas vezes a mesma coisa. Divisão que o usuário não
  precisa fazer é decisão que a tela empurra pra ele.
- **`env/dev.json` estava com IP velho** (`192.168.11.5`; a máquina está em
  `192.168.15.175`). É a armadilha que a própria CLAUDE.md avisa, e ela faz o
  app parecer quebrado sem estar.

### Pendente

- ⬜ **o teste do spike no A57** — é o que decide tudo
- ⬜ fontes embutidas em base64 (Archivo e JetBrains são OFL) — **só se o teste
  mostrar que a WebView não carregou o `<link>` do Google**
- ⬜ **botão COMPARTILHAR RELATÓRIO no auto-scan**, seguindo o filtro de
  período. A tela já tem tudo: `_cidadesDoRelatorio` (resolve grupo e
  sub-cidade) e `_relatorioRangeDays`. **Não manda `analytics`** — o backend
  consulta o banco sozinho, que é o caminho que a Fase E2 deixou pronto
- ⬜ `RecorteDeclarado` com `antigas`/`regiao`/`categorias` **opcionais** e um
  campo de origem: o auto-scan não tem esses conceitos, e imprimir
  "Municípios vizinhos: fora da contagem" num relatório de monitoramento é
  ruído que parece informação
- ⬜ **merge em `staging`** — segue pendente, e sem ele o relatório volta 400
  (`cidade: Required`)
- ⬜ a tela de **Nova consulta** precisa de reforma (pedido do João, 13/08); no
  print, o `3 min` do rodapé está sendo cortado pela barra de navegação

## 2026-08-12 — Fase E2: o relatório vira documento, e sai de dentro do painel

Pedido do João: *"o relatório ao clicar em compartilhar vai abrir em HTML, com
opção de baixar em PDF. Vamos caprichar nesse HTML, ele pode chegar NO SUPER
CLIENTE, o cliente que paga o cliente que paga o cliente que me paga. É pra
apresentação."*

### O que existia, e por que não servia

O botão compartilhava **um texto com um link**. O link abria
`admin-panel/src/app/report/[id]/page.tsx` — uma página shadcn genérica,
`rounded-xl`, "Análise de Risco Criminal", zero SIMEops. E ela morava **dentro
do painel admin**: um link de cliente dependia de um serviço administrativo
estar acordado (no staging, free tier, ele dorme ~50s).

Três defeitos estavam no caminho, e os três eram a mesma forma: **parte da tela
obedecia, parte não.**

1. **`cidade: widget.cidades.first`.** O texto do compartilhamento escrevia
   *"Florianópolis, São José e Palhoça"* e o documento entregava Florianópolis
   sozinha. Calado. As queries por baixo (`getCrimeSummary`, `getCrimeTrend`,
   `getNewsSources`, `getMapPointsRaw`) **já aceitavam `string | string[]`**
   desde sempre — só o app e o schema não sabiam.
2. **O recorte não viajava.** A tela é um re-fatiamento client-side (período,
   categoria, "+ antigas", "+ região") e o backend **reconsultava do zero**,
   ignorando os quatro. No caminho de busca manual era pior: usava
   `getSearchResultsAnalytics(searchId)`, que ignora até as datas.
3. **`expires_at` de 30 dias.** Nada apaga linha de `reports` — o prazo só fazia
   `getReport()` recusar a partir do dia 31, em silêncio, com a linha intacta no
   banco.

### As decisões (11 respostas do João, 12/08)

| | escolha |
|---|---|
| renderizador | **matar a página Next.js** — um documento, um lugar que o desenha |
| recorte | **obedecer os filtros da tela e escrever na capa** |
| validade | **migration 033** — link não expira mais |
| PDF | **botão de imprimir na própria página** (`window.print()` com CSS A4) |
| arquivo `.html` | **abandonado** — ver abaixo |

### 🚨 Por que o arquivo `.html` foi abandonado

O pedido original incluía "exportar pro Drive, ou baixar, e poder abrir de novo
depois". O caminho óbvio era gerar um `.html` autocontido e mandar pela folha de
compartilhamento. **É o pior dos dois mundos**, e vale registrar pra não voltar
como ideia:

| | link (HTML no navegador) | arquivo `.html` | PDF |
|---|---|---|---|
| PC | sempre | sempre | sempre |
| Android | sempre | depende de app registrado pra `text/html` | sempre |
| iPhone | sempre | preview do Files renderiza | sempre |
| **Google Drive** | — | ❌ **mostra o código-fonte** | preview nativo |
| **E-mail corporativo** | passa | ❌ vetor clássico de phishing, quarentenado | passa |

**HTML é imbatível como link e frágil como arquivo.** O cenário exato que o João
descreveu — exportar pro Drive — é onde ele quebra pior: o cliente abre e vê
`<div class=...>`. Então: HTML é o projeto e o link é a entrega; PDF é o
artefato que viaja, e sai de dentro da própria página.

Também foi descartado gerar o PDF no servidor: Chromium headless (Puppeteer) no
Render Starter (512MB, 0.5 CPU) mora **na mesma caixa que roda o CRON 24/7**, com
pico de ~250MB por render. Um OOM ali não derruba o relatório, derruba o
monitoramento — que é o produto. Fica no ROADMAP pra quando houver caixa própria.

E `Printing.convertHtml` (que geraria o PDF no aparelho, a partir do mesmo HTML)
está **deprecada** no pacote `printing`. Foi verificado antes de virar
recomendação; ia ser o alicerce e não aguentava peso.

### O que foi construído

`backend/src/services/relatorio/` — quatro arquivos:

- **`tipos.ts`** — o contrato, alimentado por **dois produtores**: o app (que já
  contou tudo com o recorte) e o backend (que consulta, pro painel admin).
- **`estilo.ts`** — o fio de agência traduzido pra papel. Navy vira **tinta sobre
  branco**; o que atravessa não é a cor, é a disciplina (filete em vez de caixa,
  raio zero, título à esquerda, a mesma escada tipográfica). Só a **tinta do
  texto** escurece pra passar AA no branco — o teal #1A8F9A dá 3.4:1 sobre
  branco. As cores de categoria **não são reescritas**: vêm de
  `CATEGORIA_CORES`, que já é fonte única.
- **`mapa.ts`** — Web Mercator e a grade de tiles.
- **`html.ts`** — o render. Rosca em SVG escrito à mão, barras em CSS, nenhuma
  biblioteca de gráfico. Até a **página de erro** é desenhada: ela também chega
  no cliente quando o link vem truncado pelo WhatsApp.

**O mapa já nasce impresso.** A página anterior desenhava Leaflet e, na hora do
PDF, rodava html2canvas pra fotografar a `<div>` — um passo que falhava calado e
trocava o mapa por um parágrafo de texto. Agora são os mesmos tiles da CartoCDN
como `<img>` posicionadas por CSS, com os pinos por cima: zero JavaScript, zero
canvas, zero passo que pode falhar.

### 📏 Duas medições que mudaram o desenho

**1. O raio zero vazou pra dentro do mapa.** `* { border-radius: 0 !important }`
pegou os 74 pinos e transformou em quadradinhos — o mapa virou uma nuvem de
amostras de legenda sobre a cidade. A disciplina é de **interface** (card, botão,
chip); marca de dado não entra. Virou `*:not(.pino):not(.marca)`.

**2. Zoom inteiro custava metade da escala.** `enquadrar` só escolhia zoom
inteiro, e zoom de mapa é potência de 2 — então "não coube por 11 pixels" jogava
fora um nível inteiro. Medido com os 15 bairros da Grande Florianópolis:

| | antes | depois |
|---|---|---|
| zoom | 10 | 11 (efetivo) |
| altura da caixa aproveitada | ~45% | **90%** |
| largura aproveitada | ~31% | **63%** |

O conserto é renderizar no zoom inteiro **de cima** e encolher a camada por
`transform: scale()` — zoom contínuo em cima de tiles que só existem em zoom
inteiro. Os pinos ficam **fora** da camada escalada, senão encolheriam junto (7px
viraria 3,8px).

### 🚨 O achado que só apareceu porque o dado de teste era ruim

A primeira fixture era `sin()`/`cos()` numa caixa, e metade dos pinos caía na
baía. O João olhou e disse "o mapa tá zoado" **duas vezes** — e estava certo:
mapa com ocorrência no meio da água faz duvidar do código. Trocada por
coordenadas reais de bairro, ela virou **prova da projeção** (Ingleses ao norte e
a leste do Centro, Palhoça a oeste e ao sul, os 15 dentro da caixa) — e foi
exatamente essa prova que revelou o defeito do zoom, que nenhuma inspeção visual
tinha achado. **Dado de teste ruim não atrasa só a revisão: ele esconde bug.**

### Cache — o motivo de ver a mesma página duas vezes

A rota mandava `ETag` e **nenhum `Cache-Control`**, então o navegador caía no
cache heurístico: inventava um prazo e servia o HTML velho sem perguntar. Os
dados do relatório são imutáveis, mas o **render** não é (melhora a cada deploy),
e um cliente preso numa versão de dois deploys atrás não tem como saber.
Agora vai `no-cache` — revalida sempre, e com ETag isso custa um 304.

### Removido do painel admin

A página `/report/[id]` e, por transitividade, quatro componentes que ficaram
órfãos com ela (`crime-radar-map`, `crime-trend-bars`, `executive-section`,
`sources-section`), a dependência `html2canvas`, `getPublicReport` e a exceção de
auth no `middleware.ts` — exceção que sobrevive à rota que protegia é buraco
esperando alguém criar `/report/qualquer-coisa` sem perceber que nasce aberto.

O painel também **montava o link na mão** (`window.location.origin/report/ID`),
apontando pra si mesmo. Agora usa o `reportUrl` que o backend devolve.

### Verificação

- `npx tsc --noEmit` limpo no backend e no painel; `flutter analyze` no baseline
  (1 info preexistente em `type_helpers.dart`).
- **Caminho real**: gravou no banco → `GET /public/report/:id` → HTTP 200,
  `text/html`, 29 KB, `Cache-Control: no-cache`; id inexistente → 404 com a
  página de erro desenhada.
- **Schema contra o payload do app**: os quatro casos reais passam (app completo,
  sem `searchId`, sem região/antigas, painel admin com cidade singular) e o único
  que tem que falhar falha (sem cidade nenhuma).
- ⬜ **Falta o A57.** Os dois botões e o payload nunca rodaram num aparelho.

### Anotado, não feito

- **Domínio próprio** — o link é `sistemaprogestao-7fzs.onrender.com/public/
  report/<uuid>`. Não piorou nada (o `ADMIN_PANEL_URL` também era subdomínio do
  Render), mas não é endereço de peça de apresentação. `urlPublica()` já lê
  `PUBLIC_BASE_URL` primeiro, então é **variável de ambiente, não código**.
  Levantado em 12/08: `progestao.com.br` existe mas **é de outra empresa de mesmo
  nome**, e `simeop.com.br` (que o João tentou no Render) não está registrado —
  daí a verificação nunca passar. **João decidiu: feature futura.**
- **`contact@progestao.com.br` no User-Agent do Nominatim**
  (`services/geocoding/nominatim.ts`, 3 lugares) — é o domínio de outra empresa.
  A política de uso do OSM pede contato válido pra poder avisar sobre abuso.
- **Links já compartilhados quebram neste deploy** — apontam pro painel. Como
  expiravam em 30 dias e estamos em beta, aceito.
- Encurtar a rota pra `/r/<id>` — oferecido, não priorizado.

## 2026-08-11 (madrugada) — Fase F: o push ia para todo mundo, sempre

**Medi antes de construir, e o número contrariou o plano.** A Fase F prometia
digest por cidade desde o começo. Últimos 21 dias:

```
30 noticias em 15 dias com movimento
  media 2,0/dia · mediana 1 · pico 5
  0 inseridas entre 00h e 07h
  seguranca 53% · operacional 23% · patrimonial 20% · fraude 3%
  aparelhos registrados: 4
```

**Não existe problema de volume.** Digest resolve enxurrada; juntar 2 pushes num
resumo os deixa **mais tarde** sem deixá-los **menos**. Nesse volume é perda
pura. O digest saiu do escopo com o gatilho registrado: **acima de ~10/dia ele
volta à mesa com número.**

O problema real é **relevância**, e o levantamento achou três buracos:

1. **Todo aparelho recebe tudo.** `pushService.ts` selecionava `user_devices`
   por `last_seen` e mandava. Sem filtro de cidade, de assunto nem de usuário —
   o cliente de Florianópolis recebia Porto Alegre.
2. **Estatística chega como alerta.** `natureza = 'estatistica'` disparava push
   igual a ocorrência: *"homicídios caíram 12%"* com a urgência de um homicídio.
3. **Não havia como calar o que não interessa** sem desligar tudo — a única
   chave era o `push_enabled` global do painel, que vale para todo mundo.

**A regra que atravessa banco, backend e app: `null` quer dizer TODAS.** Quem
nunca abriu a tela não tem linha em `user_notification_prefs` e continua
recebendo tudo, exatamente como antes. Lista vazia é outra coisa — é quem
desmarcou de propósito. **Migration não pode calar ninguém em silêncio**, e
ninguém reclama de alerta que não chega: acha que o produto parou.

A armadilha desse modelo mora numa função de sete linhas (`_alternar`, na tela):
desmarcar o **primeiro** item precisa materializar a lista inteira antes de tirar
um, senão `null` menos um item continua `null` e o toque não faz nada.

**Dois canais Android**, decisão do João: *"o user que vai configurar as
notificações no próprio android, se tiver volume alto toca, se tiver vibração
vibra"*. Isso **reforça** os canais em vez de dispensá-los — com um canal só, o
Android oferece um interruptor para tudo, e silenciar o balanço estatístico
silenciava o homicídio junto. O app decide **o que** é urgente; o Android decide
**como** avisa.

O que é urgente reusa `categoria_grupo === 'seguranca'` — o mesmo critério que
engorda a manchete no fio (`TakeCard.isUrgent`). Inventar um segundo conceito de
urgência criaria duas verdades sobre a mesma notícia.

E **tri-estado morreu antes de nascer**: era ligado/silencioso/desligado, e virou
ligado/desligado. Escolher som dentro do app duplicaria a tela de notificações do
Android — dois lugares para a mesma configuração é como os dois passam a
discordar.

Anotado, não consertado: **ninguém escuta o `NOTIFY 'new_news'`.** O trigger
dispara a cada insert e o payload não vai a lugar nenhum — o push é chamado
direto do `scanPipeline`. O `schema.sql` descreve isso como *"LISTEN/NOTIFY —
Event-Driven Push (FASE 2.5)"*, uma arquitetura que não existe.

---

## 2026-08-11 (noite) — as duas listas de lugar passam a ter a mesma anatomia

Plano escrito há semanas, aprovado, sobrescrito pela Fase D e recuperado do
ROADMAP. Reconferido contra o código atual **antes** de executar — e a
reconferência achou duas coisas.

**O `EndMark` já estava morto.** O plano listava 9 chamadas a remover; o grep
devolveu zero, só a lápide em `take_card.dart:485`. E eu tinha acabado de copiar
essa pendência para o ROADMAP sem conferir, cinco minutos antes. Vale registrar
sem suavizar: **cometi o apodrecimento silencioso dentro do documento que
registra a regra contra ele.** Corrigido no mesmo turno, com a marca do erro.

**O diagnóstico do plano, esse, continuava certo** — e o código deixou apontar
com precisão. O `CityCard` dizia o mesmo fato **três vezes**:

1. a frase abria com *"21 ocorrências em trinta dias"*, e a faixa de figuras
   logo abaixo **soma exatamente 21**;
2. a frase fechava com *"Patrimonial responde por 52%, a maior fatia"*, e a maior
   figura da faixa é justamente `11 PATRIM.`;
3. a etiqueta de cima dizia `4 CIDADES`, que é a contagem dos nomes que a própria
   frase listava no fim.

Três repetições, ~40px, zero dado novo. **A redundância é que fazia 218px, não
os números** — que era a dúvida do João (*"não sei se essas contagens são úteis
de fato"*). São úteis; a prosa em volta é que não era.

Agora as duas listas têm quatro posições, e cada tela preenche com o que serve:

|    | MONITORAMENTO           | CONSULTAS                |
|----|-------------------------|--------------------------|
| ①  | UF + `N NOVAS` em verde | UF                       |
| ②  | `21 EM 30D`             | a hora (`19:16`)         |
| ③  | os nomes do grupo       | `30 DIAS · 17 ASSUNTOS`  |
| ④  | quebra por categoria    | `91 RESULTADOS`          |

③ e ④ **somem sem deixar vão**: cidade sozinha com ocorrência fica muda em ③,
porque não há o que dizer ali que a figura não diga. Cidade zerada fala, porque
aí não existe figura para falar por ela.

O ② virou `21 EM 30D` — **a mesma frase que a `QuietCityRow` já escrevia**. Foi o
melhor sinal de que o desenho estava certo: cidade quieta e cidade agitada
passaram a dizer a mesma coisa, no mesmo lugar, sem ninguém ter combinado.

Na consulta, o `91 RESULTADOS` era mono 9.5 — do tamanho de tudo no card, sendo a
única coisa que responde *"essa consulta valeu a pena?"*. Virou figura de 21px,
**deitada e não empilhada**: escolha do João entre as duas, porque empilhada
custaria ~46px por item numa lista que se varre, e deitada custa ~16.

E **falha e andamento passaram a ocupar ④**, o lugar do número. Antes brigavam
com a hora na linha de cima, longe da pergunta que respondem. Agora a exceção
mora onde o olho já vai procurar o desfecho.

A peça é `core/widgets/entrada_de_lugar.dart`. Ela guarda o que estava
divergindo — **os espaçamentos e os degraus de tipo** —, não o conteúdo. As duas
listas eram de semanas diferentes, e ninguém tinha decidido que seriam
diferentes.

---

## 2026-08-11 (noite) — as pastas de mês, e três listas que ninguém ordenava

**Ideia do João olhando a lista da Grande Florianópolis:** agrupar em pastas —
mês, semana, dia. O diagnóstico dele estava certo e é o mesmo do gráfico: **a
lista de semanas cresce sem teto.**

Medi antes de concordar, e a primeira medição estava na **unidade errada** — fiz
cidade por cidade, e a tela abre o GRUPO com `TODAS`. Refeito no nível do grupo:

```
Grande Florianópolis (Florianópolis, Palhoça, São José)
  93 itens · 4 meses · 16 semanas
  mediana 6 itens/semana · maior 17
  3.1 dias distintos por semana (de 7)
  51% dos dias com 1 item so
  linhas na tela hoje: 7 dias + 16 semanas = 23
```

**Mês: sim. Dia como pasta: não** — e o número é o argumento. Uma semana ocupa
3,1 dias de 7, e metade desses dias tem **um item só**. Pasta com uma coisa
dentro custa dois toques e não entrega nada; em Palhoça seriam 92% delas.

Mas a maior semana tem **17 itens**, e essa precisa de corte. Daí a saída: **o
dia vira divisória impressa entre os cards**, não pasta. Semana gorda ganha a
estrutura, semana magra não paga o toque, e a matéria continua a **dois toques**
(mês, semana) em vez de quatro.

Resultado: 23 linhas viram 11 (7 dias soltos + 4 meses).

O mês só existe **acima de 8 semanas** — abaixo disso a lista plana já cabe, e um
mês envolvendo quatro semanas seria a mesma pasta-com-tudo-dentro. Consulta de 30
dias tem 5 semanas e segue plana. O mês mais recente nasce **aberto mostrando as
semanas dele, fechadas**: a estrutura se apresenta, nada despeja card.

O laço de desenhar grupo/semana/divisória saiu das duas telas e virou
`fio_agrupado.dart`. Estava duplicado; com a árvore, seria a mesma lógica escrita
duas vezes em dois arquivos — que é exatamente como as duas telas divergem sem
ninguém decidir.

---

**E um defeito achado no caminho, esse não era de desenho:** o João pediu ordem
cronológica dentro dos dias, e fui conferir se valia para todas as listas.
**Os três baldes da consulta — REGIÃO METROPOLITANA, fora do período e
INDICADORES — renderizavam na ordem crua do backend.** Sem ordenação nenhuma.

Só a lista principal passava pelo agrupador, e é o agrupador que ordena. Ou seja:
a tela tinha uma parte em ordem cronológica e três blocos sorteados, e nada
dizendo qual era qual.

`maisRecentePrimeiro` virou público e agora é a **única** regra de ordem de
matéria do app. O `feed_screen` tinha mais duas cópias da regra antiga (só data,
sem hora) — sobreviviam porque o agrupador reordenava depois, mas eram uma
segunda verdade esperando alguém confiar nelas.

Padrão que se repete nesta fase: **o defeito não estava no que a tela mostrava,
estava no que só uma parte da tela obedecia.**

---

## 2026-08-11 (Fase D, tarde) — o gráfico não tinha teto, e o giro não dizia nada

Quatro achados do João olhando o aparelho. Os dois primeiros foram conserto; os
dois últimos eram desenho.

**A dica de selecionar voltou pro cabeçalho.** Eu a tinha posto no corpo, colada
no `NOVA CONSULTA`, e ele matou olhando a tela: duas linhas de mono empilhadas
logo abaixo do filete brigam, e a de baixo — que é só instrução — rouba a vez da
ação verde. No canto direito ela fica onde legenda fica. O slot `direita` do
`Masthead` nunca tinha saído da peça; era só usar.

**O `0S` fantasma** era um cronômetro parado no zero: entre disparar a busca e o
backend devolver o `searchId`, `_searchStartTime` ainda é nulo e o campo exibia o
valor inicial `'0s'`. Cronômetro em zero enquanto a tela carrega parece app
travado. Sem hora de início, não se carimba nada.

**Só HOJE nasce aberto**, no feed e na consulta (`date_grouping.dart`). Antes os
sete dias vinham abertos: numa consulta de Salvador isso é uma parede de cards
antes de a pessoa descobrir que existem INDICADORES no fim e um balde REGIÃO
METROPOLITANA. Recolhido, a página inteira cabe numa tela e dá pra ver a forma da
coisa. O que o leitor abre continua aberto.

---

### O gráfico de volume: o defeito não era o rótulo

**O número de barras não tinha teto.** 7 dias davam 2 barras, o `TUDO` deu 16
(foto), um ano daria 52. Ajuste de rótulo só adia o ponto onde quebra.

Dois achados no caminho:

1. **O backend já agrupava por dia, semana e mês** desde sempre — `getCrimeTrend`
   aceita os três — e o app mandava `'week'` **fixo**. A alavanca existia e nunca
   tinha sido puxada.
2. **O rótulo era `Sem 18`**, o número da semana ISO. Ninguém sabe que dia é a
   semana 18. E era só no monitoramento: a busca manual desenha o **mesmo
   widget** com `05/07`, porque agrupa no cliente. Dois vocabulários para o mesmo
   gráfico, dependendo de que tela abriu.

Agora o balde segue a janela (`baldeDaJanela`): ≤14 dias por dia, ≤90 por semana,
acima disso por mês. Barras entre 4 e ~13 **em qualquer período**:

| janela | balde | barras |
|---|---|---|
| 7D | dia | 7 |
| 30D | semana | 5 |
| 90D | semana | 13 |
| TUDO (110d) | mês | 4 |
| 1 ano | mês | 12 |

No cliente o balde sai do **maior** entre a janela pedida e o span real dos
dados. Não é preciosismo: com a tolerância de período ligada, uma consulta de 30
dias mostra itens de até 180 dias atrás, e olhar só a janela pedida daria 26
barras semanais numa tela que pediu 5 — o mesmo defeito entrando por outra porta.

`WeeklyTrendBars` virou `VolumeNoTempo`. O nome era o defeito: semana como balde
fixo é exatamente o que quebrava.

---

### Os carregamentos: 14 giros, três respostas diferentes

O `CircularProgressIndicator` era o widget mais Material que sobrou, e não informa
nada — nem o que vem, nem quanto, nem se vale esperar. Mas os 14 não eram a mesma
coisa, e tratar todos igual seria o erro:

- **8 viraram silhueta** (feed, consultas, monitoramento, relatório da cidade,
  resultado e formulário da consulta, indicadores, taxonomia). A silhueta tem a
  forma da lista que vem depois, então informa e elimina o salto de layout.
- **1 virou a marca** — a abertura do app (`main.dart`). Aqui silhueta
  **mentiria**: o app ainda não sabe se vai abrir o login, o feed ou a troca de
  senha. Quem espera é o `SIMEOPS`, sozinho, na mesma peça do cabeçalho.
- **5 continuam giro**: dentro do botão de entrar, do de salvar senha, e no
  rodapé de "carregando mais". Botão trabalhando não tem silhueta.

**Sem gradiente varrendo**, decisão do João depois de eu levantar a ressalva: o
shimmer de loja seria a única animação decorativa do app. O pulso é só o opacity
entre 0.35 e 0.75 em 1,1s, tudo em `hairline` (1.8:1) — a tinta que a paleta
proíbe para texto, e que por isso mesmo é a certa para uma forma que não deve ser
lida.

---

## 2026-08-11 (Fase D) — a caixa que prometia o que já acontecia, e a função secreta

**Saiu o `MANTER CONECTADO NESTE APARELHO`.** O pedido do João nasceu de uma
premissa que o levantamento desfez, e a premissa errada vale mais registrar que
a mudança: *"temos um jwt mudando semanalmente, lembrar a senha só facilita
isso"*.

**Não existe JWT nosso.** `jwt.sign`, `expiresIn`, `JWT_SECRET`, `jsonwebtoken`:
zero ocorrências no backend e no admin. Auth é 100% Supabase, e o backend só
**valida** (`middleware/auth.ts:46`). Tempo de token é config de dashboard.

E — o que decide tudo — **diminuir o tempo do access token não desloga ninguém**:
quem segura a sessão é o refresh token, renovado em silêncio pelo SDK. A alavanca
para "logar de novo de tempos em tempos" tem outro nome (session timeout), e o
João decidiu **não usá-la**: *"não precisa ficar fazendo login sempre, é um app
seguro, não é aberto ao público"*. Fica registrado para não voltar como ideia.

Então por que a caixa saiu? Porque ela **cobrava o preço todo e entregava quase
nada**: gravava a senha em texto claro no cofre do aparelho para conseguir
re-logar depois de um logout, enquanto a sessão do Supabase já mantinha o usuário
dentro sem ela. E um único 401 já apagava esse cofre. Tirar a caixa **não faz
ninguém logar mais vezes**.

**O que NÃO saiu, e o motivo:** `saveCredentials`, `signInWithDeviceAuth` e o
`_tryAutoLogin` ficam. O desbloqueio pelo celular usa as mesmas três chaves, e
quem escolheu esse caminho no primeiro acesso tem uma senha de **32 caracteres
gerada que nunca viu** (`change_password_screen.dart:69-75`). Remover junto
trancaria essas pessoas do lado de fora até um reset do administrador. O
`clearSavedCredentials()` também fica no login — é o único caminho de limpeza da
senha de quem marcou a caixa antes.

Anotado, não consertado: o `_tryAutoLogin` roda no `initState` e re-loga
**sem pedir biometria**, o que torna o botão DESBLOQUEAR decorativo.

**Senha mínima 6 → 8**, nas duas pontas que validam
(`userRoutes.ts:22` e `:228`, `change_password_screen.dart:229`). Não quebra
ninguém, e a razão é boa: **o painel nunca digita senha, ele gera uma de 8**
(campo `readOnly`), o caminho biométrico gera 32, e **nenhuma das três pontas
valida tamanho no login** — então subir o mínimo não tranca quem já tem senha
curta. O único jeito de existir senha de 6-7 era alguém ter digitado uma curta de
propósito na troca.

Ficou um comentário amarrando os três oitos (o `min(8)`, o gerador do backend e o
gêmeo no painel): se um dia o mínimo subir, os três sobem juntos, senão o sistema
passa a recusar a senha que ele mesmo gera — e quem quebra é o admin criando
usuário, não o usuário.

Anotado, não consertado: os dois `generateTempPassword` usam `Math.random()`, que
não é criptográfico (~46 bits de fonte previsível). O mobile já faz certo com
`Random.secure()`.

**Voltou a pista do `SEGURE UM ITEM PARA SELECIONAR`.** Apagar consulta estava
**inalcançável**: o rótulo saiu do masthead quando o cabeçalho foi limpo e nada
ocupou o lugar — o `HistoryCard` não tem checkbox, alça nem reticências. Volta no
corpo, em `faint`, colada no `NOVA CONSULTA`, e some no modo de seleção. O
cabeçalho continua igual ao de Config, que era o pedido original.

Lição do dia, e é a terceira vez que ela aparece nesta fase: **limpar um
cabeçalho apaga afordância junto**. O que estava escrito ali não era enfeite —
era a documentação de um gesto invisível.

---

## 2026-08-11 (Fase D) — os favoritos e o gesto que era a única porta deles

**Removida a feature de favoritos inteira, das três pontas.** Não foi limpeza de
código morto por estética: era uma feature que **nenhum usuário conseguia
alcançar** e que ninguém tinha decidido matar.

O levantamento achou a cadeia:

- `FavoritesScreen` **não é instanciada em lugar nenhum** — nenhuma rota, aba,
  push ou item de menu. As abas são Consultas / Monitoramento / Config.
- ela era a **única** a usar `NewsCard`, então `news_card.dart` (256 linhas)
  estava morto por transitividade — o `TakeCard` já o substituiu no feed e na
  busca.
- e o **único** disparador de `addFavorite`/`removeFavorite` no app era arrastar
  o card pra direita. O `NewsDetailSheet` nunca teve botão de salvar.

Ou seja: para salvar uma notícia era preciso descobrir sozinho um gesto sem
nenhuma pista na tela, e o resultado ia para uma tela inalcançável. A frase que
sobrou no vazio da tela órfã resume o absurdo: *"Deslize uma notícia para a
direita para salvar"* — escrita para uma tela que ninguém abria.

Saiu: dois arquivos Flutter inteiros, `isFavorite` do modelo, três métodos do
`ApiService`, o alias `bookmark` da paleta, o `flutter_slidable` do pubspec, três
rotas do backend, três funções de `queries.ts` e a tabela do `schema.sql`.

**A parte perigosa foi uma só**, e está marcada no código: `getUserNewsFeed` é
compartilhada — ela traz o status de **lida** e o de favorito no mesmo lugar.
Saiu só o bloco do favorito; `readSet`/`is_unread` fica, porque é o que alimenta
o badge da aba Monitoramento.

**O banco não foi tocado.** A `031_drop_user_favorites.sql` está escrita e **não
rodada**, com duas armadilhas registradas no cabeçalho: a **ordem é 025 → 031**
(a 025 liga RLS nessa tabela e quebra se ela já tiver sumido), e depois dela o
replay das migrations do zero não passa da 010, que faz TRUNCATE ali. Vai no
deploy final, depois da promoção da `main` — produção ainda roda o código de
junho, que lê a tabela.

Medido, e vale registrar: a leitura de produção **ignora o erro** (destrutura só
`data`), então o feed sobreviveria ao DROP. Não é motivo pra correr o risco, é
motivo pra saber que o risco é pequeno se algo sair de ordem.

Nota de processo: `dart format` nos cinco arquivos que entraram no commit
reescreveu bastante além do que mudei — `api_service.dart` acusa 326 linhas
tocadas para uma remoção de dois métodos. É o tall style do Dart 3.7 alcançando
arquivos que ainda não tinham passado por ele. Mantido, pela mesma regra de
10/08: formatar só os arquivos do commit, nunca a pasta.

---

## 2026-08-11 — o `TUDO` do relatório pedia o ano 2000, e o backend recusava

**Defeito que o João pegou no aparelho: o `TUDO` do relatório da cidade não
funcionava.** Não era o build atrasado — era 400.

A cadeia, medida com os schemas reais (`npx tsx` contra
`schemas.analyticsQuery` e `schemas.analyticsTrend`):

```
ANTES  (_inicioDosTempos)        9719d  crime-summary  400 -> Date range cannot exceed 3700 days
ANTES  (_inicioDosTempos)        9719d  crime-trend    400 -> Date range cannot exceed 3700 days
DEPOIS (1a ocorrencia GF)         110d  crime-summary  OK 200
DEPOIS (1a ocorrencia GF)         110d  crime-trend    OK 200
DEPOIS (fallback _tetoDoTudo)    3650d  crime-summary  OK 200
```

`TUDO` mandava `dateFrom = 2000-01-01` — **9.719 dias**, contra o teto de
`JANELA_MAXIMA_DIAS = 3700` (`validation.ts:69`). O `.catchError((_) => {})` do
`_loadOverview` engolia o 400 sem uma linha de log na tela, e o relatório abria
zerado. **Com o mapa cheio de pinos em cima**, porque `mapPointsQuery` não tem
esse refine e o executivo mandava `3650`, que passa raspando.

O sintoma tinha assinatura: um relatório que diz `0 ocorrências` sobre um mapa
com 96 pontos é erro de rede engolido, não cidade quieta.

**A cicatriz estava no próprio código**, em `validation.ts:224`: *"Ate 3700 pelo
mesmo motivo da JANELA_MAXIMA_DIAS: o `TUDO` do relatorio manda uma janela de
anos, e 365 devolvia 400"*. Metade do `TUDO` já tinha sido consertada — a rota
do executivo — e as outras duas ficaram para trás porque **o mesmo conceito
viajava em duas linguagens**: `rangeDays` em número (3650) e `dateFrom` em data
(ano 2000). Duas representações da mesma coisa discordando é o mesmo defeito dos
dois controles de janela de 10/08, uma camada abaixo.

**O conserto foi do João:** *"tem que ser enviado a partir do dia que o
monitoramento começou"*. O campo `primeiraOcorrencia` já estava no ar desde
ontem (foi adicionado para decidir quais janelas entram na fila) — agora ele
também define o `TUDO`. Uma conta só, `_relatorioRangeDays`, alimenta as quatro
rotas; `_diasDoTudo` é a idade real da cidade no monitoramento, com piso de 7
(mínimo do schema do executivo) e teto de 3650 (fallback para backend antigo ou
data absurda). O `_inicioDosTempos` morreu.

Vale para sempre: **teto de validação no backend precisa de par no cliente.** O
cliente mandava um número que nenhuma tela mostrava, e o erro só aparecia como
ausência de dado.

Anotado, não consertado: `_loadOverview`, `_loadTrend` e `_loadMapPoints` tratam
falha de rede como resposta vazia. Enquanto for assim, qualquer 400 futuro vai
se disfarçar de "cidade sem ocorrência".

---

## 2026-08-10 (madrugada) — dois controles de janela na mesma tela, e filtros que não filtravam nada

**O gráfico de volume por semana estourava a caixa.** Dois defeitos somados: o
rótulo `05/07` pede ~35px em mono 9.5 com tracking e a coluna tinha 27px (treze
semanas em 408px), então **todos** viravam `0…`; e o orçamento vertical era
`height - 30` para um empilhamento que consome 36 de texto e vão, o que
empurrava o rótulo da barra mais alta pra fora. Agora o eixo mede a coluna e
rotula de N em N, **ancorado na última semana**, e a reserva sai das constantes.
Os `0` das semanas vazias saíram da linha de cima — oito deles em tinta
`hairline` (1.8:1, que a paleta proíbe para texto) dizendo o que o filete de 2px
embaixo já diz.

**O mapa ganhou filtro de precisão, e o filtro é a legenda.** Categoria já
filtrava pelos chips do topo desde sempre; a legenda `RUA · BAIRRO · CIDADE`
ficava embaixo explicando as formas sem fazer nada. Virou controle, com o mesmo
gesto e a mesma resposta visual dos chips (35% quando desligado), e cada marca
carrega a contagem: lê-se `CIDADE 34` e já se sabe que um terço do mapa é ponto
de centro de cidade — desligar mostra a distribuição de quem tem endereço.
Precisão inexistente naqueles dados não vira botão apagado, some.

**Dois controles de janela na tela da cidade, e eles não se falavam.** O
cabeçalho tinha `21 EM 30D ▾` (menu `_PeriodCount` + enum `StatPeriod`,
alternando 30 dias / acumulado) e o relatório logo abaixo tem `7D 30D 90D 1A
TUDO`. Dava pra ficar com o cabeçalho dizendo 21 e o relatório dizendo 60, na
mesma tela, sobre a mesma cidade, sem nada dizendo qual media o quê. O cabeçalho
passou a dizer **o acumulado** — fato fixo, não controle — e a janela ficou só
com o relatório.

**As fatias do relatório ofereciam janelas impossíveis.** A fila era fixa e o
monitoramento tem ~3 meses: `1A` devolvia exatamente o mesmo que `TUDO`, e `90D`
quase. E o problema não some com o tempo — passado um ano, `1A` e `TUDO` voltam
a coincidir por meses. Regra nova: **uma janela só entra se sobrar pelo menos
uma semana de dados fora dela**; se esconde menos que isso, não é recorte. Se
sobrar só o `TUDO`, a fila inteira some — um controle de um item finge oferecer
alternativa.

Para isso o backend passou a mandar `primeiraOcorrencia` no
`/analytics/cities-overview`: o **mínimo** de `data_ocorrencia`, calculado no
mesmo laço onde o `lastNewsAt` já calcula o máximo — zero consulta a mais. No
grupo é a mais antiga entre as cidades-filhas (se uma tem um ano de histórico, o
relatório do grupo tem o que mostrar num recorte de um ano). Backend antigo
manda null e a fila volta a mostrar todas as opções.

---

## 2026-08-10 (noite) — três comentários que descreviam um mundo que não existe mais

Revisão do relatório da consulta, com o João lendo o aparelho. O padrão da noite
não foi bug de código: foi **afirmação escrita e nunca revisada**.

**1. `VER COMO TABELA` morreu, os três.** O argumento original (rosca e barra
mostram proporção e escondem o número exato; relatório existe pra ser citado)
era bom **no dia em que foi escrito**. Depois a legenda passou a imprimir
`38%  36` e o ranking passou a imprimir a contagem ao lado de cada barra — a
tabela virou a mesma informação duas vezes atrás de um toque, e o `→` prometia
navegação numa coisa que expandia no lugar. Onde ela tinha função real (os
bairros que não cabem no top 8), o nome dizia a coisa errada: quem quer o resto
da lista não procura "tabela".

**2. A contradição na tela.** "34 de 86 ocorrências não citam bairro" logo acima
de "86 de 86 entraram no mapa — o resto não traz bairro na matéria". Causa: um
doc comment do `_semBairro` afirmando que item sem bairro **não entra no mapa**.
Entra: o geocode aceita só a cidade e devolve `precisao: 'cidade'` — o pino cai
no centro. **40% dos pinos daquele mapa de Salvador estão no centro da cidade.**
O mapa sempre disse isso na legenda de precisão; agora diz em português.

**3. O `ABRIR A MATÉRIA` que não abria.** Medido: os itens de `search_results`
**não têm `id`** (0 de 101; têm `source_url`). O `getSearchMapPointsRaw` caía no
último fallback e mandava **índice posicional** como identidade do pino. Duas
correções: o backend passou a usar a `source_url`, e o app casa por conteúdo
(data+tipo+bairro+rua) **só quando o casamento é único** enquanto o staging não
sobe — dois roubos no mesmo bairro no mesmo dia é caso real, e abrir quase a
matéria certa é pior que não abrir. E o card só escreve `ABRIR A MATÉRIA →`
quando existe matéria do outro lado: link que promete e não cumpre é o defeito,
não o link faltando.

**4. O mapa não obedecia as chaves.** Ligar "+ região metropolitana" mudava
número-herói, donut e ranking — e o mapa ficava idêntico, porque o backend
descartava os extras antes de geocodificar. **A justificativa daquele descarte
estava vencida em três lugares** (o comentário do `analyticsQueries`, uma seção
inteira do `API_CONTRATO` e o filtro em si): dizia que o geocode roda contra a
cidade da requisição, quando `buildMapPoints` usa `p.cidade || cidadePadrao` — a
cidade do ponto — desde que alguém consertou isso. Agora o endpoint manda tudo
marcado com `fora_do_periodo`/`cidade_vizinha` e **quem filtra é a tela**, pelas
mesmas regras dos números, incluindo as fatias 7D/15D/30D (que também não
mexiam no mapa).

**5. Precisão virou forma.** Era raio 5.5 / 4.0 / 3.0 — cinco pixels de diâmetro
entre o mais preciso e o mais vago, em marcas que também mudam de cor e se
sobrepõem. O João olhou o mapa e não conseguiu dizer qual ponto era rua e qual
era cidade; tamanho é o canal mais fraco nessa escala e ali competia com a cor.
Agora: cheio (rua) · meio tom (bairro) · **vazado** (cidade). Vazado lê como
furo, que é o que um pino no centro da cidade é.

**6. Mapa claro**, por pedido — `light_all` do CartoDB no lugar do `dark_all`.
Nasce escuro. A borda dos pontos vira quase preta no claro: as cinco cores de
categoria foram medidas contra o navy, não contra papel.

**A tolerância de período** também mentia: dizia `até 180 dias atrás`, que é o
horizonte teórico da config e não tem relação com o que a consulta trouxe. Agora
mede o que está na mão (`até 34 dias antes`), com os números em verde de
destaque porque são os que mudam quando se toca na chave.

**E uma recomendação minha que se provou errada:** eu tinha sugerido baixar o
`manual_search_horizon_days` de 180, ou torná-lo proporcional ao período. Lendo o
`pipelineCore`: o horizonte é aplicado **no Filter2**, depois do fetch da Jina e
da extração do GPT — é um limiar de *guardar*, não de *buscar*. Baixá-lo não
economiza um centavo; só joga fora informação já paga. Fica em 180.

---

## 2026-08-10 (noite) — a barra de baixo era o último Material, e o resultado da consulta chegava com cara de notícia velha

Rodada de revisão tela por tela, com o João lendo o aparelho e mandando foto.

**A barra de navegação virou peça do app.** Era o último `NavigationBar` do
Material: ícone de biblioteca, rótulo em caixa de sentença, 66px e um
`navigationBarTheme` de 24 linhas cuja única função era **apagar** coisa
(a cápsula do ativo, a elevação). O comentário desse tema afirmava que o ativo
se marcava "pelo filete de topo, igual às abas de cidade" — e o filete **nunca
existiu**: o tema tinha conseguido apagar a peça errada, não desenhar a certa.
Agora é a mesma anatomia dos cadernos: palavra, tinta branca no ativo, filete
`greenLight` de 2px. 50px em vez de 66.

Três decisões junto:
- **`Dashboard` → `Monitoramento`** (era a única aba em inglês, e é o que a
  linha sob a marca já promete) e **`Busca` → `Consultas`** (a tela se chama
  Consultas e o botão diz NOVA CONSULTA — a aba era a sobrevivente da palavra
  antiga).
- **A casa foi para o meio.** Palavra de 13 letras entre uma de 9 e uma de 6
  equilibra a barra, e a aba mais usada sai do canto mais difícil de alcançar
  com uma mão. Convenção quebrada de propósito; `_currentIndex` nasce em 1.
- O badge de não lidas não tem onde grudar sem ícone: virou **número verde ao
  lado da palavra**, que é como o card da cidade já escreve `6 NOVAS`.

**O resultado da consulta chegava apagado, e a causa é semântica.** As 101
manchetes de Salvador saíam em `faint` (4.8:1) — a tinta de "já lida". Motivo:
`NewsItem.fromSearchResult` grava `isUnread: false`, porque num resultado
recém-extraído **não existe lido e não lido**, e o `TakeCard` lia isso como
"já li". Minutos depois de coletada, a consulta inteira tinha o visual de
conteúdo velho. `TakeCard` ganhou `distingueLidas`, falso na busca.

**Ordem dentro do dia era sorteio.** `groupNewsByDate` ordenava só por
`dataOcorrencia`, e essa coluna é `DATE`: os 21 itens de hoje empatam à
meia-noite. Empate + `List.sort` do Dart (que **não é estável**) = ordem
arbitrária. Desempate agora é `hora_publicacao` (migration 030); os 13 de 101
sem hora vão para o fim do dia, porque chutar que são as mais recentes seria
inventar. Medido antes de mexer com um script de leitura: *101 itens, 0 sem
data_ocorrencia, 13 sem hora_publicacao, 21 no dia de hoje* — ou seja o "HOJE
19" não era bug de data, era ausência de critério de desempate.

**Duplicações do cabeçalho do resultado**, todas apontadas na foto: `86
OCORRÊNCIAS` no masthead com o `86` em Archivo 52 três linhas abaixo; `30 DIAS`
no masthead e `ÚLTIMOS 30 DIAS` embaixo; e **dois `FILTRAR`** a 40px um do
outro. Morreram os três. A linha do recorte volta **só com filtro ativo**, aí
ela diz o que nenhum outro lugar diz: o que está escondido.

**A folha da taxonomia** (`core/widgets/folha_taxonomia.dart`) responde a
pergunta que o app fazia o tempo todo sem responder: *o que é "Patrimonial"?*.
Abre pelo `?` no cabeçalho do monitoramento — eu tinha posto na tela da cidade
e o João corrigiu: a pergunta é sobre o sistema inteiro, não sobre a cidade
aberta. Conteúdo do backend, nunca de lista em Dart.

Sobre a copy dela: minha frase dizia "busca dentro dessas categorias" e isso é
falso — a varredura pergunta pelos **termos**, e a categoria é onde o Filter2
guarda o que voltou. Também tinha invertido "sites oficiais e mídias": não
existe lista de portais oficiais sendo varrida, o oficial aparece quando o
Google indexa. Ficou: *"São feitas varreduras na imprensa e em canais oficiais
em busca de notícias sobre esses assuntos. Para incluir ou tirar um assunto da
lista, fale com o administrador."*

**Tela de Consultas**, em duas rodadas: o `NOVA CONSULTA` subiu para a linha de
estado do cabeçalho e desceu de novo para o corpo — cabeçalho **nomeia**, corpo
**age**, e o de Consultas ficou igual ao de Configurações. Saiu o `SEGURE PARA
SELECIONAR`; **fica registrado que o toque longo perdeu a única porta de
entrada visível** e apagar consulta virou função que só descobre quem já sabe.
A ação ganhou um quadrado de 7px porque, sem ele, mono 9.5 é indistinguível dos
metadados em volta.

O quadrado saiu **verde** (`greenLight`), não no teal de ação: pedido do João
olhando o aparelho, depois de eu mostrar que amarelo não existe na paleta —
o único é `#B39026`, que é a categoria Patrimonial, justo a legenda que a folha
nova ensina. Esse verde agora diz quatro coisas (aba aberta, não lidas, fonte
oficial, esta ação); nenhuma divide tela com outra, mas o teto está mais perto.

**Faxina do que morreu no caminho:** `navigationBarTheme` (24 linhas para um
widget que não existe mais), `SIMEopsType.navLabel` promovido de degrau órfão a
usado de verdade (a barra antiga tinha o estilo inline no tema), e o
`Masthead.onDireita` que eu criei e apaguei no mesmo dia quando a ação desceu
para o corpo. Parâmetro sem usuário não fica na peça compartilhada.

---

## 2026-08-10 — o app não conhecia a palavra `cancelled`, e o verde queria dizer duas coisas

Foto da tela de Consultas vazia. João: *"a hierarquia desse botão com o Nenhuma
consulta ainda…"* e *"esse nova consulta, tanto dessa tela quanto da tela de
resultado, deveriam ser padrão n acha?"*.

**O que a investigação achou antes de mexer em pixel:**

1. **A mesma porta com três nomes e três pesos.** `NOVA CONSULTA` (verde cheio,
   topo do histórico), `FAZER OUTRA CONSULTA` (botão de texto teal, fim do
   resultado) e `MUDAR A CONSULTA` (contornado, bloco da falha) levam ao mesmo
   lugar — e esse lugar se chama `Nova consulta` no próprio masthead.

2. **O verde do app já queria dizer uma coisa só, e ninguém tinha escrito.**
   Contados os 12 `FilledButton`: `ENTRAR`, `DESBLOQUEAR`, `SOLICITAR`, `SAIR`,
   `USAR ESTES`, `VER`, `INICIAR CONSULTA`, `REFAZER A CONSULTA`,
   `COMPARTILHAR RELATÓRIO`, os confirmar de diálogo — **onze confirmam ou
   disparam**. O décimo segundo era o `NOVA CONSULTA`, que só navega. Regra
   agora explícita: **verde cheio confirma ou dispara; contornado navega.**

3. **A tela vazia contrariava o padrão que o próprio arquivo usa.** O vazio do
   feed (e o estado de erro dessa mesma tela) é título → prosa → ação. O vazio
   das Consultas mantinha o masthead por cima (dois títulos empilhados, o de
   baixo maior) e punha o botão **antes** do título.

**E aí, indo atrás do "cancelar em andamento" que o João pediu, o achado que
valeu a sessão:** o backend grava status **`cancelled`**
(`manualSearchRoutes.ts:236`) e a palavra **não existia no app inteiro**. Duas
consequências, ambas já em produção:

- no histórico, `running = status != 'completed' && !failed` — consulta
  cancelada ficava **`EM ANDAMENTO` para sempre**, em teal;
- ao abrir pelo histórico, `_resumeSearch` caía no `else` de "ainda
  processando": tela de espera **consultando de 3 em 3 segundos um job que o
  backend já tirou da fila**.

Degrada em silêncio — nenhum erro, nenhum log. Só um app que mente sobre o
próprio estado. Cancelar pela tela de espera já produzia isso desde sempre.

**O que foi feito:** `cancelled` reconhecido no `HistoryCard` (`CANCELADA` em
`faint`, sem cor — cancelar é decisão de quem usa, não incidente), no
`_resumeSearch`, no polling e no `_buildResults`. O cancelar entrou na **quarta
linha que o item já reservava** para dizer o que fazer com aquele estado (hoje
só a falha usava, com `TOQUE PARA TENTAR DE NOVO`) — nenhuma caixa nova. O
diálogo virou `core/widgets/dialogo_cancelar_consulta.dart`, usado pelos dois
lugares que cancelam: copy de aviso duplicada é copy que diverge.

O botão do diálogo era **verde** — o verde de confirmar, para descartar
trabalho. Virou vermelho, o mesmo par do apagar consulta. Propus `DESCARTAR` no
lugar de `CANCELAR`; João recusou (*"Descartar não kkk, cancelar mesmo"*), então
fica `CANCELAR` e quem desempata dele para o `CONTINUAR ESPERANDO` é o peso.

**Fora de escopo por decisão dele:** o `CANCELAR` no pé do formulário. Eu tinha
proposto, ele disse *"esquece, o cancelar é em outra tela"* — não se mexe em
tela que não foi pedida.

**Achado anotado e não corrigido:** o item que falhou diz `TOQUE PARA TENTAR DE
NOVO`, mas tocar mostra só um aviso *"Esta busca falhou. Inicie uma nova."*
(`search_screen.dart:103`). O item promete uma coisa e a tela faz outra.

**Nota de formatação:** `search_screen.dart` saiu reformatado inteiro. O
encadeamento de ternários do `build` ganhou um ramo e a indentação à mão ficou
torta, então rodei `dart format` **naquele arquivo só** — e o Dart 3.7 reescreve
no estilo novo, daí 228/160 num arquivo cujo conteúdo mudou em ~40 linhas. O
resto do `lib/` segue no estilo antigo; a migração vai acontecer arquivo a
arquivo, conforme cada um for tocado. É o mesmo motivo de 09/08: **formatar só o
que entra no commit** — nunca a pasta.

---

## 2026-08-10 — o auto-scan não cria manchete, e o motivo é que produção roda código de junho

Pergunta do João depois de ver as manchetes na busca manual: *"quero garantir que
o auto scan cria manchetes igual a busca criou"*.

**Não cria.** `npx tsx scripts/diagnostico-manchetes.ts 14`: **23 linhas de
`news` nos últimos 14 dias, zero com `titulo`** — incluindo uma de hoje às
13:00, ou seja depois da migration 029 e do código que grava o campo.

O código está certo, e é o mesmo nos dois caminhos: `filter2GPT` extrai o
`titulo` → `runFilter2WithEmbedding` (compartilhado) → o dedup em camadas faz
`...lead`, então o campo sobrevive à fusão → `insertNews({ titulo })`. Conferido
linha a linha.

**O que está errado é qual código está rodando.** O commit que ensinou o scan a
gravar `titulo` (`b389c2d`) está em `feature/design-fio` e `staging` — **não
está em `main`**. E `main` está **104 commits atrás**, com um
`scanPipeline.ts` que não menciona `titulo` nenhuma vez.

Quem roda a varredura 24/7 é a **produção**: staging é Render free e dorme. Então
o banco compartilhado vem sendo alimentado pelo código de junho.

A hipótese alternativa — Filter2 não estar extraindo — cai sozinha: a busca
manual do aparelho aponta pra staging, é o mesmo `filter2GPT`, e cria manchete
certinho. Se fosse staging rodando o scan, teria manchete.

**Por que ninguém viu:** degrada em silêncio. A coluna é anulável, o app compõe
um título de `tipo + bairro` quando vem null, e nenhuma tela reclama. Não se vê
erro — vê-se um app pior.

Fica em `scripts/diagnostico-manchetes.ts` (só leitura) para reconferir depois do
deploy sem refazer a investigação. Escrito no ROADMAP, na PRIORIDADE 0 — a
promoção da `main` **deixou de ser dívida e virou defeito em produção**.

---
## 2026-08-10 — duas telas reprovadas na foto, e o que a segunda ensinou

Dia de veredito curto. As duas listas de lugar (a anatomia comum do commit
anterior) levaram **"n gostei de como ficou"** e **"ficou feio"**, e a tela de
espera levou **"gostei mais de como estava antes"**.

**Rollback das listas** — `6b03972` devolve `CityCard` e `HistoryCard` ao que
eram e apaga `entrada_de_lugar.dart`. Não voltou o `EndMark`: matar o "FIM" foi
pedido separado e não tinha nada a ver com a anatomia.

Fica registrado o **método que falhou**, porque é o que se repete: eu montei um
raciocínio sobre redundância, apliquei nas **duas** telas de uma vez e só então
pus no aparelho. Argumento não substitui foto. Da próxima: **uma tela só**,
conferida antes de propagar.

### A tela de espera: o diagnóstico veio do que o João **não** quis desfazer

*"Eu gostei da copy dela, da contagem, aparecendo as notícias. Ela tava
perfeita, era só mexer no design e n em tudo."*

Isso separou conteúdo de forma com uma precisão que a minha análise não tinha
alcançado: o conteúdo da Fase C estava certo, o desenho é que estava errado.
Medindo o que o desenho tinha feito:

- **sumiu a barra geral.** Sobrava a barrinha do passo corrente, que não
  responde a única pergunta de quem espera sete minutos — *falta muito?*. Um
  passo pode estar em 90% com a consulta em 30%;
- **os sete nomes por extenso custavam ~300px**, com marca, valor e respiro. Em
  ~700px úteis, os achados ao vivo — a parte que ele mais gosta — nasciam no fim
  da dobra. A tela era 70% andaime e 30% do que interessa;
- três marcas diferentes, uma delas um `Icons.check` do Material — o único
  ícone solto num sistema que não usa ícone.

**O que ficou:** o passo corrente vira manchete (Archivo 25) com o contador em
figura de 30 e a estimativa ao lado; a barra geral volta no topo com
`PASSO 4 DE 7`; e os outros seis passos viram **duas linhas** — `JÁ FEITO
imprensa 619 · descarte 412 · triagem 88` e `FALTA extrair · juntar · montar`.
Nenhum número saiu da tela. Andaime de ~300px para ~150px, e os achados sobem
para a dobra.

Os pendentes continuam aparecendo: são a prova de que a espera tem plano, e
apagá-los mataria a função da lista. O que mudou é que custam uma linha, não
sete.

`_valorDoPasso` morreu junto — a trilha lê `_numero` direto.

---
## 2026-08-09 (noite) — as duas listas de lugar tinham anatomias diferentes sem ninguém ter decidido isso

O app tem duas listas que falam de cidade, e elas foram desenhadas separadas:
o card da varredura (~235px, quatro elementos) e o item do histórico de
consultas (~90px, três). João, com as duas na mão: *"um eu acho muito simples
(busca) e o outro muito grande, e não sei se essas contagens são úteis de
fato"*. E a direção, que é o que importa: *"se fizesse um merge dos dois, mas
pudesse colocar em cada estrutura informações úteis para cada propósito"*.

**A divergência era estrutural, não de densidade** — e a causa do tamanho do
card não eram os números, era o card **dizer a mesma coisa duas vezes**: a
frase afirmava *"Patrimonial responde por 52%, a maior fatia"* e a linha logo
abaixo mostrava `11 PATRIM. · 6 SEGUR.`. O maior número e a maior fatia são o
mesmo fato em duas linguagens.

Nasceu `core/widgets/entrada_de_lugar.dart` com quatro posições. Quem preenche
decide **o quê**; a peça decide o espaçamento e o degrau de tipo, que era
exatamente o que estava escorregando entre as duas telas.

| | dashboard | consultas |
|---|---|---|
| ① etiqueta esquerda | UF + `6 NOVAS` em verde | UF |
| ② etiqueta direita | `21 EM 30D` | a hora |
| ③ qualificação | prosa, **só quando tem o que dizer** | `30 DIAS · 17 ASSUNTOS` |
| ④ figura(s) | quebra por categoria | `56 RESULTADOS` |

Três ganhos que caíram de graça do arranjo:

- o `21 EM 30D` foi para ②, que é **exatamente o que a `QuietCityRow` já
  escrevia** e o que o cabeçalho da cidade escreve. Cidade quieta e cidade
  agitada passaram a dizer a mesma frase no mesmo lugar;
- `3 CIDADES` morreu e virou os nomes em ③ — "Grande Florianópolis" não informa
  nada a quem não é de lá, e o app é vendido para fora da cidade monitorada;
- na consulta que falhou, o `FALHOU` ocupa ④ (onde ia o número) em vez de
  disputar a linha de cima com a hora. A exceção passou a ficar onde o olho já
  vai.

**A regra de ③, que é a decisão de fundo:** só entra o que **nenhuma figura do
card mostra**. Por isso cidade sozinha fica muda ali. A objeção era "duas
alturas na mesma lista" — mas altura variável não é defeito dessa lista, é o
mecanismo dela: cidade sem novidade já nem bloco é, vira `QuietCityRow` de
44px, e o comentário do arquivo registra o porquê desde 08/08.

Card de 235px → ~175px, sem perder um dado.

**E o `EndMark` morreu.** Em três horas ele foi `— 30 —`, depois `FIM`, depois
nada: *"não precisa escrever fim também né"*. Sete telas carimbavam a mesma
palavra para dizer o que a rolagem já diz; sobrou o ar do rodapé.

### O erro da sessão: `dart format lib/`

Formatei a **pasta inteira** em vez dos arquivos do commit. O formatador do
Dart mudou de estilo na 3.7 (corpo de expressão passou de indentação pendurada
para bloco) e o repositório nunca tinha passado por ele: **43 arquivos, 1386
inserções, 1198 remoções, zero mudança de comportamento**. Reverti tudo com
autorização e redigitei as mudanças reais à mão, no estilo do repositório.

Fica a regra: **`dart format` só nos arquivos que entram no commit.** Rodar na
pasta enterra uma remoção de uma linha no meio de 40 reformatadas e estraga o
`git blame` para sempre.

### Achado que não virou trabalho

`trendPercent` viaja em toda resposta do dashboard e vale **sempre 0** —
`analyticsQueries.ts` tem `const trend = 0; // trend removed`. O app carrega o
campo e expõe `trendUp`/`trendDown`, que ninguém chama. É campo morto nos dois
lados, e é justamente o único conteúdo que a prosa de ③ poderia carregar sem
repetir figura ("mais que no mês passado"). Custa uma segunda janela de
contagem no backend.

---

## 2026-08-09 (noite) — o relatório do grupo via uma cidade só, e três textos que o aparelho reprovou

**O relatório de um GRUPO mostrava só a primeira cidade.** Na Grande
Florianópolis o cabeçalho dizia `21 EM 30D` e o relatório logo abaixo dizia 12 —
dois números da mesma coisa, na mesma tela. A causa: os quatro endpoints de
analytics faziam `.eq('cidade', cidade)`, e o app mandava a **primeira** cidade
do grupo. O feed nunca teve esse problema porque já mandava `cidades=A,B,C`.

Agora as quatro consultas aceitam uma cidade ou muitas (`.in()`), e as rotas
aceitam `cidades=` **ao lado** de `cidade=` — o APK que já está na mão do
cliente continua funcionando. Três detalhes que só aparecem quando é grupo:

- o ranking de bairro passa a ser chaveado `Centro · Palhoça`, senão dois
  "Centro" de municípios diferentes viram um só;
- o `MapPointRaw` carrega a **cidade dele**, não a do filtro. Geocodificar um
  bairro contra o município errado põe o pino a ~20 km de distância com a mesma
  cara de pino certo;
- a chave do cache do executivo é a lista ordenada e juntada.

E **um bug meu, do commit anterior**: o `TUDO` da janela do relatório tomava
400. `analyticsQuery` e `analyticsTrend` tinham teto de 365 dias e o executivo
tinha `rangeDays` máximo 365 — três das quatro chamadas quebravam. Teto único
agora (`JANELA_MAXIMA_DIAS = 3700`), que é sanidade e não produto.

---

Depois disso, três coisas que só a foto do aparelho pega:

**1. A tela de login explicava uma regra que ninguém perguntou.** Embaixo do
link de esqueci a senha havia *"Não existe cadastro público e não sai e-mail
automático. As contas são criadas e liberadas por um administrador."* — duas
linhas de negativa na primeira tela do app. João: *"grosseiro e poluindo"*, e
ele está certo: é resposta sem pergunta, e a pergunta só existe **depois** de
tocar no link. Sumiu da tela; a informação continua no diálogo, sem a negativa
(*"Confirme o e-mail cadastrado. Um administrador libera uma senha nova e ela
chega por e-mail."*), e a confirmação depois de enviar diz o que ele pediu.

**2. `2 CIDADES` no cabeçalho de um painel com 4 municípios.** A conta era
`_cities.length` — verbetes, não cidades — e um grupo conta como um. O card
logo abaixo dizia `3 CIDADES` para o grupo, então a tela se contradizia sozinha
a 200px de distância. Agora o grupo vale pelo `cityCount`.

**3. `— 30 —`.** *"E o que é esse -30- no rodapé?"* — pergunta que já é a
resposta. Era a marca de fim de matéria de redação, e o comentário do próprio
masthead (o que matou a palavra "PRAÇAS") diz a regra: **a metáfora do fio
decide forma, nunca as palavras da tela; termo que precisa ser explicado não
entra.** Virou `FIM`. Junto foi embora o `hairline` (1.8:1) como cor de texto,
que também nunca deveria ter passado.

---

## 2026-08-09 (noite) — o que as fotos do aparelho pegaram, em três rodadas

Tudo nesta entrada saiu de foto de tela, não de análise. Vale registrar porque
os três achados são do mesmo tipo: **o app já sabia fazer certo em algum
lugar** e fazia diferente em outro.

**1. O relatório da consulta abria por um botão verde de largura inteira**, e a
tela da cidade resolve a MESMA decisão — ver a lista ou ver o relatório — com
uma aba de duas palavras. João, com as duas telas lado a lado: *"um é esse
botão com CTA horrível, e o outro a tabzinha relatório/notícias, perfeita ali"*.
O `report_screen` deixou de ser tela (sem `Scaffold`, sem `Masthead`) e virou
corpo de um caderno; quem desenha o topo é quem hospeda. Junto foram embora o
`_reportId`/`_openReport`/`_checkForReport`, que existiam só pra decidir se o
botão dizia "gerar" ou "ver" um relatório que **sempre existiu** — ele é
calculado do resultado que já está na mão.

**2. "Olha a fonte, muito ruim, as fontes do feed são melhores."** A fonte era
a mesma (Archivo). O errado era a **entrelinha**: o título do item do histórico
era `body().copyWith(fontSize: 20)`, e o `body` carrega `height: 1.4` —
entrelinha de parágrafo num título de uma linha, que faz o nome flutuar dentro
do próprio espaço. A manchete do feed usa 1.13.

A causa era maior que a tela: **30 chamadas de `copyWith(fontSize:)` espalhadas
pelo app, em 14 tamanhos** (12.5, 13, 15, 15.5, 16, 17, 18, 19, 20, 21, 22, 25,
27, 40). Um arquivo de escala existe pra ser fonte única e estava sendo
contornado 30 vezes — e **cada contorno herda a entrelinha de onde saiu**, que
quase nunca é a certa. Os quatro degraus repetidos viraram nome (`sheetTitle`,
`dialogTitle`, `fieldValue`, `rowTitle`) sem mudar um pixel do que já estava
certo, mais o `entryTitle` que conserta o histórico.

**3. "Esse recorte deste documento tá poluindo muito"** — e o diagnóstico dele
foi mais preciso que "tem coisa demais": *"tudo importante, mas mal colocado"*.
Era uma caixa de quatro linhas com filete branco **antes do número**, dizendo
coisas que a frase de abertura já diz. Virou uma linha em mono embaixo da
frase, com o que sobrava de exclusivo (intervalo exato + hora de geração). A
caixa inteira continua fazendo sentido no **documento exportado**, onde quem lê
não tem a frase acima.

E o mais importante: **a ordem inverteu**. O número vem primeiro, os controles
depois. Eles só interessam a quem já viu o resultado e quer mexer nele —
ninguém abre um relatório decidindo antes se inclui a região metropolitana.

### O relatório da cidade tinha DOIS períodos

Também da foto: *"por que no auto-scan o relatório da Grande Florianópolis está
mostrando os últimos 30? Tem que poder mostrar desde o início."*

Estava pior do que ele viu. A constante `30` estava chumbada em **três**
lugares (`_loadOverview`, `_loadMapPoints` e o `rangeDays` do executivo), e
logo abaixo havia um seletor de `7d/30d/90d/1a` que mexia **só no gráfico de
volume**. A mesma página com dois períodos, sem nada avisando — o que é pior
que um período errado, porque quem lê soma os dois.

Agora é uma janela só (`JanelaDoRelatorio`, em `report_pieces.dart`), no topo,
movendo tudo: números, rosca, bairros, mapa, volume e indicadores. Com `TUDO`,
que era o pedido — o produto acumula desde que o auto-scan começou e não havia
como ver isso. A frase de abertura segue a janela: dizer "nos últimos 30 dias"
com o seletor em TUDO seria a mesma mentira que o carimbo `00:00` contava.

---

## 2026-08-09 (noite) — Fase E: o relatório era duas telas copiadas, e o carrossel escondia dado

Pedido do João, palavra por palavra: **"mantém estrutura, revisa design"**. E
uma correção dele — falou "mapa", quis dizer "relatório". Não estava tão errado:
o mapa mora dentro do relatório, nas duas telas.

**Porque são duas.** `report_screen.dart` (busca manual, números calculados no
aparelho) e a aba Relatório de `city_detail_screen.dart` (auto-scan, números
agregados pelo backend) desenhavam **o mesmo relatório em código separado**:
dois donuts, dois rankings de bairro, dois `_statBox`, dois `_sectionTitle`,
dois `_card`. Foi exatamente assim que a tela da cidade acabou com uma
**terceira tabela de cores** própria, achada na auditoria de 08/08 — quando o
desenho é copiado, a correção chega numa cópia só.

Então antes da estética veio `core/widgets/report_pieces.dart`:
`BlocoRelatorio`, `RankBarras`, `TabelaGemea` e `RoscaCategorias`. As duas telas
montam das mesmas peças; o que sobra de diferente entre elas é só a origem dos
números, que é a única diferença que devia existir.

### O que mudou de verdade (não é só tinta)

- **abre com uma frase, não com um gráfico.** Eram quatro caixinhas
  (`107/OCORRÊNCIAS`, `18/BAIRROS`, `9/TIPOS`) que obrigam quem lê a montar
  sozinho a leitura — e nenhuma delas dizia a coisa mais importante. Agora o
  número grande vem com a frase montada dos próprios dados, terminando na
  ressalva: *"É o que a imprensa noticiou — não o total registrado pelas
  polícias."* Na **primeira dobra**, não num rodapé: quem vai citar o número
  numa reunião precisa saber disso antes.
- **todo gráfico tem gêmeo em tabela.** Rosca e barra mostram proporção e
  escondem o número exato; ninguém cita "uns 40% mais ou menos". É também o
  único caminho pra quem lê com leitor de tela.
- **o carrossel de indicadores morreu.** Eram fichas de 180px rolando na
  **horizontal** dentro de um documento que rola na vertical: o terceiro
  indicador ficava atrás de um gesto que ninguém adivinha. Virou lista, com a
  estrutura que um indicador precisa ter pra ser citado — **valor · o que é ·
  de quando/de quem**. E as duas cores de sentido (`0xFF22C55E`, `0xFFE05252`)
  vinham de fora da paleta: mais uma tabela paralela, agora em `SIMEopsColors`.
- **os dois chips ambíguos viraram chaves.** `+ 34 anteriores a 12/07` e
  `+ 12 da região` eram `ChoiceChip` r20 — e chip aceso e chip apagado parecem
  a mesma coisa a um metro de distância, para dois controles que **mudam todos
  os números da página**. Agora são linhas com interruptor e a descrição do que
  cada um soma.
- **ranking em uma cor só.** Magnitude nominal não se colore por valor: pintar
  o primeiro bairro de vermelho e o último de verde inventa um juízo
  ("perigoso"/"seguro") que o dado não sustenta — são contagens de citação em
  matéria, não taxas por habitante.
- **a precisão do ponto, declarada**: `18 de 25 ocorrências entraram no mapa —
  o resto não traz bairro na matéria`. Um mapa que desenha 18 de 25 sem dizer
  isso deixa quem lê concluir que a cidade inteira está ali.
- **datas escritas à mão** (`5 de julho de 2026`). `DateFormat('pt_BR')` precisa
  de `initializeDateFormatting`, e sem isso a data sai **em inglês** — num
  documento que o cliente encaminha pra outra pessoa.

O `_Switch` retangular que morava privado no `settings_screen` virou
`core/widgets/interruptor.dart` — o relatório precisou do mesmo desenho e a
Fase F vai precisar de novo, nas preferências de notificação.

A rosca **fica** (decisão do João): ela carrega o panorama e a legenda carrega a
comparação. O que mudou nela foi filete fino em vez de anel gordo, total no
centro e quadrado em vez de bolinha na legenda.

`flutter analyze` nos mesmos 2 infos preexistentes.

---

## 2026-08-09 (noite) — Fase C: a espera vira log, e a lista que eu ia acumular não devia acumular

**As duas dúvidas que estavam anotadas tinham resposta boa — e as duas eram
dado que já existia e era jogado fora uma linha depois.**

**1. Não-lidas por cidade-filha.** `analyticsQueries.ts` calcula `s.unread`
**por cidade** e, ao montar o grupo, faz `unread += s.unread` — a quebra existia
e morria na mesma linha. Pior: as cidades que pertencem a um grupo são removidas
do payload logo abaixo (pra não duplicar no dashboard), então o app não tinha de
onde tirar. Agora o item de grupo leva `naoLidasPorCidade` (cidade → não-lidas,
zero não entra, mesma regra do `categorias30d`). **Nenhuma query nova.** A fila
`TODAS · FLORIANÓPOLIS · PALHOÇA 4` finalmente diz onde olhar. `TODAS` não leva
número de propósito: o total já está no cabeçalho, uma linha acima.

**2. Achado rico.** `AchadoProgresso` levava `tipo_crime`, `bairro` e
`data_ocorrencia`; `titulo`, `cidade` e `categoria_grupo` estavam no mesmo
`r.extraction` (`pipelineCore.ts:406`) e eram descartados. Agora vão junto —
zero token, zero chamada. A espera mostra a manchete de verdade com o quadrado
da categoria, em vez de `Roubo/Furto · Kobrasol`.

### A decisão que eu tinha anotado errada

O ESTADO DO MUNDO dizia: *"o app pode acumular localmente — sete minutos de
espera viram sete de leitura"*. **Está errado, e o protótipo já sabia** (ele
mantém `while(lista.children.length>5)`).

O motivo é que **esses achados são pré-dedup**. Juntar as repetidas é o passo 6;
até lá, a mesma ocorrência publicada por três veículos chega três vezes.
Empilhar tudo na tela transformaria a duplicação — que é normal e esperada —
num **defeito visível**, e ainda faria a lista encolher no fim.

O que sobrevive da ideia é a **contagem**: `feitos/total` conta o que foi
*analisado*, não o que virou ocorrência, então sem acumular no app não há como
dizer quantas a consulta já achou. Ficou: `Set` de chaves pro contador
(`JÁ ENCONTRADO · 14`) e **janela de 8** pra lista.

### A espera

De 5 blocos com nome de engenharia (`TRIAGEM RÁPIDA`, `LEITURA`, `ANÁLISE`) para
os **7 estágios ditos em português de operação** — "Consultar a imprensa",
"Descartar o que não é ocorrência", "Baixar as matérias". O agrupamento existia
por um motivo técnico: só os estágios 4 e 5 mandavam contador, e os outros
ficariam mudos sozinhos.

**O que desfez isso foi `de → para`.** Cada estágio já gravava um `details` em
prosa (`619 URLs para filtrar`, `Consolidando 47 resultados`); lendo o primeiro
inteiro de cada um, o `de` de um passo é o `para` do anterior e **todo passo
ganha resultado próprio**: `619 → 412`, `412 → 155`, `47 → 31`. O estágio 7 era
o único sem `details` — passou a gravar o total final, três palavras no worker.

Sem isso a espera é sete linhas acendendo em ordem, e no fim ninguém aprendeu
nada sobre a própria consulta: nem por que demorou, nem onde o material se
perdeu.

Também entrou o que a spec §9 pedia e não existia:

- **falha no meio** não troca mais a tela por um `error_outline` de 64px. A
  lista de etapas **continua na tela** com a etapa que falhou em vermelho e um
  `PAROU AQUI` — dá pra ver que 619 links foram achados e que a coleta morreu no
  download, o que é informação útil pra decidir se vale repetir agora.
- **confirmação ao cancelar** ("ela roda no servidor e termina sozinha mesmo com
  o app fechado").
- **quanto falta**, pela taxa observada, só depois de 5 itens *e* 5 segundos —
  antes disso a taxa é ruído e a estimativa oscila de 40s pra 6min.

### O resultado

- `NewsCard` → **`TakeCard`**. Era o único lugar do app que ainda desenhava
  caixa com borda, canto arredondado e barra de cor lateral. E ele **ignorava o
  `titulo`**: os 53 resultados de Fortaleza chegaram com manchete escrita pelo
  GPT (o worker já mandava, `manualSearchWorker.ts:399`, e o `NewsItem` já lia)
  e a tela imprimia `ROUBO/FURTO · Barroso` no lugar dela.
- `CategoryFilterBar` → **a mesma folha do feed** (`FILTRAR`), com a linha de
  recorte só aparecendo quando há recorte. `SÓ NÃO LIDAS` sai da folha aqui:
  num resultado recém-extraído não existe lido e não lido.
- os `_metadataCard` arredondados viraram **três números que nunca somam** —
  `NO PERÍODO` em branco, `REGIÃO METROPOLITANA` e `ANTES DE 5 JUL` em `muted`.
  Somá-los diria que a cidade teve 34 ocorrências quando teve 13. De quebra
  morreram os rótulos quebrando no meio da palavra (`OCORRÊNCI/AS`,
  `INDICADORE/S`), que era o que três caixas com borda fazem em 376px.
- o balde do que ficou fora agora se chama pela **data real** (`ANTES DE 5 JUL`)
  em vez de "fora do período", que obriga a lembrar qual era o período.
- **resultado magro** ganhou a ressalva do protótipo: recorte curto rende pouco
  porque a imprensa publica o que publica — e as duas alavancas reais são
  período e assuntos.
- o topo passa a dizer **de qual consulta se trata**: nome da cidade no lugar de
  "Consulta", recorte à esquerda, cronômetro à direita enquanto roda e o número
  quando acaba.

Um estilo novo no `SIMEopsType`: `etapa()` — mono 11 com o **tracking de rótulo
desligado** (0.44 em vez de 1.5). Frase em mono com espaçamento de etiqueta
obriga a soletrar.

`npx tsc --noEmit` limpo, `flutter analyze` de volta aos 2 infos preexistentes.

---

## 2026-08-09 (noite) — o `00:00` estava em 100% dos itens

### 🚨 O carimbo de hora mentia em toda matéria do app

Achado do João olhando o aparelho:

> *"é muito melhor saber que hora que foi o acontecimento do que que hora foi a
> varredura, esse 00:00 aí é inútil"*

Fui ao schema: **`data_ocorrencia` é coluna `DATE`**. O carimbo da slug lia a
hora dela, e coluna DATE volta sempre à meia-noite. Não era um caso raro — era
**todo item, sempre**, ocupando a linha mais disputada do card pra dizer nada.

**Migration 030** (`hora_publicacao TIME`, nullable) + o Filter2 extraindo.

Três decisões que valem registro:

- **hora de PUBLICAÇÃO, não do fato.** A do fato quase nunca é extraível ("por
  volta das 3h da madrugada" é aproximação, às vezes de outro dia); a de
  publicação está impressa em praticamente todo portal. E é o que um carimbo de
  fio significa: quando a matéria entrou no fio.
- **não usar `created_at`.** Essa é a hora da *varredura* — exatamente o que o
  João apontou como inútil. Matéria publicada 07:40 e varrida 23:10 carimbaria
  23:10.
- **`TIME` sem fuso, de propósito.** É a hora local que o portal imprimiu, e não
  sabemos com que offset foi escrita. **Exibir cru, nunca converter.**

Nullable dos dois lados, e **o app omite o carimbo quando vem null** — inventar
meia-noite é o bug que a coluna existe pra corrigir. O regex `HH:MM` no backend
descarta `"14h32"`, `"por volta das 3h"` e a string `"null"`, que é o que o
modelo devolve quando não acha.

`data_ocorrencia` **não** foi tocada: é DATE, indexada, usada em todo filtro e
ordenação do sistema.

### O resumo passa a ter o tamanho que o fato pedir

*"n precisa ser exatamente esse. O modelo vê o quanto precisa gastar pra
descrever o acontecimento."* — o prompt saiu de "exatamente 2 frases" para
"quantas frases o fato precisar, normalmente 2, às vezes 1". O teto de 190 virou
**orçamento, não meta**, com a instrução explícita de nunca encher pra chegar
nele.

### A folha voltou, e agora justifica existir

O toque tinha passado a ir **direto pra URL externa**. O João barrou: jogar o
usuário pra fora do app é decisão grande demais pra um toque, e a folha ainda
tem o que dizer.

Ela voltou com a condição dele — **trazer o que o card não tem**:

| | card | folha |
|---|---|---|
| rua | — | ✓ |
| tipo granular (`Roubo`) | categoria (`Patrimonial`) | ✓ |
| data por extenso com dia da semana | só a hora | ✓ |
| todas as fontes, cada uma abrindo | só a primeira | ✓ |

O tipo granular é o campo com que o **relatório conta**, e o card mostra só o
grupo — ali é informação nova, não repetição. A data por extenso é feita à mão
em vez de `DateFormat(..., 'pt_BR')`: o locale do intl exige carregar dados de
localização na partida do app, dependência de inicialização pra formatar uma
data por tela.

---

## 2026-08-09 — Fase B: o formulário, e a sanfona morreu com um argumento melhor

### O formulário: 11 blocos → 5

`onde · o que perguntar · desde quando · a conta · o botão`. Diagnóstico medido
antes de mexer (está no cabeçalho do `_buildForm`): o tempo aparecia **4 vezes**,
havia **5 tratamentos** diferentes de caixa arredondada, e o 3º preset
`ESCOLHER` **fingia ser preset** — é porta, não atalho.

- estado e cidade viraram linhas com filete, abrindo folha com busca
  **sem acento** (`sao jose` acha `São José`);
- os presets viraram linhas com a conta à direita; `ESCOLHER ASSUNTO POR
  ASSUNTO →` virou link, fora da pilha, porque clicar nele não escolhe nada;
- os cinco períodos viraram retângulos encostados, e a data exata uma linha —
  era uma sexta caixa competindo com as cinco de cima;
- a conta virou número em corpo 40 colado no botão.

⚠️ **Desvio deliberado do plano**, que dizia "o tempo aparece uma vez só": ele
aparece **duas** — nos presets, onde serve pra *comparar*, e no número grande,
onde é a *decisão*. Sem o tempo por preset o usuário não enxerga a troca antes
de escolher, que é exatamente o que a tela existe pra mostrar.

**Nada de capacidade saiu** (o João pediu explicitamente): a taxonomia inteira e
a palavra-chave livre estão na `FolhaAssuntos`. O texto que explicava o teto de
~60 notícias por pergunta saiu do ícone de "?" e foi pra dentro dela — explicação
atrás de interrogação é explicação que ninguém lê, e essa é a tese do produto.

Morreram: `multi_city_search_field.dart` (feito pra N cidades com `maxCities`
já em 1 — desenhava ficha removível e "1/1 cidades selecionadas" pra um caso
impossível), `city_search_field.dart` e `simeops_title.dart`.

### 🚨 A sanfona morreu no mesmo dia em que nasceu

Eu tinha proposto **e o João aprovado** a matéria expandindo no lugar. Vendo
funcionando ele inverteu, e com argumento melhor:

> *"a gente poderia fazer a resposta do gpt coincidir com o tamanho max pra n
> truncar ali, dessa forma o usuário só clica na notícia pra entrar na url e não
> pra ler o que tava ali"*

Minha premissa era "resumo longo precisa de um lugar, logo expande". A dele:
**se o parágrafo cabe inteiro, não precisa de lugar nenhum** — e aí o toque tem
UM significado (abrir a fonte) em vez de dois que o usuário não distinguia antes
de tocar.

**A medida não é chute.** Os dois parágrafos do protótipo de referência têm
**189 e 197 caracteres**; o card tem 376px úteis e a lide é Archivo 14.5, ou
seja ~52 caracteres por linha = 4 linhas. Teto: **195**, com `maxLines: 5` como
rede pro pior caso tipográfico (0.6em daria 4.5 linhas).

O corte é em **fim de frase** (`cortarNaFrase`), nunca no meio de palavra:
reticências num título são toleráveis, num parágrafo são bug — o leitor fica sem
o desfecho.

Custo de tirar a sanfona: as fontes secundárias perderiam a porta. `3 FONTES`
virou tocável e lista os veículos — caso raro atrás de um toque num número que
já estava na tela.

### O parágrafo tem que COMPLEMENTAR a manchete

Segunda observação do João no mesmo turno. Eu tinha escrito no prompt *"não
repetir a manchete literalmente"* — adjetivo, que modelo nenhum obedece. Virou
exemplo, que é o que funciona:

```
Manchete: "Empresário é preso vendendo peças de veículos roubados"
RUIM: "Um empresário foi preso por vender peças de veículos roubados. A prisão
       aconteceu em flagrante."
BOM:  "A Operação 311 prendeu o homem em flagrante em Palhoça. Foram apreendidos
       componentes de sete veículos, dois deles com registro de roubo."
```

Mais duas travas: nenhuma frase pode começar com pronome apontando pra manchete
(`ele`, `o caso`), e **120 caracteres que acrescentam fato ganham de 190 que
repetem** — senão o modelo enche linguiça pra chegar ao teto.

### 🚨 A frase do card falava outra taxonomia que os números

Achado da foto do João: o card dizia *"Homicídio responde por 24%, a maior
fatia"* e logo abaixo mostrava `11 PATRIM. · 6 SEGUR.`. A frase vinha de
`topCrimeType` (**tipo** de crime) e os números de `categorias30d`
(**categoria**). Os dois estavam certos — homicídio é um tipo dentro do grupo
Segurança — mas **denominador diferente na mesma tela lê como erro**, e num
produto de dado número que não fecha é o defeito que mais destrói confiança.

Agora a frase sai da mesma fonte dos números. É o mesmo raciocínio do selo "42"
que eu tinha apontado no protótipo, acontecendo no código.

### O respiro entre cidades: era hierarquia, não espaço

*"tá tudo muito junto entre o grande florianópolis e porto alegre, o olho não
tem respiro"*, e ele completou que **o card com borda de antes parecia mais
organizado**.

A causa: **dois filetes desenhados iguais fazendo trabalhos opostos** — um
dentro do card (acima dos números) e um entre as cidades — com espaçamento quase
igual (27px contra 36px). O olho não tinha como saber qual separava parágrafo e
qual separava cidade. A caixa antiga dizia "isto é uma unidade" sem ambiguidade;
o fio tem que ganhar isso com espaço e **um traço só**.

- filete de dentro: removido (números a 21px já se separam da prosa a 14.5);
- filete de fora: `ruleStrong` — aqui são 2-3 blocos altos. No feed, com 18
  matérias, o fraco continua certo: traço forte 18 vezes vira grade;
- ar entre cidades: 36px → **52px**.

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
