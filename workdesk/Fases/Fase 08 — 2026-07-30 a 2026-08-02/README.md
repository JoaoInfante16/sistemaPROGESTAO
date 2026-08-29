# Fase 8 — A busca manual que funciona

> **30/07 a 02/08/2026.** Encerrada em 02/08.
>
> Esta pasta é auto-contida: dá para entender a fase inteira sem sair dela. Os
> documentos aqui são um **retrato do encerramento** e não são mais atualizados —
> as versões vivas estão em [../../](../../).

---

## O que esta fase resolveu

Começou com uma queixa simples do João: **a busca manual devolvia 1 resultado.**
Terminou com **77**, medidos no app.

Não foi uma correção — foram cinco, e cada uma escondia a seguinte:

| # | o que era | ganho |
|---|---|---|
| 8.1 | 3 queries em série por medo infundado | estágio 1: 23,7s → 9,0s |
| 8.4 | teto de coleta fixo em 20 → "30 dias" cobria 3 | 59 → 175 URLs |
| teto aberto | análise parava em 50 artigos | ~155 analisados |
| 8.3 | dedup só por cosine comia metade | 32→16 virou 32→21 |
| assuntos | 3 perguntas fixas em código | lista editável, 5 assuntos |

E no fim, uma auditoria do auto-scan que achou seis problemas e corrigiu todos.

---

## Os documentos

| doc | o que tem |
|---|---|
| [DEV_LOG.md](./DEV_LOG.md) | o diário completo, com **todas as medições** — é o documento mais valioso daqui |
| [ROADMAP.md](./ROADMAP.md) | o plano como estava no encerramento, incluindo o histórico da auditoria |
| [ARQUITETURA.md](./ARQUITETURA.md) | retrato de como o sistema era no fim da fase |

---

## As descobertas que valem para sempre

Estas custaram medição e não devem ser refeitas. Todas estão no
[DEV_LOG](./DEV_LOG.md) com o método:

- **O índice do Google tem teto por query** (~60-70 itens úteis) e **não é
  regulável**. Mais páginas não trazem mais nada; mais assuntos trazem.
- **O Google ignora o filtro de data.** Só `sbd:1` (ordenar por data) é obedecido.
- **Query curta ganha de query longa**, e **nunca colocar o estado na query** —
  ele empurra o resultado para conteúdo institucional.
- **A Bright Data não tem limite de concorrência**, só de vazão (100 QPS).
- **O Jina leva ~7,4s por artigo**, não os ~3s que se supunha.
- **Nunca fazer retry por contagem baixa** — não dá para distinguir "fui
  bloqueado" de "essa cidade não tem notícia".

## Os erros que a fase cometeu, e o que se aprendeu

- **Reaproveitar uma chave de config cujo significado mudou** criou acoplamento
  invisível entre staging e produção, que usam o mesmo banco. Regra que ficou:
  significado novo, **nome novo**.
- **A ordem de dois `push` era load-bearing.** O ramo web era empilhado antes do
  news e comia as vagas do teto, entregando 1 resultado de 23. Ninguém tinha
  decidido isso — era um efeito colateral.
- **Uma medição feita com script que não espelhava o worker mentiu**, e quase
  levou à conclusão errada de desligar o ramo web.

---

## O que ficou aberto (e foi para a Fase 9)

- 🚨 **Migration 025** — o banco aceita leitura e escrita pela chave anon, que é
  pública. Escrita, não rodada.
- 🚨 **Promover `main`** — produção rodava código de junho durante toda esta fase.
- **Acelerar o estágio 4** — vira Fase 10, com o diagnóstico pronto.

Lista viva: [../../BACKEND_PENDENTE.md](../../BACKEND_PENDENTE.md).
