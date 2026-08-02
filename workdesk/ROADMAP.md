# ROADMAP — SIMEops (Fase 8)

> Planos, backlog e próximos passos. Revisado no fim de cada sessão com o João.
>
> Fases 1 a 7 arquivadas em [Fases/](./Fases/). Estado atual do sistema e
> medições que não devem ser refeitas: ver o bloco **ESTADO DO MUNDO** no
> [DEV_LOG](./DEV_LOG.md).

**Dois documentos irmãos, criados no fim da Fase 8:**
- [API_CONTRATO.md](./API_CONTRATO.md) — rotas e shapes, para quem for mexer no app
- [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md) — lista crua do que falta no backend, ordenada por consequência

---

## 🔜 PRIORIDADE 0 — Testar a reforma de 02/08 (nada dela rodou ainda)

A reforma inteira (8 commits) está em `develop` e **nenhuma linha executou com
rede, banco e fila**. Passou em `tsc --noEmit` e nas regressões sem rede — que
cobrem lógica pura, não o caminho real.

Ordem sugerida:

1. **Subir `develop` → `staging`** (é onde o APK do João aponta)
2. **Busca manual pelo app**, 30 dias, uma cidade. O que olhar:
   - `budget_tracking.details.queries` — devem ser **5 assuntos**, não 3
   - `resultsCount` contra o de hoje (Salvador/30d deu 202 URLs com 3 assuntos)
   - o estágio 4 deve ficar ~**metade** do tempo (pool 5 → 10)
3. **Repetir com 90 dias, na mesma cidade.** É o teste que responde a pergunta
   original do João: com 5 assuntos, 90 dias tem que render mais que 30 — o que
   hoje não acontece.
4. **Painel admin**: conferir que o toggle da Fonte Web aparece **ligado** e que
   o campo do teto mostra **0**, não vazio. Editar a lista de assuntos e salvar.
5. **Segunda 03/08**: `npx tsx scripts/diagnostico-banco.ts` para ver o scan
   rodando, e `budget_tracking.details.commit` para saber **qual código** rodou.

⚠️ Ao subir para staging, lembrar que produção usa o **mesmo banco e o mesmo
Redis**. As chaves novas (`search_subjects`, `manual_search_fetch_concurrency`)
não existem na `main`, então são inofensivas — mesmo padrão da
`manual_search_analysis_cap`.

---

## 🚨 PRIORIDADE 1 — Produção está desatualizada

`main` está em `faa38b7` (junho) e **quebrada em quatro lugares independentes**:
sem `brd_json`, paginação com `num` deprecado, scraper assíncrono do Top 100 (a
travada que o cliente relatou) e query `allintext:` que o Google responde com
zero.

`staging` (`06b9bc8`) está com tudo consertado e **validado no app: 54 resultados**.
**É o deploy que mais vale, porque é o que o cliente sente.**

Requer autorização explícita do João (CLAUDE.md proíbe merge direto em `main`).

**Decisão do João (02/08): só promover depois de terminar o que falta.** A lista
crua está em [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md); o corte recomendado é
"consertos sim, produto depois" — Fases 9 e 10 são melhoria, não pré-requisito.

Checklist ao promover:
- [ ] Conferir `commit` no `/health` de produção depois do deploy
- [ ] Confirmar que a fila de produção manteve o nome **puro** (`manual-search-queue`), sem sufixo — é o que garante que o app do cliente não precisa mudar
- [ ] Rodar uma busca real e conferir `requestsPerCity` e `queries` em `budget_tracking`
- [ ] **Subir o APK junto** — o limite de 1 cidade está nos dois lados
- [ ] Confirmar `AUTO_SCAN_ENABLED` / `NODE_ENV=production` no Render, senão o scan do cliente para

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

### ✅ 8.3 — Dedup em camadas — FEITO em 02/08

