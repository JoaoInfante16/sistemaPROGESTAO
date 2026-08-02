# Backend — o que ficou por fazer

> 📌 **Documento vivo** — itens entram e saem conforme a dívida muda; o documento
> atravessa as fases. Não é arquivado. Ver [README](./README.md).
>
> Última revisão: 2026-08-02, ao fim da reforma. Lista única e consolidada do que
> **não** foi feito no backend, com o porquê e o risco de cada item.
>
> O [ROADMAP](./ROADMAP.md) tem o plano da fase atual; aqui é a lista crua,
> ordenada por consequência. O [DEV_LOG](./DEV_LOG.md) tem as medições.

---

## 🚨 1. Migration 025 — o banco está aberto para a chave anon

Achado em 02/08, **investigando outra coisa**. Medido com a `SUPABASE_ANON_KEY`
do próprio `.env`:

```
GET  /rest/v1/user_profiles?select=id,is_admin  -> 200, a lista inteira
GET  /rest/v1/news | search_cache | budget_tracking | system_config | ...
                                                -> 200, com dados
POST /rest/v1/system_config  (payload vazio)    -> 400, código 23502
```

O `23502` é violação de NOT NULL: a requisição **passou pela RLS** e morreu na
validação do Postgres. **A escrita também estava liberada.** Nada foi gravado no
teste. A chave anon é pública por definição — está no APK e no bundle do admin.

[025_rls_fechar_anon.sql](./SQL/migrations/025_rls_fechar_anon.sql) está escrita,
com o teste de verificação no cabeçalho. **Não rodada** — afeta produção na hora.

**Não quebra nada** (verificado, não suposto): mobile e admin usam Supabase só
para `auth`; o backend usa a service key, que faz bypass de RLS.

---

## 🚨 2. Promover `main`

`main` está em `faa38b7` (junho). Tudo abaixo está em `develop` e **é o deploy
que o cliente sente**. Requer autorização explícita (a CLAUDE.md proíbe merge
direto em `main`).

O que falta em `main`, confirmado lendo o código:

| falta | efeito |
|---|---|
| `brd_json` | a SERP devolve HTML cru, `JSON.parse` falha **em silêncio** |
| paginação com `num` (deprecado) | pula as posições 10-19, perde ~1/3 |
| scraper assíncrono no Top 100 | 660-978s — **a travada que o cliente relatou** |
| query `allintext:` | o Google responde `results_cnt = 0` |
| Fase 8 inteira | período respeitado, dedup em camadas, extras, progresso |
| reforma de 02/08 | assuntos configuráveis, scan sem desperdício, timeouts, segurança |

Ao promover:
- [ ] conferir `commit` no `/health` de produção
- [ ] confirmar que a fila de produção manteve o nome **puro** (`manual-search-queue`)
- [ ] rodar uma busca real e conferir `budget_tracking.details`
- [ ] **subir o APK junto** — o limite de 1 cidade está nos dois lados
- [ ] confirmar `AUTO_SCAN_ENABLED` / `NODE_ENV=production` no Render
- [ ] depois disso, rodar o **bloco 2** da migration 024 (as faixas `_60d`/`_90d` viram mortas)

---

## 📱 3. O app não lê o que o backend já manda

Não é trabalho de backend, mas é backend parado sem uso. Lista completa em
[API_CONTRATO.md](./API_CONTRATO.md), seção final. Resumo: `extras`, `estado`,
`source_type`, `progress.feitos/total`, `progress.achados`, `sources[]`.

**O mais urgente dos dois lados:** o app desiste por relógio (`_maxPolls = 200`
× 3s = 10 min). É essa trava que mantém:
- `periodo_dias` capado em **180** (deveria ser 365)
- `cidades` capado em **1** (deveria ser até 10)

Os dois voltam mudando **dois números** cada, depois que o app desistir por
estagnação.

---

## 🐛 4. Bugs conhecidos, não corrigidos

| bug | onde | risco |
|---|---|---|
| Página vazia da Bright Data (HTTP 200, 0 bytes, sem header de erro) | provider | causa **desconhecida**; mitigado com 1 retry desde a 8.1 |
| Filter0 com keywords amplas (`jogo`, `tempo`, `música`) | filter0Regex | falso negativo — descarta notícia real |

