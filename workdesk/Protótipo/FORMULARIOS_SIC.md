# FORMULARIOS_SIC — as três coletas de campo, e o que as bases dizem

> 📌 **Documento vivo.** Descreve os instrumentos que a SIC usa hoje em Microsoft
> Forms e que o SIMEops vai absorver. Nasceu em 30/08/2026.
>
> Ver [CLAUDE.md](../../CLAUDE.md), seção 2. Estado do sistema:
> [ARQUITETURA.md](../ARQUITETURA.md). O que se decidiu mudar em relação a estes
> instrumentos está em [MUDANCAS.md](./MUDANCAS.md).

---

## O que este documento é

**O mapa das perguntas, e a medida do que já foi respondido.** Ele existe porque
o número da pergunta no Forms **não identifica pergunta nenhuma** e porque as
bases contam coisas sobre a operação que nenhum documento da SIC conta.

🚨 **Não é fonte de verdade sobre o instrumento vivo.** Os Forms são deles e
mudam sem nos avisar — já mudaram no meio da operação. A verdade é a planilha
exportada; aqui fica o que ela ensinou e o que custa redescobrir.

---

## 0. ⏳ A validade destas medições

🚨 **As três planilhas param em junho de 2026** — consultor 18/06, mediador e
apoio social 08/06. Toda medição deste documento foi feita em 30–31/08 sobre esse
recorte, e há **três meses de operação que a gente não tem**.

O que **não** envelhece, e continua valendo para decidir: proporções (`Outra` em
36%, CPF em 10%), a concentração da carteira, o cruzamento de papéis, a existência
dos defeitos de vocabulário. Mais três meses não invertem nenhum.

O que **envelhece, e não se cita sem conferir**: totais absolutos — 1.485
registros, R$ 2,58 mi prevenidos (3,00 brutos), 61 lojas sem visita há 90+ dias. ⚠️ **Número a confirmar antes de dizer em voz alta:** ele sai da última data de registro por loja, e ainda não se sabe se o `Report Diário` é obrigatório todo dia útil. Se não for, ele mede "sem ocorrência", não "sem visita" — ver 4.4 em [REUNIAO_SIC](./REUNIAO_SIC.md).

