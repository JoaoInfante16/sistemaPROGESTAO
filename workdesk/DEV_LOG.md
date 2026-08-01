# DEV_LOG — SIMEops (Fase 2)

> Diário de bordo: o que foi feito, decisões tomadas, problemas encontrados.
> Append-only, cronológico (mais recente no topo).
>
> Histórico das Fases 1 a 6 (até a entrada em produção) arquivado em [Fases/](./Fases/).
>
> Rotação: quando passar de ~1500 linhas, mover conteúdo antigo pra `_archive/DEV_LOG_YYYY-MM.md`.

---

## 2026-08-01 — parte 2 (busca manual funciona; e a prova de que manual ≠ auto-scan retroativo)

**Busca manual confirmada funcionando ponta a ponta.** Porto Alegre/RS, 30 dias: estágio 1 em 19,4s (antes travava pra sempre), pipeline completo em ~115s, status `completed`.

**Mas voltou 1 resultado — e o João perguntou por que o auto-scan tem 16 notícias de POA nos mesmos 30 dias.** Investigação com dados reais:

- A busca achou 20 URLs, 19 chegaram ao Filter2, **18 morreram lá** (pós-filtros de data e cidade). Sobrou 1.
- Rodei o estágio 1 de novo pelo caminho real (`scripts/diagnostico-titulos.ts`, novo) e olhei os títulos: a query de "30 dias" devolveu matérias de **janeiro a junho** — caso família Aguiar, retrospectivas de feminicídio, notícias do MPRS. **O Google ignora `tbs=qdr:m` em query retrospectiva**: o ranking é por relevância, e caso grande antigo vence ocorrência pequena recente. O pós-filtro de data (que já existia como "rede de segurança") fez exatamente o trabalho dele.
- Conclusão estrutural: **auto-scan = ~30 fotos diárias com `qdr:d` que se acumulam** (recência alinha com ranking); **busca manual = UMA foto do ranking de hoje**. Nunca vão devolver o mesmo conjunto. Janela curta (d1/d7) e tipo de crime específico funcionam bem na manual; "todos os crimes, 30 dias" é estruturalmente fraco.
- Registrado na memória (`project-fontes-de-busca`).

**Observação solta:** mesmo com só 2 requisições paralelas (web+news), a página 2 do ramo web veio vazia (HTTP 200, 0 bytes, sem `x-brd-err-code`). O suspeito de concorrência da zone segue vivo — teste multi-cidade pelo app fica pra depois, como combinado.

**Ideia levantada, aguardando decisão:** a busca manual ignora o próprio banco. Pra cidade monitorada, mesclar as notícias já acumuladas pelo auto-scan (janela do período) com o que o Google devolver na hora — POA mostraria ~16+ em vez de 1.

### `package-lock.json` versionado + `npm ci` (autorizado pelo João)

Feito: lock removido do `.gitignore` (raiz), `backend/` e `admin-panel/` commitados, `npm install` → `npm ci` no Dockerfile (2 estágios) e no `render.yaml`. `yarn.lock` **segue ignorado** — o projeto é npm e dois locks concorrentes divergem. Sem `.dockerignore` no repo, então o `COPY package*.json ./` que já existia leva o lock junto; nenhuma mudança de `COPY` foi necessária.

Validado antes de commitar: `npm ci --omit=dev` num diretório isolado, 333 pacotes, exit 0. Docker não está instalado nesta máquina, então o build completo da imagem não foi exercitado — o risco residual é baixo (o `npm ci` é o passo que poderia falhar) mas não é zero.

O lock do backend estava com `engines.node: >=20.0.0` enquanto o `package.json` já dizia `>=22.0.0` (resquício do fix do Dockerfile). Sincronizado por edição direta do campo, de propósito: `npm install --package-lock-only` teria re-resolvido tudo e poderia subir versões não testadas.

**Correção de uma afirmação minha na entrada anterior deste mesmo dia** (linha "Node 20 → 22 no Dockerfile"): eu escrevi que o lock ausente "foi o que quebrou o deploy". **Está errado.** Conferi: o lock local (29/07) e o `node_modules` local já tinham `@supabase/supabase-js` **2.111.0** — ou seja, o Render resolveu a mesma versão que o João tinha. O que quebrou foi só o **Node 20 do Dockerfile** contra uma dependência que passou a exigir `node>=22`. Commitar o lock naquele dia não teria evitado nada.

O motivo certo pra versionar o lock é outro, e continua valendo:
- `^2.39.3` virou **2.111.0** — 72 minors — sem ninguém revisar. Lock ignorado é justamente o que deixa esse salto acontecer invisível, local e no Render.
- **Produção (`main`) é o risco vivo:** no próximo deploy dela o `^2.39.3` é resolvido do zero e traz o que estiver mais novo naquele dia, que pode ter mudança de comportamento, não só de `engines`. Com o lock commitado, produção passa a instalar exatamente o que staging vem rodando.

---

## 2026-08-01 (ramo web desligado — o Google fechou a porta)

Continuação do dia anterior. O deploy do staging tinha falhado (Node 20 vs `@supabase/realtime-js` 2.111.0, que exige `node>=22`) — corrigido no Dockerfile. Com o código novo no ar, João testou a busca manual e **continuou travando no estágio 1**.

### O que os dados mostraram

Duração dos snapshots do scraper, na conta do próprio João:

| Data | Duração |
|---|---|
| 14/07 | 17s, 20s, 21s, 39s |
| 17/07 | 70s |
| 21/07 | 34s |
| 30-31/07 | **978s, 963s, 667s, 660s** |

Degradação de ~20× a partir de 21/07, **sem nenhum commit nesse intervalo**. E variância enorme: mesma cidade (Campo Grande), 10 minutos de diferença, 22s no meu teste local contra 667s na busca dele.

### Não é a Bright Data, e não é incidente

João desconfiou da minha hipótese de "provedor degradado" com um argumento bom: a Bright Data é a número 1 do setor, um problema desse tamanho teria anúncio público. **Pesquisei e ele estava certo — não há anúncio nenhum**, nem deles nem do Google, com essa data.

O que existe é contexto:
- **20/07/2026**: juiz federal da Califórnia derrubou o processo do Google contra a SerpApi. O Google perdeu a via **jurídica** contra scrapers.
- O Google vem endurecendo a via **técnica** com o **SearchGuard**.
- A via oficial está fechada: a Custom Search JSON API virou busca por site desde jan/2026.

A doc de rate limit da Bright Data **descarta** throttling como causa: ao estourar, eles devolvem **HTTP 429**, não latência.

Leitura mais provável: o tempo de 660-978s é o **tempo de coleta** do scraper varrendo 10 páginas do Google. Se cada página exige mais tentativas e mais proxies pra passar no SearchGuard, o tempo explode — e a variância gigante é a assinatura de quem está apanhando pra entrar. **Não é incidente com data pra acabar; é o novo normal do índice orgânico**, que é a superfície mais raspada da internet (toda a indústria de SEO).

*Correlação não é prova — não dá pra afirmar que o Google escalou por ter perdido no dia 20. Mas a data bate.*

### Decisão: ramo web vira chave, desligada por padrão

Nova config **`manual_search_web_enabled`** (default `false`), com toggle no admin em Configurações → Busca Manual. Migration `021`.

Com ele desligado a busca roda só no ramo **news** (`tbm=nws`), que não sofre do problema: **~30 resultados em ~50s**, estável em todas as medições do dia anterior.

Perde-se volume, ganha-se previsibilidade — que é justamente o que o João tinha antes e perdeu. E religar é um clique, se o cenário mudar.

### Também nesta sessão

- **Timeout no ramo news** (`SERP_TIMEOUT_MS = 60s`). Eu tinha posto timeout no scraper e **esquecido da SERP** — sem ele, uma página pendurada travava o estágio 1 para sempre, porque o `Promise.allSettled` espera os dois ramos. Era a peça que faltava pro sintoma.
- **Node 20 → 22 no Dockerfile.** Fica registrado o risco de fundo: `package-lock.json` está no `.gitignore`, então o Render resolve os `^` do zero a cada build e instala o que estiver mais novo no dia. **Build não é reproduzível** — foi o que quebrou o deploy sem ninguém tocar em dependência, e **produção pode quebrar sozinha no próximo deploy pelo mesmo motivo**. Fix durável: versionar o lock e trocar `npm install` por `npm ci`. **Não feito — aguardando decisão do João.**

---

## 2026-07-30 (auditoria geral — sem alteração de código)

Retomada após ~3,5 meses parado (último commit de código: 2026-04-18). João perdeu o notebook com os arquivos de memória local e pediu checkup geral + documentação para futuras instâncias, motivado por um relato do cliente: **"busca manual fica carregando e não busca dados"**.

Investigação manual (Grep + Read) em backend, admin panel e Flutter. **Nenhuma linha de código foi alterada** — só documentação. Relatório completo em [AUDITORIA_2026-07-30.md](AUDITORIA_2026-07-30.md).

### Bug do cliente — causa raiz encontrada

Não é travamento: é **lentidão que estoura o timeout do app**. O worker termina a busca; o Flutter desiste antes.

1. **Filter2 roda em série** (`pipelineCore.ts:183`) — `for` com 2 awaits OpenAI por artigo. O rate limiter permite 5 simultâneas e o loop nunca emite mais de 1. Roda a 20% da vazão disponível. 60 artigos ≈ 6 min; 250 ≈ 25 min. **Maior ofensor isolado.**
2. **Validação aceita até 10 cidades** (`validation.ts:116`), cada uma trazendo até 80 URLs (50 web + 30 news) → até 800 URLs no funil.
3. **Flutter desiste em 10 min** (`_maxPolls = 200` × 3s).
4. **Zero timeouts** em Jina, Bright Data e OpenAI. O SDK da OpenAI usa default de 600s × 2 retries.
5. **Contenção**: auto-scan (concurrency 3) e busca manual (2) sobem no mesmo processo e dividem o mesmo Bottleneck de OpenAI. A janela do auto-scan é seg-sex 6-18h — exatamente o horário em que o cliente usa.

### Bugs de estado (podem travar usuário permanentemente)

