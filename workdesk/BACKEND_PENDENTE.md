# Backend — o que ficou por fazer

> Fechamento da Fase 8, 2026-08-02. Lista única e consolidada do que **não** foi
> feito no backend, com o porquê e o risco de cada item.
>
> O [ROADMAP](./ROADMAP.md) tem o plano por fase; aqui é a lista crua, ordenada
> por consequência. O [DEV_LOG](./DEV_LOG.md) tem as medições.

---

## 🚨 1. Promover `main` — nada mais importa tanto quanto isto

`main` está em `faa38b7` (junho). Toda a Fase 8 está em `staging` (`81733a9`) e
validada. **É o deploy que o cliente sente.**

Requer autorização explícita do João (a CLAUDE.md proíbe merge direto em `main`).

O que falta em `main`, confirmado lendo o código:

| falta | efeito |
|---|---|
| `brd_json` | a SERP devolve HTML cru, `JSON.parse` falha **em silêncio** |
| paginação com `num` (deprecado) | pula as posições 10-19, perde ~1/3 |
| scraper assíncrono no Top 100 | 660-978s — **a travada que o cliente relatou** |
| query `allintext:` | o Google responde `results_cnt = 0` |
| toda a Fase 8 | período respeitado, dedup em camadas, extras, progresso |

Ao promover:
- [ ] conferir `commit` no `/health` de produção
- [ ] confirmar que a fila de produção manteve o nome **puro** (`manual-search-queue`)
- [ ] rodar uma busca real e conferir `budget_tracking.details`
- [ ] **subir o APK junto** — o limite de 1 cidade está nos dois lados
- [ ] confirmar `AUTO_SCAN_ENABLED` / `NODE_ENV=production` no Render, senão o scan do cliente para
- [ ] depois disso, rodar o **bloco 2** da migration 024 (as faixas `_60d`/`_90d` viram mortas)

---

## ⏱️ 2. Jina (estágio 4) — dá para acelerar, e tem um risco escondido

Analisado em 02/08 a pedido do João. Duas coisas, e a segunda é mais grave que a
primeira.

### 2a. Sem timeout — uma requisição pendurada trava uma vaga para sempre

[JinaContentFetcher.ts](../backend/src/services/content/JinaContentFetcher.ts) chama
`fetch()` **sem `AbortSignal.timeout`**. O mesmo vale para o fallback do Bright
Data Web Unlocker.

Com o pool em 5, **duas** URLs penduradas comem 40% da vazão do estágio — e o
usuário vê "estágio 4 de 7" parado sem nada acontecendo. É exatamente a falha que
o `SERP_TIMEOUT_MS` do provider da SERP existe para evitar.

**Sugestão:** 20s no Jina, 30s no fallback (que é mais lento por natureza).
Risco baixo, ganho de previsibilidade alto.

### 2b. O pool usa metade da vazão permitida

| | valor |
|---|---|
| `content_fetch_concurrency` (pool) | **5** |
| `api_rate_limits.jina.max_concurrent` | **10** |
| `min_time_ms` | 50 (= 20 req/s) |

O pool é o gargalo, não o rate limiter. Numa busca de 155 artigos a ~3s cada:
**~93s com 5, ~47s com 10.**

⚠️ **Não subir a config direto.** `content_fetch_concurrency` é lida também pelo
`scanPipeline`, e está no banco compartilhado — mexer nela muda o auto-scan e a
produção. Mesmo padrão da `manual_search_analysis_cap`: criar
`manual_search_fetch_concurrency` (default 10) e usar só na busca manual.

### 2c. O que **não** vale a pena

- **Cache** já existe (Redis, `content:{md5}`, decorator `CachedContentFetcher`) — URL repetida já é de graça.
- **Subir o rate limiter acima de 10** depende do plano do Jina. Conferir antes; sem saber o teto, subir só troca lentidão por HTTP 429.

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
| `.eq('user_id')` faltando no delete por `params_hash` | [queries.ts:989](../backend/src/database/queries.ts#L989) | **um cliente apaga a busca de outro** que usou os mesmos parâmetros |
| `is_admin` não é checado no middleware do admin | admin-panel | qualquer sessão válida acessa o painel |
| `queue.add` sem try/catch | manualSearchRoutes | se o enfileiramento falhar, fica linha órfã em `processing` |
| Página vazia da Bright Data (HTTP 200, 0 bytes, sem header de erro) | provider | causa **desconhecida**; mitigado com 1 retry desde a 8.1 |
| Filter0 com keywords amplas (`jogo`, `tempo`, `música`) | filter0Regex | falso negativo — descarta notícia real |

Os dois primeiros são de segurança e deveriam vir antes dos outros.

---

## 🧹 5. Dívida e limpeza

- **7 configs mortas** no banco — migration [024](./SQL/migrations/024_limpar_configs_mortas.sql) pronta, **não rodada**. Neutra: todas existem no `DEFAULTS` do código, inclusive na `main`, com os mesmos valores.
- **Timeouts no OpenAI** — mesmo problema do Jina (2a), em outro provedor.
- `openai` ^4.24.1 → v6.
- Flutter: `fl_chart` 0.70→1.x, `share_plus` 10→12, `flutter_map` 7→8, `sentry_flutter` 8→9.
- **Renomear "Netrios News" → "SIMEops"** (diretório e repo).
- `filter2` roda com concorrência 5; o limite da OpenAI é bem maior.

---

## 🔬 6. Em aberto, precisa de decisão antes de código

- **Fontes oficiais por estado** (SSP/Polícia Civil): 27 fontes, não 5.570 cidades — encaixa no `type='state'` que já existe. Motivo de considerar: o RSS grátis enxerga matéria que o SERP pago não surface. É projeto, não remendo; medir o ganho da Fase 8 antes.
- **Google News RSS como índice** (não como fonte): título, data e veículo corretos e de graça, mas a URL é redirect opaco e o Jina devolve 98 chars de boilerplate. Só vira útil se aparecer forma limpa de resolver a URL.
- **Ramo web**: medido em 02/08 entregando **1 de 23** resultados. Fica ligado (custa ~$0,05 e traz conteúdo fora do índice de notícias), mas é **uma** medição. Se em 3-4 buscas seguir assim, desligar pelo painel. O `source_type` em cada resultado permite conferir sem instrumentar nada.

---

## 🔁 7. Auto-scan — trabalho previsto, com gatilho

Fase 11 do [ROADMAP](./ROADMAP.md). **Não começar antes** de: (a) Fase 8 validada
em produção e (b) uma semana de auto-scan medido com os templates novos.

Baseline do "antes" já guardado: 31/07, **9 das 10 últimas execuções acharam zero
notícias**.

Maior ganho esperado: **cortar pela data do SERP antes do Jina** — o scan usa
`periodoDias` curto e hoje baixa e analisa artigo velho para descartar depois.
