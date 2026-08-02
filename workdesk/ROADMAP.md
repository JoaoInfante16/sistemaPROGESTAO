# ROADMAP — SIMEops (Fase 8)

> Planos, backlog e próximos passos. Revisado no fim de cada sessão com o João.
>
> Fases 1 a 7 arquivadas em [Fases/](./Fases/). Estado atual do sistema e
> medições que não devem ser refeitas: ver o bloco **ESTADO DO MUNDO** no
> [DEV_LOG](./DEV_LOG.md).

---

## 🚨 PRIORIDADE 1 — Produção está desatualizada

`main` está em `faa38b7` (junho) e **quebrada em quatro lugares independentes**:
sem `brd_json`, paginação com `num` deprecado, scraper assíncrono do Top 100 (a
travada que o cliente relatou) e query `allintext:` que o Google responde com
zero.

`staging` (`6ff8ba8`) está com tudo consertado e validado — Salvador devolve 13
resultados. **É o deploy que mais vale, porque é o que o cliente sente.**

Requer autorização explícita do João (CLAUDE.md proíbe merge direto em `main`).

Checklist ao promover:
- [ ] Conferir `commit` no `/health` de produção depois do deploy
- [ ] Confirmar que a fila de produção manteve o nome **puro** (`manual-search-queue`), sem sufixo — é o que garante que o app do cliente não precisa mudar
- [ ] Rodar uma busca real e conferir `requestsPerCity` e `queries` em `budget_tracking`

---

## 🎯 Fase 8 — escopo acordado

Plano completo desenhado com o João em 02/08. Ordem de execução sugerida abaixo;
cada bloco é commit próprio, para ter rollback.

### 8.1 — Paralelizar de volta (rápido, alto impacto)

As 3 queries da busca manual foram serializadas em 01/08 com base na suspeita
**errada** de que a zone aceitava ~1 requisição por vez. A documentação oficial
diz que **não há limite de concorrência** (só vazão, 100 QPS por conta).

- Desfazer a serialização em [manualSearchWorker.ts](../backend/src/jobs/workers/manualSearchWorker.ts) (comentário "EM SERIE de proposito")
- Paginar em lotes paralelos: os offsets `start` são independentes, dá para pedir páginas 0/10/20/30 de uma vez e checar a janela entre lotes
- Retry único quando o corpo vier vazio (0 bytes é sinal explícito, não ambiguidade)
- Revisar `api_rate_limits.brightdata` — `max_concurrent: 10` está adequado, pode até subir

**Ganho medido/estimado:** estágio 1 de ~85s para ~30s; busca de 1 ano de ~8 min para ~3.

### 8.2 — Parar de descartar (região metropolitana + fora do período)

As duas maiores causas de rejeição do Filter2 são data e cidade vizinha — e as
duas são informação útil. Salvador descartou Camaçari e Lauro de Freitas.

- **Contrato retrocompatível primeiro** (é o que torna o resto seguro): a rota mantém `results` com só o balde principal e pendura `extras: { regiao, fora_do_periodo }` ao lado. O app atual lê `body['results']` e **não regride**.
- Dois sinalizadores no resultado (`fora_do_periodo`, `cidade_vizinha`) + o campo `estado`, hoje descartado na montagem
- Classificar em vez de rejeitar nos pós-filtros de [pipelineCore.ts](../backend/src/jobs/pipeline/pipelineCore.ts); o embedding passa a ser gerado **depois** da classificação
- Novo `services/location/metroRegion.ts` — GPT (`gpt-4o-mini`, **nunca** gpt-5-nano) resolve os municípios da região metropolitana, cache no Redis com TTL de 30 dias, uma chamada por busca. Falha → array vazio, comportamento de hoje
- `search_results.results` é JSONB livre: **sem migration**

### 8.3 — Dedup em camadas

Hoje corta 26 → 13 e o João já testou 0,80 sem resolver. O algoritmo compara só
cosine contra o elemento semente.

Reusar a estratégia do auto-scan ([services/deduplication](../backend/src/services/deduplication/)):
1. Trava geo-temporal em memória: mesma cidade + mesmo tipo de crime + data ±1 dia
2. Só então cosine
3. Confirmação GPT na faixa duvidosa, atrás de `dedup_gpt_confirm_enabled` (default `false`)

Resolve os dois lados: datas diferentes param de se fundir, e dentro do mesmo
evento dá para ser mais permissivo. Como exige mesma cidade, item de região
metropolitana nunca se funde com o principal.

🚫 **NÃO alterar `runIntraBatchDedup`** — ela é compartilhada com o auto-scan, e o
João pediu explicitamente para não encostar nele. Criar **função nova**, usada só
pelo `manualSearchWorker`. A antiga fica intacta e o auto-scan segue no caminho
que já funciona. Mesma regra vale para qualquer outro ponto compartilhado.

### 8.4 — Escada de períodos até 1 ano