- [x] Camada 1: trava geo-temporal em memória (cidade + estado + tipo + data ±1d, bairro tolerante a nulo)
- [x] Camada 2: cosine com o `dedup_similarity_threshold` de sempre
- [x] Camada 3: confirmação GPT na faixa duvidosa, atrás de `dedup_gpt_confirm_enabled` (default `false`)
- [x] Sinalizadores **inclusivos** no cluster → baldes voltaram a ser deduplicados juntos
- [x] Regressão sem rede: `scripts/test-dedup-camadas.ts`, 10/10
- [x] 🚫 `runIntraBatchDedup` intacta — arquivo novo, usado só pelo `manualSearchWorker`

**Medido:** Salvador / 30 dias, mesmas 32 extrações, mesmo threshold 0,70 —
antigo 32→16, camadas 32→**21**. **5 ocorrências reais** que o antigo fundia por
engano (+31%), com 273 pares barrados pela trava antes de qualquer cosine.
Detalhes no [DEV_LOG](./DEV_LOG.md).

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

### 8.5 — Progresso granular + 409 informativo ⬆️ virou pré-requisito

🔴 Com o teto de análise aberto (02/08), o limite deixou de ser dinheiro e passou
a ser **tempo**: o app desiste em 10 min (`_maxPolls = 200` × 3s).

Dois travamentos foram postos em 02/08 justamente para caber nesse teto, e ambos
saem depois desta fase — cada um é **dois números**:

| trava | onde | volta para |
|---|---|---|
| período ≤ 180 dias | [validation.ts](../backend/src/middleware/validation.ts) | 365 |
| 1 cidade por busca | `validation.ts` + `multi_city_search_field.dart` (`maxCities`) | 10 |

**Desistir por estagnação, não por relógio:** enquanto o contador de progresso
avança, o app continua esperando; se não muda há ~2 min, aí é falha. Some o
número mágico e qualquer lentidão futura fica coberta.


**Backend: FEITO em 02/08.**

- [x] `onProgress` **opcional** em `runContentFetch` e `runFilter2WithEmbedding` (auto-scan não afetado)
- [x] Achados recentes (últimos 5: `tipo · bairro · data`) no progresso — custo zero, o dado já está em memória
- [x] Escrita estrangulada a 1 a cada 2s + `aguardar()` na troca de estágio (senão o progresso anda para trás)
- [x] **409 informativo** — devolve `searchId`, `params` e `progress`; só acrescenta campos, o APK atual não regride
- [x] **Busca fantasma** — sem avanço de progresso há 20 min, libera o usuário
- [ ] **App: desistir por estagnação** em vez de `_maxPolls = 200` — o backend já emite o contador, falta o Flutter (Fase 9)

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

## ✅ Fase 11 — Auto-scan revisado (FEITO em 02/08)

Todos os achados fechados, mais dois extras. Decisão do João:
*"aplicamos tudo já, com cautela, testo em staging alguns dias e depois subo
tudo pro main"* — o que substituiu o gatilho original ("só depois de uma semana
medida"). Consequência aceita: a medição de segunda mede tudo junto.

| # | achado | conserto |
|---|---|---|
| 1 | cidade por substring | igualdade com limpeza (`mesmaCidade`), 21/21 |
| 2 | `dateRestrict: 'd1'` hardcoded | `scanPeriodDays` entra na coleta |
| 3 | duplicata no `news` (26%) | `runIntraBatchDedupLayered` ligado no scan |
| 4 | custo em duas contabilidades | `calculateCost` removida, `custoDoRun` acumula o real |
| 5 | sem dedup por URL antes do Jina | peneira em `news_sources` antes do Filter0 |
| 6 | `scanIndex` mudava a cada minuto | agora anda 1 por execução |

**Ainda sem medir:** o baseline de 31/07 (9 de 10 execuções com zero notícias)
segue guardado; o "depois" começa segunda 03/08.

### Candidatos que sobraram (não são achados)

| candidato | por que | risco |
|---|---|---|
| **Templates por perfil de cidade** | capital e cidade pequena não rendem com a mesma query; hoje é a mesma lista para todas. Com `search_subjects` no painel, isto virou "lista por location" | médio |
| **Paginação em lote** (de 8.1) | o scan pagina pouco por rodar todo dia; ganho menor que na busca manual | baixo |

