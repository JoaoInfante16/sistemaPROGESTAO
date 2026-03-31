import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/news_item.dart';

class NewsDetailSheet extends StatelessWidget {
  final NewsItem news;

  const NewsDetailSheet({super.key, required this.news});

  static void show(BuildContext context, NewsItem news) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => NewsDetailSheet(news: news),
    );
  }

  @override
  Widget build(BuildContext context) {
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
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Crime type
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  news.tipoCrime.toUpperCase(),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Date
              Row(
                children: [
                  const Icon(Icons.calendar_today, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    DateFormat('dd/MM/yyyy').format(news.dataOcorrencia),
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Location
              Row(
                children: [
                  const Icon(Icons.location_on, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      news.localFormatted,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),

              const Divider(height: 32),

              // Full summary
              Text(
                news.resumoAgregado ?? news.resumo,
                style: Theme.of(context).textTheme.bodyLarge,
              ),

              // Sources
              if (news.sources.isNotEmpty) ...[
                const SizedBox(height: 24),
                Text(
                  'Fontes',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
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
                        child: Row(
                          children: [
                            Icon(
                              isOfficial ? Icons.shield : Icons.open_in_new,
                              size: 14,
                              color: isOfficial ? Colors.green[700] : Colors.blue,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                source.url,
                                style: TextStyle(
                                  color: isOfficial ? Colors.green[700] : Colors.blue,
                                  decoration: TextDecoration.underline,
                                  fontSize: 13,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (isOfficial) ...[
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 4, vertical: 1),
                                decoration: BoxDecoration(
                                  color: Colors.green.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  'GOV',
                                  style: TextStyle(
                                    color: Colors.green[700],
                                    fontSize: 8,
                                    fontWeight: FontWeight.bold,
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
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
