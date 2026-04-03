import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/env.dart';
import '../models/news_item.dart';

class ApiService {
  final String _baseUrl = Env.apiUrl;
  final http.Client _client = http.Client();
  static const _timeout = Duration(seconds: 8);
  String _token = '';

  void setToken(String token) {
    _token = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token.isNotEmpty) 'Authorization': 'Bearer $_token',
      };

  // ── News ──

  Future<List<NewsItem>> getNews({
    int offset = 0,
    int limit = 20,
    String? cidade,
  }) async {
    final params = <String, String>{
      'offset': '$offset',
      'limit': '$limit',
    };
    if (cidade != null) params['cidade'] = cidade;

    final uri =
        Uri.parse('$_baseUrl/news/feed').replace(queryParameters: params);
    final res = await _client.get(uri, headers: _headers).timeout(_timeout);
    _checkResponse(res);

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final list = body['news'] as List<dynamic>;
    return list
        .map((e) => NewsItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<NewsItem>> searchNews(
    String query, {
    String? cidade,
    String? tipoCrime,
    String? dateFrom,
    String? dateTo,
  }) async {
    final bodyMap = <String, dynamic>{'query': query};
    if (cidade != null) bodyMap['cidade'] = cidade;
    if (tipoCrime != null) bodyMap['tipoCrime'] = tipoCrime;
    if (dateFrom != null) bodyMap['dateFrom'] = dateFrom;
    if (dateTo != null) bodyMap['dateTo'] = dateTo;

    final res = await _client.post(
      Uri.parse('$_baseUrl/search'),
      headers: _headers,
      body: jsonEncode(bodyMap),
    ).timeout(_timeout);
    _checkResponse(res);

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final list = body['news'] as List<dynamic>;
    return list
        .map((e) => NewsItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ── Locations (para dropdown de cidades - endpoint publico) ──

  Future<List<Map<String, dynamic>>> getLocations() async {
    final res = await _client.get(
      Uri.parse('$_baseUrl/public/locations'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
    return (jsonDecode(res.body) as List<dynamic>)
        .cast<Map<String, dynamic>>();
  }

  Future<List<NewsItem>> getFavorites({int offset = 0, int limit = 20}) async {
    final params = <String, String>{
      'offset': '$offset',
      'limit': '$limit',
    };
    final uri = Uri.parse('$_baseUrl/news/favorites')
        .replace(queryParameters: params);
    final res = await _client.get(uri, headers: _headers).timeout(_timeout);
    _checkResponse(res);

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final list = body['news'] as List<dynamic>;
    return list
        .map((e) => NewsItem.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> markAsRead(String newsId) async {
    final res = await _client.post(
      Uri.parse('$_baseUrl/news/$newsId/read'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
  }

  Future<void> markAllAsRead() async {
    final res = await _client.post(
      Uri.parse('$_baseUrl/news/mark-all-read'),
      headers: _headers,
    ).timeout(const Duration(seconds: 15));
    _checkResponse(res);
  }

  Future<void> addFavorite(String newsId) async {
    final res = await _client.post(
      Uri.parse('$_baseUrl/news/$newsId/favorite'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
  }

  Future<void> removeFavorite(String newsId) async {
    final res = await _client.delete(
      Uri.parse('$_baseUrl/news/$newsId/favorite'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
  }

  Future<int> getUnreadCount() async {
    final res = await _client.get(
      Uri.parse('$_baseUrl/news/unread-count'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return body['count'] as int? ?? 0;
  }

  // ── Auth ──

  Future<Map<String, dynamic>> getMyProfile() async {
    final res = await _client.get(
      Uri.parse('$_baseUrl/auth/me'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<void> requestPasswordReset(String email) async {
    final res = await _client.post(
      Uri.parse('$_baseUrl/auth/request-reset'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email}),
    ).timeout(_timeout);
    _checkResponse(res);
  }

  Future<void> changePassword(String newPassword) async {
    final res = await _client.post(
      Uri.parse('$_baseUrl/auth/change-password'),
      headers: _headers,
      body: jsonEncode({'new_password': newPassword}),
    ).timeout(_timeout);
    _checkResponse(res);
  }

  // ── Auth Config (público) ──

  Future<Map<String, dynamic>> getAuthConfig() async {
    final res = await _client.get(
      Uri.parse('$_baseUrl/settings/auth-config'),
    ).timeout(const Duration(seconds: 3));
    _checkResponse(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  // ── Manual Search (pipeline individual) ──

  Future<String> triggerManualSearch({
    required String estado,
    required List<String> cidades,
    int periodoDias = 30,
    String? tipoCrime,
    double profundidade = 1.0,
  }) async {
    final bodyMap = <String, dynamic>{
      'estado': estado,
      'cidades': cidades,
      'periodo_dias': periodoDias,
      'profundidade': profundidade,
    };
    if (tipoCrime != null) bodyMap['tipo_crime'] = tipoCrime;

    final res = await _client.post(
      Uri.parse('$_baseUrl/manual-search'),
      headers: _headers,
      body: jsonEncode(bodyMap),
    ).timeout(_timeout);
    _checkResponse(res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return body['searchId'] as String;
  }

  Future<Map<String, dynamic>> getManualSearchStatus(String searchId) async {
    final res = await _client.get(
      Uri.parse('$_baseUrl/manual-search/$searchId/status'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getManualSearchResults(
      String searchId) async {
    final res = await _client.get(
      Uri.parse('$_baseUrl/manual-search/$searchId/results'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return (body['results'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> getSearchHistory() async {
    final res = await _client.get(
      Uri.parse('$_baseUrl/manual-search/history'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return (body['history'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<void> deleteSearches(List<String> ids) async {
    final res = await _client.delete(
      Uri.parse('$_baseUrl/manual-search'),
      headers: _headers,
      body: jsonEncode({'ids': ids}),
    ).timeout(_timeout);
    _checkResponse(res);
  }

  // ── Analytics / Reports ──

  Future<Map<String, dynamic>> generateReport({
    required String cidade,
    required String estado,
    required String dateFrom,
    required String dateTo,
    String? searchId,
  }) async {
    final bodyMap = <String, dynamic>{
      'cidade': cidade,
      'estado': estado,
      'dateFrom': dateFrom,
      'dateTo': dateTo,
    };
    if (searchId != null) bodyMap['searchId'] = searchId;

    final res = await _client.post(
      Uri.parse('$_baseUrl/analytics/report'),
      headers: _headers,
      body: jsonEncode(bodyMap),
    ).timeout(_timeout);
    _checkResponse(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getSearchAnalytics(String searchId) async {
    final res = await _client.get(
      Uri.parse('$_baseUrl/analytics/search-report/$searchId'),
      headers: _headers,
    ).timeout(_timeout);
    _checkResponse(res);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  // ── Devices (push token) ──

  Future<void> registerDevice(String deviceToken, String platform) async {
    final res = await _client.post(
      Uri.parse('$_baseUrl/devices'),
      headers: _headers,
      body: jsonEncode({
        'token': deviceToken,
        'platform': platform,
      }),
    ).timeout(_timeout);
    _checkResponse(res);
  }

  // ── Helpers ──

  void _checkResponse(http.Response res) {
    if (res.statusCode >= 400) {
      String message = 'Erro desconhecido';
      try {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        message = body['error'] as String? ?? message;
      } catch (_) {
        message = res.reasonPhrase ?? 'HTTP ${res.statusCode}';
      }
      throw ApiException(statusCode: res.statusCode, message: message);
    }
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
