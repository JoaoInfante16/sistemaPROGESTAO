import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../main.dart';

class RiskScoreWidget extends StatelessWidget {
  final double score;
  final String level; // 'baixo', 'moderado', 'alto'

  const RiskScoreWidget({super.key, required this.score, required this.level});

  Color get _color {
    if (score <= 3) return Colors.green;
    if (score <= 6) return Colors.amber;
    return Colors.red;
  }

  String get _label {
    switch (level) {
      case 'alto': return 'Risco Alto';
      case 'moderado': return 'Risco Moderado';
      default: return 'Risco Baixo';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SIMEopsColors.navyMid.withValues(alpha: 0.95),
        border: Border.all(color: _color.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _color.withValues(alpha: 0.15),
              border: Border.all(color: _color.withValues(alpha: 0.4), width: 2),
            ),
            child: Center(
              child: Text(
                score.toStringAsFixed(1),
                style: GoogleFonts.rajdhani(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: _color,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _label,
                  style: GoogleFonts.rajdhani(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: _color,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Índice calculado com base na gravidade e frequência das ocorrências',
                  style: GoogleFonts.exo2(fontSize: 11, color: SIMEopsColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
