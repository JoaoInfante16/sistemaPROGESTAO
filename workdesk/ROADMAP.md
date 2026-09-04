# ROADMAP — SIMEops (Fase 12)

> 🗂️ **Documento da Fase 12** — arquivado em `Fases/Fase 12/` quando ela fechar.
> Ver [CLAUDE.md](../CLAUDE.md), seção 2.
>
> **Futuro, e só futuro.** Planos, backlog e dívida que atravessa fases.

## Como este documento funciona

Três seções, e um item vive em **uma** delas:

| seção | o que entra |
|---|---|
| 🔴 **AGORA** | decidido, com dono, na fila desta fase |
| 🟡 **DEPOIS** | decidido que vale, sem data — pega quando abrir espaço |
| 🔵 **IDEIAS** | não decidido; entra sem custo, sai sem culpa |

🚨 **Item feito SAI daqui.** Não vira `✅` de troféu — a história dele já está no
[DEV_LOG](./DEV_LOG.md), na data em que aconteceu.

🚨 **Estado atual do sistema não mora aqui** — é a [ARQUITETURA](./ARQUITETURA.md).
Antes de escrever "X está quebrado", **confirme na fonte**.

---

# 🔴 AGORA

### 🚧 A Fase 12 — o SIMEops vira sistema corporativo

🧊 **A `main` fica congelada durante esta fase** — trabalho em `develop` e
`staging`, produção só recebe conserto. A regra e o porquê moram na
[ARQUITETURA](./ARQUITETURA.md), seção 3.2; não duplicar aqui.

> 📍 O briefing chegou em 30/08, com três formulários reais da SIC e 3.396
> registros de operação. As perguntas, as medições e o que se decidiu mudar estão
> em [FORMULARIOS_SIC](./Protótipo/FORMULARIOS_SIC.md) e [MUDANCAS](./Protótipo/MUDANCAS.md).

#### A moldura: o que muda quando deixa de ser app

Até agora **todo byte do sistema era reproduzível** — se o banco de notícias
sumisse, rodava-se o scan de novo. O formulário de campo é **testemunho coletado
uma vez**, por alguém que não volta lá, e uma das três frentes coleta dado pessoal
sensível com nome junto.

É essa mudança de categoria que explica tudo o que vem abaixo. Sem ela, backup,
versionamento, RLS e auditoria parecem exagero de engenheiro. Com ela, são o
trabalho.

O que "sistema corporativo" cobra, e que app não cobrava:

- **Disponibilidade vira contrato.** Backend fora do ar hoje = ninguém vê
  notícia por umas horas. Amanhã = o consultor está dentro do atacadão às 14h e
  a operação para. Hoje isso roda em um serviço Render Starter, sem redundância,
  com deploy de produção **manual**.
- **O dado sai do reprodutível.** Nada de delete de verdade (correção vira versão
  nova), backup fora do Supabase, e trilha de quem respondeu o quê e quando —
  porque um número do relatório vai ser contestado algum dia.
- **Mudança quebra pessoa, não tela.** Mudar o formulário no meio do mês invalida
  comparação e confunde 28 consultores de uma vez.
- **Suporte passa a existir.** Gente travada no meio de um formulário, sem sinal,
  às 21h, com o trabalho do dia dentro do aparelho.
- **Entra e sai gente.** Cortar acesso na hora; o que a pessoa coletou continua
  sendo da SIC.
- **"De quem é o dado, e como eu levo?"** — pergunta que app não recebe e sistema
  corporativo recebe. Exportação deixa de ser funcionalidade e vira cláusula.
- **O segundo admin deixa de ser conselho e vira requisito** (ver abaixo).

#### O que já foi medido no código, e define o tamanho do buraco

- **Existe UM nível de acesso: `user_profiles.is_admin` (boolean).** Só isso.
- **Fora do push, nada é escopado por usuário.** O feed e o analytics entregam a
  lista de cidades **que o cliente mandar** (`resolverCidades`,
  [analyticsRoutes.ts](../backend/src/routes/analyticsRoutes.ts)) sem conferir
  direito nenhum; a busca manual é liberada por uma config **global**
  (`search_permission`), sem teto de gasto individual.
- **Não existe conceito de cliente/organização/tenant** — nem tabela, nem coluna,
  nem FK. `news` nem tem chave para `monitored_locations`: a ligação é o **texto**
  da coluna `cidade`, então o eixo natural de recorte é lista de cidades por
  usuário, que encaixa no `.in('cidade', [...])` que o código já usa.
- O único recorte individual que existe é `user_notification_prefs`, e ele decide
  **o que vibra, não o que aparece**.

🚨 **Dois achados que a fase nova transforma de inofensivos em graves:**

- **`/manual-search/:id/results`, `/status` e `/cancel` não checam dono.** O
  `DELETE` checa (`.eq('user_id', userId)`), os três não. Com dois clientes no
  mesmo banco isso é vazamento — e o `searchId` viaja no payload do push.
- **A RLS está fechada em 19/19, então o backend é a única barreira.** Bom para
  centralizar autorização num lugar só; ruim porque um `where` esquecido vaza em
  silêncio, sem segunda trava. Com o dado do Apoio Social, deixa de ser aceitável.
- **`requireSearchPermission` tem caminho anônimo** (medido 30/08): se a config
  `search_permission` valer `'all'`, token inválido **não bloqueia** — o código
  segue com `// Token inválido - acesso anônimo permitido`
  ([auth.ts](../backend/src/middleware/auth.ts)). O default em código é
  `'authorized'`, mas **default não é a verdade** — conferir o valor no painel.

#### A inversão que define o trabalho de backend

> **Hoje o app é leitor. Ele vira escritor.**

Todo o backend foi desenhado para "servidor produz, app consome". Nada hoje
recebe dado que nasce no aparelho e não existe em nenhum outro lugar. O difícil
não é o CRUD, é a sincronização:

- **Idempotência** — a chave nasce no aparelho (UUID por visita e por resposta),
  nunca no servidor. Rede ruim e retry vão mandar a mesma resposta duas vezes, e
  duplicata de dado primário conta duas vezes no relatório.
- **Escrita parcial** — sincronizar a cada resposta é `PATCH` incremental, não um
  `POST` no fim.
- **Ordem e conflito** — resposta chegando depois do "fechar visita"; o mesmo
  rascunho em dois aparelhos.

✅ **O que não muda, e é a melhor notícia:** a pipeline de notícia inteira
(Filter0 → Filter2 → dedup → push → scan) fica de fora. Todo o risco da fase está
no que é novo.

#### Observabilidade e segurança que a fase cobra

