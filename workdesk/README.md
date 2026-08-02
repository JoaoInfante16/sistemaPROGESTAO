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
| [DEV_LOG.md](./DEV_LOG.md) | 🗂️ | o que foi feito nesta fase, e por quê |
| [ROADMAP.md](./ROADMAP.md) | 🗂️ | o que ainda vai ser feito |
| [FRONTEND_BRIEFING.md](./FRONTEND_BRIEFING.md) | 🗂️ | briefing do trabalho da Fase 9 |
| [ARQUITETURA.md](./ARQUITETURA.md) | 📌 | como o sistema funciona hoje |
| [API_CONTRATO.md](./API_CONTRATO.md) | 📌 | o que cada rota recebe e devolve |
| [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md) | 📌 | o que falta no backend, por consequência |
| [WORKFLOW.md](./WORKFLOW.md) | 📌 | como João e Claude trabalham juntos |
| [SQL/](./SQL/) | 📌 | migrations + o log de quais foram aplicadas |

**📌 vivo** = descreve o estado atual, é editado no lugar e **continua na raiz**
depois do encerramento. Se estiver desatualizado, é bug de documentação.

**🗂️ da fase** = só faz sentido no recorte de tempo dela; é **recortado** da raiz
no encerramento.

O `FRONTEND_BRIEFING` é da fase porque descreve um estado que **deixa de ser
verdade** quando o trabalho termina: hoje ele diz "o app ignora oito campos", e no
dia em que o app parar de ignorar a frase vira mentira. O `API_CONTRATO`, por
contraste, continua verdadeiro depois de pronto.

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
