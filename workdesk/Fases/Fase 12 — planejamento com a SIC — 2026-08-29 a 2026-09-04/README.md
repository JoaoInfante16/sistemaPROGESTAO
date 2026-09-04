# Fase 12 — planejamento com a SIC

> **29/08 a 04/09/2026.** 🗂️ Arquivo morto. O sistema de hoje está na
> [ARQUITETURA viva](../../ARQUITETURA.md), não aqui.
>
> Nesta pasta: [DEV_LOG](./DEV_LOG.md) (o passado, com a data de cada coisa),
> [ROADMAP](./ROADMAP.md) (o futuro **como se via no fim da fase**) e uma
> [cópia da ARQUITETURA](./ARQUITETURA.md) — retrato de 04/09.

> 🚨 **O trabalho principal desta fase NÃO está nesta pasta, e isso é de
> propósito.** Foi uma fase de planejamento, e o material dele mora em
> [Protótipo/](../../Protótipo/) — que é **persistente**, fica na raiz e não
> rotaciona, porque continua sendo o norte do que vem depois. O DEV_LOG aqui é o
> diário do **app**; o do produto novo é
> [REUNIAO_SIC](../../Protótipo/REUNIAO_SIC.md), [FORMULARIOS_SIC](../../Protótipo/FORMULARIOS_SIC.md)
> e [MUDANCAS](../../Protótipo/MUDANCAS.md).
>
> Quem ler só o DEV_LOG desta pasta vai achar que a fase foi sobre o `/goto`. Ela
> foi sobre o produto mudar de categoria.

---

## O que a fase resolveu

A Fase 11 pôs o app em produção. A 12 é a fase em que ele **deixou de ser um app**
— e quase nada disso foi escrito em código. Duas metades sem relação aparente: uma
emergência de três dias no começo, e o planejamento que redesenhou o produto.

| # | o que | o que mudou de fato |
|---|---|---|
| 1 | **O `/health` desmentiu a `main`** (29/08) | `git push` para `main` é aceito e **não deploya nada**. Produção rodava `5654361`, de 17/08, enquanto o ponteiro da branch dizia outra coisa — e as duas afirmações são compatíveis, que é onde mora a armadilha |
| 2 | **O feed estava morto havia 3 dias** (29/08) | o Google terminou de trocar os links por `google.com/goto` em **26/08**; a última notícia entrou no feed em 26/08 às 15:01. O scan seguiu processando 500+ URLs/dia gravando **zero**, gastando dinheiro, marcando `complete` — por três dias, sem um alerta |
| 3 | **O remendo** (29 e 30/08) | o `/goto` não se decodifica — **se pergunta**: pedir o link com `redirect: 'manual'` e o Google devolve 302 com o destino. 20/20 pelo caminho real, e provado em produção com push chegando no aparelho |
| 4 | **O briefing da SIC** (30/08) | três formulários reais e **3.396 registros** medidos contra o que o briefing afirmava: **13 pontos não batiam**, incluindo fórmulas inteiras baseadas em número de pergunta — e o número não identifica pergunta |
| 5 | **Três sessões de planejamento** (30/08 a 02/09) | a forma da plataforma: **quatro públicos, cada um num lugar diferente**. E a conclusão que reordena o backend — `papel` não é regra de acesso, é **regra de produto**: decide o que a pessoa preenche *e* o que ela vê |
| 6 | **A reunião** (03/09) | o produto mudou de posicionamento: a notícia **sai do centro** e vira matéria-prima de indicador. E a loja passa a registrar ocorrência própria — o que cria sozinha a verificação cruzada que ninguém sabia fazer: *"o consultor esteve lá?"* |
| 7 | **A rede de segurança** (04/09) | o `§5` do CLAUDE.md mentia em **6 de 7 caminhos**; a suíte estava com **10 de 17 suítes vermelhas** havia tempo indeterminado, e nenhuma era bug. Nasceram o CI, a fronteira de módulos, os tetos de documento e o `/fechar-fase` |

## As descobertas que valem para sempre

