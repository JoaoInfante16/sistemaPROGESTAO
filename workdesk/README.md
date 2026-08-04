# Workdesk — como esta pasta funciona

> O diário de bordo do SIMEops. Se você chegou agora (instância nova do Claude ou
> João depois de um tempo longe), **comece pelo bloco ESTADO DO MUNDO no topo do
> [DEV_LOG.md](./DEV_LOG.md)** — ele diz em que pé está tudo.

---

## Os documentos da raiz

A raiz é sempre a **fase em andamento**. Cada documento diz no cabeçalho se é
vivo (📌) ou da fase (🗂️).

| doc | tipo | responde |
|---|---|---|
| [DEV_LOG.md](./DEV_LOG.md) | 🗂️ | o que foi feito nesta fase, e por quê — **começa aqui** |
| [ROADMAP.md](./ROADMAP.md) | 🗂️ | o que ainda vai ser feito |
| [ARQUITETURA.md](./ARQUITETURA.md) | 📌 | como o sistema funciona e **por quê** |
| [API_CONTRATO.md](./API_CONTRATO.md) | 📌 | as decisões de contrato que não podem ser desfeitas |
| [FUNIL.md](./FUNIL.md) | 📌 | onde cada item da busca morre, com números |
| [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md) | 📌 | o que falta no backend, por consequência |
| [WORKFLOW.md](./WORKFLOW.md) | 📌 | procedimento (o resto está no [CLAUDE.md](../CLAUDE.md)) |
| [SQL/](./SQL/) | 📌 | migrations + o log de quais foram aplicadas |

**📌 vivo** = descreve o estado atual, é editado no lugar e **continua na raiz**
depois do encerramento. Se estiver desatualizado, é bug de documentação.

**🗂️ da fase** = só faz sentido no recorte de tempo dela; é **recortado** da raiz
no encerramento.

O `FRONTEND_BRIEFING` da Fase 9 é o exemplo perfeito de 🗂️ — e do que acontece
quando se demora a arquivar. Ele dizia *"o app ignora oito campos"*; no dia em que
o app parou de ignorar, a frase virou mentira, e ele ficou meses na raiz sendo
apontado como "documento de entrada". Foi arquivado em 04/08. O `API_CONTRATO`,
por contraste, continua verdadeiro depois de pronto.

---

## A regra que veio depois (04/08)

**Nenhum documento vivo copia o que o código já diz.** Sem stack, sem árvore de
arquivos, sem lista de chaves de config, sem shapes de request. Isso se lê na
fonte, em dois segundos, e sempre certo.

O motivo não é economia de espaço — é que a cópia **apodrece calada**. A revisão
de 04/08 encontrou o `ARQUITETURA` afirmando ao mesmo tempo que a busca aceitava
10 cidades (aceita 1), que o Stage 5 rodava em série (foi paralelizado) e que
nenhuma chamada externa tinha timeout — enquanto o próprio cabeçalho, 470 linhas
acima, listava os timeouts. A parte errada estava dentro de uma caixa escrita
"LEIA ANTES DE MEXER".

Aqui fica o que **custa dinheiro ou tempo para redescobrir**: medições, o porquê
das decisões, o que já foi tentado e falhou, e o estado de coisas que não se
enxerga do código (qual migration rodou, o que o APK do cliente faz).

---

## O ciclo de uma fase

Ao encerrar, a pasta `Fases/Fase N/` tem que ficar **auto-contida** — quem abrir
entende a fase inteira sem precisar da raiz. Ela recebe quatro coisas:

```
                              Fases/Fase N/
                              -------------
DEV_LOG.md      ── recorta ──> DEV_LOG.md       o diário, com as medições
ROADMAP.md      ── recorta ──> ROADMAP.md       o plano no encerramento
briefings       ── recorta ──> ...              o material daquele trabalho
ARQUITETURA.md  ── copia  ──> ARQUITETURA.md    retrato do sistema no fim da fase
                              README.md          o índice: o que foi a fase

ARQUITETURA.md continua na raiz, viva e atualizada — a cópia é um retrato,
não uma mudança de lugar.
```

Depois disso a raiz recomeça com um `DEV_LOG` e um `ROADMAP` novos, e o DEV_LOG
novo carrega o bloco **ESTADO DO MUNDO** atualizado.

O **README de cada fase** é o que torna a pasta auto-contida: resume o que a fase
resolveu, lista os documentos, e — mais importante — guarda as **descobertas que
valem para sempre** e os **erros cometidos**, para não se repetirem.

⚠️ **Checklist ao recortar:** mover um documento **quebra todos os links
relativos dentro dele**. Ao arquivar, `./algo.md` vira `../../algo.md` e
`../backend/...` vira `../../../backend/...`. Aconteceu com a Fase 8 — foram 26
links. Verificar depois de mover, sempre.

**Estamos na Fase 9** (frontend). Fases 1 a 8 estão em [Fases/](./Fases/).

---

## Regras que não podem ser quebradas

- **Toda migration SQL** em [SQL/migrations/](./SQL/migrations/) **obriga**
  entrada em [SQL/MIGRATIONS_LOG.md](./SQL/MIGRATIONS_LOG.md) no mesmo turno.
- **O MIGRATIONS_LOG já mentiu.** É preenchido à mão. Antes de confiar nele,
  rodar `npx tsx backend/scripts/diagnostico-banco.ts`, que olha o banco de
  verdade e é só leitura.
- **DEV_LOG é append-only** e cronológico, mais recente no topo. Não se reescreve
  o passado — se algo estava errado, escreve-se a correção como entrada nova.
- **ARQUITETURA é editada in-place.** Não acumula "o que mudou em tal data" para
  sempre; o histórico disso é o DEV_LOG.

---

## Histórico das fases

| fase | o que foi |
|---|---|
| 1 a 7 | ver [Fases/](./Fases/) |
| **8** | busca manual reescrita (1 → 77 resultados) + auditoria e reforma do auto-scan — [leia o README dela](./Fases/Fase%208/README.md) |
| **9** | o app: usar os oito campos que o backend já entrega — *em andamento* |

> As pastas das Fases 1 a 7 são anteriores a esta convenção e têm formatos
> variados (`PROGRESSO.md`, `DEVLOG/`, sem README). Ficam como estão — reescrever
> histórico não agrega. Da Fase 8 em diante vale o padrão acima.
