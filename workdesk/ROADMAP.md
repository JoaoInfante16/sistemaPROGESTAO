# ROADMAP — SIMEops (Fase 12)

> 🗂️ **Documento da Fase 12** — arquivado em `Fases/Fase 12/` quando ela fechar.
> Ver [CLAUDE.md](../CLAUDE.md), seção 2.
>
> **Futuro, e só futuro.** Planos, backlog e dívida que atravessa fases.

## Como este documento funciona

Três seções, e um item vive em **uma** delas:

| seção | o que entra |
|---|---|
| 🔴 **AGORA** | decidido, com dono, na fila desta fase |
| 🟡 **DEPOIS** | decidido que vale, sem data — pega quando abrir espaço |
| 🔵 **IDEIAS** | não decidido; entra sem custo, sai sem culpa |

🚨 **Item feito SAI daqui.** Não vira `✅` de troféu — a história dele já está no
[DEV_LOG](./DEV_LOG.md), na data em que aconteceu.

🚨 **Estado atual do sistema não mora aqui** — é a [ARQUITETURA](./ARQUITETURA.md).
Antes de escrever "X está quebrado", **confirme na fonte**.

---

# 🔴 AGORA

### 🚧 A fase nova — níveis de acesso e comportamento por usuário

🧊 **A `main` fica congelada durante esta fase** — trabalho em `develop` e
`staging`, produção só recebe conserto. A regra e o porquê moram na
[ARQUITETURA](./ARQUITETURA.md), seção 3.2; não duplicar aqui.

⏳ **Esperando o briefing** (feito pelo João no Claude WEB, 29/08). Nada aqui é
decisão ainda; a spec sai depois de discutir e refinar.

O que já foi **medido no código** em 29/08, e que define o tamanho do buraco:

- **Existe UM nível de acesso: `user_profiles.is_admin` (boolean).** Só isso.
- **Fora do push, nada é escopado por usuário.** O feed e o analytics entregam a
  lista de cidades **que o cliente mandar** (`resolverCidades`,
  [analyticsRoutes.ts](../backend/src/routes/analyticsRoutes.ts)) sem conferir
  direito nenhum; a busca manual é liberada por uma config **global**
  (`search_permission`), sem teto de gasto individual.
- **Não existe conceito de cliente/organização/tenant** — nem tabela, nem coluna,
  nem FK. `news` nem tem chave para `monitored_locations`: a ligação é o **texto**
  da coluna `cidade`, então o eixo natural de recorte é lista de cidades por
  usuário, que encaixa no `.in('cidade', [...])` que o código já usa.
- O único recorte individual que existe é `user_notification_prefs`, e ele decide
  **o que vibra, não o que aparece**.

🚨 **Dois achados que a fase nova transforma de inofensivos em graves:**

- **`/manual-search/:id/results`, `/status` e `/cancel` não checam dono.** O
  `DELETE` checa (`.eq('user_id', userId)`), os três não. Com dois clientes no
  mesmo banco isso é vazamento — e o `searchId` viaja no payload do push.
- **A RLS está fechada em 19/19, então o backend é a única barreira.** Bom para
  centralizar autorização num lugar só; ruim porque um `where` esquecido vaza em
  silêncio, sem segunda trava.

### 🚨 O `/goto` do Google — remendo no ar, conserto de verdade pendente

- ⬜ **Provar no Render.** O remendo foi medido de IP residencial (20/20). O
  Google desconfia de IP de datacenter. A resposta está no log `goto: N/M
  resolvidos` depois do deploy — **não deduzir, ler o log**.
- ⬜ **Enviar o chamado à Bright Data.** Texto pronto (pt-BR e inglês). O
  argumento: a doc deles documenta `news[].link` como *"the URL of the news
  article"*, e devolver caminho relativo sem host é defeito independente.
- ⬜ **Alerta de "N scans seguidos sem achar nada".** É o que faltou: três dias
  de `news_found=0` de hora em hora, sem ninguém avisado. O log do `goto` cobre
  esta causa; o alerta cobre **qualquer** causa futura.
