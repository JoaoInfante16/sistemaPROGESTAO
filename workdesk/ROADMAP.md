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

### ✅ 8.1 — Paralelizar de volta — FEITO em 02/08

- [x] Desfeita a serialização em [manualSearchWorker.ts](../backend/src/jobs/workers/manualSearchWorker.ts)
- [x] Paginação em lote, **opt-in** via `pageConcurrency` (default 1 = serial, para o auto-scan não mudar)
- [x] Retry único de corpo vazio (0 bytes é sinal explícito)
- [ ] Revisar `api_rate_limits.brightdata` — `max_concurrent: 10` segue adequado, não foi mexido

**Medido:** Salvador / 30 dias, 23,7s → **9,0s (2,6x)** com saída idêntica (59 URLs,
6 requests nos dois). Detalhes no [DEV_LOG](./DEV_LOG.md).

### ✅ 8.2 — Parar de descartar — FEITO em 02/08

- [x] Contrato retrocompatível: `results` só o principal + `extras: { regiao, fora_do_periodo }`
- [x] Sinalizadores `fora_do_periodo` / `cidade_vizinha` + campo `estado`
- [x] Classificar em vez de rejeitar — **opt-in `classificar`**, porque o auto-scan chama a mesma função
- [x] `services/location/metroRegion.ts` — GPT + cache Redis 30d
- [x] Filtro nos **outros dois** leitores de `search_results` (analytics e map points)
- [x] Sem migration

**Medido:** Salvador / 30 dias — 21 principal + **3 extras que antes eram jogados
fora** (Camaçari ×2, Lauro de Freitas). Feira de Santana seguiu rejeitada, correto.
Detalhes no [DEV_LOG](./DEV_LOG.md).

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

### ✅ 8.4 — Período livre e respeitado — FEITO em 02/08 (backend)

Feito **antes da 8.3**: o dedup perde 26→13, mas o teto de coleta perdia semanas
inteiras.

**Não há escada.** O João pediu período de escolha livre, não faixas fixas — os
dois tetos viraram funções contínuas da raiz do período, e os três degraus
escondidos (teto de coleta constante, 3 configs por faixa, `dateRestrict`
arredondando 45→60) saíram.

- [x] Teto de **coleta** derivado do período — Salvador/30d passou de 3 para **29 dias** de alcance (59 → 156 URLs)
- [x] Teto de **análise** derivado de uma base única (`manual_search_max_results_30d`), ajustável no admin
- [x] `publishedAt` da SERP no `SearchResult` + priorização dentro-da-janela antes do corte
- [x] `manual_search_horizon_days` (365)
- [ ] **Testar 365 dias de ponta a ponta** — João vai testar no app

| dias | coleta/query | análise | custo/cidade |
|---|---|---|---|
| 30 | 70 | 50 | $0,16 |
| 90 | 110 | 87 | $0,27 |
| 180 | 150 | 122 | $0,37 |
| 365 | 220 | 174 | $0,53 |

**O gargalo mudou de lugar:** agora é o teto de análise (142 candidatos dentro da
janela para uma cota de 50). É escolha de custo, não bug — sobe numa config.

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

**Cards ficam** (02/08) — o `NewsCard` compartilhado continua sendo a unidade. O
layout da seção o João vai desenhar; o backend não pressupõe nada além de
`results` + `extras`.

**Seletor de período: escolha livre, não botões fixos** (02/08). O backend já
aceita qualquer inteiro de 1 a 365 e os tetos acompanham sem faixas — então o app
pode usar slider, campo, calendário, o que a UI pedir. Nada a mudar no servidor.

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

## 🔁 Fase 11 — Revisar o auto-scan (só depois que a busca manual provar)

Pedido do João em 02/08, logo depois de mandar não encostar nele agora: *"Coloca
no plano depois um trabalho de verificar possível atualização no auto scan para
ficar melhor, se a busca passar nos testes"*.

**A ordem importa e é o ponto do item:** a busca manual é o banco de provas. O
que sobreviver a ela — medido, não suposto — é candidato a ser levado para o
auto-scan. O contrário (mexer nos dois ao mesmo tempo) foi o que já custou caro.

### Gatilho — não começar antes disto

1. Fase 8 validada em staging, com o funil medido antes e depois
2. Auto-scan rodado ao menos uma semana com as mudanças de 01/08, com número na mão

### Medir primeiro (o "antes" já existe nos logs)

Baseline de 31/07: 1 a 10 URLs por scan e **0 notícias** na maioria — sintoma dos
templates de Perplexity. Comparar contra a primeira semana com os templates novos,
por `operation_logs` e notícias salvas por scan. **Sem esse número, nada se mexe.**

### Candidatos, por ordem de ganho esperado

| candidato | por que | risco |
|---|---|---|
| **Data do SERP antes do Jina** | o scan usa `periodoDias=2`; hoje ele baixa e analisa artigo velho para descartar depois. O `parseSerpDate` já lê a data no estágio 1 — cortar ali economiza Jina **e** GPT em cima do que ia ser jogado fora. É o maior ganho de custo | baixo |
| **Dedup em camadas** (o de 8.3) | se provar na busca manual, o scan ganha o mesmo: para de fundir crimes de datas diferentes | médio — é o que mais mexe no resultado salvo |
| **Templates por perfil de cidade** | capital e cidade pequena não rendem com a mesma query; hoje é o mesmo conjunto para todas | médio |
| **Paginação em lote** (de 8.1) | o scan pagina pouco por rodar todo dia; ganho menor que na busca manual | baixo |

### Regras que valem para qualquer mudança aqui

- **Autorização explícita do João** por mudança — a ordem de não encostar continua valendo até ele levantar
- **Medição antes e depois**, sempre por notícias salvas por scan
- **Commit próprio** por mudança, para rollback isolado
- Preferir **parâmetro opcional** a alterar comportamento compartilhado (padrão já adotado no `onProgress` de 8.5 e na função nova de 8.3)

⚠️ Herança a não esquecer: quatro mudanças de 01/08 **já** afetam o auto-scan
(templates, `sbd:1` + parada de paginação, Filter2 paralelo, sufixo de fila). Estão
listadas no [DEV_LOG](./DEV_LOG.md), bloco *"Auto-scan: não encostar"*. A primeira
execução real delas é **segunda 03/08** — o "antes/depois" desta fase começa ali.

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
- Limpar 7 configs mortas (`scan_cron_schedule`, `worker_concurrency`, `worker_max_per_minute`, `scan_lock_ttl_minutes`, `budget_warning_threshold`, e desde a 8.4 `manual_search_max_results_60d` e `_90d`) — ou ligá-las
- `openai` ^4.24.1 → v6; Flutter: `fl_chart` 0.70→1.x, `share_plus` 10→12, `flutter_map` 7→8, `sentry_flutter` 8→9
- **Renomear "Netrios News" para "SIMEops"** (diretório e repo)

## 🐛 Bugs conhecidos / suspeitas

- **Página vazia da Bright Data** (HTTP 200, 0 bytes, sem `x-brd-err-code`): observada em 01/08, causa **desconhecida**. Não era concorrência (a doc descarta). Mitigação em 8.1 é retry sobre o sinal explícito
- **Filter0 keywords amplas**: `"jogo"`, `"tempo"`, `"música"`, `"esporte"` geram falso negativo. Estratégia em aberto
- **Admin `crime-pie-chart.tsx`**: não investigado se usa `byCategory` direto ou recalcula
