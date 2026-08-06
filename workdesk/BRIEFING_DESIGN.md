# SIMEops — briefing de produto para trabalho de design

> 🗂️ **Documento de fase** — escrito em 2026-08-04 para uma sessão de UX/UI.
> Descreve o app como ele é hoje. Arquivar quando o redesign terminar.
>
> Escrito para ser lido **sem acesso ao código**. Não tem nome de arquivo, nem
> campo de API, nem stack. Só o que o app faz, para quem, e por quê.

---

## 1. O que é o app, em um parágrafo

O SIMEops monitora notícias de ocorrências policiais em cidades brasileiras e
entrega no celular. Um robô varre a imprensa 24 horas por dia, usa IA para
separar o que é ocorrência real do que é ruído, junta a mesma notícia publicada
por veículos diferentes num item só, e manda alerta. Além disso, o usuário pode
disparar uma **busca sob demanda**: escolhe a cidade, os assuntos e há quanto
tempo quer olhar, e o sistema vasculha a imprensa e devolve um relatório.

**Quem usa:** profissionais de segurança pública e gestão de risco — não é app de
notícia para o público geral. O tom precisa ser **sóbrio e operacional**, não
sensacionalista. É uma ferramenta de trabalho, e o usuário vai olhar para ela
todos os dias.

**Uma frase que orienta tudo:** o produto entrega *"o que a imprensa publicou
sobre criminalidade na cidade"*, não *"a criminalidade da cidade"*. São coisas
diferentes, e o app não pode dar a entender que é a segunda.

---

## 2. O mapa — 10 telas

```
                          [1] LOGIN
                             |
                   (primeiro acesso força)
                             |
                     [2] TROCAR SENHA
                             |
                             v
              ┌──────── CASCA COM 3 ABAS ────────┐
              |                                   |
   [3] DASHBOARD      [6] BUSCA (hub)      [9] CONFIGURAÇÕES
        |                    |
        v                    v
  [4] CIDADE            [7] NOVA BUSCA
   (2 abas)                  |
        |                    | (leva minutos)
        v                    v
  [5] FEED DA         [7b] ACOMPANHAMENTO
      CIDADE                 |
                             v
                       [7c] RESULTADOS
                             |
                             v
                      [8] RELATÓRIO
```

Existe uma décima primeira tela de **favoritos** que está órfã: o código dela
existe, mas nenhum botão leva até ela. Ou é resquício, ou é uma funcionalidade
que perdeu a porta de entrada. **Vale decidir no design se ela volta e por onde.**

---

## 3. Tela por tela

### [1] Login

E-mail e senha. Não tem cadastro público — as contas são criadas por um
administrador num painel web separado. Tem um "esqueceu a senha?" que **não manda
e-mail de reset**: ele registra uma solicitação para o administrador resolver.
Isso precisa ficar claro na mensagem, senão o usuário fica esperando um e-mail
que não vem.

Uma configuração do servidor pode **desligar a exigência de login** — nesse caso
o app abre direto no dashboard. O design não deve assumir que o login sempre
acontece.

### [2] Trocar senha

Aparece **forçada** no primeiro acesso, quando a conta foi criada pelo
administrador com senha provisória. O usuário não consegue pular. É uma tela de
passagem, vista uma vez na vida.

### [3] Dashboard — a tela inicial

Uma **grade de cards, um por cidade monitorada**. Cada card mostra a cidade, um
indicador de quantas notícias não lidas ela tem, e um resumo curto. Tocar abre a
cidade.

O ícone da aba Dashboard carrega um **badge com o total de não lidas** — é o
sinal de "tem coisa nova" quando o app está fechado numa outra aba.

⚠️ **Hoje são 4 cidades**, mas a grade tem que sobreviver a 20. O design precisa
funcionar nos dois extremos: quase vazio (parece quebrado?) e cheio.

Estados que a tela tem: carregando, erro de rede ("não foi possível carregar" +
tentar de novo), e **nenhuma cidade monitorada** — que não é erro, é uma conta
recém-criada esperando o administrador configurar.

### [4] Cidade — duas abas

No topo, um seletor: a cidade pode ser um **grupo** (ex: "Grande Florianópolis"),
e aí o seletor lista "Todas" + cada cidade do grupo. Abaixo, duas abas:

**Aba Notícias** → é o feed (tela 5).

**Aba Relatório** → um panorama daquela cidade, montado de dados acumulados:
um card de resumo com os totais, um **donut por categoria de crime**, um
**ranking de bairros**, um **gráfico de tendência com filtros**, e uma lista das
**fontes analisadas** (quais veículos publicaram).

Essa aba de relatório é a tela mais "dashboard de verdade" do app e provavelmente
a que mais ganha com design.

### [5] Feed da cidade

Lista de cards de notícia. Cada card traz o tipo de ocorrência, o bairro, a data,
um resumo curto e o veículo. Tem **chips de filtro** no topo. O usuário marca
como lida, favorita.

Quando a mesma ocorrência foi publicada por vários veículos, o app **junta num
card só** — então um card pode representar 3 fontes. Isso é um diferencial do
produto e hoje quase não aparece visualmente.

### [6] Busca — o hub

Lista o **histórico das buscas anteriores** (as últimas 20), cada uma com a
cidade, o período e o status. Tocar numa busca reabre o resultado dela.
**Segurar** entra em modo de seleção múltipla para apagar várias.

Um botão destacado inicia uma busca nova. Busca que falhou avisa e não abre.

### [7] Nova busca — o formulário

