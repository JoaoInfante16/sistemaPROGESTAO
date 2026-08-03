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

  // Semânticas — calibradas para o navy, no lugar de Colors.* cru
  /// Badge NOVA, erros, tendência subindo (ruim). Vermelho dessaturado
  /// que não estoura sobre navy como o Colors.red puro.
  static const alert = Color(0xFFE5484D);

  /// Fonte oficial (gov). Positivo/queda de tendência usa o mesmo verde.
  static const official = green;

  /// Favorito/salvo — teal, não o indigo antigo.
  static const bookmark = teal;
}
