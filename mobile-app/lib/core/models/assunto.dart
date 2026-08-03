import 'package:flutter/material.dart';

// Catálogo de assuntos servido por GET /settings/taxonomia.
//
// Vem do backend e não de uma const em Dart de propósito: a taxonomia é
// justamente a coisa que se quer poder mexer, e uma lista hardcoded aqui faria
// cada assunto novo virar build de APK.

class Assunto {
  /// O que vai pro Google (sem a cidade). É também o valor mandado na busca.
  final String termo;

  /// O que o chip mostra.
  final String label;

  /// `tipo_crime` que o Filter2 vai atribuir. Vários assuntos podem apontar pro
  /// mesmo tipo — "greve" e "manifestação" são perguntas diferentes, mesma
  /// classificação.
  final String tipo;

  final String categoria;

  /// Faz parte do preset rápido (os 5 que o sistema já pesquisava).
  final bool essencial;

  const Assunto({
    required this.termo,
    required this.label,
    required this.tipo,
    required this.categoria,
    this.essencial = false,
  });

  factory Assunto.fromJson(Map<String, dynamic> json) => Assunto(
        termo: json['termo'] as String,
        label: json['label'] as String? ?? json['termo'] as String,
        tipo: json['tipo'] as String? ?? 'outros',
        categoria: json['categoria'] as String? ?? 'institucional',
        essencial: json['essencial'] as bool? ?? false,
      );
}

class CategoriaTaxonomia {
  final String id;
  final String label;
  final Color cor;

  const CategoriaTaxonomia({
    required this.id,
    required this.label,
    required this.cor,
  });

  factory CategoriaTaxonomia.fromJson(Map<String, dynamic> json) =>
      CategoriaTaxonomia(
        id: json['id'] as String,
        label: json['label'] as String? ?? json['id'] as String,
        cor: _hexToColor(json['cor'] as String?),
      );
}

class Taxonomia {
  final List<Assunto> assuntos;

  /// Já na ordem de exibição definida pelo backend.
  final List<CategoriaTaxonomia> categorias;

  /// Termos do preset rápido, prontos — a tela não precisa saber a regra.
  final List<String> essenciais;

  const Taxonomia({
    this.assuntos = const [],
    this.categorias = const [],
    this.essenciais = const [],
  });

  factory Taxonomia.fromJson(Map<String, dynamic> json) => Taxonomia(
        assuntos: (json['assuntos'] as List<dynamic>? ?? [])
            .map((a) => Assunto.fromJson(a as Map<String, dynamic>))
            .toList(),
        categorias: (json['categorias'] as List<dynamic>? ?? [])
            .map((c) => CategoriaTaxonomia.fromJson(c as Map<String, dynamic>))
            .toList(),
        essenciais: (json['essenciais'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList(),
      );

  bool get isEmpty => assuntos.isEmpty;

  List<Assunto> daCategoria(String categoriaId) =>
      assuntos.where((a) => a.categoria == categoriaId).toList();

  Color corDe(String categoriaId) => categorias
      .firstWhere(
        (c) => c.id == categoriaId,
        orElse: () => const CategoriaTaxonomia(
            id: 'institucional', label: 'Institucional', cor: Color(0xFF64748B)),
      )
      .cor;
}

Color _hexToColor(String? hex) {
  if (hex == null) return const Color(0xFF64748B);
  final limpo = hex.replaceFirst('#', '');
  final valor = int.tryParse(limpo, radix: 16);
  if (valor == null) return const Color(0xFF64748B);
  return Color(limpo.length == 6 ? 0xFF000000 | valor : valor);
}
