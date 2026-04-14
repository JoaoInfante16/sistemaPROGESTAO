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
