# DEV_LOG — SIMEops (Fase 12: níveis de acesso)

> 🗂️ **Documento da Fase 12** — arquivado em `Fases/Fase 12/` quando ela fechar.
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
> Fases 1 a 11 arquivadas em [Fases/](./Fases/).

---

## 🚦 ONDE PARAMOS — 04/09

> Única seção deste arquivo que se **sobrescreve** em vez de acumular.
> Teto: ~25 linhas.

✅ **O PLANEJAMENTO DA FASE 12 FECHOU.** Reunião com a SIC (Major e Sargento da
PM, donos) confirmou quase tudo e mudou três premissas. **Nada em conflito com o
que foi decidido em 03 e 04/09 vale mais** — os documentos já foram varridos.

🚨 **O SIMEops virou sistema corporativo de campo.** A notícia **deixa de ser feed
e vira matéria-prima de indicador**; entram formulários de três frentes, cadastro
de pessoa com **prontuário**, e dois dashboards ao vivo. Moldura no
[ROADMAP](./ROADMAP.md), medições em
[FORMULARIOS_SIC](./Protótipo/FORMULARIOS_SIC.md), cada diferença e o argumento de
venda em [MUDANCAS](./Protótipo/MUDANCAS.md), a reunião em
[REUNIAO_SIC](./Protótipo/REUNIAO_SIC.md).

📌 **Nenhuma linha de código do produto mudou em toda a fase de planejamento.**

🔥 **Prazo: protótipo de dashboard até o fim de setembro** — o cliente final está
brigando com a SIC porque *"não atualiza sozinho"*. **O que mata a dor é o cano,
não a tela.**

✅ **Fechado:** tema claro e tipografia grande (18px piso — o dono não consegue
ler) · a coluna vertebral deles é intocável, a gente só arruma · papel é N:N e é
regra de **produto**, não só de acesso · a loja registra ocorrência e a divergência
vira indicador · reconhecimento facial descartado, biometria vem do aparelho ·
unidade guarda bandeira **com vigência** · CPF e RG não entram · dado de terceiro
entra por exportação em mão única.

🆕 **O Claude passa a ver a própria tela** — Chrome headless + leitura do PNG. Ver
[CLAUDE.md](../CLAUDE.md) §4. Primeira prova em
[Protótipo/telas/feed.png](./Protótipo/telas/feed.png).

⬜ **12 dúvidas em aberto**, listadas no [ROADMAP](./ROADMAP.md). As duas que mais
travam: **a parceria pública é formalizada?** (sustenta o prontuário) e **tem sinal
dentro da loja?** (decide se o app é local-first).

⬜ **Próximo, sem depender de ninguém:** normalizar lojas e pessoas da base para
calcular os indicadores da demo — é também o importador que o produto vai precisar.

⬜ **Herdado:** chamado à Bright Data · alerta de "N scans sem achar nada" ·
decidir São Paulo no rodízio · APK 1.2.1+6.

---

## 2026-09-04 — o marceneiro e o dono do negócio, e o §5 do CLAUDE.md morre

Sessão de consultoria sobre como a workdesk e a memória se sustentam quando o
sistema dobrar de tamanho. Três achados, dois consertados aqui.

**1. O `Protótipo/` nunca esteve no git.** Zero commits o tocaram desde 30/08:
36 KB de MUDANCAS, 29 KB de FORMULARIOS_SIC e 25 KB de REUNIAO_SIC sem histórico
e sem backup — justamente os documentos que não se reconstroem, porque o motivo
some com a sessão que o gerou. Commitado em `933d92c`, com `formularios/` e
`Relatório/` barrados por `.gitignore` (dado pessoal real: planilha de
atendimentos e capturas de formulário preenchido).

**2. O §5 do CLAUDE.md estava 86% morto.** A árvore de `backend/src` que ele
desenhava citava sete caminhos; **seis não existiam mais** — pipeline em `jobs/`,
scheduler em `jobs/scheduler/`, push em `services/notifications/`. É o documento
mais caro do projeto (entra em contexto em todo turno, ~4.000 tokens) e apodreceu
calado porque o verificador não checa árvore, só identificador em crase. A árvore
saiu; no lugar ficou o porquê de ela não voltar, mais o ponteiro para a fronteira.

