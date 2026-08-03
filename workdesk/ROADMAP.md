# ROADMAP — SIMEops (Fase 9: o app à altura do backend)

> 🗂️ **Documento da Fase 9** — arquivado em `Fases/Fase 9/` quando ela fechar.
> Ver [README](./README.md) para a organização da pasta.
>
> Planos, backlog e próximos passos. Revisado no fim de cada sessão com o João.
> Dívida que atravessa fases mora no [BACKEND_PENDENTE](./BACKEND_PENDENTE.md).
>
> Fases 1 a 8 arquivadas em [Fases/](./Fases/). Estado atual do sistema e
> medições que não devem ser refeitas: bloco **ESTADO DO MUNDO** no
> [DEV_LOG](./DEV_LOG.md).

**A tese desta fase:** o backend ficou bom e o app não sabe disso. São **oito
campos** já entregues que o Flutter descarta. Nada aqui pede backend novo.

**Documento de entrada:** [FRONTEND_BRIEFING.md](./FRONTEND_BRIEFING.md) — leia
antes de abrir qualquer arquivo `.dart`. Tem os números reais, o mapa dos
arquivos, as decisões de UI que o João já tomou e as cinco armadilhas.

---

## 🚨 PRIORIDADE 0 — Duas decisões do João, travando tudo

Nenhuma das duas é trabalho de código. As duas são risco parado.

### 1. Migration 025 — o banco está aberto para a chave anon

Medido em 02/08 com a chave do próprio `.env`: leitura **e escrita** liberadas em
praticamente todas as tabelas. A chave anon é pública — está dentro do APK
entregue ao cliente e no bundle JS do admin.

[025_rls_fechar_anon.sql](./SQL/migrations/025_rls_fechar_anon.sql) está escrita,
com o teste de verificação no cabeçalho. **Não rodada** — afeta produção na hora.

Verificado que **não quebra nada**: app e admin usam Supabase só para `auth`, e o
backend usa a service key, que faz bypass de RLS.

### 2. Promover `main`

Produção roda código de **junho** e está quebrada em quatro lugares
independentes. Tudo que foi feito nas Fases 8 e 9 só chega ao cliente aqui.

Checklist completo em [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md), item 2.
Requer autorização explícita (a CLAUDE.md proíbe merge direto em `main`).

---

## 📱 Fase 9 — O app

> **02/08: 9.1 a 9.7 IMPLEMENTADOS** (11 commits em `develop`, um por etapa —
> ver DEV_LOG). Além do planejado: linguagem visual (tokens/botões/tipografia),
> NewsCard e CityCard redesenhados, recorte único com grupos colapsáveis +
> filtros no feed e na busca, mapa com tap/legenda/fit-to-bounds, e o mapa
> dentro do PDF do relatório web.
>
> **Falta para fechar a fase:**
> - ✅→📱 **Testar no device físico contra staging** (`run-dev.bat`, `flutter
>   clean` antes) — nada foi validado visualmente ainda, só analyzer/tsc.
> - **Deploy coordenado backend+APK** para destravar 365 dias / 10 cidades
>   (`validation.ts`) — requer aval do João.
> - Acabamento de cores nas telas fora do escopo (login, settings,
>   history_card, risk/credibility widgets) — `Colors.*` cru ainda vive lá.
> - Gap multi-cidade do relatório: `_loadMapPoints`/`_loadExecutive` usam
>   `cidades.first`; resolver quando multi-cidade destravar.

Ordem original, do que destrava mais para o que é acabamento. Detalhe de cada
item, com pontos de encaixe e armadilhas, no
[FRONTEND_BRIEFING.md](./FRONTEND_BRIEFING.md).

### 9.1 — `getManualSearchResults` devolve os três baldes

