# REUNIÃO COM A SIC — o que perguntar, e por que cada resposta importa

> 📌 Montado em 01/09/2026, revisado com as anotações do João. **Reunião: 02/09.**
> Cada pergunta traz **o que muda no sistema conforme a resposta** — para
> sustentar o assunto sem consultar nada durante a conversa.
>
> As medições estão em [FORMULARIOS_SIC.md](./FORMULARIOS_SIC.md). O que já foi
> decidido está em [MUDANCAS.md](./MUDANCAS.md).

---

## 👤 Quem está do outro lado

**Major e Sargento da PM**, donos e sócios operacionais da SIC.

Isso muda o vocabulário da conversa inteira. **Reincidência, indivíduo conhecido,
recorrência, abordagem** são termos nativos deles — não precisam ser explicados.
A pergunta *"quantas vezes essa mesma pessoa já apareceu aqui?"* é a primeira que
um oficial faz, e é exatamente a que o sistema atual não responde.

Vale o cuidado inverso também: um sistema que acompanha indivíduos ao longo do
tempo é a coisa que eles mais vão querer **e** a de maior risco jurídico. Ver a
seção 8.

## 🚨 A regra que atravessa a reunião inteira

**Não mexemos na coluna vertebral deles.** Não propomos texto de pergunta, não
inventamos indicador, não sugerimos como a operação deveria funcionar.

O que a gente faz é **arrumar e melhorar** o que já existe. Toda pergunta abaixo
cabe nisso — se alguma soar como "façam diferente", está mal escrita.

📍 **E isso ficou mais forte:** o questionário do Apoio Social **não foi
inventado pela SIC** — é instrumento público de assistência social transcrito
para o Forms (ver 6.1). Mexer na redação quebraria a comparação com dado público,
não só com o histórico deles.

## Mandar antes, separado da reunião

🔓 **O painel está em "Publicar na Web" do Power BI — link público, sem login.**
Mensagem curta, sem drama. É risco corrente, e chegar com isso resolvido dá
autoridade para o resto. Ver [MUDANCAS.md](./MUDANCAS.md).

---

# 0. As duas primeiras perguntas

▶️ **1ª — e depois só ouvir:**

> *"Antes de qualquer coisa: me explica como a operação de vocês funciona hoje,
> do começo ao fim. E **para que exatamente vocês querem o sistema?**"*

A segunda metade é a mais importante da reunião inteira. Tudo que a gente montou
até aqui foi **inferido** das planilhas — esta pergunta é a única que diz a
intenção deles. Anotar **as palavras que eles usam**: é o vocabulário que o app
vai ter que falar.

▶️ **2ª — sobre o Power BI:**

> *"Se a coleta melhorasse e os gráficos de vocês passassem a funcionar direito,
> o Power BI resolveria? Ou vocês já queriam sair dele por algum motivo?"*

Esta decide se a gente constrói relatório ou não — e economiza meses num sentido
ou no outro. **O problema do painel deles não é a ferramenta, é o dado que entra.**
Se só a coleta for consertada, o painel melhora sozinho, sem a gente escrever uma
linha de relatório. Ver a seção 10.

▶️ **3ª — a que o sócio do João levantou:**

> *"O cliente de vocês — o Atacadão — teria interesse em acessar isso direto?
> Hoje eles só recebem o relatório, ou pedem mais que isso?"*

Muda o produto de "ferramenta da SIC" para "o que a SIC entrega". É outro tamanho
de negócio, e a resposta vem deles, não de você.

📋 **E o que é pedido, não pergunta:** a lista oficial das unidades (bandeira,
nome, cidade, UF, código interno) e a exportação atualizada das três bases.

---

# 1. Unidades

| # | pergunta | o que muda |
|---|---|---|
| 1.1 | Na base, a mesma loja aparece escrita de várias formas — `ATACADÃO CEASA 288`, `ATACADAO CEASA 288`, e no Diadema até `DIADEMS`. **São 150 grafias para cerca de 98 lojas. Existe algum identificador interno? Conseguem uma lista real das unidades?** | é a tabela central de tudo. Sem identificador estável, qualquer número por loja está errado |
| 1.2 | **Cada consultor é designado a lojas fixas, ou cobre o que precisar?** Na base, 95% das visitas de um consultor acontecem em 3 lojas | se for designado, o app pode abrir direto nas lojas dele; se ele cobre colega, abrir só nas dele esconde onde ele precisa registrar. *(A tela inicial ainda não está desenhada — esta resposta é insumo dela.)* |