**3. Não existe papel no sistema.** Medido: a identidade que o backend carrega é
`{ id, email }` e o único portão é `is_admin`. `requireSearchPermission` é
interruptor global, não papel. Nada errado a desfazer — fundação ainda não
construída.

**O que entrou na ARQUITETURA:** o §3.5, com a ordem das camadas
(`routes → services → database`, nada aponta para cima), a exceção acidental do
logger em `middleware/logger.ts` — que faz `database` e `config` importarem de
`middleware` sem precisar —, e a regra que separa módulo de papel: *módulo é
capacidade e não sabe quem o usa; papel é linha no banco*. O teste que resume:
**criar papel novo é inserir uma linha, não fazer deploy.** Mais a regra 11 do §2,
que põe o recorte de quem-vê-o-quê numa camada só — com quatro frentes de leitura
planejadas, filtro em tela é quatro chances de vazar dado sensível.

**A divisão do trabalho entrou no CLAUDE.md §1** — pedida pelo João nesta sessão,
com a analogia dele: *"o marceneiro é responsável pela parte técnica, mas pergunta
ao cliente, porque é o cliente que é dono do negócio"*. Dele: lógica e desenho do
sistema, o que o cliente precisa, o que o produto promete — **nunca se infere**.
Do Claude: como se faz. E como ele **não lê código e não vai revisar**, duas
regras deixam de ser estilo e viram obrigação: perguntar com recomendação e
consequência (nunca menu aberto, que gasta a atenção dele) e **reportar em
comportamento, não em código** — é a língua em que ele é o especialista, e é o que
substitui a revisão que ele não pode fazer.

Junto entrou o teste que separa as duas caixas, porque a linha real não é
"código vs. desenho": **muda o que uma pessoa vê, faz ou sente, ou o que o negócio
pode prometer? Então é dele** — mesmo chegando vestido de detalhe técnico. E o
método dele: planejamento largo primeiro, detalhe fino quando a etapa chega. Não
é indecisão; instância nova não deve exigir que ele feche tudo na largada.

Custo: o CLAUDE.md foi de 14.348 para 17.698 chars (~+900 tokens em **todo**
turno). Paga-se porque é comportamento, não consulta. Se precisar recuperar
espaço, o candidato a sair é o §8 (URLs e custos são referência).

### A suíte estava 60% vermelha, e nenhum vermelho era bug

Diagnóstico das 10 suítes quebradas (25 testes de 176), uma por uma até a causa
raiz: **nenhum bug de código.** Todas eram testes descrevendo um sistema que já
tinha mudado. Nenhuma linha de `src/` foi tocada. Resultado: **17/17 suítes,
207 testes verdes**, `tsc` limpo.

🚨 **O achado que justifica o esforço:** oito testes do `filter1` exigiam que,
com a OpenAI fora do ar, o filtro **aprovasse todos os trechos** — exatamente o
que a regra 8 do §2 proíbe. Uma instância com pressa "conserta" isso mudando o
**código** para o teste passar, e reintroduz um vazamento de dinheiro já
consertado. Teste desatualizado não é neutro: é instrução errada esperando
alguém obediente.

**Três famílias de apodrecimento**, que valem para o resto do projeto:

1. **Mock apontando para o lugar antigo.** `filter1`, `filter2` e `dedup`
   mockavam o pacote `openai`; o código passou a usar o client compartilhado
   `services/openaiClient`. O mock não interceptava mais nada — e o `dedup`
   ainda abria Redis de verdade pelo `pipelineCore`, **pendurando** a suíte em
   vez de falhar.
2. **Fixture com o tamanho errado, medindo o caminho errado.** Embeddings de 3 e
   10 dimensões onde o código exige 1536, conteúdo de 31 caracteres onde a
   guarda pede >100. O pior caso: no `dedup`, todo candidato era descartado como
   inválido e a função respondia "não é duplicata" **sempre** — dois testes
   passavam esperando `false` sem exercitar nada. Falso verde é pior que
   vermelho.
3. **Contrato mudou.** `filter1` devolve `{ results, tokensUsed }`, não um
   array; `cidade` virou `cidades`; `update().eq()` virou `upsert`; a taxonomia
   perdeu os acentos e agrupou (`roubo` → `roubo_furto`).

