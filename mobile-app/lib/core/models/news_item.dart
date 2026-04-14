import '../utils/type_helpers.dart';

class NewsSource {
  final String url;
  final String? sourceName;

  NewsSource({required this.url, this.sourceName});

  factory NewsSource.fromJson(Map<String, dynamic> json) {
    return NewsSource(
      url: json['url'] as String,
      sourceName: json['source_name'] as String?,
    );
  }
}

class NewsItem {
  final String id;
  final String tipoCrime;
  final String natureza; // 'ocorrencia' ou 'estatistica'
  final String cidade;
  final String? bairro;
  final String? rua;
  final DateTime dataOcorrencia;
  final String resumo;
  final String? resumoAgregado;
  final double? confianca;
  final DateTime createdAt;
  final List<NewsSource> sources;
  final bool hasOfficialSource;
  final String? estadoUf;
  bool isUnread;
  bool isFavorite;

  NewsItem({
    required this.id,
    required this.tipoCrime,
    this.natureza = 'ocorrencia',
    required this.cidade,
    this.bairro,
    this.rua,
    required this.dataOcorrencia,
    required this.resumo,
    this.resumoAgregado,
    this.confianca,
    required this.createdAt,
    this.sources = const [],
    this.hasOfficialSource = false,
    this.estadoUf,
    this.isUnread = true,
    this.isFavorite = false,
  });

  factory NewsItem.fromJson(Map<String, dynamic> json) {
    return NewsItem(
      id: json['id'] as String,
      tipoCrime: json['tipo_crime'] as String,
      natureza: json['natureza'] as String? ?? 'ocorrencia',
      cidade: json['cidade'] as String,
      bairro: json['bairro'] as String?,
      rua: json['rua'] as String?,
      dataOcorrencia: DateTime.parse(json['data_ocorrencia'] as String),
      resumo: json['resumo'] as String,
      resumoAgregado: json['resumo_agregado'] as String?,
      confianca: safeDoubleOrNull(json['confianca']),
      createdAt: DateTime.parse(json['created_at'] as String),
      sources: (json['news_sources'] as List<dynamic>?)
              ?.map((s) => NewsSource.fromJson(s as Map<String, dynamic>))
              .toList() ??
          [],
      hasOfficialSource: json['has_official_source'] as bool? ?? false,
      estadoUf: json['estado_uf'] as String?,
      isUnread: json['is_unread'] as bool? ?? true,
      isFavorite: json['is_favorite'] as bool? ?? false,
    );
  }

  /// Converte resultado de busca manual (Map) pra NewsItem.
  factory NewsItem.fromSearchResult(Map<String, dynamic> json) {
    final sourceUrl = json['source_url'] as String? ?? '';
    final sources = <NewsSource>[];
    // sources pode ser uma lista de maps OU so source_url
    final sourcesList = json['sources'] as List<dynamic>?;
    if (sourcesList != null) {
      for (final s in sourcesList) {
        if (s is Map<String, dynamic>) {
          sources.add(NewsSource(
            url: s['url'] as String? ?? '',
            sourceName: s['source_name'] as String?,
          ));
        } else if (s is String) {
          sources.add(NewsSource(url: s));
        }
      }
    } else if (sourceUrl.isNotEmpty) {
      sources.add(NewsSource(url: sourceUrl));
    }

    return NewsItem(
      id: json['id'] as String? ?? 'search-${json.hashCode}',
      tipoCrime: json['tipo_crime'] as String? ?? 'outros',
      natureza: json['natureza'] as String? ?? 'ocorrencia',
      cidade: json['cidade'] as String? ?? '',
      bairro: json['bairro'] as String?,
      rua: json['rua'] as String?,
      dataOcorrencia: DateTime.tryParse(json['data_ocorrencia'] as String? ?? '') ?? DateTime.now(),
      resumo: json['resumo'] as String? ?? '',
      confianca: safeDoubleOrNull(json['confianca']),
      createdAt: DateTime.now(),
      sources: sources,
      isUnread: false,
      isFavorite: false,
    );
  }

  String get localFormatted {
    final parts = [cidade];
    if (bairro != null) parts.add(bairro!);
    if (rua != null) parts.add(rua!);
    return parts.join(' - ');
  }
}