30 / 60 / 90 / **180** / **365**. Coletar fundo é barato (~$0,04); o caro é
analisar (~$0,0025/artigo).

- `periodo_dias` em [validation.ts](../backend/src/middleware/validation.ts) **já aceita até 365** (`.max(365)`) — nada a fazer aqui
- Tetos por período (ajustáveis no admin, sobem menos que proporcionalmente porque o índice do Google rareia para trás):

| período | teto | ~custo de análise |
|---|---|---|
| 30d | 80 | $0,20 |
| 60d | 80 | $0,20 |
| 90d | 120 | $0,30 |
| 180d | 150 | $0,38 |
| 365d | 200 | $0,50 |

- `manual_search_horizon_days`, default `365`
- **Ordenar antes do teto:** o teto é aplicado depois do Filter1, mas a classificação em baldes só acontece no Filter2 — sem ordenar, notícia de 8 meses atrás consome a cota e mata uma do período pedido. O `parseSerpDate` já lê a data de publicação no estágio 1 e hoje a descarta; carregá-la em `SearchResult` e priorizar o que está dentro da janela

### 8.5 — Progresso granular + 409 informativo

- `runContentFetch` e `runFilter2WithEmbedding` ganham `onProgress(feitos, total)` **opcional** (para não afetar o auto-scan)
- Achados recentes (últimos ~5: `tipo · bairro · data`) dentro do progresso — o dado já está em memória
- Escrita estrangulada a ~1 a cada 2s (o app faz polling a cada 3s)
- **409 informativo:** [manualSearchRoutes.ts](../backend/src/routes/manualSearchRoutes.ts) passa a devolver `searchId` e `progress` da busca corrente, para o app oferecer "ver progresso / cancelar" em vez de erro seco
- **TTL na busca fantasma** — virou load-bearing: com uma busca por vez, um job morto (o Render reinicia sozinho no free tier) prende o usuário para sempre. Critério melhor que o relógio: **sem avanço de progresso** há ~20 min

---

## 📱 Fase 9 — Flutter (documentada, não iniciada)

Três telas e um card compartilhado com feed e favoritos — merece sessão dedicada.

### Conceito de UI do João

