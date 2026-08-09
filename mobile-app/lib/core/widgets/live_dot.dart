import 'package:flutter/material.dart';

import '../theme/simeops_colors.dart';

/// Ponto que respira ao lado de "ÚLTIMA HÁ 2H" — o único movimento da tela.
///
/// Respeita "reduzir movimento" do sistema: pulsar sem parar é desconforto real
/// pra quem tem sensibilidade vestibular, e a informação não depende da
/// animação — o texto ao lado já diz há quanto tempo foi.
///
/// ⚠️ Ele **não distingue estado**: está sempre verde. Só vai virar sinal de
/// verdade quando puder ficar âmbar, e isso exige a **hora da varredura**, que
/// o backend não expõe. O que existe é `lastNewsAt`, o `created_at` da
/// ocorrência mais recente — mede a imprensa, não o robô. Não construir
/// semáforo de saúde em cima dele: é a mesma mentira que o rótulo "VARREDURA
/// HÁ" já contou uma vez.
class LiveDot extends StatefulWidget {
  const LiveDot({super.key});

  @override
  State<LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<LiveDot> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  static const _dot = SizedBox(
    width: 5,
    height: 5,
    child: DecoratedBox(
      decoration: BoxDecoration(
        color: SIMEopsColors.greenLight,
        shape: BoxShape.circle,
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduce) return _dot;
    return FadeTransition(
      opacity: Tween<double>(begin: 0.3, end: 1).animate(
        CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
      ),
      child: _dot,
    );
  }
}