# 2. Pessoas e papéis

| # | pergunta | o que muda |
|---|---|---|
| 2.1 | Quantas pessoas hoje, **por função? Conseguem mandar uma lista de quem atua onde e em que função? Elas mudam de função com frequência? Alguém faz mais de uma?** (na base contamos 26 consultores, 14 mediadores, 39 no Apoio Social) | confere as contagens e dimensiona os acessos |
| 2.2 | **Alguém precisa ver o registro de outra pessoa?** Nas bases, consultor e Apoio Social nunca se cruzam | define a regra de acesso |

📍 **Modelo de acesso pensado até aqui** (a confirmar com eles): só a **liderança**
vê tudo. Colaborador tem acesso a notícias, criação de formulário e envio de
relatório — **ninguém vê registro de ninguém**. O cliente recebe só o relatório
(um ou recortado, ver 3.2).

✅ **Já respondido, não perguntar:** liderança = os donos · papel acumula (o
modelo já assume) · corte de acesso é nosso, revogar senha já existe no painel adm.

# 3. O relatório — o alvo da cópia

| # | pergunta | o que muda |
|---|---|---|
| 3.1 | **Esse Power BI é o relatório que o cliente final recebe?** E quem é esse cliente — o gerente de uma loja, ou a administração de várias? Existe outro, em outro formato? | define o que a primeira versão copia, e para quem |
| 3.2 | É **um por cliente, ou um só para o grupo inteiro?** Precisa de recorte? | se for por cliente, o gerador precisa de recorte desde o desenho — é regra de acesso, não filtro de tela |
| 3.3 | Com que **frequência** vocês entregam? | define se o relatório é vivo, mensal ou sob demanda |
| 3.4 | 🔑 **Estas perguntas do formulário não aparecem em nenhum gráfico do painel. São decisão de vocês, ou dado que se perdeu? Ainda são úteis?** (lista abaixo) | é a régua para tudo: o que não vira indicador custa tempo do consultor e não chega a ninguém |
| 3.5 | **Vocês já têm um painel administrativo ou operacional**, além deste? Um lugar onde acompanham a operação de vocês, não a do cliente? | pode ser que os indicadores "sumidos" estejam lá |
| 3.6 | Vocês montam algum número **à mão**, fora do Power BI, para mandar? | é trabalho invisível que o app pode absorver |

### A lista da 3.4 — perguntas fechadas que não viram gráfico

| pergunta do formulário | respondida em | valores |
|---|---|---|
| `Houve movimentações atípicas no fluxo de pessoas?` | **1.485 — 100%** | 2 |
| `Classificação da ameaça` (interna / externa) | 730 — 49% | 16 |
| `Quem foi afetado diretamente por esta ocorrência?` | 634 — 43% | 78 |
| `Houve tentativa ou consumação?` | 430 — 29% | 12 |
| 🔑 `Se tentado — Valor Recuperado/Prevenido` | 360 — 24% | **R$ 2,58 mi líquidos em 7 meses** |

📍 A primeira é obrigatória, respondida **em toda visita** desde novembro, e nunca
virou nada. A última é o dinheiro que a operação de vocês evitou — e o relatório
mostra `8,02` e `4,29` no lugar dele.

*(Os campos de texto livre também não aparecem, mas isso é esperado — texto livre
não vira gráfico. Não entram na pergunta.)*

# 4. O formulário

> ⚠️ Nada aqui propõe mudar enunciado. São perguntas sobre **como funciona hoje**.

| # | pergunta | o que muda |
|---|---|---|
| 4.1 | Em `Classificação da ameaça`, quando o consultor marca `Interna` e `Externa`, **a ordem em que ele marca significa qual predominou?** | hoje `Interna;Externa` (27) e `Externa;Interna` (18) são a mesma resposta contada como duas |
| 4.2 | O `Grau de sucesso da ação` tem **683 respostas "5" de 851 (80%)**. Diferencia alguma coisa na prática? | indicador sem variação não separa nada |
| 4.3 | `Mendicância` é o 3º assunto mais frequente (**69 ocorrências**, à frente de Ameaça) e **não está entre as 7 opções** de tipificação — o consultor escreve à mão. Faz sentido virar opção? | é a mudança de maior efeito imediato no relatório |
| 4.4 | 🔑 **O `Report Diário` é obrigatório todo dia de trabalho, mesmo sem nada para relatar?** Quando não vem registro de um consultor num dia, isso quer dizer que ele não trabalhou? | decide se "não tem registro" significa "não visitou". Sem isso, **nenhuma conta de cobertura se sustenta** — nem o alerta de lacuna de visita, nem falar em "lojas sem visita". O dado mostra que eles **preenchem sem ocorrência** (694 de 1.485, 47%) e que os consultores mais ativos registram em 119 a 140 dias distintos em ~145 dias úteis. Falta saber a **regra**, não o comportamento |
| 4.5 | Aconteceram **duas ocorrências na mesma visita** — como ele faz hoje? | hoje o formulário cabe uma só; ou repete tudo, ou perde uma |

