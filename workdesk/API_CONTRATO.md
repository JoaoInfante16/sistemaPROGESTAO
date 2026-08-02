# Contrato da API — para quem for mexer no app

> Escrito em 2026-08-02, fim da Fase 8, para a instância que vai desenhar o
> frontend. Descreve **o que o backend entrega hoje** — não o que seria bom ter.
>
> Backend staging: `https://simeops-backend.onrender.com`
> Backend produção: `https://sistemaprogestao-7fzs.onrender.com`
>
> ⚠️ **Produção ainda roda código de junho** (`main`). Tudo marcado com 🆕 existe
> só em `staging`/`develop`. Ver [ROADMAP](./ROADMAP.md), Prioridade 1.

---

## Regra que não pode ser quebrada

**`body['results']` é a lista que o app já renderiza.** Ela continua sendo
**apenas o balde principal**, com o mesmo shape de sempre. Tudo que a Fase 8
acrescentou vai pendurado em `extras`, ao lado.

Se algum dia os extras forem misturados em `results`, o APK que está na mão do
cliente passa a exibi-los na lista e a contá-los nas estatísticas, sem ninguém
perceber. Foi por isso que o contrato ficou assim.

---

## Fluxo da busca manual

```
POST /manual-search            → cria e enfileira, devolve searchId
GET  /manual-search/:id/status → polling (o app faz a cada 3s)
GET  /manual-search/:id/results→ resultado final
POST /manual-search/:id/cancel → cancela
GET  /manual-search/history    → últimas 20 buscas do usuário
DELETE /manual-search          → { ids: [...] }
```

### POST /manual-search

```jsonc
// request
{
  "estado": "Bahia",
  "cidades": ["Salvador"],   // 🆕 EXATAMENTE 1 — ver nota abaixo
  "periodo_dias": 30,        // 1 a 180, qualquer inteiro
  "tipo_crime": "homicidio"  // opcional
}
```

**🆕 `cidades` aceita exatamente 1.** A região metropolitana entra sozinha, e o
custo é o mesmo. Mandar 2 devolve **400**. O widget do app já foi ajustado
(`MultiCitySearchField`, `maxCities: 1`) — **backend e APK precisam subir juntos.**

**`periodo_dias` é livre**, não uma lista de opções: 1 a 180, qualquer inteiro.
Slider, campo, calendário — o que o design pedir. Os tetos internos acompanham
sem faixas. O limite de 180 é temporário (por causa do polling de 10 min); volta
a 365 depois que o app desistir por estagnação.

| resposta | quando | corpo |
|---|---|---|
| `201` | ok | `{ searchId, status: "processing" }` |
| `409` | já há busca rodando | 🆕 `{ error, searchId, params, progress }` |
| `400` | validação | erro do zod |

**🆕 O 409 agora é acionável.** Traz `searchId` e o `progress` da busca em curso —
dá para oferecer *"Salvador em andamento (42%) — ver progresso / cancelar"* em vez
de um erro seco. Só acrescentou campos; o app atual não quebra.

Se a busca anterior morreu (sem avanço de progresso há 20 min), o backend a marca
como `failed` sozinho e **deixa a nova passar** — não devolve 409.

### GET /manual-search/:id/status

```jsonc
{
  "status": "processing",       // processing | completed | failed | cancelled
  "total_results": null,        // só o PRINCIPAL, quando completed
  "report_id": null,            // se já existe relatório gerado
  "params": { "estado": "...", "cidades": ["..."], "periodo_dias": 30 },
  "progress": {
    "stage": "fetching",
    "stage_num": 4,
    "total_stages": 7,
    "details": "155 artigos",

    // 🆕 contador DENTRO do estágio — estágios 4 e 5 apenas
    "feitos": 34,
    "total": 155,

    // 🆕 últimos 5 achados, mais recente primeiro (só no estágio 5)
    "achados": [
      { "tipo_crime": "homicidio", "bairro": "Cabula", "data_ocorrencia": "2026-07-31" }
    ],

    // 🆕 ISO. Última vez que ALGO se mexeu — base para "desistir por estagnação"
    "atualizado_em": "2026-08-02T18:31:04.221Z",

    "history": [ { "stage_num": 1, "details": "...", "started_at": "..." } ]
  }
}
```

Os 7 estágios:

| # | `stage` | o que faz | tem contador? |
|---|---|---|---|
| 1 | `searching` | coleta na SERP | não |
| 2 | `filtering` | Filter0 (regex) | não |
| 3 | `filtering` | Filter1 (GPT em lote) | não |
| 4 | `fetching` | baixa o texto (Jina) | 🆕 **sim** |
| 5 | `analyzing` | Filter2 + embedding | 🆕 **sim** + achados |
| 6 | `dedup` | consolida | não |
| 7 | `saving` | grava | não |