### Regras que valem para qualquer mudança aqui

- **Medição antes e depois**, sempre por notícias salvas por scan
- **Commit próprio** por mudança, para rollback isolado
- Preferir **parâmetro opcional** a alterar comportamento compartilhado

---

## 📜 Fase 11 — o histórico da auditoria (referência)

> Tudo abaixo está **fechado** — fica como registro de como cada achado foi
> encontrado e por quê. O estado atual está na Fase 11 acima.

Pedido do João em 02/08, logo depois de mandar não encostar nele agora: *"Coloca
no plano depois um trabalho de verificar possível atualização no auto scan para
ficar melhor, se a busca passar nos testes"*.

**A ordem importava:** a busca manual seria o banco de provas, e o que
sobrevivesse a ela iria para o auto-scan. Na prática o João optou por aplicar
tudo de uma vez e testar em staging — o preço é a medição de segunda vir
misturada, e ele aceitou sabendo.

### Gatilho original (superado pela decisão de aplicar tudo)

1. ~~Fase 8 validada em staging, com o funil medido antes e depois~~ ✅ feito
2. ~~Auto-scan rodado ao menos uma semana com as mudanças de 01/08~~ — **não
   esperado**, por decisão do João

### O "antes" da medição (guardar)

**Baseline confirmado no banco em 02/08** (`scripts/diagnostico-banco.ts`):
`operation_logs` está saudável e a última execução foi **31/07 20:00**. Das 10
últimas, **9 acharam ZERO notícias**, com `urls_processed` entre 0 e 10.

```
2026-07-31 20:00 | urls= 1 | news=0
2026-07-31 19:00 | urls=10 | news=0
2026-07-31 19:00 | urls= 4 | news=0
2026-07-31 18:00 | urls= 1 | news=1
```

Comparar contra a primeira semana com os templates novos. **Sem esse número, nada
se mexe.**

### 🔴 Achados da leitura da pipeline (02/08) — com evidência no banco

Investigação a pedido do João, **só leitura**, nada alterado.

#### 1. ✅ CORRIGIDO (02/08) — `São José do Cedro` no feed de `São José`

> Conserto: `limparNomeCidade` + `mesmaCidade` em `utils/helpers.ts`, usados nos
> dois pontos do pós-filtro. Igualdade exata **depois** de limpar `(BA)`, `- SC`,
> `Município de`. Não corta no hífen (`Embu-Guaçu` ≠ `Embu`).
> `scripts/test-match-cidade.ts`: 21/21. Rejeição que a regra antiga aceitaria sai
> marcada com `[parcial]` em `rejected_urls`, para medir o aperto depois.
>
> **As 10 linhas seguem no banco**, por decisão do João (fase de teste, cliente
> sabe). `scripts/limpar-cidades-intrusas.ts` está pronto — dry-run por default,
> `--aplicar`, `--reverter`. Dry-run confirmou que o escopo é só São José do
> Cedro: 192 das 202 notícias são legítimas.

O pós-filtro de cidade aceitava **substring**:

```ts
const cidadeParcial = cidadesLower.some(c => cidadeExtraida.includes(c) || c.includes(cidadeExtraida));
```

`"são josé do cedro".includes("são josé")` → **true**, e o estado (SC) bate. Reproduzido:

```
monitorada="São José" vs extraida="São José do Cedro"    -> ACEITA ✅ (errado)
monitorada="São José" vs extraida="São José do Cerrito"  -> ACEITA ✅ (errado)
```

São José do Cedro fica a ~600 km de São José. **É visível pro cliente**, e afeta
também a busca manual (mesmo código). O `includes` existe para tolerar variação
de acento/sufixo — precisa virar comparação por igualdade normalizada, com o
`includes` só como fallback controlado.

#### 2. ✅ CORRIGIDO (02/08) — a janela de coleta contradizia a de aceitação

