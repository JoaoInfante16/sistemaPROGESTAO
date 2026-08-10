import 'package:flutter/material.dart';

import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';

/// Confirmação de cancelamento de uma consulta em andamento.
///
/// Mora aqui porque dois lugares cancelam: a tela de espera e o item
/// `EM ANDAMENTO` do histórico. Copy de aviso duplicada é copy que diverge —
/// um dos dois é corrigido e o outro segue prometendo outra coisa.
///
/// **`CANCELAR` em vermelho, não em verde.** O verde do app é o botão que
/// confirma ou dispara (`ENTRAR`, `INICIAR CONSULTA`, `REFAZER`), e este joga
/// fora o que já foi coletado. É o mesmo par do diálogo de apagar consulta:
/// a saída neutra em botão de texto, a ação destrutiva pintada.
Future<bool> confirmarCancelamentoDeConsulta(BuildContext context) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: SIMEopsColors.navyLight,
      shape: const RoundedRectangleBorder(
        side: BorderSide(color: SIMEopsColors.ruleStrong),
      ),
      title: Text('Cancelar a consulta?', style: SIMEopsType.dialogTitle()),
      content: Text(
        'Ela roda no servidor e termina sozinha mesmo com o app fechado. '
        'Cancelar agora descarta o que já foi coletado.',
        style: SIMEopsType.lead(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('CONTINUAR ESPERANDO'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: FilledButton.styleFrom(
            backgroundColor: SIMEopsColors.alert,
            foregroundColor: SIMEopsColors.white,
          ),
          child: const Text('CANCELAR'),
        ),
      ],
    ),
  );
  return ok == true;
}
