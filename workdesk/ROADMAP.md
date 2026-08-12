# ROADMAP — SIMEops (Fase 9: o app à altura do backend)

> 🗂️ **Documento da Fase 9** — arquivado em `Fases/Fase 9/` quando ela fechar.
> Ver [CLAUDE.md](../CLAUDE.md), seção 2.
>
> Planos, backlog e próximos passos — **incluindo a dívida que atravessa fases**
> (o `BACKEND_PENDENTE` foi absorvido aqui em 04/08: cinco das oito seções dele
> eram duplicata literal deste documento). Revisado no fim de cada sessão.
>
> Fases 1 a 8 arquivadas em [Fases/](./Fases/). Estado atual do sistema e
> medições que não devem ser refeitas: bloco **ESTADO DO MUNDO** no
> [DEV_LOG](./DEV_LOG.md).

**A tese desta fase:** o backend ficou bom e o app não sabe disso. Eram **oito
campos** já entregues que o Flutter descartava — todos consumidos desde 04/08.
O briefing de entrada foi arquivado em
[Fases/Fase 9/](./Fases/Fase%209/FRONTEND_BRIEFING.md) porque descreve um
problema já resolvido.

> **Este documento é só o FUTURO.** Estado atual, medições e decisões fechadas
> ficam no bloco **ESTADO DO MUNDO** do [DEV_LOG](./DEV_LOG.md) — um lugar só,
> senão as cópias divergem.

---

## 📦 O QUE ESPERA O DEPLOY FINAL — decidido em 11/08

> **Isto era "PRIORIDADE 0 — risco parado", e deixou de ser.** O João decidiu:
> *"vamos terminar tudo daí faço o main de uma vez só. Estamos em beta, os
> clientes já sabem que tá em desenvolvimento."*
>
> Ou seja: os fatos abaixo continuam **todos verdadeiros** — o banco segue aberto
> para a chave anon, e a produção segue gravando notícia sem manchete. O que
> mudou foi o **peso**: com o beta assumido, o custo de esperar é menor que o de
> abrir várias janelas de deploy arriscadas. Vira checklist, não alarme.
>
> Não reabrir esta discussão a cada entrega. A ordem de execução no dia está no
> fim da seção do redesign.

Nenhuma das duas é trabalho de código.

### 1. Migration 025 — o banco está aberto para a chave anon

Medido em 02/08 com a chave do próprio `.env`: leitura **e escrita** liberadas em
praticamente todas as tabelas. A chave anon é pública — está dentro do APK
entregue ao cliente e no bundle JS do admin.

[025_rls_fechar_anon.sql](./SQL/migrations/025_rls_fechar_anon.sql) está escrita,
com o teste de verificação no cabeçalho. **Não rodada** — afeta produção na hora.

Verificado que **não quebra nada**: app e admin usam Supabase só para `auth`, e o
backend usa a service key, que faz bypass de RLS.

### 2. Promover `main` + APK de produção

`main` está em `faa38b7` (**junho**), **104 commits atrás** (eram 75 em 04/08).
Tudo que foi feito nas Fases 8 e 9 só chega ao cliente aqui. Requer autorização
explícita — a CLAUDE.md proíbe merge direto em `main`.

🚨 **Isto deixou de ser dívida e virou defeito em produção (10/08).** O
auto-scan roda 24/7 na **produção** — staging é Render free e dorme —, então o
banco compartilhado está sendo alimentado **pelo código de junho**. Medido com
`npx tsx scripts/diagnostico-manchetes.ts 14`: **23 linhas de `news` nos últimos
14 dias, zero com manchete**, incluindo uma de hoje às 13:00. O
`scanPipeline.ts` da `main` não tem uma única menção a `titulo`.

Degrada em silêncio, que é por isso que passou: a coluna é anulável e o app
compõe um título de `tipo + bairro` quando vem null. Ninguém vê erro — vê um
app pior.

Descarta a hipótese de o Filter2 estar falhando: a busca manual do aparelho
aponta pra **staging**, é o mesmo `filter2GPT`, e cria manchete certinho.

O que falta lá, confirmado lendo o código:

