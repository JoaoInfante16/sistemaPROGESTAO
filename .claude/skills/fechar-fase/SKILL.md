---
name: fechar-fase
description: Encerra a fase atual da workdesk — arquiva DEV_LOG e ROADMAP em Fases/, copia a ARQUITETURA como retrato, escreve o README da fase, atualiza o índice e recomeça a raiz. Use quando o João disser "pode fechar a fase", "fecha a fase" ou quando os itens do 🔴 AGORA acabarem e o próximo trabalho for outro assunto.
---

# Fechar fase

Encerra a fase atual e recomeça a raiz da workdesk. **A parte mecânica é do
[script](../../../workdesk/scripts/fechar-fase.cjs); a parte que exige ler é sua.**

Não improvise a ordem: o script move arquivos, e depois dele o DEV_LOG da fase
não está mais na raiz.

---

## 1. Antes de tocar em nada

Rode e confira os quatro. **Qualquer um vermelho, pare e reporte** — fechar fase
com o sistema quebrado arquiva o problema junto.

```bash
cd backend && npx tsc --noEmit && npx jest
cd .. && node workdesk/scripts/verificar-workdesk.cjs
git status --short          # tem que estar vazio
```

O `git status` limpo não é burocracia: o script move e reescreve arquivo, e sem
commit anterior não há para onde voltar. Ele **recusa** rodar com a árvore suja.

## 2. Leia a fase inteira antes de propor qualquer coisa

Leia o `workdesk/DEV_LOG.md` **do começo ao fim** e o `workdesk/ROADMAP.md`. Sem
isso o README sai genérico, e um README genérico é pior que nenhum — ocupa o
lugar do bom.

Enquanto lê, junte três coisas, que são as três seções do README:

| seção | o que é | o teste |
|---|---|---|
| **o que a fase resolveu** | uma tabela, uma linha por trabalho, com a data | *alguém que não estava lá entende o que mudou?* |
| **as descobertas que valem para sempre** | o que continua verdade depois da fase | *isso ainda vale daqui a um ano?* |
| **os erros cometidos** | o que se fez errado, sem suavizar | *outra instância evitaria repetir?* |

🚨 **A pergunta que não pode ser pulada:** tem alguma descoberta desta fase que
devia estar na [ARQUITETURA](../../../workdesk/ARQUITETURA.md) e não está? Se
tem, **mova para lá antes de fechar** — a ARQUITETURA é a viva, o README da fase
é só o rastro de onde a coisa veio. Descoberta que fica só no arquivo morto está
perdida na prática.

## 3. Proponha ao João, e espere

Antes de rodar o script, mostre a ele:

- **o nome da fase** — curto e descritivo, do jeito que ele pediu em 04/09:
  *"planejamento final da reunião"*, *"desenvolvimento frontend V2"*. Vai no nome
  da pasta, no README e no índice, então é como ele vai procurar depois.
- **o período** que o script detectou (`--dry-run` mostra sem escrever nada)
- **as três seções do README**, em rascunho
- **o que vai ser carregado** para o ROADMAP novo (🟡 DEPOIS e 🔵 IDEIAS)

Nome de fase é decisão dele — é do vocabulário do produto, não do código
(CLAUDE.md §1). Não escolha sozinho.

## 4. Rode o script

```bash
node workdesk/scripts/fechar-fase.cjs --titulo "<o nome que ele aprovou>" --dry-run
node workdesk/scripts/fechar-fase.cjs --titulo "<o nome que ele aprovou>"
```

Ele cria `Fases/Fase NN — <nome> — <início> a <fim>/`, move o DEV_LOG e o
ROADMAP, copia a ARQUITETURA, e recria os dois na raiz **carregando o 🟡 DEPOIS e
o 🔵 IDEIAS** — o que ainda não foi feito não morre com a fase.

## 5. Escreva o README da fase

Em `Fases/Fase NN — .../README.md`. Modele pelo
[README da Fase 11](../../../workdesk/Fases/Fase%2011%20—%202026-08-16%20a%202026-08-29/README.md),
que é o formato bom: cabeçalho dizendo que é arquivo morto e apontando para a
ARQUITETURA viva, depois as três seções.

**A pasta tem que ficar auto-contida** — dá para entender a fase sem sair dela.
Link para fora quebra com o tempo e isso é esperado; link para dentro, não.

## 6. Atualize o índice

Uma linha em [`Fases/README.md`](../../../workdesk/Fases/README.md), na tabela:
número, período curto (`29/08 a 04/09`), o que resolveu em uma frase, e o link
para a pasta (com os espaços em `%20`).

E troque a linha da fase que estava *"em curso"* pela nova, que passa a ser a viva.

## 7. Commit

Um commit só, com o que a fase foi. O `git status` tem que voltar limpo.

---

## O que NÃO fazer

- ❌ **Não reescreva pasta de fase antiga.** Documento arquivado é retrato. Link
  quebrado dentro de pasta de fase é esperado, e o que sumiu está mapeado no
  índice.
- ❌ **Não feche fase para "organizar".** O gatilho é o 🔴 AGORA ter acabado e o
  próximo trabalho ser outro assunto — não o mês virar nem o arquivo crescer.
  Se o João pediu, o gatilho é a palavra dele; se foi você que notou, **proponha
  e espere**.
- ❌ **Não invente o nome da fase.**
- ❌ **Não deixe o README para depois.** A pasta sem README é a pior das duas
  pontas: o conteúdo está lá e ninguém sabe o que tem dentro.