- **Busca fantasma → 409 eterno**: o check de `status === 'processing'` em `manualSearchRoutes.ts:41` não tem critério de idade. Deploy/restart no meio de um job deixa a linha `processing` para sempre e o usuário nunca mais consegue buscar.
- **Linha órfã**: `createSearchCache` roda antes de `queue.add`. Se o enfileiramento falhar, sobra linha `processing` que ninguém processa → cai no bug acima.
- **Perda de dados entre usuários**: o delete por `params_hash` em `queries.ts:989` **não filtra `user_id`**. Dois clientes buscando os mesmos parâmetros → o segundo apaga a busca e os resultados do primeiro (cascade).
- **`userId = 'anonymous'` compartilhado** quando `search_permission='all'` — latente, default hoje é `authorized`.

### Achados do checkup geral

**Saudável:** `tsc --noEmit` limpo; guards `requireAuth + requireAdmin` corretos em todas as rotas admin; categorias com fonte única real (a consolidação de abril se sustentou); graceful shutdown; tracking de custo por estágio.

**Configs mortas** (existem no schema, nada as lê): `scan_cron_schedule` (scheduler usa a env), `worker_concurrency`, `worker_max_per_minute`, `scan_lock_ttl_minutes`, `budget_warning_threshold`. As três primeiras estão na lista `restartRequired` do `settingsRoutes` — a mensagem "requer restart" é enganosa.

**Configs sem UI** (lidas pelo código, só editáveis no Supabase): `content_fetch_concurrency`, `monthly_budget_usd`, `push_enabled`, `search_permission`.

**Admin panel não verifica `is_admin`** em lugar nenhum do frontend. Usuário comum do app consegue logar na URL do admin e ver a casca do dashboard. Sem vazamento de dados (backend responde 403), mas ruim de confiança.

**Dependências:** `openai ^4.24.1` está duas majors atrás (v6) — relevante porque as versões novas tratam timeout/retry melhor. Express 4→5, eslint 8→9. Flutter com `fl_chart` 0.70→1.x, `share_plus` 10→12, `flutter_map` 7→8, `sentry_flutter` 8→9. Admin panel está em dia.

### ARQUITETURA.md corrigido

Estava factualmente errado em pontos concretos: dizia **Brave** como provider principal (é Bright Data), CRON **de hora em hora** (é a cada 5 min via env), `filter2_max_content_chars` **4000** (é 8000). Faltavam por completo os serviços `executive`, `geocoding`, `billingScheduler` e `rateLimiter`. Corrigido in-place + adicionado bloco de performance da busca manual e lista de configs mortas.

### Investigação ao vivo — o diagnóstico mudou duas vezes

Com a chave do `.env`, testei a Bright Data direto. O que os dados mostraram:

**Produção está viva.** Health com uptime de 27 dias, Redis e banco OK. Notícias do auto-scan entrando hoje (17:00, 15:01, 09:01). Não é infra caída.

**O Top 100 (Dataset API) quebrou entre 21 e 30/07.** Histórico de snapshots da conta: 17-70s até 21/07, e o meu de 30/07 passou de **500s sem concluir**. Como o código espera 180s, tenta de novo e espera mais 180s, cada cidade gastava ~6 min de espera morta.

**A query do modo web nunca funcionou.** Testado contra a SERP: `allintext:"Florianópolis" (ocorrência OR crime OR ...)` devolve `results_cnt: 0` do Google. A forma simples `notícias policiais ocorrências crime Florianópolis Santa Catarina` devolveu **137 resultados / 27 links em 14s**. O ramo web era peso morto mesmo quando o Top 100 estava rápido.

**Buscas reais dos usuários confirmam:** São Paulo, Rio, Salvador, Curitiba, Porto Alegre e Brasília — todas `completed` com **0 resultados** em 30 dias. Guarujá 5, Santos 1. Nenhuma busca desde 21/07 (o cliente desistiu). **Nenhuma busca presa em `processing`** — o bug do 409 eterno não está afetando ninguém hoje, sai da urgência.

**O achado que mais importa — falha silenciosa.** Depois de ~20 requests meus, tudo passou a voltar vazio. Achei que fosse quota; era o **IP do João (`177.99.58.0/24`) na lista de bloqueio da própria zone** — eu tinha visto esse campo na config da zone e descartado, erro meu. O modo de falha é o perigoso: a Bright Data responde **HTTP 200, corpo vazio, erro só no header `x-brd-err-code`**. O código via `response.ok` verdadeiro, `JSON.parse('')` estourava, caía no `break`, e a busca **concluía com 0 resultados sem erro nenhum**. Foi isso que mascarou o problema todo esse tempo.

### Código alterado (aprovado pelo João)

**O Top 100 foi mantido — descoberta a partir de pushback do João.** Ele questionou a remoção ("ele serve pra trazer quantidade alta de notícias locais") e mandou print do painel Bright Data. Na tela aparecia **"Escolha o modo de raspagem → Síncrono (Em tempo real)"** e, no code example, `datasets/v3/**scrape**`. O código usava `datasets/v3/**trigger**` — o modo assíncrono, com snapshot + polling. **O scraper sempre teve modo síncrono e ninguém usava.**

Medição comparativa (mesma keyword, Florianópolis):

| Caminho | Tempo | Resultados |
|---|---|---|
| `trigger` + polling (código antigo) | >500s, nunca completou | — |
| SERP zone com `num=100` (minha 1ª substituição) | ~15s | 27 |
| **`scrape` síncrono** | **25-36s** | **98-100** |

João estava certo: o scraper rende ~4× mais. A substituição que eu tinha feito era uma perda real.

**`uule` + `tbs` se anulam.** Testado isoladamente: só `uule` → 97 resultados; só `tbs=qdr:m` → 100; **juntos → 1**. Além disso o `uule` sempre foi montado como texto simples (`"Cidade,Estado,Brazil"`) quando o Google espera formato codificado próprio — provavelmente vinha sendo ignorado. No modo web ficou só `tbs`; cidade e estado já vão na keyword.

`BrightDataSERPProvider.ts`:
- Novo `searchWebScrape` — modo web via `datasets/v3/scrape`, 1 request, ~100 orgânicos, **com `AbortSignal.timeout` de 120s** (antes não havia timeout nenhum).
- `searchNewsPaginated` → `searchSerpPaginated` (só news agora, `tbm=nws`, 20/página). `buildNewsUrl` → `buildSerpUrl`.
- `searchWebTop100` (assíncrono), `buildDateRange` e `DatasetResult` removidos — substituídos pelo caminho síncrono.
- **Checagem de `x-brd-err-code`**: agora lança em vez de retornar 0 silenciosamente.
- Log de resposta não-JSON subiu pra `error` e inclui o tamanho do corpo, pra distinguir "vazio" de "não achou" nos logs do Render.

`manualSearchWorker.ts`:
- Query web trocada de `allintext:` + grupo `OR` + `-site:` para keywords simples. Comentário no código avisa pra não reintroduzir operadores sem testar.
- `MANUAL_NEWS_MAX_RESULTS` extraído do `30` hardcoded.
- Cálculo de custo corrigido: os dois ramos agora paginam, então soma web + news (antes o web era 1 request de dataset e a conta subestimava).

`npx tsc --noEmit` passa limpo.

### Bloqueado

Não consigo validar a correção ponta a ponta: o IP do João está bloqueado na zone, então toda chamada local à Bright Data volta vazia. **João precisa remover `177.99.58.0/24` da Blocked IPs** em `brightdata.com/cp/zones/simeopss/access_params`. Depois disso, busca de teste em staging para gerar os logs de rejeição por stage — que é o que falta pra explicar por que o ramo *news* também rendia pouco.

### O índice orgânico do Google é bloqueado — e isso não tem conserto do nosso lado

Depois de restaurar o Top 100, medi repetidamente. O ramo web oscila absurdamente; o news não:

| Rodada | Web (scraper) | News (zone) |
|---|---|---|
| 1ª | 85 | 20 |
| 2ª | 10 | 20 |
| 3ª | 1 | 20 |

Requisição **idêntica** nas três (o `maxResults` só afeta o corte local, não o payload). João levantou a hipótese de ser o dedup do pipeline — testei e **descartei**: o JSON cru trazia 11 orgânicos, 11 com link, 11 únicos. Não há duplicata para remover. Também confirmei que não existe camada de cache no `createSearchProvider()`.

Testei então trocar o transporte, pela zone em modo orgânico: **1, 1, 27**. Igualmente errático. Na mesma query, o Google respondeu `results_cnt: 1` duas vezes e `61500` na terceira.

**Conclusão (corrigindo palavra minha):** não é "instabilidade". João rejeitou esse termo com razão — o Google não é uma empresa que oscila por acaso. É **detecção de robô deliberada**: ele identifica tráfego raspado no índice orgânico e devolve página vazia sem erro. O índice orgânico é o dado mais raspado da internet (toda ferramenta de SEO do planeta), então é o que ele mais defende. O índice de notícias não tem essa indústria em cima e passa limpo.

Isso independe do transporte — scraper ou zone, mesma coisa. **Não é problema que a gente resolva codando**; é o serviço que a Bright Data vende, e no orgânico eles entregam mal.

**Decisão:** ramo web fica como **bônus, sem retry**. O news carrega o piso (~20/cidade, previsível).

### Retry: descartado, e o motivo bom

Cheguei a propor retry por contagem baixa. João barrou. Meu argumento inicial ("repetir reforça o bloqueio") era **fraco** — a Bright Data rotaciona IP e identidade a cada request, então a segunda tentativa parece outro usuário.

O motivo real é outro: **não dá para saber quando disparar**. Retry por contagem exige responder "quantos são poucos?", e isso varia radicalmente por cidade — Florianópolis ~26/mês, Santos 1, Águas da Prata 1. Gatilho apertado dispara sempre em cidade pequena e queima dinheiro reconfirmando resultado correto; gatilho frouxo não dispara quando precisa. **É chute com custo por tentativa.**

Regra que fica: **repetir sobre sinal explícito, nunca sobre suspeita.** É o caso do `x-brd-err-code` implementado hoje — ali a Bright Data diz que recusou, e o BullMQ reprocessa.

### O teto do produto é a matéria-prima, não o código

Testei a profundidade real do índice de notícias (Florianópolis, 30 dias), paginando:

| start | resultados |
|---|---|
| 0 | 13 |
| 20 | 13 |
| 40 | **4** |
| 60 | **4** |
| 80 | **4** |

Seca depois de ~26 (os "4" repetidos são links de navegação, não notícia). O sistema já captura 20 deles. **Aumentar o teto renderia meia dúzia e depois nada.**

Ou seja: uma capital de 500 mil habitantes tem ~26 notícias policiais publicadas por mês. Cidade pequena tem 1 a 5 — confirmado pelas buscas reais (Guarujá 5, Santos 1, Águas da Prata 1).

