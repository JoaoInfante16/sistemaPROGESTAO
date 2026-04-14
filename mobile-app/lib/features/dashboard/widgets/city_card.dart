import 'package:flutter/material.dart';
import '../../../core/models/city_overview.dart';
import '../../../main.dart';

const crimeLabels = {
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
  'estatistica': 'Estatística',
  'outros': 'Outros',
};


class CityCard extends StatelessWidget {
  final CityOverview city;
  final VoidCallback onTap;

  const CityCard({super.key, required this.city, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      elevation: city.hasUnread ? 3 : 1,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: name + badges
              Row(
                children: [
                  // City/group icon
                  Icon(
                    city.isGroup ? Icons.layers : Icons.location_city,
                    size: 16,
                    color: city.isGroup ? SIMEopsColors.teal : Colors.grey[500],
                  ),
                  const SizedBox(width: 8),
                  // Name
                  Expanded(
                    child: Text(
                      city.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  // Unread badge
                  if (city.hasUnread)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${city.unreadCount} NOVA${city.unreadCount > 1 ? 'S' : ''}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),

              // Stats row
              Row(
                children: [
                  _StatChip(
                    icon: Icons.article_outlined,
                    label: '${city.totalCrimes} ocorrencia${city.totalCrimes != 1 ? 's' : ''}',
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Footer: subtitle + arrow
              Row(
                children: [
                  Icon(Icons.location_on, size: 14, color: Colors.grey[400]),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      city.isGroup
                          ? '${city.cityCount} cidades · ${city.cityNames?.join(', ') ?? ''}'
                          : city.parentState ?? '',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey[500],
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Icon(Icons.chevron_right, size: 18, color: Colors.grey[600]),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _StatChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: SIMEopsColors.teal.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: SIMEopsColors.teal),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: SIMEopsColors.tealLight,
            ),
          ),
        ],
      ),
    );
  }
}

