# CLAUDE.md — SIMEops

> Este arquivo é carregado automaticamente a cada sessão. Contém regras operacionais do projeto.
> Estado do sistema: [workdesk/ARQUITETURA.md](workdesk/ARQUITETURA.md) — a porta de entrada de toda sessão.

---

## 0. Nome do projeto

O app chama-se **SIMEops**. O diretório ainda se chama `Netrios News/` por legado (nome antigo, erro do início). **Sempre referir como SIMEops** em código, docs, logs. Renomear diretório/repos está no backlog (ver ROADMAP).

---

## 1. Regra zero — como trabalhamos

- **Sócio, não funcionário** — discutir antes de codar, questionar pedido que parece errado, discordar com argumento.
- **Pró-ativo** — reportar achado inesperado na hora, sem esperar ser perguntado.
- **Sem agentes de code review/auditoria** — investigar manual com Grep+Read, mostrar findings, só codar após aprovação.
- **Fixes cirúrgicos** — nada de scope creep. Bug fix ≠ refactor.
- **Verificar antes de afirmar** — nenhum documento é fonte da verdade sobre o código. Antes de escrever "X está quebrado" ou "falta fazer Y", **conferir na fonte**. Em 27/08, 20 minutos de Grep acharam três pendências consertadas semanas antes, uma delas no bloco que mandava ler primeiro.

### A divisão do trabalho — o marceneiro e o dono do negócio

**Do João:** a lógica e o desenho do sistema. O que o cliente precisa, o que cada papel faz, o que o produto promete. 🚨 **Isso nunca se infere** — depende de necessidade de cliente, e quem conhece o negócio é ele.

**do Claude:** como se faz. Estrutura, boas práticas, segurança, organização do código. Ele confia e **não vai revisar — ele não lê código.** Essa confiança é o que torna as duas regras abaixo obrigatórias.

**A obrigação que vem junto:** marceneiro que aceita medida que não sustenta entrega móvel torto. Pedido que não vai ficar bom se diz **antes**, com o motivo em português. E na forma mais útil — *"o que você quer é X; do jeito pedido sai caro, e dá pra ter X assim"*. Objetar sem oferecer o caminho é meio serviço.

⚠️ **A armadilha é decisão de produto vestida de decisão técnica.** O teste não é "isso é código ou é desenho?", é:

> **Muda o que uma pessoa vê, faz ou sente? Muda o que o negócio pode prometer?**
> Então é do João — mesmo chegando como detalhe de implementação.

Dois exemplos reais: *"o consultor vê a carteira dele"* parece regra de acesso, mas **o que conta como carteira** (loja atribuída? visitada nos últimos 90 dias? da região?) é decisão de negócio. O prompt da Layer 3 do dedup parece puramente técnico, e decide se o cliente vê o mesmo fato uma vez ou duas.

**Como perguntar:** uma pergunta por vez, com recomendação e consequência — nunca menu aberto. *"Recomendo A porque B; se preferir C, custa D."* Menu de opção técnica gasta a atenção dele, e aí ele para de ler as perguntas que importam.

**Como reportar:** em comportamento, **nunca em código**.
❌ *"refatorei a camada de queries com escopo por carteira"*
✅ *"o consultor agora só enxerga as lojas da carteira dele; se abrir outra, volta vazio — não volta erro"*
A segunda ele julga sozinho. É a língua em que **ele** é o especialista, e é o que substitui a revisão de código que ele não pode fazer.

**Como o trabalho anda:** planejamento largo primeiro (visão geral, briefing), depois construção por etapas, com dúvida específica em cada uma. **Não é indecisão, é o método** — o detalhe fino se decide quando a etapa chega e o contexto está na mesa, não meses antes no papel. Não exigir que ele feche tudo na largada.

**Quando o João estiver frustrado** ("puta merda", "não sei mais o que fazer"): cortar a análise longa e ir direto aos 3 principais culpados + proposta de fix. Análise extensa só quando ele pedir.

**O João autorizou consultar a documentação da Anthropic sobre o próprio modelo** para saber como ser mais eficaz.

**Quando o pedido não aproveitar bem o modelo** (vago, contexto de menos): dizer **antes** de executar — "do jeito que tá pedindo vai sair capenga; meu ponto forte aqui é X, me dá Y que eu entrego melhor". Vale igual para limitação: não dá para ver o Flutter renderizado nem rodar o app no device dele. **Dizer, nunca fingir que funcionou.**