Implicação de produto: o SIMEops não entrega "a criminalidade da cidade", entrega **"o que a imprensa publicou sobre criminalidade na cidade"**. Se o cliente espera a primeira, vai achar o sistema fraco por um motivo que não é do sistema. Vale alinhar isso comercialmente.

Achado adjacente: o auto-scan usa **Google News RSS** como segunda fonte; a busca manual **não usa**. É código pronto e de graça — mas bebe do mesmo índice do `tbm=nws`, então o ganho é marginal, não dobra nada.

### Redesenho do teto de custo (aprovado pelo João)

O teto (`manual_search_max_results_*`) cortava no stage 1, **antes de qualquer filtro**: ficavam os N primeiros pela ordem do Google e o resto ia fora sem ninguém avaliar relevância.

Custo medido por URL: Filter0 $0, Filter1 ~$0.0000067, **Jina ~$0.002**, **Filter2 ~$0.0005**. As etapas caras custam **~370×** as baratas — cortar antes das baratas descartava dado de graça e escolhia mal.

Agora: ramo web pede tudo (o scraper cobra igual trazendo 20 ou 100), ramo news mantém o teto (lá o número controla páginas de verdade), e **o corte acontece depois do Filter1**, na fronteira do caro. Ganho colateral: o custo virou **previsível** — o número que chega ao Jina é exatamente o teto, não um resultado incerto das taxas de rejeição.

`profundidade` **removido** de ponta a ponta (schema, rota, worker). João já tinha tirado da UI; multiplicava o teto e o app nunca enviava. Motivo dele: *"dá muita opção pro usuário e ele pode travar. É óbvio que ele vai querer o máximo de notícias dentro daquele período e local."*

### O merge revelou trabalho perdido — e uma medição minha estava errada

Ao levar `develop` para `staging`, deu conflito. Motivo: **o staging tinha um commit que nunca voltou para o develop** — `cf9c862`, de **22/07**, de uma sessão anterior (Claude Fable 5). Eu trabalhei a sessão inteira em cima de código desatualizado, sem saber que ele existia.

O que aquele commit corrigiu, e que eu teria regredido se tivesse feito merge no automático:

- **`brd_json=1` obrigatório** na URL do News. Sem ele, `/request` com `format=raw` devolve **HTML bruto**, o `JSON.parse` falha e a busca conclui com 0 resultados em silêncio. (Aqui não quebrou nos meus testes porque a zone está com `data_format: parsed`, que resolve no nível do provedor — mas depender disso é frágil.)
- **`num` deprecado pelo Google (set/2025)**: só ~10 resultados por página. A paginação tem que usar `start` de 10 em 10.
- **`uule` de texto puro removido** — o Google exige base64 canônico, texto cru era ignorado. Cheguei à mesma conclusão hoje por outro caminho (medindo `uule`+`tbs` juntos derrubando de ~100 para 1). Duas confirmações independentes.
- **Sentry capture quando a página 1 vem non-JSON.**

**Correção de uma afirmação minha.** Eu disse ao João que "o teto é a matéria-prima, aumentar a config não adianta". A conclusão qualitativa se sustenta, mas **o número estava errado**: medi paginando `start = 0, 20, 40...`, exatamente reproduzindo o bug de paginação. Ou seja, amostrei as posições 0-9, 20-29, 40-49 e **pulei 10-19 e 30-39**.

Refeito com paginação correta (Florianópolis, 30 dias):

| start | itens | inéditos |
|---|---|---|
| 0 | 10 | 10 |
| 10 | 10 | **10** |
| 20 | 10 | 10 |
| 30 | 1 | 1 |
| 40+ | 0 | 0 |

**31 notícias únicas**, não ~26. E o mais importante: **produção pega só 20 delas** — está perdendo um terço por causa da paginação errada.

**Produção (`main`) não tem o fix de 22/07.** Conferido: `main` está sem `brd_json`, com `perPage = 20` e com o `uule` inútil. A correção ficou parada no staging desde 22/07 a pedido do João (queria testar via Render antes de propagar) e nunca subiu.

Resolução do merge: mantidos os quatro fixes do staging no ramo **news** + todo o trabalho de hoje no ramo **web** e no pipeline. São complementares — cada um mexe num ramo diferente.

### Ainda em aberto (não codado)

**Propagar para `main`.** Produção está sem o fix de 22/07 e sem o de hoje. É o deploy que mais vale agora.

Paralelizar o Filter2 com `asyncPool` (agravante real, ~5× mais rápido — e mais relevante agora que o ramo web voltou a trazer volume), TTL na busca fantasma, try/catch no enqueue, `.eq('user_id')` no delete por hash.

Achados da sessão de 22/07 que continuam abertos (ver entrada daquele dia): post-filter de estado rejeitando sigla UF, ownership ausente em status/results/cancel, scan-lock TTL nunca liberado, `.or()` do dedup quebrando com vírgula no bairro.

Fontes alternativas (Bing, portais oficiais de SSP/PM) foram levantadas mas **João informou que já testou todas** — não repetir sem falar com ele antes.
---

## 2026-07-22 (fix busca — Bright Data News retornava 0 resultados)

Sessão de análise de qualidade + diagnóstico de "busca não funciona". Bright Data é o único provedor ativo (Brave/Perplexity só desativados via env, código mantido).

### Causa raiz: `brd_json=1` ausente no modo News

`BrightDataSERPProvider.buildNewsUrl()` montava a URL do Google sem `brd_json=1`. Pela doc oficial do Bright Data, `/request` com `format: 'raw'` devolve o **HTML bruto** da SERP — o JSON estruturado só vem com `brd_json=1` na URL. Efeito: `JSON.parse` falhava, log `non-JSON`, `break`, **0 resultados silenciosos** em todo scan e na fonte News da busca manual (que ficava só com o Web Top100).

### Fixes aplicados (cirúrgicos, só no provider + env example)

1. `brd_json: '1'` adicionado aos params do `buildNewsUrl`.
2. Paginação News: `num=20` removido (Google deprecou `num` em set/2025), `perPage` 20→10 com `start` em incrementos de 10 (doc Bright Data). Antes pulava os resultados 10-19 de cada página.
3. `uule` texto puro removido — Google exige encoding canônico (base64), valor raw era ignorado. `gl=br` + cidade na query cobrem a segmentação.
4. `Sentry.captureException` quando página 1 vem non-JSON — provider quebrado nunca mais falha em silêncio.
5. `.env.example`: `SEARCH_BACKEND=brave` → `brightdata` + `BRIGHTDATA_API_KEY`/`BRIGHTDATA_ZONE` documentados (quem montasse env novo pelo example ativava Brave sem key).

### Validação

- `npx tsc --noEmit` limpo.
- `npm test`: 31 falhas **pré-existentes** (testes de filter0/queryTemplates/etc. esperam keywords antigas removidas de propósito; `deduplication.test.ts` tem erro de tipo). Nenhuma relacionada ao fix. Atualizar esses testes é dívida pra próxima sessão.
- Verificação real pendente (precisa de credencial): conferir logs do Render por `[BrightData:News] ... non-JSON` e testar busca manual em staging pelo APK.

### Achados da análise de qualidade (backlog, não corrigidos nesta sessão)

- **Crítico**: `createSearchCache` deleta busca de OUTRO usuário no conflito de `params_hash` (delete sem `.eq('user_id')`).
- **Crítico**: post-filter de estado no pipelineCore rejeita sigla UF ("SC" vs "Santa Catarina") — reusar `STATE_NAME_TO_UF`.
- Médios: ownership ausente em status/results/cancel da busca manual; custo da busca manual superestimado ~67% (`lastRequestCount` não usado); scan-lock TTL 30min nunca liberado; `.or()` do dedup quebra com vírgula no bairro; templates multi-query em estilo Perplexity rendem mal em Google SERP.
- Menores: CLAUDE.md seção 4 com paths desatualizados; `data_ocorrencia` guarda data de publicação (regra do prompt Filter2); dead code `ApiService.searchNews()`; comentário contradiz código no filter0.

Commit **somente em `staging`** (pedido do João, pra testar via Render antes de propagar).

---

## 2026-04-18 (sessão 2 — refino cirúrgico em tudo)

Sessão focada em fechar dívida técnica acumulada + refino do fluxo de relatório + economia de custo. Ordem do atacado:

### Fix Executive em busca manual

Bug: na busca manual, `ExecutiveIndicators` nunca renderizava mesmo com estatísticas. Causa: endpoint `GET /analytics/executive` puxa estatísticas de `news` via `getCrimeSummary`, ignorando `search_results`. Fix cirúrgico: novo endpoint `POST /analytics/executive/from-stats` que aceita estatísticas já filtradas no client (`report_screen` já tem em memória via `_computeAnalytics`). Sem cache (one-shot). Dashboard mantém GET cacheado.

### Rua no mapa (radar visual por precisão)

Backend já persistia `precisao: 'rua'|'bairro'|'cidade'` no CrimePoint, Flutter só usava pra jitter. Agora também destaca visualmente: rua = raio 5.5 + glow 14 + borda branca 1.2 + alpha cheio. Bairro = atual. Cidade = raio 3 + alpha 0.6 + glow difuso (sinaliza baixa confiança). Aplicado tanto no mobile `crime_radar_map.dart` quanto no novo widget web.

### Dívida técnica — duplicações eliminadas

- **`news_card.dart`**: removidos `_grupoCores`/`_grupoLabels` (24 linhas) — agora usa `category_colors.dart` como fonte única.
- **`crime-pie-chart.tsx`**: removido `TIPO_TO_CATEGORY` duplicado (tinha `receptacao: 'fraude'` desatualizado — reclassificamos pra `patrimonial` ontem). Componente agora exige `byCategory` do backend; se vier vazio mostra empty state. Também corrigido `CrimeSummary` type que não declarava `byCategory` (backend mandava, admin ignorava).

### Janela de operação do auto-scan (config no admin)

6 configs novas em `system_config`: `scan_weekday_start/end`, `scan_weekend_enabled/start/end`, `scan_period_days`. Defaults: seg-sex 6h-18h, sáb-dom OFF, período 4 dias. `cronScheduler` usa TZ `America/Sao_Paulo` (Render é UTC) — fora da janela, pula o tick inteiro, nada enfileira. `scanPipeline` lê `scan_period_days` (antes hardcoded 2). UI nova em Settings → Auto-Scan com 2 inputs de hora seg-sex, switch master + 2 inputs sáb-dom, input período.

