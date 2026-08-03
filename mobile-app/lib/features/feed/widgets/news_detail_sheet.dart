import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/news_item.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/crime_labels.dart';

class NewsDetailSheet extends StatelessWidget {
  final NewsItem news;

  const NewsDetailSheet({super.key, required this.news});

  static void show(BuildContext context, NewsItem news) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: SIMEopsColors.navyMid,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => NewsDetailSheet(news: news),
    );
  }

  // Nome exibível de uma fonte: source_name ou hostname sem www.
  static String _sourceLabel(NewsSource source) {
    final name = source.sourceName ?? '';
    if (name.isNotEmpty) return name;
    try {
      return Uri.parse(source.url).host.replaceFirst('www.', '');
    } catch (_) {
      return source.url;
    }
  }

  @override
  Widget build(BuildContext context) {
    final catColor = categoryColor(news.categoriaGrupo);

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (_, controller) {
        return SingleChildScrollView(
          controller: controller,
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: SIMEopsColors.muted.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Tipo de crime — cor da categoria
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: catColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  crimeTypeLabel(news.tipoCrime).toUpperCase(),
                  style: GoogleFonts.rajdhani(
                    color: catColor,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Data
              Row(
                children: [
                  Icon(Icons.calendar_today,
                      size: 14, color: SIMEopsColors.muted),
                  const SizedBox(width: 8),
                  Text(
                    DateFormat('dd/MM/yyyy').format(news.dataOcorrencia),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 13,
                      color: SIMEopsColors.white,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Local
              Row(
                children: [
                  Icon(Icons.location_on,
                      size: 14, color: SIMEopsColors.muted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      news.localFormatted,
                      style: GoogleFonts.exo2(
                        fontSize: 13.5,
                        color: SIMEopsColors.white,
                      ),
                    ),
                  ),
                ],
              ),

              Divider(
                height: 32,
                color: SIMEopsColors.teal.withValues(alpha: 0.15),
              ),

              // Resumo completo
              Text(
                news.resumo,
                style: GoogleFonts.exo2(
                  fontSize: 15,
                  height: 1.45,
                  color: SIMEopsColors.white,
                ),
              ),

              // Fontes
              if (news.sources.isNotEmpty) ...[
                const SizedBox(height: 24),
                Row(
                  children: [
                    Text(
                      'FONTES',
                      style: GoogleFonts.rajdhani(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 2,
                        color: SIMEopsColors.muted,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        height: 1,
                        color: SIMEopsColors.teal.withValues(alpha: 0.15),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ...news.sources.map(
                  (source) {
                    final isOfficial = RegExp(
                      r'\.gov\.br|\.ssp\.|\.seguranca\.|\.sesp\.|\.sspds\.|\.sejusp\.|\.segup\.',
                      caseSensitive: false,
                    ).hasMatch(source.url);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: InkWell(
                        onTap: () => _openUrl(source.url),
                        borderRadius: BorderRadius.circular(6),
                        child: Row(
                          children: [
                            Icon(
                              isOfficial ? Icons.shield : Icons.open_in_new,
                              size: 14,
                              color: isOfficial
                                  ? SIMEopsColors.official
                                  : SIMEopsColors.tealLight,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _sourceLabel(source),
                                style: GoogleFonts.exo2(
                                  color: isOfficial
                                      ? SIMEopsColors.official
                                      : SIMEopsColors.tealLight,
                                  fontSize: 13.5,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (isOfficial) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(
                                  color: SIMEopsColors.official
                                      .withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  'GOV',
                                  style: GoogleFonts.rajdhani(
                                    color: SIMEopsColors.official,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],

              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }

  Future<void> _openUrl(String url) async {
    try {
      final uri = Uri.parse(url);
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('[URL] Failed to open: $url — $e');
    }
  }
}
