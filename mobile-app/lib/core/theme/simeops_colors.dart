import 'package:flutter/material.dart';

// Paleta SIMEops — identidade "corporativo operacional": navy profundo,
// teal como cor de ação, verde como positivo/oficial. Fonte única de cor
// do app; nenhuma tela deve usar Colors.* de matiz (red/indigo/grey...)
// fora daqui. Cores de categoria de crime moram em utils/category_colors.dart.
class SIMEopsColors {
  // Base
  static const navy = Color(0xFF060D18);
  static const navyMid = Color(0xFF0A1828);
  static const navyLight = Color(0xFF112233);
  static const teal = Color(0xFF1A8F9A);
  static const tealLight = Color(0xFF22B5C4);
  static const green = Color(0xFF7AB648);
  static const greenLight = Color(0xFF92D050);
  static const white = Color(0xFFF0F4F8);
  static const muted = Color(0xFF8FA9C0);

  // Escala de tinta — contraste medido sobre navy (#060D18), WCAG AA pede
  // 4.5:1 pra texto pequeno. O app roda no sol, em celular com brilho baixo:
  // metadado ilegível some, e metadado é onde mora bairro e hora.
  //   white  17.8:1  |  muted 8.0:1  |  faint 4.8:1  |  hairline 1.8:1
  /// Terciário — ainda passa AA. **Piso pra qualquer texto**, inclusive
  /// placeholder e estado inativo.
  static const faint = Color(0xFF6E8092);

  /// SÓ decoração (marca de fim de matéria, separador). **Nunca texto.**
  ///
  /// 1.8:1 não é "discreto", é invisível. Estava pintando duas coisas que
  /// precisavam ser lidas: o placeholder dos campos (que é instrução de
  /// formato) e os passos ainda não executados da tela de espera — justo a
  /// tela em que a pessoa encara 7 minutos, e em que os passos que faltam são
  /// a prova de que a busca tem plano. Ambos foram para [faint].
  static const hairline = Color(0xFF2A3F55);

  /// Filete entre matérias e sob as faixas de controle.
  static const rule = Color(0xFF16293C);

  /// Filete de campo de formulário e borda de bloco — um passo acima do rule.
  static const ruleStrong = Color(0xFF22394F);

  // Semânticas — calibradas para o navy, no lugar de Colors.* cru
  /// Badge NOVA, erros, tendência subindo (ruim). Vermelho dessaturado
  /// que não estoura sobre navy como o Colors.red puro.
  static const alert = Color(0xFFE5484D);

  /// Fonte oficial (gov). Positivo/queda de tendência usa o mesmo verde.
  static const official = green;
}
