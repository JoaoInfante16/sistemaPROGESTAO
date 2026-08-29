# Fase 10 — O redesign "fio de agência"

> **08/08 a 14/08/2026.** Recortada em 27/08, na reorganização da workdesk.
>
> Esta pasta é auto-contida. Os documentos aqui são um **retrato do
> encerramento** e não são mais atualizados — as versões vivas estão em
> [../../](../../).
>
> 📌 **As regras visuais que nasceram aqui não ficaram nesta pasta.** Elas valem
> para sempre e viraram o [DESIGN_CONTRATO.md](../../DESIGN_CONTRATO.md), vivo na
> raiz. Esta pasta guarda **como** se chegou nelas.

---

## O que esta fase resolveu

O app tinha aparência de app de notícia genérico e o público é profissional de
segurança pública. A fase reconstruiu a linguagem visual inteira — do token de
cor até o relatório que sai para o cliente.

| fase | o quê |
|---|---|
| A | cor de categoria com **fonte única** (era duplicada entre Dart e backend) |
| — | polimento do fio: tipografia, tinta, header, card |
| — | tema global em linguagem de fio (era o "pálido") |
| B | formulário de busca: **11 blocos → 5** |
| C | a espera de 7 minutos vira log ao vivo |
| D | as remoções — favoritos, arrastar, lembrar senha |
| E | o relatório (as duas telas) |
| E2 | o relatório vira **documento HTML A4**, servido pelo backend |
| F | notificações com dois canais e preferência — migration 032 |

Ficou de fora, de propósito, para o fim: a **revisão de copy tela por tela**.

---

## Os documentos

| doc | o que tem |
|---|---|
| [DEV_LOG.md](./DEV_LOG.md) | o diário completo — **o documento mais valioso daqui**, porque quase toda regra nasceu de uma foto do aparelho que reprovou a tela |
| [ROADMAP.md](./ROADMAP.md) | o plano como estava em 13/08 |
| [ARQUITETURA.md](./ARQUITETURA.md) | retrato do sistema no fim da fase — ver a ressalva abaixo |

⚠️ **A ARQUITETURA desta pasta é a de 04/08, e isso não é engano.** O arquivo não
foi tocado **nenhuma vez** entre 04/08 e 16/08: o redesign inteiro aconteceu sem
que o documento do "presente" mudasse. Foi nesse intervalo que o estado do
sistema começou a ser escrito no topo do DEV_LOG — o bloco que em 27/08 tinha
376 linhas e três respostas para a mesma pergunta. **O documento vivo que ninguém
edita é o que cria um segundo documento vivo.**

---

## As descobertas que valem para sempre

Todas viraram regra no [DESIGN_CONTRATO](../../DESIGN_CONTRATO.md). O método
delas vale tanto quanto o conteúdo: **quase nenhuma veio de análise — vieram de
fotos do aparelho.** A tela passava no analyzer, passava na leitura do código, e
reprovava na foto.

- **Sinal que aparece sempre não é sinal.** Morreram o selo "NOVA", o "1 FONTE" e
  o ponto verde pulsante.
- **`hairline` (1.8:1) não é discreto, é invisível** — estava apagando duas
  coisas que importavam.
- **Duas cópias da tabela de cor quebram o app.** Fraude apareceu violeta
  Tailwind numa tela e violeta validado na outra, no mesmo APK.
- **Urgência é peso, não cor** — vermelho já é a categoria Segurança.
- **A prosa honesta foi o texto mais difícil de escrever** da fase inteira.

## Os erros que a fase cometeu

- **O plano da anatomia comum `CityCard`/`HistoryCard` foi discutido, aprovado e
  perdido** — o arquivo de plano é slot único e a Fase D o sobrescreveu. Até hoje
  não foi executado; está no [ROADMAP](../../ROADMAP.md) vivo, em DEPOIS.
- **Uma tabela de estado desatualizada por quatro dias** dizia D, E2 e F por
  fazer depois das três estarem prontas, e apontava a migration errada.
- **Uma pendência foi copiada de um plano velho sem conferir** (matar o
  `EndMark`, que já estava morto — só restava a lápide no código). O erro foi
  cometido *dentro* do documento que registra a regra de não copiar.

---

## O que ficou aberto (e foi para a Fase 11)

- **Revisão de copy, tela por tela** — a única fase que faltou, por decisão.
- **Anatomia comum de `CityCard` e `HistoryCard`** — planejada, nunca executada.
- **Acabamento de cor** em `login`, `settings` e `history_card`, telas que
  ficaram fora do escopo (confirmado ainda pendente em 27/08).