> Os três de segurança que estavam aqui (delete por `params_hash` cruzando
> usuários, `is_admin` sem checagem no painel, `queue.add` sem try/catch) foram
> **corrigidos em 02/08** — ver DEV_LOG.

---

## 🧹 5. Dívida e limpeza

- **7 configs mortas** no banco — migration [024](./SQL/migrations/024_limpar_configs_mortas.sql) pronta, **não rodada**. Neutra: todas existem no `DEFAULTS` do código, inclusive na `main`, com os mesmos valores.
- `openai` ^4.24.1 → v6.
- Flutter: `fl_chart` 0.70→1.x, `share_plus` 10→12, `flutter_map` 7→8, `sentry_flutter` 8→9.
- **Renomear "Netrios News" → "SIMEops"** (diretório e repo).
- `filter2` roda com concorrência 5; o limite da OpenAI é bem maior.

> Timeouts em Jina e OpenAI **saíram desta lista** — feitos em 02/08.

---

## 📏 6. Verificações em aberto

| o quê | estado | por que importa |
|---|---|---|
| **A reforma de 02/08 rodando de verdade** | ✅ **validada no app 02/08** | Campo Grande/60d → **77 resultados**; 269 snippets contra 159 do código anterior (+69%). O `commit` no `budget_tracking` confirmou o código novo |
| **Período longo ponta a ponta** | ✅ medido 02/08 (São Paulo/90d: alcance de 90 dias exatos) | falta repetir com 180 |
| **Ramo web: 3–4 buscas de medição** | 1 de ~4 feitas | critério já combinado: se seguir entregando ~1 de 23, desligar pelo painel |
| **`api_rate_limits.brightdata.max_concurrent`** | não revisado | está em 10; a doc diz que o limite real é 100 QPS. Pode subir — só não foi medido |
| **Primeira execução do auto-scan com os templates novos** | 📅 **segunda 03/08** | ⚠️ agora ela vem **misturada** com a reforma: o "depois" mede as duas coisas juntas, não só os templates |

> `filter2_confidence_min` saiu desta lista: **alinhado em 0,7** em 02/08, por
> decisão do João.

---

## 🔬 7. Em aberto, precisa de decisão antes de código

- **Fontes oficiais por estado** (SSP/Polícia Civil): 27 fontes, não 5.570 cidades — encaixa no `type='state'` que já existe. O RSS grátis enxerga matéria que o SERP pago não surface. É projeto, não remendo; medir o ganho da reforma antes.
- **Google News RSS como índice** (não como fonte): título, data e veículo corretos e de graça, mas a URL é redirect opaco e o Jina devolve 98 chars de boilerplate. Só vira útil se aparecer forma limpa de resolver a URL.
- **Push de estatística:** `natureza === 'estatistica'` dispara push igual a crime ("homicídios caíram 12%" chega como alerta). Decisão de produto.
- **Sem `parent_id`, não há pós-filtro nenhum** (`locationPostFilter = undefined`) — a cidade aceitaria notícia de qualquer lugar. Hoje as 4 cidades têm pai; é latente.

---

## ✅ 8. Auto-scan — os 4 achados fechados

Auditoria do auto-scan, na [Fase 8 arquivada](./Fases/Fase%208/ROADMAP.md). Todos corrigidos em 02/08.

| # | achado | estado |
|---|---|---|
| 1 | cidade por substring (`São José do Cedro`) | ✅ igualdade com limpeza, 21/21 |
| 2 | `dateRestrict: 'd1'` vs `scan_period_days` | ✅ regressão de 01/08 |
| 3 | duplicata no `news` (26% em grupos suspeitos) | ✅ dedup em camadas ligado no scan |
| 4 | custo contado de duas formas | ✅ `calculateCost` removida |
| 5 | sem dedup por URL antes do Jina | ✅ peneira antes do Filter0 |
| 6 | `scanIndex` mudava a cada minuto | ✅ agora anda 1 por execução |

Baseline do "antes": 31/07, **9 das 10 últimas execuções acharam zero notícias**.

⚠️ **As 10 linhas de São José do Cedro seguem no banco** por decisão do João
(fase de teste). `scripts/limpar-cidades-intrusas.ts` está pronto — dry-run por
default.