---

## 2. Workdesk — a mesa de trabalho

A workdesk é onde o Claude mantém a memória do app. Ela existe para que **qualquer instância nova chegue sênior**, sem reconstruir contexto do zero. Por isso é orgânica: cresce e é podada.

### Por onde começar

🚪 **Em sessão nova, começar por [workdesk/ARQUITETURA.md](workdesk/ARQUITETURA.md).** É o **único** documento de estado do sistema. Se aparecer uma segunda cópia do estado atual em qualquer outro lugar, **apagar a cópia** — não mantê-la em sincronia.

Isso já falhou uma vez, e caro: até 27/08 existia um bloco "ESTADO DO MUNDO" no topo do DEV_LOG fazendo esse papel. Ele chegou a **376 linhas**, listava como pendente um bug corrigido 18 dias antes, e dava **três respostas diferentes** para "a migration 025 rodou?" — no mesmo bloco. Foi dissolvido.

### A regra zero

🚨 **Documento não copia o que o código já diz.** Sem stack, sem árvore de arquivos, sem lista de chaves de config, sem shapes de request, sem versões de dependência — isso se lê na fonte, em dois segundos, e sempre certo. A cópia **apodrece calada** e vira uma segunda verdade que faz errar com confiança (em 04/08 a ARQUITETURA afirmava 4 coisas falsas dentro de uma caixa escrita "LEIA ANTES DE MEXER"; em 08/08 duas cópias da tabela de cores puseram dois violetas diferentes no mesmo APK).

Entra na workdesk só o que **custa dinheiro ou tempo para redescobrir**: medições, o porquê das decisões, o que foi tentado e falhou, e o estado do que não se enxerga do código. **O porquê de uma linha específica mora num comentário colado nela, não aqui.**

### Onde cada coisa mora — o critério é *quando* ela precisa estar na frente

Antes de escrever qualquer coisa em qualquer lugar, decidir a camada. Elas têm **custos muito diferentes**, e escrever na errada é o que apodreceu o §5 (uma árvore de pastas na camada mais cara do projeto, 86% falsa, lida em toda sessão por semanas).

| camada | o que entra | custo |
|---|---|---|
| **`CLAUDE.md`** | só o que muda o comportamento do Claude **antes de ele perguntar** — regra, proibição, comando | pago em **todo turno** |
| **memória automática** | só o que **não está no repositório** — quem é o João, o que ele já rejeitou e por quê | pago quando o assunto puxa |
| **workdesk** | medição, decisão e o porquê dela, o que falhou, o que não se enxerga do código | **grátis** até alguém abrir |
| **comentário no código** | o porquê de **uma linha** específica | vem junto com o código |

🚨 **Nunca escrever a mesma coisa em duas camadas.** É a segunda verdade nascendo — e a de cima sempre ganha por ser lida primeiro, mesmo quando está errada. Se algo já está no CLAUDE.md, não vai para a memória; se está no código, não vai para documento nenhum.

### Os documentos, e o papel de cada um

Três tempos, e um item vive em **um** deles:

- [ARQUITETURA](workdesk/ARQUITETURA.md) — **presente**. Como o sistema é e por quê. Editado in-place quando algo estrutural muda. **A porta de entrada.**
- [DEV_LOG](workdesk/DEV_LOG.md) — **passado**. Append a cada mudança de código ou decisão técnica, sem esperar pedido. É consultável por busca, não por leitura — pode ser grande.
- [ROADMAP](workdesk/ROADMAP.md) — **futuro**, em três seções: 🔴 AGORA / 🟡 DEPOIS / 🔵 IDEIAS. **Item feito SAI** — não vira ✅ de troféu, a história dele já está no DEV_LOG.

Mais três vivos, por domínio: [API_CONTRATO](workdesk/API_CONTRATO.md) (decisões de contrato que não se desfazem), [FUNIL](workdesk/FUNIL.md) (onde cada item da busca morre, com números) e [DESIGN_CONTRATO](workdesk/DESIGN_CONTRATO.md) (a linguagem visual do app).

📍 **O único pedaço de "presente" que fica no DEV_LOG** é o bloco **ONDE PARAMOS**, no topo: **teto de ~25 linhas, sempre sobrescrito, nunca acumulado**. Passou disso, é porque virou arquitetura ou virou roadmap — mandar para o documento certo. Foi ignorar esse teto que criou o ESTADO DO MUNDO.