**Os estágios 4 e 5 são os longos** — juntos, a maior parte do tempo. São
exatamente os que ganharam contador, porque é neles que parecia travado.

Escrita estrangulada em ~1 a cada 2s (o polling é de 3s, mais que isso não
apareceria). O último item de cada estágio sempre escreve, então a barra fecha
em 100%.

**Sugestão para o app:** trocar `_maxPolls = 200` (desiste em 10 min de relógio)
por **desistir por estagnação** — enquanto `feitos` ou `atualizado_em` avançam,
seguir esperando; parado há ~2 min, aí é falha. Some o número mágico.

### GET /manual-search/:id/results

```jsonc
{
  "results": [ /* SÓ o principal — shape idêntico ao de sempre */ ],
  "extras": {                                    // 🆕
    "regiao":          [ /* cidades vizinhas */ ],
    "fora_do_periodo": [ /* mais antigas que a janela */ ]
  }
}
```

Cada item aparece em **exatamente um** dos três. Quem é vizinha *e* velha conta
como vizinha — mas os dois sinalizadores viajam no item, então dá para saber a
verdade completa.

Shape do item:

```jsonc
{
  "tipo_crime": "homicidio",
  "natureza": "ocorrencia",        // "estatistica" NÃO é ocorrência — ver nota
  "categoria_grupo": "seguranca",
  "cidade": "Camaçari",
  "estado": "Bahia",               // 🆕 antes era descartado; use para a UF do card
  "bairro": "Gleba B",
  "rua": null,
  "data_ocorrencia": "2026-07-31",
  "resumo": "...",
  "confianca": 0.9,
  "source_url": "https://...",
  "source_type": "news",           // "news" | "web" — hoje o app descarta
  "sources": [ { "url": "...", "type": "news" } ],   // todas as fontes do cluster

  "cidade_vizinha": true,          // 🆕 só aparece quando true
  "fora_do_periodo": true          // 🆕 só aparece quando true
}
```

⚠️ **`natureza: "estatistica"` não é ocorrência.** São indicadores ("homicídios
caíram 12% no semestre"). O backend já os separa nos agregados; a lista precisa
tratá-los diferente ou eles inflam a contagem.

---

## Relatório e mapa

```
POST /analytics/report          → gera/retorna o relatório de uma busca
GET  /analytics/executive       → resumo executivo (GPT, cacheado)
POST /analytics/map-points      → { cidade, estado, dateFrom, dateTo, searchId? }
GET  /public/report/:id         → relatório compartilhável, sem auth
```

**Os dois filtram os extras**, de propósito: o relatório e o radar seguem o
recorte que o usuário pediu. No mapa isso é crítico — o geocode roda contra a
cidade **da requisição**, então um bairro de Camaçari viraria pino dentro de
Salvador.

📌 Quando o app ganhar o filtro por período/região (calendário), esses endpoints
precisam ganhar o mesmo recorte — hoje é fixo. Ver Fase 10 no ROADMAP.

---

## Feed, favoritos, devices

```
GET    /news/feed              → feed principal
GET    /news?cidades=A,B,C     → filtrado (aceita lista separada por vírgula)
GET    /news/favorites
POST   /news/:id/favorite      /  DELETE /news/:id/favorite
POST   /news/:id/read          /  POST /news/mark-all-read
GET    /news/unread-count
POST   /devices                → registra o token FCM
DELETE /devices
```

## Auth e público

```
GET  /auth/me                  POST /auth/change-password
POST /auth/request-reset
GET  /public/auth-required     → se o app deve exigir login
GET  /public/locations         → cidades disponíveis, sem auth
```

## Push

O push de conclusão **já existe e já manda o `search_id`**:

```jsonc
{ "search_id": "...", "type": "manual_search_completed" }   // ou _failed
```

📌 Falta o **deep link** abrir o resultado direto. Hoje o push chega e o usuário
tem que navegar até o histórico. A tela já sabe retomar por `resumeSearchId`.

---

## O que o backend manda e o app ainda ignora

Matéria-prima pronta, esperando UI:

| dado | onde | serve para |
|---|---|---|
| `extras.regiao` | results | seção "região metropolitana" |
| `extras.fora_do_periodo` | results | seção "mais ocorrências" |
| `estado` | cada item | UF no card de cidade vizinha |
| `source_type` | cada item | distinguir portal de veículo |
| `progress.feitos/total` | status | contador real no lugar de "passo 4 de 7" |
| `progress.achados` | status | achados aparecendo ao vivo |
| `progress.atualizado_em` | status | desistir por estagnação |
| `sources[]` | cada item | "coberto por 3 veículos" |

Conceito de UI que o João já definiu, e os pontos de encaixe verificados no
código Flutter, estão na **Fase 9** do [ROADMAP](./ROADMAP.md).
