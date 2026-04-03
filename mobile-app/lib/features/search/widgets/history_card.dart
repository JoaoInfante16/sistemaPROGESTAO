import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class HistoryCard extends StatelessWidget {
  final Map<String, dynamic> search;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;

  const HistoryCard({super.key, required this.search, required this.onTap, this.onLongPress});

  @override
  Widget build(BuildContext context) {
    final params = search['params'] as Map<String, dynamic>? ?? {};
    final status = search['status'] as String? ?? 'processing';
    final totalResults = search['total_results'] as int?;
    final createdAt = search['created_at'] as String? ?? '';

    final estado = params['estado'] as String? ?? '';
    final cidades = (params['cidades'] as List<dynamic>?)
            ?.map((c) => c.toString())
            .toList() ??
        [];
    final tipoCrime = params['tipo_crime'] as String?;

    DateTime? date;
    try {
      date = DateTime.parse(createdAt);
    } catch (e) { debugPrint('[HistoryCard] Date parse error: $e'); }

    final statusColor = switch (status) {
      'completed' => Colors.green,
      'failed' => Colors.red,
      _ => Colors.blue,
    };
    final statusLabel = switch (status) {
      'completed' => 'Concluida',
      'failed' => 'Falhou',
      _ => 'Em andamento',
    };
    final statusIcon = switch (status) {
      'completed' => Icons.check_circle,
      'failed' => Icons.error,
      _ => Icons.hourglass_top,
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: status chip + date
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(statusIcon, size: 14, color: statusColor),
                        const SizedBox(width: 4),
                        Text(
                          statusLabel,
                          style: TextStyle(
                            color: statusColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (totalResults != null && status == 'completed') ...[
                    const SizedBox(width: 8),
                    Text(
                      '$totalResults resultado${totalResults != 1 ? 's' : ''}',
                      style: TextStyle(color: Colors.grey[500], fontSize: 12),
                    ),
                  ],
                  const Spacer(),
                  if (date != null)
                    Text(
                      DateFormat('dd/MM/yyyy HH:mm').format(date),
                      style: TextStyle(color: Colors.grey[500], fontSize: 12),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              // Estado
              Row(
                children: [
                  Icon(Icons.location_on, size: 16, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      estado,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              // Cidades
              if (cidades.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  cidades.join(', '),
                  style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              // Tipo crime
              if (tipoCrime != null) ...[
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.blueGrey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    tipoCrime,
                    style: const TextStyle(
                      color: Colors.blueGrey,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