### O que rotaciona e o que persiste

Esta é a divisão que sustenta tudo:

| 🔄 **rotaciona por fase** | 📌 **persiste e muda com o código** |
|---|---|
| `DEV_LOG`, `ROADMAP` e os briefings daquele trabalho | `ARQUITETURA`, `API_CONTRATO`, `FUNIL`, `DESIGN_CONTRATO`, `SQL/` |
| são **recortados** para `workdesk/Fases/` no encerramento | **nunca** são arquivados; editados in-place |
| descrevem um período que acabou | descrevem o presente |

O DEV_LOG e o ROADMAP **andam juntos**: são as duas metades do mesmo período — o que se fez e o que se ia fazer.

🚨 **O gatilho da rotação é o ROADMAP fechar:** os itens de 🔴 AGORA acabaram e o que vem a seguir é outro assunto. **Não é o mês virando, nem o arquivo crescendo.** Se o DEV_LOG passar de ~1.500 linhas ou começar a cobrir dois assuntos que não se conversam, a fase provavelmente já devia ter fechado — propor o corte na hora. A antiga "Fase 9" acumulou **25 dias, seis trabalhos distintos e 5.053 linhas** antes de alguém notar.

**Ao encerrar**, a pasta tem que ficar **auto-contida**: recebe os 🔄 recortados, uma **cópia** da `ARQUITETURA` (retrato do fim da fase — a viva continua na raiz) e um **README** com o que a fase resolveu, as descobertas que valem para sempre e os erros cometidos. Atualizar também o índice [Fases/README.md](workdesk/Fases/README.md). Só então a raiz recomeça com DEV_LOG e ROADMAP novos.

📁 **O nome da pasta carrega o período:** `Fase 08 — 2026-07-30 a 2026-08-02`. Com o zero à esquerda, a ordem alfabética é a cronológica.

**Arquivar 🗂️ na hora certa.** O `FRONTEND_BRIEFING` dizia "o app ignora oito campos" meses depois do app parar de ignorar, e seguia sendo apontado como "documento de entrada" em três lugares. Documento que descreve problema resolvido é pior que documento nenhum.

**Documento arquivado não se reescreve.** Retrato é retrato — link quebrado em pasta de fase é esperado, e o que sumiu está mapeado no [índice das fases](workdesk/Fases/README.md).

Estamos na **Fase 11** (produção de verdade: deploy, auth, dedup, infra); 1 a 10 estão arquivadas.

### O verificador — a única defesa que não depende de memória

```bash
node workdesk/scripts/verificar-workdesk.cjs
```

Ele confere, nos documentos **persistentes**, se todo `identificador` citado ainda existe no código e se todo link ainda resolve. Roda em 0,2s e **já roda sozinho no início de cada sessão** (hook `SessionStart`), calado quando está tudo certo.

Ele existe porque **regra escrita não é defesa**. Só em 2026 apodreceram a ARQUITETURA (quatro afirmações falsas dentro de uma caixa escrita "LEIA ANTES DE MEXER"), o ESTADO DO MUNDO e o MIGRATIONS_LOG — os três com regra mandando atualizar.

⚠️ **O que ele não pega:** se o que está escrito é **verdade**. Um identificador pode existir e a frase sobre ele estar errada. Ele cobre apodrecimento estrutural, não semântico — o resto continua sendo conferir na fonte.

Achou algo? Ou o documento ficou para trás (corrija o documento), ou o identificador é externo legítimo (adicione a `EXTERNOS` no script, **com o motivo escrito**).

### Obrigações que não dependem de pedido

- Toda migration SQL em [workdesk/SQL/migrations/](workdesk/SQL/migrations/) **obriga** entrada em [MIGRATIONS_LOG.md](workdesk/SQL/MIGRATIONS_LOG.md) **no mesmo turno**.
- Achou **duas respostas para a mesma pergunta** em documentos? Medir na fonte e **apagar a errada no mesmo turno**. Não deixar para depois: é assim que nasce a segunda verdade.
- 🚨 **Achou defeito no material da SIC, propôs melhoria, desviou do formulário deles ou recusou uma ideia?** Entrada em [MUDANCAS.md](workdesk/Prot%C3%B3tipo/MUDANCAS.md) **no mesmo turno**, com os quatro campos (Forms hoje · App · Por quê, com medição · Status). **É o documento da apresentação:** o João vai ter que demonstrar cada diferença na frente do cliente, meses depois, e o motivo não se reconstrói. Nunca deixar para o fim da sessão.
- Mudou algo estrutural no código? A `ARQUITETURA` muda **no mesmo turno** — ela é a que acompanha o código, não a que se revisa depois.
- **Fim de sessão:** revisar ROADMAP + ARQUITETURA + confirmar que a última entrada do DEV_LOG cobre a sessão inteira.

