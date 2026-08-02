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
| 019 | 019_news_add_estado.sql | ALTER news ADD COLUMN estado + index (cidade, estado). Fix de cidades homonimas | **Pendente** (Joao roda junto com migration de limpeza) |
| 020 | 020_news_drop_resumo_agregado.sql | DROP coluna resumo_agregado (dead feature, nunca foi populada) | **Pendente — RODAR APOS deploy do backend** |
| 021 | 021_manual_search_web_toggle.sql | Config `manual_search_web_enabled` (default false). Desliga o ramo web da busca manual — o scraper do indice organico saltou de 17-70s pra 660-978s depois de 21/07 e travava o stage 1 | **Pendente** |
| 023 | 023_manual_search_teto_aberto.sql | Fase 8.4: `manual_search_max_results_30d` = **0 (sem teto)** e vira BASE — os outros periodos escalam dela por raiz quadrada, sem faixas. Insere `manual_search_horizon_days` (365) da 8.2. Nao destrutiva; o DELETE das faixas mortas `_60d`/`_90d` esta comentado, pra rodar so apos o deploy | **Pendente** |

## Alteracoes manuais (sem migration file)

| Data | Descricao | Aplicado? |
|------|-----------|-----------|
| 2026-04-14 | ALTER TABLE search_cache: adicionou 'cancelled' no status check constraint | Sim |
| 2026-04-14 | TRUNCATE todas as tabelas de dados (news, logs, budget, search, devices, favorites, read) — reset pra testes | Sim |
