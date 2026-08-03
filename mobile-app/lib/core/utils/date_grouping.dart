import '../models/news_item.dart';

// Agrupa notícias por tempo para as listas do feed e da busca:
// últimos 7 dias viram grupos por DIA (HOJE, ONTEM, SEXTA...), o resto vira
// grupos por SEMANA ("21–27 JUL"). Grupos semanais nascem recolhidos —
// uma busca de 60–180 dias precisa de geografia temporal, não de parede
// de cards.

class NewsGroup {
  final String key;
  final String label;
  final bool defaultExpanded;
  final List<NewsItem> items;

  NewsGroup(this.key, this.label, this.defaultExpanded) : items = [];
}

const _weekdays = [
  'SEGUNDA',
  'TERÇA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SÁBADO',
  'DOMINGO',
];

const _months = [
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
];

List<NewsGroup> groupNewsByDate(List<NewsItem> items) {
  final sorted = [...items]
    ..sort((a, b) => b.dataOcorrencia.compareTo(a.dataOcorrencia));

  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final dayCut = today.subtract(const Duration(days: 6));

  final byKey = <String, NewsGroup>{};
  final result = <NewsGroup>[];

  for (final n in sorted) {
    final d = DateTime(
      n.dataOcorrencia.year,
      n.dataOcorrencia.month,
      n.dataOcorrencia.day,
    );

    String key;
    String label;
    bool expanded;

    if (!d.isBefore(dayCut)) {
      key = 'd:$d';
      final diff = today.difference(d).inDays;
      label = diff == 0
          ? 'HOJE'
          : diff == 1
              ? 'ONTEM'
              : _weekdays[d.weekday - 1];
      expanded = true;
    } else {
      final monday = d.subtract(Duration(days: d.weekday - 1));
      final sunday = monday.add(const Duration(days: 6));
      key = 'w:$monday';
      label = monday.month == sunday.month
          ? '${monday.day}–${sunday.day} ${_months[monday.month - 1]}'
          : '${monday.day} ${_months[monday.month - 1]} – ${sunday.day} ${_months[sunday.month - 1]}';
      expanded = false;
    }

    var group = byKey[key];
    if (group == null) {
      group = NewsGroup(key, label, expanded);
      byKey[key] = group;
      result.add(group);
    }
    group.items.add(n);
  }

  return result;
}