**Economia estimada**: 168h/semana → 60h/semana ativo = **~64% menos custo** Bright Data + Jina + OpenAI recorrente.

### Filter0 refinado — tirando keywords que causavam falso negativo

Keywords do `filter0Regex` faziam substring match sem contexto. Removidas 11 problemáticas: `futebol`, `receita`, `cinema`, `música`, `jogo`, `filme`, `esporte`, `campeonato`, `tempo`, `bolsa`, `dólar`. Batiam em casos reais: "Receita Federal apreende 50kg", "torcedor morto no estádio", "US$500 mil levados", "jogo do bicho", "roubaram a bolsa". Mantidas só as inequívocas: `novela`, `horóscopo`, `fofoca`, `celebridade`, `entretenimento`, `previsão do tempo` (com contexto explícito), `cotação`. Trade-off: +10-15% snippets vão pro Filter1, mas Filter1 sabe discernir com contexto.

### Filter1 em pt-BR + few-shot

Prompt antes em inglês analisando texto em português. Novo prompt em pt-BR com 7 exemplos cobrindo casos de borda (torcedor morto = true, Receita apreende drogas = true, jogo do bicho = true, assalto em show = true, jogo de futebol puro = false, concurso da Receita = false, horóscopo = false). Regra explícita: crime em ambiente de entretenimento/esporte CONTA. Mesmo tratamento no `filter1Single`. Aceita `SIM` ou `YES` (robustez).

### UX: ícone de compartilhar no AppBar (em vez de CTA button)

Padronização entre `city_detail` (auto-scan) e `report_screen` (busca manual). Antes: botão `ElevatedButton teal` inline vs `FilledButton green Rajdhani uppercase` fixo no bottom. Agora: **ícone `Icons.share` no AppBar em ambas**, com loading spinner, tooltip "Compartilhar relatório". Share é ação secundária — não precisava de CTA berrante. Stack/Positioned removido, layout mais limpo.

### Relatório público — paridade com in-app + identidade SIMEops

Público estava bem atrás: renderizava só resumo, donut, heatmap legado, bairros, trend, fontes. Faltava Executive, mapa novo, e visual era genérico (Shield lucide, azul).

**Parity de conteúdo:**
- `<ExecutiveSection>`: cards de indicadores coloridos por sentido (positivo/negativo/neutro) + resumo_complementar + fontes consolidadas. Light theme espelhando `ExecutiveIndicators` do Flutter.
- `<CrimeRadarMap>`: substitui `<ReportHeatMap>`. Tiles CartoDB light, pontos coloridos por categoria, chips de filtro (toggle independente), precisão rua/bairro/cidade diferenciada igual ao mobile.
- Types `ReportData` atualizados com `executive` e `mapPoints`.

**Identidade visual:**
- Logo oficial PROGESTÃO/SIMEops (copiado `mobile-app/assets/images/logo.png` → `admin-panel/public/logo.png`) substituiu Shield genérico no header
- Subtítulo "PROGESTÃO · Monitoramento de Ocorrências"
- Footer: "Gerado por PROGESTÃO TECNOLOGIA - SIMEops" (antes tinha "Sistema de Monitoramento de Ocorrências Policiais")
- Cores azul-600 → teal-600 SIMEops em botão, loader, barras

### Fix PDF

Causa do "Baixar PDF" travar em "Gerando..." eternamente: tiles OpenStreetMap sem `crossOrigin="anonymous"` marcavam o canvas como tainted → `toDataURL()` do html2canvas lançava `SecurityError` silencioso. `allowTaint: true` default mascarava.

Fix:
- Migrado pra tiles CartoDB que têm CORS confirmado (`basemaps.cartocdn.com` manda `Access-Control-Allow-Origin: *`)
- `crossOrigin="anonymous"` no TileLayer
- `allowTaint: false` no html2canvas → falha ALTO se outra coisa quebrar, não silencioso
- `alert()` visível no catch — user vê o erro
- `ignoreElements` via atributo `data-pdf-hide` como fallback pra widgets futuros problemáticos

---

## 2026-04-18 (sessão 1 — manhã)

### Executive Section — resumo + indicadores visuais via GPT

Conceito nasceu da conversa "o relatório é 6/10, como subir pra profissa". Depois de pivotar algumas vezes (resumo geral era chato de manter em auto-scan), chegamos em: **cards visuais de indicadores (percentuais, absolutos, monetários)** no topo do relatório + **parágrafo curto** com o que não couber em card + fontes consolidadas.

**Input:** estatísticas do período (notícias `natureza='estatistica'` — dados oficiais tipo "Ceará reduziu 31,6% mortes em janeiro"). GPT classifica cada uma: vira card se tem número autoexplicativo, vira texto narrativo caso contrário.

**Output estruturado** em [executive/index.ts](../backend/src/services/executive/index.ts):
```json
{
  "indicadores": [{ "valor": -31.6, "unidade": "%", "tipo": "percentual",
                    "sentido": "positivo", "label": "Mortes violentas",
                    "contexto": "CE/Jan 2026", "fonte": "ceara.gov.br" }],
  "resumo_complementar": "Destaque também para...",
  "fontes": ["ceara.gov.br", "sspds.ce.gov.br"]
}
```

**Cache inteligente** ([migration 021](./SQL/migrations/021_executive_cache.sql)):
- Tabela `executive_cache (cidade, estado, range_days, data, expires_at)`
- Invalidação por evento: `scanPipeline` dispara `invalidateExecutiveCacheByCity` quando salva estatística nova
- TTL 24h como fallback pra capturar saída de estatísticas antigas pela janela móvel
- Dashboard dá cache hit instantâneo na maioria dos acessos

**Custo rastreado no billing** ([trackCost](../backend/src/database/queries.ts)) com `details.stage='executive'`, `source='auto_scan'` ou `'manual_search'`. Aparece no painel admin distinguível dos outros custos OpenAI.

**Flutter:**
- [executive_data.dart](../mobile-app/lib/core/models/executive_data.dart): modelo
- [executive_indicators.dart](../mobile-app/lib/core/widgets/executive_indicators.dart): widget com cards scrolláveis (cor por `sentido`: verde positivo, vermelho negativo), seta pra percentuais, formatação monetário/absoluto, resumo + fontes
- Renderiza condicionalmente (se `isEmpty`, seção inteira some)
- Integrado em [city_detail_screen](../mobile-app/lib/features/dashboard/screens/city_detail_screen.dart) e [report_screen](../mobile-app/lib/features/search/screens/report_screen.dart), antes do resumo numérico

**Endpoints:**
- `GET /analytics/executive?cidade=X&estado=Y&rangeDays=30` (dashboard, cacheado)
- `POST /analytics/report` agora embute `executive` no `reportData` (busca manual, snapshot)

**Decisões descartadas na conversa:**
- Resumo executivo geral (texto único sobre todo o relatório) — chato de manter em auto-scan, dado muda a toda hora
- Só percentuais como cards — perde indicadores tipo "47 presos", "R$ 4,2 Mi apreendidos"
- Incluir estatísticas em período em cards separados por data — cortado pro prompt agrupar por métrica + período (agrupa mesmo assunto no mesmo período mesclando fontes, mantém períodos diferentes separados).

**Anti-hallucination:** prompt com 3 regras hard: "use APENAS números explícitos nos resumos", "nunca invente/estime/extrapole", "agrupe mesma métrica-mesmo período mesclando fontes". Fail-open: se GPT falhar, retorna vazio em vez de quebrar o relatório.

**Temperature deprecation check:** João levantou que "temperature não é mais aceito". Confirmei via docs: GPT-5 family e reasoning models (o1/o3) rejeitam, mas gpt-4o-mini (que usamos) ainda aceita. Anotado como backlog pra quando migrar de modelo.

### Dashboard card — remoção da sigla UF duplicada + UF do grupo

**Problema** (screenshot João): card de cidade individual mostrava sigla UF (`SP`) no header E nome do estado inteiro (`São Paulo`) no footer = duplicação. Pior: badge "NOVA" empurrava a sigla pro lado (layout instável). Grupo (Grande Florianópolis) não exibia estado em lugar nenhum.

**Reorganização** ([city_card.dart](../mobile-app/lib/features/dashboard/widgets/city_card.dart)): removida a sigla UF do header. Footer agora tem regra única:
- Cidade individual → `{Estado}` (como antes)
- Grupo UF única → `{Estado} · N cidades` (evita overflow da lista de nomes)
- Grupo multi-UF → `N estados · M cidades`
- NOVA não conflita mais com UF (UF saiu)

**Backend** ([analyticsQueries.ts](../backend/src/database/analyticsQueries.ts)): grupo passou a calcular `parentState` (quando todas cidades da mesma UF) + `stateCount`. Join no `monitored_locations` expandido pra pegar `parent_id` junto com `name`.

**Mobile model** ([city_overview.dart](../mobile-app/lib/core/models/city_overview.dart)): novo campo `stateCount`.

### Consolidação do mapa — CrimePoint + radar (single source of truth)

**Motivação do João:** "arrumar mapa em um lugar ia me obrigar a arrumar no outro tbm" — dashboard (city_detail) e busca manual (report_screen) **duplicavam inteira a lógica de geocode client-side** (~150 linhas cada), cada um com cache, fallback e jitter próprios.

**Discussão (tréplica):** considerei consolidar o relatório INTEIRO (CityReport), mas trouxe contraproposta — consolidar só o mapa agora (5h, baixo risco) + regra de "toda feature nova de relatório = widget compartilhado" pra não criar dívida nova. João aceitou.

**Implementação:**

Backend:
- Tipo `CrimePoint` em [types.ts](../backend/src/utils/types.ts) com campos `lat/lng/categoria/tipo_crime/data/bairro/rua/precisao`
- `geocodePoint(rua?, bairro?, cidade, estado)` em [nominatim.ts](../backend/src/services/geocoding/nominatim.ts) — fallback hierárquico rua → bairro → cidade, retorna `precisao` indicando o nível ancorado
- `getMapPointsRaw(cidade, dateFrom, dateTo)` + `getSearchMapPointsRaw(searchId)` — puxam notícias individuais (não agregadas)
- Novo endpoint `POST /analytics/map-points` leve pra dashboard E busca manual (escolhe source pelo `searchId` opcional)
- Helper `buildMapPoints` reutilizável no `/analytics/report` e no novo endpoint

