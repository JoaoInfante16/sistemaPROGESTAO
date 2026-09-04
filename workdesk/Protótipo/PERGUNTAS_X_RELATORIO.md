# AS 39 PERGUNTAS × O RELATÓRIO — o que vira indicador e o que se perde

> 📌 Medido em 01/09/2026 sobre `Report Diário - Consultor.xlsx` (1.485 registros,
> 24/11/2025 a 18/06/2026) e as 14 capturas do Power BI em `Relatório/`.
>
> ⚠️ **Este documento não propõe cortar pergunta nenhuma.** A coluna vertebral é
> da SIC — ver [MUDANCAS.md](./MUDANCAS.md). Ele existe para responder *"o que a
> operação coleta e não chega a ninguém?"*, que é a pergunta 3.4 da
> [REUNIAO_SIC.md](./REUNIAO_SIC.md).

---

## Como ler

| coluna | o que traz |
|---|---|
| **preench.** | quantos dos 1.485 registros têm resposta |
| **valores** | quantos valores distintos existem, e quantos aparecem **uma única vez** |
| **no painel** | ✅ vira gráfico · ⚠️ vira gráfico ilegível · ❌ não aparece · 🔎 é filtro |

📍 **Ilegível não é o Power BI errando.** Ele desenha fielmente o que recebe: um
campo com 177 valores vira 177 barras de um pixel. A causa está na coleta.

---

## Bloco 1 — identificação da visita

| # | pergunta | preench. | valores | no painel |
|---|---|---|---|---|
| 1 | `Consultor` | 1.485 · 100% | 26 (2 únicos) | ✅ `Responsável Atendimento` |
| 2 | `Qual a UF da unidade…` | 1.084 · **73%** | 11 | 🔎 filtro `UF Atendida` |
| 3 | `Bandeira Atendida` | 1.485 · 100% | 13 (7 únicos) | ⚠️ `Bandeira Atendida` — traz `Alvorada` com 1 |
| 4 | `Atacadão` | 824 · 55% | **143 (76 únicos)** | ⚠️ `Loja Atendida` |
| 5 | `Loja Carrefour Bairro` | **0 · 0%** | 0 | ❌ coluna existe e nunca foi usada |
| 6 | `Loja Carrefour Express` | 145 · 10% | 24 (10 únicos) | ⚠️ `Loja Atendida` |
| 7 | `Loja Carrefour Hiper` | 319 · 21% | 17 (10 únicos) | ⚠️ `Loja Atendida` |
| 8 | `Loja Sam's Club` | 239 · 16% | 21 (9 únicos) | ⚠️ `Loja Atendida` |
| 9 | `Data do registro` | 1.485 · 100% | 187 datas | ✅ `Atendimentos por Mês` + filtro |
| 10 | `Turno` | 1.485 · 100% | 3 | ✅ donut de turno |

🚨 **A loja mora em cinco colunas, uma por bandeira.** São 205 grafias somadas
para ~98 lojas reais, e **14 registros têm mais de uma coluna preenchida** — a
mesma visita contada em duas bandeiras. A `Loja Carrefour Bairro` está vazia nos
1.485 registros: ou a operação não atende essa bandeira, ou o campo nunca
funcionou.

## Bloco 2 — território e estrutura

| # | pergunta | preench. | valores | no painel |
|---|---|---|---|---|
| 11 | `Houve movimentações atípicas no fluxo de pessoas?` | **1.485 · 100%** | 2 | ❌ **não aparece** |
| 12 | `Presença de risco no entorno` | 1.485 · 100% | 2 | ✅ Sim 1.043 · Não 660 |
| 13 | `Classificação de risco externo` | 1.416 · 95% | **113 (62 únicos)** | ⚠️ treemap — `Sem risco` convive com riscos |
| 14 | `Presença de policiamento na unidade` | 1.431 · 96% | 22 (9 únicos) | ⚠️ PM 726 · Não 562 · GCM 433 |
| 15 | `Houve falhas estruturais visíveis?` | 1.485 · 100% | 2 | ✅ Não 1.131 · Sim 572 |
| 16 | `Tipo de falha` | 502 · 34% | **72 (41 únicos)** | ⚠️ donut `Falhas identificadas` |
| 17 | `Descreva as falhas identificadas` | 130 · 9% | 74 (68 únicos) | ❌ texto livre — esperado |

🔑 **A 11 é o caso mais gritante do documento:** obrigatória, respondida em toda
visita desde novembro, apenas dois valores possíveis — e **nunca virou gráfico
nenhum**. Custa uma pergunta ao consultor 1.485 vezes e não chega a ninguém.

## Bloco 3 — forças de segurança

| # | pergunta | preench. | valores | no painel |
|---|---|---|---|---|
| 18 | `Houve contato com forças de segurança?` | 1.485 · 100% | 2 | ✅ Não 1.101 · Sim 602 |
| 19 | `Alguma ação conjunta foi discutida ou realizada?` | 1.485 · 100% | 2 | ✅ Não 1.440 · Sim 263 |
| 20 | `Explique o item acima` | 114 · 8% | 101 (95 únicos) | ❌ texto livre — esperado |

## Bloco 4 — processos internos

| # | pergunta | preench. | valores | no painel |
|---|---|---|---|---|
| 21 | `Algum processo apresentou vulnerabilidade?` | 1.485 · 100% | 3 | ✅ Não 1,0 mil · Sim 0,5 mil |
| 22 | `Qual processo?` | 468 · 32% | **54 (36 únicos)** | ⚠️ Prevenção 304 · Vigilância 248 |
| 23 | `Descreva o motivo da falha abaixo` | 333 · 22% | **264 (245 únicos)** | ❌ texto livre — esperado |
| 24 | `Algum colaborador ou terceirizado… negligente` | 646 · 44% | 2 | ✅ Não 497 · Sim 197 |
| 25 | `Escala de risco dos processos internos` | 646 · 44% | 10 | ✅ **8,02** — um dos dois números grandes |