- ⬜ **Regra de limpeza no Sentry do backend, antes de existir formulário.** Hoje
  não há `beforeSend` nenhum ali (o do app filtra só ruído de conectividade). O
  risco não é o que o Sentry captura sozinho — é o contexto que a gente vai
  acrescentar ao depurar sincronização (*"falhou ao salvar a visita X, payload
  Y"*). Aí CPF e resposta de saúde saem para um serviço de terceiro, nos EUA.
  Entra também na conversa de LGPD: transferência internacional.
- ⬜ **Alarmes de ausência, não de exceção.** Sentry pega crash; o que vai doer é
  silêncio: registro parado na fila, consultor sem enviar há N dias (app quebrado
  ou folga?), volume caindo. É a mesma lição do `/goto`, que rodou **três dias**
  com `news_found=0` sem avisar ninguém. Notícia perdida se recupera com outro
  scan; **visita não sincronizada não volta**.
- ⬜ **DSN de Sentry em staging**, em projeto separado. Hoje staging fica sem, de
  propósito, para poupar cota — mas quando um consultor de verdade testar lá e o
  formulário não subir, ninguém vai saber.
- ⬜ **O Dev Panel está em `localhost:3100`** — o console de saúde fica
  inacessível justamente quando você não está na máquina. Ou sobe com
  autenticação, ou a função migra para o admin-panel.
- ⬜ **Os dois ataques que vão acontecer** (e nesta ordem): acesso legítimo mal
  escopado — um `where` esquecido, ou o consultor vendo o formulário do Apoio
  Social — e **link de relatório que vaza**. Defesas: RLS como segunda trava,
  checagem de dono por recurso, auditoria de **leitura** nas tabelas sensíveis.
  Depois disso: segredo fora do git e rotação de chave, o `defaultValue` do app
  apontando para produção, varredura de dependência.
  📍 Rodar `/security-review` no diff quando a implementação começar.

### 🖥️ O painel dos devs — de tela de configuração para console de operação

Levantado em 30/08. Hoje são 8 páginas e ~3.700 linhas.

**Três páginas estão órfãs:** `analytics` (338 linhas), `groups` (287) e `news`
(357) existem e funcionam, mas **não estão na sidebar nem são linkadas de lugar
nenhum** — só se chega digitando a URL. ~982 linhas em limbo.
⬜ Decidir uma a uma: voltam à navegação ou saem. (`analytics` é a candidata mais
forte a voltar — é a parente mais próxima do que a liderança da SIC vai precisar.)

⬜ **`settings` tem 1.230 linhas numa página só** — a maior do repositório.

**A pergunta que o painel responde mudou.** Ele foi desenhado quando o medo era
queimar dinheiro à toa: custo por provider, expectativa mensal, URLs rejeitadas
em 24h. Com 40 pessoas em campo, as perguntas passam a ser *"o dado está
entrando?"*, *"alguém está travado agora?"* e *"o que está no ar?"*.

🔑 **A §11 da ARQUITETURA já é a especificação da tela inicial.** Aquela tabela de
oito perguntas respondidas por comando de terminal (`GET /health`,
`diagnostico-banco.ts`, `diagnostico-funil.ts`, dry-run do push…) foi validada
pelo uso, e o próprio documento diz por quê: *"concluir por inferência qual código
está rodando já custou duas sessões inteiras"*. Se o painel responder as oito sem
terminal, ele vira console de operação.

Estrutura proposta: **Agora** (o que está no ar · a operação está entrando? ·
alarmes de ausência) · **Custo** (o Dashboard de hoje, inteiro, mais os fixos) ·
**Diagnóstico** (os scripts com botão, só leitura) · **Saúde do dado** (`%` de
"Outra", envio em lote, campos em branco, tempo de preenchimento) ·
**Configuração** (o que já existe, com o `settings` quebrado por assunto).

⬜ **O painel precisa ganhar ação, não só leitura:** reprocessar envio preso,
reenviar push, destravar colaborador, ver o payload que não subiu. Sem isso, todo
suporte vira script na sua máquina.
📍 Isso **resolve o Dev Panel** (`localhost:3100`) em vez de manter dois consoles:
ele existe porque o painel não respondia essas perguntas.

### 🔎 As três trilhas — e a que não existe hoje

1. **Trilha do formulário** (quem respondeu o quê, quando, o que mudou depois) —
   existe para **defender o número** quando o cliente contestar. Nasce do modelo,
   não de uma tabela de log: correção vira **versão nova**, nunca sobrescrita.
2. **Auditoria de leitura das tabelas sensíveis** (quem abriu o registro de quem)
   — a única resposta possível a *"quem viu o dado do fulano?"*. Fica **só** no
   painel dos devs.
3. **Trilha do próprio painel** — quando ele ganhar botão de ação, passa a ser um
   lugar de onde se muda produção, e precisa ser auditado como tal.

🚨 **`system_config.updated_at` e `updated_by` são gravados e NUNCA lidos.**
Medido em 30/08: o backend preenche os dois
([settingsRoutes.ts](../backend/src/routes/settingsRoutes.ts),
[configManager](../backend/src/services/configManager/index.ts)) e **não há uma
linha em lugar nenhum que mostre quem mudou uma config e quando**.

Isso importa porque **config é a alavanca mais poderosa do sistema e a única que
não passa por git** — vale na hora, sem deploy. O limiar do dedup muda e o
comportamento inteiro muda junto; o `search_permission` vai para `'all'` e seis
rotas viram anônimas. E a tabela guarda **só o valor atual**: se a causa de um
problema for uma config trocada há três semanas, hoje não existe como descobrir.

- ⬜ **Tabela de histórico de config** (chave, valor antigo, valor novo, quem,
  quando) + aba no painel. Metade do dado já é gravada; falta guardar o **antes**.
- ⬜ **Alarme, não só trilha.** Trilha responde *"o que aconteceu?"*; alarme evita
  descobrir três semanas depois. Avisar na hora quando: config sensível mudar
  (acesso, limiares) ou alguém ler N registros sensíveis numa sessão.

### 🚨 O `/goto` do Google — remendo no ar, conserto de verdade pendente

- ⬜ **Provar no Render.** O remendo foi medido de IP residencial (20/20). O
  Google desconfia de IP de datacenter. A resposta está no log `goto: N/M
  resolvidos` depois do deploy — **não deduzir, ler o log**.
- ⬜ **Enviar o chamado à Bright Data.** Texto pronto (pt-BR e inglês). O
  argumento: a doc deles documenta `news[].link` como *"the URL of the news
  article"*, e devolver caminho relativo sem host é defeito independente.
- ⬜ **Alerta de "N scans seguidos sem achar nada".** É o que faltou: três dias
  de `news_found=0` de hora em hora, sem ninguém avisado. O log do `goto` cobre
  esta causa; o alerta cobre **qualquer** causa futura.
- 🔵 Cache do `goto` no Redis — o mesmo código se repete entre scans. Não foi
  feito para manter o remendo pequeno; vale se o volume incomodar.
- 🔵 Se o Google fechar a porta: **zone de Web Unlocker própria** (a atual é de
  SERP e recusa `/goto` com `invalid_path`) ou trocar para a DataForSEO, que já
  resolve 99,99%.
- ⬜ **São Paulo entrou no monitoramento em 29/08** (cidade e estado) para o
  teste do João. Se não é para monitorar de verdade, desativar — entra no rodízio
  e soma custo.

### Continuidade — o que protege a operação de parar

> 🧹 **Limpo em 30/08:** os itens de Play Console ("subir o AAB", "testar a chave
> de upload") saíram — **estão resolvidos, o app está publicado e no ar**, e
> continuavam listados como pendentes. Segunda verdade dentro do documento que
> existe para evitá-la.

- ⬜ **Segundo admin.** Existe **um só** (`joao.infante16@gmail.com`). Ele se
  trancou fora da conta em 16/08 e a única saída foi um script com a service
  key. Naquele dia o custo era dele; com 40 pessoas em campo, é da operação
  inteira. **Deixou de ser conselho e virou requisito.**
- ⬜ **Backup do `simeops-release.jks` fora da máquina.** É o mesmo arquivo que
  já se perdeu uma vez, e `.gitignore` não protege contra notebook quebrado.
  ⚠️ Perder a chave mata a atualização do app instalado em **qualquer** canal de
  distribuição — todo mundo teria que reinstalar do zero.
- 🚦 **Supabase Pro + dump diário fora do Supabase — gatilho: antes do primeiro
  formulário real ir a campo.** Até lá o dado é de teste e não corre risco (a
  produção também está em teste). Depois disso, um `DELETE` errado às 15h custa
  uma manhã de campo de todo mundo. O plano free não tem retenção nem
  point-in-time; e projeto free **pausa por inatividade**, o que significaria o
  consultor no supermercado sem conseguir enviar.
- ⬜ **Migration 024** (opcional, agora só limpeza) — apaga 7 configs mortas.
- ⬜ **`applicationIdSuffix` por variante.** Staging e produção viraram o mesmo
  app no aparelho; separar exige o sufixo **mais** um cliente Firebase para ele.
  ⚠️ Agora precisa ser desenhado com o equivalente iOS junto — não começar antes
  da spec.
- ⬜ **O app tem que dizer em qual banco está** quando não for produção. O
  `defaultValue` de `SUPABASE_URL` no `env.dart` é **produção**: build sem
  `--dart-define-from-file` autentica no banco do cliente e abre normal, sem
  sinal nenhum. Com formulário que não se apaga, "teste teste teste" entra na
  base de onde sai o relatório do Carrefour.

### A forma da plataforma — desenhada em 30/08

Quatro públicos, **cada um num lugar diferente**:

| quem | onde | o quê |
|---|---|---|
| João e o sócio | `admin-panel` atual | config, custo, usuários, saúde do sistema |
| liderança da SIC | **app web novo** | operação, lacunas, funil, risco |
| colaboradores de campo | app Android (iOS depois) | notícias + o formulário **da função dele** |
| mercado (Carrefour) | **site ao vivo, com login** | **registra ocorrências da loja** e vê os indicadores do contrato dele em tempo real. **Não é relatório exportado** — corrigido pela SIC em 03/09 |

🚨 **O painel da SIC não pode morar no admin-panel.** Aquele é o painel dos
desenvolvedores; a SIC é **cliente**. No mesmo Next, fica a um guard mal
configurado de ver chave de API, custo de OpenAI e o CRON. Reaproveita-se a
tecnologia (`admin-guard.tsx`, `use-auth.ts`), não a casa. Custo de separar: mais
um serviço no Render.

🚨 **"Colaborador" não vê todos os formulários — vê os da sua função.** O do Apoio
Social cruza nome completo com HIV, uso de drogas e passagem pela justiça.

❓ **Quem é a "liderança" da SIC?** Dono olhando uma vez por semana pede painel de
prova; supervisor cobrando consultor todo dia pede painel de ação. São telas
diferentes, e ninguém sabe ainda.

❓ **Como o mercado recebe o relatório?** Hoje a rota pública do SIMEops é URL não
listada — quem tem o link, abre. Servia para recorte de notícia pública; não serve
para um documento que diz onde furtam, em que turno e quanto se perde numa loja
específica. Senha, login próprio ou link que expira — decidir **antes** do
primeiro relatório sair.

📍 **A régua da SIC hoje é mais baixa que a nossa** (medido em 01/09): o painel
deles roda em *"Publicar na Web"* do Power BI, que é **público, sem login e
indexável** — com nome e produtividade de cada consultor lá dentro. Isso não
autoriza a gente a fazer igual; serve para saber que a exigência de segurança vai
ter que ser **explicada**, não pressuposta. E o achado foi passado a eles fora da
apresentação, por ser risco corrente. Ver
[MUDANCAS](./Protótipo/MUDANCAS.md), *Achados sobre o material da SIC*.

⬜ **O relatório é por cliente.** Se cada bandeira recebe o seu, o gerador precisa
de **recorte por cliente desde o desenho** — o "mercado" vê o dele, nunca o dos
outros. Isso é regra de acesso, não filtro de tela.

### O app do colaborador — o que já dá para dizer do layout

**A ordem das abas ainda carrega a hierarquia do produto antigo.** O briefing
propõe `Hoje · Notícias · Campo`, com notícia no meio. Mas para quem usa o app
agora, **Campo é a razão de ele existir** e notícia é apoio. Proposta:
`Hoje · Campo · Notícias`, com notícia na ponta.

**O `Hoje` deve mostrar o que o dado sustenta, não o que o briefing imagina.** Ele
propõe "briefing em uma frase" e "visitas de hoje" — **nenhuma das duas existe no
dado**. O que existe, medido:

- o **rascunho parado** (a visita que ficou pela metade);
- a **última loja visitada** — ele volta às mesmas poucas unidades e hoje rola uma
  lista de 150 nomes;
- a **loja da carteira dele há 90+ dias sem visita** — são 61 lojas nessa
  situação, e ninguém sabia. ⚠️ **Número a confirmar antes de dizer em voz alta:**
  ele sai da última data de registro por loja, e ainda não se sabe se o `Report
  Diário` é obrigatório todo dia útil. Se não for, ele mede "sem ocorrência", não
  "sem visita" — ver 4.4 em [REUNIAO_SIC](./Protótipo/REUNIAO_SIC.md).

⬜ **Mapa das telas atuais** — o que acontece com cada tela quando a navegação
muda. Feed sobrevive, Consultas e Monitoramento viram sub-abas de Notícias, Config
sai da barra para a engrenagem, e nasce uma seção inteira. Sem esse mapa, tela
órfã só aparece na implementação.

### Consertos no protótipo — ele é o norte, então não pode estar errado

O `Protótipo/prototipo.html` é a referência de construção. Três coisas nele foram
derrubadas por medição e são cirúrgicas:

- ⬜ **A paleta** (bloco `:root`, uma edição) — o verde de ação dá **1,70:1** no
  branco. Trocar pelos valores validados do `estilo.ts`.
- ⬜ **O `Hoje`** — trocar o que não existe no dado pelo que existe (acima).
- ⬜ **O funil da liderança** — as barras empilhadas com "−39%" mentem, porque as
  etapas não se contêm. Vira outra forma.

⏸️ **As 39 perguntas no protótipo ficam para depois** — o desenho do formulário
depende de decisões ainda não fechadas (portão, N ocorrências).

### Validação que só o João pode fazer

⬜ **Pôr o protótipo na frente de um consultor de verdade.** Ele é navegável e não
precisa de nada pronto. A mediana de preenchimento deles é **3 minutos** — se o
app for mais lento que o Forms, voltam para o Forms. É a validação mais barata que
existe, e a única que não dá para fazer daqui.

### Distribuição e plataformas

- ✅ **Android fica na Play, faixa fechada** — já resolvido e no ar. Trocar por
  Firebase App Distribution perderia atualização automática.
- ⬜ **iOS é obrigatório** — a SIC pediu, confirmado em 31/08; a equipe tem
  iPhone e Android misturados. Não existe caminho
  que evite **conta Apple (US$ 99/ano) + máquina macOS**; o Firebase distribui
  para iOS mas não livra de nenhum dos dois, e ainda exige registrar o UDID de
  cada aparelho. Quando for a hora: TestFlight, com build por CI na nuvem.
  **Não durante a reestruturação** — adicionar plataforma no meio dobra a
  superfície de tudo.
- 🔒 **Restrições que o iOS impõe desde já**, para não construir o que custa caro
  desfazer: nenhum plugin sem suporte iOS entra no `pubspec`; a navegação não pode
  depender do botão físico de voltar (iPhone não tem — vale sobretudo para o
  formulário longo); Face ID exige `NSFaceIDUsageDescription`; push exige chave
  APNs e fluxo de permissão explícito; e o build não sai dos `.bat`.
- ⬜ **Registrar `simeops.com.br`** no registro.br (~R$ 40/ano). Do nosso lado é
  **zero linha**: `urlPublica()` já lê `PUBLIC_BASE_URL`. Passou de "seria bom"
  para "faz falta": são **dois** endereços que a SIC vê todo dia — o painel dela
  e o relatório —, e nenhum pode ser `…onrender.com`. (`progestao.com.br` é de
  outra empresa de mesmo nome; `simeop.com.br` nunca foi registrado, por isso a
  verificação do Render não passava.)

### Tema claro — deixou de ser pesquisa, virou execução

Medido em 30/08 (detalhe no [DEV_LOG](./DEV_LOG.md)): o
[`estilo.ts`](../backend/src/services/relatorio/estilo.ts) do relatório **já é** a
escala de tinta do app espelhada para fundo branco, com os mesmos ratios de
contraste. O trabalho é importar aquela escala para o Dart e trocar três acentos
(`teal`, `verde`, `alerta` — os do app dão 3,86 / 2,44 / 3,91 no branco).

✅ **A cor de categoria não muda e `GET /settings/taxonomia` não muda** — as cinco
passam de 3:1 nos dois fundos. ⚠️ `patrimonial` dá **3,03:1** no branco: serve
como elemento gráfico, reprova para texto. A regra de que a cor mora no chip
deixa de ser preferência.

⚠️ **A paleta do protótipo não entra:** o verde de ação dá **1,70:1** no branco, o
ouro 2,87:1 e o `--mute` (destinado a rótulo e metadado) 3,66:1. Protótipo manda
em layout, hierarquia e microcópia — cor vem da fonte medida.

### 🚨 A reunião, relatada em 03/09 mudou a fase — prazo, produto e ordem

**Prazo real:** a SIC pediu **algo entregue até o fim de setembro**. O cliente
final está brigando com eles porque *"não atualiza sozinho"* e *"não tem
hierarquia boa"*. A causa não é o Power BI — **pagavam alguém que não automatizou,
e está tudo manual**.

➡️ **O que mata a dor é o cano, não a tela:**
`app coleta → grava no banco → atualiza sozinho`. Com o cano pronto, qualquer tela
em cima fica em tempo real.

**Ordem decidida:**

1. ⬜ **Até o fim de setembro:** o formulário do consultor + o cano. E apontar o
   **Power BI deles para o banco** — é configuração, não desenvolvimento, e entrega
   tempo real dentro do prazo. **É ponte, não casamento:** quando a nossa tela
   ficar pronta, desliga a deles.
2. ⬜ **Depois:** o dashboard próprio, no ritmo certo.

⚠️ **Eles querem sair do Power BI** — a opção "A" (manter o painel deles como
entrega definitiva) está morta. Continua válida só como ponte.

### 🏪 A base de unidades é trabalho contínuo — e é escopo cobrável

📍 A SIC contou em 03/09 que **montar a lista de lojas foi trabalho manual deles**.

**Parte fácil — montar a base nacional.** Atacadão, Carrefour e Sam's Club
publicam as unidades nos próprios sites. Dá para montar sem trabalho manual, e
resolve de uma vez as 150 grafias para ~98 lojas. ⬜ Confirmar que as listas ainda
estão acessíveis.

🚨 **Parte difícil — loja muda, e o histórico não pode mudar junto.** Um Express
vira Atacadão; um Carrefour vira Sam's Club. Se o cadastro for simplesmente
atualizado, **o registro de março passa a dizer que aconteceu num Atacadão que não
existia em março** — e todo relatório do passado muda sozinho, calado.

➡️ **A unidade guarda a bandeira com data de vigência**, e cada registro fica preso
à bandeira que valia no dia. É pouca coisa no desenho e **impossível de consertar
depois que houver dado dentro**.

**E não para aí:** loja fecha, muda de nome, muda de endereço, duas viram uma.
Isso não é cadastro, é **manutenção contínua** — precisa de tela própria no painel
administrativo e de alguém cuidando.

💰 **Anotado como escopo cobrável, a pedido do João (03/09):** *"isso aí vai ser
foda"*. Não é item de setup, é serviço que não acaba.


### 🔑 O diferencial estrutural — um modelo, várias experiências

Identificado pelo João em 03/09, e é mais forte que notícia e que tempo real:

> **O Power BI lê. Ele não coleta, e não sabe quem está olhando.**

| quem | preenche | vê |
|---|---|---|
| consultor | report diário da visita | o que interessa à rota dele |
| **gerente da loja (o "mercado")** | **ocorrência da loja** | a loja dele, as pendências que ele tem que resolver, e o relatório do contrato |
| apoio social | prontuário | a cronologia da pessoa |
| liderança | — | **o cruzamento de todos**, inclusive as divergências |

Ferramenta de BI é camada de leitura sobre um conjunto pronto: não tem coleta, não
tem papel, não tem regra de quem vê o quê.

⚠️ **Correção de 02/09:** "mercado" e "gerente da loja" **são a mesma pessoa, e ela
preenche.** O cliente final deixou de ser só leitor de relatório — passa a
registrar ocorrências, que alimentam o mesmo banco. É daí que a liderança tira a
visão da atuação dos consultores.

🚨 **E o indicador de divergência é a prova disso.** "Consultor registrou que não
houve ocorrência, a loja registrou que houve" só existe porque **o mesmo sistema
coleta os dois lados**. É estruturalmente impossível no arranjo atual deles — não é
que o Power BI faça mal, é que não tem como fazer.

➡️ **Consequência de arquitetura:** `papel` **não é só regra de acesso, é regra de
produto** — decide o que a pessoa preenche *e* o que ela vê. É a primeira coisa a
entrar no banco, e hoje o usuário só tem `is_admin`.

### 🔄 O SIMEops muda de posicionamento — a notícia vira indicador

> *"As notícias vão servir para uma coisa só: indicadores."* — João, 03/09

O app deixa de ser leitor de notícia. **A notícia passa a ser matéria-prima de
indicador**, dentro do dashboard e do relatório. O feed de leitura **sai do centro
do produto** — isso reordena o redesenho inteiro da navegação.

✅ **E abriu a única porta em que a gente pode propor:** a SIC deu **liberdade para
propor indicadores** cruzando dado de formulário com notícia. A coluna vertebral
(enunciado das perguntas) segue intocável; os indicadores, não. É onde está o
dinheiro, segundo o próprio João, e é o que o Power BI estruturalmente não faz.

⬜ **Trabalho novo que isso cria:** desenhar o conjunto de indicadores. Insumo
pronto em [PERGUNTAS_X_RELATORIO.md](./Protótipo/PERGUNTAS_X_RELATORIO.md) (o que
já vira gráfico e o que se perde) e em [FUNIL.md](./FUNIL.md) (o que a notícia
consegue entregar — **cidade, nunca bairro ou loja**).

### A loja vira fonte de dado — e resolve a verificação cruzada

Ideia da SIC: o **gerente da loja** ganha formulário próprio no celular e passa a
registrar ocorrências, sem depender do consultor.

🔑 **Divergência entre as duas fontes vira indicador na liderança** — loja
registrou algo que o consultor disse não ter havido. Resolve sozinha a pergunta
que a gente não sabia responder: *"dá para saber se o consultor esteve lá?"*

⬜ **Consequências de desenho:** acesso por loja (senha compartilhada, perfil
individual criado uma vez, biometria do aparelho para entrar) · desativação de
perfil pelo painel quando um gerente sai · e o formulário da loja é **diferente**
do formulário do consultor.

### Confirmado pela SIC — o que deixa de ser hipótese

- ✅ **Prestam serviço público em parceria**, inclusive com **agência de emprego**,
  e **acompanham a pessoa** até a assistência social e até tentar emprego. A base
  legal se apoia nisso. Derruba a premissa de que só o resultado para a loja
  importaria.
- ✅ **Querem cadastro de pessoas com acompanhamento** — reincidência e desfecho.
- ✅ **Consultores vão bater ponto pelo app.**

📍 Relato completo, com o que caiu e o que se confirmou, em
[REUNIAO_SIC.md](./Protótipo/REUNIAO_SIC.md).

### ❓ Dúvidas em aberto ao fim do planejamento — 04/09

**Dependem da SIC** (levar na próxima conversa):

| # | pergunta | o que trava |
|---|---|---|
| 1 | 🔑 **A parceria de serviço público é formalizada?** Convênio ou termo, com qual órgão? | sustenta o **prontuário inteiro**. Com documento, base legal é política pública; sem nada escrito, é empresa privada guardando saúde e dependência química de pessoas em situação de rua |
| 2 | 🔑 **Tem sinal de internet dentro da loja?** Onde falha? | **a maior decisão de arquitetura.** Sem sinal confiável o app é local-first, e isso é a *forma* dele, não uma camada |
| 3 | **O que o mediador preenche onde não há psicóloga?** Versão reduzida do questionário do apoio, ou só a abordagem? | decide se o formulário dele ganha um bloco a mais |
| 4 | **O texto que o consultor manda no grupo de WhatsApp tem coisa que o formulário não tem?** | se tiver, é **dado que se perde inteiro hoje**. Pedir 5 a 10 relatórios reais do grupo e comparar contra os 39 campos |
| 5 | **Quais outras perguntas da lista 3.4** entram no dashboard? | o valor prevenido já foi confirmado; `movimentações atípicas` vai só para a liderança. Faltam `classificação da ameaça`, `quem foi afetado`, `tentativa ou consumação` |
| 6 | **O `Report Diário` é obrigatório todo dia útil?** | decide se "sem registro" significa "não visitou" — e se o número das **61 lojas** pode ser dito em voz alta |
| 7 | **Quem é o gerente do dashboard do mercado** — de uma loja ou de várias? | define o recorte de acesso do site do cliente |

**Dependem do João:**

| # | decisão |
|---|---|
| 8 | **O que de `Protótipo/` entra no git** — os documentos sim, as planilhas com CPF não |
| 9 | **A base atualizada da SIC** — destrava normalizar lojas e pessoas para a demo |

**Dependem de investigação nossa, sem depender de ninguém:**

| # | o quê |
|---|---|
| 10 | As listas de unidades publicadas por Atacadão, Carrefour e Sam's Club ainda estão acessíveis? |
| 11 | As três páginas órfãs do painel adm (`analytics`, `groups`, `news`) — veredito de cada uma |
| 12 | Varredura de copy da interface atual — insumo do dicionário de vocabulário do app |


### O que a gente pede à SIC — e o que não espera

📍 **A SIC não vai ser consultada a cada dúvida.** A conversa de projeto acontece
no fim; até lá, o que se pede tem que caber num pedido de rotina de fornecedor.

**Pedido em 31/08, sem levantar suspeita de projeto novo:**

- ⬜ **A lista de unidades** — bandeira, nome oficial, cidade, UF, código interno
  se houver. Justificativa natural e verdadeira: a planilha traz `ATACADÃO CEASA
  288` e `ATACADAO CEASA 288` como lojas diferentes.
- ⬜ **A exportação atualizada das três bases** — necessária em dois momentos: na
  conversa com a SIC (número defasado na frente do cliente é pior que número
  nenhum) e na migração, quando as três precisam sair no mesmo dia.
- ⬜ **Os relatórios que eles montam hoje** — travam a camada de indicadores. É a
  cópia que a gente tem que gerar, e fidelidade importa mais que beleza.
- ⬜ **Contrato de operador (uma página)** — ver LGPD abaixo. Pede junto, é o
  papel que qualquer fornecedor de software assina.

✅ **Android e iPhone — respondido: os dois.** A SIC já solicitou iOS. O item de
iOS deixa de ser hipótese.

**O que não se pede, porque dá para derivar:** a lista de unidades sai das três
bases (150 grafias para ~98 lojas reais). A lista provisória se monta aqui, e a
da SIC vira **conferência**, não bloqueio. Ela nasce **incompleta de propósito** —
ver o desvio [Unidade fora da lista não pode travar o consultor](./Protótipo/MUDANCAS.md).

**O que fica para depois de tudo validado:** o "banco interno da empresa". Não se
sabe o que é, e não desenha nada enquanto não virar concreto.

### LGPD — o que ela trava de verdade

🚨 **Ela não é sobre quem vê. É sobre quem guarda.** Hoje a SIC é controladora e a
Microsoft é operadora daquele dado. Quando a base sai do Forms e entra num
Supabase da conta do João, **ele vira o operador** de cor/raça, saúde e histórico
com a justiça de 761 pessoas.

Sendo preciso:

- ✅ **Não trava construir.** Modelo, API, telas e relatório podem ser feitos. E
  o **formulário do consultor não tem uma linha de dado pessoal** — a primeira
  spec vai inteira sem tocar em dado sensível.
- ⬜ **Trava colocar dado real dentro** — a migração das 761 linhas do Apoio
  Social. Consultor e mediador não dependem disto.
- ✅ **Relatório agregado não é problema.** *"62% relataram uso de substância"* é
  estatística. Lista com nome, loja e condição de saúde é dossiê. **Regra de
  desenho: o relatório da liderança é agregado; registro individual só na
  ferramenta de quem atende, com log de quem abriu.**

**"Forneceu voluntariamente" não resolve.** Consentimento tem definição fechada
(art. 5º, XII: livre, informado, inequívoco, para finalidade específica) e o
art. 11 exige, para dado sensível, que seja **específico e destacado**. Hoje
faltam os quatro: ninguém foi informado (o rodapé do Forms diz que não há
política de privacidade), não há prova — o ônus é do controlador, art. 8º, §2º —
e "livre" é discutível quando a pessoa está em vulnerabilidade sendo abordada por
quem representa a loja. Nenhuma outra hipótese do art. 11 cobre consultoria
privada fazendo assistência social, então **consentimento é praticamente a única
base disponível**. Vira tela: ver o desvio *Passo de consentimento* em
[MUDANCAS](./Protótipo/MUDANCAS.md).

**Documento assinado pela SIC é necessário, mas não é escudo.** Contrato entre
duas empresas não tira obrigação diante de um terceiro que não assinou nada. O
art. 42, §1º faz o operador responder **solidariamente** quando descumpre a lei
ou a instrução lícita do controlador — se o vazamento vier de falha do nosso
sistema, a assinatura não muda nada, e a ANPD sanciona o operador direto. O que
existe de verdade não é "termo de isenção": é **contrato de operador** — papéis,
finalidade, prazo, o que se pode fazer com o dado e o que acontece no fim.

**O que reduz risco de fato**, em ordem de barateza:

1. **Não guardar o que a operação não usa** — CPF em 10% e RG em 3% dos 761: em
   nove de cada dez atendimentos ela funcionou sem eles. Não importar é grátis.
2. Cifra e controle de acesso nos campos sensíveis.
3. **Instrução por escrito** — pedido da SIC fora do combinado se responde por
   e-mail; é o que constrói a prova de que se seguiu instrução.
4. Prazo de descarte, e caminho para apagar o registro de uma pessoa que pedir.

⬜ **A conferir antes de desenhar a tela de consentimento:** se há **menor de
idade** na base (a coluna de nascimento existe). O art. 14 exige consentimento de
pai ou responsável, e aí a tela é outra.

📍 Leitura técnica de quem leu a lei, **não parecer de advogado**. Quando houver
dinheiro, uma hora de advogado nisso é barata.


### A ordem das três frentes — decidida em 01/09

Não existe versão em que o sistema guarda dado sensível e tem exposição zero. A
única exposição zero é **não guardar**. Isso vira ordem de construção, não medo:

| opção | o que entra no app | dado sensível |
|---|---|---|
| **A** | só o consultor | **nenhum** — a base não tem um campo de pessoa |
| **B** | consultor + mediador | cor/raça (88%) e nome completo (19%) |
| **C** | as três frentes | tudo, incluindo saúde, substância e justiça |

⚠️ **Superado em 03/09.** A SIC quer sair do Power BI e pediu **protótipo de dashboard até o fim de setembro**, e o formulário da loja entrou no escopo. O "A" sobrevive só como **ponte técnica** (apontar o Power BI deles para o nosso banco enquanto a tela própria não fica pronta). O texto abaixo fica como registro do raciocínio de 31/08.

~~Decidido: A primeiro~~ — e não por cautela. O consultor é a frente com mais
registros (1.485), a que a SIC vê primeiro, a que valida a espinha inteira, e a
única que dá para construir, testar e demonstrar **sem depender de contrato, de
advogado ou de a SIC responder qualquer coisa**. Destrava tudo e não trava em
nada. B e C entram com o contrato assinado — já com a lista abaixo pronta, porque
foi construída junto com o A.

### Os 8 itens do operador — o que "resolver LGPD" quer dizer do nosso lado

Metade não é nossa: a SIC é **controladora** e é dela definir base legal, coletar
consentimento, ter política de privacidade, nomear encarregado e responder ao
titular. Tentar resolver por ela é assumir o papel dela.

A nossa metade é fechada e toda construível:

1. ⬜ **Contrato de operador assinado** — papéis, finalidade, prazo, fim do contrato.
2. ✅ **Não coletar o que não precisa** — CPF e RG fora (decidido 31/08).
3. ⬜ **Cifra nos campos sensíveis + acesso por papel** — entra no modelo.
4. ⬜ **Log de quem abriu registro individual.**
5. ⬜ **Caminho para apagar uma pessoa** que revogar o consentimento.
6. ⬜ **Prazo de descarte** definido e automático.
7. ⬜ **Plano de incidente** — o art. 48 obriga avisar ANPD e titular.
8. ⬜ **Consentimento gravado com a versão do texto** — vira tela.

Nenhum é caro entrando no desenho; todos são caros entrando depois.

⬜ **Perguntar à SIC quando der: para que serve `cor/raça`?** — respondido em
01/09 pelo próprio painel deles (o donut `Cútis`): **é indicador, o campo fica**,
cifrado e restrito. Fica registrado porque a pergunta vai voltar.

### Como o dado de terceiro entra — mão única, sempre

🚨 **Conexão ao vivo com banco de cliente, nunca.** Vale para o "banco interno" da
SIC e para qualquer base que venha de fora. O padrão é um só:

> eles exportam → a gente importa → roda tudo no nosso servidor

- **Mão única.** A gente lê a exportação e nunca escreve de volta. Dado errado na
  origem, quem corrige são eles, na fonte.
- **Importação repetível.** Rodar duas vezes o mesmo arquivo dá o mesmo resultado
  e não duplica.
- **Data de corte carimbada**, e a tela dizendo *"dado de 12/09"* — foto velha
  confundida com tempo real é como se decide errado com confiança.
- **A lista provisória de unidades usa esse mesmo mecanismo** — é a primeira
  carga, e o exercício que prova o padrão.

### 🔒 Decisão pendente do João — o que entra no git

`workdesk/Protótipo/` está **untracked** e contém material com **dado pessoal
real** (nome completo, CPF, respostas de saúde) nas planilhas e capturas.

Os **documentos** dessa pasta deveriam estar versionados — são o norte da
construção e não têm dado pessoal. As **planilhas e capturas** não. Proposta:
`.gitignore` deixando entrar `.md` e `.html` e mantendo fora `formularios/` e
`referencia visual/`.

⚠️ Decisão do João, e é irreversível para um lado: **o que entra no histórico do
git não sai mais.**

### Trabalho futuro, decidido e não agendado

- ⬜ **Apresentação comercial para a SIC.** Peça de venda com os números medidos da
  operação **deles**: 61 lojas sem visita há 90+ dias, o funil social que não
  fecha, R$ 2,58 mi prevenidos em 7 meses, 29% da base enviada em lote. **Sem dado
  pessoal nenhum.** Sai quando o relatório deles chegar.
- ⬜ **Os dois formatos de painel da SIC** — para o dono (semanal, saúde do
  contrato) e para o supervisor (diário, cobrança). Depende de saber quem é a
  liderança lá.
- ⬜ **Dicionário de vocabulário do app** e varredura de copy tela por tela. A
  regra: *o controle usa o termo do campo*. Cobre três camadas — as palavras que a
  SIC já usa, as que esta fase inventa (como se chama uma ida à loja? o Forms usa
  "atendimento" **e** "registro" para a mesma coisa) e as do app de hoje (feed,
  consulta, monitoramento), que vão conviver com as novas na mesma barra.
- ⬜ **Mapa das telas atuais** — o que acontece com cada tela quando a navegação
  vira `Hoje · Notícias · Campo`. Impede descobrir na implementação que uma tela
  ficou órfã.


### Verificações em aberto — medições que faltam

- **`api_rate_limits.brightdata.max_concurrent` nunca foi revisado** — está em
  10, e a doc da Bright Data diz que o limite real é **100 QPS** (uma busca faz
  ~0,07 QPS). Pode subir; só não foi medido.
- **Ramo web: 1 de ~4 medições feitas.** Critério já combinado com o João: se
  seguir entregando ~1 de 23, desligar pelo painel.
- **Período de 180 dias ponta a ponta** — 90 dias foi medido em 02/08 (São
  Paulo, alcance de 90 dias exatos); falta repetir com 180.
- **Tempo da busca depois da migration 028** — o ~11 min medido é anterior a
  ela. É o número que recalibra `_segundosPorAssunto` em `assuntos_field.dart`.

### Bugs conhecidos / suspeitas

- **Página vazia da Bright Data** (HTTP 200, 0 bytes, sem `x-brd-err-code`):
  observada em 01/08, causa **desconhecida**. Mitigada com 1 retry desde a 8.1.
- **Filter0 com keywords amplas** (`jogo`, `tempo`, `música`, `esporte`): geram
  falso negativo. Estratégia em aberto.
- **Sem `parent_id` não há pós-filtro nenhum** (`locationPostFilter = undefined`)
  — a cidade aceitaria notícia de qualquer lugar. Hoje as 4 cidades têm pai; é
  latente.

---

---

# 🟡 DEPOIS

### ⬜ Anatomia comum de `CityCard` e `HistoryCard` — PLANEJADA, NÃO FEITA

🚨 **Este plano foi escrito, discutido com o João e nunca executado** — o arquivo
de plano foi sobrescrito pela Fase D. Registrado aqui para não se perder de novo.

Pedido do João, com as duas listas na mão: *"um eu acho muito simples (busca) e o
outro eu acho muito grande e não sei se essas contagens são úteis de fato"*, e a
direção: *"se fizesse um merge dos dois mas pudesse colocar em cada estrutura
informações úteis para cada propósito"*.

O diagnóstico: a divergência é **estrutural, não de densidade**. O `CityCard`
(~235px) tem quatro elementos, o `HistoryCard` (~90px) tem três, e nenhum
compartilha espaçamento ou degrau de tipo com o outro. E o card diz a mesma coisa
duas vezes — a frase afirma *"Patrimonial responde por 52%, a maior fatia"* e a
linha de baixo mostra `11 PATRIM. · 6 SEGUR.`: o número maior e a maior fatia são
o mesmo fato em duas linguagens. É a redundância, não os números, que faz 235px.

Anatomia de quatro posições, cada tela preenchendo com o que serve ao seu
propósito:

```
① etiqueta esquerda                    ② etiqueta direita     mono 9.5
   NOME DO LUGAR                                              Archivo bold
③ linha de qualificação                                       prosa ou mono
④ FIGURA(S)                                                   número + rótulo
```

| | DASHBOARD | CONSULTAS |
|---|---|---|
| ① | UF + `N NOVAS` em verde | UF |
| ② | `21 EM 30D` | a hora (`08:47`) |
| ③ | prosa — **só se tiver o que dizer** | `30 DIAS · 17 ASSUNTOS` |
| ④ | quebra por categoria | `56 RESULTADOS` |

Regra de ③: só entra o que **nenhuma figura do card mostra**. Grupo → nomeia as
cidades (`Grande Florianópolis` não informa nada a quem não é de lá, e o app é
vendido pra fora da cidade monitorada). Cidade sozinha → fica muda. Cidade
zerada → a frase de vazio ocupa ③ e ④.

No `HistoryCard`, **falha e andamento ocupam ④**, onde ia o número: hoje esses
estados brigam com a hora na linha de cima.

Peça compartilhada nova: `core/widgets/entrada_de_lugar.dart` — o que estava
divergindo eram os espaçamentos e os degraus de tipo, então é isso que a peça
guarda. `Figura` é o `_Figure` privado de `city_card.dart` promovido.

~~**Junto:** matar o `EndMark` e suas 9 chamadas.~~ **Já estava morto** — só
sobrou a lápide em `take_card.dart:485`, zero chamadas. Eu copiei essa pendência
do plano velho para cá sem conferir, e a corrigi cinco minutos depois: é
exatamente o apodrecimento silencioso que a regra zero da workdesk descreve, e
consegui cometê-lo **dentro do documento que registra a regra**.


---

### ⬜ Revisão de copy, tela por tela — POR ÚLTIMO

Deixar para quando nada mais mudar texto. Já decidido e não feito: a frase de
lista vazia do monitoramento tem que virar **três**, porque hoje uma só cobre
três situações diferentes —

| situação | o que a tela diz |
|---|---|
| monitorada, 30D, nada | `Nada publicado nos últimos 30 dias. A última notícia desta cidade é de 28/07.` |
| nunca teve notícia | `Nenhuma notícia desde que esta cidade entrou no monitoramento, em 23/04.` |
| não carregou | `Não foi possível carregar o relatório.` + `TENTAR DE NOVO` |

A terceira depende de separar "respondeu vazio" de "não respondeu" (ver dívida
técnica).


---

### Acabamento de cor nas telas fora do redesign

Verificado em 27/08: `Colors.*` cru ainda vive em `login`, `settings` e
`history_card` — telas que ficaram fora do escopo da Fase 10. Não é bug, é
inconsistência: essas três não passam pela escala de tinta do
[DESIGN_CONTRATO](./DESIGN_CONTRATO.md).

---

### 🗺️ Onde buscar — a alavanca que o funil revelou (03/08)

O baseline de Goiás mostrou que **57% das rejeições são de cidade** (55 de 96), e
que **32 delas são cidades do próprio Goiás** — Goiatuba 14, Luziânia 4,
Anápolis 3, Formosa, Itumbiara, Catalão, Crixás… Notícia real de crime,
coletada, baixada, analisada, **paga**, e jogada fora por não ser a capital.

A seção REGIÃO METROPOLITANA não pega essas: Goiatuba fica a 200 km, Luziânia é
Entorno do DF. Recuperá-las **não custa nada** — o dinheiro já foi gasto.

### 1. Abrangência na tela de busca

`Só a cidade` · `+ Região metropolitana` · `Raio de N km` · `Estado inteiro`.
O encanamento existe: `cidadesRegiao` + `classificar` já são parâmetros do
pós-filtro ([pipelineCore](../backend/src/jobs/pipeline/pipelineCore.ts)).

⚠️ Isto é **recuperação, não coleta**. Um raio maior não faz o Google devolver
mais — faz o pós-filtro guardar mais do que já veio. Buscar *também* nas cidades
do raio é outra coisa, mais cara em tempo, e tem que ser escolha separada.

### 2. Mapa com raio (ideia do João, 03/08)

Arrastar um raio no mapa em vez de escolher "região metropolitana". Melhor que a
lista atual em dois sentidos: é exato (hoje é uma pergunta ao GPT com guarda de
alucinação e teto de 45 municípios) e se explica sozinho na tela.

**O que falta:** uma tabela de municípios com lat/lng. O pipeline filtra por
**nome** (`mesmaCidade`), não por coordenada — o artigo só é geocodificado
depois, pro mapa. Então o raio não filtra artigo: ele **produz a lista de nomes**
que vira `cidadesRegiao`.

⚠️ **Não estender o GPT pra isso.** `metroRegion` funciona porque região
metropolitana é um fato jurídico que o modelo memorizou; "municípios num raio de
100 km" é uma **conta**, e o modelo erra conta. O caminho é dataset estático
(5.570 municípios, ~300 KB, não mudam) + haversine.

### 3. Coerência entre a busca e o feed — verificar

Hoje **são dois comportamentos diferentes**, e isso é o que parece bagunça:

| | cidade vizinha |
|---|---|
| busca manual | vira `extras.regiao`, seção recolhida (9.4) |
| feed / auto-scan | **descartada, some** (`classificar` é opt-in e fica off) |

O motivo do opt-in está no [pipelineCore](../backend/src/jobs/pipeline/pipelineCore.ts):
o auto-scan grava direto em `news`, e classificar ali faria o CRON salvar cidade
vizinha como se fosse a monitorada — a mesma poluição de escanear `type='state'`.

Para o feed mostrar região sem poluir, `news` precisaria carregar o sinalizador
(coluna nova + migration), não só deixar de descartar. **Decisão de produto antes
de código.**

### 4. Região metropolitana mais aparente (pedido do João)

Hoje ela é uma seção recolhida no fim — foi por isso que "Goiânia deu 11" quando
tinham 19. Falta: indicativo no próprio card, contagem no sumário
(`11 + 8 na região`) e uma entrada própria nos filtros, não só o acordeão.

---


---

### ⚡ Acelerar o estágio 4 (backend, decidido em 02/08)

> ⚠️ **Renumerada de "Fase 10" para "Fase 12" em 27/08.** As fases 10 e 11 foram
> criadas retroativamente no recorte da workdesk (a antiga "Fase 9" era seis
> trabalhos num documento só). Este item nunca começou — só o número mudou.

Ideia levantada pelo João logo depois do primeiro teste real: *"não tem jeito de
fazer isso mais rápido?"*. **Adiada para depois do app**, por decisão dele.

### O diagnóstico, medido

A busca leva 5min31s, e **179s (54%) é baixar as matérias**: 241 artigos, ~7,4s
cada, 10 por vez.

### Por que não é uma config só

⚠️ Há **dois limitadores em série**, ambos em 10:

| onde | chave |
|---|---|
| pool do `runContentFetch` | `manual_search_fetch_concurrency` (tem campo no painel) |
| `Bottleneck` do rateLimiter | `api_rate_limits.jina.max_concurrent` (**sem UI**) |

Subir só o primeiro **não acelera nada** — o segundo estrangula igual. E
`api_rate_limits` não tem tela: a API existe (`GET`/`PATCH /settings/rate-limits`)
e nenhum componente do front a consome.

### O que fazer, em ordem

1. **Tratar o 429 do Jina** com retry e `Retry-After`. Hoje um 429 vira "fetch
   falhou" e **perde o artigo em silêncio** — subir a concorrência sem isso troca
   lentidão por resultado faltando, que é pior.
2. **Expor `api_rate_limits` no painel** (a API já existe).
3. Subir os dois para 20 e medir. Estimativa: estágio 4 de 179s → **~90s**, busca
   inteira para ~3min40.

❓ **Depende de saber o plano contratado do Jina** — não está no repo. Sem isso, o
caminho é subir devagar (10 → 15 → 20) e observar quando o 429 aparece; com o
passo 1 feito, um 429 custa só um segundo a mais.

---


---

### 🔧 Dívida técnica

- **Migration 024** — 7 configs mortas, pronta e não rodada. Neutra.
- `openai` ^4.24.1 → v6.
- Flutter: `fl_chart` 0.70→1.x, `share_plus` 10→12, `flutter_map` 7→8,
  `sentry_flutter` 8→9.
- **Renomear "Netrios News" → "SIMEops"** (diretório e repo).


---

# 🔵 IDEIAS

### 🆕 Saiu de 17/08 — decidir

- 🚨 **O balde `outros` tem ocorrência legítima sem tipo.** Ele não está na
  taxonomia (é tipo, nunca vira pergunta), mas hoje guarda **desaparecimento de
  pessoa**, **suspeita de bomba** e **sequestro/tortura**. As três interessam ao
  cliente e as três aparecem no app como "Outros". Decidir se viram tipo próprio
  — `desaparecimento` é o mais frequente dos três.
- **Estatística nacional entra como se fosse local.** *"Uma em cada dez
  brasileiras sofre violência digital"* foi gravada com `cidade =
  Florianópolis` porque a query era sobre Florianópolis. A lista negativa da
  regra 2 (17/08) **não** cobre isso: é defeito de localização, não de
  classificação. Provável conserto: exigir que a estatística cite a cidade ou o
  estado monitorado.
- **Reconferir o volume por volta de 21/08.** 31 notícias em 17/08 contra média
  de 2,0/dia. Se firmar acima de ~10/dia, revisar de novo o formato do push (a
  janela de agrupamento hoje é a rodada de scan, não o relógio) e o custo de
  Jina + GPT, que escala junto.
- **Manchetes cortadas no meio da palavra continuam gravadas.** O conserto
  (`cortarNaPalavra`) vale só para linha nova. Regravar as antigas exigiria
  passar GPT de novo — provavelmente não vale.

### 💡 Em aberto (não decidido)

- **Fontes oficiais por estado** (SSP/Polícia Civil): 27 fontes, não 5.570
  cidades — encaixa no `type='state'` que já existe. O RSS grátis enxerga matéria
  que o SERP pago não surface. É projeto, não remendo.
- **Google News RSS como índice** (não como fonte): título, data e veículo
  corretos e de graça, mas a URL é redirect opaco. Só vira útil se aparecer forma
  limpa de resolver a URL.
- **Push de estatística:** `natureza === 'estatistica'` dispara push igual a crime
  ("homicídios caíram 12%" chega como alerta). Decisão de produto.
- **Assuntos por perfil de cidade:** capital e cidade pequena não rendem com a
  mesma pergunta. Agora que `search_subjects` está no painel, isto vira "lista por
  location".
- Subir `filter2` de 5 para mais concorrência (o limite da OpenAI é bem maior).


---

### 🌐 Domínio próprio do relatório (12/08)

O link que vai pro cliente é
`sistemaprogestao-7fzs.onrender.com/public/report/<uuid>`. Funciona, e **não
piorou nada** (o `ADMIN_PANEL_URL` de antes também era subdomínio do Render), mas
não é endereço de peça de apresentação.

**Do nosso lado já está pronto:** `urlPublica()` lê `PUBLIC_BASE_URL` antes de
qualquer coisa. É variável de ambiente no Render, **zero linha de código**.

Levantado em 12/08, e é por isso que fica pra depois:

- `progestao.com.br` existe (NS na Locaweb, MX da Locaweb) mas é de **outra
  empresa de mesmo nome** — não dá pra usar.
- `simeop.com.br`, que o João chegou a cadastrar no Render, **não está
  registrado** (NXDOMAIN no `.com.br`) — não existe zona onde criar o CNAME, e
  por isso a verificação do Render nunca ia passar, por mais que se apertasse
  "Retry".
- Caminho: registrar `simeops.com.br` no registro.br (~R$ 40/ano), CNAME
  `relatorios` → o serviço do backend, e setar `PUBLIC_BASE_URL`.

**Junto, quando for a hora:** encurtar a rota pra `/r/<id>` — é uma linha, e a
hora certa é antes de existir link antigo por aí.

### 🔎 Achado solto, do mesmo levantamento

`services/geocoding/nominatim.ts` manda `contact@progestao.com.br` no User-Agent,
em 3 lugares — o domínio de outra empresa. A política de uso do OSM pede contato
válido pra poder avisar sobre abuso antes de bloquear. Trocar quando houver
e-mail próprio.