Mobile:
- [crime_point.dart](../mobile-app/lib/core/models/crime_point.dart) — modelo espelhado
- [category_colors.dart](../mobile-app/lib/core/utils/category_colors.dart) — **single source** de cor/label por categoria (substitui `_grupoCores`/`_grupoLabels` que vivia em `news_card.dart`; o news_card fica com mapa próprio por ora, consolidação dele vira commit separado)
- [crime_radar_map.dart](../mobile-app/lib/core/widgets/crime_radar_map.dart) — widget compartilhado:
  - Pontinhos brilhantes individuais (glow halo + ponto sólido), cor por categoria
  - Chips de filtro por categoria embutidos (toggle independente)
  - Jitter determinístico (seed = id) quando `precisao != 'rua'` — preserva precisão onde tem, espalha onde não tem
- `ApiService.getMapPoints()` novo método POST
- `city_detail_screen` e `report_screen` perderam ~300 linhas combinadas (geocode, cache, `_HeatPoint`) — usam `CrimeRadarMap(points: ...)` direto

**Descoberta inesperada:** o `heatmapData` que o backend já gerava no `/analytics/report` era **ignorado pelo Flutter** — as 2 telas geocodavam por conta própria via Nominatim. Migração agora centraliza geocode no servidor (onde deve ficar) e elimina requests diretos do client pro OSM.

### Busca manual — remoção do filtro de palavra-chave

**Argumento do João:** "de qualquer forma vai buscar tudo, filtrar por palavra-chave só gasta recurso — se usuário quiser, filtra dentro do relatório". Removido toggle + input + state + param da chamada API. Backend continua aceitando `tipoCrime` opcional (sem breaking change), só não é mais enviado.

Arquivo: [manual_search_screen.dart](../mobile-app/lib/features/search/screens/manual_search_screen.dart) — removidas ~95 linhas do UI opcional + `_useKeyword`/`_keywordCtrl` do state.

### Sentry — mobile + admin (prod-only)

**Motivação:** crashes no device e erros server-side do admin hoje são invisíveis. Backend já tinha Sentry condicional; mobile e admin não tinham SDK.

**Estratégia prod-only:** SDK instalado em 3 lugares, **inicialização condicional** — só liga se DSN setada. Render injeta DSN só em prod → zero envio em dev/staging → quota da conta Sentry Team ($29) preservada.

**Mobile:**
- `sentry_flutter ^8.13.0` no pubspec
- [env.dart](../mobile-app/lib/core/config/env.dart) ganhou `sentryDsn` + `environment` via `dart-define`
- [main.dart](../mobile-app/lib/main.dart) — `SentryFlutter.init` só se `Env.sentryDsn.isNotEmpty`, senão `runApp` direto
- Arquivos `env/dev.json`, `env/staging.json`, `env/prod.json` (+ `prod.json.example`) com URLs + DSN por ambiente
- `prod.json` **gitignored** (contém DSN)
- Scripts Windows: `run-dev.bat`, `build-staging.bat`, `build-prod.bat` usando `--dart-define-from-file`

**Admin:**
- `@sentry/nextjs ^10.49.0`
- [sentry.server.config.ts](../admin-panel/sentry.server.config.ts) + [sentry.edge.config.ts](../admin-panel/sentry.edge.config.ts) + [instrumentation.ts](../admin-panel/instrumentation.ts) + [instrumentation-client.ts](../admin-panel/instrumentation-client.ts) — todos condicionais por DSN
- `next.config.ts` envolvido em `withSentryConfig` (org `joao-mw`, project `simeops-admin`)
- Build local OK (`npm run build` sem DSN = runtime SDK inativo, build normal)

**Projetos criados no Sentry** (org `joao-mw`):
- `simeops-flutter` (Flutter, Mobile) — DSN preenchida em `env/prod.json`
- `simeops-backend` (Node/Express, Backend) — DSN setada no env do Render prod
- `simeops-admin` (Next.js, Frontend) — criar quando for usar (config já pronta)

**Render — limpeza de quota:**
- Backend staging: `SENTRY_DSN` removida (evita queimar quota em bugs conhecidos de dev)
- Backend prod: `SENTRY_DSN` setada
- Admin: idem (staging vazio, prod com DSN quando criar o projeto Sentry)

**CLAUDE.md atualizado** com comandos novos pro mobile build.

**Primeira configuração Sentry-em-tudo feita junto com João** (ele criou os projetos no site; eu fiz os arquivos/configs locais).

---

## 2026-04-17

### Fix dedup — embedding enriched com metadata

**Sintoma:** depois do fix do feed, João viu que dedup não estava agrupando notícias. Screenshot mostrou 4 cards para o MESMO homicídio em Florianópolis (Armação do Pântano do Sul, 17/04, vítima Marcos A.S., autor irmão preso, testemunha mãe). Deveria ter virado 1 card com várias fontes.

**Diagnóstico:** script novo [`test-dedup-similarity.ts`](../backend/scripts/test-dedup-similarity.ts) mediu cosine similarity entre os 4 resumos:

| Par | Score RAW | @0.85 |
|---|---|---|
| R1 (encomenda/foragido) vs R2 (Marcos/irmão preso) | 0.77 | separou |
| R1 vs R3 (local/horário) | 0.63 | separou |
| R1 vs R4 (frente da mãe/discussão) | 0.69 | separou |
| R2 vs R3 | 0.64 | separou |
| R2 vs R4 | 0.68 | separou |
| R3 vs R4 | 0.74 | separou |

**Nenhum par alcançou 0.85.** O threshold era inatingível pra variação editorial típica de cobertura jornalística — veículos diferentes focam ângulos diferentes (vítima/autor/local/testemunha), embedding cru não consegue ancorar.

**Fix:** prefixar o texto com metadata estrutural antes de gerar embedding:

```
"homicidio Florianópolis Armação do Pântano do Sul 2026-04-17
 Um homem foi morto a pauladas em Florianópolis..."
```

**Resultado no teste:** scores subiram +0.15 média (0.63-0.77 → **0.82-0.90**). Todos os 6 pares passam @0.80.

**Implementação:**
- [pipelineCore.ts](../backend/src/jobs/pipeline/pipelineCore.ts) — nova função `buildEmbeddingText()` exportada. Stage 4 usa antes de chamar embedding provider.
- [scripts/reembed-all-news.ts](../backend/scripts/reembed-all-news.ts) — migra embeddings das notícias existentes pro novo formato. Auto-contido (dotenv + supabase + openai). Dry-run por padrão, `--apply` pra executar.
- Script executado em prod 2026-04-17: 24/24 notícias atualizadas, 0 falhas, custo real $0.00004.

**Pendências pelo João:**
- Admin panel: mudar `dedup_similarity_threshold` de 0.85 pra 0.80 (sweet spot testado).
- Reset do banco (migration 010_reset_data) pra testar do zero — decisão do João ao ver que os 4 cards antigos não mergeiam retroativamente com só o re-embed.
- Deploy prod (merge staging → main) quando testar staging ok.

**Arquivos alterados:**
- `backend/src/jobs/pipeline/pipelineCore.ts`
- `backend/scripts/reembed-all-news.ts` (novo)
- `backend/scripts/test-dedup-similarity.ts` (novo)

**Typecheck:** limpo. **Commit `ba6c5dd`**, pushed para develop + staging.

---

### Bug de mistura de cidades persistindo — ACHADO e fix em 1 linha

**Sintoma:** mesmo depois do combo de cidades de ontem, ao clicar em "Porto Alegre" no dashboard, feed aparecia só notícias de SP e MS (cidades homônimas? não). Relatório da mesma cidade funcionava certo.

**Investigação:**
1. João confirmou que banco tem notícias de Porto Alegre e relatório contabiliza certo.
2. Auditoria SQL completa (queries + colunas + migrations): schema OK, todos filtros `.eq('cidade', ...)` corretos. **Zero divergência** entre código e banco.
3. Diferença crítica encontrada entre relatório (funciona) e feed (não funciona): o middleware `validateQuery` em [validation.ts:37-54](../backend/src/middleware/validation.ts).

**Causa raiz:**

```ts
// middleware validation.ts
req.query = result.data;  // Zod sem passthrough STRIPA campos nao declarados
```

O schema `pagination` declarava só `offset` e `limit`. Ao validar `/news/feed?cidade=Porto+Alegre&limit=20`, Zod mantinha só `{offset, limit}`. O `req.query = result.data` substituía a query inteira, e o handler lia `req.query.cidade` → **undefined**. Backend chamava `getNewsFeed` sem filtro de cidade → retornava 20 notícias aleatórias de qualquer cidade.

**Por que o relatório funcionava:** `analyticsQuery` schema TEM `cidade`, passa pelo Zod. `analyticsTrend` TEM `cidade` também. Tudo que lê `cidade` via query e tem no schema — funciona.

**Por que passou despercebido até agora:** por bom tempo o sistema só tinha Florianópolis/grupo dela cadastrado. Sem filtro, o feed retornava tudo — mas tudo era Florianópolis mesmo, então parecia filtrar. Com Porto Alegre + SP + MS + outras cadastradas, mistura virou visível.

**Fix:**

Novo schema `feedQuery` em [validation.ts](../backend/src/middleware/validation.ts) com `cidade`/`cidades`/`estado` opcionais + paginação. Trocado `validateQuery(schemas.pagination)` → `validateQuery(schemas.feedQuery)` em 3 rotas de [newsRoutes.ts](../backend/src/routes/newsRoutes.ts): `/news`, `/news/feed`, `/news/favorites`.

**Auditoria dos outros `validateQuery` do projeto:** tudo OK. Analytics schemas já tinham `cidade` declarado. Bug era exclusivo do `pagination` reusado em rotas que leem filtros extras.

**Arquivos alterados:**
- `backend/src/middleware/validation.ts` (novo schema)
- `backend/src/routes/newsRoutes.ts` (3 rotas atualizadas)

**Typecheck:** limpo.

**Validação pendente:** deploy staging + abrir APK (já buildado ontem apontando pra staging) + clicar em Porto Alegre → deve mostrar só Porto Alegre.

**Lição:** Zod `safeParse` sem `.passthrough()` é destrutivo. Schema precisa listar TODOS os campos que o handler vai ler. `req.query = result.data` depois é double-edged — garante tipos mas mata qualquer coisa não declarada.

---

## 2026-04-16

### Início da Fase 2 — Refino do workflow de colaboração

