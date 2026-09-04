# MUDANÇAS — o que o SIMEops muda em relação ao que a SIC tem hoje, e por quê

> 📌 **Documento vivo.** Nasceu em 30/08/2026 com o nome de desvios, a pedido do João:
> *"toda vez que desviarmos ou criarmos uma nova ideia, tem que ser documentado
> pra eu poder explicar depois o porquê"*. **Renomeado em 01/09** — "desvios"
> descrevia só uma parte do que mora aqui.
>
> Ver [CLAUDE.md](../../CLAUDE.md), seção 2. As perguntas e as medições que
> fundamentam cada linha estão em [FORMULARIOS_SIC.md](./FORMULARIOS_SIC.md).

---

## Por que este documento existe

**Este é o documento da apresentação.** Os formulários e o relatório são **da
SIC**. Cada diferença entre o que eles fazem hoje e o que o app vai fazer é uma
decisão que o João vai ter que **demonstrar na frente do cliente** — meses depois
de ter sido tomada, quando a conversa que a gerou já não existir.

**Motivo não se reconstrói.** Ele some junto com a sessão em que foi discutido.

Por isso aqui entram quatro coisas, não uma:

| o que | por que importa na apresentação |
|---|---|
| **defeito encontrado** no material deles | é a prova do problema, medida, não opinada |
| **melhoria proposta** | é o que o app entrega a mais |
| **desvio do instrumento** deles | é o que ele vai ter que justificar |
| **ideia recusada** | é a pergunta que volta, e a resposta pronta |

🚨 **Regra:** decisão tomada entra aqui **no mesmo turno**. Sem exceção, mesmo
que pareça óbvia na hora — principalmente quando parece óbvia.

### Como ler uma entrada

| campo | o que vai nele |
|---|---|
| **Forms hoje** | o comportamento atual, descrito sem julgamento |
| **App** | o que a gente faz no lugar |
| **Por quê** | o argumento, com medição sempre que houver |
| **Status** | 🟡 proposto · ✅ validado com a SIC · ❌ recusado por eles · ⏸️ em stand by |

---

# Mudanças de regra de dado

### ✅ Cada indicador tem um público — decidido pela SIC (03/09)

`Houve movimentações atípicas no fluxo de pessoas?` **não vai para o dashboard do
cliente.** Vai para o **dashboard da liderança**, e só. Palavras deles: para eles
fica melhor assim; se depois quiserem tirar, tira.

📍 **A regra que isso cria, e vale para todo indicador:** o mesmo campo pode ser
sinal operacional para um público e ruído para outro. Nenhum indicador é "do
sistema" — cada um tem um destinatário. Ao propor indicador novo, dizer **para
quem**, não só o que ele mede.

⚠️ Corrige a leitura anterior: a pergunta não era "dado perdido". É **dado de uso
interno** que nunca teve tela própria porque o único painel que existe é o do
cliente.


### ✅ VALIDADO PELA SIC (03/09) — o valor prevenido entra no dashboard

