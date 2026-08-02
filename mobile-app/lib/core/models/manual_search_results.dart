/// Os três baldes do GET /manual-search/:id/results.
///
/// `results` é o balde principal — a lista que o APK do cliente já renderiza.
/// Os extras (região metropolitana e fora do período) viajam SEPARADOS e nunca
/// podem ser concatenados em `results`: o APK antigo passaria a exibi-los e
/// contá-los nas estatísticas sem ninguém perceber (API_CONTRATO.md, "Regra
/// que não pode ser quebrada").
class ManualSearchResults {
  final List<Map<String, dynamic>> results;
  final List<Map<String, dynamic>> regiao;
  final List<Map<String, dynamic>> foraDoPeriodo;

  const ManualSearchResults({
    this.results = const [],
    this.regiao = const [],
    this.foraDoPeriodo = const [],
  });

  factory ManualSearchResults.fromJson(Map<String, dynamic> body) {
    List<Map<String, dynamic>> list(dynamic v) =>
        (v as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
    final extras = body['extras'] as Map<String, dynamic>? ?? const {};
    return ManualSearchResults(
      results: list(body['results']),
      regiao: list(extras['regiao']),
      foraDoPeriodo: list(extras['fora_do_periodo']),
    );
  }
}
