import '../models/news_item.dart';

// Agrupa notícias por tempo para as listas do feed e da busca:
// últimos 7 dias viram grupos por DIA (HOJE, ONTEM, SEXTA...), o resto vira
// grupos por SEMANA ("21–27 JUL").
//
// **Só HOJE nasce aberto.** Todo o resto — dias e semanas — nasce recolhido.
//
// Antes os sete dias vinham abertos, e numa consulta de Salvador isso são
// dezenas de cards antes de a pessoa ver que existem outras coisas na página:
// os INDICADORES no fim e o balde REGIÃO METROPOLITANA. Uma tela que abre com
// parede de cards esconde a própria estrutura — o leitor rola achando que a
// lista é tudo, e desiste antes do fim.
//
// Recolhido, cada dia vira uma linha com o número ao lado, e a página inteira
// cabe numa tela: dá pra ver a forma da coisa (onde teve volume, o que existe
// além da lista) e só então abrir o que interessa. É a mesma lógica da
// `QuietCityRow` no monitoramento — dia quieto colapsa, dia cheio expande.
//
// Aberto por quem lê **fica aberto**: o estado de toggle mora na tela e
// sobrevive à recarga (ver `_toggledGroups` / `_toggledSections`).

/// Mais recente primeiro — **de verdade, inclusive dentro do dia**.
///
/// 🚨 Era só `b.dataOcorrencia.compareTo(a.dataOcorrencia)`, e essa coluna é
/// `DATE` no Postgres: todo item do mesmo dia volta à meia-noite e **empata**.
/// Empate somado a `List.sort`, que no Dart não é estável, dava ordem
/// arbitrária dentro do grupo — os 21 itens de "HOJE" de uma consulta de
/// Salvador saíam sorteados, e a lista parecia não ter ordem nenhuma.
///
/// A `hora_publicacao` (migration 030) é o desempate. Comparada como texto de
/// propósito: `HH:MM` com zero à esquerda ordena igual como string e como
/// número, sem custo de parse por comparação.
///
/// Sem hora vai para o **fim do dia**: 13 dos 101 itens daquela consulta não
/// têm, e chutar que são as mais recentes é inventar informação.
int _maisRecentePrimeiro(NewsItem a, NewsItem b) {
  final porDia = b.dataOcorrencia.compareTo(a.dataOcorrencia);
  if (porDia != 0) return porDia;

  final ha = a.horaPublicacao;
  final hb = b.horaPublicacao;
  if (ha == null && hb == null) return 0;
  if (ha == null) return 1;
  if (hb == null) return -1;
  return hb.compareTo(ha);
}

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
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

List<NewsGroup> groupNewsByDate(List<NewsItem> items) {
  final sorted = [...items]..sort(_maisRecentePrimeiro);

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
      expanded = diff == 0;
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