**Contexto:** Primeira sessão com Claude Opus 4.7 (migração do Opus 4.6 após atualização). João aproveitou a troca de modelo pra **refinar o workflow de vibe coding** antes de seguir pros bugs pendentes.

**O que mudou no jeito de trabalhar:**
- Relação firmada como **sócio, não funcionário** — Claude deve questionar, discordar, trazer opinião técnica, não só executar.
- **Pró-atividade obrigatória** — reportar achados inesperados na hora, sem esperar pedido.
- **Zero agentes de code review/auditoria** — investigação manual com Grep+Read, findings discutidos antes de mexer.
- **Falar de si mesmo** — se prompt for ruim ou task não casar com forças do modelo, avisar antes de executar. Autorizado consultar doc da Anthropic sobre o próprio modelo (Opus 4.7).
- **Fim de sessão disciplinado** — Claude revisa ROADMAP + ARQUITETURA + confirma DEV_LOG antes de fechar.

**Reorganização do workdesk:**
- Tudo que era Fase 1-6 (sub-fases até produção) movido pra dentro de `workdesk/Fases/` — vira histórico.
- `workdesk/` raiz agora tem 3 arquivos ativos: `DEV_LOG.md` (este), `ROADMAP.md`, `ARQUITETURA.md`.
- Novo `workdesk/WORKFLOW.md` criado como constituição da colaboração.
- SQL mantido como estava.

**Novos artefatos criados:**
- [workdesk/WORKFLOW.md](./WORKFLOW.md) — constituição da Fase 2 em diante.
- [CLAUDE.md](../CLAUDE.md) na raiz do projeto — regras operacionais lidas automaticamente toda sessão.
- [workdesk/DEV_LOG.md](./DEV_LOG.md) e [workdesk/ROADMAP.md](./ROADMAP.md) — nova cadência iniciada.

**Memórias pessoais do Claude atualizadas:**
- `feedback_partner_relationship.md` — sócio, pró-atividade, sem code review agent.
- `feedback_self_awareness.md` — avisar prompts ruins, pesquisar doc Anthropic se útil.

**Decisão descartada:** consolidar todas as Fases 1-6 num único DEV_LOG histórico. ROI baixo, tempo alto. Mantido como arquivo separado.

**Nenhuma mudança de código neste turno** — só organização de workdesk e acordos de colaboração.

---

### Bug: mistura de cidades homônimas no dashboard — FIX aplicado

**Sintoma relatado:** no dashboard, notícias de uma cidade apareciam no card de outra (user viu grupos "Grande Florianópolis" misturando com "São Paulo").

**Investigação** (leitura manual do pipeline, sem agentes): bug tinha DUAS causas encadeadas.

**Causa #1 — Short-circuit no post-filter** ([pipelineCore.ts:212-229](../backend/src/jobs/pipeline/pipelineCore.ts#L212-L229)):
```ts
// ANTES (bug):
const aceitar = cidadeExata || (cidadeParcial && estadoBate);
// Se cidade bate exato, || curto-circuita e NÃO checa estado.
// Cidades homônimas em estados diferentes (São José/SC, São José/SP, Santo Antônio, Planalto...) vazavam.
```

**Causa #2 — Tabela `news` sem coluna estado.** O Filter2 extraía estado mas `insertNews` descartava. Mesmo com Fix #1, feed e dedup camada 1 continuavam colapsando cidades homônimas.

**Fix aplicado:**

1. **Fix 1 — Post-filter sempre exige estado** ([pipelineCore.ts](../backend/src/jobs/pipeline/pipelineCore.ts)):
   ```ts
   const aceitar = (cidadeExata || cidadeParcial) && estadoBate;
   ```

2. **Fix 2 — Estrutural (estado vira first-class):**
   - [Migration 019](SQL/migrations/019_news_add_estado.sql) — `ALTER news ADD COLUMN estado TEXT` + index `(cidade, estado) WHERE active`.
   - [queries.ts](../backend/src/database/queries.ts): `InsertNewsParams`, `insertNews`, `findGeoTemporalCandidates`, `NewsFeedItem`, `NewsFeedParams`, `SearchNewsParams`, `getNewsFeed`, `getUserNewsFeed`, `searchNews` — todos aceitam/gravam/filtram `estado`.
   - [scanPipeline.ts](../backend/src/jobs/pipeline/scanPipeline.ts): passa `news.estado || parentState?.name` no `insertNews`.
   - [deduplication/index.ts](../backend/src/services/deduplication/index.ts): passa `newsData.estado` pro `findGeoTemporalCandidates` (dedup camada 1 agora inclui estado).
   - [newsRoutes.ts](../backend/src/routes/newsRoutes.ts): aceita `?estado=...` em GET /news, GET /news/feed e POST /search.

**Typecheck:** `npx tsc --noEmit` passou limpo.

**Flutter NÃO foi mexido (decisão consciente):**
- Backend passou a aceitar `estado` como query opcional → backwards-compatible.
- Fix 1 sozinho **estanca o fluxo novo** de mistura: notícias de SP só entram se monitoradas como SP.
- Fix 2 grava estado e permite distinguir no DB, protegendo contra o edge case de cidades homônimas em monitorings diferentes.
- Flutter passar `estado` na query seria a cereja do bolo (filtra no lado do feed também), mas requer decidir de onde vem o estado no UI (card → location → parent_state). Fica no ROADMAP.

**Pendente pelo João:**
- Rodar [migration 019](SQL/migrations/019_news_add_estado.sql) no Supabase antes do próximo scan.
- Rodar a migration de limpeza (notícias já gravadas com cidade errada) que ele mencionou ter preparada.

**Finding secundário (não mexido):** `MIGRATIONS_LOG.md` estava inconsistente — listava 005 como `city_groups` mas o arquivo real é 018. Corrigi o log.

---

### Dedup: 3 findings fechados no mesmo combo

Continuando a investigação após o fix de cidades, auditei o pipeline de dedup (intra-batch + 3 camadas DB). Apresentei 5 findings ao João, ele aprovou fix em todos.

**Causa raiz comum:** o dedup tinha pontos onde a lógica empobrecia a agregação de fontes e podia mesclar eventos diferentes. Impactava relatórios (ranking de bairros, mapa de calor, estatísticas).

**Fix #1 — Perda de sources em cluster intra-batch que vira duplicata DB**

[deduplication/index.ts](../backend/src/services/deduplication/index.ts): `deduplicateNews` agora aceita `extraSourceUrls: string[] = []`. Quando marca como duplicata (layer 3), insere a URL principal + todos os extras do cluster intra-batch como sources da notícia existente.

Antes: 3 veículos (G1, R7, UOL) consolidados no scan viravam 1 source (G1) quando crime já existia no DB.
Depois: todos os 3 viram sources agregadas.

Chamada em [scanPipeline.ts](../backend/src/jobs/pipeline/scanPipeline.ts): passa `news.extraSourceUrls` no `deduplicateNews`.

**Fix #2 — Prompt GPT da camada 3 reescrito**

[deduplication/index.ts:confirmDuplicateWithGPT](../backend/src/services/deduplication/index.ts): o prompt antigo pedia pro GPT confirmar critérios que a camada 1 JÁ tinha garantido (cidade+tipo+data). Viés claro pra "YES".

Prompt novo explicita que cidade+estado+tipo+data **não basta** — GPT precisa distinguir por detalhes: local exato (bairro/rua/estabelecimento), vítimas/suspeitos, valores, modus operandi, horário. Em dúvida, respira e responde **NO**: "a false NO just keeps two cards; a false YES loses an event permanently."

**Fix #3 — Bairro na camada 1 com tolerância a NULL**

[queries.ts:findGeoTemporalCandidates](../backend/src/database/queries.ts): aceita `bairro?: string | null`. Lógica:
- Se bairro foi passado → query adiciona `.or('bairro.eq.X,bairro.is.null')` → traz candidatos com mesmo bairro OU sem bairro (tolerante).
- Se bairro for NULL na nova notícia → não filtra por bairro (comportamento antigo).

Evita: eventos com bairros diferentes explícitos virarem candidatos um do outro → menos falsos positivos → relatórios de bairro mais precisos (ranking, mapa de calor, estatística).

Policy escolhida: **tolerante** (João aprovou) — prioriza não perder duplicata real em caso de bairro ausente.

**Fix #4 (menor) — Threshold intra-batch agora configurável**

[pipelineCore.ts:runIntraBatchDedup](../backend/src/jobs/pipeline/pipelineCore.ts): recebe `similarityThreshold` como parâmetro (default 0.85). Chamadas em [scanPipeline.ts](../backend/src/jobs/pipeline/scanPipeline.ts) e [manualSearchWorker.ts](../backend/src/jobs/workers/manualSearchWorker.ts) passam `pipelineConfig.dedupSimilarityThreshold` (mesma config `dedup_similarity_threshold` usada na camada 2 do dedup DB).

Manual search worker agora também carrega essa config.

**Fix #5 (menor) — Limit camada 1 aumentado 50 → 200**

[queries.ts:findGeoTemporalCandidates](../backend/src/database/queries.ts): em cidade grande (SP, RJ) com muito volume diário, o teto de 50 candidatos podia cortar matches válidos → duplicatas escapavam. Aumentado pra 200.

**Typecheck:** `npx tsc --noEmit` passou limpo.

**Arquivos alterados nesta rodada:**
- `backend/src/services/deduplication/index.ts`
- `backend/src/database/queries.ts`
- `backend/src/jobs/pipeline/pipelineCore.ts`
- `backend/src/jobs/pipeline/scanPipeline.ts`
- `backend/src/jobs/workers/manualSearchWorker.ts`

**Nenhuma migration SQL nesta rodada** (todos os fixes são code-only).

**Pendente pelo João:**
- Deploy do backend após rodar migration 019 (do combo anterior).
- Validar em produção: (1) cards com múltiplas fontes agregadas; (2) menos merges errados (conferir ranking de bairros); (3) relatórios com distribuição realista por bairro.

---

### Revisão do funil de filtros — 3 fixes aplicados

João pediu mapa completo do funil (Filter0 → Filter1 → Fetch → Filter2 → Post-filter → Intra-batch → Dedup DB). Ao revisar Filter0 e Filter1 (únicos que eu ainda não tinha lido), trouxe 4 findings. João aprovou 3 pra corrigir agora (o 4º, keywords broad no Filter0, fica pra discussão futura).

**Fix A — Filter0 bloqueia Instagram e YouTube**