# 5. Operação e campo

| # | pergunta | o que muda |
|---|---|---|
| 5.1 | 🔑 **Tem sinal de internet dentro da loja?** Onde falha — depósito, câmara fria, estacionamento? | é a maior decisão de arquitetura do app. Sem sinal confiável, o formulário tem que funcionar offline e sincronizar depois — isso é a **forma** do app, não uma camada |
| 5.2 | O consultor preenche **na hora ou depois**? Na base, 29% dos envios saem em lote | confirma a resposta acima e explica a mediana de 3 minutos |
| 5.3 | O aparelho é **da empresa ou pessoal**? | define o que dá para exigir do aparelho, e o que acontece quando a pessoa sai |
| 5.4 | Hoje leva cerca de **3 minutos** para preencher. Vocês querem **mais rápido**, ou preferem coletar **mais coisa** mesmo levando um pouco mais? | formulário melhor que leva o dobro do tempo perde adoção, mesmo sendo melhor |

✅ **Já resolvido:** iOS é obrigatório na entrega; desenvolvimento e teste seguem
em Android, e a ordem do trabalho é escolha nossa.

# 6. Dados, consentimento e o Apoio Social

| # | pergunta | o que muda |
|---|---|---|
| 6.1 | 🔑 **Esse questionário do Apoio Social veio de algum instrumento público?** Vocês têm parceria ou convênio com a assistência social do município — CRAS, Centro POP? | **muda a base legal inteira.** Se houver convênio, o tratamento pode se apoiar em política pública (art. 11, II, "b"), que é muito mais sólido que consentimento |
| 6.2 | **Para que serve esse dado depois?** Alguém consulta, ou é registro do atendimento e fica ali? | se disserem *"precisamos saber se é a mesma pessoa que já veio"*, eles pediram a reincidência sozinhos. Se disserem que ninguém consulta, é dado sensível sem finalidade |
| 6.3 | 🔑 Vocês guardam nome, saúde, uso de substância. **Existe alguma forma de consentimento hoje?** Como funciona — a psicóloga explica, é assinado, fica guardado onde? | destrava o Apoio Social. Ver o roteiro de resposta na seção 8 |
| 6.4 | Quem **responde** por esses dados? Tem alguém nomeado para quem quiser pedir cópia ou exclusão dos próprios dados? | define controlador e operador — é o que o contrato entre vocês vai dizer |
| 6.5 | 🚨 Há **menor de idade** sendo atendido — a base traz `Criança` 8, `Adolescente` 20 e `Menor gestante`. **Como vocês tratam esses casos?** | a lei exige consentimento de responsável para menor. Não tem contorno técnico |
| 6.6 | **CPF e RG** aparecem em 10% e 3% dos atendimentos. Alguém usa? | se não, não importamos. Redução de risco mais barata do projeto |

### 📍 O que já se sabe antes de perguntar

O questionário do Apoio Social **é instrumento público transcrito**. As 49
perguntas denunciam a origem:

| pergunta | de onde vem |
|---|---|
| `Possui certidão de nascimento / carteira de trabalho / cartão do SUS / cartão do cidadão?` | checklist de documentação da abordagem social |
| `Nos últimos seis meses, foi atendido por alguma das equipes abaixo?` → CRAS, Centro POP, CREAS, Defensoria | **a rede do SUAS**, nominalmente |
| `Recebe alguma das seguintes fontes de renda?` → Bolsa Família, BPC | **CadÚnico** |
| `Você possui grande dificuldade ou não consegue realizar alguma das atividades a seguir?` | **a pergunta de deficiência do Censo do IBGE, palavra por palavra** |

E quem aplica são `PSICÓLOGA`, `ASSISTENTE SOCIAL` e `CONSULTOR SOCIAL` —
profissões com conselho e código de ética que **já obrigam** consentimento
informado e sigilo. **O consentimento provavelmente existe como prática
profissional; só não está registrado no Forms.**

# 7. Reincidência — a pergunta que vale a reunião

