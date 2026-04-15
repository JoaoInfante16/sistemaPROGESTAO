import 'dart:convert';
import 'dart:math';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/services/api_service.dart';
import '../../../main.dart';
import '../widgets/mini_trend_chart.dart';

class ReportScreen extends StatefulWidget {
  final String? searchId;
  final List<String> cidades;
  final String estado;
  final int periodoDias;
  final List<Map<String, dynamic>> results;

  const ReportScreen({
    super.key,
    this.searchId,
    required this.cidades,
    required this.estado,
    required this.periodoDias,
    required this.results,
  });

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  bool _generatingLink = false;
  String? _reportUrl;

  // Computed
  late final Map<String, int> _crimeTypeCounts;
  late final Map<String, int> _bairroCounts;
  late final List<Map<String, dynamic>> _byDate;
  late final int _totalOcorrencias;
  late final int _totalEstatisticas;
  late final List<Map<String, dynamic>> _estatisticas;
  late final List<Map<String, String>> _sourcesOficial;
  late final List<Map<String, String>> _sourcesMedia;

  // Heatmap
  List<_HeatPoint> _heatPoints = [];
  bool _mapLoading = true;

  @override
  void initState() {
    super.initState();
    _computeAnalytics();
    _loadHeatmap();
  }

  Future<void> _loadHeatmap() async {
    if (widget.cidades.isEmpty || _bairroCounts.isEmpty) {
      if (mounted) setState(() => _mapLoading = false);
      return;
    }

    try {
      final cidade = widget.cidades.first;
      final estado = widget.estado;
      final bairros = (_bairroCounts.entries.toList()
            ..sort((a, b) => b.value.compareTo(a.value)))
          .take(15)
          .toList();

      final points = <_HeatPoint>[];
      for (final b in bairros) {
        if (!mounted) return;
        final coords = await _geocode(b.key, cidade, estado);
        if (coords != null) {
          points.add(_HeatPoint(b.key, b.value, coords));
        }
      }
      if (mounted) setState(() { _heatPoints = points; _mapLoading = false; });
    } catch (e) {
      debugPrint('[Report] Heat map error: $e');
      if (mounted) setState(() => _mapLoading = false);
    }
  }

  final _geoCache = <String, LatLng?>{};

  Future<LatLng?> _geocode(String bairro, String cidade, String estado) async {
    if (_geoCache.length > 100) _geoCache.clear();
    final key = '$bairro|$cidade|$estado'.toLowerCase();
    if (_geoCache.containsKey(key)) return _geoCache[key];

    try {
      final query = Uri.encodeComponent('$bairro, $cidade, $estado, Brasil');
      final url = 'https://nominatim.openstreetmap.org/search?q=$query&format=json&limit=1&countrycodes=br';
      final res = await http.get(Uri.parse(url), headers: {'User-Agent': 'SIMEops/1.0'});
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as List;
        if (data.isNotEmpty) {
          final result = LatLng(double.parse(data[0]['lat']), double.parse(data[0]['lon']));
          _geoCache[key] = result;
          return result;
        }
      }
    } catch (e) { debugPrint('[Report] Geocode error: $e'); }

    // Fallback: geocodificar so a cidade
    final cityKey = '_city|$cidade|$estado'.toLowerCase();
    if (!_geoCache.containsKey(cityKey)) {
      try {
        final q = Uri.encodeComponent('$cidade, $estado, Brasil');
        final res = await http.get(
          Uri.parse('https://nominatim.openstreetmap.org/search?q=$q&format=json&limit=1&countrycodes=br'),
          headers: {'User-Agent': 'SIMEops/1.0'},
        );
        if (res.statusCode == 200) {
          final data = jsonDecode(res.body) as List;
          if (data.isNotEmpty) {
            _geoCache[cityKey] = LatLng(double.parse(data[0]['lat']), double.parse(data[0]['lon']));
          }
        }
      } catch (e) { debugPrint('[Report] City geocode error: $e'); }
    }

