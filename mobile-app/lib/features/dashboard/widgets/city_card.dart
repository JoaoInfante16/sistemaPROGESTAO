import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/utils/crime_labels.dart';

// Card de cidade/grupo do dashboard. O CityOverview chega com tendência,
// crime predominante e última atividade — o card mostra tudo isso como
// readouts, não só o total (antes metade do modelo era jogada fora).
class CityCard extends StatelessWidget {
  final CityOverview city;
  final VoidCallback onTap;

  const CityCard({super.key, required this.city, required this.onTap});

  String _footerText(CityOverview c) {
    if (!c.isGroup) return c.parentState ?? '';

    final n = c.cityCount ?? 0;
    final cityWord = n == 1 ? 'cidade' : 'cidades';

    // Preview dos nomes: "Florianópolis, São José +3"
    final names = c.cityNames ?? const [];
    if (names.isNotEmpty) {
      final preview = names.take(2).join(', ');
      final extra = names.length - 2;
      return extra > 0 ? '$preview +$extra' : preview;
    }

    if (c.parentState != null) {
      return '${c.parentState} · $n $cityWord';
    }

    final s = c.stateCount ?? 0;
    if (s > 1) {
      final stateWord = s == 1 ? 'estado' : 'estados';
      return '$s $stateWord · $n $cityWord';
    }

    return '$n $cityWord';
  }

  // "há 2h" / "há 3d" / "agora" — última ocorrência registrada.
  String? get _lastActivity {
    final t = city.lastNewsAt;
    if (t == null) return null;
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 60) return 'agora';
    if (diff.inHours < 24) return 'há ${diff.inHours}h';
    return 'há ${diff.inDays}d';
  }

  @override
  Widget build(BuildContext context) {
    final trend = city.trendPercent;
    final hasTrend = trend != 0;
    // Mais crime = ruim (alert); menos = bom (official).
    final trendColor = city.trendUp
        ? SIMEopsColors.alert
        : city.trendDown
            ? SIMEopsColors.official
            : SIMEopsColors.muted;
    final trendText = hasTrend
        ? '${city.trendUp ? '▲' : '▼'} ${trend.abs().toStringAsFixed(0)}%'
        : '—';

    final topCrime = city.topCrimeType;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: ícone + nome + badge de não lidas
              Row(
                children: [
                  Icon(
                    city.isGroup ? Icons.layers : Icons.location_city,
                    size: 16,
                    color: city.isGroup
                        ? SIMEopsColors.teal
                        : SIMEopsColors.muted.withValues(alpha: 0.7),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      city.name,
                      style: GoogleFonts.exo2(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: SIMEopsColors.white,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (city.hasUnread)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: SIMEopsColors.alert.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${city.unreadCount} NOVA${city.unreadCount > 1 ? 'S' : ''}',
                        style: GoogleFonts.rajdhani(
                          color: SIMEopsColors.alert,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),

              // Readouts: total · tendência · crime predominante
              Row(
                children: [
                  _Readout(
                    value: '${city.totalCrimes}',
                    label: 'OCORRÊNCIAS',
                  ),
                  _dividerVertical(),
                  _Readout(
                    value: trendText,
                    label: '30 DIAS',
                    valueColor: trendColor,
                  ),
                  if (topCrime != null && topCrime.isNotEmpty) ...[
                    _dividerVertical(),
                    Expanded(
                      child: _Readout(
                        value: crimeTypeLabel(topCrime),
                        label:
                            'PREDOMINANTE${city.topCrimePercent > 0 ? ' · ${city.topCrimePercent.toStringAsFixed(0)}%' : ''}',
                        compactValue: true,
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),

              // Footer: contexto + última atividade + chevron
              Row(
                children: [
                  Icon(Icons.location_on,
                      size: 12,
                      color: SIMEopsColors.muted.withValues(alpha: 0.6)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      _footerText(city),
                      style: GoogleFonts.exo2(
                        fontSize: 11.5,
                        color: SIMEopsColors.muted,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (_lastActivity != null) ...[
                    Text(
                      _lastActivity!,
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 10,
                        color: SIMEopsColors.muted.withValues(alpha: 0.7),
                      ),
                    ),
                    const SizedBox(width: 4),
                  ],
                  Icon(Icons.chevron_right,
                      size: 18,
                      color: SIMEopsColors.muted.withValues(alpha: 0.6)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _dividerVertical() {
    return Container(
      width: 1,
      height: 26,
      margin: const EdgeInsets.symmetric(horizontal: 12),
      color: SIMEopsColors.teal.withValues(alpha: 0.15),
    );
  }
}

class _Readout extends StatelessWidget {
  final String value;
  final String label;
  final Color? valueColor;
  // Valor textual (nome de crime) usa fonte menor que os numéricos.
  final bool compactValue;

  const _Readout({
    required this.value,
    required this.label,
    this.valueColor,
    this.compactValue = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: compactValue
              ? GoogleFonts.exo2(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: valueColor ?? SIMEopsColors.white,
                )
              : GoogleFonts.jetBrainsMono(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: valueColor ?? SIMEopsColors.tealLight,
                ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: GoogleFonts.rajdhani(
            fontSize: 9,
            letterSpacing: 1.2,
            fontWeight: FontWeight.w600,
            color: SIMEopsColors.muted.withValues(alpha: 0.6),
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
