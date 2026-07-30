# Netrios News - Workflow de Desenvolvimento

## Estrutura do Workspace

```
workdesk/Fase 2/
  ROADMAP.md              <- TODOs ativos (so pendentes, max ~200 linhas)
  WORKFLOW.md             <- Este arquivo (regras do jogo)
  DEVLOG/
    sessao_001.md         <- Registro de cada sessao de trabalho
    sessao_002.md
    ...
  SQL/
    MIGRATIONS_LOG.md     <- Historico de migrations (aplicada/pendente)
    migrations/
      001_baseline.sql    <- Referencia do schema original
      002_xxx.sql         <- Cada mudanca no banco
      ...
```

---

## 1. Regras do DEVLOG (sessoes)

**Quando criar**: No inicio de cada sessao de trabalho com o Claude.

**Quando atualizar**: ANTES de comprimir contexto ou encerrar a sessao.

**Formato**:
```markdown
# Sessao XXX - [Titulo curto]
**Data**: YYYY-MM-DD

## O que foi feito
- Item 1
- Item 2

## Decisoes
- Decisao e motivo

## Problemas encontrados
- Problema e solucao (se houver)

## Proximo
- O que ficou pendente para a proxima sessao
```

**Regras**:
- 1 arquivo por sessao, NUNCA editar sessoes antigas
- Sempre registrar ANTES de comprimir (senao perde o fio)
- Manter conciso: fatos, nao narrativa

---

## 2. Regras do ROADMAP

- So contem TODOs pendentes (nao concluidos)
- Feature concluida -> SAI do ROADMAP, registro vai pro DEVLOG da sessao
- Se passar de ~200 linhas -> novo arquivo (ROADMAP_sprint_X.md)
- Organizado por: Sprint Ativo > Backlog (alta/media/post-MVP)

---

## 3. Regras de SQL (Migrations Organicas)

### Fluxo para qualquer mudanca no banco:

```
1. Criar migration:  SQL/migrations/NNN_descricao.sql
2. Escrever UP + DOWN (comentado)
3. Atualizar MIGRATIONS_LOG.md (status: Pendente)
4. Atualizar schema.sql do backend (refletir estado final)
5. Atualizar queries.ts se necessario
6. Rodar tsc --noEmit (0 erros)
7. Aplicar no Supabase SQL Editor
8. Marcar como Aplicado no MIGRATIONS_LOG.md
```

### Regras:
- NUNCA editar migration ja aplicada (criar nova pra corrigir)
- NUNCA editar schema.sql sem migration correspondente
- schema.sql = sempre o estado final acumulado
- Cada migration = 1 responsabilidade (nao misturar)
- UP = aplicar, DOWN = reverter (comentado)

### Tipos comuns de migration:
- `add_column_xxx` - nova coluna
- `create_table_xxx` - nova tabela
- `add_index_xxx` - novo indice
- `alter_xxx` - mudanca de tipo/constraint
- `seed_xxx` - dados iniciais
- `fix_xxx` - correcao

---

## 4. Fluxo de Uma Feature (passo a passo)

```
1. PLANEJAR
   - Descrever a feature no ROADMAP (se ainda nao esta)
   - Criar sessao no DEVLOG

2. SQL (se necessario)
   - Criar migration
   - Atualizar schema.sql
   - Atualizar queries.ts

3. BACKEND (se necessario)
   - Implementar servico/rota
   - Rodar tsc --noEmit

4. ADMIN/FLUTTER (se necessario)
   - Implementar UI
   - Verificar build

5. TESTAR
   - npx jest (backend)
   - next build (admin)
   - flutter analyze (mobile)

6. REGISTRAR
   - Atualizar DEVLOG da sessao
   - Mover feature concluida do ROADMAP para DEVLOG
   - Atualizar MIGRATIONS_LOG se teve SQL
```

---

## 5. Antes de Comprimir Contexto (CRITICO)

Quando o Claude avisar que vai comprimir, ou antes de encerrar:

1. Atualizar DEVLOG da sessao com tudo que foi feito
2. Se tem TODO em andamento, anotar estado exato no "Proximo"
3. Se tem migration pendente, garantir que esta no MIGRATIONS_LOG

Isso garante que a proxima sessao (ou pos-compressao) retome exatamente de onde parou.

---

## 6. Checklist de Verificacao (rodar apos qualquer mudanca)

```bash
# Backend
cd backend && npx tsc --noEmit    # 0 erros

# Testes
cd backend && npx jest            # todos passando

# Admin
cd admin-panel && npm run build   # clean

# Flutter
cd mobile-app && flutter analyze  # 0 issues
```