No feed as notícias já são separadas por data com uma linha divisória no rolamento
(`_DateHeader`, [feed_screen.dart:278](../mobile-app/lib/features/feed/screens/feed_screen.dart#L278), padrão `Divider — LABEL — Divider`).

A ideia: **no fim da lista**, uma linha igual porém em cor destacada, escrito algo
como *"Região metropolitana e mais ocorrências relevantes"*. Ao tocar, expande e
mostra os cards normais, com o mesmo `NewsCard`. Não polui a visão padrão e
reaproveita um padrão que o usuário já conhece.

### Tela de carregamento: o funil ao vivo

A pipeline já produz uma história em números. Mostrar isso, em vez de 7 passos
com check:

```
BUSCANDO          ✓  86 encontradas
TRIAGEM RÁPIDA    ✓  68 relevantes        (18 fora)
LEITURA           ⟳  34 de 50             ~40s
ANÁLISE              —
AGRUPAMENTO          —

ÚLTIMOS ACHADOS
  homicídio · Cabula · há 2 dias
  roubo · Pituba · ontem

[ Pode fechar — a gente avisa quando terminar ]
```

Fluxo do período longo: ele escolhe 1 ano, vê o funil, e **sai** — a busca é job
no servidor e sobrevive a fechar o app. O push já existe e já manda o `search_id`;
falta o deep link abrir o resultado. A tela já sabe retomar por `resumeSearchId`.

### Pontos de encaixe (verificados em 02/08)

| o quê | onde |
|---|---|
| `_results` (hoje `List<Map>` cru, sem classe) | [manual_search_screen.dart:37](../mobile-app/lib/features/search/screens/manual_search_screen.dart#L37) |
| Onde os resultados chegam (polling e resume) | [:99](../mobile-app/lib/features/search/screens/manual_search_screen.dart#L99) e [:265](../mobile-app/lib/features/search/screens/manual_search_screen.dart#L265) |
| `ListView.builder` plana, sem agrupamento | [:855-864](../mobile-app/lib/features/search/screens/manual_search_screen.dart#L855) |
| Parse Map → NewsItem | [news_item.dart:79-115](../mobile-app/lib/core/models/news_item.dart#L79) |
| Card compartilhado (feed + favoritos + busca) | [news_card.dart:13-19](../mobile-app/lib/features/feed/widgets/news_card.dart#L13) |
| Polling que desiste em 10 min | [:226](../mobile-app/lib/features/search/screens/manual_search_screen.dart#L226) |

### Cuidados

- **Não existe accordion em todo o `mobile-app/lib`** — zero `ExpansionTile`, `ExpansionPanel` ou `AnimatedCrossFade`. Versão simples (um `bool` + itens condicionais) resolve
- `estadoUf` não é preenchido em `fromSearchResult`; com o `estado` de 8.2, dá para preencher
- `source_type` vem do backend e é descartado no parse
- Regra de desistência do polling deve virar **por estagnação, não por relógio**

---

## 📊 Fase 10 — Calendário (documentada)

Ideia do João (02/08): **um calendário abaixo dos cards**, em painel expansível
(pushdown), limitado a 1 ano, para o usuário escolher o intervalo que quiser.

### A restrição que define o desenho

**O Google só pagina de hoje para trás.** O `sbd:1` ordena por data e caminha do
mais recente ao mais antigo — não existe "comece em março". Consequência:

> Buscar 1 a 31 de março custa **o mesmo** que buscar os últimos cinco meses.
> A largura do intervalo é irrelevante; o que custa é quão longe fica o início.

Isso tem um lado bom: se a busca já atravessou até março, **ela coletou tudo no
caminho** — que é exatamente o balde `fora_do_periodo` da Fase 8.

### Por que isso é quase de graça no backend

**Não é preciso trocar `periodo_dias` por um intervalo de datas.** Como a
paginação sempre parte de hoje, a data **final** não economiza trabalho nenhum —
ela é filtro de exibição, e o app faz isso client-side sobre o que já veio. O
backend só precisa saber **até onde voltar**, que é o `periodo_dias` atual (já
aceita 365).

Então o calendário é:

1. **Re-fatiar client-side**, de graça, o que a busca coletou (principal + `fora_do_periodo`). Os resultados já carregam `data_ocorrencia`.
2. Quando o usuário puxa para **antes do que foi coletado**, aí sim oferecer *"buscar esse período"* — que é simplesmente uma busca nova com `periodo_dias` maior.

### O que muda no app

`_computeAnalytics` ([report_screen.dart:138-212](../mobile-app/lib/features/search/screens/report_screen.dart#L138)) roda **uma vez no `initState`** e varre tudo sem filtro — donut, bairros, tendência semanal, fontes. Precisa virar **função de um subconjunto filtrado**, chamada em `setState`.

É a mesma mecânica dos toggles de região/período: **lista e relatório viram função de um recorte**. Fazendo um, os outros saem quase de graça — toggle, período e intervalo do calendário são todos o mesmo filtro.

É também o que **paga** a busca de 1 ano: gasta-se ~$0,50 uma vez e re-fatia infinitas vezes sem custo.

⚠️ `_loadMapPoints` busca por `searchId` no backend e receberia os pontos extras
automaticamente — precisa do mesmo filtro. E o cabeçalho ("Últimos N dias") tem
de refletir o recorte escolhido, senão o relatório mente.

---

## 💡 Em aberto (não decidido)

- **Fontes oficiais por estado** (SSP/Polícia Civil): 27 fontes, não 5.570 cidades, encaixando no `type='state'` que já existe. Motivo: o RSS grátis enxerga matéria que o SERP pago não surface — a via raspada dá visão pior do índice do Google do que o feed aberto. É projeto, não remendo; fazer só depois de medir o ganho da Fase 8
- **Google News RSS como índice** (não como fonte): título, data e veículo vêm corretos e de graça, mas a URL é redirect opaco. Só viraria útil se aparecer forma limpa de resolver a URL
- Subir `filter2` de 5 para mais concorrência (o limite da OpenAI é bem maior que o configurado)

## 🔧 Dívida técnica herdada

- `.eq('user_id')` faltando no delete por `params_hash` ([queries.ts:989](../backend/src/database/queries.ts#L989)) — um cliente apaga a busca de outro que usou os mesmos parâmetros
- `try/catch` no `queue.add` — se o enfileiramento falhar, marcar `failed` em vez de deixar linha órfã
- Checar `is_admin` no middleware do admin panel (hoje só checa se há sessão)
- Timeouts em Jina e OpenAI (Bright Data já tem)
- Limpar 5 configs mortas (`scan_cron_schedule`, `worker_concurrency`, `worker_max_per_minute`, `scan_lock_ttl_minutes`, `budget_warning_threshold`) — ou ligá-las
- `openai` ^4.24.1 → v6; Flutter: `fl_chart` 0.70→1.x, `share_plus` 10→12, `flutter_map` 7→8, `sentry_flutter` 8→9
- **Renomear "Netrios News" para "SIMEops"** (diretório e repo)

## 🐛 Bugs conhecidos / suspeitas

- **Página vazia da Bright Data** (HTTP 200, 0 bytes, sem `x-brd-err-code`): observada em 01/08, causa **desconhecida**. Não era concorrência (a doc descarta). Mitigação em 8.1 é retry sobre o sinal explícito
- **Filter0 keywords amplas**: `"jogo"`, `"tempo"`, `"música"`, `"esporte"` geram falso negativo. Estratégia em aberto
- **Admin `crime-pie-chart.tsx`**: não investigado se usa `byCategory` direto ou recalcula