## Bloco 5 — a ocorrência

| # | pergunta | preench. | valores | no painel |
|---|---|---|---|---|
| 26 | `…quem identificou inicialmente a ameaça` | 784 · 53% | **76 (62 únicos)** | ⚠️ **espigão de 1 pixel** |
| 27 | `Classificação da ameaça` | 730 · 49% | 16 (5 únicos) | ❌ **não aparece** |
| 28 | `Tipificação jurídica associada` | 747 · 50% | **103 (64 únicos)** | ⚠️ **espigão de 1 pixel** |
| 29 | `Setor envolvido` | 583 · 39% | **177 (134 únicos)** | ⚠️ o pior: maior barra tem 57 |
| 30 | `Produto objeto do caso (descrito)` | 465 · 31% | **351 (325 únicos)** | ❌ texto livre — esperado |
| 31 | `Houve tentativa ou consumação?` | 430 · 29% | 12 (4 únicos) | ❌ **não aparece** |
| 32 | 🔑 `Se tentado — Valor Recuperado/Prevenido` | 360 · 24% | **R$ 2.581.696 líquidos** | ❌ **não aparece** |

🔑 **A 26 tem quatro respostas cobrindo 88%** — `Consultor SIC` 558, `Time
Prevenção` 92, `Supervisor Prevenção` 25, `Gerência` 17. As outras 62 aparecem uma
vez cada (`Cftv`, `Segurança interna.`, `Sem ocorrência nesta data`) e são elas
que fazem o espigão.

🔑 **A 32 é a mais valiosa da operação e não chega ao cliente.** R$ 3.004.283,98
brutos, menos os 53 registros marcados `Consumado` (R$ 422.587,98), dão
**R$ 2.581.696,00 em 7 meses**. O relatório mostra `8,02` e `4,29` no lugar.

## Bloco 6 — resposta e desfecho

| # | pergunta | preench. | valores | no painel |
|---|---|---|---|---|
| 33 | `Ocorrência formalizada — (Cliente ou DP)?` | 700 · 47% | 3 | ✅ Interno 452 · Não 273 · DP 96 |
| 34 | `Se não, por quê? Descreva o motivo…` | 296 · 20% | **228 (208 únicos)** | ❌ texto livre — esperado |
| 35 | `Quem foi afetado diretamente por esta ocorrência?` | 634 · 43% | **78 (43 únicos)** | ❌ **não aparece** |
| 36 | `Quem conduziu a intervenção e articulação` | 717 · 48% | 41 (26 únicos) | ⚠️ Consultor 732 · Líder prevenção 122 · uma fatia **sem rótulo** com 54 |
| 37 | `Tipo de resposta adotada` | 708 · 48% | 5 | ✅ Abordagem 400 · Monitoramento 190 · Articulação 177 |
| 38 | `Forças externas envolvidas` | 473 · 32% | 36 (20 únicos) | ⚠️ `Não houve.` 100 e `Não` 19 separados |
| 39 | `Grau de sucesso da ação (0 a 5)` | 851 · 57% | 6 | ✅ **4,29** — o outro número grande |

---

# O resultado, em três linhas

| destino | quantas | quais |
|---|---|---|
| ✅ **vira gráfico e funciona** | **13** | 1, 9, 10, 12, 15, 18, 19, 21, 24, 25, 33, 37, 39 |
| ⚠️ **vira gráfico ilegível** | **11** | 3, 4, 6, 7, 8, 13, 14, 16, 22, 26, 28, 29, 36, 38 |
| ❌ **não aparece** | **9** | 5, 11, 17, 20, 23, 27, 30, 31, 32, 34, 35 |
| 🔎 filtro | 1 | 2 |

## As cinco que doem — fechadas, respondidas, e ignoradas

| # | pergunta | preench. |
|---|---|---|
| 11 | `Houve movimentações atípicas no fluxo de pessoas?` | **100%** |
| 27 | `Classificação da ameaça` (interna / externa) | 49% |
| 35 | `Quem foi afetado diretamente por esta ocorrência?` | 43% |
| 31 | `Houve tentativa ou consumação?` | 29% |
| 32 | `Se tentado — Valor Recuperado/Prevenido` | 24% · **R$ 2,58 mi** |

São estas que vão para a pergunta 3.4 da reunião. **Nenhuma delas é sugestão de
corte** — a pergunta é se são decisão da SIC ou dado que se perdeu no caminho.

## E a causa dos 11 ilegíveis, em ordem de tamanho

1. **Falta de opção** — o consultor escreve, e a maioria do que ele escreve
   aparece uma única vez. No `Setor envolvido`, **134 dos 177 valores** têm
   contagem 1.
2. **Múltipla escolha gravada como texto ordenado** — `Interna;Externa` (27) e
   `Externa;Interna` (18) são a mesma resposta em duas categorias. Conserta
   sozinho quando virar conjunto.
3. **Grafia** — ponto final, espaço sobrando, acento: `Estacionamento` ×
   `Estacionamento.`, `Não houve` × `Não houve.`

⚠️ E um caso que não é nenhum dos três: a barra chamada literalmente **`Setor
envolvido`**, com 8 — alguém digitou o nome da pergunta como resposta.
