# ROADMAP — SIMEops (Fase 2)

> Planos, backlog e próximos passos.
> Revisado no fim de cada sessão com João.
>
> Histórico da Fase 1 em [Fase 1/](./Fase%201/).

---

## Contexto atual (2026-04-16)

App em **produção** desde o fim da Fase 1:
- Backend + Admin em Render Starter ($7 cada)
- APK production buildado e distribuído
- Sentry Team monitorando produção
- Dev Panel local com billing
- Login simplificado com "lembrar senha" e badge BETA

Fase 2 foca em **refinar, testar e estabilizar** — sem features grandes por enquanto.

---

## 🔥 Sessão atual (em andamento)

- [x] Alinhar workflow de colaboração (constitutição em `WORKFLOW.md`)
- [x] Criar `CLAUDE.md` na raiz
- [x] Reorganizar workdesk (Fase 1 nested, DEV_LOG/ROADMAP/ARQUITETURA novos)
- [ ] **Onboarding do Claude** no app — Camadas 2 (pipeline) e parte da 3 (filtros) já cobertas ao investigar bug. Faltam 3 completa (filtros detalhados), 4 (embeddings/dedup — já vi parte), 5-7.
- [x] ~~Bug de mistura de cidades no dashboard~~ → diagnosticado e corrigido (ver DEV_LOG). **Pendente João: rodar migration 019 + migration de limpeza.**
- [ ] Flutter: passar `estado` na query do feed (opcional — backend já aceita, é cereja do bolo). Requer decidir de onde vem o estado no UI (card selecionado → location → parentState).

---

## 🎯 Próximas ações — Onboarding do Claude

Plano sugerido pra Claude conhecer o app sem gastar turnos demais:

1. **Camada 1 — Infra e deploy**: ler `package.json` de cada frente, `.env.example`, scripts de deploy. Entender como o sistema roda.
2. **Camada 2 — Pipeline de dados**: ler `scanPipeline.ts`, `manualSearchWorker.ts`, `pipelineCore.ts`. Entender como notícia entra.
3. **Camada 3 — Filtros**: ler `backend/src/services/filters/`. Entender o funil Filter0 → Filter1 → Filter2 → dedup.
4. **Camada 4 — Embeddings e dedup**: zona que João disse "teoricamente estável, na prática não" — merece atenção.
5. **Camada 5 — Feed e relatórios**: `newsRoutes.ts`, páginas do admin, tela do Flutter.
6. **Camada 6 — Admin panel**: como se configura o sistema.
7. **Camada 7 — Mobile**: estrutura Flutter, telas principais.

**Ritmo**: 1-2 camadas por vez, com resumo ao fim de cada uma. Claude marca achados suspeitos pra discutir antes de qualquer ação.

---

## 🐛 Bugs conhecidos / áreas suspeitas

- ~~**Embeddings/Dedup**~~ → 5 fixes aplicados em 2026-04-16 (perda de sources, prompt GPT camada 3, bairro na camada 1, threshold configurável, limit 200). Ver DEV_LOG.
- **Filter0 keywords broad (pendente)**: `"jogo"`, `"tempo"`, `"música"`, `"esporte"` geram falsos negativos (bloqueiam "jogo do bicho", "tempo de prisão", etc). Discutir estratégia: word boundaries? keywords mais específicas? abolir e confiar no Filter1?
- **`dateRestrict: 'd1'` da query vs cadência do CRON** (Finding #2 registrado mas não corrigido): se cadência agendada > 24h, perde notícia na query do search. Verificar quando chegarmos nessa parte.
- **Outros bugs da fase final** — João vai listar conforme forem surgindo.

---

## 📋 Backlog — ideias e pendências não urgentes

- **Renomear tudo de "Netrios News" pra "SIMEops"** — diretório local (`c:/Projetos/Netrios News/`), repo GitHub (`sistemaPROGESTAO`?), qualquer referência remanescente em código/docs/metadata. Nome antigo, decidido abandonar. Ação grande (envolve rename de repo + possível redeploy), agendar com calma.
- **Play Store**: conta dev $25, gerar `.aab` + keystore
- **iOS**: precisa Mac + Apple Developer $99/ano
- **Refinamentos visuais**: tela processamento busca manual
- **Retenção de dados configurável** (fase futura)
- **Download PDF do relatório** (fase futura)

---

## 🧭 Princípios da Fase 2

- **Estabilidade > features** — é hora de refinar o que existe.
- **Investigação antes de código** — ver `WORKFLOW.md`.
- **Testar em produção real** — device físico, Sentry ligado.
