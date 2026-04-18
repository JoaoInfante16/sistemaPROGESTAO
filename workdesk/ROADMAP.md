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

## 🔄 Sessão 2026-04-18 — em curso (refino visual + observabilidade)

**Escopo executado** (ver DEV_LOG):
- Dashboard cards: sigla UF removida do header + grupo ganhou estado/cidades no footer (sem overflow de nomes)
- **Consolidação do mapa** — single source of truth: tipo `CrimePoint` no backend, widget `CrimeRadarMap` no Flutter (radar de pontos brilhantes, filtro por categoria embutido, geocode server-side com fallback hierárquico rua→bairro→cidade). Elimina ~300 linhas de duplicação client.
- Busca manual: filtro de palavra-chave removido (gastava recurso sem valor)
- **Sentry em tudo (prod-only)** — mobile (sentry_flutter) + admin (@sentry/nextjs) com inicialização condicional por DSN. Projetos criados: `simeops-flutter`, `simeops-backend`, `simeops-admin`.
- Envs por ambiente no mobile: `env/{dev,staging,prod}.json` + scripts `.bat` (fim de `--dart-define` inline)
- Receptação reclassificada `fraude → patrimonial` (juridicamente correto + funcionalmente — indica cadeia patrimonial ativa)
- Fix "não consigo sair" quando `lembrar senha` tá marcado (signOut agora limpa credentials)
- Fix falso "Erro de conexão" ao retomar busca em cold-start (tolerância 5 → 20 erros, não marca failed, mensagem gentil)
- **Redesign progress tela** (tático sem jargão): header com cards (ETAPA/TEMPO), timestamps monospace, duração por stage, ícones de status, chips de filtro no radar
- **Persistência history de stages** no backend (JSONB) — user retoma busca via histórico e vê cronologia completa
- **Executive Section** (resumo + indicadores visuais via GPT) — cards estruturados por tipo (percentual/absoluto/monetário), cor por sentido (positivo/negativo), cache com invalidação por evento, TTL 24h fallback. Custo rastreado no billing como `stage='executive'`. Migration 021 adicionada.
- CLAUDE.md atualizado

**Pendências pré-sessão, ainda abertas:**
1. 🔴 Admin panel: mudar `dedup_similarity_threshold` de `0.85` pra `0.80` (validar que foi aplicado)
2. 🟡 Rodar migration 010 (reset) e testar dedup com novo radar
3. 🟡 `filter2_max_content_chars` 4000 → 8000 no admin
4. 🟡 Sentry alert email pra tag `provider:openai stage:filter1`

**Pendências desta sessão:**
5. 🟢 Commit develop + push staging (em curso)
6. 🟢 Merge staging → main após validar (em curso)
7. 🟢 APK prod com `build-prod.bat` + Sentry ativo (em curso)
8. 🟡 Criar projeto `simeops-admin` no Sentry + setar DSN no Render quando for ativar
9. 🟡 Consolidar `_grupoCores`/`_grupoLabels` do `news_card.dart` → usar `category_colors.dart` (deixado duplicado pra não mexer em código funcional)

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
- **Filter0 keywords broad (aberto)**: `"jogo"`, `"tempo"`, `"música"`, `"esporte"` geram falsos negativos. Estratégia em aberto.
- **Admin web `crime-pie-chart.tsx` (aberto)**: não investigado se usa `byCategory` direto ou recalcula. Última possível duplicação da tabela categoria.
- **Outros bugs** — João testa em staging e reporta.

---

## 🎯 Oportunidades de produto discutidas (não executadas)

Conversa sobre avaliação do relatório (6/10 honesto, na opinião de Claude). Pra virar "profissa" pro cliente executivo:

- ~~**Resumo executivo GPT**~~ — feito em 2026-04-18 como "Executive Section" com cards + resumo complementar, muito melhor que o plano original (2 parágrafos de texto).
- ~~**Tendência por categoria**~~ — descartado por João ("é muito complexo").
- **Rua no mapa** — backend já persiste `precisao` do geocode no CrimePoint. Flutter pode usar isso pra renderizar pontos mais destacados quando `precisao='rua'`. ~1h.

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
- **Janela de auto-scan (pausar madrugada)** — João notou que não sai notícia nova de madrugada, então cron rodando nessas horas é custo jogado fora (BrightData + Jina + OpenAI por nada). Proposta: adicionar config no **Dev Panel** (`c:/Projetos/dev-panel/`) com horário de início/fim do auto-scan. Implementação provável: check no `cronScheduler.ts` antes de enfileirar — se hora atual cai na janela "desligada", skip. Configurável via DB `system_config` (ex: `scan_active_hours_start=06` e `scan_active_hours_end=23`).
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
