import '../utils/datas.dart';
import '../utils/state_utils.dart';
import '../utils/type_helpers.dart';

class NewsSource {
  final String url;
  final String? sourceName;
  final String? type; // 'news' | 'web' (busca manual)

  NewsSource({required this.url, this.sourceName, this.type});

  factory NewsSource.fromJson(Map<String, dynamic> json) {
    return NewsSource(
      url: json['url'] as String,
      sourceName: json['source_name'] as String?,
      type: json['type'] as String?,
    );
  }
}

class NewsItem {
  final String id;
  final String tipoCrime;
  final String? categoriaGrupo; // 'patrimonial' | 'seguranca' | 'operacional' | 'fraude' | 'institucional'
  final String natureza; // 'ocorrencia' ou 'estatistica'
  final String cidade;
  final String? bairro;
  final String? rua;
  final DateTime dataOcorrencia;
  final String resumo;
  final double? confianca;
  final DateTime createdAt;
  final List<NewsSource> sources;
  final bool hasOfficialSource;
  final String? estadoUf;
  final String? sourceType; // 'news' | 'web' — só na busca manual
  bool isUnread;
  bool isFavorite;

  NewsItem({
    required this.id,
    required this.tipoCrime,
    this.categoriaGrupo,
    this.natureza = 'ocorrencia',
    required this.cidade,
    this.bairro,
    this.rua,
    required this.dataOcorrencia,
    required this.resumo,
    this.confianca,
    required this.createdAt,
    this.sources = const [],
    this.hasOfficialSource = false,
    this.estadoUf,
    this.sourceType,
    this.isUnread = true,
    this.isFavorite = false,
  });

  factory NewsItem.fromJson(Map<String, dynamic> json) {
    return NewsItem(
      id: json['id'] as String,
      tipoCrime: json['tipo_crime'] as String,
      categoriaGrupo: json['categoria_grupo'] as String?,
      natureza: json['natureza'] as String? ?? 'ocorrencia',
      cidade: json['cidade'] as String,
      bairro: json['bairro'] as String?,
      rua: json['rua'] as String?,
      dataOcorrencia: DateTime.parse(json['data_ocorrencia'] as String),
      resumo: json['resumo'] as String,
      confianca: safeDoubleOrNull(json['confianca']),
      // `created_at` do Postgres vem sem sufixo de fuso — ver parseApiDate.
      // `data_ocorrencia` é só data (YYYY-MM-DD) e não tem esse problema.
      createdAt: parseApiDate(json['created_at'] as String?) ?? DateTime.now(),
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
            type: s['type'] as String?,
          ));
        } else if (s is String) {
          sources.add(NewsSource(url: s));
        }
      }
    } else if (sourceUrl.isNotEmpty) {
      sources.add(NewsSource(url: sourceUrl));
    }

    // Busca manual manda `estado` por extenso ("Bahia") — vira UF pro card.
    final estado = json['estado'] as String?;

    return NewsItem(
      id: json['id'] as String? ?? 'search-${json.hashCode}',
      tipoCrime: json['tipo_crime'] as String? ?? 'outros',
      categoriaGrupo: json['categoria_grupo'] as String?,
      natureza: json['natureza'] as String? ?? 'ocorrencia',
      cidade: json['cidade'] as String? ?? '',
      bairro: json['bairro'] as String?,
      rua: json['rua'] as String?,
      dataOcorrencia: DateTime.tryParse(json['data_ocorrencia'] as String? ?? '') ?? DateTime.now(),
      resumo: json['resumo'] as String? ?? '',
      confianca: safeDoubleOrNull(json['confianca']),
      createdAt: DateTime.now(),
      sources: sources,
      estadoUf: estado != null && estado.isNotEmpty ? abbrState(estado) : null,
      sourceType: json['source_type'] as String?,
      isUnread: false,
      isFavorite: false,
    );
  }

  /// Local formatado: "São José/SC - Kobrasol - Rua X"
  /// (UF junto da cidade quando disponivel; bairro e rua separados por " - ")
  String get localFormatted {
    final primeiro = estadoUf != null && estadoUf!.isNotEmpty
        ? '$cidade/$estadoUf'
        : cidade;
    final parts = [primeiro];
    if (bairro != null) parts.add(bairro!);
    if (rua != null) parts.add(rua!);
    return parts.join(' - ');
  }
}