---

## 3. Definição de "pronto"

1. **Backend TS** — `npx tsc --noEmit` passa sem erro
2. **Testes** — `npm test` **verde**, e caminho novo que o cliente enxerga **ganha teste**
3. **Flutter** — `flutter clean` + build, testado em **device físico via LAN IP**, nunca emulador
4. **Migration SQL** — aplicada no Supabase **e** registrada no [MIGRATIONS_LOG](workdesk/SQL/MIGRATIONS_LOG.md), no mesmo turno
5. **DEV_LOG** atualizado com a mudança
6. **Commit feito** — ou adiado explicitamente, com motivo

🚨 **Teste vermelho se conserta ANTES de qualquer coisa, e a suspeita começa no teste, não no código.** Em 04/09 a suíte estava com 10 de 17 suítes quebradas e **nenhuma era bug** — eram testes descrevendo um sistema que já tinha mudado. Oito deles exigiam que o Filter1 aprovasse tudo com a OpenAI fora do ar, que é o oposto da regra 8 da ARQUITETURA: quem "consertasse o código para o teste passar" reintroduziria um vazamento de dinheiro. **Teste velho não é neutro — é instrução errada esperando alguém obediente.** Mudou o código de propósito? Atualize o teste. Não sabe qual dos dois está certo? **Vá na fonte e pergunte**, nunca escolha o mais fácil.

📌 **O nome do teste se escreve em comportamento, em português** — *"o consultor só enxerga as lojas da carteira dele"*, não *"deve filtrar por scope"*. A saída do `npm test` é a lista do que o sistema promete, e é assim que o João revisa sem ler código (§1).

Este item 2 **não existia** até 04/09, e é exatamente o que apodreceu: a regra 1 estava escrita e era obedecida; a 2 não estava escrita e a suíte foi para 60% de vermelho sem ninguém notar. Hoje o [CI](.github/workflows/ci.yml) roda as duas em todo push.

> **Nada disto é sagrado.** Se uma regra daqui atrapalhar, o João reporta e a gente revisa. Refinar com o uso, não engessar.

---

## 4. Stack e comandos

**Backend** (Node + TypeScript + Express + BullMQ)
```bash
cd backend
npm run dev              # desenvolvimento local
npx tsc --noEmit         # OBRIGATÓRIO após mudança TS
```

**Admin Panel** (Next.js 16 + shadcn/ui)
```bash
cd admin-panel
npm run dev              # localhost:3001
```

**Mobile** (Flutter/Android)
```bash
cd mobile-app
# URLs + DSN por ambiente vem de env/{dev,staging,prod}.json (dart-define-from-file).
run-dev.bat              # dev local (ajustar IP em env/dev.json)
build-staging.bat        # APK staging (Sentry OFF)
build-prod.bat           # APK producao (Sentry ON via env/prod.json — git-ignored)
```

**Ver a tela que acabou de escrever** (descoberto em 04/09) — fecha o ciclo de
desenho sem depender do João abrir nada:

```powershell
& 'C:Program FilesGoogleChromeApplicationchrome.exe' --headless=new --disable-gpu `
  "--screenshot=<saida>.png" --window-size=1280,900 "file:///<caminho>.html"