**Dois testes viraram proteção, em vez de serem apagados:** os do `filter0` que
exigiam barrar "futebol" e "receita" foram **invertidos** — agora afirmam que
"torcedor morto" e "Receita Federal apreendeu" *passam*. Se alguém devolver as
palavras ambíguas à lista, ficam vermelhos. E o retry do `cronScheduler`
(5x/60s = ~31 min) foi documentado como a **outra metade** da regra 8: o Filter1
lança, o backoff espera a OpenAI voltar. Mexer num sem o outro quebra a decisão.

Os nomes dos testes passaram a ser escritos em **comportamento e em português** —
a lista que o Jest imprime vira uma lista legível do que o sistema promete, que é
como o João revisa sem ler código.

⚠️ **ACHADO NÃO CONSERTADO — decisão do João.** O `filter1` trata erro de forma
diferente conforme o tamanho do lote. Com 2+ trechos: 2 tentativas, Sentry,
`throw` (o BullMQ re-enfileira). Com **1 trecho**: 1 tentativa, devolve `false`,
**sem Sentry** — a notícia some e ninguém fica sabendo. Não viola a regra 8 (não
aprova nada indevidamente), mas é falha invisível. Está fixado num teste que diz
explicitamente descrever o comportamento atual, não o desejado.

📌 **Ainda pendente:** o CI (`tsc` + `npm test` em todo push) — sem ele a suíte
volta a apodrecer, e agora ela é a única coisa que impede a regressão do
`filter1`. Mais: `npm test` na definição de pronto do §3, o workflow consolidado
no CLAUDE.md, e o verificador estendido (teto do ONDE PARAMOS — hoje 44 linhas
para um teto de 25 —, teto do 🔴 AGORA, regra de fronteira).

---

## 2026-08-30 — o remendo passou no único teste que valia

Scan de São Paulo em produção, 01:23 UTC, com o código novo de verdade:

```
urls=40  achou=2  66s  US$0,0188
rejeicoes: 25 com endereco ABSOLUTO  (o resolverGoto fez o trabalho)
fontes gravadas: band.com.br, politizabrasil.com.br
```

E o push chegou no celular do João. **Fim a fim, no aparelho** — que é o único
teste que a ARQUITETURA §6 diz não dar para fazer sem incomodar o cliente.

**A dúvida que importava era o IP.** O remendo tinha sido medido de máquina
residencial, e o Google trata datacenter com outra desconfiança. Passou: o Render
resolve os redirects normalmente.

### O tropeço no meio, que vale registrar

O primeiro teste depois do deploy (01:14) voltou `achou=0` com rejeições ainda
**relativas** — e por um instante pareceu que o remendo não tinha funcionado.
Não era isso: **o Render faz deploy sem derrubar.** A instância antiga continua
servindo, e consumindo a fila, até a nova ficar pronta. O scan das 01:14 rodou 30
segundos depois de a nova subir — e foi a velha que o pegou.

A lição: depois de um deploy, **esperar a instância antiga morrer antes de
concluir qualquer coisa do primeiro teste.** `uptime_seconds` no `/health` diz
quando a nova assumiu, mas não diz quando a velha parou.

### O que este dia deixa em aberto

O conserto é remendo e o assunto não se encerra: cada resultado custa uma
requisição a mais ao Google. O chamado à Bright Data segue valendo — a doc DELES
promete `news[].link` como a URL da matéria.

E fica a defesa que faltava: o log `goto: N/M resolvidos` aparece sempre, e zero
de N aciona o Sentry. Se o Google fechar essa porta, a gente descobre no mesmo
dia — não em três.

---

## 2026-08-29 (4) — o remendo: pedir o destino em vez de tentar ler o código

O `/goto` não se decodifica, mas **se pergunta**. O link relativo resolve contra
a página que o serviu (`www.google.com`); pedindo esse endereço com
`redirect: 'manual'`, o Google responde **302 com o `Location` apontando para o
veículo**. Medido em 29/08: 3 de 3 na sondagem manual, depois **20 de 20** pelo
caminho real do worker — g1, Band, R7, Gazeta SP, Record, Diário de Suzano.

De graça, sem Bright Data no meio. O que a gente estava tentando fazer era ler a
plaquinha; bastava perguntar pra onde ela aponta.

### O que ficou no código, e por quê