Estas saíram daqui e **moram na [ARQUITETURA](../../ARQUITETURA.md) e no
[CLAUDE.md](../../../CLAUDE.md)** — a versão viva é a que vale; a lista abaixo é
só o rastro de onde vieram.

- **Contrato externo apodrece igual documento, e não havia defesa nenhuma.** O
  sistema tinha três defesas contra apodrecimento de *documento* e zero contra o
  de *contrato de terceiro*. O dado que gritava estava gravado — `news_found=0`
  de hora em hora, por três dias — e ninguém tinha um olho nele. Hoje o log
  `goto: N/M resolvidos` aparece sempre, e zero de N aciona o Sentry.
- **`git push` para `main` não deploya.** O ponteiro da branch anda, o `/health`
  não. "A `main` está atualizada" e "produção está atualizada" não se implicam.
- **O Render faz deploy sem derrubar.** A instância antiga continua servindo *e
  consumindo a fila* até a nova ficar pronta. O primeiro teste depois de um
  deploy pode ser respondido pelo código velho — e foi, em 30/08.
- **O dado saiu do reprodutível.** Até aqui, todo byte do sistema se refazia
  rodando o scan de novo. Formulário de campo é **testemunho coletado uma vez**,
  por alguém que não volta lá. É essa mudança de categoria que transforma backup,
  versionamento, RLS e auditoria de exagero em trabalho.
- **Papel é regra de produto, não só de acesso** — decide o que a pessoa preenche
  *e* o que ela vê. Por isso é a primeira coisa que entra no banco.
- **Teste velho não é neutro: é instrução errada esperando alguém obediente.**
  Oito testes exigiam que o Filter1 aprovasse tudo com a OpenAI fora do ar, que é
  o oposto da regra 8. Quem "consertasse o código para o teste passar"
  reintroduziria um vazamento de dinheiro já consertado.
- **Falso verde é pior que vermelho.** No dedup, o fixture tinha 10 dimensões
  onde o código exige 1536: todo candidato era descartado como inválido e a
  função respondia "não é duplicata" **sempre**. Dois testes passavam esperando
  `false` — sem exercitar nada.
- **Documento na camada errada apodrece calado.** Uma árvore de pastas no
  `CLAUDE.md` — a camada paga em *todo turno* — mentiu em toda sessão por
  semanas. O critério que ficou: entra ali só o que muda comportamento **antes**
  de perguntar; o resto é workdesk, que é grátis até alguém abrir.

## Os erros cometidos

Ficam registrados porque quase todos foram cometidos **dentro** dos documentos
que os proíbem.

- **O `Protótipo/` passou 5 dias fora do git.** Zero commits o tocaram desde
  30/08: 36 KB de MUDANCAS, 29 KB de FORMULARIOS_SIC e 25 KB de REUNIAO_SIC sem
  histórico e sem backup — justamente os documentos cujo conteúdo não se
  reconstrói, e justamente na fase em que eram a coisa mais valiosa do projeto.
- **A suíte estava 60% vermelha e ninguém sabia desde quando.** A definição de
  pronto tinha cinco itens e **testes não era um deles**. A regra que estava
  escrita (typecheck) era obedecida; a que não estava, apodreceu — e não havia CI
  nem hook para dizer.
- **O `§5` do CLAUDE.md mentiu em toda sessão.** Seis dos sete caminhos que ele
  desenhava não existiam mais. O verificador não o pegava porque só confere
  identificador em crase, não árvore de pastas.
- **O `ONDE PARAMOS` furou um teto escrito duas linhas acima dele** — chegou a
  50 linhas para um teto de 25. É o mesmo mecanismo que criou o ESTADO DO MUNDO
  de 376 linhas: ele não nasce grande, nasce furando o teto em dez linhas.
- **O `🔴 AGORA` acumulou 27 assuntos.** A regra existia e citava a Fase 9, que
  travou com seis. O gatilho de rotação passou dias antes de alguém notar — e
  quem notou foi um script escrito no último dia da fase.
- **Três sessões de planejamento sem uma linha de código**, com a `main`
  congelada. Foi decisão consciente e o motivo está na ARQUITETURA §3.2 — mas o
  custo é real: o cliente ficou com o APK de 16/08 esse tempo todo.