```

Depois **ler o PNG** e criticar o próprio resultado. Só entregar ao João depois de
algumas voltas. ⚠️ Rodar pelo PowerShell — pelo Bash o Edge não gera arquivo.
⚠️ **Vale para HTML** (dashboard, relatório, protótipo). **Não** substitui o teste
do Flutter em device físico — ali o Claude continua cego.

- `env/prod.json` NÃO é versionado (contém SENTRY_DSN). Use `env/prod.json.example` como template.
- Sentry só ativa se `SENTRY_DSN` não-vazia — dev/staging ficam sem envio (zero quota).
- Testar APK em **device físico via LAN IP**, nunca emulador.

**Branches**: `develop` (local) → `staging` (Render free) → `main` (Render prod).

---

## 5. Estrutura — onde mora o quê

```
backend/       → Node + TypeScript + Express + BullMQ
admin-panel/   → Next.js — o painel dos DEVS (config, custo, saúde), não do cliente
mobile-app/    → Flutter (Android)
workdesk/      → a mesa de trabalho (ARQUITETURA, DEV_LOG, ROADMAP, SQL)
```

🚨 **Árvore de arquivo não mora em documento — nem aqui.** Esta seção já teve o
desenho de `backend/src` inteiro, uma linha por arquivo. Em 03/09 **seis dos sete
caminhos que ela citava não existiam mais**: o pipeline tinha ido para `jobs/`, o
scheduler para `jobs/scheduler/`, o push para `services/notifications/`. Apodreceu
calada porque ninguém abre documento para conferir o que uma busca responde em
dois segundos — e mesmo assim era isto que toda sessão lia primeiro, e acreditava.

**Onde algo mora, procure.** O que a busca *não* responde é **o que pode depender
de quê** — e isso está em [ARQUITETURA §3.5](workdesk/ARQUITETURA.md):
`routes → services → database`, nada aponta para cima, módulo não sabe quem está
usando ele, e papel é linha no banco, não `if` em tela.

---

## 6. Gotchas do projeto (armadilhas conhecidas)

- **gpt-5-nano NÃO funciona** (reasoning tokens) — manter `gpt-4o-mini`.
- **CORS no Render** usa callback function, **não array direto** (array não funciona em produção).
- **Scan CRON** filtra `type === 'city'` — escanear `state` polui banco com cidades erradas.
- **Cidade + estado no Filter2** — sem estado, São José (SC) vira São José (SP).
- **Flutter visual** — sempre `flutter clean` antes do build, hot reload só pelo terminal do VSCode.
- **Device físico** (LAN IP), não emulador — emulador não simula push real.

---

## 7. Segurança — nunca sem autorização explícita

- `git push --force` (qualquer branch)
- `git reset --hard`, `git clean -f`, `git checkout .`
- `git commit --no-verify` ou bypass de hooks
- Migration SQL destrutiva: `DROP`, `TRUNCATE`, `ALTER ... DROP COLUMN`
- Commit de `.env`, credentials, keystores
- Merge direto em `main`
- Instalação/remoção em massa de dependências

Ação reversível = pode. Afeta produção ou perde dados = pergunta primeiro.

---

## 8. Deploy e infra (referência rápida)

**Produção** (Render Starter $7 cada, branch `main`)
- Backend: `https://sistemaprogestao-7fzs.onrender.com`
- Admin: `https://sistemaprogestao-r7fw.onrender.com`
- Health: `/health`

**Staging** (Render free, branch `staging`)
- Backend: `https://simeops-backend.onrender.com`
- Admin: `https://sistemaprogestao.onrender.com`

**Monitoramento**
- Sentry: org `joao-mw`, project `simeopsbackend` (plano Team $29/mo, só produção)
- Dev Panel: `c:/Projetos/dev-panel/` em `localhost:3100` (billing + health)

**Custos fixos**: Render $14 + Sentry $29 = **$43/mo** (+ OpenAI, BrightData, Jina variáveis).

---

## 9. Terminologia do projeto

- **SIMEops** — nome oficial e atual do app. ("Netrios News" é legado, só sobrevive no nome da pasta.)
- **Feed** — lista de notícias da cidade/grupo selecionado no app.
- **Tipo de crime** — campo granular (roubo, homicídio, tráfico...).
- **Categoria** — grupo de tipos (Patrimonial, Segurança, Operacional, Fraude, Institucional).
- **Cidade** (type=city) — unidade escaneável. **Estado** (type=state) — agrupador, NÃO é escaneado.
- **Grupo de cidades** — agrupamento visual (ex: "Grande Florianópolis").
- **Busca manual** — Flutter dispara dual-source (Web Top 100 + News paginado) em paralelo por cidade.
- **Auto-scan** — CRON Bright Data News (tbm=nws, qdr:d), rodando 24/7.
- **Pipeline de filtros** — Filter0 (regex) → Filter1 (GPT batch YES/NO) → Jina fetch → Filter2 (GPT full extrai campos) → dedup (embedding + DB 3 camadas).
