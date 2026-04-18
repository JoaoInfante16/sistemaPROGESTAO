// Espelho do `ExecutiveData` do backend. Resumo executivo do período —
// cards visuais (indicadores) + parágrafo complementar + fontes consolidadas.

class ExecutiveIndicator {
  final double valor;
  final String? unidade; // '%' ou null
  final String tipo; // 'percentual' | 'absoluto' | 'monetario'
  final String sentido; // 'positivo' | 'negativo' | 'neutro'
  final String label;
  final String contexto;
  final String fonte;

  ExecutiveIndicator({
    required this.valor,
    required this.unidade,
    required this.tipo,
    required this.sentido,
    required this.label,
    required this.contexto,
    required this.fonte,
  });

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  factory ExecutiveIndicator.fromJson(Map<String, dynamic> json) {
    return ExecutiveIndicator(
      valor: _toDouble(json['valor']),
      unidade: json['unidade'] as String?,
      tipo: json['tipo'] as String? ?? 'absoluto',
      sentido: json['sentido'] as String? ?? 'neutro',
      label: json['label'] as String? ?? '',
      contexto: json['contexto'] as String? ?? '',
      fonte: json['fonte'] as String? ?? '',
    );
  }
}

class ExecutiveData {
  final List<ExecutiveIndicator> indicadores;
  final String? resumoComplementar;
  final List<String> fontes;

  ExecutiveData({
    required this.indicadores,
    required this.resumoComplementar,
    required this.fontes,
  });

  bool get isEmpty =>
      indicadores.isEmpty &&
      (resumoComplementar == null || resumoComplementar!.trim().isEmpty);

  factory ExecutiveData.empty() =>
      ExecutiveData(indicadores: [], resumoComplementar: null, fontes: []);

  factory ExecutiveData.fromJson(Map<String, dynamic> json) {
    return ExecutiveData(
      indicadores: (json['indicadores'] as List<dynamic>?)
              ?.map((e) => ExecutiveIndicator.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      resumoComplementar: json['resumo_complementar'] as String?,
      fontes: (json['fontes'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }
}