| # | pergunta | o que muda |
|---|---|---|
| 7.1 | 🔑 **Quando o mediador aborda alguém que ele já conhece, ele consegue ver o histórico daquela pessoa?** Como ele sabe que é a mesma? | é o buraco central. A resposta é "não consegue" |
| 7.2 | 🔑 O relatório mostra quantas **abordagens**. Vocês conseguem saber quantas **pessoas diferentes**? | não conseguem — nenhum gráfico das 4 páginas conta pessoa |
| 7.3 | Dos **118 encaminhamentos bem-sucedidos** ao Apoio Social, vocês sabem quantos foram efetivamente atendidos? | o funil não fecha, e está desenhado assim no painel deles |

### O que a gente já mediu, e pode dizer na mesa

**O painel não conta pessoas.** Varridas as 4 páginas: todo gráfico conta
atendimento. Não existe "pessoas distintas", não existe reincidência.

**Entre os registros do mediador que têm nome (222 de 1.150):**

| | |
|---|---|
| pessoas distintas | **152** |
| abordadas mais de uma vez | **36 — 24% das pessoas** |
| abordagens que são repetição | **70 de 222 — 32%** |
| a mais recorrente | **16 vezes** · a segunda, 10 |

⚠️ É só a fatia com nome; não dá para extrapolar com segurança. Mas o sinal é forte.

**Tentei fechar o funil na mão:** dos 103 encaminhamentos, 87 tinham nome (63
pessoas distintas). **Casaram 26.** Os outros 37 não têm como rastrear — porque
**369 dos 761 atendimentos do Apoio Social guardam só o primeiro nome**.

▶️ **A frase, na linguagem deles:**

> *"O sistema de vocês registra abordagem. Ele não registra **indivíduo**. Tem uma
> pessoa que foi abordada dezesseis vezes na mesma loja, e o relatório mostra
> dezesseis ocorrências separadas."*

# 8. O desenho que a gente leva — e as respostas prontas

## Duas camadas

| camada 1 — reincidência | camada 2 — identificação |
|---|---|
| código interno por pessoa recorrente **naquela loja** | nome, nascimento, cor, saúde, substância |
| mede: pessoas distintas · quantas abordagens cada uma · intervalo · **se pararam depois do encaminhamento** | é o perfil completo |
| **não é dado sensível** — conta atendimento, não gente | é dado sensível |
| base legal: legítimo interesse (registro de ocorrência de segurança) | precisa de consentimento **ou** convênio de política pública |

**A camada 1 entrega 100% do valor operacional sem tocar em nada sensível.**

⚠️ **O identificador não fica com a pessoa.** Ninguém que está sendo tirado da
porta da loja vai guardar um cartão com código. Quem reconhece é o mediador — ele
aborda a mesma pessoa 16 vezes justamente porque a conhece de vista. Então o app
mostra uma **lista curta** ("abordadas nesta loja nos últimos 60 dias: 8 pessoas",
com data, motivo e quantas vezes) e ele aponta. Sem descrição física, sem foto,
sem nome.

❌ **Descrição livre e foto estão descartadas** e não devem ser oferecidas: campo
de descrição vira depósito de dado sensível sem estrutura (pior que o campo
estruturado), e rosto é dado biométrico. Ver *Descartados por nós* em
[MUDANCAS.md](./MUDANCAS.md).

## Roteiro conforme a resposta da 6.3

**Se tiverem consentimento:**
> *"Ótimo, então dá para fazer a ficha completa — reincidência ligada ao perfil.
> Como funciona hoje: a psicóloga explica, é assinado, fica guardado onde?"*

**Se não tiverem, ou enrolarem:**
> *"Tranquilo. A parte de reincidência não depende disso — ela conta atendimento,
> não gente. E se vocês quiserem, o próprio app pode coletar o consentimento no
> momento do atendimento do Apoio Social. Aí vocês passam a ter registrado de
> todo mundo, com data e o texto que foi mostrado. **Hoje vocês não conseguem
> provar de nenhum dos 761.** O texto quem define são vocês."*

📍 **Divisão que mantém a regra da coluna vertebral:** a gente constrói o
mecanismo, eles escrevem o texto. Você não é advogado deles.

📍 **Quando perguntar não é constrangedor:** na abordagem, não se pede
consentimento nenhum — é registro de ocorrência. Na entrevista do Apoio Social,
a pessoa já aceitou ser ajudada e está sentada com uma psicóloga: ali é
esperado, é o que qualquer serviço de saúde faz.

