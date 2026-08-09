import 'package:flutter/material.dart';

import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';
import 'cat_chip.dart';

/// A anatomia de uma entrada de lugar — usada pelas **duas** listas do app que
/// falam de cidade: o card da varredura (`CityCard`) e o item do histórico de
/// consultas (`HistoryCard`).
///
/// As duas foram desenhadas separadas e divergiram sem que ninguém decidisse
/// isso: uma tinha quatro elementos e 235px, a outra tinha três e 90px, e
/// nenhuma compartilhava espaçamento ou degrau de tipo com a outra. João, com
/// as duas na mão: *"um eu acho muito simples e o outro muito grande"*, e a
/// direção — *"um merge dos dois, mas com informações úteis para cada
/// propósito"*.
///
/// Quatro posições. Quem preenche decide **o quê**; esta peça decide o
/// **espaçamento e o degrau de tipo**, que era exatamente o que escorregava.
///
/// ```
/// ① etiqueta esquerda            ② etiqueta direita     mono 9.5
///    NOME DO LUGAR                                      Archivo bold
/// ③ qualificação                                        prosa ou mono
/// ④ figura(s)                                           número + rótulo
/// ```
///
/// | | dashboard | consultas |
/// |---|---|---|
/// | ① | UF + `6 NOVAS` em verde | UF |
/// | ② | `21 EM 30D` | a hora |
/// | ③ | prosa, só quando tem o que dizer | `30 DIAS · 17 ASSUNTOS` |
/// | ④ | quebra por categoria | `56 RESULTADOS` |
///
/// ③ e ④ são opcionais e **não ocupam altura quando ausentes** — cidade sozinha
/// não tem o que dizer em ③ e fica muda. Altura variável não é defeito nessa
/// lista, é o mecanismo dela: cidade sem novidade já nem bloco é (ver
/// `QuietCityRow`).
class EntradaDeLugar extends StatelessWidget {
  /// ① — texto simples. Ignorado se [etiquetaEsquerdaRica] for passada.
  final String? etiquetaEsquerda;

  /// ① rica, para quando a linha tem duas tintas: `SC · ` em `faint` e
  /// `6 NOVAS` em verde no mesmo fluxo.
  final Widget? etiquetaEsquerdaRica;

  /// ②
  final String? etiquetaDireita;
  final Color? corEtiquetaDireita;

  final String nome;
  final TextStyle estiloDoNome;

  /// ③ e ④
  final Widget? qualificacao;
  final Widget? figuras;

  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  /// Fundo de seleção (toque longo no histórico).
  final bool selecionado;

  /// O filete que separa uma entrada da próxima. O card da varredura não usa
  /// (ele se separa por ar), o histórico usa.
  final bool comFilete;

  final EdgeInsets padding;

  const EntradaDeLugar({
    super.key,
    this.etiquetaEsquerda,
    this.etiquetaEsquerdaRica,
    this.etiquetaDireita,
    this.corEtiquetaDireita,
    required this.nome,
    required this.estiloDoNome,
    this.qualificacao,
    this.figuras,
    required this.onTap,
    this.onLongPress,
    this.selecionado = false,
    this.comFilete = false,
    this.padding = const EdgeInsets.fromLTRB(18, 18, 18, 18),
  });

  bool get _temEtiqueta =>
      etiquetaEsquerdaRica != null ||
      (etiquetaEsquerda != null && etiquetaEsquerda!.isNotEmpty) ||
      (etiquetaDireita != null && etiquetaDireita!.isNotEmpty);

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        decoration: BoxDecoration(
          color: selecionado ? SIMEopsColors.navyLight : null,
          border: comFilete
              ? const Border(bottom: BorderSide(color: SIMEopsColors.rule))
              : null,
        ),
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_temEtiqueta) ...[
              Row(
                children: [
                  Expanded(
                    child: etiquetaEsquerdaRica ??
                        Text(
                          etiquetaEsquerda ?? '',
                          style: SIMEopsType.slug(color: SIMEopsColors.faint),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                  ),
                  if (etiquetaDireita != null &&
                      etiquetaDireita!.isNotEmpty) ...[
                    const SizedBox(width: 10),
                    Text(
                      etiquetaDireita!,
                      style: SIMEopsType.slug(
                          color: corEtiquetaDireita ?? SIMEopsColors.faint),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 8),
            ],
            Text(
              nome,
              style: estiloDoNome,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (qualificacao != null) ...[
              const SizedBox(height: 7),
              qualificacao!,
            ],
            if (figuras != null) ...[
              const SizedBox(height: 18),
              figuras!,
            ],
          ],
        ),
      ),
    );
  }
}

/// Um número que a tela carrega como moeda: a contagem de uma categoria, o
/// total de resultados de uma consulta.
///
/// O número fica em **tinta branca** e a cor mora no quadradinho ao lado —
/// número colorido a 21px sobre navy perde contraste e faz cinco matizes
/// brigarem entre si.
class Figura extends StatelessWidget {
  final String valor;
  final String rotulo;

  /// Chave de categoria. Sem ela não há quadradinho — é o caso do
  /// `56 RESULTADOS` do histórico, que não é categoria de nada.
  final String? categoria;

  final Color? corDoValor;
  final Color? corDoRotulo;
  final double tamanho;

  const Figura({
    super.key,
    required this.valor,
    required this.rotulo,
    this.categoria,
    this.corDoValor,
    this.corDoRotulo,
    this.tamanho = 21,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(valor,
            style: SIMEopsType.figure(size: tamanho, color: corDoValor)),
        const SizedBox(height: 7),
        Row(
          children: [
            if (categoria != null) ...[
              CatChip(categoria: categoria),
              const SizedBox(width: 5),
            ],
            Flexible(
              child: Text(
                rotulo,
                style:
                    SIMEopsType.slug(color: corDoRotulo ?? SIMEopsColors.faint)
                        .copyWith(letterSpacing: 0.77),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// A fila de figuras lado a lado, em colunas de largura igual.
///
/// Cabe: 412 − 36 de margem − 4×13 de gap = 324px ÷ 5 = 65px por coluna, e
/// `PATRIM.` em mono 9.5 ocupa ~40px mais o chip.
class FaixaDeFiguras extends StatelessWidget {
  final List<Figura> figuras;

  const FaixaDeFiguras({super.key, required this.figuras});

  @override
  Widget build(BuildContext context) {
    if (figuras.isEmpty) return const SizedBox.shrink();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < figuras.length; i++) ...[
          if (i > 0) const SizedBox(width: 13),
          Expanded(child: figuras[i]),
        ],
      ],
    );
  }
}
