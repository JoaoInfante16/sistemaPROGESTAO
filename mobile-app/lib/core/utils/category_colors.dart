import 'package:flutter/material.dart';

// Cores e labels por categoria_grupo. Fonte única pra card de notícia, mapa,
// filtros, gráficos — qualquer lugar que precise colorir/rotular categoria.
// Mapeamento tipo_crime → categoria vive no backend (TIPO_CRIME_GRUPO em types.ts).

const categoryColors = <String, Color>{
  'patrimonial': Colors.orange,
  'seguranca': Colors.red,
  'operacional': Colors.blue,
  'fraude': Colors.purple,
  'institucional': Colors.blueGrey,
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

Color categoryColor(String? cat) =>
    categoryColors[cat ?? 'institucional'] ?? Colors.blueGrey;

String categoryLabel(String? cat) =>
    categoryLabels[cat ?? 'institucional'] ?? (cat ?? 'Outros');