`resolverGoto` roda no fim de `searchSerpPaginated`, **depois do `slice`** — só
resolve o que vai ser devolvido, não o que a paginação especulativa trouxe a
mais. Concorrência **6**, de propósito baixa: são requisições ao Google, que está
justamente tentando barrar isso. Quem não resolve **cai fora** — URL relativa não
é endereço, o Jina não baixaria e o item morreria adiante de qualquer forma, só
que em silêncio.

🚨 **A linha de log `goto: N/M resolvidos` é a defesa que faltou em 26/08**, e é a
parte que interessa mais que o conserto. O sistema passou três dias gravando
`news_found=0` de hora em hora, gastando dinheiro, sem uma linha dizendo por quê.
Agora a taxa aparece sempre, e **zero de N aciona o Sentry** — porque zero é o
sinal de que o Google fechou a porta de novo, e ninguém repara sozinho.

### O que este conserto NÃO é

**É remendo.** O certo é a Bright Data devolver o endereço, como a documentação
deles promete. Enquanto não devolve, cada resultado custa uma requisição a mais
ao Google — e o Google pode fechar essa porta amanhã, como fechou a de 2024.

⚠️ **E ele ainda não foi provado onde importa.** Rodou de IP residencial. O
Render é datacenter, e é lá que o Google desconfia. É a primeira coisa a conferir
depois do deploy — pelo log, não pelo achismo.

### A zone atual não serve de plano B

Testado antes do remendo: mandar o `/goto` pela nossa zone da Bright Data devolve
`x-brd-error: this endpoint is not supported`, `invalid_path`. A zone é de SERP e
só aceita `/search`. Um plano B via Web Unlocker exige **zone nova**, criada no
painel deles — não é config nossa.

---

## 2026-08-29 (3) — é o `google.com/goto`, e o endereço não vem em campo nenhum

O que matou o feed tem nome, dono e data: **o Google confirmou em 26/08/2026** que
está trocando os links dos resultados por `google.com/goto?url=<código>`. Começou
a testar em julho e terminou de soltar no dia 26. **A última notícia entrou no
nosso feed em 26/08 às 15:01.** Mesmo dia.

Não é bug nosso nem negligência da Bright Data: pegou o mercado inteiro de
raspagem de SERP. O propósito declarado é dificultar exatamente o que a gente faz.

### O que foi medido no JSON cru (29/08, 1 requisição)

Varredura recursiva de **todos** os campos de **todos** os itens atrás de qualquer
URL `http(s)` que não fosse do Google: **nenhuma**. O item traz:

| campo | estado |
|---|---|
| `title` | ✅ íntegro |
| `description` | ✅ íntegro, e bom o bastante pro Filter1 |
| `source` | ✅ o **nome** do veículo ("R7") |
| `date` | ✅ |
| `image` / `source_logo` | ✅ base64 |
| `link` | ❌ só `/goto?url=CAES…`, relativo e opaco |

**Decodificar não é opção:** o Google fechou esse caminho em 2024. O endereço só
se recupera **seguindo** o redirect, um por um.

### O que isso invalida das hipóteses anteriores

Duas afirmações minhas de hoje estavam erradas e ficam registradas:

1. *"O Filter1 está reprovando por receber lixo"* — **falso**. Medido no filtro
   real com dados reais: Filter0 passa 20/20, Filter1 aprova 18/20. Os snippets
   chegam perfeitos. O `(sem titulo)` que eu vi no banco é artefato do logger,
   que grava `title: ''` fixo em `scanPipeline.ts`.
2. *"Pode ser conserto de uma linha"* — **falso**. Não há campo alternativo.

O que quebra o pipeline é mais fundo que os filtros: sem endereço, o Jina não
baixa o artigo, e sem artigo o Filter2 não extrai cidade, data nem tipo.

### A doc da Bright Data não serve de prova aqui

Nenhum parâmetro de redirect documentado, e as **release notes deles param em
janeiro/2026** — sete meses de atraso. Quem responde o que a API devolve hoje é
uma requisição, não a página deles. A concorrente **DataForSEO publicou a
correção em 28/08**, dois dias depois do anúncio do Google: dá para resolver, e
alguém já resolveu.

---

## 2026-08-29 (2) — o feed estava morto havia 3 dias, e o culpado não era nosso

