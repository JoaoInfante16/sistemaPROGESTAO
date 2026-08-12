import 'package:flutter/material.dart';
import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';

/// Divisor de seção do fio: `HOJE · 04 AGO ─────────── 12 ▾`.
///
/// Era `——— HOJE (12) ▾ ———` centralizado entre dois filetes. Centralizado, o
/// olho precisa procurar onde a seção começa a cada bloco; ancorado à esquerda,
/// ele desce numa coluna só — que é o que faz uma lista longa ser varrida em
/// vez de lida.
///
/// `accent` destaca seções especiais (região metropolitana, fora do período).
class GroupHeader extends StatelessWidget {
  final String label;
  final int count;
  final bool expanded;
  final VoidCallback onTap;
  final Color? accent;

  /// Deslocamento à esquerda de uma semana **dentro** de uma pasta de mês.
  ///
  /// É o único sinal de hierarquia — sem linha de árvore, sem ícone de pasta,
  /// sem fundo. Doze pixels bastam porque o rótulo do mês (`JULHO`) e o da
  /// semana (`20–26 JUL`) já não se parecem.
  final double recuo;

  const GroupHeader({
    super.key,
    required this.label,
    required this.count,
    required this.expanded,
    required this.onTap,
    this.accent,
    this.recuo = 0,
  });

  @override
  Widget build(BuildContext context) {
    final ink = accent ?? SIMEopsColors.muted;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.fromLTRB(18 + recuo, recuo > 0 ? 16 : 24, 18, 6),
        child: Row(
          children: [
            Text(label.toUpperCase(), style: SIMEopsType.dateline(color: ink)),
            const SizedBox(width: 11),
            Expanded(
              child: Divider(
                color: accent?.withValues(alpha: 0.3) ?? SIMEopsColors.rule,
                height: 1,
                thickness: 1,
              ),
            ),
            const SizedBox(width: 11),
            Text(
              '$count',
              style: SIMEopsType.dateline(color: SIMEopsColors.faint),
            ),
            const SizedBox(width: 3),
            Icon(
              expanded ? Icons.expand_less : Icons.expand_more,
              size: 15,
              color: SIMEopsColors.faint,
            ),
          ],
        ),
      ),
    );
  }
}
