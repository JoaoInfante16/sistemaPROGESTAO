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

## ✅ Sessão 2026-04-18 (sessão 2 — tarde) — FECHADA

**Escopo executado** (ver DEV_LOG):
- Fix **Executive em busca manual** (endpoint POST `/analytics/executive/from-stats` aceita estatísticas do client)
- **Rua no mapa**: precisão `rua` destaca visualmente (raio maior, glow forte, borda branca), `cidade` esbatido (baixa confiança)
- **Dívida técnica duplicações**: `news_card.dart` → `category_colors.dart` (fonte única); `crime-pie-chart.tsx` sem fallback `TIPO_TO_CATEGORY` desatualizado; `CrimeSummary` type ganhou `byCategory`.
- **Janela de operação auto-scan**: 6 configs novas, seg-sex 6-18h default, sáb-dom OFF, período 4 dias. Economia ~64% recorrente. UI nova no admin settings.
- **Filter0 refinado**: removidas 11 keywords problemáticas (`tempo`, `bolsa`, `receita`, `dólar`, `futebol`, `jogo`, etc.) que disparavam false negative silencioso.
- **Filter1 em pt-BR + 7 exemplos few-shot** cobrindo casos de borda (torcedor morto = crime, Receita apreende drogas = crime, etc.).
- **UX share icon no AppBar** (`city_detail` e `report_screen` padronizados) em vez de CTA button inline/fixo.
- **Relatório público com parity total do in-app**:
  - `<ExecutiveSection>` (light theme espelhando Flutter)
  - `<CrimeRadarMap>` (tiles CartoDB, filtros de categoria, precisão diferenciada) substituiu heatmap legado
  - Logo PROGESTÃO/SIMEops substituiu Shield genérico
  - Cores teal (antes azul) + footer "PROGESTÃO TECNOLOGIA - SIMEops"
- **Fix PDF**: `crossOrigin="anonymous"` + tiles CartoDB com CORS + `allowTaint: false` + alert visível (antes travava silencioso em "Gerando...").

**Removido do ROADMAP como obsoleto:**
- ~~Sentry alert pra `provider:openai stage:filter1`~~ — redundante, Sentry já manda email default pra nova issue
- ~~Consolidar `_grupoCores`~~ — feito nesta sessão
- ~~`crime-pie-chart.tsx` pendência de investigação~~ — investigado + fixado

---

## ✅ Sessão 2026-04-18 (sessão 1 — manhã) — FECHADA

**Escopo executado** (ver DEV_LOG):
- Dashboard cards: sigla UF removida do header + grupo ganhou estado/cidades no footer
- **Consolidação do mapa** — single source of truth: `CrimePoint` backend, `CrimeRadarMap` Flutter, geocode server-side com fallback rua→bairro→cidade
- Busca manual: filtro de palavra-chave removido
- **Sentry em tudo (prod-only)** — mobile + admin + backend com inicialização condicional por DSN
- Envs por ambiente no mobile: `env/{dev,staging,prod}.json` + `.bat`
- Receptação reclassificada `fraude → patrimonial`
- Fix "não consigo sair" (signOut limpa credentials)
- Fix falso "Erro de conexão" em cold-start (tolerância 5 → 20)
- **Redesign progress tela** + persistência history de stages (JSONB)
- **Executive Section** com cache + invalidação por evento (migration 021)

**Pendências administrativas suas (não-código):**
1. 🔴 Admin: validar `dedup_similarity_threshold` 0.85 → 0.80
2. 🟡 Migration 010 (reset) + testar dedup com novo radar
3. 🟡 Criar projeto `simeops-admin` no Sentry + setar DSN no Render (quando ativar)
4. 🟡 Validar nova janela de operação no admin settings (seg-sex 6-18, sáb-dom off, período 4 dias)
5. 🟢 Commit develop → staging → main (em curso)
6. 🟢 APK prod com `build-prod.bat` + Sentry ativo (em curso)

---

## ✅ Sessão 2026-04-17 — FECHADA

Fixes de dedup e feed (ver DEV_LOG):
- **Bug feed mistura cidades:** validateQuery(pagination) stripava `cidade`/`cidades`/`estado`. Fix: novo schema `feedQuery` com filtros opcionais.
- **Bug dedup não agrupa notícias do mesmo evento:** embedding raw tinha scores 0.63-0.77 entre narrativas editoriais diferentes. Fix: prefixar embedding com metadata (tipo/estado/cidade/bairro/data) → scores sobem pra 0.82-0.90.
- Script `reembed-all-news.ts` executado em prod: 24/24 notícias atualizadas.
- Novos scripts de regressão em `backend/scripts/`: `test-dedup-similarity.ts` + `reembed-all-news.ts` + `debug-dedup-case.ts`.

---

## ✅ Sessão 2026-04-16 (primeira com Opus 4.7) — FECHADA

