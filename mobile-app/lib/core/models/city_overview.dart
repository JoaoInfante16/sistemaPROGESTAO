class CityOverview {
  final String id;
  final String name;
  final String type; // 'city' or 'group'
  final String? parentState;
  final int? cityCount;
  final int? stateCount;
  final List<String>? cityNames;
  final int totalCrimes;
  final int totalCrimes30d;
  final double trendPercent;
  final String? topCrimeType;
  final double topCrimePercent;
  final int unreadCount;
  final DateTime? lastNewsAt;

  CityOverview({
    required this.id,
    required this.name,
    required this.type,
    this.parentState,
    this.cityCount,
    this.stateCount,
    this.cityNames,
    required this.totalCrimes,
    required this.totalCrimes30d,
    required this.trendPercent,
    this.topCrimeType,
    required this.topCrimePercent,
    required this.unreadCount,
    this.lastNewsAt,
  });

  bool get isGroup => type == 'group';
  bool get hasUnread => unreadCount > 0;
  bool get trendUp => trendPercent > 0;
  bool get trendDown => trendPercent < 0;

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  static int _toInt(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toInt();
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  factory CityOverview.fromJson(Map<String, dynamic> json) {
    return CityOverview(
      id: json['id'] as String,
      name: json['name'] as String,
      type: json['type'] as String? ?? 'city',
      parentState: json['parentState'] as String?,
      cityCount: json['cityCount'] != null ? _toInt(json['cityCount']) : null,
      stateCount: json['stateCount'] != null ? _toInt(json['stateCount']) : null,
      cityNames: (json['cityNames'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      totalCrimes: _toInt(json['totalCrimes']),
      totalCrimes30d: _toInt(json['totalCrimes30d']),
      trendPercent: _toDouble(json['trendPercent']),
      topCrimeType: json['topCrimeType'] as String?,
      topCrimePercent: _toDouble(json['topCrimePercent']),
      unreadCount: _toInt(json['unreadCount']),
      lastNewsAt: json['lastNewsAt'] != null
          ? DateTime.tryParse(json['lastNewsAt'].toString())
          : null,
    );
  }
}
