# Fase 11 — produção de verdade

> **16/08 a 29/08/2026.** 🗂️ Arquivo morto. O sistema de hoje está na
> [ARQUITETURA viva](../../ARQUITETURA.md), não aqui.
>
> Nesta pasta: [DEV_LOG](./DEV_LOG.md) (o passado, com a data de cada coisa),
> [ROADMAP](./ROADMAP.md) (o futuro **como se via no fim da fase**) e uma
> [cópia da ARQUITETURA](./ARQUITETURA.md) — retrato de 29/08.

---

## O que a fase resolveu

A Fase 10 entregou um app bonito. A 11 é a fase em que ele **virou produto no ar,
na mão de cliente pagante** — e em que quase tudo que quebrou foi de infra, não
de código de feature.

| # | o que | o que mudou de fato |
|---|---|---|
| 1 | **O deploy final** (16/08) | `main` subiu pela primeira vez desde junho. Descobriu-se que ela **não era ancestral da `staging`** e que o auto-deploy do backend de produção está **desligado** |
| 2 | **A conta que se perdia** (16/08) | "Sair da conta" apagava o cofre de quem só teve o token expirado; `local_auth` nunca funcionou porque a `MainActivity` não era `FlutterFragmentActivity`; a tela de senha tinha uma porta só |
| 3 | **O volume 15×** (17/08) | 31 notícias num dia contra média de 2,0 expuseram quatro defeitos que sempre existiram: `manifestacao` virou balde, o push não mandava manchete, saía **um push por notícia**, e duas duplicatas passavam pelo dedup |
| 4 | **O dedup** (24/08) | parou de usar como portão a `data_ocorrencia` que o próprio GPT inventa. Janela de 3 dias, e a fusão passou a consolidar |
| 5 | **O corpo da notícia** (25/08) | tocar num card passou a entregar texto próprio, não o mesmo resumo do card |
| 6 | **Staging ganhou banco próprio** (26/08) | o dev local escrevia em **produção**. E quatro tabelas estavam abertas para a chave anon, incluindo `reports` (o relatório que o cliente manda para o cliente dele) e `billing_history` |
| 7 | **A workdesk foi reorganizada** (27 e 28/08) | havia **dois** documentos do presente, e o desatualizado era o que mandava ler primeiro |

## As descobertas que valem para sempre

Estas saíram daqui e **moram na [ARQUITETURA](../../ARQUITETURA.md)** — a versão
viva é a que vale; a lista abaixo é só o rastro de onde vieram.

- **`git push` para `main` não deploya nada.** O backend de produção não tem
  auto-deploy. Duas sessões inteiras já se perderam concluindo por inferência
  qual código estava rodando: `GET /health` responde em dois segundos.
- **Onde a RLS está desligada não existe trava nenhuma.** A chave anon é pública
  por definição — vai dentro do APK e no bundle JS do painel. Ligar RLS sem criar
  policy não quebrou nada, porque todo caminho real passa pela service key.
- **Push agrupa POR USUÁRIO, nunca por lote.** O recorte de quem quer receber o
  quê é individual; agrupar antes de filtrar manda "5 notícias" para quem pediu 1.
- **A camada 1 do dedup é um portão, não um veredito.** Quem essa consulta não
  devolve, ninguém mais examina — por isso a janela é de 3 dias e não de 1.
- **Documento não se mantém por disciplina.** Só em 2026 apodreceram a
  ARQUITETURA, o ESTADO DO MUNDO e o MIGRATIONS_LOG — os três com regra escrita
  mandando atualizar. O que ficou no lugar da regra foi um
  [verificador](../../scripts/verificar-workdesk.cjs) que roda em 0,2s a cada
  sessão e é **calado quando está limpo**.
- **Automação sobre documento depende do mínimo possível dele, e grita quando
  esse mínimo some.** O hook de onboarding quebrou em menos de 24h porque
  dependia de dois títulos fixos e um deles foi dissolvido. Ele avisou em vez de
  calar — e é por isso que o conserto levou minutos.

## Os erros cometidos

Ficam registrados porque foram cometidos **dentro** dos documentos que os proíbem.

- **Duas verdades sobre o mesmo fato, três vezes.** O bloco ESTADO DO MUNDO
  chegou a 376 linhas e dava três respostas diferentes para "a migration 025
  rodou?" — no mesmo bloco.
- **A migration 025 afirmava, no próprio comentário, que `reports` já tinha RLS.
  Não tinha.** Afirmação nunca medida, dentro de um arquivo, que virou segunda
  verdade e deixou quatro tabelas abertas por dez dias.
- **Uma pendência foi copiada de um plano velho para o ROADMAP sem ser
  conferida** (`EndMark` já estava morto) — apodrecimento silencioso cometido
  dentro do documento que registra a regra contra ele. Corrigido cinco minutos
  depois.
- **`auth_required=false` ficou algumas horas em staging** e, com ele, staging só
  testava o feed.
- **O `google-services.json` versionado estava errado desde março** e ninguém
  notou porque o build local usava outro.

## Ponta solta ao fechar

⬜ **O `Manual Deploy` de produção seguia pendente em 29/08.** `main` estava em
`e1aa6ef`, oito commits atrás da `develop`. O que falta subir é infra de staging
e workdesk — nenhuma mudança de pipeline. Carregado para o ROADMAP da fase
seguinte.
