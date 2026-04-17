import 'dart:convert';
import 'dart:math';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/utils/type_helpers.dart';
import '../../../core/widgets/grid_background.dart';
import '../../../main.dart';
import 'package:share_plus/share_plus.dart';
import '../../feed/screens/feed_screen.dart';

class CityDetailScreen extends StatefulWidget {
  final CityOverview city;

  const CityDetailScreen({super.key, required this.city});

  @override
  State<CityDetailScreen> createState() => _CityDetailScreenState();
}

class _CityDetailScreenState extends State<CityDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Relatorio data
  Map<String, dynamic>? _summary;
  List<dynamic>? _trend;
  bool _loadingOverview = true;
  String _trendPeriod = '30d';

  // Mapa de calor
  List<_HeatPoint> _heatPoints = [];
  bool _mapLoading = false;
  final Map<String, LatLng?> _geoCache = {};

  // For groups: selected sub-city filter
  String? _selectedSubCity;

  // For groups without sub-city selected, use first city name
  String get _activeCidade {
    if (_selectedSubCity != null) return _selectedSubCity!;
    if (widget.city.isGroup && widget.city.cityNames != null && widget.city.cityNames!.isNotEmpty) {
      return widget.city.cityNames!.first;
    }
    return widget.city.name;
  }
  bool get _isGroup => widget.city.isGroup;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      // Lazy load: so carrega overview quando o usuario abre a tab
      if (_tabController.index == 1 && _loadingOverview && _summary == null) {
        _loadOverview();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _dateStr(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  int get _trendDays {
    switch (_trendPeriod) {
      case '7d': return 7;
      case '90d': return 90;
      case '1a': return 365;
      default: return 30;
    }
  }

  Future<void> _loadOverview() async {
    setState(() => _loadingOverview = true);
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final d30 = now.subtract(const Duration(days: 30));

      final summary = await api.getCrimeSummary(_activeCidade, _dateStr(d30), _dateStr(now))
          .catchError((_) => <String, dynamic>{});

      if (mounted) {
        setState(() {
          _summary = summary;
          _loadingOverview = false;
        });
        _geocodeBairros();
        _loadTrend();
      }
    } catch (e) {
      debugPrint('[CityDetail] Relatorio error: $e');
      if (mounted) setState(() => _loadingOverview = false);
    }
  }

  Future<void> _loadTrend() async {
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final from = now.subtract(Duration(days: _trendDays));
      final trendData = await api.getCrimeTrend(_activeCidade, _dateStr(from), _dateStr(now))
          .catchError((_) => <String, dynamic>{});
      if (mounted) {
        setState(() {
          _trend = trendData['trend'] as List<dynamic>? ?? [];
        });
      }
    } catch (e) {
      debugPrint('[CityDetail] Trend error: $e');
    }
  }

  void _changePeriod(String period) {
    setState(() => _trendPeriod = period);
    _loadTrend();
  }

  // ── Geocoding pra mapa de calor ──

  Future<void> _geocodeBairros() async {
    final bairros = (_summary?['topBairros'] as List<dynamic>?) ?? [];
    if (bairros.isEmpty) return;
    setState(() => _mapLoading = true);

    final cidade = _activeCidade;
    final estado = widget.city.parentState ?? '';
    final points = <_HeatPoint>[];

    for (final b in bairros) {
      final name = b['bairro'] as String? ?? '';
      final count = safeInt(b['count']);
      if (name.isEmpty) continue;

      final coords = await _geocode(name, cidade, estado);
      if (coords != null) {
        points.add(_HeatPoint(name, count, coords));
      }
    }

    if (mounted) {
      setState(() {
        _heatPoints = points;
        _mapLoading = false;
      });
    }
  }

  Future<LatLng?> _geocode(String bairro, String cidade, String estado) async {
    final key = '$bairro|$cidade|$estado'.toLowerCase();
    if (_geoCache.containsKey(key)) return _geoCache[key];

    try {
      final q = Uri.encodeComponent('$bairro, $cidade, $estado, Brasil');
      final res = await http.get(
        Uri.parse('https://nominatim.openstreetmap.org/search?q=$q&format=json&limit=1&countrycodes=br'),
        headers: {'User-Agent': 'SIMEops/1.0'},
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as List;
        if (data.isNotEmpty) {
          final result = LatLng(double.parse(data[0]['lat']), double.parse(data[0]['lon']));
          _geoCache[key] = result;
          return result;
        }
      }
    } catch (e) {
      debugPrint('[CityDetail] Geocode error: $e');
    }

    // Fallback: cidade inteira com jitter
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
      } catch (_) {}
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

  void _onSubCityChanged(String? city) {
    setState(() => _selectedSubCity = city);
    _loadOverview();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      appBar: AppBar(
        backgroundColor: SIMEopsColors.navy,
        title: Row(
          children: [
            Text(
              widget.city.name,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
            ),
            if (widget.city.parentState != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: SIMEopsColors.teal.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  abbrState(widget.city.parentState!),
                  style: TextStyle(fontSize: 11, color: SIMEopsColors.teal),
                ),
              ),
            ],
          ],
        ),
        bottom: PreferredSize(
          preferredSize: Size.fromHeight(_isGroup ? 88 : 44),
          child: Column(
            children: [
              // Sub-city filter for groups
              if (_isGroup)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: SizedBox(
                    height: 32,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _SubCityChip(
                          label: 'Todas',
                          selected: _selectedSubCity == null,
                          onTap: () => _onSubCityChanged(null),
                        ),
                        ...widget.city.cityNames!.map((c) => _SubCityChip(
                          label: c,
                          selected: _selectedSubCity == c,
                          onTap: () => _onSubCityChanged(c),
                        )),
                      ],
                    ),
                  ),
                ),
              TabBar(
                controller: _tabController,
                indicatorColor: SIMEopsColors.teal,
                labelColor: SIMEopsColors.teal,
                unselectedLabelColor: SIMEopsColors.muted,
                tabs: const [
                  Tab(text: 'Notícias'),
                  Tab(text: 'Relatório'),
                ],
              ),
            ],
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Feed filtrado
          _buildFeedTab(),

          // Tab 2: Overview / Stats
          _buildOverviewTab(),
        ],
      ),
    );
  }

  Widget _buildFeedTab() {
    if (_isGroup && _selectedSubCity == null) {
      // "Todas" — mostrar noticias de todas as cidades do grupo
      return FeedScreen(key: const ValueKey('group-all'), citiesFilter: widget.city.cityNames);
    }
    final cidade = _isGroup ? _selectedSubCity! : widget.city.name;
    return FeedScreen(key: ValueKey(cidade), cityFilter: cidade);
  }

  Widget _buildOverviewTab() {
    if (_loadingOverview) {
      return const Center(child: CircularProgressIndicator());
    }

    final types = (_summary?['byCrimeType'] as List<dynamic>?) ?? [];
    final categories = (_summary?['byCategory'] as List<dynamic>?) ?? [];
    final bairros = (_summary?['topBairros'] as List<dynamic>?) ?? [];

    final estatisticas = (_summary?['estatisticas'] as List<dynamic>?) ?? [];
    final totalCrimes = safeInt(_summary?['totalCrimes']);
    final totalBairros = bairros.length;
    final totalTipos = types.length;

    return GridBackground(
      child: RefreshIndicator(
        onRefresh: _loadOverview,
        color: SIMEopsColors.teal,
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          children: [
            // Resumo numerico
            _sectionTitle('Resumo'),
            _buildResumoCard(totalCrimes, totalBairros, totalTipos, estatisticas.length),

            // Donut chart por CATEGORIA (backend ja agrupa — nao recalcula aqui)
            if (categories.isNotEmpty) ...[
              _sectionTitle('Distribuição por Categoria'),
              _buildCategoryDonut(categories, totalCrimes),
            ],

            // Mapa de calor
            if (_heatPoints.isNotEmpty) ...[
              _sectionTitle('Mapa de Ocorrências'),
              _buildHeatMap(),
            ] else if (_mapLoading && bairros.isNotEmpty) ...[
              _sectionTitle('Mapa de Ocorrências'),
              _rCard(
                child: SizedBox(
                  height: 280,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(color: SIMEopsColors.teal),
                        const SizedBox(height: 12),
                        Text('Geocodificando bairros...', style: GoogleFonts.exo2(fontSize: 12, color: SIMEopsColors.muted)),
                      ],
                    ),
                  ),
                ),
              ),
            ],

            // Bairros com mais incidencias
            if (bairros.isNotEmpty) ...[
              _sectionTitle('Bairros com Mais Incidências'),
              _buildBairrosRanking(bairros),
            ],

            // Tendencia temporal (com filtros de periodo)
            _sectionTitle('Indicadores da Região'),
            _buildTrendWithFilters(),

            // Indicadores regionais (estatisticas da internet)
            if (estatisticas.isNotEmpty) ...[
              _sectionTitle('Estatísticas de Segurança'),
              _buildIndicadores(estatisticas),
            ],

            // Botao compartilhar
            if (totalCrimes > 0)
              _buildShareButton(),

            const SizedBox(height: 60),
          ],
        ),
      ),
    );
  }

  // ── Resumo numerico (identico ao report_screen) ──

  Widget _buildResumoCard(int total, int bairros, int tipos, int indicadores) {
    return _rCard(
      child: Row(
        children: [
          _statBox('$total', 'Ocorrências'),
          _dividerV(),
          _statBox('$bairros', 'Bairros'),
          _dividerV(),
          _statBox('$tipos', 'Tipos'),
          if (indicadores > 0) ...[
            _dividerV(),
            _statBox('$indicadores', 'Indicadores'),
          ],
        ],
      ),
    );
  }

  // ── Donut chart por CATEGORIA ──

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

  Widget _buildCategoryDonut(List<dynamic> categories, int total) {
    // Backend ja manda {category, count, percentage} agrupado.
    final sorted = categories
        .map((c) => MapEntry(c['category'] as String? ?? 'institucional', safeInt(c['count'])))
        .toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return _rCard(
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
                      return PieChartSectionData(value: e.value.toDouble(), color: color, radius: 18, showTitle: false);
                    }).toList(),
                    sectionsSpace: 2,
                    centerSpaceRadius: 40,
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$total', style: GoogleFonts.rajdhani(fontSize: 24, fontWeight: FontWeight.w700, color: SIMEopsColors.white)),
                    Text('TOTAL', style: GoogleFonts.rajdhani(fontSize: 9, letterSpacing: 1, color: SIMEopsColors.muted.withValues(alpha: 0.6))),
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

  // ── Botao compartilhar relatorio ──

  bool _sharing = false;

  Widget _buildShareButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _sharing ? null : _shareReport,
          icon: _sharing
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.share),
          label: Text(_sharing ? 'Gerando...' : 'Compartilhar Relatório'),
          style: ElevatedButton.styleFrom(
            backgroundColor: SIMEopsColors.teal,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ),
    );
  }

  Future<void> _shareReport() async {
    setState(() => _sharing = true);
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final from = now.subtract(const Duration(days: 30));
      String fmt(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

      final estado = widget.city.parentState ?? '';
      final response = await api.generateReport(
        cidade: _activeCidade,
        estado: estado,
        dateFrom: fmt(from),
        dateTo: fmt(now),
      );

      final url = (response['reportUrl'] as String?) ??
          'https://sistemaprogestao.onrender.com/report/${response['reportId']}';

      if (mounted) {
        await Share.share(
          'SIMEops - Relatório de Risco\n$_activeCidade/$estado\n\n$url',
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao gerar relatório: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  // ── Mapa de calor (identico ao report_screen) ──

  Widget _buildHeatMap() {
    return _rCard(
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
                  final radius = min(30.0, 8.0 + p.count * 3.0);
                  final intensity = min(1.0, p.count / 5.0);
                  return CircleMarker(
                    point: p.coords,
                    radius: radius,
                    color: Color.lerp(const Color(0xFF22B5C4), const Color(0xFFE05252), intensity)!.withValues(alpha: 0.35),
                    borderColor: Color.lerp(const Color(0xFF22B5C4), const Color(0xFFE05252), intensity)!.withValues(alpha: 0.8),
                    borderStrokeWidth: 1.5,
                  );
                }).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Bairros com mais incidencias (identico ao report_screen) ──

  Widget _buildBairrosRanking(List<dynamic> bairros) {
    final sorted = bairros.toList()..sort((a, b) => safeInt(b['count']).compareTo(safeInt(a['count'])));
    final top = sorted.take(8).toList();
    final maxCount = safeInt(top.first['count']);

    return _rCard(
      child: Column(
        children: top.asMap().entries.map((entry) {
          final i = entry.key;
          final b = entry.value;
          final name = b['bairro'] as String? ?? 'Desconhecido';
          final count = safeInt(b['count']);
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                SizedBox(
                  width: 24,
                  child: Text('${i + 1}.', style: GoogleFonts.exo2(fontSize: 12, color: SIMEopsColors.muted)),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(name, style: GoogleFonts.exo2(fontSize: 13, fontWeight: FontWeight.w500, color: SIMEopsColors.white)),
                          Text('$count', style: GoogleFonts.rajdhani(fontSize: 13, fontWeight: FontWeight.w700, color: SIMEopsColors.muted)),
                        ],
                      ),
                      const SizedBox(height: 3),
                      LinearProgressIndicator(
                        value: maxCount > 0 ? count / maxCount : 0,
                        backgroundColor: SIMEopsColors.teal.withValues(alpha: 0.1),
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
        }).toList(),
      ),
    );
  }

  // ── Tendencia temporal com filtros de periodo ──

  Widget _buildTrendWithFilters() {
    const periods = ['7d', '30d', '90d', '1a'];
    const labels = {'7d': '7 dias', '30d': '30 dias', '90d': '90 dias', '1a': '1 ano'};

    return _rCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Period chips
          Row(
            children: periods.map((p) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => _changePeriod(p),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: _trendPeriod == p ? SIMEopsColors.teal : SIMEopsColors.navyLight,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    labels[p]!,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: _trendPeriod == p ? FontWeight.w600 : FontWeight.w400,
                      color: _trendPeriod == p ? Colors.white : SIMEopsColors.muted,
                    ),
                  ),
                ),
              ),
            )).toList(),
          ),
          const SizedBox(height: 14),
          // Chart
          if (_trend != null && _trend!.isNotEmpty)
            SizedBox(
              height: 100,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: _trend!.map((t) {
                  final total = safeInt(t['total']);
                  final label = (t['label'] as String?) ?? '';
                  final maxVal = _trend!.fold<int>(1, (m, e) => safeInt(e['total']) > m ? safeInt(e['total']) : m);
                  final height = maxVal > 0 ? (total / maxVal) * 80 : 0.0;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text('$total', style: TextStyle(fontSize: 9, color: SIMEopsColors.muted)),
                          const SizedBox(height: 2),
                          Container(
                            height: height.clamp(4.0, 80.0),
                            decoration: BoxDecoration(
                              color: SIMEopsColors.teal.withValues(alpha: 0.7),
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            label.length > 5 ? label.substring(0, 5) : label,
                            style: TextStyle(fontSize: 8, color: SIMEopsColors.muted.withValues(alpha: 0.6)),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            )
          else
            SizedBox(
              height: 80,
              child: Center(child: Text('Sem dados de tendência', style: GoogleFonts.exo2(fontSize: 12, color: SIMEopsColors.muted))),
            ),
        ],
      ),
    );
  }

  // ── Indicadores / Estatisticas de Seguranca ──

  Widget _buildIndicadores(List<dynamic> estatisticas) {
    return _rCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: estatisticas.take(5).map((e) {
          final resumo = e['resumo'] as String? ?? '';
          final data = e['data_ocorrencia'] as String? ?? '';
          final sourceUrl = e['source_url'] as String?;
          String? fonte;
          if (sourceUrl != null && sourceUrl.isNotEmpty) {
            try { fonte = Uri.parse(sourceUrl).host; } catch (_) { fonte = sourceUrl; }
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(resumo, style: GoogleFonts.exo2(fontSize: 13, color: SIMEopsColors.white)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(data, style: GoogleFonts.exo2(fontSize: 11, color: SIMEopsColors.muted.withValues(alpha: 0.5))),
                    if (fonte != null) ...[
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => launchUrl(Uri.parse(sourceUrl!), mode: LaunchMode.externalApplication),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.open_in_new, size: 11, color: SIMEopsColors.teal.withValues(alpha: 0.7)),
                            const SizedBox(width: 3),
                            Text(fonte, style: GoogleFonts.exo2(fontSize: 11, color: SIMEopsColors.teal.withValues(alpha: 0.7))),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Helpers (identicos ao report_screen) ──

  Widget _sectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 4),
      child: Row(
        children: [
          Text(text.toUpperCase(), style: GoogleFonts.rajdhani(fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 2, color: SIMEopsColors.muted)),
          const SizedBox(width: 8),
          Expanded(child: Container(height: 1, color: SIMEopsColors.teal.withValues(alpha: 0.15))),
        ],
      ),
    );
  }

  Widget _rCard({required Widget child}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SIMEopsColors.navyMid.withValues(alpha: 0.95),
        border: Border.all(color: SIMEopsColors.teal.withValues(alpha: 0.15)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: child,
    );
  }

  Widget _statBox(String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: GoogleFonts.rajdhani(fontSize: 26, fontWeight: FontWeight.w700, color: SIMEopsColors.white)),
          Text(label.toUpperCase(), style: GoogleFonts.rajdhani(fontSize: 9, letterSpacing: 1, color: SIMEopsColors.muted.withValues(alpha: 0.6))),
        ],
      ),
    );
  }

  Widget _dividerV() {
    return Container(width: 1, height: 36, color: SIMEopsColors.teal.withValues(alpha: 0.15));
  }
}

class _SubCityChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _SubCityChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? SIMEopsColors.teal : SIMEopsColors.navyLight,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              color: selected ? Colors.white : SIMEopsColors.muted,
            ),
          ),
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

