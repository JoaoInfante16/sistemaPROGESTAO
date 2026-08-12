import 'package:flutter/material.dart';
import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';
import '../utils/type_helpers.dart';

/// Volume no tempo — compartilhado entre o monitoramento (`city_detail`) e a
/// consulta (`relatorio_de_risco`). Uma barra por balde, altura proporcional
/// ao máximo, total em cima.
///
/// 🚨 Chamava-se `WeeklyTrendBars`, e o nome era o defeito: **semana era um
/// balde fixo**, e o número de barras crescia sem teto junto com a janela.
/// 7 dias davam 2 barras; o `TUDO` deu 16 (foto do João, 11/08, com os rótulos
/// encavalados); um ano daria 52. Qualquer conserto de rótulo só adia o ponto
/// em que a coisa quebra.
///
/// Agora quem manda é [baldeDaJanela]: o balde segue o período, e o número de
/// barras fica entre 4 e ~13 **em qualquer janela**. Ver a tabela lá embaixo.
class VolumeNoTempo extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  final double height;

  const VolumeNoTempo({super.key, required this.data, this.height = 110});

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

    final maxVal = data.fold<int>(
      1,
      (m, e) => safeInt(e['total']) > m ? safeInt(e['total']) : m,
    );

    // 🚨 Era `height - 30`, e a conta não fechava: a coluna empilha número
    // (~14) + 3 + barra + 5 + rótulo (~14) = 36 de texto e vão. Com 30 de
    // reserva, a barra mais alta empurrava o rótulo **pra fora da caixa**.
    const alturaDaLinha = 14.0;
    const vaoDeCima = 3.0;
    const vaoDeBaixo = 5.0;
    final maxBarHeight = height - (alturaDaLinha * 2) - vaoDeCima - vaoDeBaixo;

    return LayoutBuilder(
      builder: (context, restricao) {
        // Quantos rótulos cabem sem se atropelar.
        //
        // Com o balde adaptativo isto virou rede de segurança em vez de
        // remendo: no pior caso (90 dias = 13 semanas) a coluna tem ~33px e o
        // rótulo `05/07` pede ~35, então ele rotula de duas em duas. Antes o
        // widget respondia truncando **todos** os rótulos pra `0…`, que é pior
        // que não ter rótulo: ocupa a linha e não informa uma data sequer.
        //
        // Ancorado na **última** barra, que é a que interessa.
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
                            // Balde zerado não escreve `0`: numa série com
                            // metade vazia, eram oito zeros ocupando a linha
                            // de cima pra dizer o que o filete embaixo já diz.
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
                            // Balde sem ocorrência fica com um filete de 2px
                            // em vez de sumir: o vazio é informação — foi um
                            // período medido, não um período faltando.
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

/// Qual balde uma janela de [dias] pede — **a peça central deste arquivo**.
///
/// O teto de barras é o que estava faltando. Com esta regra:
///
/// | janela        | balde  | barras |
/// |---------------|--------|--------|
/// | 7 dias        | dia    | 7      |
/// | 30 dias       | semana | 5      |
/// | 90 dias       | semana | 13     |
/// | TUDO (110d)   | mês    | 4      |
/// | 1 ano         | mês    | 12     |
///
/// Nunca passa de ~13, em nenhum período.
///
/// Os cortes não são redondos por acaso: **14** porque 30 barras diárias não
/// cabem em 430px, e **90** porque 13 semanas é o limite do que ainda rotula.
///
/// O nome do balde é o que o backend espera em `groupBy` — ver `getCrimeTrend`
/// em `analyticsQueries.ts`, que já aceitava os três desde sempre e nunca
/// recebeu outra coisa além de `week`.
String baldeDaJanela(int dias) {
  if (dias <= 14) return 'day';
  if (dias <= 90) return 'week';
  return 'month';
}

const _meses = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

/// Agrupa `[{date: 'YYYY-MM-DD', count: N}]` no balde de uma janela de [dias].
///
/// É o caminho da **consulta**, que conta no cliente a partir das datas dos
/// itens; o monitoramento pede a mesma coisa ao backend. Os dois usam
/// [baldeDaJanela], então a mesma janela desenha o mesmo gráfico nas duas
/// telas — antes o monitoramento rotulava `Sem 18` (número da semana ISO, que
/// ninguém sabe datar) e a consulta rotulava `05/07`, no mesmo widget.
///
/// Devolve **todos** os baldes do período, inclusive os vazios: buraco no meio
/// da série é informação, e sumir com ele encurta o eixo e mente sobre o tempo.
List<Map<String, dynamic>> agruparNoTempo(
  List<Map<String, dynamic>> dailyData,
  int dias,
) {
  if (dailyData.isEmpty) return const [];

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

  // O balde sai do MAIOR entre a janela pedida e o que os dados realmente
  // cobrem. Parece detalhe e não é: com a **tolerância de período** ligada, uma
  // consulta de 30 dias passa a mostrar itens de até 180 dias atrás. Escolher o
  // balde só pela janela pedida daria 26 barras semanais numa tela que pediu
  // 5 — o mesmo defeito, entrando por outra porta.
  final span = maxDate.difference(minDate).inDays;
  final balde = baldeDaJanela(dias > span ? dias : span);
  final result = <Map<String, dynamic>>[];

  int somaEntre(DateTime ini, DateTime fim) {
    var total = 0;
    parsed.forEach((date, count) {
      if (!date.isBefore(ini) && !date.isAfter(fim)) total += count;
    });
    return total;
  }

  String doisDigitos(int n) => n.toString().padLeft(2, '0');

  if (balde == 'day') {
    var d = minDate;
    while (!d.isAfter(maxDate)) {
      result.add({
        'label': '${doisDigitos(d.day)}/${doisDigitos(d.month)}',
        'total': somaEntre(d, d),
      });
      d = d.add(const Duration(days: 1));
    }
  } else if (balde == 'week') {
    // Começa na segunda-feira da semana do minDate.
    var inicio = minDate.subtract(Duration(days: minDate.weekday - 1));
    while (!inicio.isAfter(maxDate)) {
      final fim = inicio.add(const Duration(days: 6));
      result.add({
        'label': '${doisDigitos(inicio.day)}/${doisDigitos(inicio.month)}',
        'total': somaEntre(inicio, fim),
      });
      inicio = inicio.add(const Duration(days: 7));
    }
  } else {
    var ano = minDate.year;
    var mes = minDate.month;
    while (ano < maxDate.year ||
        (ano == maxDate.year && mes <= maxDate.month)) {
      final ini = DateTime(ano, mes, 1);
      final fim = DateTime(ano, mes + 1, 0);
      result.add({'label': _meses[mes - 1], 'total': somaEntre(ini, fim)});
      mes++;
      if (mes > 12) {
        mes = 1;
        ano++;
      }
    }
  }

  return result;
}
