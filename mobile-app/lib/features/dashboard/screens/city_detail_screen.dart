import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/models/crime_point.dart';
import '../../../core/models/executive_data.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/type_helpers.dart';
import '../../../core/widgets/crime_radar_map.dart';
import '../../../core/widgets/executive_indicators.dart';
import '../../../core/widgets/fontes_analisadas.dart';
import '../../../core/widgets/grid_background.dart';
import '../../../core/widgets/weekly_trend_bars.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
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

  // Radar de ocorrências — pontos vem do backend já geocodados
  List<CrimePoint> _mapPoints = [];
  bool _mapLoading = false;

  // Executive (indicadores + resumo) — cacheado no backend
  ExecutiveData _executive = ExecutiveData.empty();
  bool _executiveLoading = false;

  // For groups: selected sub-city filter
  String? _selectedSubCity;

  /// Janela da contagem no cabeçalho. Só muda o número exibido ali — o feed
  /// abaixo continua trazendo tudo, e o relatório tem o período dele.
  StatPeriod _statPeriod = StatPeriod.d30;

  /// Cabeçalho recolhido pela rolagem. Ver [_onScroll].
  bool _collapsed = false;

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
      // O caderno ativo é desenhado à mão (não é mais TabBar), então precisa
      // de rebuild — inclusive no arraste, que muda o índice sem passar pelo
      // onTap.
      if (mounted) setState(() {});
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
        _loadMapPoints();
        _loadTrend();
        _loadExecutive();
      }
    } catch (e) {
      debugPrint('[CityDetail] Relatorio error: $e');
      if (mounted) setState(() => _loadingOverview = false);
    }
  }

  Future<void> _loadExecutive() async {
    final estado = widget.city.parentState ?? '';
    if (estado.isEmpty) return;
    setState(() => _executiveLoading = true);
    try {
      final api = context.read<ApiService>();
      final raw = await api.getExecutive(
        cidade: _activeCidade,
        estado: estado,
        rangeDays: 30,
      );
      if (!mounted) return;
      setState(() {
        _executive = ExecutiveData.fromJson(raw);
        _executiveLoading = false;
      });
    } catch (e) {
      debugPrint('[CityDetail] Executive error: $e');
      if (mounted) setState(() => _executiveLoading = false);
      // Fail silent — seção some, não atrapalha o resto do relatório.
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
          // Backend retorna { dataPoints: [...] } via getCrimeTrend.
          // Antes lia 'trend' (campo inexistente) — chart ficava sempre vazio.
          _trend = trendData['dataPoints'] as List<dynamic>? ?? [];
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

  // Radar: backend geocoda + devolve lista pronta (CrimePoint).
  // Período: últimos 30 dias (coerente com _loadOverview).
  Future<void> _loadMapPoints() async {
    final cidade = _activeCidade;
    final estado = widget.city.parentState ?? '';
    if (estado.isEmpty) return;

    setState(() => _mapLoading = true);
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final d30 = now.subtract(const Duration(days: 30));
      final raw = await api.getMapPoints(
        cidade: cidade,
        estado: estado,
        dateFrom: _dateStr(d30),
        dateTo: _dateStr(now),
      );
      if (!mounted) return;
      setState(() {
        _mapPoints = raw.map(CrimePoint.fromJson).toList();
        _mapLoading = false;
      });
    } catch (e) {
      debugPrint('[CityDetail] Map points error: $e');
      if (mounted) setState(() => _mapLoading = false);
    }
  }

  void _onSubCityChanged(String? city) {
    setState(() => _selectedSubCity = city);
    _loadOverview();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _buildWireHeader(),
            if (_isGroup) _buildPlacesRow(),
            _buildCadernos(),
            Expanded(
              // Escuta a rolagem que SOBE dos filhos, sem tomar posse do
              // controller de nenhum deles. É o que permite o cabeçalho
              // encolher sem `NestedScrollView` + `SliverAppBar` — que
              // exigiria reescrever o `FeedScreen` e o `RefreshIndicator`
              // de cada aba, dois riscos por um ganho de layout.
              child: NotificationListener<ScrollNotification>(
                onNotification: _onScroll,
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    _buildFeedTab(),
                    _buildOverviewTab(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Encolhe o cabeçalho ao rolar, devolvendo ~85px de tela durante a leitura.
  ///
  /// Só rolagem **vertical**: o arrasto horizontal do `TabBarView` também
  /// emite `ScrollNotification`, e sem o filtro trocar de aba encolheria o
  /// cabeçalho. Histerese (56 pra fechar, 24 pra abrir) evita o tremor de
  /// abre-e-fecha quando a rolagem para exatamente no limiar.
  ///
  /// Devolve `false` de propósito: a notificação segue subindo, e o
  /// `RefreshIndicator` de cada aba continua funcionando.
  bool _onScroll(ScrollNotification n) {
    if (n.metrics.axis != Axis.vertical) return false;
    final p = n.metrics.pixels;
    if (!_collapsed && p > 56) {
      setState(() => _collapsed = true);
    } else if (_collapsed && p < 24) {
      setState(() => _collapsed = false);
    }
    return false;
  }

  /// Cabeçalho do fio: seta + marca, nome da praça em corpo grande, a contagem
  /// do período, e o filete branco de 2px que fecha o bloco.
  ///
  /// Substitui a `AppBar` centralizada. O nome da cidade é o dado mais
  /// importante da tela e estava a 18px no meio de uma barra de 56px; agora
  /// abre a página a 30px, ancorado à esquerda como manchete de primeira.
  ///
  /// **Saíram daqui em 08/08, e o motivo de cada um importa:**
  ///
  /// - `SC` — você chegou tocando um card que dizia `SC · GRANDE
  ///   FLORIANÓPOLIS`, e a fila logo abaixo nomeia as cidades.
  /// - `18 NOVAS` — o card do dashboard acabou de dizer, e o próprio feed
  ///   separa lida de não-lida pela tinta. Terceira aparição do mesmo fato.
  /// - `● ÚLTIMA HÁ 2H` — o ponto verde **nunca apagava**, e sinal que aparece
  ///   sempre não é sinal (foi por isso que o "NOVA" e o "1 FONTE" morreram).
  ///   Além disso a validade já está no conteúdo: o primeiro divisor diz
  ///   `HOJE · 04 AGO` e o primeiro item diz a hora. Jornal não carimba
  ///   "impresso há 2 horas" no cabeçalho.
  ///
  /// Sobrou uma linha de metadado, e ela é a única coisa clicável — o que
  /// também faz a setinha do período parar de disputar espaço com três textos
  /// mudos. Estado do sistema mora no dashboard, uma vez só.
  Widget _buildWireHeader() {
    final c = widget.city;

    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: SIMEopsColors.white, width: 2),
        ),
      ),
      padding: EdgeInsets.fromLTRB(18, _collapsed ? 2 : 8, 18, _collapsed ? 6 : 12),
      child: AnimatedSize(
        duration: const Duration(milliseconds: 170),
        curve: Curves.easeOut,
        alignment: Alignment.topCenter,
        child: _collapsed ? _headerCompact(c) : _headerFull(c),
      ),
    );
  }

  Widget _headerCompact(CityOverview c) {
    return Row(
      key: const ValueKey('compacto'),
      children: [
        _backButton(),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            c.name,
            style: SIMEopsType.titleCompact(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _headerFull(CityOverview c) {
    return Column(
      key: const ValueKey('inteiro'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _backButton(),
            const SizedBox(width: 4),
            Text.rich(
              TextSpan(children: [
                const TextSpan(text: 'SIME'),
                TextSpan(
                  text: 'OPS',
                  style: TextStyle(color: SIMEopsColors.greenLight),
                ),
              ]),
              style: SIMEopsType.wordmark(size: 14),
            ),
          ],
        ),
        const SizedBox(height: 9),
        Text(c.name, style: SIMEopsType.title()),
        const SizedBox(height: 9),
        _PeriodCount(
          city: c,
          period: _statPeriod,
          onPick: (p) => setState(() => _statPeriod = p),
        ),
      ],
    );
  }

  Widget _backButton() => InkWell(
        onTap: () => Navigator.of(context).pop(),
        child: const Padding(
          padding: EdgeInsets.all(8),
          child: Icon(Icons.arrow_back_ios_new,
              size: 17, color: SIMEopsColors.muted),
        ),
      );

  /// As cidades do grupo. Rola na horizontal com degradê na borda direita —
  /// sem ele o scroll é invisível e o usuário nunca descobre que existe
  /// cidade cortada (Grande Goiânia tem 7).
  Widget _buildPlacesRow() {
    final names = widget.city.cityNames ?? const <String>[];
    return SizedBox(
      height: 40,
      child: ShaderMask(
        shaderCallback: (rect) => const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [Colors.white, Colors.white, Colors.transparent],
          stops: [0, 0.9, 1],
        ).createShader(rect),
        blendMode: BlendMode.dstIn,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(18, 12, 34, 0),
          children: [
            _PlaceTab(
              label: 'Todas',
              selected: _selectedSubCity == null,
              onTap: () => _onSubCityChanged(null),
            ),
            ...names.map((c) => _PlaceTab(
                  label: c,
                  selected: _selectedSubCity == c,
                  onTap: () => _onSubCityChanged(c),
                )),
          ],
        ),
      ),
    );
  }

  /// Notícias | Relatório — em corpo de texto, não em caixa alta de `TabBar`.
  /// É a decisão mais permanente da tela e merece o maior peso depois do nome.
  Widget _buildCadernos() {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
      ),
      padding: const EdgeInsets.fromLTRB(18, 15, 18, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < 2; i++) ...[
            InkWell(
              onTap: () => setState(() => _tabController.animateTo(i)),
              child: Container(
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: _tabController.index == i
                          ? SIMEopsColors.greenLight
                          : Colors.transparent,
                      width: 2,
                    ),
                  ),
                ),
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  i == 0 ? 'Notícias' : 'Relatório',
                  style: SIMEopsType.tab(active: _tabController.index == i),
                ),
              ),
            ),
            if (i == 0) const SizedBox(width: 22),
          ],
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

            // Radar de ocorrências
            if (_mapPoints.isNotEmpty) ...[
              _sectionTitle('Mapa de Ocorrências'),
              _rCard(child: CrimeRadarMap(points: _mapPoints)),
            ] else if (_mapLoading) ...[
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
                        Text('Carregando mapa...', style: GoogleFonts.exo2(fontSize: 12, color: SIMEopsColors.muted)),
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

            // Indicadores da Região — agrupa: cards visuais (Executive) +
            // tendência temporal + estatísticas brutas. Tudo que é "métrica da
            // região" no mesmo lugar.
            _sectionTitle('Indicadores da Região'),
            // Cards de indicadores + resumo complementar + fontes (via GPT das estatísticas)
            ExecutiveIndicators(data: _executive, showHeader: false, loading: _executiveLoading),
            // Gráfico de tendência temporal com filtros
            _buildTrendWithFilters(),

            // (Estatísticas brutas individuais foram removidas — informação fica
            // condensada no resumo_complementar do Executive acima, sem poluir
            // o relatório com cards longos de texto.)

            // Fontes Analisadas (uniforme com report_screen da busca manual)
            _buildFontesAnalisadas(),

            const SizedBox(height: 24),
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
  // Cor e label vêm de category_colors.dart — este arquivo tinha uma TERCEIRA
  // tabela própria (Tailwind antigo), achada na auditoria de 08/08. O donut
  // pintava diferente do feed na mesma tela de cidade.

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
                      final color = categoryColor(e.key);
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
                final color = categoryColor(e.key);
                final label = categoryLabel(e.key);
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

  // ── Fontes Analisadas (uniforme com report_screen) ──
  // Backend retorna sources agrupados por hostname em /analytics/crime-summary:
  // [{ name, count, urls, type: 'oficial'|'midia' }]. Aqui só separa oficiais
  // de mídias, ordena por count, e joga no widget compartilhado.

  Widget _buildFontesAnalisadas() {
    final raw = (_summary?['sources'] as List<dynamic>?) ?? const [];
    if (raw.isEmpty) return const SizedBox.shrink();

    final oficiais = <Map<String, String>>[];
    final midias = <Map<String, String>>[];
    for (final s in raw) {
      final m = s as Map<String, dynamic>;
      final entry = <String, String>{
        'name': (m['name'] as String?) ?? '',
        'count': (m['count'] ?? 1).toString(),
      };
      if ((m['type'] as String?) == 'oficial') {
        oficiais.add(entry);
      } else {
        midias.add(entry);
      }
    }

    int cmp(Map<String, String> a, Map<String, String> b) =>
        int.parse(b['count']!).compareTo(int.parse(a['count']!));
    oficiais.sort(cmp);
    midias.sort(cmp);

    return FontesAnalisadas(oficiais: oficiais, midias: midias);
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
          // Bar chart semanal (widget compartilhado com report_screen)
          WeeklyTrendBars(
            data: (_trend ?? const [])
                .map((e) => e as Map<String, dynamic>)
                .toList(),
          ),
        ],
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

/// Janela da contagem do cabeçalho.
///
/// Só duas: o mês corrente e o acumulado. 60 e 90 dias existiram por uma
/// tarde e saíram — com quatro opções o menu virava uma decisão a tomar toda
/// vez, e ninguém precisa de granulação nesse número. Ele é orientação, não
/// análise; quem quer recorte fino vai no relatório.
enum StatPeriod {
  d30('30 dias', '30D'),
  all('Desde o início', 'TOTAL');

  const StatPeriod(this.label, this.short);
  final String label;
  final String short;

  int countOf(CityOverview c) => switch (this) {
        StatPeriod.d30 => c.totalCrimes30d,
        StatPeriod.all => c.totalCrimes,
      };
}

/// `107 EM 30D ▾` — toca e alterna entre o mês e o acumulado.
class _PeriodCount extends StatelessWidget {
  final CityOverview city;
  final StatPeriod period;
  final ValueChanged<StatPeriod> onPick;

  const _PeriodCount({
    required this.city,
    required this.period,
    required this.onPick,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<StatPeriod>(
      initialValue: period,
      onSelected: onPick,
      color: SIMEopsColors.navyLight,
      elevation: 0,
      shape: const RoundedRectangleBorder(
        side: BorderSide(color: SIMEopsColors.ruleStrong),
      ),
      position: PopupMenuPosition.under,
      tooltip: 'Janela da contagem',
      itemBuilder: (_) => [
        for (final p in StatPeriod.values)
          PopupMenuItem(
            value: p,
            height: 42,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    p.label,
                    style: SIMEopsType.placeTab(active: p == period),
                  ),
                ),
                const SizedBox(width: 18),
                Text(
                  '${p.countOf(city)}',
                  style: SIMEopsType.placeTab(active: false)
                      .copyWith(color: SIMEopsColors.faint),
                ),
              ],
            ),
          ),
      ],
      child: Padding(
        // Padding vertical dá alvo de toque de 44px numa linha de 12px de alto.
        padding: const EdgeInsets.symmetric(vertical: 15),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${period.countOf(city)} EM ${period.short}',
              style: SIMEopsType.slug(),
            ),
            const SizedBox(width: 2),
            const Icon(Icons.expand_more,
                size: 13, color: SIMEopsColors.muted),
          ],
        ),
      ),
    );
  }
}

