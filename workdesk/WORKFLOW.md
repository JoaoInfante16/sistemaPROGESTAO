# WORKFLOW — como João e Claude trabalham juntos

> 📌 **Documento vivo** — vale para todas as fases e não é arquivado com nenhuma.
> Firmado em 2026-04-16, enxugado em 2026-08-04.

**A filosofia, as regras de comportamento e a lista de segurança moram no
[CLAUDE.md](../CLAUDE.md) (seções 1, 5 e 6)** — ele é carregado automaticamente a
cada sessão, então repetir aqui só criava duas versões da mesma regra para manter
em sincronia.

Aqui fica o que o CLAUDE.md não cobre: **procedimento**.

---

## 1. Quando o João está frustrado

Se ele demonstrar frustração ("puta merda", "não sei mais o que fazer"), **cortar
a análise longa e ir direto aos 3 principais culpados + proposta de fix**.
Análise extensa só quando ele pedir.

---

## 2. Falar de si mesmo — prompts ruins e limitações

Se o João pedir algo num formato que **não aproveita bem o modelo** (vago,
contexto de menos, incompatível com as forças dele), Claude **deve dizer antes de
executar**:

> "João, do jeito que tá pedindo vai sair meio capenga — meu ponto forte aqui é
> X, se você me der Y eu te entrego um resultado muito melhor. Posso reformular o
> pedido contigo?"

Vale igual para limitações: se algo está fora do alcance (não dá pra ver o
Flutter renderizado, não rodo o app no device dele), **dizer explicitamente** em
vez de fingir que funcionou.

Claude pode consultar a documentação da Anthropic sobre o próprio modelo para
saber como ser mais eficaz — o João autorizou.

---

## 3. Rotina do workdesk

Os três papéis (DEV_LOG = passado, ROADMAP = futuro, ARQUITETURA = presente)
estão no [README](./README.md). Claude mantém os três atualizados **sem esperar
pedido**.

**Regra de rotação:** quando o `DEV_LOG.md` passar de ~1500 linhas, mover o
conteúdo anterior para `_archive/DEV_LOG_YYYY-MM.md` (agrupado por mês) e deixar
só o mês vigente ativo. **Nada de `DEV_LOG_2.md` sem critério.**

**O ARQUITETURA e o API_CONTRATO não recebem cópia de código.** Stack, árvore de
arquivos, valores de config e shapes de request se leem na fonte. Ver a regra no
topo do [ARQUITETURA.md](./ARQUITETURA.md) — ela nasceu de uma revisão em que o
documento se contradizia sozinho com 470 linhas de distância.

**Fim de sessão** — quando o João disser "vamos parar" / "fechou por hoje":

1. revisar o `ROADMAP.md` (o que foi feito sai, o que ficou aberto vira tarefa)
2. revisar o `ARQUITETURA.md` se algo estrutural mudou
3. confirmar que a última entrada do `DEV_LOG.md` cobre a sessão inteira
4. só então fechar

---

## 4. Definição de "pronto"

1. **Backend TS** — `npx tsc --noEmit` passa sem erro
2. **Flutter** — `flutter clean` + build, testado em **device físico via LAN IP**,
   nunca emulador
3. **Migration SQL** — aplicada no Supabase **e** registrada no
   [MIGRATIONS_LOG.md](./SQL/MIGRATIONS_LOG.md), no mesmo turno
4. **DEV_LOG** atualizado com a mudança
5. **Commit feito** — ou adiado explicitamente, com motivo

---

## 5. Reavaliação

Este workflow não é sagrado. Se algo aqui atrapalhar, o João reporta e a gente
revisa. Refinar com o uso, não engessar.
