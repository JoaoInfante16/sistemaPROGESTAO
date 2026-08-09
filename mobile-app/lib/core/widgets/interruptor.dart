import 'package:flutter/material.dart';

import '../theme/simeops_colors.dart';

/// Interruptor retangular.
///
/// O `Switch` do Material é a peça mais arredondada que existe — cápsula,
/// bolinha e ondinha de toque — e destoa de telas feitas só de filete. Este
/// tem a mesma silhueta do resto do app: retângulo, e um retângulo menor que
/// corre de um lado ao outro.
///
/// Nasceu privado no `settings_screen.dart`. Virou peça compartilhada quando o
/// relatório precisou do mesmo interruptor pra ligar a região metropolitana —
/// e a Fase F vai precisar dele de novo, nas preferências de notificação. Três
/// cópias do mesmo desenho é como uma linguagem visual se perde.
class Interruptor extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const Interruptor({super.key, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        width: 42,
        height: 23,
        decoration: BoxDecoration(
          color: value
              ? SIMEopsColors.green.withValues(alpha: 0.18)
              : SIMEopsColors.navyLight,
          border: Border.all(
            color: value ? SIMEopsColors.green : SIMEopsColors.ruleStrong,
          ),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 160),
          curve: Curves.easeOut,
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 15,
            height: 15,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            color: value ? SIMEopsColors.greenLight : SIMEopsColors.faint,
          ),
        ),
      ),
    );
  }
}