O João abriu a sessão querendo deployar e rebuildar o app porque *"acho que ele
não tá funcionando"*. As duas coisas eram legítimas — e **nenhuma das duas era o
problema**.

### O que a medição mostrou, em ordem

`/health` respondeu **200, banco ok, redis ok**: produção não estava caída.
Estava **velha** (`5654361`, 12 dias). Isso explicava o dedup e o corpo da
notícia, mas o sintoma que o João relatou era outro: *"o feed parou de receber
notícia"*.

O banco de produção respondeu o resto:

| dia | urls processadas | notícias gravadas |
|---|---|---|
| 24/08 | 588 | 18 |
| 25/08 | 519 | 9 |
| 26/08 | 527 | 2 |
| 27/08 | 544 | **0** |
| 28/08 | 591 | **0** |

O scan **nunca parou** — `last_check` de 28/08, `budget_tracking` gastando até
28/08 20:00. Ele processa 500+ URLs por dia e não grava nada.

### A causa, medida ao vivo

`pipeline_rejected_urls` mostrou 100% das rejeições de 27 e 28/08 com a URL na
forma `/goto?url=CAES…` — **relativa, não absoluta**. Antes de 26/08 15:01, 100%
eram URLs reais de veículo (`ndmais.com.br`, `g1.globo.com`, `terra.com.br`).

A sondagem pelo caminho real (`searchProvider.search` do `pipelineCore`, uma
query, ~US$ 0,05) confirmou **ao vivo**: 20 de 20 resultados vêm com `link`
relativo. **Os títulos vêm certos** ("Confronto com tiros termina com três presos
em Florianópolis") — o que quebrou foi só o endereço.

### Por que isso não é culpa de nada que fizemos

`git diff 5654361 develop -- backend/src/services/search/` é **vazio**. O parser
é o mesmo desde 17/08: ele lê `item.link`, e `item.link` mudou de significado do
outro lado do cabo.

**A lição que fica:** o sistema tinha três defesas contra apodrecimento de
*documento* e **nenhuma** contra apodrecimento de *contrato externo*. O scan
seguiu gastando dinheiro, marcando `last_check` e escrevendo `complete` no
`operation_logs` por três dias, com `news_found=0` em toda linha. O dado que
gritava estava gravado — ninguém tinha um olho nele. Um alerta de "N scans
seguidos com zero achados" teria avisado em 27/08.

### O que NÃO fizemos por saber disso a tempo

Buildar o APK hoje. Além de o `corpo` só aparecer em notícia nova (e hoje ser
sábado, sem scan até segunda), **não existe notícia nova para aparecer**. O teste
teria falhado por três motivos empilhados, e o mais visível seria o errado.

---

## 2026-08-29 — a Fase 11 fecha, e o `/health` desmentiu o que todo mundo achava

**A Fase 12 abre com a workdesk rotacionada:** `DEV_LOG` e `ROADMAP` da 11 foram
recortados para [Fases/Fase 11](./Fases/), com cópia da ARQUITETURA e README
próprio. O gatilho foi o do CLAUDE.md: o ROADMAP fechou porque o que vem a seguir
é outro assunto.

Junto, a colisão de numeração que estava marcada para explodir: o ROADMAP tinha
um item chamado **"⚡ Fase 12 — Acelerar o estágio 4"**, que nunca começou e já
tinha sido renumerado uma vez. Perdeu o número e virou só *"Acelerar o estágio
4"* — duas Fases 12 seria a segunda verdade nascendo pela porta da frente.

### O que o `/health` revelou, e por que ninguém tinha visto

A `main` **está** em `e1aa6ef`, como o ONDE PARAMOS da 11 dizia, mas **o que está
no ar é `5654361`**, de 17/08. As duas afirmações são compatíveis, e é aí que mora
a armadilha: **`git push` para `main` é aceito e não deploya nada.** O ponteiro
da branch anda, o `/health` não. Quem lê "a `main` está atualizada" conclui
"produção está atualizada", e as duas frases não se implicam.

O `MIGRATIONS_LOG` já registrava `5654361` desde 26/08, dentro da linha da
migration 034 — o dado certo existia, num lugar onde ninguém procuraria por "qual
código está no ar". É o argumento da ARQUITETURA §11 em estado puro: dois minutos
de comando contra dias de conclusão errada.
