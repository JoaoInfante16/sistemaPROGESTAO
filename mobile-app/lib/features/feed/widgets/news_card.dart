import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/models/news_item.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/crime_labels.dart';

// Card compartilhado — feed, favoritos e busca manual.
// Hierarquia: trilho de cor à esquerda carrega a CATEGORIA; o título é o
// TIPO granular (Homicídio · Kobrasol) — a informação que o usuário escaneia.
// Badges no orçamento de dois discretos (NOVA, OFICIAL); dado em mono.
class NewsCard extends StatelessWidget {
  final NewsItem news;
  final VoidCallback? onTap;
  final VoidCallback? onMarkRead;
  final VoidCallback? onToggleFavorite;

  const NewsCard({
    super.key,
    required this.news,
    this.onTap,
    this.onMarkRead,
    this.onToggleFavorite,
  });

  static String _formatDate(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateOnly = DateTime(date.year, date.month, date.day);

    if (dateOnly == today) return 'hoje';

    final yesterday = today.subtract(const Duration(days: 1));
    if (dateOnly == yesterday) return 'ontem';

    return DateFormat('dd/MM/yy').format(date);
  }

  // "g1 +2" — nome do primeiro veículo (ou hostname) e quantas fontes a mais.
  String? get _sourcesLabel {
    if (news.sources.isEmpty) return null;
    final first = news.sources.first;
    var name = first.sourceName ?? '';
    if (name.isEmpty) {
      try {
        name = Uri.parse(first.url).host.replaceFirst('www.', '');
      } catch (_) {
        name = 'fonte';
      }
    }
    final extra = news.sources.length - 1;
    return extra > 0 ? '$name +$extra' : name;
  }

  // Local do rodapé: cidade/UF (o bairro já mora no título).
  String get _footerLocal {
    final uf = news.estadoUf;
    return uf != null && uf.isNotEmpty ? '${news.cidade}/$uf' : news.cidade;
  }

  bool get _isIndicador => news.natureza == 'estatistica';

  @override
  Widget build(BuildContext context) {
    final catColor = _isIndicador
        ? categoryColor('institucional')
        : categoryColor(news.categoriaGrupo);
    final tipoLabel = _isIndicador
        ? 'INDICADOR'
        : crimeTypeLabel(news.tipoCrime).toUpperCase();

    return Slidable(
      // Swipe pra direita: salvar/remover
      startActionPane: ActionPane(
        motion: const ScrollMotion(),
        extentRatio: 0.25,
        children: [
          SlidableAction(
            onPressed: (_) => onToggleFavorite?.call(),
            backgroundColor:
                news.isFavorite ? SIMEopsColors.navyLight : SIMEopsColors.bookmark,
            foregroundColor:
                news.isFavorite ? SIMEopsColors.muted : Colors.white,
            icon: news.isFavorite ? Icons.bookmark_remove : Icons.bookmark_add,
            label: news.isFavorite ? 'Remover' : 'Salvar',
          ),
        ],
      ),
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Trilho de categoria
                Container(width: 4, color: catColor),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header: tipo · bairro + badges
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text.rich(
                                TextSpan(
                                  children: [
                                    TextSpan(
                                      text: tipoLabel,
                                      style: GoogleFonts.rajdhani(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: 1,
                                        color: SIMEopsColors.white,
                                      ),
                                    ),
                                    if (news.bairro != null &&
                                        news.bairro!.isNotEmpty)
                                      TextSpan(
                                        text: ' · ${news.bairro}',
                                        style: GoogleFonts.exo2(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w500,
                                          color: SIMEopsColors.muted,
                                        ),
                                      ),
                                  ],
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (news.isUnread) ...[
                              const SizedBox(width: 6),
                              const _Tag('NOVA', SIMEopsColors.alert),
                            ],
                            if (news.hasOfficialSource) ...[
                              const SizedBox(width: 6),
                              const _Tag('OFICIAL', SIMEopsColors.official),
                            ],
                            if (news.isFavorite) ...[
                              const SizedBox(width: 6),
                              const Icon(Icons.bookmark,
                                  color: SIMEopsColors.bookmark, size: 14),
                            ],
                          ],
                        ),
                        const SizedBox(height: 8),

                        // Resumo
                        Text(
                          news.resumo,
                          style: GoogleFonts.exo2(
                            fontSize: 13,
                            height: 1.35,
                            color: SIMEopsColors.white.withValues(alpha: 0.85),
                          ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 10),

                        // Footer: local · veículo · data (mono)
                        Row(
                          children: [
                            Icon(Icons.location_on,
                                size: 12,
                                color:
                                    SIMEopsColors.muted.withValues(alpha: 0.6)),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                _footerLocal,
                                style: GoogleFonts.exo2(
                                  fontSize: 11.5,
                                  color: SIMEopsColors.muted,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (_sourcesLabel != null) ...[
                              Text(
                                _sourcesLabel!,
                                style: GoogleFonts.exo2(
                                  fontSize: 11,
                                  color:
                                      SIMEopsColors.muted.withValues(alpha: 0.8),
                                ),
                              ),
                              const SizedBox(width: 10),
                            ],
                            Text(
                              _formatDate(news.dataOcorrencia),
                              style: GoogleFonts.jetBrainsMono(
                                fontSize: 10,
                                color:
                                    SIMEopsColors.muted.withValues(alpha: 0.7),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String text;
  final Color color;

  const _Tag(this.text, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: GoogleFonts.rajdhani(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
        ),
      ),
    );
  }
}
