import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../main.dart';

// Seção "Fontes Analisadas" compartilhada entre city_detail (auto-scan) e
// report_screen (busca manual). Agrupa fontes por hostname com count,
// separa oficiais (gov.br/ssp/etc) de mídia, e mostra contador no header.
//
// Input: listas de Map {'name': hostname, 'count': 'N'} já deduplicadas.
// Sem clicabilidade (fonte do "resuminho" por URL foi retirado a pedido do João).
class FontesAnalisadas extends StatelessWidget {
  final List<Map<String, String>> oficiais;
  final List<Map<String, String>> midias;

  const FontesAnalisadas({
    super.key,
    required this.oficiais,
    required this.midias,
  });

  @override
  Widget build(BuildContext context) {
    if (oficiais.isEmpty && midias.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Título com contador (oficiais · mídias) + linha horizontal
        Padding(
          padding: const EdgeInsets.only(bottom: 10, top: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text('FONTES ANALISADAS',
                  style: GoogleFonts.rajdhani(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2,
                      color: SIMEopsColors.muted)),
              const SizedBox(width: 10),
              Text(
                '${oficiais.length} oficiais · ${midias.length} mídias',
                style: GoogleFonts.exo2(
                    fontSize: 10,
                    letterSpacing: 0.5,
                    color: SIMEopsColors.muted.withValues(alpha: 0.5)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                    height: 1,
                    color: SIMEopsColors.teal.withValues(alpha: 0.15)),
              ),
            ],
          ),
        ),
        // Card com lista de fontes — oficiais primeiro, depois mídia
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: SIMEopsColors.navyLight.withValues(alpha: 0.4),
            border: Border.all(color: SIMEopsColors.teal.withValues(alpha: 0.2)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...List.generate(
                oficiais.length,
                (i) => _sourceRow(i + 1, oficiais[i], true),
              ),
              ...List.generate(
                midias.length,
                (i) => _sourceRow(oficiais.length + i + 1, midias[i], false),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _sourceRow(int index, Map<String, String> source, bool isOfficial) {
    final color = isOfficial ? SIMEopsColors.tealLight : SIMEopsColors.muted;
    final count = int.tryParse(source['count'] ?? '1') ?? 1;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Text('[$index]  ',
              style: GoogleFonts.exo2(
                  fontSize: 11, color: SIMEopsColors.muted.withValues(alpha: 0.5))),
          Expanded(
            child: Text(source['name'] ?? '',
                style: GoogleFonts.exo2(fontSize: 13, color: color),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
          ),
          if (count > 1)
            Text('${count}x',
                style: GoogleFonts.jetBrainsMono(
                    fontSize: 11, color: SIMEopsColors.muted.withValues(alpha: 0.7))),
        ],
      ),
    );
  }
}

// Helper: agrupa uma lista de URLs em {oficiais, midias} deduplicados por
// hostname com count. Usado tanto pela busca manual (dados em memória) quanto
// pelo dashboard (dados vindo do backend).
class FontesAgrupadas {
  final List<Map<String, String>> oficiais;
  final List<Map<String, String>> midias;
  FontesAgrupadas({required this.oficiais, required this.midias});

  static final RegExp _officialPattern = RegExp(
      r'\.gov\.br|\.ssp\.|\.seguranca\.|\.sesp\.|\.sspds\.|\.sejusp\.|\.segup\.',
      caseSensitive: false);

  factory FontesAgrupadas.fromUrls(Iterable<String> urls) {
    final hostOficial = <String, int>{};
    final hostMedia = <String, int>{};
    for (final url in urls) {
      if (url.isEmpty) continue;
      String host;
      try {
        host = Uri.parse(url).host;
      } catch (_) {
        host = url;
      }
      if (_officialPattern.hasMatch(url)) {
        hostOficial[host] = (hostOficial[host] ?? 0) + 1;
      } else {
        hostMedia[host] = (hostMedia[host] ?? 0) + 1;
      }
    }

    List<Map<String, String>> toSortedList(Map<String, int> m) =>
        m.entries
            .map((e) => {'name': e.key, 'count': e.value.toString()})
            .toList()
          ..sort((a, b) => int.parse(b['count']!).compareTo(int.parse(a['count']!)));

    return FontesAgrupadas(
      oficiais: toSortedList(hostOficial),
      midias: toSortedList(hostMedia),
    );
  }
}