Todos os combos executados e commitados em `develop + staging` (ver DEV_LOG):
- Workflow + CLAUDE.md + reorganização workdesk
- Onboarding Camadas 2→5 (pipeline, filtros, dedup, feed/cards, relatórios)
- Fix cidades homônimas (estado no DB)
- 5 fixes combo dedup + reversão prompt GPT layer 3
- Filter0 IG/YT + Filter1 throw + Filter2 maxContent 8000
- UF nos cards + consolidação categoria (fonte única backend)
- Bug de contagem em relatórios + limpeza massiva de dead code
- Deploy staging feito. Produção suspensa pelo João.
- APK staging buildando.

## ✅ Sessão 2026-04-20 — em curso

**Fixes aplicados:**
- **"Lembrar senha" quebrava após 401** — `signOut({clearCredentials: false})` no `onAuthExpired`. Antes: token expirava → signOut limpava credentials → tela de login vazia. Agora: `_tryAutoLogin` re-autentica automaticamente.
- **FK violation `search_results_search_id_fkey`** — race condition em `createSearchCache`: segunda busca com mesmos params deletava o `search_cache` do worker em andamento. Fix: checar `status` antes de deletar; se `processing`, retornar o `search_id` existente.

**Pendências suas (ações admin/infra):**
1. 🔴 Commit + deploy do fix de search cache (backend)
2. 🔴 Commit + deploy do fix de "lembrar senha" (mobile → APK)
3. 🟡 Migration 022 rodar em prod (se ainda não rodou)
4. 🟡 Criar projeto `simeops-admin` no Sentry + setar DSN no Render (quando ativar)
5. 🟡 Validar janela de operação no admin settings

---

## 🔥 Próxima sessão

---

## 🎯 Onboarding do Claude — STATUS

**Coberto:**
- Camada 2 (pipeline): ✅ `scanPipeline`, `manualSearchWorker`, `pipelineCore`
- Camada 3 (filtros): ✅ Filter0, Filter1, Filter2 (com findings adicionais fechados)
- Camada 4 (dedup/embeddings): ✅ 3 camadas DB + intra-batch + script de regressão de prompt
- Camada 5 (feed + relatórios): ✅ newsRoutes, analyticsQueries, city_detail_screen, report_screen, card visual

**Não coberto ainda:**
- Camada 1 (infra/deploy): pulada por baixo ROI (João já sabe)
- Camada 6 (admin panel): só viu a tela de Settings ao adicionar `filter2_max_content_chars`
- Camada 7 (mobile): tela de login, manual_search_screen, favoritos, não visitadas

---

## 🐛 Bugs conhecidos / áreas suspeitas

- ~~**Cidades homônimas**~~ → fix aplicado (migration 019 + filtro estado no pipeline)
- ~~**Embeddings/Dedup**~~ → 5 fixes aplicados (perda sources, bairro, threshold config, limit 200, prompt layer 3 revertido por teste)
- ~~**Bug contagem estatísticas**~~ → fix aplicado (continue no topo do loop em analyticsQueries)
- ~~**`dateRestrict: 'd1'` vs cadência**~~ → não é problema; João confirmou que cadência nunca passa de 24h
- ~~**Filter0 keywords broad**~~ → 11 keywords problemáticas removidas (2026-04-18 sessão 2)
- ~~**Admin web `crime-pie-chart.tsx`**~~ → investigado + fixado: usa `byCategory` do backend, `TIPO_TO_CATEGORY` duplicado removido
- ~~**"Lembrar senha" quebrava após 401**~~ → fix 2026-04-20
- ~~**FK violation search_results**~~ → fix 2026-04-20 (race condition createSearchCache)
- **Outros bugs** — João testa em produção e reporta.

---

## 🎯 Oportunidades de produto discutidas (não executadas)

Conversa sobre avaliação do relatório (6/10 honesto, na opinião de Claude). Pra virar "profissa" pro cliente executivo:

- ~~**Resumo executivo GPT**~~ — feito em 2026-04-18 como "Executive Section" com cards + resumo complementar, muito melhor que o plano original (2 parágrafos de texto).
- ~~**Tendência por categoria**~~ — descartado por João ("é muito complexo").
- ~~**Rua no mapa**~~ → feito em 2026-04-18: precisão visual diferenciada (rua = glow forte/raio maior, cidade = alpha baixo).

**Fora de escopo curto prazo:**
- Horário (exige extrair hora no Filter2 + UI nova)
- Benchmark externo (IBGE/SSP, API externa)
- Recomendações acionáveis ("zona crítica X, horário Y")

**Descartado com argumento:**
- `riskScore`/`riskLevel` — pesos arbitrários sem base estatística, maquiagem sem substância
- `comparison` entre períodos — redundante com tendência temporal

---

## 📋 Backlog — ideias e pendências não urgentes

- **Sentry + Grafana estão "zoados"** (palavras do João, 2026-04-16) — revisar configuração de ambos. Detalhes não levantados ainda; agendar sessão dedicada pra auditar alertas, projetos, dashboards e filtros. Pode incluir: revisar quais erros Sentry captura, setar email alerts pendentes (já listados em pendências), e confirmar se Grafana está monitorando algo útil ou só ligado sem uso.
- ~~**Janela de auto-scan**~~ → feito em 2026-04-18: 6 configs em `system_config`, seg-sex 6h-18h, sáb-dom OFF, período 4 dias. UI no admin Settings.
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
