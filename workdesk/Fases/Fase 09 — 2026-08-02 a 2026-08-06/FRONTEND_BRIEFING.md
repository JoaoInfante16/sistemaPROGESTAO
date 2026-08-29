# Briefing do Frontend — tudo que você precisa para mexer no app

> 🗂️ **Documento da Fase 9** — descreve um estado que deixa de ser verdade quando
> o trabalho terminar ("o app ignora oito campos"). É arquivado em
> `Fases/Fase 9/` no encerramento. Ver [README](./README.md).
>
> Escrito em 2026-08-02, logo depois da reforma do backend. É o documento de
> entrada para quem for desenhar e implementar o Flutter.
>
> **Leia junto:** [API_CONTRATO.md](./API_CONTRATO.md) tem os shapes exatos de
> cada rota — e continua valendo depois desta fase. Este aqui tem o **contexto**:
> o que existe, o que falta, quanto demora, e o que quebra se você fizer errado.

---

## 1. A situação em uma frase

O backend passou de 1 resultado por busca para **77**, e ficou rápido e
observável. O app é de antes disso: ele pede a busca, mostra "passo 4 de 7" e
joga fora **oito campos** que o servidor já manda prontos. **O trabalho aqui não
é pedir dado novo ao backend — é usar o que já chega.**

---

## 2. Números reais — use para calibrar a UI, não chute

Medido em 02/08 numa busca de verdade pelo app (Campo Grande / 60 dias):

```
269 URLs coletadas → 241 baixadas → 151 extraídas → 77 entregues
```

Duração de cada etapa, e é isso que a tela de carregamento precisa comunicar:

| etapa | o que aparece hoje | duração |
|---|---|---|
| 1. Coleta na busca | "passo 1 de 7" | **24s** |
| 2-3. Triagem rápida | "passo 2/3 de 7" | **20s** |
| 4. Leitura das matérias | "passo 4 de 7" | **179s** ⟵ metade do tempo |
| 5. Análise | "passo 5 de 7" | **106s** |
| 6-7. Agrupar e salvar | "passo 6/7 de 7" | ~2s |
| | | **total: 5min31s** |

**Três consequências de design, e as três importam:**

**a) A busca dura minutos, não segundos.** Uma busca de 60 dias leva ~5min30;
uma de 180 dias leva mais. Qualquer desenho que assuma "o usuário espera olhando"
está errado. A busca é um job no servidor e **sobrevive a fechar o app** — a tela
já sabe retomar por `resumeSearchId`, e o push de conclusão já manda o
`search_id`.

**b) Os estágios 4 e 5 são 85% do tempo, e são exatamente os que têm contador.**
`progress.feitos` e `progress.total` avançam a cada ~2 segundos dentro deles. É
por isso que "passo 4 de 7" parado por 3 minutos parece travado — e por isso o
João achou que tinha quebrado, quando estava andando normalmente.

**c) O número final não é o número que a barra vê.** 241 matérias lidas viram 77
cards. Se a UI disser "241 encontradas" e entregar 77, parece que perdeu coisa.
O funil precisa ser mostrado como funil, não como perda.

---

## 3. O app hoje — mapa dos arquivos

41 arquivos em `mobile-app/lib`. Navegação por 3 abas (`main_screen.dart`):
**Dashboard**, **Busca**, **Configurações**.

| arquivo | linhas | papel |
|---|---|---|
| [manual_search_screen.dart](../mobile-app/lib/features/search/screens/manual_search_screen.dart) | 870 | **a tela principal deste trabalho** — formulário, polling, resultados |
| [report_screen.dart](../mobile-app/lib/features/search/screens/report_screen.dart) | 632 | relatório da busca (gráficos, mapa) |
| [api_service.dart](../mobile-app/lib/core/services/api_service.dart) | 474 | **todas** as chamadas HTTP |
| [feed_screen.dart](../mobile-app/lib/features/feed/screens/feed_screen.dart) | 323 | feed do monitoramento automático |
| [news_card.dart](../mobile-app/lib/features/feed/widgets/news_card.dart) | 221 | **card compartilhado** — feed, favoritos e busca usam este |
| [news_item.dart](../mobile-app/lib/core/models/news_item.dart) | 128 | o modelo |

---

## 4. Os oito dados que já chegam e o app joga fora

Esta é a lista de trabalho. Nenhum item aqui precisa de backend novo.

