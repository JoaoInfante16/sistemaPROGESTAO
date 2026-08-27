# DESIGN_CONTRATO — a linguagem visual do SIMEops

> 📌 **Documento vivo** — vale para todas as fases e não é arquivado com nenhuma.
> Nasceu em 27/08/2026, das regras que a Fase 10 (redesign "fio de agência")
> descobriu e que estavam soltas no topo do DEV_LOG.
>
> Ver [CLAUDE.md](../CLAUDE.md), seção 2. Estado do sistema:
> [ARQUITETURA.md](./ARQUITETURA.md).

---

## O que é este documento

**Estas regras não são gosto — cada uma nasceu de um erro medido, quase sempre de
uma foto do aparelho que reprovou a tela.** Elas valem como contrato: quem for
mexer no app lê isto antes, e quem quiser reabrir uma delas precisa de um
argumento novo, não de uma preferência.

🚨 **Aqui NÃO entra valor.** Nada de hex, tamanho de fonte, padding ou nome de
widget. Isso se lê na fonte, e a razão de cada linha mora num comentário colado
nela. Este documento guarda **a regra e o porquê** — o "onde" está na tabela do
fim.

O motivo é literal: **copiar a tabela de cores já quebrou o app.** Até 08/08 o
Dart e o backend tinham cada um a sua cópia dos hexes de categoria; no dia em que
uma mudou e a outra não, Fraude apareceu violeta Tailwind na tela de busca e
violeta validado no feed, **no mesmo APK**. Uma terceira cópia aqui seria o mesmo
erro com mais etapas.

---

## 1. Cor

**A cor de categoria tem UM dono: o backend.** `CATEGORIA_CORES` em
`backend/src/utils/taxonomia.ts`, servido por `GET /settings/taxonomia`. O
`category_colors.dart` é **fallback** para quando a taxonomia não carregou — se
um hex mudar, muda no backend primeiro.

**Os cinco hexes são validados, não escolhidos.** Passam por ΔE de deuteranopia
≥ 8.0, ΔE de visão normal ≥ 19.3, croma ≥ 0.10 e contraste ≥ 3:1 sobre o navy.
Trocar um por gosto quebra o critério — o comentário longo do `taxonomia.ts` tem
a conta.

**Verde é da interface, nunca do conteúdo.** Verde diz "o sistema está bem", não
"esta notícia é boa".

**Urgência é peso, não cor.** Quem marca urgência é o filete branco, não o
vermelho — vermelho já é a categoria Segurança, e usar a mesma tinta para duas
coisas fez o card mentir.

**A cor mora no chip.** O `CatChip` carrega a cor; o texto ao lado fica em tinta
legível. Texto colorido por categoria reprovou na foto.

---

## 2. Tinta e legibilidade

**`hairline` NUNCA pinta texto.** Ele é 1.8:1 — não é "discreto", é invisível.
O piso de qualquer texto é `faint` (4.8:1). Isso já apagou duas coisas que
importavam, inclusive a prova de que a busca tinha plano.

**Mono maiúsculo é campo de máquina, não frase.** Prosa vai em
`SIMEopsType.note()`, que é Archivo em caixa de sentença. Frase inteira em mono
maiúsculo vira ruído e ninguém lê.

**O local trunca, não quebra.** Nome de bairro comprido corta com reticências;
quebrar em duas linhas desmonta a altura do card.

---

## 3. Sinal

**Sinal que aparece sempre não é sinal.** Morreram por esta regra: o selo "NOVA",
o "1 FONTE" e o ponto verde pulsante. Se está em 100% dos itens, não informa
nada e só gasta atenção.

**Estado do sistema mora no dashboard, uma vez só.** Tela de conteúdo mostra
conteúdo. Repetir "última varredura há X" em cada tela é ruído.

**Cidade sem novidade vira linha, não bloco.** Bloco vazio ocupa o espaço de
quem tem notícia.

---

## 4. Documento (relatório)

**O app é escuro; o documento é claro.** Quem recebe o relatório nunca viu a
tela — ele é impresso em A4, e tema escuro em papel é gasto de tinta e leitura
pior.

**Arquivo único, autocontido.** HTML com as fontes em base64. Sem CDN, sem
dependência de rede: o cliente abre offline, num aparelho que não é o dele.

**A marca do cliente entra por uma variável só** (`--marca`). Trocar cliente não
pode virar caça a hex espalhado.

**O rodapé sempre declara a cobertura.** Quem recebe não sabe o recorte, e um
número sem recorte é um número que mente.

---

## 5. Onde os valores moram

| o que | fonte da verdade |
|---|---|
| cor de categoria | `backend/src/utils/taxonomia.ts` → `GET /settings/taxonomia` |
| fallback offline da cor | `mobile-app/lib/core/utils/category_colors.dart` |
| escala de tinta e contraste | `mobile-app/lib/core/theme/simeops_colors.dart` |
| tipografia e estilos de texto | `mobile-app/lib/core/theme/simeops_type.dart` |
| chip de categoria | `mobile-app/lib/core/widgets/` |

**Antes de mudar qualquer um destes, leia o comentário colado na linha.** Eles
contam o erro que gerou o valor — e é mais barato ler do que redescobrir.
