import 'package:flutter/material.dart';
import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';
import '../utils/category_colors.dart';
import 'cat_chip.dart';

/// A anatomia comum das duas listas de lugar: o card de cidade (monitoramento)
/// e o item de consulta (busca).
///
/// **Por que a peça existe.** O João, com as duas na mão: *"um eu acho muito
/// simples (busca) e o outro eu acho muito grande, e não sei se essas contagens
/// são úteis de fato"*. Olhando o código, a divergência era **estrutural, não
/// de densidade**: o card de cidade tinha quatro elementos, o item de consulta
/// tinha três, e nenhum dos dois compartilhava espaçamento ou degrau de tipo
/// com o outro. Eram duas listas desenhadas em semanas diferentes que ninguém
/// tinha decidido que seriam diferentes.
///
/// Quatro posições, cada tela preenchendo com o que serve ao seu propósito:
///
/// ```
/// ① etiqueta esquerda                    ② etiqueta direita    mono 9.5
///    NOME DO LUGAR                                             Archivo bold
/// ③ linha de qualificação                                      prosa ou mono
/// ④ FIGURA(S)                                                  número + rótulo
/// ```
///
/// |    | MONITORAMENTO           | CONSULTAS                |
/// |----|-------------------------|--------------------------|
/// | ①  | UF + `N NOVAS` em verde | UF                       |
/// | ②  | `21 EM 30D`             | a hora (`19:16`)         |
/// | ③  | os nomes do grupo       | `30 DIAS · 17 ASSUNTOS`  |
/// | ④  | quebra por categoria    | `91 RESULTADOS`          |
///
/// **③ e ④ são opcionais e somem sem deixar vão** — cidade sozinha não tem o
/// que dizer em ③ que as figuras não digam, e não vai levar um `SizedBox`
/// órfão por isso.
///
/// A peça guarda o que estava divergindo: os espaçamentos e os degraus de tipo.
/// O conteúdo continua sendo decisão de cada tela.
class EntradaDeLugar extends StatelessWidget {
  /// ① — `Widget` e não `String` por causa do monitoramento, onde `SC · ` é
  /// `faint` e `6 NOVAS` é `greenLight` na mesma linha.
  final Widget? etiquetaEsquerda;

  /// ② — sempre mono `faint`. Fato fixo sobre o lugar, nunca ação.
  final String? etiquetaDireita;

  final String titulo;
  final TextStyle estiloDoTitulo;
  final int linhasDoTitulo;

  /// ③ — prosa (monitoramento) ou mono (consulta). Só entra o que **nenhuma
  /// figura mostra**: repetir em palavras o que o número já diz foi o que fez
  /// o card de cidade chegar a 218px.
  final Widget? qualificacao;

  /// ④ — [FaixaDeFiguras], [FiguraEmLinha], ou o estado da consulta.
  final Widget? figuras;

  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  /// Fundo do item marcado na seleção por toque longo (só nas consultas).
  final bool selecionado;

  /// Filete embaixo. As consultas desenham o seu; o monitoramento recebe o
  /// divisor da lista.
  final bool filete;

  const EntradaDeLugar({
    super.key,
    required this.titulo,
    required this.estiloDoTitulo,
    required this.onTap,
    this.etiquetaEsquerda,
    this.etiquetaDireita,
    this.linhasDoTitulo = 1,
    this.qualificacao,
    this.figuras,
    this.onLongPress,
    this.selecionado = false,
    this.filete = false,
  });

  @override
  Widget build(BuildContext context) {
    final temEtiqueta = etiquetaEsquerda != null || etiquetaDireita != null;

    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        decoration: BoxDecoration(
          color: selecionado ? SIMEopsColors.navyLight : null,
          border: filete
              ? const Border(bottom: BorderSide(color: SIMEopsColors.rule))
              : null,
        ),
        // 26 em cima e embaixo é medido, não gosto: com 15 no rodapé e 21 no
        // topo do próximo, dois lugares encostavam e o olho não achava onde um
        // terminava.
        padding: const EdgeInsets.fromLTRB(18, 26, 18, 26),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (temEtiqueta) ...[
              Row(
                children: [
                  Expanded(child: etiquetaEsquerda ?? const SizedBox.shrink()),
                  if (etiquetaDireita != null)
                    Text(
                      etiquetaDireita!,
                      style: SIMEopsType.slug(color: SIMEopsColors.faint),
                    ),
                ],
              ),
              const SizedBox(height: 8),
            ],
            Text(
              titulo,
              style: estiloDoTitulo,
              maxLines: linhasDoTitulo,
              overflow: TextOverflow.ellipsis,
            ),
            if (qualificacao != null) ...[
              const SizedBox(height: 8),
              qualificacao!,
            ],
            if (figuras != null) ...[const SizedBox(height: 18), figuras!],
          ],
        ),
      ),
    );
  }
}