> Conserto: `scanPeriodDays` entra no `pipelineConfig` e a coleta manda
> `d${scanPeriodDays}`. Coleta e pós-filtro passam a olhar o **mesmo** período.
>
> O prazo era real: o scan estava parado desde sexta 31/07 20:00 (correto —
> `scan_weekend_enabled = false`, 01–02/08 foram sáb/dom), e segunda de manhã era
> exatamente o caso que o `scan_period_days: 4` foi criado para cobrir.

| | valor |
|---|---|
| coleta (`dateRestrict`, [scanPipeline.ts:342](../backend/src/jobs/pipeline/scanPipeline.ts#L342)) | **`'d1'` hardcoded** |
| aceitação (`scan_period_days`, pós-filtro) | **4** |

O `scan_period_days` foi subido de 2 para 4 justamente "pra recuperar sáb/dom na
segunda" — mas a coleta continua pedindo 1 dia. Pior: desde a mudança de 01/08, o
`inicioDaJanela('d1')` **corta a paginação** em 24h. Então na segunda o scan não
enxerga o fim de semana, por mais que o filtro aceite.

⚠️ Esta parte é **regressão que eu introduzi** com o `sbd:1` + parada de paginação.
Antes o `d1` era só um `qdr` ignorado pelo Google; agora ele trunca de verdade.

#### 3. ✅ CORRIGIDO (02/08) — duplicata no `news`, 26% das linhas em grupos suspeitos

> Conserto: `runIntraBatchDedupLayered` (o algoritmo em camadas da 8.3) ligado no
> scan, no lugar do `runIntraBatchDedup`, que só olhava cosine.


`202 linhas → 24 grupos (cidade+tipo+data) com mais de 1 → 52 linhas (26%)`

Nem todos são duplicata (mesma cidade/tipo/dia pode ser evento diferente), mas a
inspeção confirma casos reais, e o padrão é claro — **o mesmo evento com `bairro`
preenchido numa linha e `null` na outra**:

```
Florianópolis|homicidio|2026-04-23  → 4 linhas
   bairro=null   | Um jovem de 24 anos foi morto a facadas em uma residência no Centro...
   bairro=Centro | Um jovem de 24 anos foi morto a facadas em sua casa no Centro...
```

Suspeita: `buildEmbeddingText` inclui o bairro no prefixo, então bairro ausente
muda o vetor e derruba o cosine abaixo do threshold.

**O conserto já existe** — `runIntraBatchDedupLayered` (8.3), que na busca manual
recuperou 5 de 16. Só não foi ligado no scan, de propósito.

#### 4. ✅ CORRIGIDO (02/08) — o custo do scan era contado de duas formas que não batiam

> Conserto: `calculateCost` removida; `custoDoRun` acumula exatamente o que é
> gravado no `budget_tracking`. `dedup_gpt` passou a cobrar por token real, e só
> quando a camada 3 roda. A coleta usa o `requestCount` do provider.


- `budget_tracking` usa tokens reais por estágio
- `operation_logs.cost_usd` usa `calculateCost()`, uma fórmula **separada** com taxas fixas
- `dedup_gpt` grava `duplicatesFound * 0.001` — número inventado, e conta duplicata de **qualquer** camada (a camada 1 é grátis). O `tokensUsed` que `deduplicateNews` devolve é **descartado**

#### 5. ✅ CORRIGIDO (02/08) — não existia dedup por URL antes do Jina

> Conserto: `db.findKnownSourceUrls` consulta `news_sources` em lotes de 100,
> antes do Filter0 — mais cedo que o planejado, porque URL já salva não muda de
> status em estágio nenhum.


O scan roda de hora em hora (`scan_frequency_minutes` default 60) e **nunca
consulta `news_sources` antes do estágio 4**. O mesmo artigo é reanalisado no
Filter2 a cada rodada — até 24×/dia. O Jina é cacheado no Redis; o GPT não.

Ficou mais visível com o conserto do #2: `d4` traz mais repetido que `d1`.

Não é urgente — o custo do mês é **$0,12 de $100**. Mas é desperdício estrutural,
e o conserto é um `SELECT` em `news_sources` filtrando as URLs já vistas antes do
estágio 4. Decisão do João: **separado**, não junto com #2.

#### 6. Menores

- **Push de estatística:** `natureza === 'estatistica'` dispara push igual a crime ("homicídios caíram 12%" chega como alerta). O código já trata estatística como coisa à parte em outros pontos — aqui não. **Decisão de produto, ainda em aberto.**
- ✅ **`scanIndex = Date.now()/60000`** — corrigido em 02/08: agora divide pelo `scan_frequency_minutes` da location e anda 1 por execução, então o rodízio é rodízio de verdade.
- **Sem `parent_id`, não há pós-filtro nenhum** (`locationPostFilter = undefined`) — a cidade aceitaria notícia de qualquer lugar. Hoje as 4 cidades têm pai; **é latente e segue em aberto**.
- **RSS está desligado** no banco (`google_news_rss_enabled = false`) — correto, já que a URL do RSS é redirect opaco.

### Candidatos — dois viraram conserto, dois continuam

| candidato | estado |
|---|---|
| **Data do SERP antes do Jina** | ✅ feito em 02/08 (era o maior ganho de custo esperado) |
| **Dedup em camadas** (o de 8.3) | ✅ feito em 02/08 |
| **Templates por perfil de cidade** | em aberto — agora que `search_subjects` está no painel, isto vira "lista por location" |
| **Paginação em lote** (de 8.1) | em aberto; ganho menor, o scan pagina pouco |

⚠️ Herança a não esquecer: quatro mudanças de 01/08 **já** afetam o auto-scan
(templates, `sbd:1` + parada de paginação, Filter2 paralelo, sufixo de fila). A
primeira execução real delas é **segunda 03/08** — e agora ela vem junto com a
reforma de 02/08, então o "depois" mede as duas coisas.

---

## 💡 Em aberto (não decidido)

- **Fontes oficiais por estado** (SSP/Polícia Civil): 27 fontes, não 5.570 cidades, encaixando no `type='state'` que já existe. Motivo: o RSS grátis enxerga matéria que o SERP pago não surface — a via raspada dá visão pior do índice do Google do que o feed aberto. É projeto, não remendo; fazer só depois de medir o ganho da Fase 8
- **Google News RSS como índice** (não como fonte): título, data e veículo vêm corretos e de graça, mas a URL é redirect opaco. Só viraria útil se aparecer forma limpa de resolver a URL
- Subir `filter2` de 5 para mais concorrência (o limite da OpenAI é bem maior que o configurado)

## 🔧 Dívida técnica herdada

> Cinco itens saíram desta lista em 02/08: os três de segurança (delete por
> `params_hash`, `is_admin` no painel, `queue.add` sem try/catch) e os timeouts
> de Jina e OpenAI. Ver DEV_LOG.

- **Migration 025 (RLS)** — 🚨 o banco aceita leitura e escrita pela chave anon, que é pública. Escrita, **não rodada**, aguarda autorização
- Limpar 7 configs mortas (`scan_cron_schedule`, `worker_concurrency`, `worker_max_per_minute`, `scan_lock_ttl_minutes`, `budget_warning_threshold`, e desde a 8.4 `manual_search_max_results_60d` e `_90d`) — ou ligá-las
- `openai` ^4.24.1 → v6; Flutter: `fl_chart` 0.70→1.x, `share_plus` 10→12, `flutter_map` 7→8, `sentry_flutter` 8→9
- **Renomear "Netrios News" para "SIMEops"** (diretório e repo)

## 🐛 Bugs conhecidos / suspeitas

- **Página vazia da Bright Data** (HTTP 200, 0 bytes, sem `x-brd-err-code`): observada em 01/08, causa **desconhecida**. Não era concorrência (a doc descarta). Mitigação em 8.1 é retry sobre o sinal explícito
- **Filter0 keywords amplas**: `"jogo"`, `"tempo"`, `"música"`, `"esporte"` geram falso negativo. Estratégia em aberto
- **Admin `crime-pie-chart.tsx`**: não investigado se usa `byCategory` direto ou recalcula
