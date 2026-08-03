import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/simeops_colors.dart';

// Header de seção colapsável: `——— HOJE (12) ▾ ———`.
// Evolução do padrão Divider — LABEL — Divider que o feed já usava; agora
// tocável, com contagem e chevron. `accent` destaca seções especiais
// (indicadores, região metropolitana, fora do período).
class GroupHeader extends StatelessWidget {
  final String label;
  final int count;
  final bool expanded;
  final VoidCallback onTap;
  final Color? accent;

  const GroupHeader({
    super.key,
    required this.label,
    required this.count,
    required this.expanded,
    required this.onTap,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final textColor = accent ?? SIMEopsColors.muted.withValues(alpha: 0.75);
    final lineColor = accent != null
        ? accent!.withValues(alpha: 0.25)
        : Colors.white.withValues(alpha: 0.08);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
        child: Row(
          children: [
            Expanded(child: Divider(color: lineColor)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$label ($count)',
                    style: GoogleFonts.rajdhani(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: textColor,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(
                    expanded ? Icons.expand_less : Icons.expand_more,
                    size: 14,
                    color: textColor,
                  ),
                ],
              ),
            ),
            Expanded(child: Divider(color: lineColor)),
          ],
        ),
      ),
    );
  }
}
