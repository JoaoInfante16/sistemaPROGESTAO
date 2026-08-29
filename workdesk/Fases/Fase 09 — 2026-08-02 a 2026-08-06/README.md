# Fase 9 — O app à altura do backend

> **02/08 a 06/08/2026.** Recortada em 27/08, na reorganização da workdesk.
>
> Esta pasta é auto-contida: dá para entender a fase inteira sem sair dela. Os
> documentos aqui são um **retrato do encerramento** e não são mais atualizados —
> as versões vivas estão em [../../](../../).

---

## O que esta fase resolveu

A Fase 8 deixou o backend bom e o app não sabia disso: **oito campos já
entregues que o Flutter descartava**. Esta fase fez o app consumir todos.

| # | o quê |
|---|---|
| 9.1 | `getManualSearchResults` devolve os três baldes (principal, vizinha, fora do período) |
| 9.2 | contador real na tela de carregamento — o funil ao vivo |
| 9.3 | o polling desiste por **estagnação**, não por relógio |
| 9.4 | seção expansível no fim da lista |
| 9.5 | achados ao vivo |
| 9.6 | calendário e re-fatiar client-side — o relatório vira função do recorte |
| 9.7 | deep link do push abre o resultado direto |

Além do planejado: linguagem visual com tokens, `NewsCard` e `CityCard`
redesenhados, recorte único com grupos colapsáveis, mapa com tap/legenda, e o
mapa dentro do PDF do relatório web.

**A validação que fechou a fase** — Goiânia, 34 dias, 17 assuntos:

```
619 URLs (eram ~106)  →  393 baixados  →  77 resultados (eram 11)
~$0,295 total  =  $0,0038 por notícia, contra $0,0058 antes
```

Mais volume **e** mais barato por resultado.

---

## Os documentos

| doc | o que tem |
|---|---|
| [DEV_LOG.md](./DEV_LOG.md) | o diário completo da fase, com as medições |
| [ROADMAP.md](./ROADMAP.md) | o plano como estava em 04/08 |
| [ARQUITETURA.md](./ARQUITETURA.md) | retrato do sistema no fim da fase |
| [FRONTEND_BRIEFING.md](./FRONTEND_BRIEFING.md) | o documento de **entrada** da fase — descreve o app ignorando os oito campos, problema que a própria fase resolveu |

---

## As descobertas que valem para sempre

- **O funil perde por GEOGRAFIA, não por extração.** Em Goiás, 57% das rejeições
  eram `filter2_location` — e 32 delas eram cidades do próprio Goiás. Notícia
  real, coletada, paga e descartada por não ser a capital.
- **A "região metropolitana" do GPT alucina** e foi medida: Goiânia → Mara Rosa
  (350 km); Porto Alegre → Maricá, que fica no Rio. As de outro estado são
  inofensivas (o pós-filtro exige o estado bater); as do mesmo estado, longe,
  **passam**.
- **Timestamps do Postgres vêm sem fuso** e o Dart parseia como local — dava 3h
  adiantado no app.
- **A workdesk não copia o código.** A regra zero nasceu aqui, em 04/08, quando a
  ARQUITETURA afirmava quatro coisas falsas dentro de uma caixa escrita "LEIA
  ANTES DE MEXER".

## Os erros que a fase cometeu

- **O `BACKEND_PENDENTE.md` era um segundo ROADMAP** — cinco das oito seções
  eram duplicata literal. Foi absorvido em 04/08. Em 27/08 ainda havia **onze
  links mortos** apontando para ele.
- **O arquivo de plano é um slot único e foi sobrescrito**, levando junto o plano
  da anatomia comum de `CityCard`/`HistoryCard`, que teve de ser reconstruído de
  memória para o ROADMAP.

---

## O que ficou aberto (e foi para a Fase 10)

- Testar no device físico contra staging — nada tinha sido validado visualmente.
- O redesign inteiro, que virou a Fase 10.
- 🚨 Migration **025** (RLS) e a promoção da `main` — as duas atravessaram para a
  Fase 11 e só fecharam em 16/08.