| dado | onde o backend manda | onde o app perde | serve para |
|---|---|---|---|
| `extras.regiao` | `/results` | [api_service.dart:234](../mobile-app/lib/core/services/api_service.dart#L234) lê só `body['results']` | seção "região metropolitana" |
| `extras.fora_do_periodo` | `/results` | idem | seção "mais ocorrências" |
| `estado` | cada item | `fromSearchResult` não preenche `estadoUf` | UF no card de cidade vizinha |
| `source_type` | cada item | não é lido no parse | distinguir portal de veículo |
| `sources[]` | cada item | é lido, mas não exibido | "coberto por 3 veículos" |
| `progress.feitos/total` | `/status` | não é lido | contador real no lugar de "passo 4 de 7" |
| `progress.achados` | `/status` | não é lido | achados aparecendo ao vivo |
| `progress.atualizado_em` | `/status` | não é lido | desistir por estagnação |

**O ponto de encaixe número um** é [api_service.dart:226-235](../mobile-app/lib/core/services/api_service.dart#L226):
`getManualSearchResults` faz `return body['results']` e **descarta `extras`
inteiro**. Enquanto essa função devolver `List<Map>`, os extras não existem para
o app. Ela precisa devolver os três baldes.

---

## 5. Decisões de UI que o João já tomou

Não são sugestões — são decisões, tomadas em 02/08. Vale desenhar em cima delas.

**Os cards ficam.** O `NewsCard` compartilhado continua sendo a unidade visual. O
layout da seção é livre; o backend não pressupõe nada além de `results` +
`extras`.

**Região e "fora do período" vão no fim da lista, expansíveis.** No feed as
notícias já são separadas por data com uma linha divisória
(`_DateHeader`, padrão `Divider — LABEL — Divider`). A ideia é uma linha igual,
em cor destacada, no fim da lista: *"Região metropolitana e mais ocorrências
relevantes"*. Ao tocar, expande e mostra os cards normais. Não polui a visão
padrão e reaproveita um padrão que o usuário já conhece.

⚠️ **Não existe accordion em todo o `mobile-app/lib`** — zero `ExpansionTile`,
`ExpansionPanel` ou `AnimatedCrossFade`. Um `bool` no state + itens condicionais
resolve; não precisa trazer dependência.

**Seletor de período: escolha livre, não botões fixos.** O backend aceita
qualquer inteiro de 1 a 180 e os tetos internos acompanham sem faixas. Slider,
campo ou calendário — o que o design pedir, sem mudar nada no servidor.

**A tela de carregamento deve mostrar o funil ao vivo**, não 7 passos com check:

```
BUSCANDO          ✓  269 encontradas
TRIAGEM RÁPIDA    ✓  241 relevantes        (28 fora)
LEITURA           ⟳  34 de 241             ~2min
ANÁLISE              —
AGRUPAMENTO          —

ÚLTIMOS ACHADOS
  homicídio · Cabula · há 2 dias
  roubo · Pituba · ontem

[ Pode fechar — a gente avisa quando terminar ]
```

Os "últimos achados" são `progress.achados`: os 5 mais recentes, com
`tipo_crime`, `bairro` e `data_ocorrencia`. Eles chegam de graça (o dado já está
em memória no servidor) e transformam a espera em algo que dá vontade de olhar.

---

## 6. As armadilhas — leia antes de codar

### 6.1 Nunca misture `extras` dentro de `results`

**`body['results']` é a lista que o APK do cliente já renderiza.** Se algum dia
os extras forem concatenados nela, a versão que está na mão do cliente passa a
exibi-los na lista e a **contá-los nas estatísticas**, sem ninguém perceber. Foi
exatamente por isso que o contrato ficou com os baldes separados.

### 6.2 `natureza: "estatistica"` não é uma ocorrência

São indicadores — *"homicídios caíram 12% no semestre"*. O backend já os separa
nos agregados, mas eles vêm na mesma lista. Se a UI contar tudo junto, o número
de "ocorrências" infla com coisas que não são ocorrência.

### 6.3 O polling desiste por relógio, e isso está errado

[manual_search_screen.dart:49](../mobile-app/lib/features/search/screens/manual_search_screen.dart#L49):
`_maxPolls = 200` × 3s = **desiste em 10 minutos**, mesmo que a busca esteja
andando perfeitamente.

Esse número mágico é o que trava duas coisas do lado do backend:

| trava atual | volta para | onde |
|---|---|---|
| `periodo_dias` ≤ 180 | 365 | `validation.ts` |
| 1 cidade por busca | 10 | `validation.ts` + `multi_city_search_field.dart` |

**Trocar por desistir por estagnação destrava as duas** — e cada uma é literalmente
mudar um número, dos dois lados. A regra: enquanto `progress.feitos` ou
`progress.atualizado_em` avançarem, continue esperando; parado há ~2 minutos, aí
é falha. Some o número mágico e qualquer lentidão futura fica coberta.

⚠️ **Backend e APK sobem juntos** quando esses limites mudarem. O APK que o
cliente tem hoje deixa escolher até 10 cidades; se o backend estiver em `max(1)`,
quem escolher 2 toma **400**.

### 6.4 O 409 não é mais um beco sem paradas

Só existe **uma busca por vez** por usuário. Ao tentar a segunda, o backend
devolve `409` — mas agora com `searchId`, `params` e `progress` da busca em
curso. Dá para oferecer *"Salvador em andamento (42%) — ver progresso / cancelar"*
em vez de um erro seco.

E se a busca anterior morreu de verdade (sem avanço há 20 min), o backend a marca
como falha sozinho e **deixa a nova passar** — o usuário não fica preso.

### 6.5 O relatório e o mapa filtram os extras de propósito

`/analytics/report` e `/analytics/map-points` seguem **só** o recorte que o
usuário pediu. No mapa isso é crítico: o geocode roda contra a cidade da
requisição, então um bairro de Camaçari viraria um pino dentro de Salvador.

Quando o app ganhar filtro por período/região, esses endpoints precisam do mesmo
recorte — hoje é fixo.

---

## 7. O calendário (quando chegar a hora)

A restrição que define o desenho: **o Google só pagina de hoje para trás.**

> Buscar 1 a 31 de março custa **o mesmo** que buscar os últimos cinco meses.
> A largura do intervalo é irrelevante; o que custa é quão longe fica o início.

O lado bom: se a busca já atravessou até março, ela **coletou tudo no caminho** —
que é exatamente o balde `fora_do_periodo`.

Então o calendário é quase de graça, e é trabalho de **app**, não de servidor:

1. **Re-fatiar client-side** o que a busca já trouxe (principal + `fora_do_periodo`).
   Os itens carregam `data_ocorrencia`.
2. Só quando o usuário puxar para **antes do que foi coletado**, oferecer
   *"buscar esse período"* — que é uma busca nova com `periodo_dias` maior.

⚠️ `_computeAnalytics` ([report_screen.dart:138-212](../mobile-app/lib/features/search/screens/report_screen.dart#L138))
roda **uma vez no `initState`** e varre tudo sem filtro. Precisa virar **função de
um subconjunto filtrado**, chamada no `setState`. É a mesma mecânica dos toggles
de região e período: **lista e relatório viram função de um recorte**. Fazendo um,
os outros saem quase de graça.

É também o que **paga** a busca longa: gasta-se ~$0,50 uma vez e re-fatia infinitas
vezes sem custo nenhum.

---

## 8. Ordem sugerida

1. **`getManualSearchResults` devolve os três baldes** — sem isso, nada dos
   extras existe. É a mudança que destrava o resto.
2. **Contador real na tela de carregamento** (`feitos`/`total`) — maior ganho
   percebido pelo menor esforço; ataca o "parece travado" direto.
3. **Desistir por estagnação** — destrava período de 365 dias e multi-cidade.
4. **Seção expansível no fim da lista** — região + fora do período.
5. **Achados ao vivo** — o charme, e é de graça.
6. **Calendário e re-fatiar** — depende do passo 1 e é o maior dos seis.

---

## 9. Como rodar e testar

```bash
cd mobile-app
run-dev.bat          # dev local — ajustar o IP em env/dev.json
build-staging.bat    # APK de staging (Sentry OFF)
```

- **Device físico via LAN IP, nunca emulador** — emulador não simula push real.
- `flutter clean` antes de qualquer build visual; hot reload só pelo terminal do
  VSCode.
- Backend de staging: `https://simeops-backend.onrender.com`

⚠️ **Produção ainda roda o código de junho.** Teste contra **staging** — é onde a
reforma está. Ver [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md), item 2.
