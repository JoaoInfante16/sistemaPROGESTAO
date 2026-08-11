import '../utils/datas.dart';

class CityOverview {
  final String id;
  final String name;
  final String type; // 'city' or 'group'
  final String? parentState;
  final int? cityCount;
  final int? stateCount;
  final List<String>? cityNames;
  final int totalCrimes;
  final int totalCrimes30d;

  /// Quebra por categoria nos 30 dias — é o que o card mostra como
  /// "25 SEGUR. / 44 PATRIM. / ...". Categoria sem ocorrência não vem.
  /// Vazio em backend anterior a 08/08: o card esconde a linha inteira em vez
  /// de desenhar quatro zeros.
  final Map<String, int> categorias30d;

  final double trendPercent;
  final String? topCrimeType;
  final double topCrimePercent;
  final int unreadCount;

  /// Só em grupo: quantas não-lidas cada cidade-filha tem. Alimenta o número
  /// ao lado do nome na fila de abas — sem ele a fila `TODAS · FLORIANÓPOLIS ·
  /// PALHOÇA` fica muda e obriga a tocar uma por uma pra achar a notícia nova.
  ///
  /// Cidade com zero não vem do backend. Vazio também em backend anterior a
  /// 09/08 — aí as abas voltam a ser só nomes, que é o comportamento antigo.
  final Map<String, int> naoLidasPorCidade;

  final DateTime? lastNewsAt;

  /// Ocorrência mais antiga desta cidade — até onde este monitoramento
  /// consegue olhar pra trás. Null em backend anterior a 10/08.
  ///
  /// Serve pra decidir quais janelas do relatório vale oferecer: com três
  /// meses de varredura, `1A` devolve exatamente o mesmo que `TUDO`.
  final DateTime? primeiraOcorrencia;

  CityOverview({
    required this.id,
    required this.name,
    required this.type,
    this.parentState,
    this.cityCount,
    this.stateCount,
    this.cityNames,
    required this.totalCrimes,
    required this.totalCrimes30d,
    this.categorias30d = const {},
    required this.trendPercent,
    this.topCrimeType,
    required this.topCrimePercent,
    required this.unreadCount,
    this.naoLidasPorCidade = const {},
    this.lastNewsAt,
    this.primeiraOcorrencia,
  });

  bool get isGroup => type == 'group';
  bool get hasUnread => unreadCount > 0;
  bool get trendUp => trendPercent > 0;
  bool get trendDown => trendPercent < 0;

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  static int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  factory CityOverview.fromJson(Map<String, dynamic> json) {
    return CityOverview(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String? ?? 'city',
      parentState: json['parentState'] as String?,
      cityCount: json['cityCount'] != null ? _toInt(json['cityCount']) : null,
      stateCount: json['stateCount'] != null ? _toInt(json['stateCount']) : null,
      cityNames: (json['cityNames'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      totalCrimes: _toInt(json['totalCrimes']),
      totalCrimes30d: _toInt(json['totalCrimes30d']),
      categorias30d: {
        for (final e in (json['categorias30d'] as Map<String, dynamic>? ?? {}).entries)
          e.key: _toInt(e.value),
      },
      trendPercent: _toDouble(json['trendPercent']),
      topCrimeType: json['topCrimeType'] as String?,
      topCrimePercent: _toDouble(json['topCrimePercent']),
      unreadCount: _toInt(json['unreadCount']),
      naoLidasPorCidade: {
        for (final e
            in (json['naoLidasPorCidade'] as Map<String, dynamic>? ?? {}).entries)
          e.key: _toInt(e.value),
      },
      // Vem de `news.created_at`, que o Postgres serializa sem fuso — sem o
      // parseApiDate, "há 2 horas" virava "há 5 horas".
      lastNewsAt: parseApiDate(json['lastNewsAt']?.toString()),
      primeiraOcorrencia:
          parseApiDate(json['primeiraOcorrencia']?.toString()),
    );
  }
}