📍 **Onde buscar o número fresco:** o Power BI deles está vivo (carimbo *"Última
Atualização 31/08/2026 10:15:12"*, filtro de data até 07/07/2026). Para número que
vai ser dito na frente da SIC, a fonte é a captura do painel; a planilha é a fonte
do detalhe. A exportação atualizada só chega na última fase da construção.

---

## 1. As três frentes são um funil, e ele não fecha

Esta é a descoberta que reorganiza o produto.

```
CONSULTOR      identifica risco no entorno            1.485 registros
                 ↓  "Pedintes / Usuários de drogas / Indivíduos vulneráveis"
MEDIADOR       aborda, registra desfecho, encaminha   1.150 registros
                 ↓  tem interesse?  107 Sim · 95 Não
                 ↓  encaminhado?    103 Sim · 30 Não
APOIO SOCIAL   atende (questionário multidimensional)   761 atendimentos
```

**Não existe identificador de pessoa em lugar nenhum.** O encaminhamento do
mediador e o atendimento do Apoio Social se ligam por **nome escrito à mão** —
preenchido em 19% no mediador e 91% no Apoio. Ninguém consegue responder *"dos
103 encaminhados, quantos foram atendidos?"*.

Fechar esse funil é o que a SIC tem e nenhum concorrente tem: **risco
identificado → pessoa abordada → encaminhamento → atendimento → o que mudou na
loja depois.** É mais defensável que o cruzamento com a imprensa, que depende de
existir notícia na cidade da loja (e cidade média rende quase zero — ver
[FUNIL.md](../FUNIL.md)).

⚠️ O identificador de pessoa é também o que concentra o risco de LGPD: ligar a
mesma pessoa entre frentes é o que transforma registros soltos em dossiê. Nasce
junto com a regra de acesso, nunca depois.

---

## 2. O número da pergunta não identifica pergunta

Medido em 30/08: **duas perguntas diferentes aparecem como "16"** no formulário do
consultor, dependendo do caminho percorrido. Com `Alguma ação conjunta` = Não, a
16 é *"Algum processo apresentou vulnerabilidade?"*; com Sim, a 16 é o
condicional *"Explique o item acima"*.

E o briefing do protótipo mapeou 28 perguntas quando o formulário real tem 39 —
com deslocamento de +2 a partir de "Partes interessadas". Toda fórmula de
indicador que cite número de pergunta está errada.

➡️ **Por isso cada pergunta tem nome fixo** (`valor_prevenido`), e o número do
Forms é apenas coluna de correspondência. Ao citar um condicional em prosa, usar
o formato **15a** (o condicional pendurado na 15).

---

## 3. `Report Diário — Consultor`

**39 perguntas em 7 blocos.** Base medida: **1.485 respostas, 24/11/2025 a
18/06/2026**, 28 consultores, ~265 registros/mês em regime.

### Colunas da planilha exportada, na ordem

Metadados que o Forms já entrega: `Id`, `Id Novo` (`SIC1`, `SIC2`…),
`Hora de início`, `Hora de conclusão`, `Email`, `Nome`.

> 📍 `Hora de início` e `Hora de conclusão` já dão o **tempo de preenchimento**
> que o briefing pedia como instrumentação nova. Ela existe desde sempre.

| # | nome fixo proposto | pergunta (literal) | tipo |
|---|---|---|---|
| 1 | `consultor` | Consultor | lista |
| 2 | `uf_unidade` | Qual a UF da unidade do cliente que foi realizado o atendimento? | lista |
| 3 | `bandeira` | Bandeira Atendida | rádio |
| 4 | `unidade_*` | **cinco perguntas**, uma por bandeira: Atacadão · Loja Carrefour Bairro · Loja Carrefour Express · Loja Carrefour Hiper · Loja Sam's Club | lista |
| 5 | `data_registro` | Data do registro | data |
| 6 | `turno` | Turno | Manhã · Tarde · Noite |
| 7 | `mov_atipica` | Houve movimentações atípicas no fluxo de pessoas? | Sim/Não |
| 8 | `risco_entorno` | Presença de risco no entorno | Sim/Não |
| 9 | `risco_externo` | Classificação de risco externo | múltipla + Outra |
| 10 | `policiamento` | Presença de policiamento na unidade na data do registro? | múltipla + Outra |
| 11 | `falha_estrutural` | Houve falhas estruturais visíveis? | Sim/Não |
| 11a | `falha_tipo` | Tipo de falha | texto |
| 11b | `falha_descricao` | Descreva as falhas identificadas | texto |
| 12 | `contato_forcas` | Houve contato com forças de segurança? | Sim/Não |
| 13 | `acao_conjunta` | Alguma ação conjunta foi discutida ou realizada? | Sim/Não |
| 13a | `acao_conjunta_explicacao` | Explique o item acima | texto |
| 14 | `processo_vulneravel` | Algum processo apresentou vulnerabilidade? | Sim · Não · Não se aplica |
| 14a | `processo_qual` | Qual processo? | múltipla |
| 14b | `processo_motivo` | Descreva o motivo da falha abaixo | texto |
| 15 | `colaborador_negligente` | Algum colaborador ou terceirizado de forma negligente ou permissiva? | Sim/Não |
| 16 | `escala_risco_processos` | Escala de risco dos processos internos | escala 0–10 |
| 17 | `quem_identificou` | Sobre a identificação da ameaça, informe quem identificou inicialmente a ameaça, suspeita ou sinal | rádio + Outra |
| 18 | `classificacao_ameaca` | Classificação da ameaça | múltipla |
| 19 | `tipificacao` | Tipificação jurídica associada | múltipla + Outra |
| 20 | `setor` | Setor envolvido | múltipla + Outra |
| 21 | `produto` | Produto objeto do caso (descrito) | texto |
| 22 | `tentativa_consumacao` | Houve tentativa ou consumação? | rádio |
| 23 | `valor_prevenido` | Se tentado - informe o Valor Recuperado/Prevenido | número |
| 24 | `formalizada` | Ocorrência formalizada - (Cliente ou DP)? | rádio |
| 25 | `nao_formalizada_motivo` | Se não, por quê? Descreva o motivo que não foi registrada. | texto |
| 26 | `afetados` | Quem foi afetado diretamente por esta ocorrência? | múltipla + Outra |
| 27 | `quem_conduziu` | Quem conduziu a intervenção e articulação | múltipla + Outra |
| 28 | `tipo_resposta` | Tipo de resposta adotada | rádio |
| 29 | `forcas_externas` | Forças externas envolvidas | múltipla + Outra |
| 30 | `grau_sucesso` | Grau de sucesso da ação (0 a 5) | escala 0–5 |

> ⚠️ A numeração da coluna `#` é **posição na planilha**, não o número que o
> respondente vê. Os nomes fixos são a referência; as opções literais de cada
> pergunta se leem no `BLOCKS` de `prototipo.html` e nas capturas de
> `formularios/consultor/`.

### Formatos de valor, medidos na base

- **Múltipla escolha grava separado por `;`** — `"Furto;Perturbação;Dano"`.
  Ocasionalmente com `;` sobrando no fim.
- **"Outra" SOBRESCREVE o campo** com o texto digitado. Não há como distinguir
  opção de texto livre a não ser comparando com a lista oficial.
- **Há resposta gravada como JSON** — `["Tentativa","Impedido"]` — de uma versão
  anterior do formulário.
- **Data vem como serial do Excel** (46099 = 2026-08-30).

### O que a base de 1.485 revelou

| medida | valor |
|---|---|
| Mediana de preenchimento | **3 min** · 58% abaixo de 3 min · 147 abaixo de 1 min |
| Envio em lote (3+ envios em 1h, mesmo consultor) | 76 janelas, **429 registros — 29% da base** |
| Registros com ocorrência | 876 (**59%**) — os outros 41% são visita sem ocorrência |
| Valor prevenido | 304 registros > 0, somando **R$ 3.004.283,98** bruto. Descontados os **53 marcados `Consumado`** (R$ 422.587,98, onde nada foi prevenido), sobram **251 registros e R$ 2.581.696,00 — o número honesto**. Outros 56 registros trazem o valor zero |
| …desses, marcados "Consumado" | **53** — onde não houve prevenção nenhuma |
| Grau de sucesso | **683 de 851 respostas são "5"** (80%) |
| Tipificação | **72 termos** onde a lista oficial tem **7** |
| Lojas | **150 grafias para 98 lojas reais** |
| UF | vazia em **27%** |
| Bandeira | 15 valores, **11 são lixo** (`Diadems.`, `Asa norte`, `Pacaembu`) |

🚨 **O funil de risco do protótipo não empilha.** Calculado na base real:

```
1.485 visitas
  929 com risco no entorno (63%)
  876 com ocorrência (59%)
  476 formalizadas
  735 com grau de sucesso >= 4
```

735 > 476. E **314 registros têm ocorrência com "risco no entorno = Não"**, e
**305 avaliaram o sucesso sem ter formalizado**. As etapas não são subconjuntos
umas das outras — desenhar como funil empilhado, com "−39%" entre barras, seria
mentira gráfica.

**Lacuna de visita, já calculável:** 133 lojas distintas (por nome normalizado),
**61 sem visita há mais de 90 dias**. Mas as "mais esquecidas" hoje são grafias
sujas (`Diadems.`, `Três `, `Atacadao `) — o indicador aponta para lixo, não para
loja. É o argumento mais direto de que o cadastro de unidades vem antes do painel.

---

## 4. `Cadastro de Atendimentos — Mediador`

**A frente mais antiga:** 1.150 registros, **05/09/2024** a 08/06/2026 — começou
oito meses antes do Apoio Social e catorze antes do formulário do consultor.

Aborda pessoas em situação de vulnerabilidade no entorno e dentro da loja,
registra fato/tratativa/desfecho e **encaminha para o Apoio Social**.

Colunas próprias, além da espinha comum: `Condições de realização do
questionário`, `Motivo da Finalização do Questionário`, `Nome Completo`,
`Número de telefone`, `Endereço`, `Data de Nascimento`, `Sexo`, `Cor/raça`,
`Motivo da Abordagem`, o relato longo, `Tem interesse no atendimento do apoio
social?` e `Houve encaminhamento para o apoio social?`.

| medida | valor |
|---|---|
| Relato livre preenchido | **97%** — 1.120 textos com fato, risco e desfecho |
| `Motivo da Abordagem` | **100 valores distintos** em 274 preenchimentos |
| `Quem está sendo atendido?` | Prática de mendicância 583 · Pedinte 243 · Outros 167 · Pessoa Vulnerável 81 · Furto 27 |
| Concentração | **90% Carrefour Hiper. Carrefour Bairro: zero.** |
| UF | vazia em **39%** |
| Responsável | 14 grafias para ~10 pessoas |
| Cor/raça | Parda 556 · Preta 269 · Branca 185 |

📍 **Os 1.120 relatos livres são a matéria-prima mais rica das três bases**, e
nenhum painel do protótipo usa uma linha deles. É o tipo de texto que a pipeline
de GPT do projeto já sabe classificar.

---

## 5. `Cadastro de Atendimentos — Apoio Social`

761 atendimentos, 13/05/2025 a 08/06/2026. Psicólogas, assistentes sociais e
consultores sociais entrevistando pessoas no entorno e dentro das lojas.

**Dois níveis de profundidade, e isso valida uma decisão nossa:**
`Questionário Realizado` = **Observação (500)** × **Multidimensional (145)**. O
registro raso é a regra; o aprofundado é a exceção. É exatamente a pergunta-portão
que se decidiu adotar no formulário do consultor.

`Quem está sendo atendido?`: Interação de campo 249 · Cliente Loja 211 ·
Transeunte 97 · **Colaborador Loja 69** · Contato do Apoio Social 58 · Perfil em
acompanhamento 61. Não é só população em situação de rua.

### 🚨 Dado pessoal sensível, no sentido da LGPD

| o que | quantos |
|---|---|
| Nome completo | **691** |
| Cor/raça | 758 |
| Problemas de saúde — inclui **HIV/AIDS (4)**, transtornos mentais (18), tuberculose | 124 |
| Uso de álcool e drogas (álcool, maconha, crack) | 124 |
| Histórico com a justiça — 26 "Sim" | 124 |
| CPF completo · RG | 78 · 23 |
| Endereço · telefone · nome dos pais · nascimento | 138 · 95 · 53 · 172 |

**691 registros cruzam nome completo com raça, saúde, uso de drogas ou passagem
pela justiça.**

E o rodapé do próprio Forms, na tela de abertura, diz: *"O proprietário deste
formulário não forneceu uma política de privacidade sobre como usará seus dados
de resposta. **Não forneça informações pessoais ou confidenciais.**"*

⚠️ **Isto não é acusação à SIC** — pode existir consentimento em papel e base
legal. É constatação de que, no momento em que este dado entrar no nosso
Supabase, a guarda passa a ser nossa também. A SIC ainda vai responder
⚠️ **Superado em 03/09:** a SIC declarou **parceria de serviço público** e pediu **prontuário completo** da pessoa. O bloqueio deixou de ser consentimento e passou a ser **a formalização dessa parceria** (convênio, com qual órgão). O texto abaixo é o raciocínio de 30/08. ~~controlador, consentimento e base legal; até lá~~, **só a espinha comum é
modelada**, sem nenhum campo pessoal.

---

## 5b. O relatório executivo deles — Power BI, e o que ele prova

Visto em 31/08/2026. Painel **vivo** (atualizado às 10:15 daquele dia), publicado
por "Publicar na Web" — **público, sem login**. Quatro páginas: capa com três
botões (`Apoio Social · Mediador · Consultor`) e uma página por frente. Marca
aplicada, KPI grande, série mensal, filtros de data e UF.

**A régua é alta.** Não é planilha nem documento estático: é painel executivo
desenhado. O que a gente entregar é comparado com isso.

### 🚨 Dois gráficos do relatório deles não mostram nada

Na página do Consultor, *"Quem identificou a ameaça?"* e *"Tipificação jurídica
associada"* renderizam como **um risco vertical de um pixel** — centenas de
categorias com contagem 1. Estão publicados assim, agora, com a marca da SIC.

A causa é a que este documento registra: múltipla escolha gravada como string
com `;` faz cada **combinação** virar categoria, e o "Outra" livre multiplica
grafias. Visível em toda parte assim que se sabe olhar: `Estacionamento` 77 e
`Estacionamento.` 9 como barras separadas; *"Alcoolismo e/ou uso de drogas"*
aparecendo **cinco vezes** no gráfico de motivo (12, 1, 1, 1, 1 — total real 16);
`Faixa Etária` com **511 de 556 em "Não declarado"**.

📍 **Isto é a melhor justificativa que existe para o vocabulário controlado e a
fila de curadoria do "Outra".** Normalizar na coleta conserta os gráficos deles
sem tocar em nada do Power BI.

### As contas exatas (base até 18/06 — o painel, vivo, é ~18% maior)

**Tipificação jurídica** — 747 respondidas, 72 termos normalizados:

| | ocorrências |
|---|---|
| **Oficiais (7):** Furto 328 · Perturbação 256 · Ameaça 38 · Dano 9 · Assédio 8 · Roubo 3 · Desacato 2 | **644** |
| **Mendicância** — 9 variações, 11 grafias (`Mendicância`, `Mendicância.`, **`Mendingância`** 11×, `Mendicância/Perturbação`, `Mendicância/morador de rua`…) | **69** |
| "não houve" / "nenhuma" — 13 redações | 31 |
| outros 43 termos | 70 |

🚨 **Mendicância é o 3º conceito mais frequente da operação — atrás só de Furto e
Perturbação, à frente de Ameaça — e não existe entre as 7 opções.** Enquanto
isso, Dano + Assédio + Desacato + Roubo somam **22** em sete meses: mendicância
sozinha é **três vezes** as quatro juntas.

**"Quem identificou a ameaça?"** — 784 respondidas, 68 valores distintos:

| | ocorrências |
|---|---|
| **Oficiais (4):** Consultor SIC 559 · Time Prevenção 92 · Supervisor 25 · Gerência 17 | **693 (88%)** |
| **"nada aconteceu", escrito no campo de texto — em 36 redações diferentes** | **54 (7%)** |
| outros textos livres (`Sic`, `Cftv`, `Monitoramento`, `Ninguém`…) | 37 |

**Ninguém escreve a mesma frase duas vezes porque não existe botão para isso:**

> *"Sem alterações de pedintes ou tentativas de furto neste dia !"*
> *"Nesta data não houve nenhuma intercorrência nesta loja, correu tudo muito tranquilamente"*
> *"Não houve nenhuma alteração na data de hoje, sem mendingância ou tentativas de furto"*

É a prova empírica da **pergunta-portão**: sem caminho para "não houve
ocorrência", a narrativa vai parar no primeiro campo de texto que aparece.

⚠️ **E atrai dado pessoal.** Apareceram `"Operadora de caixa ana"` e
`"Informado via fone pelo Gerente Operacional Marcos Carvalho"` — nome de gente
dentro de um campo de um painel público.

### O que o painel deles estruturalmente não faz

1. **Não tem eixo de unidade.** Agrega por bandeira, UF e consultor. O gerente do
   Atacadão Flamboyant quer o Atacadão Flamboyant, não a média nacional. É o
   buraco que o relatório do cliente preenche.
2. **Não fecha o funil.** A página do Mediador mostra *"Encaminhamento Apoio
   Social: 118 bem-sucedidos · 30 mal-sucedidos"*; a página do Apoio Social não
   faz referência nenhuma a isso. Três páginas, três universos.
3. **Não normaliza nada** — ver acima.

## 5d. A página do Apoio Social no Power BI — lida em 01/09

Página 2 de 4, *"Atendimentos Apoio Social · Perfil"*. O painel estava **vivo**:
carimbo *"Última Atualização 31/08/2026 10:15:12"*.

### O relatório lê 158 dos 761 atendimentos

O filtro `Tipificação do Atendimento` está fixo em **`Multidimensional`**, e o
total do painel é **158**. Na base, `Condições de realização do questionário` só
tem valor em **124** registros (Possível 124 · Impossível 14 · Interrompida 7 ·
vazio 616).

➡️ **O questionário profundo é caminho de minoria — 16 a 21% da base.** Duas
consequências boas: a **pergunta-portão já existe ali e funciona** (é o modelo do
que a gente quer no consultor), e o bloco sensível a cifrar é uma fração pequena,
não tudo.

### Cor/raça é indicador, não resíduo

O donut **`Cútis`** — Parda 52 · Preta 45 · Branca 44 · Não informado 17 — está no
relatório. É o que decide que o campo **fica** (cifrado, restrito por papel),
enquanto CPF e RG saem: aqueles **não aparecem em canto nenhum do painel deles**.

### A picadinha de vocabulário também está aqui

Em *"Qual o principal motivo que levou você a dormir nas ruas?"*:

| resposta real | como aparece |
|---|---|
| Alcoolismo e/ou uso de drogas | **5 barras** — 12, 1, 1, 1, 1 (soma 16) |
| Conflitos familiares | **3 barras** — 7, 7, 1 (soma 15) |
| `Não informado` | 78 — a maior barra do gráfico |

É o mesmo defeito dos dois gráficos quebrados da página do consultor (§5b), agora
na página do Apoio Social. **O problema do painel deles não é ferramenta, é
vocabulário na origem** — trocar o Power BI não conserta nada; consertar a coleta
conserta os dois.

### O Apoio Social só opera em RS e SP

Na base: **RS 409 · SP 349 · 3 vazios**. Nenhum outro estado. O painel, filtrado,
mostra RS 86 e SP 66. Confrontar com a lista de unidades quando ela chegar — o
mediador tem concentração igualmente estranha (90% Carrefour Hiper).

---

## 5c. Quem faz o quê — medido em 31/08

Três medições sobre **pessoas**, feitas direto nas três planilhas. Elas decidem
modelo de dados, não layout.

### A carteira de lojas existe, e é quase fixa

26 consultores. **Mediana: 95% das visitas de um consultor acontecem em 3 lojas**
(entre os 20 com 10+ registros). Não é tendência, é regra:

| consultor | registros | concentração |
|---|---|---|
| Luciano Kaiper | 142 | 140 numa loja |
| Marcelo Baptista | 112 | 111 numa loja |
| Marcos Vinicius | 96 | **uma loja, 100%** |
| Joanezio Constantin | 128 | 125 numa loja |

Só dois destoam — Cleber (15 lojas, Express de São Paulo) e Maxwell (19,
Salvador), ambos em ~48%. São exceção, e o modelo tem que caber os dois.

➡️ **Sustenta a tela `Hoje` inteira** — "suas lojas", "sua lacuna de visita",
"abrir na última loja". E a carteira sai **derivada da base**, sem pedir nada.

### 🔑 O consultor desambigua a grafia da loja

A carteira medida está **inflada por grafia**: as "3 lojas" do Joanezio são
`ATACADAO DIADEMA 339`, `DIADEMA` e `DIADEMS` — uma só. As do Lucas são
`ASA NORTE` e `ATACADAO ASA NORTE BRASILIA` — uma só.

**Duas grafias que aparecem sob o mesmo consultor, na mesma UF e bandeira, são
quase certamente a mesma loja.** É o algoritmo da tabela de-para de unidades, e
reduz muito a adivinhação quando a lista provisória for montada.

### Papel é lista, não campo — e a separação de acesso tem prova

| cruzamento | pessoas |
|---|---|
| consultor ∩ mediador | **1** (Everson Silva da Costa) |
| mediador ∩ apoio social | **5 de 14 — 36% da equipe** |
| **consultor ∩ apoio social** | **zero**, em 2.246 registros |

- **`papel` tem que ser N:N.** Mais de um terço da equipe do mediador também
  atende no Apoio Social.
- **Mediador e Apoio Social são praticamente o mesmo time.** O funil entre eles
  não é passar trabalho entre departamentos — é a mesma pessoa trocando de
  instrumento. Fechar aquele elo é mais natural do que parecia.
- **Consultor e Apoio Social nunca se cruzam.** A regra "consultor não abre o
  formulário do Apoio Social" deixa de ser precaução nossa e vira **descrição da
  operação deles** — é o argumento pronto para quando a SIC perguntar por quê.

Dois detalhes de operação que caem junto: `MANUELLA DE SÁ RODRIGUES BATISTA`
(168) e `MANUELA DE SÁ RODRIGUES` (23) são a mesma pessoa **dentro do mesmo
formulário**; e **Rafael Dias sozinho responde por 456 dos 1.150** registros do
mediador (40%) — a adoção dele decide se a frente funciona.

### Documento pessoal: existe, e a operação não depende dele

Contagem de campos preenchidos, 31/08:

| campo | Apoio Social (761) | Mediador (1.150) | Consultor (1.485) |
|---|---|---|---|
| **Qual sua cor/raça?** | **758 — 100%** | 1.014 — 88% | — |
| Nome completo | 691 — 91% | 222 — 19% | — |
| Data de nascimento | 172 — 23% | 232 — 20% | — |
| Endereço | 138 — 18% | 67 — 6% | — |
| Problemas de saúde | 124 — 16% | — | — |
| Telefone | 95 — 12% | 26 — 2% | — |
| **CPF** | **78 — 10%** | — | — |
| **RG** | **23 — 3%** | — | — |

Três leituras:

1. 🚨 **Cor/raça é o campo mais preenchido das duas bases** — mais completo que o
   nome da própria pessoa, porque é rádio obrigatório e o nome é digitado. É dado
   sensível explícito no art. 5º, II da LGPD.
2. **CPF em 10% e RG em 3%**: em nove de cada dez atendimentos a operação
   funcionou inteira sem documento. Não são estruturais.
3. **O formulário do consultor não tem uma linha de dado pessoal.** Por isso ele
   é o caminho certo para a primeira spec: dá para construir ponta a ponta sem
   tocar em dado sensível.

---

## 5e. O relatório inteiro — as 4 páginas, lidas em 01/09

Este era o documento que a primeira versão deveria copiar fiel. ⚠️ **Superado em 03/09:** a SIC **quer sair do Power BI**, e o que ela pediu é um **dashboard próprio** — este mapa deixa de ser molde de cópia e passa a ser **inventário do que o painel atual mede** (e do que ele deixa de fora). Lido nas
14 capturas de `Protótipo/Relatório/`, com o painel carimbando *"Última
Atualização 31/08/2026 10:15:12"*.

| pág | título | total |
|---|---|---|
| 1 | **capa escura** com o logo SIC e três botões: `Apoio Social` · `Mediador` · `Consultor` | — |
| 2 | Atendimentos · **Apoio Social** · Perfil | 158 multidimensional / 556 observação |
| 3 | Relatório Executivo · **Mediador Social** | 1.184 |
| 4 | Atendimentos · **Consultor Estratégico** · Dados Loja / Territorial e Estrutural | 1.703 |

📍 **A capa deles é escura.** Vale saber, já que o app vai ser claro — o argumento
não pode ser "escuro não é profissional".

📍 **Os totais estão à frente das planilhas** (1.703 contra 1.485; 1.184 contra
1.150). Reforça a §0: número dito na frente da SIC sai da captura, não do xlsx.

### Dez gráficos ilegíveis, e todos pela mesma causa

**Não mostram nada (3)**

| # | gráfico | o que aparece |
|---|---|---|
| 1 | `Quem identificou a ameaça?` (pág 4) | espigão vertical de um pixel |
| 2 | `Tipificação jurídica associada` (pág 4) | espigão vertical de um pixel |
| 3 | `UF Atendida` (pág 3) | donut com três fatias de valor **1**, num universo de 1.184 |

**Picadinha de vocabulário (5)**

| # | gráfico | a divisão |
|---|---|---|
| 4 | `Perfil Atendido` (pág 3) | `Pedinte` 226 × **`Pedinte:`** 20 · `Cliente Loja` 7 × `Cliente Loja:` 10 · `Pessoa Vulnerável` em 4 barras (54, 48, 4, 3) |
| 5 | `Setor envolvido` (pág 4) | `Estacionamento` 77 × `Estacionamento.` 9 · `Não houve.` 20 × `Não houve` 9 |
| 6 | `Forças externas envolvidas` (pág 4) | `Não houve.` 100 × `Não` 19 |
| 7 | `Motivo que levou a dormir nas ruas` (pág 2) | alcoolismo em 5 barras, conflito familiar em 3 |
| 8 | `Uso de álcool/drogas?` (pág 2) | donut arco-íris, ~15 fatias minúsculas |

**Lixo puro (2)**

| # | onde | o quê |
|---|---|---|
| 9 | `Bandeira Atendida` (pág 4) | uma fatia chamada `Alvorada`, com 1 |
| 10 | `Setor envolvido` (pág 4) | uma barra chamada literalmente **`Setor envolvido`**, com 8 — alguém digitou o nome da pergunta como resposta |

➡️ **Em quatro páginas, dez gráficos estão total ou parcialmente ilegíveis — e
nenhum é culpa do Power BI.** É o argumento central da apresentação: trocar de
ferramenta não conserta; consertar a coleta conserta os dois.

### 🔑 O funil aberto está provado dentro do painel deles

A página 3 traz o gráfico `Encaminhamento Apoio Social`: **Bem Sucedido 118 ·
Mal Sucedido 30**. Eles medem o encaminhamento.

E a página 2, que é a do Apoio Social, **nunca menciona aqueles 118**. O painel
mostra a porta de saída e a porta de entrada, e não liga uma na outra. Não é
dedução nossa a partir das planilhas — está desenhado no relatório deles.

### 🚨 Há menor de idade na operação

`Faixa Etária` do mediador: **`Criança` 8 · `Adolescente` 20** (e `Não declarado`
958 — 81% da base, outro gráfico que não informa). O `Perfil Atendido` traz
`Menor gestante` e `Menores furto`.

Fato de base, não hipótese. O art. 14 da LGPD exige consentimento de pai ou
responsável, e a pergunta continua de pé mesmo com o passo de consentimento em
stand by.

### O que a página 4 mede — a régua para cortar as 39 perguntas

Vira indicador no painel deles: turno (Manhã 705 · Tarde 657 · Noite 341) ·
loja · bandeira · responsável · risco no entorno (Sim 1.043 · Não 660) ·
policiamento (PM 726 · Não 562 · GCM 433) · falhas estruturais (Não 1.131 ·
Sim 572) e o tipo delas (portas 231 · iluminação 201 · barreiras 198) ·
classificação de risco externo (treemap) · ação conjunta (Não 1.440 · Sim 263) ·
contato com forças de segurança (Não 1.101 · Sim 602) · processo vulnerável
(prevenção 304 · vigilância 248 · recebimento 103) · colaborador negligente
(Não 497 · Sim 197) · setor · tipo de resposta (abordagem 400 · monitoramento 190
· articulação 177) · quem conduziu (consultor 732 · líder de prevenção 122) ·
forças externas · ocorrência formalizada (interno 452 · não 273 · DP 96) · e dois
números grandes: **escala de risco dos processos internos 8,02** e **média do grau
de sucesso da ação 4,29**.

⚠️ Confirmado no treemap `Classificação de risco externo`: **`Sem risco` aparece
lado a lado com `Pedintes` e `Usuários de drogas`** — o consultor marcou "sem
risco" *e* riscos no mesmo registro. Era exatamente a previsão do desvio.

---

## 6. A espinha comum das três frentes

As três compartilham: **data, turno, UF, bandeira e as mesmas quatro/cinco
colunas de loja**, mais quem preencheu.

➡️ `unidade` é a tabela central de tudo, e nenhuma das três tem cadastro: são
strings digitadas. `pessoa` é a peça nova, e é a que fecha o funil.

### ⚠️ Mesmo rótulo, perguntas diferentes

`Quem está sendo atendido?` existe no mediador e no Apoio Social com sentidos
distintos:

| | mediador | apoio social |
|---|---|---|
| valores | Prática de mendicância · Pedinte · Furto | Interação de campo · Cliente Loja · Transeunte |
| o que responde | **por que** a pessoa foi abordada | **quem** ela é |

Copiar os dois literalmente sem renomear cria uma coluna que significa duas
coisas. Registrado em [MUDANCAS.md](./MUDANCAS.md).

---

## 8. Como a operação se organiza — contado pela SIC em 03/09

| função | onde fica | o que faz |
|---|---|---|
| **Consultor estratégico** | dentro da loja, ~5h por visita | observa, entrevista, anda pela loja, escreve o `Report Diário` |
| **Consultor social** | **numa van** | assistente social + psicóloga — o atendimento do Apoio Social |
| **Mediador** | nas lojas | ponte entre o estratégico e a frente social |

🔑 **O mediador existe para estender o alcance.** Onde a van não chega, é ele que
faz o papel do apoio social e **encaminha**.

➡️ **Isso responde por que o Apoio Social só aparece em RS e SP** (409 e 349
registros, nenhum outro estado). Não é falha de dado — é **onde a van vai**. O
mediador cobre o resto.

⬜ **Pergunta que isso abre:** quando o mediador atende onde não há psicóloga, ele
preenche o quê? Versão reduzida do questionário do apoio, ou só a abordagem?
Decide se o formulário dele ganha um bloco a mais.

### O dashboard do mercado é site, não documento

⚠️ **Corrige a premissa original do briefing.** Desde 30/08 o material dizia
*"mercado = relatório exportável"*. **Não é.** É um **link que eles acessam a
qualquer hora, ao vivo, e não é exportado.**

Duas consequências:

- **Resolve a pergunta em aberto** de como o relatório chega ao cliente: chega
  entrando.
- **O dashboard do mercado e o da liderança são o mesmo motor com escopo
  diferente** — um vê a rede, o outro vê o próprio contrato. Não são dois produtos.

📍 **E o que eles precisam ver são indicadores, com as fontes atrás** — não notícia
para ler. Número, e o link se quiserem conferir.

### Ponto do consultor: foto georreferenciada

O consultor registra presença com **selfie + localização**, que vai para o painel
da liderança.

📍 O GPS prova que **o aparelho** estava na loja; a selfie prova que **é ele**. É
padrão em serviço de campo, e é legítimo.

⚠️ **Dois cuidados a escrever no desenho:**
- **Transparência** — ele sabe que está sendo registrado, e só durante a jornada.
  Exigência trabalhista, não preciosismo.
- **Prazo curto para a foto.** A finalidade é comprovar presença naquele dia, não
  montar histórico. ~90 dias e descarta — evita acumular milhares de fotos de rosto
  de funcionário sem motivo.


---

## 7. Onde estão os arquivos

| o quê | onde |
|---|---|
| briefing e protótipo navegável | `workdesk/Protótipo/` |
| capturas + planilha do consultor | `formularios/consultor/` |
| capturas + planilha do mediador | `formularios/Mediador/` |
| capturas + planilha do apoio social | `formularios/Apoio/` |

⚠️ As planilhas contêm **dado pessoal real**. Não subir para lugar nenhum, não
colar trecho em ferramenta externa, não anexar em issue.
