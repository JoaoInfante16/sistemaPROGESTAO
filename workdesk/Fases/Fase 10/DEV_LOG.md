# DEV_LOG — Fase 10: o redesign "fio de agência"

> 🗂️ **Documento de fase, arquivado.** Retrato do encerramento — não é mais
> atualizado. As versões vivas estão em [../../](../../).
>
> **08/08 a 14/08/2026.** Diário de bordo: o que foi feito, decisões tomadas,
> problemas encontrados. Cronológico, mais recente no topo.
>
> As regras visuais que nasceram aqui e valem para sempre estão no
> [DESIGN_CONTRATO.md](../../DESIGN_CONTRATO.md), vivo na raiz.
>
> Resumo da fase, descobertas e erros: [README.md](./README.md).

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

