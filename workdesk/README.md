# Workdesk — como esta pasta funciona

> O diário de bordo do SIMEops. Se você chegou agora (instância nova do Claude ou
> João depois de um tempo longe), **comece pelo bloco ESTADO DO MUNDO no topo do
> [DEV_LOG.md](./DEV_LOG.md)** — ele diz em que pé está tudo.

---

## Os dois tipos de documento

A distinção decide o que acontece quando uma fase acaba.

### 📌 Vivos — nunca são arquivados

Descrevem o **estado atual** do sistema. Editados no lugar, para sempre. Se um
deles estiver desatualizado, é bug de documentação — não histórico.

| doc | responde |
|---|---|
| [ARQUITETURA.md](./ARQUITETURA.md) | como o sistema funciona hoje |
| [API_CONTRATO.md](./API_CONTRATO.md) | o que cada rota recebe e devolve |
| [BACKEND_PENDENTE.md](./BACKEND_PENDENTE.md) | o que falta no backend, por consequência |
| [WORKFLOW.md](./WORKFLOW.md) | como João e Claude trabalham juntos |
| [SQL/](./SQL/) | migrations + o log de quais foram aplicadas |

### 🗂️ Da fase — arquivados quando ela fecha

Só fazem sentido dentro do recorte de tempo da fase. Vão para
`Fases/Fase N/` no encerramento.

| doc | responde |
|---|---|
| [DEV_LOG.md](./DEV_LOG.md) | o que foi feito nesta fase, e por quê |
| [ROADMAP.md](./ROADMAP.md) | o que ainda vai ser feito nesta fase |
| [FRONTEND_BRIEFING.md](./FRONTEND_BRIEFING.md) | briefing do trabalho da Fase 9 |

O briefing entra aqui porque descreve um estado que **deixa de ser verdade**
quando o trabalho termina: hoje ele diz "o app ignora oito campos". Quando o app
parar de ignorar, a frase vira falsa — e um documento vivo não pode envelhecer
assim. O `API_CONTRATO`, por contraste, continua verdadeiro depois de pronto.

---

## O ciclo de uma fase

```
fase em andamento          fase encerrada
-----------------          --------------
workdesk/DEV_LOG.md   -->  workdesk/Fases/Fase N/DEV_LOG.md
workdesk/ROADMAP.md   -->  workdesk/Fases/Fase N/ROADMAP.md
(+ briefings da fase) -->  workdesk/Fases/Fase N/...

workdesk/ARQUITETURA.md    fica, atualizado in-place
workdesk/API_CONTRATO.md   fica
workdesk/BACKEND_PENDENTE  fica
```

Ao encerrar, a raiz recomeça com um `DEV_LOG` e um `ROADMAP` novos, e o DEV_LOG
novo carrega o bloco **ESTADO DO MUNDO** atualizado.

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
| **8** | busca manual reescrita (1 → 77 resultados) + auditoria e reforma do auto-scan — [Fases/Fase 8/](./Fases/Fase%208/) |
| **9** | o app: usar os oito campos que o backend já entrega — *em andamento* |
