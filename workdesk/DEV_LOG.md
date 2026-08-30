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

## 🚦 ONDE PARAMOS — 29/08

> Única seção deste arquivo que se **sobrescreve** em vez de acumular.
> Teto: ~25 linhas.

**O feed voltou a ter endereço — falta provar que volta no servidor.** O remendo
do `/goto` está em `BrightDataSERPProvider.resolverGoto`: prefixa o link relativo
com `https://www.google.com`, pede **sem seguir** o redirect e lê o `Location`.
Medido pelo caminho real em 29/08: **20/20 resolvidos**, `tsc` limpo.

🚨 **A prova que importa ainda não foi feita: isso rodou da máquina do João, IP
residencial.** O Google trata IP de datacenter (Render) com muito mais
desconfiança. Depois do deploy, o que responde é o log `goto: N/M resolvidos` —
se vier `0/M`, o Sentry dispara e o caminho vira Web Unlocker em zone própria (a
zone atual é de SERP e recusa `/goto` com `invalid_path`).

⬜ **Enviar o chamado à Bright Data** (texto pronto, pt-BR e inglês). O argumento
forte: a doc DELES documenta `news[].link` como *"the URL of the news article"* —
é bug contra contrato, não pedido de feature. E devolver caminho **relativo, sem
host** é defeito independente do `/goto`.

⬜ **Produção precisa do `Manual Deploy`** — a `main` não tem auto-deploy.
Staging sobe sozinha.

⏳ **Fase 12 (níveis de acesso por usuário) espera o briefing** que o João fez no
Claude WEB. Nada decidido; o levantamento do que existe hoje está no ROADMAP.

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
