import 'package:flutter/material.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/crime_labels.dart';

/// Cidade no dashboard, em bloco de fio.
///
/// Era um `Card` com borda, ícone, badge vermelho e três readouts em cápsula.
/// Virou bloco aberto: nome em corpo grande, uma frase de resumo escrita como
/// analista falaria, e o filete que separa do próximo.
///
/// **Cidade sem novidade não ganha bloco** — vira [QuietCityRow], uma linha de
/// ~44px. É o que faz a grade sobreviver a 20 cidades sem virar planilha: dia
/// quieto colapsa sozinho, dia agitado expande sozinho. A regra é semântica
/// (tem não lida?), não um "top N" arbitrário.
class CityCard extends StatelessWidget {
  final CityOverview city;
  final VoidCallback onTap;

  const CityCard({super.key, required this.city, required this.onTap});

  /// A frase de resumo. Nasce dos campos que o backend já manda — e é o único
  /// lugar do app em que ele fala como gente em vez de painel.
  String get _summary {
    final total = city.totalCrimes30d;
    if (total == 0) {
      return 'Sem ocorrência publicada nos últimos trinta dias.';
    }

    final buf = StringBuffer('$total ${total == 1 ? 'ocorrência' : 'ocorrências'} '
        'em trinta dias.');

    final top = city.topCrimeType;
    final pct = city.topCrimePercent;
    if (top != null && top.isNotEmpty && pct > 0) {
      buf.write(' ${crimeTypeLabel(top)} responde por '
          '${pct.toStringAsFixed(0)}%, a maior fatia.');
    }

    // Grupo: dizer QUAIS cidades. "Grande Florianópolis" não informa nada a
    // quem não é de lá, e o app é vendido para fora da cidade monitorada.
    final names = city.cityNames;
    if (city.isGroup && names != null && names.isNotEmpty) {
      final preview = names.take(3).join(', ');
      final extra = names.length - 3;
      buf.write(' $preview${extra > 0 ? ' e mais $extra' : ''}.');
    }

    return buf.toString();
  }

  @override
  Widget build(BuildContext context) {
    final uf = city.parentState;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 21, 18, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    [
                      if (uf != null && uf.isNotEmpty) uf.toUpperCase(),
                      if (city.isGroup) '${city.cityCount ?? 0} CIDADES',
                    ].join(' · '),
                    style: SIMEopsType.slug(color: SIMEopsColors.faint),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (city.hasUnread)
                  Text(
                    '${city.unreadCount} ${city.unreadCount == 1 ? 'NOVA' : 'NOVAS'}',
                    style: SIMEopsType.slug(color: SIMEopsColors.greenLight),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              city.name,
              style: SIMEopsType.cityHeadline(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            Text(_summary, style: SIMEopsType.lead()),
            const SizedBox(height: 15),
          ],
        ),
      ),
    );
  }
}

/// Cidade sem nada novo: uma linha, não um bloco.
class QuietCityRow extends StatelessWidget {
  final CityOverview city;
  final VoidCallback onTap;

  const QuietCityRow({super.key, required this.city, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final uf = city.parentState;
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Text(
                uf != null && uf.isNotEmpty
                    ? '${city.name} · ${uf.toUpperCase()}'
                    : city.name,
                style: SIMEopsType.placeTab(active: false)
                    .copyWith(color: SIMEopsColors.muted, fontSize: 11),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              '${city.totalCrimes30d} em 30d',
              style: SIMEopsType.placeTab(active: false).copyWith(fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