| falta | efeito |
|---|---|
| `titulo` no `insertNews` do scan | **toda notícia do auto-scan nasce sem manchete** |
| `brd_json` | a SERP devolve HTML cru, `JSON.parse` falha **em silêncio** |
| paginação com `num` (deprecado) | pula as posições 10-19, perde ~1/3 |
| scraper assíncrono no Top 100 | 660-978s — **a travada que o cliente relatou** |
| query `allintext:` | o Google responde `results_cnt = 0` |
| Fases 8 e 9 inteiras | período respeitado, dedup em camadas, extras, progresso, assuntos na tela |

**Checklist da promoção:**

- [ ] conferir `commit` no `/health` de produção
- [ ] confirmar que a fila de produção manteve o nome **puro** (`manual-search-queue`)
- [ ] rodar uma busca real e conferir `budget_tracking.details`
- [ ] **esperar uma varredura do CRON e rodar `npx tsx scripts/diagnostico-manchetes.ts 2`** — tem que sair >0% com manchete. É a prova de que o scan novo está no ar, e não a versão do `/health`
- [ ] **subir o APK junto** — `cd mobile-app && flutter clean && flutter build apk --dart-define-from-file=env/prod.json`
- [ ] conferir o APK: `unzip -p app-release.apk lib/arm64-v8a/libapp.so | grep -a onrender` tem que dar `sistemaprogestao-7fzs`
- [ ] confirmar `AUTO_SCAN_ENABLED` / `NODE_ENV=production` no Render
- [ ] depois, rodar o **bloco 2** da migration 024 (as faixas `_60d`/`_90d` viram mortas)

⚠️ **Risco aceito pelo João (04/08):** o APK que o cliente tem hoje deixa
escolher 10 cidades e o backend novo aceita 1 → **400** na janela entre promover
a `main` e ele instalar o app novo.

---

## 🎨 Redesign "fio de agência" — o que falta (11/08)

> Contexto que muda a leitura deste roadmap: **o produto está em beta e os
> clientes sabem disso** (João, 11/08). A `main` desatualizada é dívida
> registrada, não incêndio — o plano é acumular tudo e promover **de uma vez
> só**, no fim desta lista.

### ✅ Fase D — as remoções (FEITA em 11/08)

Favoritos (código nas três pontas + migration 031 escrita), o gesto de arrastar
e o `flutter_slidable`, o checkbox "manter conectado", senha mínima 6→8, e a
pista `SEGURE PARA SELECIONAR` de volta ao cabeçalho. Ver DEV_LOG.

Na mesma leva, fora do plano: o `TUDO` do relatório (voltava 400), o balde
adaptativo do gráfico, as silhuetas de carregamento, as pastas de mês e a ordem
cronológica dos três baldes da consulta.

### ⬜ Anatomia comum de `CityCard` e `HistoryCard` — PLANEJADA, NÃO FEITA

🚨 **Este plano foi escrito, discutido com o João e nunca executado** — o arquivo
de plano foi sobrescrito pela Fase D. Registrado aqui para não se perder de novo.

Pedido do João, com as duas listas na mão: *"um eu acho muito simples (busca) e o
outro eu acho muito grande e não sei se essas contagens são úteis de fato"*, e a
direção: *"se fizesse um merge dos dois mas pudesse colocar em cada estrutura
informações úteis para cada propósito"*.

O diagnóstico: a divergência é **estrutural, não de densidade**. O `CityCard`
(~235px) tem quatro elementos, o `HistoryCard` (~90px) tem três, e nenhum
compartilha espaçamento ou degrau de tipo com o outro. E o card diz a mesma coisa
duas vezes — a frase afirma *"Patrimonial responde por 52%, a maior fatia"* e a
linha de baixo mostra `11 PATRIM. · 6 SEGUR.`: o número maior e a maior fatia são
o mesmo fato em duas linguagens. É a redundância, não os números, que faz 235px.

Anatomia de quatro posições, cada tela preenchendo com o que serve ao seu
propósito:

```
① etiqueta esquerda                    ② etiqueta direita     mono 9.5
   NOME DO LUGAR                                              Archivo bold
③ linha de qualificação                                       prosa ou mono
④ FIGURA(S)                                                   número + rótulo
```

| | DASHBOARD | CONSULTAS |
|---|---|---|
| ① | UF + `N NOVAS` em verde | UF |
| ② | `21 EM 30D` | a hora (`08:47`) |
| ③ | prosa — **só se tiver o que dizer** | `30 DIAS · 17 ASSUNTOS` |
| ④ | quebra por categoria | `56 RESULTADOS` |

