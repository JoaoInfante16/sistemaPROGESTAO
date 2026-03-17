import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:intl/intl.dart';
import '../../../core/models/news_item.dart';

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

  @override
  Widget build(BuildContext context) {
    return Slidable(
      // Swipe left: mark as read
      endActionPane: ActionPane(
        motion: const ScrollMotion(),
        extentRatio: 0.25,
        children: [
          SlidableAction(
            onPressed: (_) => onMarkRead?.call(),
            backgroundColor: Colors.grey,
            foregroundColor: Colors.white,
            icon: Icons.check,
            label: 'Lida',
          ),
        ],
      ),
      // Swipe right: favorite
      startActionPane: ActionPane(
        motion: const ScrollMotion(),
        extentRatio: 0.25,
        children: [
          SlidableAction(
            onPressed: (_) => onToggleFavorite?.call(),
            backgroundColor: news.isFavorite ? Colors.grey : Colors.amber,
            foregroundColor: Colors.white,
            icon: news.isFavorite ? Icons.favorite : Icons.favorite_border,
            label: news.isFavorite ? 'Remover' : 'Favoritar',
          ),
        ],
      ),
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        elevation: news.isUnread ? 3 : 1,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: crime type + unread/favorite badges + date
                Row(
                  children: [
                    _CrimeBadge(tipoCrime: news.tipoCrime),
                    if (news.isUnread) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'NOVA',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                    if (news.isFavorite) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.favorite, color: Colors.amber, size: 14),
                    ],
                    if (news.hasOfficialSource) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.shield, size: 10, color: Colors.green[700]),
                            const SizedBox(width: 3),
                            Text(
                              'OFICIAL',
                              style: TextStyle(
                                color: Colors.green[700],
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (news.estadoUf != null) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.grey.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          news.estadoUf!,
                          style: TextStyle(
                            color: Colors.grey[700],
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                    const Spacer(),
                    Text(
                      DateFormat('dd/MM/yyyy').format(news.dataOcorrencia),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey[500],
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Resumo
                Text(
                  news.resumoAgregado ?? news.resumo,
                  style: Theme.of(context).textTheme.bodyMedium,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 10),

                // Footer: location + sources count
                Row(
                  children: [
                    Icon(Icons.location_on, size: 14, color: Colors.grey[400]),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        news.localFormatted,
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.grey[600],
                                ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (news.sources.isNotEmpty) ...[
                      Icon(Icons.link, size: 14, color: Colors.grey[400]),
                      const SizedBox(width: 4),
                      Text(
                        '${news.sources.length} fonte${news.sources.length > 1 ? 's' : ''}',
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.grey[500],
                                ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CrimeBadge extends StatelessWidget {
  final String tipoCrime;

  const _CrimeBadge({required this.tipoCrime});

  Color get _color {
    switch (tipoCrime.toLowerCase()) {
      case 'homicidio':
        return Colors.red;
      case 'roubo':
        return Colors.orange;
      case 'furto':
        return Colors.amber;
      case 'trafico':
        return Colors.purple;
      case 'assalto':
        return Colors.deepOrange;
      case 'sequestro':
        return Colors.red[900]!;
      default:
        return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        tipoCrime.toUpperCase(),
        style: TextStyle(
          color: _color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
