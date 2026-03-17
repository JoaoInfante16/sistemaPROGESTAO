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
      cidade: json['cidade'] as String,
      bairro: json['bairro'] as String?,
      rua: json['rua'] as String?,
      dataOcorrencia: DateTime.parse(json['data_ocorrencia'] as String),
      resumo: json['resumo'] as String,
      resumoAgregado: json['resumo_agregado'] as String?,
      confianca: (json['confianca'] as num?)?.toDouble(),
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

  String get localFormatted {
    final parts = [cidade];
    if (bairro != null) parts.add(bairro!);
    if (rua != null) parts.add(rua!);
    return parts.join(' - ');
  }
}