/// Cidade do grupo. Era cápsula arredondada teal (`_SubCityChip`) — a peça
/// mais Material da tela. Vira rótulo em mono com filete embaixo: o mesmo
/// vocabulário das outras faixas de controle, e ocupa metade da altura.
class _PlaceTab extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _PlaceTab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 17),
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color:
                    selected ? SIMEopsColors.greenLight : Colors.transparent,
                width: 1.5,
              ),
            ),
          ),
          padding: const EdgeInsets.only(bottom: 4),
          child: Text(
            label.toUpperCase(),
            style: SIMEopsType.placeTab(active: selected),
          ),
        ),
      ),
    );
  }
}

// O `_LiveDot` (ponto verde que pulsava ao lado de "ÚLTIMA HÁ 2H") foi
// removido em 08/08, e vale registrar por quê, porque a tentação de trazer de
// volta é grande: ele nunca apagava. Um indicador que está sempre no mesmo
// estado não informa nada — é a mesma armadilha do "1 FONTE" e do selo "NOVA".
//
// Ele só ganharia o lugar de volta podendo ficar âmbar, e para isso precisa de
// um dado que hoje NÃO existe: a hora da última varredura. O que o app tem é
// `lastNewsAt`, o `created_at` da ocorrência mais recente — que mede a
// imprensa, não o robô. Construir semáforo de saúde em cima disso seria
// reintroduzir a mesma mentira que o rótulo "VARREDURA HÁ" já contou uma vez.
//
// Se um dia valer a pena: o backend precisa expor o timestamp do scan.

