import 'package:flutter/material.dart';

// Cores e labels por categoria_grupo. Fonte única pra card de notícia, mapa,
// filtros, gráficos — qualquer lugar que precise colorir/rotular categoria.
// Mapeamento tipo_crime → categoria vive no backend (TIPO_CRIME_GRUPO em types.ts).

// Hexes calibrados pro navy (antes o report tinha uma escala própria refinada
// e aqui ficava o Material cru — chips e donut pintavam diferente; unificado
// na Fase 9, etapa da linguagem visual).
const categoryColors = <String, Color>{
  'patrimonial': Color(0xFFF97316),
  'seguranca': Color(0xFFEF4444),
  'operacional': Color(0xFF3B82F6),
  'fraude': Color(0xFF8B5CF6),
  'institucional': Color(0xFF64748B),
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
    categoryColors[cat ?? 'institucional'] ?? const Color(0xFF64748B);

String categoryLabel(String? cat) =>
    categoryLabels[cat ?? 'institucional'] ?? (cat ?? 'Outros');