A pergunta 3.4 da reunião (*"estas perguntas não aparecem em gráfico nenhum: são
decisão de vocês ou dado que se perdeu?"*) foi respondida: **dado que se perdeu.**
A SIC mandou **colocar o valor preservado no dashboard**, e disse que há outras da
lista para incluir também — o João vai confirmar quais.

**Decisão de desenho que isso cria: vira dois indicadores, não um.**

| indicador | valor | o que diz |
|---|---|---|
| **Prejuízo evitado** | **R$ 2.581.696,00** | 251 tentativas impedidas — é o valor do serviço |
| **Prejuízo consumado** | **R$ 422.587,98** | 53 registros marcados `Consumado` — o que passou |

**Por quê:** os 53 registros com valor marcados como consumados não são prevenção,
e somá-los infla o número em R$ 422 mil. Separando, os dois viram verdade útil — o
gerente quer saber quanto foi salvo **e** quanto ainda escapa — e a pergunta *"por
que não é R$ 3 milhões?"* já vem respondida na tela. Um problema de qualidade de
dado vira dois indicadores em vez de uma nota de rodapé.


### 🚨 A coluna vertebral deles é intocável — decidido em 01/09

- **Forms hoje:** a SIC criou as perguntas, os indicadores e o desenho da
  operação.
- **App:** a gente **não propõe texto de pergunta, não inventa indicador e não
  sugere como a operação deveria funcionar**. O que a gente faz é **arrumar e
  melhorar** o que já existe: consertar o que não chega ao relatório, agrupar o
  que está picado, impedir dado incoerente de entrar.
- **Por quê:** palavras do João em 01/09 — *"não vamos propor NADA da coluna
  vertebral, por enquanto. A gente não tem que se meter no texto das perguntas"*
  e *"a gente não se mete nas coisas que eles criaram, nos indicadores e no
  formulário a gente só arruma e melhora"*. É o instrumento **deles**, com sete
  meses de base comparável em cima. Mexer no enunciado quebra a comparação e
  transforma uma entrega técnica em opinião sobre o negócio do cliente.
- **Onde isso aparece na prática:** toda pergunta da
  [REUNIAO_SIC](./REUNIAO_SIC.md) é sobre **como funciona hoje**, nunca sobre
  como deveria funcionar. Se alguma soar como "façam diferente", está mal escrita.


> Não mudam pergunta nenhuma. Mudam o que o app **aceita** como resposta.

### Valor prevenido bloqueado em caso consumado 🟡

- **Forms hoje:** o valor pode ser preenchido em qualquer caso.
- **App:** o campo só abre quando a resposta é tentativa. Em caso consumado, ou
  fica fechado, ou vira outro campo (prejuízo), que é outro indicador.
- **Por quê:** **53 dos 304 registros com valor > 0 estão marcados "Consumado".**
  Se consumou, não foi prevenido — é prejuízo. O número que justifica o contrato
  (R$ 3.004.283,98 em 7 meses) hoje entra contaminado — o número honesto é
  **R$ 2.581.696,00**, e a diferença de **R$ 422.587,98** é exatamente o que esta
  regra impede de inflar.

### "Sem risco" excludente das demais opções 🟡

- **Forms hoje:** `Classificação de risco externo` é múltipla escolha e permite
  marcar **"Sem risco" junto com "Furto" e "Roubo"**.
- **App:** marcar "Sem risco" desmarca o resto, e vice-versa.
- **Por quê:** as duas respostas se contradizem; qualquer agregação por risco
  externo conta a mesma visita nos dois lados. Vale o mesmo para o "Não" da
  pergunta de policiamento.

### Fila de curadoria para o "Outra" 🟡

- **Forms hoje:** "Outra" grava texto livre por cima do campo, sem revisão.
- **App:** o "Outra" continua existindo — é válvula legítima — mas cai numa fila
  onde alguém mapeia para termo canônico ou promove a termo novo.
- **Por quê:** a `Tipificação jurídica` tem **72 termos onde a lista oficial tem
  7**. "Mendicância" aparece em quatro grafias (`Mendicância `, `Mendicância.`,
  `Mendingância `, `Mendicância/Perturbação`), e "Tentativa de furto" em quatro.
  **Qualquer relatório que agrupe por tipificação hoje mente.** E "Mendicância"
  claramente merece ser opção oficial — a curadoria é o que descobre isso.
- **Efeito colateral bom:** dá função concreta a um papel de revisão.

**🔁 É contínuo, não é faxina de uma vez** (refinado com o João em 01/09): a lista
de opções cresce sozinha ao longo da operação — de tempos em tempos se olha o que
está se repetindo dentro do `Outra` e se promove a opção. Três regras fazem isso
funcionar de verdade:

1. **Promover opção reaponta os nossos registros — não o legado.** Decidido com o
   João em 01/09: a base antiga do Forms fica como está (normalizar 72 termos é
   arqueologia). Mas o registro que **o nosso app** gravou como `Outra` antes da
   promoção é dado recente, e sem reapontar ele o gráfico racha no meio e a taxa
   de `Outra` daquela pergunta mente para sempre. Custa quase nada porque quem
   promove **já está olhando a lista que casa**: vira uma caixa na tela de
   curadoria — *"aplicar aos 12 registros que responderam isso?"*.
2. **Acrescentar opção não bumpa a versão do formulário.** Se cada opção nova
   virasse versão nova, nasceriam dezenas de versões por mês e o relatório
   pararia de somar. A régua: **acrescentar é aditivo e seguro; remover ou
   renomear não é.** A lista de opções tem versão própria, independente da versão
   do conjunto de perguntas.
3. **A taxa de `Outra` é indicador de saúde da pergunta.** Passou de um limite, a
   lista de opções está errada — não é o consultor que é indisciplinado. Medida
   automática, visível no painel, aponta sozinha onde curar.

**A régua já tem duas calibragens prontas:** `Tipificação jurídica` com 72 termos
para 7 opções, e `Motivo da Abordagem` do mediador com **100 valores em 274
preenchimentos (36%)** — a pior do projeto. As duas nascem no vermelho, e é assim
que se sabe que o indicador funciona.

### `Mendicância` vira opção oficial da tipificação 🟡

- **Forms hoje:** a tipificação tem 7 opções — Furto, Dano, Desacato, Ameaça,
  Assédio, Perturbação, Roubo — e mendicância não está entre elas.
- **App:** entra como opção. (Decisão da SIC, mas com o número na mão.)
- **Por quê:** medido em 30/08 na base até 18/06 — **mendicância aparece 69
  vezes**, em 9 variações e 11 grafias, incluindo `Mendingância` 11 vezes. É o
  **3º conceito mais frequente da operação**, atrás só de Furto (328) e
  Perturbação (256) e à frente de Ameaça (38). Enquanto isso, Dano + Assédio +
  Desacato + Roubo somam **22** — mendicância sozinha é três vezes as quatro
  juntas. E o mediador inteiro gira em torno disso: `Prática de mendicância` é
  583 dos 1.184 atendimentos dele.
- 📍 **É a fila de curadoria funcionando:** termo que aparece muito no "Outra" é
  candidato a virar opção oficial. Este é o primeiro caso, e nasceu do dado.

### Campo de texto livre não pode aceitar nome de pessoa 🟡

- **Forms hoje:** o "Outra" de qualquer pergunta aceita qualquer coisa.
- **App:** aviso na interface, e o campo entra na revisão do mediador antes de
  virar relatório.
- **Por quê:** a base já tem `"Operadora de caixa ana"` e `"Informado via fone
  pelo Gerente Operacional Marcos Carvalho"` dentro de `Quem identificou a
  ameaça?` — e esses valores estão hoje num painel Power BI **público, sem
  login**. Campo livre atrai dado pessoal; um campo livre num relatório público
  vaza dado pessoal.

### A unidade escolhida preenche a UF 🟡

- **Forms hoje:** pergunta a UF e depois oferece a lista de lojas **sem filtrar
  por ela**. Nas capturas, o consultor respondeu `AL` e o dropdown ofereceu lojas
  de `DF` e `MG`.
- **App:** escolhe-se a unidade; UF, cidade e bandeira vêm dela.
- **Por quê:** a UF está **vazia em 27%** dos registros do consultor e **39%** do
  mediador, e quando está preenchida pode contradizer a loja. Perguntar duas
  vezes a mesma coisa é o que produz as duas respostas diferentes.

### Unidade fora da lista não pode travar o consultor 🟡

- **Forms hoje:** a lista de lojas é fechada — **150 grafias para ~98 lojas
  reais**, e quem não acha a sua escolhe a mais parecida.
- **App:** a lista é fechada por padrão, mas tem saída: o consultor digita o nome
  e o registro entra numa **fila de curadoria de unidade**, igual ao `Outra` da
  tipificação. Unidade nova vira linha de tabela pelo painel, **nunca migration**.
- **Por quê:** a lista de unidades nasce provisória (derivada das três bases, não
  entregue pela SIC), então ela **vai** estar incompleta no dia 1. Campo travado
  em campo é registro perdido — e registro perdido em coleta primária não se
  refaz, porque o consultor não volta lá.

### CPF e RG não são importados 🟡

- **Forms hoje:** pergunta CPF e RG no Apoio Social.
- **App:** os dois campos não existem. A espinha comum não tem campo de
  documento; se um dia precisar, entra depois, com motivo escrito.
- **Por quê:** **CPF preenchido em 78 dos 761 (10%) e RG em 23 (3%)** — em nove
  de cada dez atendimentos a operação funcionou inteira sem eles. Não são
  estruturais, são resíduo de quem pediu por hábito. E **dado que não existe não
  vaza, não é sancionado e não precisa de contrato**: é a redução de risco mais
  barata do projeto, e não custa nada à operação.

### Passo de consentimento antes das perguntas sensíveis ⏸️ EM STAND BY (01/09)

> ⏸️ **Congelado a pedido do João em 01/09:** informaram a ele que a SIC já tem
> sistema de consentimento próprio. O item não sai daqui porque a informação é de
> **segunda mão e contradiz o rodapé do próprio Forms deles** ("o proprietário
> deste formulário não forneceu uma política de privacidade"). Descongelar quando
> alguém vir esse sistema funcionando. Enquanto isso, nada se constrói.
>
> 🚨 **O que não congela:** a base **tem menor de idade** — `Criança` 8 e
> `Adolescente` 20 na faixa etária do mediador, mais `Menor gestante` e
> `Menores furto` no perfil atendido (medido no painel deles, 01/09). O art. 14
> exige consentimento de pai ou responsável. Seja qual for o sistema que eles
> tenham, **essa pergunta precisa de resposta**.


- **Forms hoje:** não existe. O rodapé do próprio formulário diz que o
  proprietário **não forneceu política de privacidade** e pede para não inserir
  informação pessoal ou confidencial — enquanto o formulário coleta cor/raça,
  saúde, uso de substância e passagem pela justiça.
- **App:** antes do bloco sensível, uma tela diz o que vai ser coletado, para
  quê, quem é o controlador, por quanto tempo fica e como revogar. Grava-se data,
  **versão do texto apresentado** e quem coletou.
- **Por quê:** para dado sensível, o art. 11 exige consentimento **específico e
  destacado**, e o art. 8º, §2º põe no controlador o ônus de **demonstrar** que o
  obteve. Hoje não há registro disso em nenhum dos 761 atendimentos. Nenhuma das
  outras hipóteses do art. 11 (obrigação legal, política pública, órgão de
  pesquisa, tutela da saúde, prevenção à fraude) cobre consultoria privada
  fazendo assistência social — **consentimento é praticamente a única base
  disponível**, então tem que ser bem coletado.
- **Vira argumento de venda:** *"hoje vocês não conseguem provar consentimento de
  nenhum dos 761; a partir daqui, de todos."*

### Papel do colaborador é lista, não campo único 🟡

- **Forms hoje:** não existe papel — cada frente é um formulário separado, e quem
  tem o link responde.
- **App:** cada pessoa carrega **um ou mais** papéis, e vê os formulários dos
  papéis dela.
- **Por quê:** **5 das 14 pessoas do mediador (36%) também atendem no Apoio
  Social**, e 1 é consultor e mediador. Campo único quebraria na primeira semana.
  E o inverso também é medido: **consultor ∩ apoio social = zero em 2.246
  registros** — a separação de acesso descreve a operação deles, não é invenção
  nossa.

### `Cor/raça` permanece — cifrado e restrito por papel ✅ (decidido em 01/09)

- **Forms hoje:** pergunta cor/raça, e o campo fica em texto plano na planilha,
  acessível a quem tiver o arquivo.
- **App:** o campo **continua existindo**, mas armazenado cifrado e visível só
  para os papéis do Apoio Social e do mediador. Consultor não alcança.
- **Por quê:** foi cogitado eliminar — é o campo sensível mais preenchido das duas
  bases (**758 de 761 no Apoio, 1.014 de 1.150 no mediador**, mais completo que o
  nome da própria pessoa). Mas o **relatório deles usa**: a página 2 do Power BI
  tem o donut *Cútis* (Parda 52 · Preta 45 · Branca 44 · Não informado 17). É
  indicador, não resíduo. Diferente do CPF e do RG, que **não aparecem em canto
  nenhum do relatório** — por isso aqueles saem e este fica.

### Opções fechadas onde hoje há texto livre no Apoio Social 🟡

- **Forms hoje:** *"Qual o principal motivo que levou você a dormir nas ruas?"* é
  aberto.
- **App:** lista fechada, construída a partir do que já foi respondido, com o
  `Outra` indo para a fila de curadoria.
- **Por quê:** no próprio relatório deles, `Alcoolismo e/ou uso...` aparece como
  **cinco barras separadas** (12, 1, 1, 1, 1) e `Conflitos familiares` como
  **três** (7, 7, 1). Somadas, são 16 e 15 — dois blocos reais, hoje picados em
  nove barrinhas que não dizem nada. A maior barra é `Não informado`, com 78.
  **O problema do painel deles não é ferramenta, é vocabulário na origem:** trocar
  o Power BI não conserta; consertar a coleta conserta os dois.

### Identidade vem do login 🟡

- **Forms hoje:** o nome de quem preenche é escolhido numa lista, digitado, ou
  não vem (o e-mail sai como `anônima`/`anonymous`).
- **App:** vem de quem está logado.
- **Por quê:** **44 grafias de entrevistador** no Apoio Social e **14** no
  mediador, para times de ~10 pessoas — `MANUELLA DE SÁ RODRIGUES BATISTA` e
  `MANUELA DE SÁ RODRIGUES` são a mesma pessoa. Sem isto, "produção por
  consultor" é impossível.

---

# Mudanças de estrutura

### 🚨 Reconhecimento facial de pessoa abordada — descartado por ora (03/09)

- **O que a SIC pediu:** o consultor fotografa a pessoa na abordagem, e o app
  compara contra um banco para identificá-la nas próximas vezes.
- **O que o app faz:** a **foto fica na ficha**, e a lista de reconhecimento
  mostra as fotos. **Quem reconhece é o profissional**, não o algoritmo.
- **Por quê:** dois motivos, e o prático pesa mais que o jurídico.
  1. **Na escala deles é desnecessário.** São ~8 pessoas abordadas por loja em 60
     dias. Um humano olhando 8 fotos acha em dois segundos — mais rápido que
     qualquer comparação automática. Algoritmo só compensa em dezenas de milhares
     de registros.
  2. Comparação automática é **processamento biométrico**, a categoria mais
     regulada da LGPD. Empresa privada + reconhecimento facial + população em
     situação de rua já foi derrubado em tribunal (caso do metrô de SP).
- 🚨 **Embedding não é contorno.** Guardar o vetor do rosto em vez da imagem **é**
  o dado biométrico — é exatamente o que a lei regula. Trocar foto por embedding
  não reduz exposição nenhuma. Fica como ideia para quando houver escala que
  justifique, e aí com base legal montada **antes**.
- **Status:** apresentado como **simplificação**, não como recusa — *"não precisa
  de reconhecimento facial, a lista com foto resolve e sai mais rápido"*.

### Biometria de login vem do aparelho, não do nosso banco ✅ (03/09)

- **O que a SIC pediu:** reconhecimento facial para o gerente da loja entrar no app.
- **O que o app faz:** usa a **biometria nativa do celular** (`local_auth` no
  Flutter). A digital ou o rosto **nunca saem do aparelho** — o app só recebe
  "sim, é o dono".
- **Por quê:** entrega exatamente o que pediram, com segurança melhor, sem uma
  linha de dado biométrico no nosso banco e sem construir nada. É o mesmo
  mecanismo que o gerente já usa para desbloquear o próprio celular.

### O nome do gerente se digita uma vez, não a cada ocorrência 🟡 (03/09)

- **O que a SIC pediu:** senha **por loja**, compartilhada; cada gerente se
  cadastra com nome completo dentro do app.
- **O que o app faz:** o nome é digitado **uma vez, na criação do perfil**. Nas
  ocorrências seguintes ele **escolhe o perfil numa lista** e desbloqueia com a
  biometria do aparelho.
- **Por quê:** nome digitado a cada registro é exatamente o que produziu **44
  grafias de entrevistador** no Apoio Social e 14 no mediador. Digitado uma vez é
  cadastro; digitado sempre é sujeira.
- ⚠️ **Risco a levantar com eles:** senha compartilhada não some quando um gerente
  sai da loja. Precisa haver desativação de perfil pelo painel, sem trocar a senha
  da loja inteira.

### A loja registra ocorrência, e a divergência vira indicador ✅ (ideia da SIC, 02/09)

- **Forms hoje:** só o consultor registra. Se ele não registrou, não houve.
- **App:** o gerente da loja também registra ocorrências, por um formulário
  próprio. Quando a loja registra algo e o consultor registrou que não houve,
  **a divergência aparece no dashboard da liderança**.
- **Por quê:** foi ideia deles, e resolve sozinha a pergunta 4.4 — a que perguntava
  como distinguir "visitou e estava tranquilo" de "não visitou". Com duas fontes
  independentes, a ausência de registro de um lado passa a ser verificável pelo
  outro.


> Mudam a forma do registro, não o texto das perguntas.

### Uma visita, N ocorrências ✅ (decidido em 30/08)

- **Forms hoje:** um envio cabe **uma** ocorrência. Duas na mesma visita obrigam
  a preencher tudo de novo — os 16 campos de identificação inclusive — ou a
  perder uma.
- **App:** a visita é preenchida uma vez; ocorrências penduram nela, de zero a N.
- **Por quê:** o relatório passa a contar ocorrências de verdade, e não
  formulários. E o consultor registra a segunda em três toques.

### Pergunta-portão "houve ocorrência?" ✅ (decidido em 30/08)

- **Forms hoje:** o bloco de ocorrências é todo opcional. Quem não teve ocorrência
  deixa 14 perguntas em branco.
- **App:** uma pergunta antes do bloco. "Não" fecha o bloco e grava o fato.
- **Por quê:** **41% das visitas não têm ocorrência**, e hoje "não aconteceu nada"
  e "o consultor pulou" são o mesmo vazio no banco — que é justamente o que o
  indicador de subnotificação precisa distinguir.
- **Precedente deles:** o Apoio Social já faz isto, com
  `Observação` (500) × `Multidimensional` (145).
- 🔬 **Prova empírica, achada em 31/08:** sem esse caminho, a narrativa vai parar
  no primeiro campo de texto que aparece. Em `Quem identificou a ameaça?`,
  **54 registros dizem "não houve nada" — em 36 redações diferentes**, porque
  ninguém escreve a mesma frase duas vezes quando não existe botão:
  *"Sem alterações de pedintes ou tentativas de furto neste dia !"*,
  *"Nesta data não houve nenhuma intercorrência nesta loja, correu tudo muito
  tranquilamente"*. São 7% das respostas daquela pergunta.

### Nome fixo em vez de número de pergunta ✅ (decidido em 30/08)

- **Forms hoje:** a pergunta é referenciada pelo número que aparece na tela.
- **App:** cada pergunta tem identificador estável; o número vira coluna de
  correspondência.
- **Por quê:** o número **não identifica pergunta** — duas perguntas diferentes
  aparecem como "16" conforme o caminho respondido. E inserir uma pergunta no
  meio desloca todas as seguintes, fazendo o relatório somar outra coluna **sem
  erro nenhum aparecer**.

### Versão do formulário em cada registro ✅ (decidido em 30/08)

- **Forms hoje:** o formulário muda e os registros antigos ficam com opções que
  não existem mais.
- **App:** cada registro guarda em qual versão foi preenchido.
- **Por quê:** a base já tem `Impedido` e `Tentativa` — opções extintas — e
  respostas gravadas como JSON (`["Tentativa","Impedido"]`), de uma versão
  anterior. Sem versão, dado antigo fica ilegível a cada mudança.

### Campo de texto opcional nas perguntas de Sim/Não 🟡

- **Forms hoje:** só `Alguma ação conjunta` tem "Explique o item acima", e ele é
  obrigatório quando a resposta é Sim.
- **App:** campo de texto **opcional** aparece quando a resposta é Sim, nas
  perguntas que rendem contexto. Obrigatório apenas onde a SIC já decidiu que é.
- **Por quê:** o texto livre é o que o relatório **cita** — número convence, mas
  frase de quem esteve lá é o que fica. E é o que a pipeline de GPT do projeto já
  sabe processar.
- ⚠️ **Não tornar obrigatório o resto:** a mediana de preenchimento é **3
  minutos**, em pé, dentro do supermercado. Redação obrigatória produz "ok",
  "sim", "normal" — ruído com aparência de dado, pior que campo vazio.

### `Quem está sendo atendido?` precisa de dois nomes 🟡

- **Forms hoje:** o mesmo rótulo existe no mediador e no Apoio Social com
  significados diferentes — lá responde **por que** a pessoa foi abordada
  (`Prática de mendicância`), cá responde **quem** ela é (`Cliente Loja`).
- **App:** dois campos com nomes distintos.
- **Por quê:** uma coluna com dois significados faz qualquer relatório que junte
  as frentes mentir. É o primeiro caso em que "copiar literal" não pode ser
  literal.

### Identificador de pessoa entre frentes 🟡

- **Forms hoje:** o encaminhamento do mediador e o atendimento do Apoio Social se
  ligam por **nome escrito à mão**, quando há nome.
- **App:** identificador gerado na abordagem, que viaja para o atendimento.
- **Por quê:** é o que fecha o único funil que só a SIC tem — *"dos 103
  encaminhados, quantos foram atendidos?"* é hoje impossível de responder.
- ⚠️ **É também o que concentra risco de LGPD:** ligar a mesma pessoa entre
  frentes transforma registros soltos em dossiê. Só existe junto com a regra de
  acesso, nunca antes dela.

---

# Ideias novas — o que não existe no Forms

### 🔑 O relatório do WhatsApp sai montado do formulário 🟡

- **Forms hoje:** o consultor preenche o formulário **e depois escreve o relatório
  de novo** para mandar no grupo de WhatsApp da empresa. A mesma informação,
  digitada duas vezes — e a segunda é a que a equipe de fato lê.
- **App:** ao fechar o formulário, o texto **já sai montado** com o que ele
  respondeu. Um toque para copiar ou compartilhar no grupo.
- **Por quê:** elimina metade do trabalho de fechamento, e o relatório passa a sair
  sempre no mesmo formato. É a única parte da rotina que hoje é 100% manual e 100%
  repetida.
- ⬜ **Pergunta em aberto, e pode ser grande:** o texto do WhatsApp tem alguma
  coisa que **não** está no formulário? Se tiver — contexto, avaliação, recado do
  gerente — é **dado que se perde inteiro hoje**, e some no grupo. Pedir ao João
  alguns relatórios reais do grupo para comparar contra os campos da base.


### 🔑 Reincidência de pessoa — o sistema conta atendimento, não gente ✅ (01/09)

- **Forms/Power BI hoje:** **todo gráfico das 4 páginas conta atendimento.**
  Nenhum conta pessoa. Não existe "pessoas distintas", não existe "quantas vezes
  essa pessoa já foi abordada". Para o sistema, cada abordagem é um evento
  independente.
- **App:** cada pessoa recorrente **naquela loja** ganha um código interno. O
  painel passa a mostrar pessoas distintas, número de abordagens por pessoa,
  intervalo entre elas, e **se pararam depois do encaminhamento**.
- **Por quê, medido em 01/09** na base do mediador (1.150 abordagens, 222 com
  nome):

  | | |
  |---|---|
  | pessoas distintas entre as 222 | **152** |
  | abordadas mais de uma vez | **36 — 24% das pessoas** |
  | abordagens que são repetição | **70 de 222 — 32%** |
  | 🚨 a mais recorrente | **16 abordagens** (a segunda, 10) |

  *(Sinal forte, não medição fechada: sai da fatia de 19% que tem nome.)*

- 🎖️ **É a língua nativa do cliente.** Os donos da SIC são **Major e Sargento da
  PM**. Reincidência — quem é, já passou por aqui, quantas vezes, o que mudou
  depois — é como um oficial pensa há trinta anos. A dor é deles e não precisa ser
  explicada.
- **A métrica certa não é desfecho social.** Correção do João em 01/09: a loja não
  paga para saber se a pessoa conseguiu emprego; paga para saber se **parou de
  voltar**. O produto é *"esta loja tem 3 pessoas que voltam sempre, e uma já foi
  abordada 16 vezes"*.

### O identificador não fica com a pessoa — fica com o profissional 🟡

- **Ideia inicial (descartada):** um código de ficha entregue à pessoa abordada.
- **Problema, apontado pelo João:** *"a pessoa que tá incomodando não vai querer
  guardar número de ficha"*. Ninguém sendo retirado da porta da loja carrega um
  cartão com código.
- **App:** o mediador **já conhece a pessoa de vista** — tanto que a abordou 16
  vezes. No momento da abordagem, o app mostra uma lista curta — *"abordadas nesta
  loja nos últimos 60 dias"*, com última data, motivo e quantas vezes — e ele
  aponta. O reconhecimento acontece na cabeça dele, não no banco.
- **Serve às duas pontas:** o Apoio Social vê a mesma lista e marca *"esta pessoa
  foi encaminhada"*, sem digitar código. Como **36% da equipe do mediador é a
  mesma do Apoio Social**, na maioria das vezes é a própria pessoa continuando.

### 🚫 Nem descrição física, nem foto, para reconhecer a pessoa ❌ (01/09)

- **A ideia:** guardar uma descrição da pessoa (ou uma foto) para reconhecê-la na
  próxima abordagem, evitando guardar dado pessoal.
- **Por que descrição não resolve:** a LGPD (art. 5º, I) cobre pessoa
  **identificável** — uma descrição feita para reconhecer alguém torna a pessoa
  identificável por definição. E na prática é **pior** que o campo estruturado:
  texto livre vira depósito de cor, saúde e uso de substância dissolvidos num
  parágrafo, **sem estrutura, sem como medir e sem como apagar seletivamente**.
- **Por que foto é a pior:** rosto é **dado biométrico**, sensível explícito no
  art. 5º, II. Fotografia de pessoa em situação de rua, tirada por quem representa
  a loja, guardada em servidor de empresa privada. Funciona tecnicamente, e é a
  única coisa do projeto que não se faz.
- **O que se faz no lugar:** a lista de reconhecimento acima — última abordagem,
  loja, motivo, quantas vezes. Nada disso é sensível.

### As duas camadas — reincidência separada de identificação ✅ (01/09)

Desenho que torna a feature independente da resposta da SIC sobre consentimento:

| camada 1 — reincidência | camada 2 — identificação |
|---|---|
| código interno por pessoa recorrente **naquela loja** | nome, nascimento, cor, saúde, substância |
| mede pessoas distintas, repetição, intervalo, efeito do encaminhamento | perfil completo e cruzamentos ricos |
| **não é dado sensível** | é dado sensível |
| base legal: legítimo interesse (registro de ocorrência de segurança) | consentimento, ou política pública se houver convênio |
| **sai independente da resposta deles** | espera contrato de operador + consentimento |

🚨 **O limite:** a lista de reconhecimento vive **na loja e no período**, nunca
numa base global de pessoas. *"Esta loja tem 3 recorrentes"* é operação; *"eis o
histórico do fulano em todas as lojas"* é dossiê. Se pedirem a segunda, a resposta
é que aí é camada 2, com consentimento.

### O questionário do Apoio Social é instrumento público, não criação da SIC 📌 (01/09)

Descoberto ao ler as 49 perguntas. Evidência:

- `Possui certidão de nascimento? / carteira de trabalho? / cartão do SUS? /
  cartão do cidadão?` — checklist de documentação básica da abordagem social;
- `Nos últimos seis meses, foi atendido por alguma das equipes abaixo listadas?`
  → **CRAS, Centro POP, CREAS, Equipe de Abordagem, Defensoria** — a rede do SUAS,
  nominalmente;
- `Recebe alguma das seguintes fontes de renda?` → Bolsa Família, BPC — CadÚnico;
- `Você possui grande dificuldade ou não consegue realizar alguma das atividades
  a seguir?` — **redação literal da pergunta de deficiência do Censo do IBGE**;
- quem aplica é `PSICÓLOGA` e `ASSISTENTE SOCIAL` — profissões cujo conselho já
  obriga consentimento informado e sigilo.

**Três consequências:**

1. O consentimento provavelmente **existe como prática profissional**, só não está
   registrado no Forms — o que bate com o que informaram ao João.
2. 🚨 **Pode não ser consentimento a base legal.** Se houver convênio com a
   assistência social do município, vale o art. 11, II, "b" (política pública),
   que é fundamento bem mais sólido. Corrige a leitura anterior, de que
   consentimento seria praticamente a única hipótese disponível.
3. **A coluna vertebral fica ainda mais intocável:** mexer na redação quebraria a
   comparação com dado público, não só com o histórico deles.

### Regra de acesso — ninguém vê registro de ninguém ✅ (01/09)

- **Forms hoje:** quem tem o link do formulário responde; quem tem o link do
  painel vê tudo.
- **App**, nas palavras do João: *"somente liderança vê tudo. Todos os
  colaboradores vão ter acesso só a notícias, criação de forms e envio de
  relatório. A princípio ninguém vê os registros de ninguém — só o relatório total
  pro cliente, notícias e forms."*
- **Por quê:** simplifica o modelo inteiro. Não existe "o consultor vê os
  registros da função dele" — existe **criar** registro e **ver** relatório. Some
  a superfície de exposição do dado sensível para o time de campo, e some junto a
  necessidade de regra fina por frente.


### Sincronização contínua, não fila de envio 🟡

Cada resposta sobe assim que houver sinal; "enviar" passa a significar **fechar**
a visita, não transmitir.

**Por quê:** o dado não morre no banco, morre no celular — entre preencher e
enviar. Aparelho perdido, app reinstalado, "limpar dados" apertado sem querer, e
a visita se perde. Custa mais chamada de rede e vale cada uma.

### Alerta de lacuna de visita 🟡

*"Atacadão Alvorada: 174 dias sem visita."*

**Por quê:** **61 lojas estão há mais de 90 dias sem visita** e ninguém sabia. ⚠️ **Número a confirmar antes de dizer em voz alta:** ele sai da última data de registro por loja, e ainda não se sabe se o `Report Diário` é obrigatório todo dia útil. Se não for, ele mede "sem ocorrência", não "sem visita" — ver 4.4 em [REUNIAO_SIC](./REUNIAO_SIC.md). Foi
o pedido literal do João para a liderança. ⚠️ Depende do cadastro de unidades:
hoje as "mais esquecidas" são grafias sujas (`Diadems.`, `Três `), então o
indicador aponta para lixo com aparência de precisão.

### Alerta de envio em lote — não de tempo curto 🟡

**Por quê:** o briefing propunha marcar "tempo de preenchimento muito abaixo da
média". Isso marcaria a operação inteira: a mediana é **3 minutos** e o consultor
mais produtivo (142 registros) tem mediana de **2,7 min**.

O sinal que funciona é outro, e foi medido: **76 janelas com 3+ envios na mesma
hora, cobrindo 429 registros — 29% da base**. Isso é preenchimento de memória no
fim do dia, e é detectável sem ambiguidade.

### O "grau de sucesso" não serve como indicador 🟡

**683 de 851 respostas são "5"** — 80% na nota máxima. Autoavaliação sem variação
não mede nada, e o briefing pendura a "eficácia da resposta" nela. Ou a pergunta
muda (e aí é desvio a validar com a SIC), ou o indicador sai do relatório.

### O funil de risco não pode ser desenhado como funil 🟡

Medido: 1.485 visitas → 929 com risco → 876 com ocorrência → 476 formalizadas →
**735 com grau ≥ 4**. As etapas **não são subconjuntos** umas das outras: 314
registros têm ocorrência com "risco no entorno = Não", e 305 avaliaram sucesso
sem ter formalizado.

Desenhar barras empilhadas com "−39%" entre elas seria **mentira gráfica**. São
cinco medidas independentes e pedem outra forma.

---

# 🎤 Soluções que viram argumento — o que apresentar

> **Este é o material da apresentação do João para a SIC — e da SIC para o
> mercado.** Cada entrada é uma solução de engenharia que resolve um problema que
> eles não sabiam que tinham, escrita para ser **dita em voz alta**.
>
> Diferente do resto do documento: aqui não é desvio do instrumento deles, é
> **capacidade nova**. Formato: o problema · a solução · a frase.
>
> ⚠️ **Nem tudo aqui é discurso.** Separado em 03/09, a pedido do João:
>
> **🎤 Argumento para eles** — dor que sentem: 1 bandeira com vigência · 2 base de
> lojas automática · 3 tempo real · 4 dois números de prejuízo · 5 conta pessoas ·
> 6 duas fontes e a divergência · 9 prontuário em camadas · 10 um modelo várias
> experiências · 13 o registro não se perde.
>
> **🔧 Decisão nossa** — engenharia, não discurso: 7 fila de curadoria · 8
> biometria do aparelho · 11 identidade pelo login · 12 reconhecer sem algoritmo.
> **Nessas, o que se apresenta é o resultado, não o método** — ninguém quer ouvir
> "identidade vem do login", quer ouvir *"dá para medir produção por consultor"*;
> ninguém quer ouvir "fila de curadoria", quer ouvir *"os gráficos passam a abrir"*.

### 1. A loja muda de bandeira, e o histórico não muda junto

- **O problema:** um Express vira Atacadão, um Carrefour vira Sam's Club. Num
  cadastro comum, atualizar a bandeira faz **o registro de março passar a dizer
  que aconteceu num Atacadão que não existia em março**. Todo relatório do passado
  muda sozinho, calado.
- **A solução:** a unidade guarda a bandeira **com data de vigência**. Cada
  registro fica preso à bandeira que valia no dia.
- **A frase:** *"O que a gente monitora é a loja, não o rótulo dela. Se ela mudar
  de bandeira amanhã, o relatório do ano passado continua contando a verdade."*

### 2. A base de lojas se monta sozinha

- **O problema:** montar a lista de unidades foi **trabalho manual** deles. E o
  resultado tem 150 grafias para ~98 lojas.
- **A solução:** as bandeiras publicam as unidades nos próprios sites. A base
  nacional se monta a partir daí, e cada unidade carrega as grafias conhecidas.
- **A frase:** *"Vocês não vão mais digitar nome de loja. E `ATACADAO CEASA 288` e
  `ATACADÃO CEASA 288` deixam de ser duas lojas diferentes."*

### 3. Tempo real é o cano, não a tela

- **O problema:** o cliente está brigando porque *"não atualiza sozinho"*. Pagavam
  alguém para atualizar à mão.
- **A solução:** o app grava direto no banco. Não existe exportação no meio, então
  não existe ninguém para esquecer de atualizar.
- **A frase:** *"Não tem etapa manual porque não tem exportação. O gerente
  registra e a liderança vê."*

### 4. Dois números de prejuízo, não um

- **O problema:** o valor prevenido nunca chegou ao relatório. E somado cru, ele
  infla — 53 registros com valor estão marcados `Consumado`.
- **A solução:** vira **prejuízo evitado** (R$ 2.581.696) e **prejuízo consumado**
  (R$ 422.588), separados.
- **A frase:** *"Em sete meses vocês evitaram R$ 2,58 milhões. O relatório que a
  gerência recebia mostrava 8,02 e 4,29."*

### 5. O sistema conta pessoas, não atendimentos

- **O problema:** todo gráfico das 4 páginas conta **evento**. Uma pessoa abordada
  16 vezes aparece como 16 ocorrências independentes.
- **A solução:** reincidência — pessoas distintas, quantas vezes cada uma, e se
  pararam depois do encaminhamento.
- **A frase:** *"O sistema de vocês registra abordagem. Ele não registra
  indivíduo."*

### 6. Duas fontes sobre o mesmo fato

- **O problema:** hoje só o consultor registra. Se não registrou, não houve — e
  ninguém sabe se ele esteve lá.
- **A solução:** a loja também registra. Quando as duas discordam, **a divergência
  vira indicador**.
- **A frase:** *"Isso não é possível com BI, porque BI só lê. Só funciona porque o
  mesmo sistema coleta os dois lados."*

### 7. A lista de opções aprende sozinha

- **O problema:** `Tipificação` tem 72 termos onde a lista tem 7; `Motivo da
  Abordagem` tem 100 valores em 274 preenchimentos.
- **A solução:** o `Outra` cai numa fila; o que se repete vira opção; a promoção
  reaponta os registros que já casavam. E a **taxa de `Outra` vira indicador de
  saúde da pergunta**.
- **A frase:** *"O problema dos gráficos não é a ferramenta, é o vocabulário na
  origem. Trocar de ferramenta não conserta; consertar a coleta conserta as duas."*

### 8. Segurança sem guardar biometria

- **O problema:** querem reconhecimento facial para entrar no app.
- **A solução:** a biometria **nativa do celular** — a digital e o rosto nunca saem
  do aparelho.
- **A frase:** *"Vocês têm a segurança da biometria sem que a gente guarde a
  biometria de ninguém."*

### 9. Prontuário com sigilo por camada

- **O problema:** prontuário com conteúdo clínico visível para todo mundo é
  problema de conselho profissional, não só de LGPD.
- **A solução:** consultor vê que a pessoa está em acompanhamento; mediador vê
  abordagens e encaminhamentos; apoio social vê o bloco clínico; liderança vê
  agregado.
- **A frase:** *"É prontuário, não dossiê. Cada um vê o que a função dele
  justifica."*

### 10. Um modelo, várias experiências

- **O problema:** BI é camada de leitura sobre um conjunto pronto — não coleta e
  não sabe quem está olhando.
- **A solução:** o mesmo modelo alimenta formulários e telas **diferentes por
  papel**.
- **A frase:** *"O Power BI lê. Ele não coleta, e não sabe quem está do outro
  lado."*

### 11. Identidade vem de quem está logado

- **O problema:** 44 grafias de entrevistador para uma equipe de ~10; a mesma
  pessoa escrita de dois jeitos **no mesmo formulário**.
- **A solução:** o nome vem do login. Digitado uma vez, no cadastro.
- **A frase:** *"Produção por consultor passa a ser possível, porque o sistema
  sabe quem é cada um."*

### 12. Reconhecer sem algoritmo

- **O problema:** querem reconhecimento facial para identificar quem já foi
  abordado.
- **A solução:** a foto na ficha e uma lista curta. São ~8 pessoas por loja em 60
  dias — o profissional acha em dois segundos.
- **A frase:** *"Não precisa de reconhecimento facial. Nessa escala, a lista com
  foto é mais rápida que qualquer algoritmo — e não cria banco de biometria."*

### 13. O registro de campo não se perde

- **O problema:** Forms não funciona sem sinal, e 29% dos envios saem em lote.
- **A solução:** o app grava no aparelho e sincroniza depois.
- **A frase:** *"Testemunho de campo não se refaz — o consultor não volta lá. O
  registro tem que sobreviver à falta de sinal."*

---

# Achados sobre o material da SIC — o que está errado do lado deles

Não são mudanças nossas: são defeitos medidos no que eles usam hoje. Entram aqui
porque são a **prova** que sustenta cada mudança proposta, e porque o João precisa
poder demonstrá-los.

### 🔓 O painel deles está publicado na web, aberto — 01/09

- **Hoje:** o relatório é um Power BI acessado por URL `app.powerbi.com/view?r=…`.
  Isso é o recurso **"Publicar na Web"**, que é **totalmente público**: sem login,
  sem senha, e indexável por buscador.
- **O que está exposto:** nome e produtividade individual dos consultores da SIC
  (`Responsável Atendimento`, com 26 nomes e a contagem de cada um), as quatro
  bandeiras do grupo Carrefour juntas, e onde/quanto se perde por loja.
- **Por quê importa:** pela leitura das evidências, **o painel é interno** — ver
  abaixo. Painel interno num link público é vazamento em curso.
- **Recomendação dada ao João em 01/09: contar à SIC logo, fora da apresentação.**
  É risco correndo agora; guardar para um slide é péssima posição se vazar antes,
  e queima a confiança que a apresentação existiria para construir. O resto do
  material já é mais que suficiente para apresentar.
- 🚨 **A URL não entra em documento nenhum da workdesk.** Conferido em 01/09: não
  está em lugar algum. Manter assim.

### O painel é interno, não é entrega ao cliente — leitura de 01/09

Quatro sinais, todos verificados nas capturas:

1. **Nomeia os consultores um a um** — `LUCIANO BARCELLOS KAIPER` 161, `CLEBER
   MELO BONFIM` 151, `ADAJILSON MACIANO DA SILVA` 144. Produtividade da própria
   equipe não se manda para o cliente.
2. **Mistura as quatro bandeiras** — Atacadão 902 · Carrefour Hiper 369 · Sam's
   Club 267 · Express. Relatório de cliente mostra o cliente.
3. **Mostra a sujeira sem filtro** — a fatia `Alvorada` com 1, a barra chamada
   literalmente `Setor envolvido`, os espigões de um pixel.
4. **Deixa controle de operador exposto** — o filtro `Multidimensional /
   Observação` na página do Apoio Social.

Contra isso pesa só a capa, com acabamento de apresentação. **Conclusão provável:
é um painel só, fazendo os dois papéis** — rodar a operação e ser mostrado em
reunião. Comum em consultoria pequena.

➡️ **Consequência para o app:** se o relatório é por cliente, o gerador precisa de
recorte por cliente desde o desenho — o "mercado" recebe o dele, não o de todos.
E qualquer achado deste documento sobre "o relatório" vale para **este** painel,
não necessariamente para tudo que a SIC produz.

---

# Recusados pela SIC

*(vazio — nada foi levado a eles ainda)*

---

# Descartados por nós — ideias consideradas e recusadas, com o motivo

Ficam registradas porque a pergunta volta. Melhor ter a resposta pronta do que
refazer o raciocínio.

### ❌ Consentimento por foto (pessoa segurando documento) — 01/09

**A ideia:** para provar consentimento, fotografar a pessoa segurando o
documento.

**Por que não:**

1. **Aumenta o dado sensível em vez de reduzir.** A imagem contém rosto (dado
   biométrico, art. 5º, II), número do documento e a imagem do documento —
   justamente o CPF e o RG que a gente decidiu não importar. Documento passaria
   de 10% dos registros para 100%, embutido numa foto que não dá para mascarar
   nem apagar em parte.
2. **Não prova o que precisa ser provado.** O que falta hoje não é prova de que a
   pessoa estava lá — é prova de que ela foi **informada**. Foto não mostra
   finalidade, controlador, prazo nem direito de revogar.
3. **Piora o ponto mais frágil.** A dúvida é se o "sim" foi **livre**, com a
   pessoa em vulnerabilidade sendo abordada por quem representa a loja. Pedir que
   levante o documento para uma câmera parece identificação policial, não
   consentimento.
4. **"Selfie com documento" é o item mais valioso de qualquer vazamento** — é com
   isso que se abre conta bancária. Guardar centenas cria exposição
   desproporcional ao tamanho do sistema.
5. **Trava a entrevista em quem mais precisa dela** — boa parte dessas pessoas não
   porta documento.

**O que se faz no lugar:** ver *Passo de consentimento antes das perguntas
sensíveis*. A LGPD não pede assinatura nem imagem — pede que o controlador
**demonstre** que obteve. Isso se faz gravando a **versão do texto apresentado**,
data, hora, quem coletou e o aparelho. Se quiser algo mais concreto, assinatura
com o dedo na tela: é traço, não biometria, e é o que banco e hospital usam.

**E se o objetivo for identificar a mesma pessoa entre as frentes**, também não é
foto — é o **código de ficha** do desvio *Identificador de pessoa entre frentes*.