- 🔵 Cache do `goto` no Redis — o mesmo código se repete entre scans. Não foi
  feito para manter o remendo pequeno; vale se o volume incomodar.
- 🔵 Se o Google fechar a porta: **zone de Web Unlocker própria** (a atual é de
  SERP e recusa `/goto` com `invalid_path`) ou trocar para a DataForSEO, que já
  resolve 99,99%.
- ⬜ **São Paulo entrou no monitoramento em 29/08** (cidade e estado) para o
  teste do João. Se não é para monitorar de verdade, desativar — entra no rodízio
  e soma custo.

### Herdado da Fase 11 — o ciclo de release que não fechou

- ⬜ **`Manual Deploy` no Render** (a `main` não tem auto-deploy) e conferir o
  `commit` no `/health`. Pendente desde 26/08; em 29/08 a `main` estava em
  `e1aa6ef`, oito commits atrás da `develop`.
- ⬜ **Subir o AAB** no Play Console — testa, de quebra, se o Google aprovou a
  redefinição da chave de upload pedida em 06/08.
- ⬜ **Segundo admin.** Existe **um só** (`joao.infante16@gmail.com`). Ele se
  trancou fora da conta em 16/08 e a única saída foi um script com a service
  key. Sem um segundo admin, isso se repete sem ninguém para socorrer.
- ⬜ **Backup do `simeops-release.jks` fora da máquina.** É o mesmo arquivo que
  já se perdeu uma vez, e `.gitignore` não protege contra notebook quebrado.
- ⬜ **Migration 024** (opcional, agora só limpeza) — apaga 7 configs mortas.
- ⬜ **`applicationIdSuffix` por variante.** Staging e produção viraram o mesmo
  app no aparelho; separar exige o sufixo **mais** um cliente Firebase para ele.
  ⚠️ Se a fase nova mexer em perfis, o desenho disto pode mudar — não começar
  antes da spec.


### Verificações em aberto — medições que faltam

- **`api_rate_limits.brightdata.max_concurrent` nunca foi revisado** — está em
  10, e a doc da Bright Data diz que o limite real é **100 QPS** (uma busca faz
  ~0,07 QPS). Pode subir; só não foi medido.
- **Ramo web: 1 de ~4 medições feitas.** Critério já combinado com o João: se
  seguir entregando ~1 de 23, desligar pelo painel.
- **Período de 180 dias ponta a ponta** — 90 dias foi medido em 02/08 (São
  Paulo, alcance de 90 dias exatos); falta repetir com 180.
- **Tempo da busca depois da migration 028** — o ~11 min medido é anterior a
  ela. É o número que recalibra `_segundosPorAssunto` em `assuntos_field.dart`.

### Bugs conhecidos / suspeitas

- **Página vazia da Bright Data** (HTTP 200, 0 bytes, sem `x-brd-err-code`):
  observada em 01/08, causa **desconhecida**. Mitigada com 1 retry desde a 8.1.
- **Filter0 com keywords amplas** (`jogo`, `tempo`, `música`, `esporte`): geram
  falso negativo. Estratégia em aberto.
- **Sem `parent_id` não há pós-filtro nenhum** (`locationPostFilter = undefined`)
  — a cidade aceitaria notícia de qualquer lugar. Hoje as 4 cidades têm pai; é
  latente.

---

---

# 🟡 DEPOIS

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


---

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


---

### Acabamento de cor nas telas fora do redesign

Verificado em 27/08: `Colors.*` cru ainda vive em `login`, `settings` e
`history_card` — telas que ficaram fora do escopo da Fase 10. Não é bug, é
inconsistência: essas três não passam pela escala de tinta do
[DESIGN_CONTRATO](./DESIGN_CONTRATO.md).

---

### 🗺️ Onde buscar — a alavanca que o funil revelou (03/08)

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


---