## O limite, se pedirem mais

Se pedirem *"quero buscar uma pessoa em todas as lojas"*, é aí que a linha é
cruzada — vira cadastro de indivíduos, não registro de operação. Bom já saber a
resposta antes de ouvirem a pergunta:

| registro de operação ✅ | cadastro de pessoas ❌ |
|---|---|
| escopo: aquela unidade, aquele período | base consultável a qualquer momento |
| finalidade: a intervenção funcionou? | saber quem é fulano |
| tem prazo de descarte | acumula para sempre |

# 9. Abertas — para o fim, e só ouvir

- **O que vocês não conseguem responder hoje e gostariam de conseguir?**
- O que o cliente de vocês mais pergunta, e vocês não têm como responder na hora?

# 10. Power BI e Forms — o que vale manter, se perguntarem

## Power BI tem vantagens reais, e é bom você saber antes deles dizerem

- **O problema dele não é ele.** Os dez gráficos ilegíveis são renderização fiel de
  dado ruim. **Conserte a coleta e o painel melhora sozinho, no dia seguinte.**
- **Custo zero** — já está na licença Microsoft deles.
- **Eles mexem sozinhos.** Gráfico novo em minutos, sem depender de release nosso.
- **É bom** — filtro cruzado, drill-down, exportar. Reconstruir isso levaria meses
  e sairia pior.
- **Eles construíram.** Propor substituir é diferente de propor alimentar melhor.

**Desvantagens:** "Publicar na Web" é público, e acesso com login exige **Power BI
Pro, ~US$ 14 por pessoa/mês** · não entra dentro do app · não é produto seu (sem
marca, sem controle, não se vende) · reincidência ele só faz se receber a tabela
pronta — sozinho ele não descobre que 16 registros são a mesma pessoa.

## Forms tem uma vantagem, e ela é grande

**Eles editam sem depender de ninguém.** Pergunta nova em dois minutos. Se o app
for mais rígido que o Forms, gente volta pro Forms escondido — é assim que
sistema interno morre. Fora isso: custo zero, sem instalar nada, e a
responsabilidade sobre o dado é da Microsoft, não nossa.

**As desvantagens já estão todas medidas:** não valida (72 termos para 7 opções) ·
múltipla escolha vira texto ordenado · uma ocorrência por visita · não impede
incoerência (R$ 422 mil de "prevenido" em caso consumado) · **não funciona
offline** · não tem identidade · **não sabe que é a mesma pessoa** · não versiona.

➡️ **As três últimas são as que o app existe para resolver, e nenhuma tem contorno
dentro do Forms.**

## Os três caminhos

| | o quê | prazo | risco |
|---|---|---|---|
| **A** | App só **coleta**. Forms morre, Power BI continua — lendo nosso banco. | curto | baixo |
| **B** | App coleta **e** gera o relatório. Os dois saem. | longo | alto |
| **C** | App coleta + **nosso relatório para o cliente**. Power BI fica como ferramenta interna deles. | médio | médio |

📍 **Recomendação: começar pelo A, mirar no C.** O A entrega valor rápido, conserta
o painel deles de graça, e não pede que abandonem nada que construíram — encaixa
exato na regra da coluna vertebral. O risco do A é ficar em posição fraca: se o
Power BI continua sendo a entrega ao cliente, **eles** são donos da entrega e o app
vira "o coletor". Por isso o C é o destino, não o começo.

## O que o Power BI não faz e nunca vai fazer

Vale ter na ponta da língua, porque é o que separa o app de um dashboard:

1. **Notícia.** Não tem coleta, não tem classificação. Nem com licença.
2. **É puxado; o app empurra.** O gerente da loja não abre painel toda manhã — ele
   quer ser **avisado**. Isso é celular, não BI.
3. **Tempo real.** O painel deles carimba *"Última Atualização 31/08 10:15:12"* —
   é agendado. O app coleta e mostra no mesmo lugar, sem exportação no meio.

⚠️ **O limite honesto do cruzamento com notícia:** ele funciona **por cidade**.
Bairro e loja rendem quase nada — medido e confirmado pelo João em 01/09, ver
[FUNIL.md §3b](../FUNIL.md). A frase que se sustenta é *"a cidade da sua loja teve
N ocorrências noticiadas esta semana"*. **Não** prometer *"esta notícia é sobre a
sua loja"*.

---

# 🗓️ O que a SIC respondeu — reunião de 03/09/2026

