import 'package:latlong2/latlong.dart';

// Ponto individual de ocorrência pro mapa (radar). Espelha o tipo CrimePoint do backend.
class CrimePoint {
  final String id;
  final double lat;
  final double lng;
  final String categoria; // patrimonial | seguranca | operacional | fraude | institucional
  final String tipoCrime;
  final String data; // YYYY-MM-DD
  final String? bairro;
  final String? rua;
  final String precisao; // rua | bairro | cidade

  CrimePoint({
    required this.id,
    required this.lat,
    required this.lng,
    required this.categoria,
    required this.tipoCrime,
    required this.data,
    required this.bairro,
    required this.rua,
    required this.precisao,
  });

  LatLng get coords => LatLng(lat, lng);

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  factory CrimePoint.fromJson(Map<String, dynamic> json) {
    return CrimePoint(
      id: json['id']?.toString() ?? '',
      lat: _toDouble(json['lat']),
      lng: _toDouble(json['lng']),
      categoria: json['categoria'] as String? ?? 'institucional',
      tipoCrime: json['tipo_crime'] as String? ?? 'outros',
      data: json['data'] as String? ?? '',
      bairro: json['bairro'] as String?,
      rua: json['rua'] as String?,
      precisao: json['precisao'] as String? ?? 'cidade',
    );
  }
}
