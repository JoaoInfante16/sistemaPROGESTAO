import '../models/news_item.dart';

// Agrupa notícias por tempo para as listas do feed e da busca.
//
// **A forma segue o volume** — é a mesma tese do `baldeDaJanela` no gráfico:
// estrutura fixa quebra quando o período cresce.
//
//   últimos 7 dias  → uma linha por DIA (HOJE, ONTEM, QUINTA...)
//   o que vem antes → uma linha por SEMANA
//   muitas semanas  → as semanas entram em pastas de MÊS
//
// **Só HOJE nasce aberto** com matérias à mostra. O mês mais recente nasce
// aberto mostrando as **semanas dele**, fechadas: a estrutura se apresenta,
// nada despeja card.
//
// Medido no grupo Grande Florianópolis (11/08), que é o que a tela abre por
// padrão: 93 itens, 4 meses, **16 semanas** — 7 dias + 16 semanas = 23 linhas
// antes de o leitor ver que existe um INDICADORES no fim da página. Com as
// pastas de mês são 11 linhas, e cabe numa tela.
//
// 🚨 **O dia NÃO vira pasta dentro da semana**, e isso foi medido antes de
// decidir: uma semana ocupa **3,1 dias de 7**, e **51% desses dias têm um item
// só**. Pasta com uma coisa dentro custa dois toques e não entrega nada. Mas a
// maior semana tem **17 itens**, e essa precisa de estrutura — então o dia vira
// **divisória impressa entre os cards** (ver `DivisoriaDoDia`): a semana gorda
// ganha o corte, a semana magra não paga nada por ele, e a matéria continua a
// dois toques.

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
/// Público porque **toda** lista de matéria do app tem que usar este, e não
/// só as agrupadas por data. Os três baldes da consulta (região metropolitana,
/// fora do período, indicadores) renderizavam na ordem crua do backend, sem
/// ordenação nenhuma — pego pelo João em 11/08.
int maisRecentePrimeiro(NewsItem a, NewsItem b) {
  final porDia = b.dataOcorrencia.compareTo(a.dataOcorrencia);
  if (porDia != 0) return porDia;

  final ha = a.horaPublicacao;
  final hb = b.horaPublicacao;
  if (ha == null && hb == null) return 0;
  if (ha == null) return 1;
  if (hb == null) return -1;
  return hb.compareTo(ha);
}

/// Um nó da lista: ou tem [items] (dia, semana) ou tem [semanas] (mês).
/// Nunca os dois.
class NewsGroup {
  final String key;
  final String label;
  final bool defaultExpanded;
  final List<NewsItem> items;
  final List<NewsGroup> semanas;

  /// Semana e dia mostram as matérias direto; mês mostra as semanas.
  final bool ehSemana;

  NewsGroup(this.key, this.label, this.defaultExpanded, {this.ehSemana = false})
    : items = [],
      semanas = [];

  NewsGroup.mes(this.key, this.label, this.defaultExpanded, this.semanas)
    : items = const [],
      ehSemana = false;

  /// O que o contador do cabeçalho mostra — no mês, a soma das semanas.
  int get total => semanas.isEmpty
      ? items.length
      : semanas.fold(0, (s, g) => s + g.items.length);
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
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];

const _mesesCurtos = [
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

/// A partir de quantas semanas vale criar pastas de mês.
///
/// Abaixo disso a lista de semanas já cabe na tela, e um mês envolvendo quatro
/// semanas seria **uma pasta com quase tudo dentro** — o mesmo defeito que fez
/// o dia ficar de fora. Uma consulta de 30 dias tem 5 semanas e continua plana.
const _semanasParaVirarMes = 8;

/// `SEG 21` — o rótulo da divisória de dia dentro de uma semana.
String rotuloDoDia(DateTime d) =>
    '${_weekdays[d.weekday - 1].substring(0, 3)} ${d.day.toString().padLeft(2, '0')}';

List<NewsGroup> groupNewsByDate(List<NewsItem> items) {
  final sorted = [...items]..sort(maisRecentePrimeiro);

  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final dayCut = today.subtract(const Duration(days: 6));

  final dias = <String, NewsGroup>{};
  final semanas = <String, NewsGroup>{};
  final ordemDias = <NewsGroup>[];
  final ordemSemanas = <NewsGroup>[];

  for (final n in sorted) {
    final d = DateTime(
      n.dataOcorrencia.year,
      n.dataOcorrencia.month,
      n.dataOcorrencia.day,
    );

    if (!d.isBefore(dayCut)) {
      final key = 'd:$d';
      var g = dias[key];
      if (g == null) {
        final diff = today.difference(d).inDays;
        final label = diff == 0
            ? 'HOJE'
            : diff == 1
            ? 'ONTEM'
            : _weekdays[d.weekday - 1];
        g = NewsGroup(key, label, diff == 0);
        dias[key] = g;
        ordemDias.add(g);
      }
      g.items.add(n);
    } else {
      final monday = d.subtract(Duration(days: d.weekday - 1));
      final key = 'w:$monday';
      var g = semanas[key];
      if (g == null) {
        final sunday = monday.add(const Duration(days: 6));
        final label = monday.month == sunday.month
            ? '${monday.day}–${sunday.day} ${_mesesCurtos[monday.month - 1]}'
            : '${monday.day} ${_mesesCurtos[monday.month - 1]} – ${sunday.day} ${_mesesCurtos[sunday.month - 1]}';
        g = NewsGroup(key, label, false, ehSemana: true);
        semanas[key] = g;
        ordemSemanas.add(g);
      }
      g.items.add(n);
    }
  }

  // Poucas semanas: a lista plana já cabe.
  if (ordemSemanas.length < _semanasParaVirarMes) {
    return [...ordemDias, ...ordemSemanas];
  }

  // A semana entra no mês da **segunda-feira dela**. Semana que cruza a virada
  // do mês fica no mês em que começou — dividir a semana em duas metades para
  // ficar "certo" criaria duas pastas de 2 itens e quebraria a contagem.
  final meses = <String, List<NewsGroup>>{};
  final ordemMeses = <String>[];
  for (final s in ordemSemanas) {
    final monday = DateTime.parse(s.key.substring(2));
    final mk = '${monday.year}-${monday.month.toString().padLeft(2, '0')}';
    if (!meses.containsKey(mk)) {
      meses[mk] = [];
      ordemMeses.add(mk);
    }
    meses[mk]!.add(s);
  }

  final pastas = <NewsGroup>[];
  for (var i = 0; i < ordemMeses.length; i++) {
    final mk = ordemMeses[i];
    final mes = int.parse(mk.split('-')[1]);
    pastas.add(
      // O mais recente (i == 0, porque a ordem vem do sort decrescente) nasce
      // aberto: mostra as semanas dele, todas fechadas.
      NewsGroup.mes('m:$mk', _months[mes - 1], i == 0, meses[mk]!),
    );
  }

  return [...ordemDias, ...pastas];
}
