import 'dart:convert';
import 'package:flutter/services.dart';

class BrazilianLocations {
  BrazilianLocations._();
  static final BrazilianLocations instance = BrazilianLocations._();

  List<Map<String, dynamic>> _estados = [];
  bool _loaded = false;

  Future<void> load() async {
    if (_loaded) return;
    final jsonStr =
        await rootBundle.loadString('assets/data/municipios_br.json');
    final List<dynamic> data = json.decode(jsonStr);
    _estados = data.cast<Map<String, dynamic>>();
    _loaded = true;
  }

  /// Returns list of estado names sorted alphabetically.
  List<String> getEstados() {
    return _estados.map((e) => e['nome'] as String).toList();
  }

  /// Returns UF abbreviation for a given estado name.
  String? getUf(String estadoNome) {
    final estado = _estados.cast<Map<String, dynamic>?>().firstWhere(
          (e) => e!['nome'] == estadoNome,
          orElse: () => null,
        );
    return estado?['uf'] as String?;
  }

  /// Returns list of cities for a given estado name.
  List<String> getCidades(String estadoNome) {
    final estado = _estados.cast<Map<String, dynamic>?>().firstWhere(
          (e) => e!['nome'] == estadoNome,
          orElse: () => null,
        );
    if (estado == null) return [];
    return (estado['cidades'] as List<dynamic>).cast<String>();
  }

  /// Searches cities matching [query]. If [estadoNome] is provided, filters
  /// only that state. Otherwise searches all states and returns "City - UF".
  List<String> searchCidades(String query, {String? estadoNome}) {
    final q = _removeDiacritics(query.toLowerCase());
    if (q.length < 2) return [];

    if (estadoNome != null) {
      return getCidades(estadoNome)
          .where((c) => _removeDiacritics(c.toLowerCase()).contains(q))
          .take(20)
          .toList();
    }

    final results = <String>[];
    for (final estado in _estados) {
      final uf = estado['uf'] as String;
      final cidades = (estado['cidades'] as List<dynamic>).cast<String>();
      for (final cidade in cidades) {
        if (_removeDiacritics(cidade.toLowerCase()).contains(q)) {
          results.add('$cidade - $uf');
          if (results.length >= 20) return results;
        }
      }
    }
    return results;
  }

  static String _removeDiacritics(String str) {
    const diacritics =
        'àáâãäåèéêëìíîïòóôõöùúûüýñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ';
    const replacements =
        'aaaaaaeeeeiiiioooooouuuuyncAAAAAAEEEEIIIIOOOOOUUUUYNC';
    final buffer = StringBuffer();
    for (int i = 0; i < str.length; i++) {
      final idx = diacritics.indexOf(str[i]);
      buffer.write(idx >= 0 ? replacements[idx] : str[i]);
    }
    return buffer.toString();
  }
}
