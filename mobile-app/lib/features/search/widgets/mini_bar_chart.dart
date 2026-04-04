import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';

class MiniBarChart extends StatelessWidget {
  final List<Map<String, dynamic>> data; // [{tipo_crime, count, percentage}]

  const MiniBarChart({super.key, required this.data});

  static const _colors = <String, Color>{
    'Roubo': Color(0xFFef4444),
    'Furto': Color(0xFFf97316),
    'Assalto': Color(0xFFdc2626),
    'Homicídio': Color(0xFF7f1d1d),
    'Latrocínio': Color(0xFF991b1b),
    'Tráfico': Color(0xFF7c3aed),
  };

  Color _getColor(String tipo) =>
      _colors[tipo] ?? const Color(0xFF6b7280);

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) {
      return const Center(
        child: Text('Sem dados', style: TextStyle(color: Colors.grey)),
      );
    }

    final maxCount = data.fold<int>(
      0,
      (max, d) => (d['count'] as int) > max ? d['count'] as int : max,
    );

    return SizedBox(
      height: data.length * 44.0 + 20,
      child: BarChart(
        BarChartData(
          alignment: BarChartAlignment.spaceAround,
          maxY: maxCount.toDouble() * 1.15,
          barTouchData: BarTouchData(
            touchTooltipData: BarTouchTooltipData(
              getTooltipItem: (group, groupIndex, rod, rodIndex) {
                final d = data[groupIndex];
                return BarTooltipItem(
                  '${d['tipo_crime']}: ${d['count']}',
                  const TextStyle(color: Colors.white, fontSize: 12),
                );
              },
            ),
          ),
          titlesData: FlTitlesData(
            show: true,
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, meta) {
                  final idx = value.toInt();
                  if (idx < 0 || idx >= data.length) return const SizedBox();
                  final tipo = data[idx]['tipo_crime'] as String;
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      tipo.length > 8 ? '${tipo.substring(0, 7)}.' : tipo,
                      style: const TextStyle(fontSize: 10),
                    ),
                  );
                },
              ),
            ),
            leftTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            topTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            rightTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
          ),
          borderData: FlBorderData(show: false),
          gridData: const FlGridData(show: false),
          barGroups: data.asMap().entries.map((entry) {
            final i = entry.key;
            final d = entry.value;
            return BarChartGroupData(
              x: i,
              barRods: [
                BarChartRodData(
                  toY: (d['count'] as int).toDouble(),
                  color: _getColor(d['tipo_crime'] as String),
                  width: 20,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }
}