A tela mais densa do app, e a que mais precisa de trabalho. O usuário escolhe:

1. **Estado e cidade** — uma cidade por busca. A região metropolitana vem junto
   automaticamente, sem custo extra.
2. **Assuntos** — o que perguntar à imprensa. Vem em **presets** (ex: "essencial"
   com poucos assuntos, "completa" com todos), e cada preset **mostra o próprio
   custo**: quantos assuntos e quantos minutos vai levar. O usuário também pode
   digitar assunto livre ("greve", "queda de energia") — não fica preso à lista.
3. **Período** — um slider com **pontos fixos: 7, 30, 60, 90 e 180 dias**, sem
   granulação. Mais um **calendário** para escolher uma data de início específica,
   até 6 meses atrás.
4. **Uma caixa de estimativa** que diz, antes de começar, quanto tempo aquilo vai
   demorar.

A decisão de produto por trás disso: **o tempo é escolha do usuário**. Mais
assuntos = mais alcance = mais demora, e ele precisa enxergar essa troca antes de
apertar o botão, não depois.

### [7b] Acompanhamento — a tela de espera

**Uma busca leva de 5 a 11 minutos.** Isso não é uma tela de carregamento, é uma
tela de verdade, e o usuário fica olhando pra ela.

Ela tem: um **stepper de 7 etapas** (buscar → filtrar → filtrar de novo → baixar
os artigos → analisar → consolidar → salvar), **um contador dentro das duas
etapas longas** (baixar e analisar — "34 de 155"), e uma lista de **achados ao
vivo**: conforme a IA extrai, aparecem os últimos encontrados ("homicídio,
Cabula, 31/07").

Os achados ao vivo existem porque, sem eles, sete minutos de barra parada parecem
travamento. **É a tela onde o app mais corre risco de parecer quebrado.**

O usuário pode sair — quando termina, chega um push que abre o resultado direto.

### [7c] Resultados

Três blocos que **não podem se misturar**:

1. **A lista principal** — a cidade que ele pediu, no período que ele pediu.
2. **Região metropolitana** — cidades vizinhas, numa seção separada.
3. **Fora do período** — notícias mais antigas que a janela pedida.

⚠️ **A razão de serem separados é honestidade.** Se os três virassem uma lista
só, o app diria "47 ocorrências em Salvador" quando 12 são de Camaçari e 9 são de
três meses atrás. O usuário tomaria decisão em cima de um número inflado. **O
design pode mudar como isso aparece, mas não pode fundir os três num total só.**

### [8] Relatório de risco

Gerado a partir de uma busca. Tem:

- Um **cabeçalho que declara o próprio recorte** em datas concretas ("de 1 a 34
  de julho, Goiânia + 6 cidades da região") — para o usuário não achar que tudo
  ali é do período que pediu
- **Chips** com os cortes e um **toggle** para incluir ou não a região
  metropolitana
- Um **donut por categoria**, caixas de estatística
- Um **mapa com pinos** por bairro

É a tela que o usuário **compartilha** — a que sai do app e vai para uma reunião.
Provavelmente a que mais precisa parecer profissional.

### [9] Configurações

Curta: um switch de notificações, a versão do app, e sair. É a tela mais pobre e
provavelmente a que menos importa — mas hoje ela está *pobre demais* para uma
aba fixa da navegação principal.

---

## 4. As tensões de design — onde eu focaria a conversa

**1. A espera é o produto.** Nenhum app de notícia faz o usuário esperar 7
minutos. A tela [7b] é a mais arriscada e a mais original — se ela for boa, a
demora vira "o sistema está trabalhando pra mim"; se for ruim, vira "travou".

**2. Notícia de crime sem virar alarme.** É uma ferramenta de trabalho para quem
lida com isso o dia inteiro. Vermelho em tudo cansa e infantiliza. As categorias
já têm cores próprias (patrimonial, segurança, operacional, fraude,
institucional) — dá pra usar como sistema em vez de semáforo de perigo.

**3. Volume varia muito.** Uma busca traz 5 resultados, outra traz 77. Cidade
pequena com 3 notícias no mês **não é erro** — é a realidade da imprensa local.
O design não pode fazer o resultado magro parecer falha do app.

**4. Os três baldes.** Como mostrar "tem mais, mas é de outra cidade / de outro
período" sem esconder e sem inflar. Hoje é seção recolhida; pode ser melhor.

**5. O card que representa várias fontes.** "Essa ocorrência foi coberta por 3
veículos" é sinal de credibilidade e hoje é invisível.

**6. Dashboard entre 4 e 20 cards.** Grade que funciona vazia e cheia.

**7. A aba de Configurações não sustenta um terço da navegação.** Ou ganha
conteúdo, ou a navegação vira outra coisa.

---

## 5. Restrições — coisas que não são negociáveis

- **Tema escuro, sempre.** O app não tem modo claro hoje.
- **Android, celular.** Nada de tablet ou landscape por enquanto.
- **Português do Brasil.**
- **Uma cidade por busca** — não é limitação de UI, é decisão de custo (a região
  metropolitana já vem junto de graça).
- **O período são cinco pontos fixos**, não um slider livre. Já foi livre e
  gerava confusão: o usuário pedia 30 dias e recebia 34.
- **Os três baldes de resultado não se fundem** (ver [7c]).

---

## 6. O que perguntar ao João

- A tela de favoritos volta? Por onde se chega nela?
- A aba de Configurações ganha o quê?
- O relatório [8] é para ser lido no celular ou exportado/compartilhado? Isso
  muda o layout inteiro.