> Registrado no mesmo dia, a partir do relato do João logo após a reunião.
> **Resultado: sucesso.** Várias hipóteses deste documento se confirmaram, e três
> premissas nossas caíram.

## O que mudou de status

| antes | depois da reunião |
|---|---|
| ❓ eles têm consentimento? | ✅ **prestam serviço público em parceria** — inclusive com agência de emprego. A base legal se apoia nisso, não em consentimento |
| ❓ ligam encaminhamento com atendimento? | ✅ **fazem acompanhamento** do sujeito até a assistência social e até tentar emprego |
| ❓ querem reincidência? | ✅ **querem cadastro de pessoas com acompanhamento** — se estão trabalhando, como estão indo |
| ❓ Power BI resolve se a coleta melhorar? | ❌ **querem sair dele** |
| ❓ o cliente final entraria no sistema? | ✅ **a loja vai registrar ocorrências** |

## 🚨 Prazo: entregar algo até o fim de setembro

O cliente final está **brigando com eles**. A queixa: *"não tem atualização
automática em tempo real"* e *"não tem uma hierarquia boa"*.

📍 **A causa não é o Power BI.** Eles pagavam alguém para atualizar, e a pessoa não
automatizou — **está tudo manual**. A dor é o processo, não a ferramenta.

➡️ **Consequência para o prazo:** o que mata a dor é o **cano**, não a tela —
`app coleta → grava no banco → atualiza sozinho`. Com o cano pronto, qualquer tela
em cima fica em tempo real. Dashboard próprio fica para depois; apontar o Power BI
deles para o banco é configuração, não desenvolvimento, e entrega tempo real ainda
em setembro. **É ponte, não casamento.**

## A loja passa a registrar ocorrências — ideia deles, e é ótima

O gerente da loja ganha formulário no celular. Deixa de depender só do consultor.

🔑 **E cria uma verificação cruzada que resolve sozinha o problema do "o cara
trabalhou?"**: se a loja registra uma ocorrência e o consultor registrou que não
houve, **a divergência vira indicador no dashboard da liderança**. Foi deles, e
bateu exatamente com a pergunta 4.4 deste documento.

**Acesso:** senha **por loja**, compartilhada entre os gerentes. Cada um se
cadastra com nome completo e entra com biometria.

⚠️ **Ajuste necessário:** o nome se digita **uma vez, no cadastro do perfil**. Nas
ocorrências seguintes ele **escolhe o perfil numa lista** — digitar o nome toda
vez recria as 44 grafias que a identidade por login existe para matar.

⚠️ **Risco a levantar:** senha compartilhada não some quando um gerente sai. Tem
que haver desativação de perfil pelo painel, sem trocar a senha da loja inteira.

## Reconhecimento facial — onde ficou

**Para identificar pessoa abordada:** descartado por ora. Na escala deles (8
pessoas por loja em 60 dias) a **lista com foto** resolve mais rápido que qualquer
algoritmo, e não gera template biométrico. *A foto fica na ficha; quem reconhece é
o profissional.*

🚨 **Embedding não é alternativa.** Guardar o vetor do rosto em vez da imagem **é**
o dado biométrico — é exatamente o que a lei regula. Trocar foto por embedding não
reduz exposição nenhuma.

**Para login do gerente:** ✅ resolvido, e sem construir nada. **A biometria nativa
do aparelho** (Android/iOS, `local_auth` no Flutter) autentica sem que a digital ou
o rosto saiam do celular. Zero dado biométrico no nosso banco.

## 🔄 A mudança de posicionamento do produto

> *"As notícias vão servir para uma coisa só: indicadores."* — João, 03/09

O SIMEops deixa de ser app de ler notícia. **A notícia vira matéria-prima de
indicador**, dentro do dashboard e do relatório. O feed de leitura sai do centro do
produto.

✅ **E abriu a única porta em que podemos propor:** a SIC deu **liberdade para
propor indicadores** cruzando dado de formulário com notícia. A coluna vertebral
segue intocável; os indicadores, não.

📍 **Notícia perto da loja:** o João já alinhou com eles que **o que funciona é
cidade**, não raio nem bairro. Ver [FUNIL.md §3b](../FUNIL.md).

## O que ainda vem

O João disse que mandaria o restante do relato. Esta seção continua aberta até ele
completar.

---

## Depois da reunião

Toda resposta que mudar uma decisão entra em [MUDANCAS.md](./MUDANCAS.md) **no
mesmo dia** — com a data e a frase que eles usaram. É o que transforma "eu acho
que eles falaram" em argumento que se sustenta seis meses depois.
