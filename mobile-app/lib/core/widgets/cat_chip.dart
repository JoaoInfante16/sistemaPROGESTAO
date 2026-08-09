import 'package:flutter/material.dart';

import '../utils/category_colors.dart';

/// O quadradinho que carrega a cor da categoria.
///
/// Existe como widget porque era o **mesmo objeto semântico desenhado em três
/// tamanhos** — 6px no card do dashboard, 7px na slug da matéria, 8px na
/// legenda do relatório. Ninguém aponta isso conscientemente; todo mundo sente
/// que o app não tem dono.
///
/// 7px é o tamanho: menor some ao lado de texto de 9.5, maior compete com a
/// palavra que ele acompanha.
///
/// Sem canto arredondado, como todo o resto do sistema. E **sempre acompanhado
/// da palavra** — o quadrado sozinho não é aprendível e não sobrevive a
/// daltonismo, que é a razão de a paleta ter sido medida (ver
/// `category_colors.dart`).
class CatChip extends StatelessWidget {
  /// Chave da categoria (`seguranca`, `patrimonial`...). Quando null, o chip
  /// fica em tinta neutra — é o caso de agrupamentos que **não são** categoria.
  final String? categoria;

  /// Cor explícita, para quando quem chama já resolveu (legenda de gráfico).
  final Color? cor;

  final double size;

  const CatChip({super.key, this.categoria, this.cor, this.size = 7});

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        color: cor ?? categoryColor(categoria),
      );
}
