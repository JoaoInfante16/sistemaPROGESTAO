# SQL Migrations Log

## Como usar
1. Cada mudanca no banco = 1 arquivo numerado em `migrations/`
2. Aplicar no Supabase SQL Editor na ordem
3. Marcar como aplicado aqui
4. Atualizar `backend/src/database/schema.sql` para refletir o estado final

## Regras
- NUNCA editar migrations ja aplicadas
- NUNCA editar schema.sql diretamente para mudancas novas (criar migration primeiro)
- Cada migration tem UP (aplicar) e DOWN (reverter) comentado
- Testar migration localmente antes de aplicar em producao

## Historico

| # | Arquivo | Descricao | Aplicado? |
|---|---------|-----------|-----------|
| 001 | 001_baseline.sql | Schema completo Fase 1 (referencia) | Sim (Fase 1) |
| 003 | 003_fix_db_inconsistencies.sql | Remove scan_frequency_hours duplicada, IVFFlat->HNSW, add search_permission config | Sim (2026-03-17) |
| 004 | 004_reports_table.sql | Tabela reports (dashboard compartilhavel) + indices analytics | Sim (Fase 4) |
| 005 | 005_city_groups.sql | Tabelas city_groups + city_group_members (agrupamento de cidades) | Sim (Fase 6, 2026-04-06) |
| 017 | 017_billing_history.sql | Tabela billing_history (fechamento mensal de custos) | Sim (Fase 5, 2026-04-06) |
| 018 | 018_city_groups.sql | Tabelas city_groups + city_group_members (agrupamento de cidades no feed) | Sim (Fase 6, 2026-04-15) |
| 019 | 019_news_add_estado.sql | ALTER news ADD COLUMN estado + index (cidade, estado). Fix de cidades homonimas | **Sim** (verificado no banco em 02/08 — o log dizia pendente por engano) |
| 020 | 020_news_drop_resumo_agregado.sql | DROP coluna resumo_agregado (dead feature, nunca foi populada) | **Sim** (verificado no banco em 02/08 — a coluna nao existe mais) |
| 021 | 021_manual_search_web_toggle.sql | Config `manual_search_web_enabled` (default false). Desliga o ramo web da busca manual | **NAO aplicada** — a chave nao existe no banco, entao o backend cai no default do codigo, que hoje e **`true`** (o ramo web foi RELIGADO ao migrar pro SERP API). Rodar esta migration DESLIGARIA o web — so rodar se for isso que se quer |
| 021b | 021_executive_cache.sql | Tabela executive_cache | **Sim** (verificado em 02/08) |
| 022 | 022_executive_cache_search_id.sql | Coluna search_id em executive_cache | **Sim** (verificado em 02/08) |
| 024 | 024_limpar_configs_mortas.sql | **DESTRUTIVA (DELETE)**, mas neutra: apaga 7 configs mortas. Todas existem no `DEFAULTS` hardcoded do configManager — inclusive na `main`, com os MESMOS valores do banco — entao o `get()` cai no default e producao nao muda. Bloco 3 (opcional, comentado) apaga `manual_search_max_results_30d` e assim resolve o conflito de semantica entre `main` (teto de coleta) e `develop` (teto de analise): cada codigo cai no seu default | **Pendente — o Joao vai rodar** |
| 025 | 025_rls_fechar_anon.sql | 🚨 **SEGURANCA.** Liga RLS em 13 tabelas. Medido em 02/08: a chave **anon** (publica — esta no APK e no bundle do admin) lia `user_profiles`, `news`, `search_cache`, `budget_tracking`, `system_config` e outras, e o INSERT chegava na validacao NOT NULL do Postgres (ou seja, **a escrita tambem passava**). Nao quebra nada: mobile e admin usam Supabase so pra `auth`, e o backend usa a service key, que ignora RLS | **NAO aplicada — aguarda autorizacao do Joao** (afeta producao na hora) |
| 023 | 023_manual_search_teto_aberto.sql | Fase 8.2/8.3/8.4: `manual_search_max_results_30d` = **0 (sem teto)** e vira BASE — os outros periodos escalam dela por raiz quadrada, sem faixas. Insere `manual_search_horizon_days` (180) e `dedup_gpt_confirm_enabled` (false) | **OPCIONAL** — so mexe em `system_config`, e o painel admin faz o mesmo (o PATCH usa `configManager.set`, que e upsert). Preferir o painel |

| 026 | 026_rejected_urls_search_id.sql | ADD COLUMN `search_id` (nullable) + index parcial em `pipeline_rejected_urls`. Aditiva e reversivel, nao toca linha existente. Sem ela a busca manual **nao consegue** persistir por que rejeitou — a tabela so aceitava `location_id`, e busca manual roda em cidade fora de `monitored_locations`. Motivador: Goiania/30d levou 74 conteudos a 27 extracoes em 03/08 e a unica forma de saber o motivo era re-rodar o pipeline **pagando Jina + GPT** | ✅ **Aplicada em 04/08** |

| 027 | 027_openai_concorrencia.sql | `api_rate_limits.openai.max_concurrent` **5 -> 20** (e `min_time_ms` 200 -> 50). O 5 era chute conservador de fev/2026, nunca revisado, e e o gargalo mais apertado do sistema: estrangula o estagio 5 da busca manual (~6 min para 450 artigos, contra ~1,5 min com 20) e, por ser o mesmo Bottleneck, deixa o **auto-scan do cliente na fila** enquanto uma busca longa roda. Nao descarta nada — so aumenta vazao. ⚠️ Afeta producao na hora (banco compartilhado), mas so pra acelerar | ✅ **Aplicada em 04/08** — verificado no banco: `openai.max_concurrent` = 20 |

| 028 | 028_jina_concorrencia.sql | `api_rate_limits.jina.max_concurrent` **10 -> 20**. Medido em 03/08 (Goiania, 17 assuntos): o Jina levou **327s dos 515s** da busca — 63% do tempo. Sobe JUNTO com `manual_search_fetch_concurrency` (10 -> 20, no codigo): sao dois limitadores em serie e subir so um nao acelera nada. ⚠️ Pre-requisito ja feito no mesmo commit: o fetcher passou a tratar **429 com `Retry-After`** — antes, um 429 virava excecao fora da lista de fallback e o artigo era perdido em silencio | ✅ **Aplicada em 04/08** — verificado no banco: `jina.max_concurrent` = 20 |

> ⚠️ Este log e preenchido a mao e ja desatualizou (019 e 020 estavam marcadas
> como pendentes e ja tinham sido rodadas). Antes de confiar nele, rodar
> **`npx tsx scripts/diagnostico-banco.ts`** — ele olha o estado REAL do banco
> (colunas, tabelas e configs) e e so leitura.

## Alteracoes manuais (sem migration file)

| Data | Descricao | Aplicado? |
|------|-----------|-----------|
| 2026-04-14 | ALTER TABLE search_cache: adicionou 'cancelled' no status check constraint | Sim |
| 2026-04-14 | TRUNCATE todas as tabelas de dados (news, logs, budget, search, devices, favorites, read) — reset pra testes | Sim |