### ⚡ Acelerar o estágio 4 (backend, decidido em 02/08)

> ⚠️ **Renumerada de "Fase 10" para "Fase 12" em 27/08.** As fases 10 e 11 foram
> criadas retroativamente no recorte da workdesk (a antiga "Fase 9" era seis
> trabalhos num documento só). Este item nunca começou — só o número mudou.

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


---

### 🔧 Dívida técnica

- **Migration 024** — 7 configs mortas, pronta e não rodada. Neutra.
- `openai` ^4.24.1 → v6.
- Flutter: `fl_chart` 0.70→1.x, `share_plus` 10→12, `flutter_map` 7→8,
  `sentry_flutter` 8→9.
- **Renomear "Netrios News" → "SIMEops"** (diretório e repo).


---

# 🔵 IDEIAS

### 🆕 Saiu de 17/08 — decidir

- 🚨 **O balde `outros` tem ocorrência legítima sem tipo.** Ele não está na
  taxonomia (é tipo, nunca vira pergunta), mas hoje guarda **desaparecimento de
  pessoa**, **suspeita de bomba** e **sequestro/tortura**. As três interessam ao
  cliente e as três aparecem no app como "Outros". Decidir se viram tipo próprio
  — `desaparecimento` é o mais frequente dos três.
- **Estatística nacional entra como se fosse local.** *"Uma em cada dez
  brasileiras sofre violência digital"* foi gravada com `cidade =
  Florianópolis` porque a query era sobre Florianópolis. A lista negativa da
  regra 2 (17/08) **não** cobre isso: é defeito de localização, não de
  classificação. Provável conserto: exigir que a estatística cite a cidade ou o
  estado monitorado.
- **Reconferir o volume por volta de 21/08.** 31 notícias em 17/08 contra média
  de 2,0/dia. Se firmar acima de ~10/dia, revisar de novo o formato do push (a
  janela de agrupamento hoje é a rodada de scan, não o relógio) e o custo de
  Jina + GPT, que escala junto.
- **Manchetes cortadas no meio da palavra continuam gravadas.** O conserto
  (`cortarNaPalavra`) vale só para linha nova. Regravar as antigas exigiria
  passar GPT de novo — provavelmente não vale.

### 💡 Em aberto (não decidido)

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


---

### 🌐 Domínio próprio do relatório (12/08)

O link que vai pro cliente é
`sistemaprogestao-7fzs.onrender.com/public/report/<uuid>`. Funciona, e **não
piorou nada** (o `ADMIN_PANEL_URL` de antes também era subdomínio do Render), mas
não é endereço de peça de apresentação.

**Do nosso lado já está pronto:** `urlPublica()` lê `PUBLIC_BASE_URL` antes de
qualquer coisa. É variável de ambiente no Render, **zero linha de código**.

Levantado em 12/08, e é por isso que fica pra depois:

- `progestao.com.br` existe (NS na Locaweb, MX da Locaweb) mas é de **outra
  empresa de mesmo nome** — não dá pra usar.
- `simeop.com.br`, que o João chegou a cadastrar no Render, **não está
  registrado** (NXDOMAIN no `.com.br`) — não existe zona onde criar o CNAME, e
  por isso a verificação do Render nunca ia passar, por mais que se apertasse
  "Retry".
- Caminho: registrar `simeops.com.br` no registro.br (~R$ 40/ano), CNAME
  `relatorios` → o serviço do backend, e setar `PUBLIC_BASE_URL`.

**Junto, quando for a hora:** encurtar a rota pra `/r/<id>` — é uma linha, e a
hora certa é antes de existir link antigo por aí.

### 🔎 Achado solto, do mesmo levantamento

`services/geocoding/nominatim.ts` manda `contact@progestao.com.br` no User-Agent,
em 3 lugares — o domínio de outra empresa. A política de uso do OSM pede contato
válido pra poder avisar sobre abuso antes de bloquear. Trocar quando houver
e-mail próprio.
