import 'package:flutter/material.dart';

// Cores e labels por categoria_grupo. Fonte única pra card de notícia, mapa,
// filtros, gráficos — qualquer lugar que precise colorir/rotular categoria.
// Mapeamento tipo_crime → categoria vive no backend (TIPO_CRIME_GRUPO em types.ts).

// ⚠️ Isto NÃO é a fonte da cor de categoria — é o **fallback**.
//
// A fonte é o backend (`CATEGORIA_CORES` em `utils/taxonomia.ts`, servido em
// GET /settings/taxonomia). Estes valores só valem quando a taxonomia não
// carregou, e existem porque o app precisa pintar alguma coisa sem rede.
//
// Duas cópias da mesma tabela foi exatamente o que quebrou: até 08/08 o Dart
// era a fonte, o backend dizia "espelham category_colors.dart", e no dia em que
// esta lista mudou o espelho não mudou junto — Fraude ficou violeta Tailwind na
// tela de busca e violeta validado no feed, no mesmo APK. Se um hex mudar aqui,
// tem que mudar lá; e o lugar certo de mudar primeiro é lá.
//
// Hexes validados sobre o navy #060D18 (ver o comentário longo no taxonomia.ts):
//   ΔE deuteranopia 8.0 · ΔE visão normal 19.3 · croma ≥0.10 · contraste ≥3:1
const categoryColors = <String, Color>{
  'seguranca': Color(0xFFDA4358),
  'patrimonial': Color(0xFFB39026),
  'operacional': Color(0xFF1F98AB),
  'fraude': Color(0xFF8F62CB),
  'institucional': Color(0xFF4E8F45),
};

const categoryLabels = <String, String>{
  'patrimonial': 'Patrimonial',
  'seguranca': 'Segurança',
  'operacional': 'Operacional',
  'fraude': 'Fraude',
  'institucional': 'Institucional',
};

const categoryOrder = <String>[
  'seguranca',
  'patrimonial',
  'operacional',
  'fraude',
  'institucional',
];

/// Cores que vieram da taxonomia do backend. Vazio até a primeira carga.
Map<String, Color> _doBackend = const {};

/// Publica as cores servidas pelo backend. Chamado quando a taxonomia carrega
/// (ver `main.dart`) — a partir daí toda tela pinta pelo mesmo lugar.
void aplicarCoresDaTaxonomia(Map<String, Color> cores) {
  if (cores.isNotEmpty) _doBackend = cores;
}

/// A cor de uma categoria. Backend primeiro, cópia local depois.
Color categoryColor(String? cat) {
  final key = cat ?? 'institucional';
  return _doBackend[key] ??
      categoryColors[key] ??
      categoryColors['institucional']!;
}

String categoryLabel(String? cat) =>
    categoryLabels[cat ?? 'institucional'] ?? (cat ?? 'Outros');
