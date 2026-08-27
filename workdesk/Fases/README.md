# Fases — o arquivo histórico do SIMEops

> 📌 **Índice vivo.** Uma linha por fase encerrada. Atualizado no encerramento de
> cada fase nova. Ver [CLAUDE.md](../../CLAUDE.md), seção 2.

**Isto é arquivo morto, e é assim que deve ser lido.** Nada aqui descreve o
sistema de hoje — para isso é a [ARQUITETURA](../ARQUITETURA.md). O valor destas
pastas é responder *"por que isso é assim?"* quando a resposta custou medição.

Cada pasta é **auto-contida**: dá para entender a fase sem sair dela.

---

## As fases

| # | período | o que resolveu | pasta |
|---|---|---|---|
| 1 | 2026-03 a 04 | o sistema nasce: pipeline, filtros GPT, push, admin | [Fase 1](./Fase%201/) |
| 2 | 2026-04 | produção inicial e a primeira disciplina de workspace | [Fase 2](./Fase%202/) |
| 3 | 2026-04 | a busca manual ganha pipeline própria e rastreio de rejeição | [Fase 3](./Fase%203/) |
| 4 | 2026-04 | polimento geral: admin, Flutter, cost tracking | [Fase 4](./Fase%204/) |
| 5 | 2026-04 | Sentry, deploy, dev panel, billing | [Fase 5](./Fase%205/) |
| 6 | 2026-04 | o app vira dashboard por cidade, com grupos | [Fase 6](./Fase%206/) |
| 7 | 2026-07 | a volta depois de 3,5 meses parados — auditoria geral | [Fase 7](./Fase%207/) |
| 8 | 30/07 a 02/08 | **a busca manual que funciona**: 1 resultado → 77 | [Fase 8](./Fase%208/) |
| 9 | 02 a 06/08 | **o app à altura do backend**: os oito campos ignorados | [Fase 9](./Fase%209/) |
| 10 | 08 a 14/08 | **o redesign "fio de agência"** | [Fase 10](./Fase%2010/) |
| 11 | 16/08 → em curso | produção de verdade: deploy, auth, dedup, infra | *viva, na [raiz](../)* |

---

## Duas ressalvas de numeração, para não confundir quem procurar

⚠️ **As Fases 9, 10 e 11 foram recortadas em 27/08**, não escritas no calor da
hora. Até essa data existia uma única "Fase 9" com **25 dias e 5.053 linhas** de
DEV_LOG, cobrindo seis trabalhos diferentes. O recorte separou o que sempre foram
fases distintas. Nenhuma linha foi descartada.

⚠️ **Os documentos dentro de `Fase 7/` se identificam como "Fase 2".** A
numeração antiga era inconsistente e foi preservada como estava — corrigir o
texto de um arquivo morto criaria uma terceira versão da história.

## O que mais mora aqui

- [DEV_LOG_main_pre_fase9.md](./DEV_LOG_main_pre_fase9.md) — **arquivo de
  resgate**, não é uma fase. É o DEV_LOG que só existia na branch `main` até
  16/08, quando ela foi alinhada com a `staging`. Sem esta cópia, as entradas de
  março a abril sumiriam da árvore, sobrevivendo só no histórico do git.

---

## Documentos citados aqui que não existem mais

Os arquivos destas pastas são retratos e **não são reescritos** — corrigir link
num documento morto seria inventar uma história que não aconteceu. Então os
ponteiros abaixo aparecem quebrados de propósito, e é aqui que se descobre para
onde foram:

| citado como | o que houve |
|---|---|
| `BACKEND_PENDENTE.md` | absorvido pelo ROADMAP em **04/08** — cinco das oito seções eram duplicata literal dele. 11 links ainda apontam para cá. |
| `BRIEFING_DESIGN.md` | arquivado em [Fase 10](./Fase%2010/BRIEFING_DESIGN.md) em 27/08, quando o redesign que ele descrevia terminou. |
| `Frontend Fio Completo` | o protótipo HTML do redesign; virou [Fase 10/mockup-fio-completo.html](./Fase%2010/mockup-fio-completo.html). |
| `WORKFLOW.md` | dissolvido dentro do [CLAUDE.md](../../CLAUDE.md) em 27/08 — regra de comportamento precisa estar no arquivo que carrega sozinho a cada sessão. |
| bloco `ESTADO DO MUNDO` | vivia no topo do DEV_LOG; dissolvido em 27/08 entre ARQUITETURA, API_CONTRATO, FUNIL, DESIGN_CONTRATO e ROADMAP. |
