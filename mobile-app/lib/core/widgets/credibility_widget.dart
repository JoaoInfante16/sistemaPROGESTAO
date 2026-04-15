import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../main.dart';

class CredibilityBadge extends StatelessWidget {
  final int officialCount;
  final int mediaCount;

  const CredibilityBadge({super.key, required this.officialCount, required this.mediaCount});

  int get _total => officialCount + mediaCount;
  int get _percent => _total > 0 ? (officialCount * 100 ~/ _total) : 0;

  String get _label {
    if (_percent > 50) return 'Alta confiabilidade';
    if (_percent > 20) return 'Confiabilidade moderada';
    return 'Baseado em fontes jornalísticas';
  }

  Color get _color {
    if (_percent > 50) return Colors.green;
    if (_percent > 20) return Colors.amber;
    return SIMEopsColors.muted;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(Icons.shield, size: 28, color: _color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_label, style: GoogleFonts.exo2(fontSize: 14, fontWeight: FontWeight.w600, color: _color)),
                const SizedBox(height: 2),
                Text(
                  '$officialCount fonte${officialCount != 1 ? 's' : ''} oficial${officialCount != 1 ? 'is' : ''} · $mediaCount fonte${mediaCount != 1 ? 's' : ''} jornalística${mediaCount != 1 ? 's' : ''}',
                  style: GoogleFonts.exo2(fontSize: 11, color: SIMEopsColors.muted),
                ),
              ],
            ),
          ),
          if (_total > 0)
            Text('$_percent%', style: GoogleFonts.rajdhani(fontSize: 22, fontWeight: FontWeight.w800, color: _color)),
        ],
      ),
    );
  }
}

class CredibilityChart extends StatelessWidget {
  final int officialCount;
  final int mediaCount;

  const CredibilityChart({super.key, required this.officialCount, required this.mediaCount});

  @override
  Widget build(BuildContext context) {
    final total = officialCount + mediaCount;
    if (total == 0) return const SizedBox();
    final pct = (officialCount * 100 ~/ total);

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SIMEopsColors.navyMid.withValues(alpha: 0.95),
        border: Border.all(color: SIMEopsColors.teal.withValues(alpha: 0.15)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('CREDIBILIDADE DAS FONTES',
              style: GoogleFonts.rajdhani(fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 2, color: SIMEopsColors.muted)),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 12,
              child: Row(
                children: [
                  Expanded(
                    flex: pct,
                    child: Container(color: Colors.green),
                  ),
                  Expanded(
                    flex: 100 - pct,
                    child: Container(color: SIMEopsColors.muted.withValues(alpha: 0.2)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: Colors.green, borderRadius: BorderRadius.circular(3))),
                  const SizedBox(width: 6),
                  Text('Oficial: $officialCount ($pct%)', style: GoogleFonts.exo2(fontSize: 11, color: SIMEopsColors.muted)),
                ],
              ),
              Row(
                children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: SIMEopsColors.muted.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(3))),
                  const SizedBox(width: 6),
                  Text('Mídia: $mediaCount (${100 - pct}%)', style: GoogleFonts.exo2(fontSize: 11, color: SIMEopsColors.muted)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