    final cityCoord = _geoCache[cityKey];
    if (cityCoord != null) {
      final jittered = LatLng(
        cityCoord.latitude + (Random().nextDouble() - 0.5) * 0.02,
        cityCoord.longitude + (Random().nextDouble() - 0.5) * 0.02,
      );
      _geoCache[key] = jittered;
      return jittered;
    }

    _geoCache[key] = null;
    return null;
  }

  void _computeAnalytics() {
    _crimeTypeCounts = {};
    _bairroCounts = {};
    final dateCounts = <String, int>{};
    final estatisticas = <Map<String, dynamic>>[];
    int ocorrencias = 0;

    for (final r in widget.results) {
      final natureza = r['natureza'] as String? ?? 'ocorrencia';

      if (natureza == 'estatistica') {
        estatisticas.add(r);
        continue;
      }

      ocorrencias++;
      final tipo = r['tipo_crime'] as String? ?? 'outros';
      _crimeTypeCounts[tipo] = (_crimeTypeCounts[tipo] ?? 0) + 1;

      final bairro = r['bairro'] as String?;
      if (bairro != null && bairro.isNotEmpty) {
        _bairroCounts[bairro] = (_bairroCounts[bairro] ?? 0) + 1;
      }

      final date = r['data_ocorrencia'] as String?;
      if (date != null) {
        dateCounts[date] = (dateCounts[date] ?? 0) + 1;
      }
    }

    _totalOcorrencias = ocorrencias;
    _totalEstatisticas = estatisticas.length;
    _estatisticas = estatisticas;

    _byDate = dateCounts.entries
        .map((e) => <String, dynamic>{'date': e.key, 'count': e.value})
        .toList()
      ..sort((a, b) => (a['date'] as String).compareTo(b['date'] as String));

    // Sources
    final officialPattern = RegExp(
        r'\.gov\.br|\.ssp\.|\.seguranca\.|\.sesp\.|\.sspds\.|\.sejusp\.|\.segup\.',
        caseSensitive: false);
    final seenUrls = <String>{};
    final oficial = <Map<String, String>>[];
    final media = <Map<String, String>>[];

    for (final r in widget.results) {
      final url = r['source_url'] as String? ?? r['url'] as String? ?? '';
      if (url.isEmpty || seenUrls.contains(url)) continue;
      seenUrls.add(url);
      String name;
      try {
        name = Uri.parse(url).host;
      } catch (_) {
        name = url;
      }
      final entry = {'url': url, 'name': name, 'title': (r['resumo'] as String? ?? '').split('.').first};
      if (officialPattern.hasMatch(url)) {
        oficial.add(entry);
      } else {
        media.add(entry);
      }
    }
    _sourcesOficial = oficial;
    _sourcesMedia = media;
  }

  static const _tipoToCategory = {
    'roubo_furto': 'patrimonial', 'vandalismo': 'patrimonial', 'invasao': 'patrimonial',
    'homicidio': 'seguranca', 'latrocinio': 'seguranca', 'lesao_corporal': 'seguranca',
    'trafico': 'operacional', 'operacao_policial': 'operacional', 'manifestacao': 'operacional', 'bloqueio_via': 'operacional',
    'estelionato': 'fraude', 'receptacao': 'fraude',
    'crime_ambiental': 'institucional', 'trabalho_irregular': 'institucional', 'estatistica': 'institucional', 'outros': 'institucional',
  };

  static const _categoryColors = <String, Color>{
    'patrimonial': Color(0xFFF97316),
    'seguranca': Color(0xFFEF4444),
    'operacional': Color(0xFF3B82F6),
    'fraude': Color(0xFF8B5CF6),
    'institucional': Color(0xFF64748B),
  };

  static const _categoryLabels = <String, String>{
    'patrimonial': 'Patrimonial',
    'seguranca': 'Segurança',
    'operacional': 'Operacional',
    'fraude': 'Fraude',
    'institucional': 'Institucional',
  };

  Map<String, int> get _categoryCounts {
    final map = <String, int>{};
    for (final e in _crimeTypeCounts.entries) {
      final cat = _tipoToCategory[e.key] ?? 'institucional';
      map[cat] = (map[cat] ?? 0) + e.value;
    }
    return map;
  }

  Widget _buildCategoryDonut() {
    final cats = _categoryCounts;
    final sorted = cats.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

    return _card(
      child: Row(
        children: [
          SizedBox(
            width: 130,
            height: 130,
            child: Stack(
              alignment: Alignment.center,
              children: [
                PieChart(
                  PieChartData(
                    sections: sorted.map((e) {
                      final color = _categoryColors[e.key] ?? const Color(0xFF64748B);
                      return PieChartSectionData(
                        value: e.value.toDouble(),
                        color: color,
                        radius: 18,
                        showTitle: false,
                      );
                    }).toList(),
                    sectionsSpace: 2,
                    centerSpaceRadius: 40,
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$_totalOcorrencias',
                        style: GoogleFonts.rajdhani(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: SIMEopsColors.white)),
                    Text('TOTAL',
                        style: GoogleFonts.rajdhani(
                            fontSize: 9,
                            letterSpacing: 1,
                            color: SIMEopsColors.muted.withValues(alpha: 0.6))),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: sorted.map((e) {
                final color = _categoryColors[e.key] ?? const Color(0xFF64748B);
                final label = _categoryLabels[e.key] ?? e.key;
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                      const SizedBox(width: 8),
                      Expanded(child: Text(label, style: GoogleFonts.exo2(fontSize: 12, color: SIMEopsColors.muted))),
                      Text('${e.value}', style: GoogleFonts.rajdhani(fontSize: 14, fontWeight: FontWeight.w700, color: SIMEopsColors.white)),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _generateAndShareLink() async {
    setState(() => _generatingLink = true);
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final dateFrom = now.subtract(Duration(days: widget.periodoDias));
      String fmt(DateTime d) =>
          '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

      final response = await api.generateReport(
        cidade: widget.cidades.first,
        estado: widget.estado,
        dateFrom: fmt(dateFrom),
        dateTo: fmt(now),
        searchId: widget.searchId,
      );

      final url = (response['reportUrl'] as String?) ??
          'https://sistemaprogestao.onrender.com/report/${response['reportId']}';
      setState(() => _reportUrl = url);

      if (mounted) {
        await Share.share(
          'SIMEops - Relatório de Risco\n${widget.cidades.join(", ")}/${widget.estado}\n\n$url',
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao gerar relatório: $e')),
        );
      }
    } finally {
      setState(() => _generatingLink = false);
    }
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  // ============================================
  // UI COMPONENTS
  // ============================================

  Widget _sectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Row(
        children: [
          Text(
            text.toUpperCase(),
            style: GoogleFonts.rajdhani(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 2,
              color: SIMEopsColors.muted,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
                height: 1,
                color: SIMEopsColors.teal.withValues(alpha: 0.15)),
          ),
        ],
      ),
    );
  }

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SIMEopsColors.navyMid.withValues(alpha: 0.95),
        border:
            Border.all(color: SIMEopsColors.teal.withValues(alpha: 0.15)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: child,
    );
  }

  // ============================================
  // BUILD
  // ============================================

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      appBar: AppBar(
        title: Text('RELATORIO DE RISCO',
            style: GoogleFonts.rajdhani(
                fontWeight: FontWeight.w700, letterSpacing: 1.5, fontSize: 16)),
        actions: [
          if (_reportUrl != null)
            IconButton(
              icon: const Icon(Icons.open_in_browser),
              onPressed: () => _openUrl(_reportUrl!),
            ),
        ],
      ),
      body: Stack(
        children: [
          ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
            children: [
              // Cidade / Periodo card
              _card(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('CIDADE',
                              style: GoogleFonts.rajdhani(
                                  fontSize: 10,
                                  letterSpacing: 1.5,
                                  color: SIMEopsColors.muted.withValues(alpha: 0.6))),
                          const SizedBox(height: 2),
                          Text(
                            '${widget.cidades.join(", ")} — ${widget.estado}',
                            style: GoogleFonts.exo2(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: SIMEopsColors.white),
                          ),
                        ],
                      ),
                    ),
                    Container(
                        width: 1,
                        height: 36,
                        color: SIMEopsColors.teal.withValues(alpha: 0.15)),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('PERIODO',
                            style: GoogleFonts.rajdhani(
                                fontSize: 10,
                                letterSpacing: 1.5,
                                color: SIMEopsColors.muted.withValues(alpha: 0.6))),
                        const SizedBox(height: 2),
                        Text(
                          'Ultimos ${widget.periodoDias} dias',
                          style: GoogleFonts.exo2(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: SIMEopsColors.white),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Resumo numerico
              _sectionTitle('Resumo'),
              _card(
                child: Row(
                  children: [
                    _statBox('$_totalOcorrencias', 'Ocorrências'),
                    _dividerVertical(),
                    _statBox('${_bairroCounts.length}', 'Bairros'),
                    _dividerVertical(),
                    _statBox('${_crimeTypeCounts.length}', 'Tipos'),
                    if (_totalEstatisticas > 0) ...[
                      _dividerVertical(),
                      _statBox('$_totalEstatisticas', 'Indicadores'),
                    ],
                  ],
                ),
              ),

              // Donut chart — Ocorrencias por CATEGORIA
              if (_crimeTypeCounts.isNotEmpty) ...[
                _sectionTitle('Distribuição por Categoria'),
                _buildCategoryDonut(),
              ],

              // Mapa de calor
              if (_heatPoints.isNotEmpty) ...[
                _sectionTitle('Mapa de Ocorrências'),
                _card(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: SizedBox(
                      height: 280,
                      child: FlutterMap(
                        options: MapOptions(
                          initialCenter: _heatPoints.first.coords,
                          initialZoom: 12,
                          interactionOptions: const InteractionOptions(
                            flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
                          ),
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                            subdomains: const ['a', 'b', 'c', 'd'],
                            userAgentPackageName: 'com.progestao.simeops',
                          ),
                          CircleLayer(
                            circles: _heatPoints.map((p) {
                              // Raio baseado no count absoluto: 8px base + 3px por ocorrencia (max 30px)
                              final radius = min(30.0, 8.0 + p.count * 3.0);
                              // Cor: teal (baixo) → vermelho (alto, 5+)
                              final intensity = min(1.0, p.count / 5.0);
                              return CircleMarker(
                                point: p.coords,
                                radius: radius,
                                color: Color.lerp(
                                  const Color(0xFF22B5C4),
                                  const Color(0xFFE05252),
                                  intensity,
                                )!.withValues(alpha: 0.35),
                                borderColor: Color.lerp(
                                  const Color(0xFF22B5C4),
                                  const Color(0xFFE05252),
                                  intensity,
                                )!.withValues(alpha: 0.8),
                                borderStrokeWidth: 1.5,
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ] else if (_mapLoading && _bairroCounts.isNotEmpty) ...[
                _sectionTitle('Mapa de Ocorrências'),
                _card(
                  child: SizedBox(
                    height: 280,
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(color: SIMEopsColors.teal),
                          const SizedBox(height: 12),
                          Text('Geocodificando bairros...',
                              style: GoogleFonts.exo2(
                                  fontSize: 12, color: SIMEopsColors.muted)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],

              // Bairros com mais incidencias
              if (_bairroCounts.isNotEmpty) ...[
                _sectionTitle('Bairros com Mais Incidencias'),
                _card(
                  child: Column(
                    children: () {
                      final sorted = _bairroCounts.entries.toList()
                        ..sort((a, b) => b.value.compareTo(a.value));
                      final top = sorted.take(8).toList();
                      final maxCount = top.first.value;
                      return top.asMap().entries.map((entry) {
                        final i = entry.key;
                        final e = entry.value;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              SizedBox(
                                width: 24,
                                child: Text('${i + 1}.',
                                    style: GoogleFonts.exo2(
                                        fontSize: 12, color: SIMEopsColors.muted)),
                              ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(e.key,
                                            style: GoogleFonts.exo2(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w500,
                                                color: SIMEopsColors.white)),
                                        Text('${e.value}',
                                            style: GoogleFonts.rajdhani(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                                color: SIMEopsColors.muted)),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    LinearProgressIndicator(
                                      value: e.value / maxCount,
                                      backgroundColor:
                                          SIMEopsColors.teal.withValues(alpha: 0.1),
                                      color: SIMEopsColors.teal,
                                      minHeight: 4,
                                      borderRadius: BorderRadius.circular(2),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList();
                    }(),
                  ),
                ),
              ],

              // Indicadores da Regiao (estatisticas + tendencia)
              if (_estatisticas.isNotEmpty || _byDate.length > 1) ...[
                _sectionTitle('Indicadores da Região'),
                if (_byDate.length > 1)
                  _card(
                    child: SizedBox(
                      height: 180,
                      child: MiniTrendChart(data: _byDate),
                    ),
                  ),
                if (_estatisticas.isNotEmpty) _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: _estatisticas.map((e) {
                      final resumo = e['resumo'] as String? ?? '';
                      final url = e['source_url'] as String? ?? '';
                      String fonte;
                      try {
                        fonte = Uri.parse(url).host;
                      } catch (_) {
                        fonte = url;
                      }
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(resumo,
                                style: GoogleFonts.exo2(
                                    fontSize: 13, color: SIMEopsColors.white)),
                            if (url.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              InkWell(
                                onTap: () => _openUrl(url),
                                child: Text('Fonte: $fonte',
                                    style: GoogleFonts.exo2(
                                        fontSize: 11,
                                        color: SIMEopsColors.tealLight,
                                        decoration: TextDecoration.underline)),
                              ),
                            ],
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],

              // Fontes analisadas
              _sectionTitle('Fontes Analisadas'),
              _card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_sourcesOficial.isNotEmpty) ...[
                      ...List.generate(
                        min(_sourcesOficial.length, 5),
                        (i) => _sourceRow(i + 1, _sourcesOficial[i], true),
                      ),
                    ],
                    ...List.generate(
                      min(_sourcesMedia.length, 8),
                      (i) => _sourceRow(
                          (_sourcesOficial.length + i + 1), _sourcesMedia[i], false),
                    ),
                    if (_sourcesMedia.length > 8)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          '+ ${_sourcesMedia.length - 8} fontes adicionais',
                          style: GoogleFonts.exo2(
                              fontSize: 11,
                              color: SIMEopsColors.muted.withValues(alpha: 0.5)),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 60),
            ],
          ),

          // Botao fixo no bottom
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: SizedBox(
              height: 52,
              child: FilledButton(
                onPressed: _generatingLink ? null : _generateAndShareLink,
                style: FilledButton.styleFrom(
                  backgroundColor: SIMEopsColors.green,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _generatingLink
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.arrow_upward,
                              size: 18, color: Colors.white),
                          const SizedBox(width: 8),
                          Text('COMPARTILHAR RELATORIO',
                              style: GoogleFonts.rajdhani(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 2,
                                  color: Colors.white)),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statBox(String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(value,
              style: GoogleFonts.rajdhani(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: SIMEopsColors.white)),
          Text(label.toUpperCase(),
              style: GoogleFonts.rajdhani(
                  fontSize: 9,
                  letterSpacing: 1,
                  color: SIMEopsColors.muted.withValues(alpha: 0.6))),
        ],
      ),
    );
  }

  Widget _dividerVertical() {
    return Container(
        width: 1,
        height: 36,
        color: SIMEopsColors.teal.withValues(alpha: 0.15));
  }

  Widget _sourceRow(int index, Map<String, String> source, bool isOfficial) {
    final color = isOfficial ? SIMEopsColors.tealLight : SIMEopsColors.muted;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: () => _openUrl(source['url']!),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('[$index]  ',
                style: GoogleFonts.exo2(fontSize: 11, color: SIMEopsColors.muted.withValues(alpha: 0.5))),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(source['name']!,
                      style: GoogleFonts.exo2(
                          fontSize: 13, color: color, decoration: TextDecoration.underline)),
                  if (source['title']?.isNotEmpty == true)
                    Text(source['title']!,
                        style: GoogleFonts.exo2(
                            fontSize: 11,
                            color: SIMEopsColors.muted.withValues(alpha: 0.6)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeatPoint {
  final String bairro;
  final int count;
  final LatLng coords;
  const _HeatPoint(this.bairro, this.count, this.coords);
}
