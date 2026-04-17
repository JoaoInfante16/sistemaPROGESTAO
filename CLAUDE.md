# CLAUDE.md — SIMEops

> Este arquivo é carregado automaticamente a cada sessão. Contém regras operacionais do projeto.
> Filosofia e detalhes de colaboração: ver [workdesk/WORKFLOW.md](workdesk/WORKFLOW.md).

---

## 0. Nome do projeto

O app chama-se **SIMEops**. O diretório ainda se chama `Netrios News/` por legado (nome antigo, erro do início). **Sempre referir como SIMEops** em código, docs, logs. Renomear diretório/repos está no backlog (ver ROADMAP).

---

## 1. Regra zero — Workflow

Ler e respeitar [workdesk/WORKFLOW.md](workdesk/WORKFLOW.md). Pontos que mais importam:

- **Sócio, não funcionário** — discutir antes de codar, questionar pedidos que parecem errados, discordar com argumento.
- **Pró-ativo** — reportar achados inesperados na hora, sem esperar ser perguntado.
- **Sem agentes de code review/auditoria** — investigar manual com Grep+Read, mostrar findings, só codar após aprovação.
- **Fixes cirúrgicos** — nada de scope creep. Bug fix ≠ refactor.
- **Avisar quando prompt for ruim** — se a forma de pedir não aproveita bem o modelo, dizer antes de executar.

---

## 2. Workdesk — disciplina obrigatória

Três papéis distintos em [workdesk/](workdesk/):

- [workdesk/DEV_LOG.md](workdesk/DEV_LOG.md) — **passado**. Append a cada mudança de código ou decisão técnica. Sem esperar pedido.
- [workdesk/ROADMAP.md](workdesk/ROADMAP.md) — **futuro**. Revisado junto com João no fim da sessão.
- [workdesk/ARQUITETURA.md](workdesk/ARQUITETURA.md) — **presente**. Editado in-place quando algo estrutural muda.

Toda migration SQL em [workdesk/SQL/migrations/](workdesk/SQL/migrations/) **obriga** entrada em [workdesk/SQL/MIGRATIONS_LOG.md](workdesk/SQL/MIGRATIONS_LOG.md) no mesmo turno.

Fim de sessão: revisar ROADMAP + ARQUITETURA + confirmar DEV_LOG antes de fechar.

---

## 3. Stack e comandos

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
flutter clean            # OBRIGATÓRIO antes de build pra mudança visual
flutter build apk --dart-define=API_URL=https://sistemaprogestao-7fzs.onrender.com
```

Testar APK em **device físico via LAN IP**, nunca emulador.

**Branches**: `develop` (local) → `staging` (Render free) → `main` (Render prod).

---

## 4. Estrutura — onde mora o quê

```
backend/src/
├── services/
│   ├── filters/            → Filter0 regex, Filter1/2 GPT
│   ├── pipelineCore.ts     → stages compartilhados + post-filter cidade/estado
│   ├── scanPipeline.ts     → auto-scan CRON (periodoDias=2)
│   ├── manualSearchWorker.ts → busca manual BullMQ
│   ├── pushService.ts      → Firebase FCM por categoria
│   └── filter2GPT.ts       → extrai cidade+estado+tipo_crime
├── routes/newsRoutes.ts    → feed (aceita cidades=A,B,C)
└── cron/cronScheduler.ts   → filtra type='city' (NÃO state)

admin-panel/                → configuração do sistema
mobile-app/                 → Flutter (Android)
workdesk/                   → diário de bordo (DEV_LOG, ROADMAP, ARQUITETURA, SQL)
```

---

## 5. Gotchas do projeto (armadilhas conhecidas)

- **gpt-5-nano NÃO funciona** (reasoning tokens) — manter `gpt-4o-mini`.
- **CORS no Render** usa callback function, **não array direto** (array não funciona em produção).
- **Scan CRON** filtra `type === 'city'` — escanear `state` polui banco com cidades erradas.
- **Cidade + estado no Filter2** — sem estado, São José (SC) vira São José (SP).
- **Flutter visual** — sempre `flutter clean` antes do build, hot reload só pelo terminal do VSCode.
- **Device físico** (LAN IP), não emulador — emulador não simula push real.

---

## 6. Segurança — nunca sem autorização explícita

- `git push --force` (qualquer branch)
- `git reset --hard`, `git clean -f`, `git checkout .`
- `git commit --no-verify` ou bypass de hooks
- Migration SQL destrutiva: `DROP`, `TRUNCATE`, `ALTER ... DROP COLUMN`
- Commit de `.env`, credentials, keystores
- Merge direto em `main`
- Instalação/remoção em massa de dependências

Ação reversível = pode. Afeta produção ou perde dados = pergunta primeiro.

---

## 7. Deploy e infra (referência rápida)

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

## 8. Terminologia do projeto

- **SIMEops** — nome oficial e atual do app. ("Netrios News" é legado, só sobrevive no nome da pasta.)
- **Feed** — lista de notícias da cidade/grupo selecionado no app.
- **Tipo de crime** — campo granular (roubo, homicídio, tráfico...).
- **Categoria** — grupo de tipos (Patrimonial, Segurança, Operacional, Fraude, Institucional).
- **Cidade** (type=city) — unidade escaneável. **Estado** (type=state) — agrupador, NÃO é escaneado.
- **Grupo de cidades** — agrupamento visual (ex: "Grande Florianópolis").
- **Busca manual** — Flutter dispara dual-source (Web Top 100 + News paginado) em paralelo por cidade.
- **Auto-scan** — CRON Bright Data News (tbm=nws, qdr:d), rodando 24/7.
- **Pipeline de filtros** — Filter0 (regex) → Filter1 (GPT batch YES/NO) → Jina fetch → Filter2 (GPT full extrai campos) → dedup (embedding + DB 3 camadas).
