import 'package:flutter/material.dart';

// Cores e labels por categoria_grupo. Fonte única pra card de notícia, mapa,
// filtros, gráficos — qualquer lugar que precise colorir/rotular categoria.
// Mapeamento tipo_crime → categoria vive no backend (TIPO_CRIME_GRUPO em types.ts).

// Hexes VALIDADOS pro navy (#060D18), não escolhidos a olho. Rodar de novo com
// scripts/validate_palette.js da skill dataviz antes de mexer em qualquer um.
//   banda de luminosidade OKLCH 0.48–0.67 · croma ≥0.10
//   ΔE deuteranopia 8.0 · ΔE visão normal 19.3 · contraste ≥3:1
// A adjacência é conferida na ordem do categoryOrder abaixo — trocar a ordem
// exige revalidar, porque só vizinhos se encostam num empilhado.
//
// O que estava aqui antes era Tailwind cru (red/orange/blue/violet/slate-500)
// e reprovava em 4 das 5 checagens. O pior: operacional × fraude dava
// ΔE 1.3 sob deuteranopia — a mesma cor para ~8% dos homens, no mapa,
// no donut e nos chips. Azul e violeta não coexistem; por isso institucional
// virou verde-escuro em vez de cinza.
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

Color categoryColor(String? cat) =>
    categoryColors[cat ?? 'institucional'] ?? const Color(0xFF4E8F45);

String categoryLabel(String? cat) =>
    categoryLabels[cat ?? 'institucional'] ?? (cat ?? 'Outros');