[api_service.dart:226-235](../mobile-app/lib/core/services/api_service.dart#L226)
faz `return body['results']` e **descarta `extras` inteiro**. Enquanto essa função
devolver `List<Map>`, região metropolitana e "fora do período" não existem para o
app.

**É o passo que destrava 9.4 e 9.6.** Sem ele, os outros não têm o que mostrar.

### 9.2 — Contador real na tela de carregamento

`progress.feitos` / `progress.total` já chegam e avançam a cada ~2s dentro dos
estágios 4 e 5 — que são **85% do tempo** de uma busca. Hoje a tela mostra "passo
4 de 7" parado por três minutos, e o próprio João achou que tinha travado quando
estava andando normal.

**Maior ganho percebido pelo menor esforço da lista.**

### 9.3 — Desistir por estagnação, não por relógio

`_maxPolls = 200` × 3s = desiste em 10 min, mesmo com a busca andando. Esse número
mágico é o que trava, **do lado do backend**, duas coisas:

| trava | volta para | onde |
|---|---|---|
| `periodo_dias` ≤ 180 | 365 | `validation.ts` |
| 1 cidade por busca | 10 | `validation.ts` + `multi_city_search_field.dart` |

Regra nova: enquanto `feitos` ou `atualizado_em` avançarem, seguir esperando;
parado há ~2 min, aí é falha.

⚠️ **Backend e APK sobem juntos** quando esses limites mudarem.

### 9.4 — Seção expansível no fim da lista

Região metropolitana + "mais ocorrências", no padrão `Divider — LABEL — Divider`
que o feed já usa, em cor destacada. Um `bool` + itens condicionais resolve —
**não existe accordion em todo o `mobile-app/lib`**, não precisa trazer
dependência.

### 9.5 — Achados ao vivo

`progress.achados` traz os 5 mais recentes (`tipo_crime`, `bairro`,
`data_ocorrencia`). Custo zero no servidor, e é o que transforma a espera de
5 minutos em algo que dá vontade de olhar.

### 9.6 — Calendário e re-fatiar client-side

O maior dos seis, e o único que muda o `report_screen`. **Depende do 9.1.**

A restrição que define o desenho: o Google só pagina de hoje para trás, então
buscar março custa o mesmo que buscar os últimos cinco meses. O lado bom é que a
busca **já coletou tudo no caminho** — é o balde `fora_do_periodo`.

`_computeAnalytics` roda uma vez no `initState` e varre tudo sem filtro; precisa
virar função de um subconjunto. É a mesma mecânica dos toggles de região e
período: **lista e relatório viram função de um recorte.** Fazendo um, os outros
saem quase de graça.

### 9.7 — Deep link do push

O push de conclusão **já manda o `search_id`**. Falta abrir o resultado direto —
hoje o usuário navega até o histórico na mão. A tela já sabe retomar por
`resumeSearchId`.

---

## 🗺️ Onde buscar — a alavanca que o funil revelou (03/08)

O baseline de Goiás mostrou que **57% das rejeições são de cidade** (55 de 96), e
que **32 delas são cidades do próprio Goiás** — Goiatuba 14, Luziânia 4,
Anápolis 3, Formosa, Itumbiara, Catalão, Crixás… Notícia real de crime,
coletada, baixada, analisada, **paga**, e jogada fora por não ser a capital.

A seção REGIÃO METROPOLITANA não pega essas: Goiatuba fica a 200 km, Luziânia é
Entorno do DF. Recuperá-las **não custa nada** — o dinheiro já foi gasto.

### 1. Abrangência na tela de busca

`Só a cidade` · `+ Região metropolitana` · `Raio de N km` · `Estado inteiro`.
O encanamento existe: `cidadesRegiao` + `classificar` já são parâmetros do
pós-filtro ([pipelineCore](../backend/src/jobs/pipeline/pipelineCore.ts)).

⚠️ Isto é **recuperação, não coleta**. Um raio maior não faz o Google devolver
mais — faz o pós-filtro guardar mais do que já veio. Buscar *também* nas cidades
do raio é outra coisa, mais cara em tempo, e tem que ser escolha separada.

### 2. Mapa com raio (ideia do João, 03/08)

Arrastar um raio no mapa em vez de escolher "região metropolitana". Melhor que a
lista atual em dois sentidos: é exato (hoje é uma pergunta ao GPT com guarda de
alucinação e teto de 45 municípios) e se explica sozinho na tela.

**O que falta:** uma tabela de municípios com lat/lng. O pipeline filtra por
**nome** (`mesmaCidade`), não por coordenada — o artigo só é geocodificado
depois, pro mapa. Então o raio não filtra artigo: ele **produz a lista de nomes**
que vira `cidadesRegiao`.

⚠️ **Não estender o GPT pra isso.** `metroRegion` funciona porque região
metropolitana é um fato jurídico que o modelo memorizou; "municípios num raio de
100 km" é uma **conta**, e o modelo erra conta. O caminho é dataset estático
(5.570 municípios, ~300 KB, não mudam) + haversine.

### 3. Coerência entre a busca e o feed — verificar

Hoje **são dois comportamentos diferentes**, e isso é o que parece bagunça:

| | cidade vizinha |
|---|---|
| busca manual | vira `extras.regiao`, seção recolhida (9.4) |
| feed / auto-scan | **descartada, some** (`classificar` é opt-in e fica off) |

O motivo do opt-in está no [pipelineCore](../backend/src/jobs/pipeline/pipelineCore.ts):
o auto-scan grava direto em `news`, e classificar ali faria o CRON salvar cidade
vizinha como se fosse a monitorada — a mesma poluição de escanear `type='state'`.

Para o feed mostrar região sem poluir, `news` precisaria carregar o sinalizador
(coluna nova + migration), não só deixar de descartar. **Decisão de produto antes
de código.**

### 4. Região metropolitana mais aparente (pedido do João)

Hoje ela é uma seção recolhida no fim — foi por isso que "Goiânia deu 11" quando
tinham 19. Falta: indicativo no próprio card, contagem no sumário
(`11 + 8 na região`) e uma entrada própria nos filtros, não só o acordeão.

---

## ⚡ Fase 10 — Acelerar o estágio 4 (backend, decidido em 02/08)

Ideia levantada pelo João logo depois do primeiro teste real: *"não tem jeito de
fazer isso mais rápido?"*. **Adiada para depois do app**, por decisão dele.

### O diagnóstico, medido

A busca leva 5min31s, e **179s (54%) é baixar as matérias**: 241 artigos, ~7,4s
cada, 10 por vez.

### Por que não é uma config só

⚠️ Há **dois limitadores em série**, ambos em 10:

| onde | chave |
|---|---|
| pool do `runContentFetch` | `manual_search_fetch_concurrency` (tem campo no painel) |
| `Bottleneck` do rateLimiter | `api_rate_limits.jina.max_concurrent` (**sem UI**) |

Subir só o primeiro **não acelera nada** — o segundo estrangula igual. E
`api_rate_limits` não tem tela: a API existe (`GET`/`PATCH /settings/rate-limits`)
e nenhum componente do front a consome.

### O que fazer, em ordem

1. **Tratar o 429 do Jina** com retry e `Retry-After`. Hoje um 429 vira "fetch
   falhou" e **perde o artigo em silêncio** — subir a concorrência sem isso troca
   lentidão por resultado faltando, que é pior.
2. **Expor `api_rate_limits` no painel** (a API já existe).
3. Subir os dois para 20 e medir. Estimativa: estágio 4 de 179s → **~90s**, busca
   inteira para ~3min40.

❓ **Depende de saber o plano contratado do Jina** — não está no repo. Sem isso, o
caminho é subir devagar (10 → 15 → 20) e observar quando o 429 aparece; com o
passo 1 feito, um 429 custa só um segundo a mais.

---

## 💡 Em aberto (não decidido)

- **Fontes oficiais por estado** (SSP/Polícia Civil): 27 fontes, não 5.570
  cidades — encaixa no `type='state'` que já existe. O RSS grátis enxerga matéria
  que o SERP pago não surface. É projeto, não remendo.
- **Google News RSS como índice** (não como fonte): título, data e veículo
  corretos e de graça, mas a URL é redirect opaco. Só vira útil se aparecer forma
  limpa de resolver a URL.
- **Push de estatística:** `natureza === 'estatistica'` dispara push igual a crime
  ("homicídios caíram 12%" chega como alerta). Decisão de produto.
- **Assuntos por perfil de cidade:** capital e cidade pequena não rendem com a
  mesma pergunta. Agora que `search_subjects` está no painel, isto vira "lista por
  location".
- Subir `filter2` de 5 para mais concorrência (o limite da OpenAI é bem maior).

## 🔧 Dívida técnica

- **Migration 024** — 7 configs mortas, pronta e não rodada. Neutra.
- `openai` ^4.24.1 → v6.
- Flutter: `fl_chart` 0.70→1.x, `share_plus` 10→12, `flutter_map` 7→8,
  `sentry_flutter` 8→9.
- **Renomear "Netrios News" → "SIMEops"** (diretório e repo).

## 🐛 Bugs conhecidos / suspeitas

- **Página vazia da Bright Data** (HTTP 200, 0 bytes, sem `x-brd-err-code`):
  observada em 01/08, causa **desconhecida**. Mitigada com 1 retry desde a 8.1.
- **Filter0 com keywords amplas** (`jogo`, `tempo`, `música`, `esporte`): geram
  falso negativo. Estratégia em aberto.
- **Sem `parent_id` não há pós-filtro nenhum** (`locationPostFilter = undefined`)
  — a cidade aceitaria notícia de qualquer lugar. Hoje as 4 cidades têm pai; é
  latente.