[filter0Regex.ts](../backend/src/services/filters/filter0Regex.ts): `BLOCKED_DOMAINS` ganhou `instagram.com`, `youtube.com`, `youtu.be`. Comentário antigo ("YouTube e Instagram liberados — podem ter reportagens") estava desalinhado com a prática — João reportou que Instagram entregava muito reel e pouca notícia, YouTube não tem texto pra Jina extrair. Agora está consistente com a query Google da busca manual (que já excluía via `-site:instagram.com -site:youtube.com`).

**Fix B — Filter1 não faz mais fallback "all true" em erro de OpenAI**

[filter1GPTBatch.ts](../backend/src/services/filters/filter1GPTBatch.ts): o fallback antigo em caso de exceção no try/catch retornava `results: all true` — o que jogava **todas as URLs** pro Jina fetch e Filter2, gastando Jina + GPT-4o-mini sem filtro real. Potencial explosão de budget se OpenAI tivesse outage.

Novo comportamento:
- Parse JSON inválido ou length mismatch: ainda faz padding seguro (é lixo do GPT, não downtime).
- **Exceção de API após retry**: `throw` em vez de fallback. BullMQ faz retry com backoff. Sentry já capturava (alerta por email via Sentry UI).

[cronScheduler.ts](../backend/src/jobs/scheduler/cronScheduler.ts): BullMQ retry ajustado de `attempts: 3, delay: 2000ms` (total ~14s) pra `attempts: 5, delay: 60000ms` exponencial (1min → 2min → 4min → 8min → 16min = ~31min de tolerância pra OpenAI voltar). Aplicado no cron automático e no `enqueueScan` manual.

**Fix C — Filter2 maxContentChars dobrado**

[configManager/index.ts](../backend/src/services/configManager/index.ts) + [schema.sql](../backend/src/database/schema.sql): default `filter2_max_content_chars` de `4000` → `8000`. Matérias investigativas longas tinham o desfecho cortado antes do GPT analisar (data/cidade podem aparecer no fim).

Custo marginal: ~$0.0003/notícia vs $0.00015 antes (gpt-4o-mini). Em 30 notícias/scan, ~$0.005 a mais.

**Typecheck:** `npx tsc --noEmit` passou limpo.

**Arquivos alterados:**
- `backend/src/services/filters/filter0Regex.ts`
- `backend/src/services/filters/filter1GPTBatch.ts`
- `backend/src/jobs/scheduler/cronScheduler.ts`
- `backend/src/services/configManager/index.ts`
- `backend/src/database/schema.sql`

**Pendente pelo João:**
- **Config em PROD**: `filter2_max_content_chars` já está no DB como 4000. Atualizar via admin panel pra 8000 (a mudança no código só afeta instâncias novas sem config salva). *Adicionado na UI em 2026-04-16 — ver ajuste abaixo.*
- **Sentry**: configurar alerta de email no Sentry UI pra tag `provider:openai` + `stage:filter1`. Assim outage de OpenAI vira notificação direta.
- Finding aberto não corrigido: **F0-1 keywords broad** (`"jogo"`, `"tempo"`, `"música"`, `"esporte"` bloqueando falsos positivos). Ver ROADMAP.

---

### Ajuste pós-fix: expor `filter2_max_content_chars` no admin panel

Descobri (João me alertou) que a config `filter2_max_content_chars` não tinha UI editável no admin panel — só `filter2_confidence_min` e `dedup_similarity_threshold` estavam expostos. Então a mudança de default no código (4000→8000) não surtia efeito em prod, porque a prod tem valor salvo no DB e não há forma de editar.

Adicionado em [admin-panel/.../settings/page.tsx](../admin-panel/src/app/(dashboard)/dashboard/settings/page.tsx), grupo `AI_FILTER_THRESHOLDS`:

```ts
{
  key: 'filter2_max_content_chars',
  label: 'Tamanho máximo do conteúdo analisado',
  description: 'Quantos caracteres da matéria o AI lê para extrair dados...',
  min: 2000, max: 16000, step: 500,
}
```

Range escolhido: <2000 corta quase tudo, >16000 raro em matérias. Default recomendado 6000-10000 no tooltip.

**Typecheck admin panel:** limpo.

**Próximo passo pelo João:** ao abrir a página de Settings, vai ter um slider novo pra configurar o tamanho. Ajustar pra 8000 em prod.

---

### Script de regressão: teste lado-a-lado do prompt de dedup

