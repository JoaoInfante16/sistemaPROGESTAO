# Fases — o arquivo histórico do SIMEops

> 📌 **Índice vivo.** Uma linha por fase encerrada. Atualizado no encerramento de
> cada fase nova. Ver [CLAUDE.md](../../CLAUDE.md), seção 2.

**Isto é arquivo morto, e é assim que deve ser lido.** Nada aqui descreve o
sistema de hoje — para isso é a [ARQUITETURA](../ARQUITETURA.md). O valor destas
pastas é responder *"por que isso é assim?"* quando a resposta custou medição.

Cada pasta é **auto-contida**: dá para entender a fase sem sair dela. E o nome da
pasta carrega a data, então a ordenação alfabética é a cronológica.

---

## As fases

| # | período | o que resolveu | pasta |
|---|---|---|---|
| 01 | 07 a 09/02 | o sistema nasce: pipeline, filtros GPT, push, admin | [Fase 01](./Fase%2001%20—%202026-02-07%20a%202026-02-09/) |
| 02 | 17 a 22/03 | produção inicial e a primeira disciplina de workspace | [Fase 02](./Fase%2002%20—%202026-03-17%20a%202026-03-22/) |
| 03 | 22 a 28/03 | a busca manual ganha pipeline própria e rastreio de rejeição | [Fase 03](./Fase%2003%20—%202026-03-22%20a%202026-03-28/) |
| 04 | 28 a 31/03 | polimento geral: admin, Flutter, cost tracking | [Fase 04](./Fase%2004%20—%202026-03-28%20a%202026-03-31/) |
| 05 | 06/04 | Sentry, deploy, dev panel, billing | [Fase 05](./Fase%2005%20—%202026-04-06/) |
| 06 | 06 a 15/04 | o app vira dashboard por cidade, com grupos | [Fase 06](./Fase%2006%20—%202026-04-06%20a%202026-04-15/) |
| 07 | 16/04 a 01/08 | as últimas sessões de abril, a pausa de 3,5 meses e a auditoria da volta | [Fase 07](./Fase%2007%20—%202026-04-16%20a%202026-08-01/) |
| 08 | 30/07 a 02/08 | **a busca manual que funciona**: 1 resultado → 77 | [Fase 08](./Fase%2008%20—%202026-07-30%20a%202026-08-02/) |
| 09 | 02 a 06/08 | **o app à altura do backend**: os oito campos ignorados | [Fase 09](./Fase%2009%20—%202026-08-02%20a%202026-08-06/) |
| 10 | 08 a 14/08 | **o redesign "fio de agência"** | [Fase 10](./Fase%2010%20—%202026-08-08%20a%202026-08-14/) |
| 11 | 16 a 29/08 | **produção de verdade**: o deploy que não deployava, a conta que se perdia, o dedup e o banco próprio de staging | [Fase 11](./Fase%2011%20—%202026-08-16%20a%202026-08-29/) |
| 12 | 29/08 → em curso | o app deixa de ser só de notícias: níveis de acesso e comportamento por usuário | *viva, na [raiz](../)* |

---

## Como uma fase nasce e morre

**O que rotaciona:** `DEV_LOG` e `ROADMAP`. Os dois andam juntos e são recortados
para cá no encerramento.

**O gatilho:** quando o **ROADMAP fecha** — os itens de 🔴 AGORA acabaram e o que
vem a seguir é outro assunto. Não é o mês virando, nem o arquivo crescendo.

**O que NÃO rotaciona:** [ARQUITETURA](../ARQUITETURA.md),
[API_CONTRATO](../API_CONTRATO.md), [FUNIL](../FUNIL.md),
[DESIGN_CONTRATO](../DESIGN_CONTRATO.md) e [SQL/](../SQL/). Esses descrevem o
presente e mudam **organicamente com o código** — nunca são arquivados.

Ao encerrar, a pasta recebe os documentos recortados, uma **cópia** da ARQUITETURA
(retrato do fim da fase) e um **README** com o que a fase resolveu, as descobertas
que valem para sempre e os erros cometidos.

---

## Ressalvas de datas e numeração

⚠️ **As datas das fases 01 a 07 são derivadas, não registradas.** Ninguém anotou o
período na época; elas vêm das datas que aparecem nos títulos das entradas e, para
as fases 05 e 06, do [MIGRATIONS_LOG](../SQL/MIGRATIONS_LOG.md) (migrations 017,
005 e 018). Trate-as como aproximação de dias, não de horas. O git não ajuda: todas
as pastas foram criadas no mesmo commit, em 30/07.

⚠️ **As fases 07 e 08 se sobrepõem, e isso é real.** A auditoria da volta (Fase 07)
foi feita em 30/07, o mesmo dia em que a Fase 08 começou a corrigir o que ela achou.

⚠️ **As fases 09, 10 e 11 foram recortadas em 27/08**, não escritas no calor da
hora. Até essa data existia uma única "Fase 9" com **25 dias e 5.053 linhas** de
DEV_LOG, cobrindo seis trabalhos diferentes. O recorte separou o que sempre foram
fases distintas. Nenhuma linha foi descartada.

⚠️ **Os documentos dentro da pasta da Fase 07 se identificam como "Fase 2".** A
numeração antiga era inconsistente e foi preservada como estava — corrigir o texto
de um arquivo morto criaria uma terceira versão da história.

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
| `BRIEFING_DESIGN.md` | arquivado na pasta da Fase 10 em 27/08, quando o redesign que ele descrevia terminou. |
| `Frontend Fio Completo` | o protótipo HTML do redesign; virou `mockup-fio-completo.html`, na pasta da Fase 10. |
| `WORKFLOW.md` | dissolvido dentro do [CLAUDE.md](../../CLAUDE.md) em 27/08 — regra de comportamento precisa estar no arquivo que carrega sozinho a cada sessão. |
| bloco `ESTADO DO MUNDO` | vivia no topo do DEV_LOG; dissolvido em 27/08 entre ARQUITETURA, API_CONTRATO, FUNIL, DESIGN_CONTRATO e ROADMAP. |
| `Fase N/` sem data no nome | as pastas foram renomeadas em 28/08 para incluir o período (`Fase 08 — 2026-07-30 a 2026-08-02`), de modo que a ordem alfabética seja a cronológica. |
