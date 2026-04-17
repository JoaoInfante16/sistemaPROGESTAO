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

- **Resumo executivo GPT** — 2 parágrafos gerados a partir do `reportData`. Prioridade alta, ~2h de sessão. Eleva percepção em 80% do trabalho.
- **Tendência por categoria** — breakdown no trend (hoje só total). ~1h, dado já existe no `getCrimeTrend.breakdown`.
- **Rua no mapa** — Opção C ou B da discussão (geocode mais preciso quando rua extraída + fallback tolerante em vez de jitter aleatório). ~1-2h.

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