Criado [backend/scripts/test-dedup-prompt.ts](../backend/scripts/test-dedup-prompt.ts) pra isolar a validação do prompt novo do dedup camada 3 (Fix #2 do combo anterior).

Auto-contido — não importa nada de `src/`. Hardcoda os dois prompts (antigo e novo) e 4 pares de resumos pré-fabricados:

- Par 1: mesmo evento, veículos diferentes (esperado YES)
- Par 2: crimes diferentes mesmo tipo/cidade (esperado NO)
- Par 3: mesmo evento, escritas muito diferentes (esperado YES)
- Par 4: crimes diferentes no mesmo bairro (esperado NO)

**Uso:**
```bash
cd backend
npx tsx scripts/test-dedup-prompt.ts
```

Roda em ~15-30s, custo ~$0.002. Saída: tabela com comparativo + seção de regressões e ganhos.

**Leitura de sucesso:** novo prompt acerta todos os 4 sem regressão. Se regressão aparecer, recalibrar o prompt antes de confiar nele em prod.

**Fora de escopo:** mudança de post-filter por natureza (ocorrência/estatística) — discutido e descartado nesta rodada, pode voltar futuramente se necessário.

**Typecheck:** passou limpo.

---

### Prompt novo do dedup REVERTIDO — velho vence 9/10 vs 7/10

Rodei o script `test-dedup-prompt.ts` com 10 pares balanceados (3 YES claro, 3 NO claro, 2 borderline NO, 2 borderline YES). Resultado:

- **Prompt velho (original):** 9/10 ✓
- **Prompt novo (meu de Fix #2 do combo de dedup):** 7/10 ✗
- **Regressões do novo:** Par 02 e Par 03 — YES claros onde o novo disse NO (mesmo evento, veículos diferentes e escritas diferentes). Isso quebra o **core value** do sistema (agregar veículos num card único).
- **Ambos erraram Par 10** (borderline YES, idade 35 vs ~30).

**Admissão honesta:** o Finding #2 original era **especulação minha** mais que bug comprovado. Minha hipótese era que o GPT cairia em viés pra YES porque os critérios do prompt antigo sempre batiam (cidade+tipo+data já pré-filtrados). Na prática, o gpt-4o-mini é inteligente o suficiente pra focar nos outros critérios (vítimas, detalhes-chave) mesmo quando os primeiros batem. Os pares borderline NO (Par 07 e 08) foram resolvidos corretamente pelo prompt velho.

**Ação:** revertido em [dedup/index.ts:confirmDuplicateWithGPT](../backend/src/services/deduplication/index.ts) pro prompt original. Comentário na função documenta a tentativa e por que foi descartada.

**Outros 4 fixes do combo de dedup permanecem** (preserva sources, bairro camada 1, threshold configurável, limit 200) — todos validados por lógica, não por especulação.

**Lição aprendida:** não confiar em finding teórico sem evidência de produção ou teste. Script de regressão `scripts/test-dedup-prompt.ts` fica como referência pra próximas mexidas de prompt.

---

### ARQUITETURA.md atualizado — graph detalhado do funil

A seção "## PIPELINE CORE" de [ARQUITETURA.md](./ARQUITETURA.md#pipeline-core-pipelinecorets) foi reescrita com:

- Mapa detalhado do funil stage por stage (URL dedup → Filter0 → Filter1 → Fetch → Filter2 → Post-filter → Embedding → Intra-batch → Dedup DB)
- Pontos de rejeição explicitados (setas laterais `[X->]` marcam saídas do funil)
- Valores atuais da sessão (limit 200, threshold configurável, bairro tolerante, maxContentChars 8000, retry BullMQ 31min)
- STAGE 7 separado pra dedup DB das 3 camadas (só auto-scan)
- Seção final documentando a tentativa+reversão do prompt

Mantive formato ASCII consistente com o resto do arquivo.

**Inconsistências observadas no ARQUITETURA.md (não corrigidas nesta rodada):**
- Header menciona "Fase 3 — Sessao 012" — desatualizado (estamos Fase 2 nova).
- Menciona "Brave News" como principal — na prática é BrightData via `config.searchBackend`.

Anoto como pendência: revisão completa do ARQUITETURA.md depois que a Camada 5 estiver mapeada também, pra fazer uma varredura única.

---

### Camada 5 — Cards e feed: 3 findings fechados

Continuei na Camada 5 mapeando como os cards do dashboard e do feed são montados. João confirmou 3 mudanças:

**Fix A — UF visível no dashboard e no card de notícia**

Antes: UF (SC/SP) só aparecia no header da tela de detalhe (quando usuário já tinha clicado no card). Cards na tela principal e cards individuais do feed não mostravam UF.

- **Dashboard CityCard** ([city_card.dart](../mobile-app/lib/features/dashboard/widgets/city_card.dart)): badge teal UF ao lado do nome da cidade (só para cidade individual, não para grupos — grupos podem misturar estados).
- **Card de notícia no feed** ([news_item.dart:localFormatted](../mobile-app/lib/core/models/news_item.dart)): formato `"São José/SC - Kobrasol - Rua X"` quando `estadoUf` está disponível. Fallback pro comportamento antigo se for null.
- **Detail screen** mantido como estava (não removeu UF do header — reforço não atrapalha, protege deep link/screenshot).
- **Novo helper** [state_utils.dart](../mobile-app/lib/core/utils/state_utils.dart) com função `abbrState()` — centraliza o mapa de nome→UF que estava duplicado no detail_screen. Detail_screen passa a usar o helper; mapa local `_stateAbbr` e função `_abbrState` removidos.

**Fix B — Remove duplicação `tipo_crime → categoria_grupo`**

Antes: mapa de 15 entries (roubo_furto→patrimonial, homicidio→seguranca, etc) existia em 2 lugares: backend ([types.ts](../backend/src/utils/types.ts)) E Flutter ([news_card.dart](../mobile-app/lib/features/feed/widgets/news_card.dart)). Faltava entry `estatistica` no Flutter (funcionava por sorte via default).

- **Backend** ([queries.ts](../backend/src/database/queries.ts)): `NewsFeedItem` type ganhou `categoria_grupo: string | null`; queries `getNewsFeed`, `getUserNewsFeed`, `searchNews`, `getUserFavorites` passaram a selecionar a coluna.
- **Flutter** ([news_item.dart](../mobile-app/lib/core/models/news_item.dart)): model ganhou `categoriaGrupo: String?`; factories `fromJson` e `fromSearchResult` parseiam.
- **Flutter** ([news_card.dart](../mobile-app/lib/features/feed/widgets/news_card.dart)): `_CrimeBadge` passou a receber `categoriaGrupo` direto; mapa hardcoded de 15 entries removido; mantidos apenas `_grupoCores` e `_grupoLabels` (5 entries, puro UI). Fallback `?? 'institucional'` pra casos edge.

Benefício: se amanhã mudar categorização no backend (ex: mover `manifestacao` pra outra categoria), Flutter reflete automaticamente sem precisar sincronizar mapa manualmente.

**Fix C — Limpa dead code do `resumo_agregado`**

Confirmado na investigação: `resumo_agregado` era feature planejada mas **nunca implementada**. Coluna existia no DB, backend selecionava, Flutter fazia fallback `resumoAgregado ?? resumo` — mas nenhum INSERT/UPDATE populava o campo. Sempre NULL, sempre caía no `resumo`.

João aprovou limpeza. Mudanças:
- **Backend** ([queries.ts](../backend/src/database/queries.ts)): removido `resumo_agregado` dos SELECTs de `getUserNewsFeed` e `getUserFavorites`.
- **Backend** ([schema.sql:237-238](../backend/src/database/schema.sql)): linha `ALTER TABLE news ADD COLUMN resumo_agregado` removida, substituída por comentário histórico.
- **Migration nova** ([020_news_drop_resumo_agregado.sql](SQL/migrations/020_news_drop_resumo_agregado.sql)): `ALTER TABLE news DROP COLUMN IF EXISTS resumo_agregado`. **Pendente — rodar APÓS deploy do backend** (se rodar antes, código em prod quebra ao pedir coluna inexistente).
- **Flutter** ([news_item.dart](../mobile-app/lib/core/models/news_item.dart)): campo `resumoAgregado` removido do model, do fromJson e do fromSearchResult.
- **Flutter** ([news_card.dart](../mobile-app/lib/features/feed/widgets/news_card.dart)): `news.resumoAgregado ?? news.resumo` → `news.resumo`.
- **Flutter** ([news_detail_sheet.dart](../mobile-app/lib/features/feed/widgets/news_detail_sheet.dart)): mesmo.

Comportamento real não muda (sempre era `resumo` na prática). Só limpou peso morto.

**Validação:**
- `npx tsc --noEmit` backend: limpo.
- `flutter analyze` nos 6 arquivos mobile alterados: `No issues found!`

**Arquivos alterados nesta rodada:**
- `backend/src/database/queries.ts`
- `backend/src/database/schema.sql`
- `workdesk/SQL/migrations/020_news_drop_resumo_agregado.sql` (novo)
- `workdesk/SQL/MIGRATIONS_LOG.md`
- `mobile-app/lib/core/utils/state_utils.dart` (novo)
- `mobile-app/lib/core/models/news_item.dart`
- `mobile-app/lib/features/feed/widgets/news_card.dart`
- `mobile-app/lib/features/feed/widgets/news_detail_sheet.dart`
- `mobile-app/lib/features/dashboard/widgets/city_card.dart`
- `mobile-app/lib/features/dashboard/screens/city_detail_screen.dart`

**Pendências acumuladas pelo João:**
- Deploy backend + Flutter APK novo (com UF e sem resumo_agregado).
- Rodar migration 019 (adicionar coluna estado) — do combo anterior.
- Rodar migration de limpeza dos dados ruins — do combo anterior.
- **APÓS deploy**: rodar migration 020 (DROP coluna resumo_agregado).
- Ajustar `filter2_max_content_chars` pra 8000 no admin panel.
- Configurar Sentry alert de email pra tag `provider:openai stage:filter1`.

---

### Relatórios — bug de contagem + limpeza pesada de dead code

João aprovou execução dos Blocos A + C + D (B descartado — top 10 fica).

**Bloco A — Fix bug de contagem de estatísticas**

Problema: [getCrimeSummary](../backend/src/database/analyticsQueries.ts) e [getSearchResultsAnalytics](../backend/src/database/analyticsQueries.ts) contavam notícias de natureza `estatistica` como ocorrências. Cidade com 30 ocorrências + 5 indicadores mostrava "35 Ocorrências" + "5 Indicadores" (inflado).

Fix: `continue;` no topo do loop quando `natureza === 'estatistica'`. Estatísticas vão só pro array separado `estatisticas[]`. `totalCrimes`/`byCrimeType`/`byCategory`/`topBairros` contam apenas ocorrências reais agora.

Flutter report_screen já fazia certo — só o backend estava inflando.

**Bloco C — Delete dead code (backend)**

Removido de [analyticsQueries.ts](../backend/src/database/analyticsQueries.ts):
- Constante `CATEGORY_RISK_WEIGHT` + função `calculateRiskScore` (25 linhas)
- Campos `riskScore`, `riskLevel`, `avgConfianca`, `sourceCounts`, `credibilityPercent` do type `CrimeSummaryResult`
- Cálculos correspondentes em `getCrimeSummary`
- Função `getCrimeComparison` inteira + type `CrimeComparison` + helpers `countByType`, `formatDate` (~85 linhas)

Removido de [analyticsRoutes.ts](../backend/src/routes/analyticsRoutes.ts):
- Rota `GET /analytics/crime-comparison`
- Rota `GET /analytics/search-report/:searchId` (endpoint externo nunca consumido; a função interna `getSearchResultsAnalytics` permanece pois é usada pelo POST /report)
- Import de `getCrimeComparison`
- Cálculo de período anterior + chamada a `getCrimeComparison` no POST /report
- Campos `riskScore`, `riskLevel`, `credibilityPercent`, `avgConfianca`, `sourceCounts`, `comparison`, `comparisonDelta` do `reportData` salvo em `reports`

Removido de [validation.ts](../backend/src/middleware/validation.ts):
- Schema `analyticsComparison` (18 linhas)

**Motivo:** nem Flutter (auto-scan tab relatório) nem web (/report/[id]) renderizavam esses campos. Dead data ocupando payload desde que features foram retiradas da UI.

**Impacto em relatórios antigos:** reports já salvos no banco têm esses campos no JSON — o código novo apenas ignora. Sem migration necessária.

**Bloco D — Consolidar categoria (fonte única)**

Antes: mapa `tipo_crime → categoria_grupo` duplicado em 4 lugares (backend `types.ts`, backend `analyticsQueries.ts`, Flutter `news_card.dart`, Flutter `city_detail_screen.dart`, Flutter `report_screen.dart`). news_card já tinha sido limpo em rodada anterior.

Depois: coluna `news.categoria_grupo` (populada pelo pipeline) é fonte única.

- [analyticsQueries.ts](../backend/src/database/analyticsQueries.ts) `getCrimeSummary`: select agora inclui `categoria_grupo`; usa `row.categoria_grupo ?? 'institucional'` em vez de lookup. Constante `TIPO_CATEGORIA` deletada.
- [city_detail_screen.dart](../mobile-app/lib/features/dashboard/screens/city_detail_screen.dart): usa `byCategory` do backend direto (sem reagrupar client-side). Constante `_tipoToCategory` removida. `_buildCategoryDonut` recebe `categories` (já agrupado) em vez de `types`.
- [report_screen.dart](../mobile-app/lib/features/search/screens/report_screen.dart): `_categoryCounts` agora é campo `late final` atribuído no `_computeAnalytics` usando `r['categoria_grupo']` direto dos resultados. Getter antigo + constante `_tipoToCategory` removidos.

**Validação:**
- `npx tsc --noEmit` backend: limpo.
- `flutter analyze` nos 2 arquivos Flutter: `No issues found!`

**Arquivos alterados:**
- `backend/src/database/analyticsQueries.ts` (~130 linhas removidas, getCrimeSummary reescrito)
- `backend/src/routes/analyticsRoutes.ts` (2 rotas removidas, POST /report simplificado)
- `backend/src/middleware/validation.ts` (schema analyticsComparison removido)
- `mobile-app/lib/features/dashboard/screens/city_detail_screen.dart` (mapa categoria removido, donut simplificado)
- `mobile-app/lib/features/search/screens/report_screen.dart` (mapa categoria removido, getter vira field, _computeAnalytics popula direto)

**Finding aberto** (não mexido): [admin-panel/.../crime-pie-chart.tsx](../admin-panel/src/components/analytics/crime-pie-chart.tsx) — não investigado se usa `byCategory` direto ou recalcula a partir de `byCrimeType`. Se recalcular, é a última duplicação restante do mapa categoria. Anotar no ROADMAP.

---

### Fechamento da sessão 2026-04-16

**Avaliação final do relatório pelo João:** 6/10 (meu juízo). Base técnica sólida, falta polimento pra soar "profissa" a cliente executivo. João concordou em descartar `riskScore` (pesos arbitrários) e `comparison` (redundante com trend). Oportunidades futuras acordadas:
- Resumo executivo gerado por GPT (2 parágrafos no topo)
- Breakdown de tendência por categoria (não só total)
- Rua no mapa (Opção C da discussão: geocode mais preciso + fallback tolerante)

**Deploy + build:**
- Merge `develop` → `staging` + push (commit `bc92d5d`). Render free tier vai rebuilder sozinho (~3-5min cold start).
- Produção suspensa pelo João enquanto testa staging.
- `flutter clean` + `flutter build apk --dart-define=API_URL=https://simeops-backend.onrender.com` rodando em background.

**Memória atualizada:**
- Novo `project_fase2_refinement.md` com resumo dos combos desta sessão (cidades/dedup/filtros/cards/relatórios/limpeza dead code).
- `project_overview.md` atualizado pra refletir Fase 2 em andamento.
- `MEMORY.md` indexado.

**Checklist de pendências pro João amanhã (produção):**
1. Rodar migration 019 (coluna `estado`) no Supabase production
2. Rodar migration de limpeza (dados ruins)
3. Testar tudo em staging via APK
4. Se OK: merge staging → main, reativar produção, APK prod rebuild
5. **APÓS backend prod rodar novo:** migration 020 (DROP `resumo_agregado`)
6. Ajustar `filter2_max_content_chars` pra 8000 no admin panel
7. Configurar Sentry alert de email pra tag `provider:openai stage:filter1`

**Primeira sessão com Opus 4.7 encerrada.**
