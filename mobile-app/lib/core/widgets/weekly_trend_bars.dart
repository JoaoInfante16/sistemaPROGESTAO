import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../main.dart';
import '../utils/type_helpers.dart';

// Bar chart de tendência semanal — compartilhado entre auto-scan (city_detail)
// e busca manual (report_screen). Uniforme e simples: 1 barra por semana,
// altura proporcional ao máximo, total exibido em cima.
//
// Entrada: List de Map {total, label}. Vindo do backend (dataPoints agrupados
// por week) ou computado no client a partir de datas individuais.
class WeeklyTrendBars extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  final double height;

  const WeeklyTrendBars({
    super.key,
    required this.data,
    this.height = 110,
  });

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text(
            'Sem dados de tendência no período',
            style: GoogleFonts.exo2(fontSize: 12, color: SIMEopsColors.muted),
          ),
        ),
      );
    }

    final maxVal = data.fold<int>(1, (m, e) => safeInt(e['total']) > m ? safeInt(e['total']) : m);
    final maxBarHeight = height - 30; // reserva espaço pro label superior + inferior

    return SizedBox(
      height: height,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: data.map((t) {
          final total = safeInt(t['total']);
          final label = (t['label'] as String?) ?? '';
          final barHeight = maxVal > 0 ? (total / maxVal) * maxBarHeight : 0.0;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text('$total',
                      style: GoogleFonts.exo2(
                          fontSize: 9,
                          color: total > 0
                              ? SIMEopsColors.white.withValues(alpha: 0.8)
                              : SIMEopsColors.muted.withValues(alpha: 0.4))),
                  const SizedBox(height: 2),
                  Container(
                    height: total > 0 ? barHeight.clamp(4.0, maxBarHeight) : 2.0,
                    decoration: BoxDecoration(
                      color: total > 0
                          ? SIMEopsColors.teal.withValues(alpha: 0.7)
                          : SIMEopsColors.muted.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(label,
                      style: GoogleFonts.exo2(fontSize: 8, color: SIMEopsColors.muted),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// Helper: agrupa [{date: 'YYYY-MM-DD', count: N}] por semana ISO.
// Retorna [{label: 'dd/MM', total: N}] com todas as semanas do período
// (inclusive sem ocorrência — fica barra fininha cinza, mostra o "vazio").
List<Map<String, dynamic>> aggregateByWeek(List<Map<String, dynamic>> dailyData) {
  if (dailyData.isEmpty) return const [];

  // Parse dates + encontra min/max
  final parsed = <DateTime, int>{};
  DateTime? minDate, maxDate;
  for (final e in dailyData) {
    final dateStr = e['date'] as String? ?? '';
    if (dateStr.isEmpty) continue;
    try {
      final d = DateTime.parse(dateStr);
      parsed[d] = (parsed[d] ?? 0) + safeInt(e['count']);
      if (minDate == null || d.isBefore(minDate)) minDate = d;
      if (maxDate == null || d.isAfter(maxDate)) maxDate = d;
    } catch (_) {}
  }
  if (minDate == null || maxDate == null) return const [];

  // Começa na segunda-feira da semana do minDate
  DateTime weekStart = minDate.subtract(Duration(days: minDate.weekday - 1));

  final result = <Map<String, dynamic>>[];
  while (!weekStart.isAfter(maxDate)) {
    final weekEnd = weekStart.add(const Duration(days: 6));
    int total = 0;
    parsed.forEach((date, count) {
      if (!date.isBefore(weekStart) && !date.isAfter(weekEnd)) {
        total += count;
      }
    });
    final label = '${weekStart.day.toString().padLeft(2, '0')}/${weekStart.month.toString().padLeft(2, '0')}';
    result.add({'label': label, 'total': total});
    weekStart = weekStart.add(const Duration(days: 7));
  }
  return result;
}