Regra de ③: só entra o que **nenhuma figura do card mostra**. Grupo → nomeia as
cidades (`Grande Florianópolis` não informa nada a quem não é de lá, e o app é
vendido pra fora da cidade monitorada). Cidade sozinha → fica muda. Cidade
zerada → a frase de vazio ocupa ③ e ④.

No `HistoryCard`, **falha e andamento ocupam ④**, onde ia o número: hoje esses
estados brigam com a hora na linha de cima.

Peça compartilhada nova: `core/widgets/entrada_de_lugar.dart` — o que estava
divergindo eram os espaçamentos e os degraus de tipo, então é isso que a peça
guarda. `Figura` é o `_Figure` privado de `city_card.dart` promovido.

~~**Junto:** matar o `EndMark` e suas 9 chamadas.~~ **Já estava morto** — só
sobrou a lápide em `take_card.dart:485`, zero chamadas. Eu copiei essa pendência
do plano velho para cá sem conferir, e a corrigi cinco minutos depois: é
exatamente o apodrecimento silencioso que a regra zero da workdesk descreve, e
consegui cometê-lo **dentro do documento que registra a regra**.

### ⬜ Fase E2 — export do relatório em HTML A4 autocontido

É onde o `GERADO 11/08 18:21` e a caixa do recorte voltam a fazer sentido:
arquivo que sai do app precisa dizer quando foi feito e o que estava filtrado.

### ⬜ Fase F — notificações

Migration **032** (a 031 é o DROP dos favoritos), digest por cidade, dois canais
Android e tri-estado por categoria. É a maior das que restam.

### ⬜ Revisão de copy, tela por tela — POR ÚLTIMO

Deixar para quando nada mais mudar texto. Já decidido e não feito: a frase de
lista vazia do monitoramento tem que virar **três**, porque hoje uma só cobre
três situações diferentes —

| situação | o que a tela diz |
|---|---|
| monitorada, 30D, nada | `Nada publicado nos últimos 30 dias. A última notícia desta cidade é de 28/07.` |
| nunca teve notícia | `Nenhuma notícia desde que esta cidade entrou no monitoramento, em 23/04.` |
| não carregou | `Não foi possível carregar o relatório.` + `TENTAR DE NOVO` |

A terceira depende de separar "respondeu vazio" de "não respondeu" (ver dívida
técnica).

### ⬜ Fim da linha: promover a `main`

Numa janela só, com tudo acima pronto: merge, conferir `/health`, esperar uma
varredura e rodar `diagnostico-manchetes.ts` (tem que sair >0% com manchete),
**migration 025 → depois 031** (essa ordem), e o APK de produção com
`env/prod.json`.

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
item, com pontos de encaixe e armadilhas, no briefing arquivado em
[Fases/Fase 9/](./Fases/Fase%209/FRONTEND_BRIEFING.md).

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

## 📏 Verificações em aberto

- **`api_rate_limits.brightdata.max_concurrent` nunca foi revisado** — está em
  10, e a doc da Bright Data diz que o limite real é **100 QPS** (uma busca faz
  ~0,07 QPS). Pode subir; só não foi medido.
- **Ramo web: 1 de ~4 medições feitas.** Critério já combinado com o João: se
  seguir entregando ~1 de 23, desligar pelo painel.
- **Período de 180 dias ponta a ponta** — 90 dias foi medido em 02/08 (São
  Paulo, alcance de 90 dias exatos); falta repetir com 180.
- **Tempo da busca depois da migration 028** — o ~11 min medido é anterior a
  ela. É o número que recalibra `_segundosPorAssunto` em `assuntos_field.dart`.

## 🐛 Bugs conhecidos / suspeitas

- **Página vazia da Bright Data** (HTTP 200, 0 bytes, sem `x-brd-err-code`):
  observada em 01/08, causa **desconhecida**. Mitigada com 1 retry desde a 8.1.
- **Filter0 com keywords amplas** (`jogo`, `tempo`, `música`, `esporte`): geram
  falso negativo. Estratégia em aberto.
- **Sem `parent_id` não há pós-filtro nenhum** (`locationPostFilter = undefined`)
  — a cidade aceitaria notícia de qualquer lugar. Hoje as 4 cidades têm pai; é
  latente.