/// Número grande com o rótulo **embaixo**. É o `_Figure` privado do card de
/// cidade promovido, sem mudança visual.
///
/// O número fica em tinta **branca** e a cor mora no quadradinho ao lado —
/// número colorido a 21px sobre navy perde contraste e faz cinco matizes
/// brigarem entre si.
class Figura extends StatelessWidget {
  final int valor;
  final String rotulo;

  /// Quando presente, desenha o quadradinho da categoria antes do rótulo.
  final String? categoria;

  const Figura({
    super.key,
    required this.valor,
    required this.rotulo,
    this.categoria,
  });

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('$valor', style: SIMEopsType.figure()),
      const SizedBox(height: 7),
      Row(
        children: [
          if (categoria != null) ...[
            CatChip(categoria: categoria!),
            const SizedBox(width: 5),
          ],
          Flexible(
            child: Text(
              rotulo,
              style: SIMEopsType.slug(
                color: SIMEopsColors.faint,
              ).copyWith(letterSpacing: 0.77),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    ],
  );
}

/// Número grande com o rótulo **ao lado**, na mesma linha.
///
/// É a figura de quem tem **um** número para mostrar. Empilhado (como as do
/// monitoramento) custaria ~46px por item numa lista que se varre; deitado
/// custa ~16 e dá o mesmo peso ao número, que era o ponto — o `91 RESULTADOS`
/// vivia em mono 9.5, do mesmo tamanho do resto do card, sendo a única coisa
/// que responde "essa consulta valeu a pena?".
class FiguraEmLinha extends StatelessWidget {
  final int valor;
  final String rotulo;

  const FiguraEmLinha({super.key, required this.valor, required this.rotulo});

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.baseline,
    textBaseline: TextBaseline.alphabetic,
    children: [
      Text('$valor', style: SIMEopsType.figure()),
      const SizedBox(width: 8),
      Flexible(
        child: Text(
          rotulo,
          style: SIMEopsType.slug(color: SIMEopsColors.faint),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    ],
  );
}

/// A faixa de figuras lado a lado — a quebra por categoria do monitoramento.
///
/// Mostra **toda categoria com contagem > 0**, no máximo cinco.
///
/// Antes eram as quatro maiores + `OUTRAS`, e isso era uma mentira estrutural:
/// as categorias são exatamente cinco, então `OUTRAS` **nunca agregava nada** —
/// era a 5ª categoria escondida atrás de um rótulo genérico e pintada com a cor
/// de `institucional`, que podia ser justamente outra. Chip que mente é pior
/// que chip nenhum.
///
/// Cabe: 412 − 36 de margem − 4×13 de gap = 324px ÷ 5 = 65px por coluna, e
/// `PATRIM.` em mono 9.5 ocupa ~40px mais o chip.
class FaixaDeFiguras extends StatelessWidget {
  final Map<String, int> contagens;

  const FaixaDeFiguras({super.key, required this.contagens});

  /// Abreviações que cabem na coluna. Categoria fora da lista usa o rótulo
  /// normal cortado — nunca some sem aparecer em OUTRAS.
  static const _curto = <String, String>{
    'seguranca': 'SEGUR.',
    'patrimonial': 'PATRIM.',
    'operacional': 'OPERAC.',
    'fraude': 'FRAUDE',
    'institucional': 'INSTIT.',
  };

  @override
  Widget build(BuildContext context) {
    final ordenado = contagens.entries.where((e) => e.value > 0).toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    if (ordenado.isEmpty) return const SizedBox.shrink();

    final colunas = [
      for (final e in ordenado.take(5))
        Figura(
          valor: e.value,
          rotulo: _curto[e.key] ?? categoryLabel(e.key).toUpperCase(),
          categoria: e.key,
        ),
    ];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < colunas.length; i++) ...[
          if (i > 0) const SizedBox(width: 13),
          Expanded(child: colunas[i]),
        ],
      ],
    );
  }
}
