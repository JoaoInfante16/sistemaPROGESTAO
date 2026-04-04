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

  static String _formatDate(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateOnly = DateTime(date.year, date.month, date.day);

    if (dateOnly == today) return 'Hoje';

    final yesterday = today.subtract(const Duration(days: 1));
    if (dateOnly == yesterday) return 'Ontem';

    return DateFormat('dd/MM/yyyy').format(date);
  }

  @override
  Widget build(BuildContext context) {
    return Slidable(
      // Swipe pra direita: salvar/remover
      startActionPane: ActionPane(
        motion: const ScrollMotion(),
        extentRatio: 0.25,
        children: [
          SlidableAction(
            onPressed: (_) => onToggleFavorite?.call(),
            backgroundColor: news.isFavorite ? Colors.grey : Colors.indigo,
            foregroundColor: Colors.white,
            icon: news.isFavorite ? Icons.bookmark_remove : Icons.bookmark_add,
            label: news.isFavorite ? 'Remover' : 'Salvar',
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
                // Header: crime type + badges + date
                Row(
                  children: [
                    Flexible(
                      child: _CrimeBadge(tipoCrime: news.tipoCrime),
                    ),
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
                      const Icon(Icons.bookmark, color: Colors.indigo, size: 16),
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
                    const SizedBox(width: 8),
                    Text(
                      _formatDate(news.dataOcorrencia),
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

  static const _categoriaGrupo = {
    'roubo_furto': 'patrimonial',
    'vandalismo': 'patrimonial',
    'invasao': 'patrimonial',
    'homicidio': 'seguranca',
    'latrocinio': 'seguranca',
    'lesao_corporal': 'seguranca',
    'trafico': 'operacional',
    'operacao_policial': 'operacional',
    'manifestacao': 'operacional',
    'bloqueio_via': 'operacional',
    'estelionato': 'fraude',
    'receptacao': 'fraude',
    'crime_ambiental': 'institucional',
    'trabalho_irregular': 'institucional',
    'outros': 'institucional',
  };

  static const _grupoCores = {
    'patrimonial': Colors.orange,
    'seguranca': Colors.red,
    'operacional': Colors.blue,
    'fraude': Colors.purple,
    'institucional': Colors.blueGrey,
  };

  static const _labels = {
    'roubo_furto': 'Roubo/Furto',
    'vandalismo': 'Vandalismo',
    'invasao': 'Invasão',
    'homicidio': 'Homicídio',
    'latrocinio': 'Latrocínio',
    'lesao_corporal': 'Lesão Corporal',
    'trafico': 'Tráfico',
    'operacao_policial': 'Op. Policial',
    'manifestacao': 'Manifestação',
    'bloqueio_via': 'Bloqueio Via',
    'estelionato': 'Estelionato',
    'receptacao': 'Receptação',
    'crime_ambiental': 'Crime Ambiental',
    'trabalho_irregular': 'Trab. Irregular',
    'outros': 'Outros',
  };

  Color get _color {
    final key = tipoCrime.toLowerCase().replaceAll(' ', '_');
    final grupo = _categoriaGrupo[key];
    return _grupoCores[grupo] ?? Colors.blueGrey;
  }

  String get _label {
    final key = tipoCrime.toLowerCase().replaceAll(' ', '_');
    return _labels[key] ?? tipoCrime;
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
        _label.toUpperCase(),
        style: TextStyle(
          color: _color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}
