import 'package:flutter/material.dart';
import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';
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
            style: SIMEopsType.note(color: SIMEopsColors.faint),
          ),
        ),
      );
    }

    final maxVal = data.fold<int>(1, (m, e) => safeInt(e['total']) > m ? safeInt(e['total']) : m);

    // 🚨 Era `height - 30`, e a conta não fechava: a coluna empilha número
    // (~14) + 3 + barra + 5 + rótulo (~14) = 36 de texto e vão. Com 30 de
    // reserva, a barra mais alta empurrava o rótulo **pra fora da caixa** —
    // era o `0…` desalinhado embaixo da barra de 35 que o João viu na foto.
    const alturaDaLinha = 14.0;
    const vaoDeCima = 3.0;
    const vaoDeBaixo = 5.0;
    final maxBarHeight =
        height - (alturaDaLinha * 2) - vaoDeCima - vaoDeBaixo;

    return LayoutBuilder(
      builder: (context, restricao) {
        // Quantos rótulos cabem sem se atropelar.
        //
        // `05/07` em mono 9.5 com tracking pede ~35px; treze semanas numa
        // faixa de 408px dão 27px de coluna. O widget respondia truncando
        // **todos** os rótulos pra `0…`, o que é pior que não ter rótulo
        // nenhum: ocupa a linha inteira e não informa uma data sequer.
        //
        // Agora ele rotula de N em N, **ancorado na última semana** — que é a
        // que interessa — e as intermediárias ficam mudas. Eixo de jornal é
        // assim: marca alguns pontos e deixa o resto respirar.
        const larguraDoRotulo = 36.0;
        final larguraDaColuna = restricao.maxWidth / data.length;
        final passo = (larguraDoRotulo / larguraDaColuna).ceil().clamp(
          1,
          data.length,
        );

        return SizedBox(
          height: height,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < data.length; i++)
                Builder(
                  builder: (_) {
                    final total = safeInt(data[i]['total']);
                    final barHeight = maxVal > 0
                        ? (total / maxVal) * maxBarHeight
                        : 0.0;
                    final rotula = (data.length - 1 - i) % passo == 0;

                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            // Semana zerada não escreve `0`: numa série de
                            // treze semanas com oito vazias, eram oito zeros
                            // ocupando a linha de cima pra dizer o que o
                            // filete embaixo já diz.
                            SizedBox(
                              height: alturaDaLinha,
                              child: total > 0
                                  ? Text(
                                      '$total',
                                      style: SIMEopsType.slug(
                                        color: SIMEopsColors.white,
                                      ),
                                    )
                                  : null,
                            ),
                            const SizedBox(height: vaoDeCima),
                            // Semana sem ocorrência fica com um filete de 2px
                            // em vez de sumir: o vazio é informação — foi uma
                            // semana medida, não uma semana faltando.
                            Container(
                              height: total > 0
                                  ? barHeight.clamp(4.0, maxBarHeight)
                                  : 2.0,
                              color: total > 0
                                  ? SIMEopsColors.teal
                                  : SIMEopsColors.rule,
                            ),
                            const SizedBox(height: vaoDeBaixo),
                            SizedBox(
                              height: alturaDaLinha,
                              child: rotula
                                  ? Text(
                                      (data[i]['label'] as String?) ?? '',
                                      style: SIMEopsType.slug(
                                        color: SIMEopsColors.faint,
                                      ),
                                      maxLines: 1,
                                      softWrap: false,
                                      overflow: TextOverflow.visible,
                                    )
                                  : null,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        );
      },
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
