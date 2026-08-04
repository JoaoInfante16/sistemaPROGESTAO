import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/models/crime_point.dart';
import '../../../core/models/executive_data.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/widgets/crime_radar_map.dart';
import '../../../core/widgets/executive_indicators.dart';
import '../../../core/widgets/fontes_analisadas.dart';
import '../../../core/widgets/weekly_trend_bars.dart';
import '../../../core/theme/simeops_colors.dart';

class ReportScreen extends StatefulWidget {
  final String? searchId;
  final List<String> cidades;
  final String estado;
  final int periodoDias;
  final List<Map<String, dynamic>> results;
  // Balde fora_do_periodo cru — itens mais antigos que a janela pedida, que a
  // busca coletou no caminho. É o pool do re-fatiamento "+ antigas".
  final List<Map<String, dynamic>> foraDoPeriodo;

  /// Balde `regiao` — ocorrências de município vizinho.
  ///
  /// Até 03/08 este relatório **nem recebia** esta lista: ela sumia sem aviso,
  /// que é a pior das opções (some do total e o usuário não sabe que sumiu).
  /// Agora entra como toggle, simétrico ao "+ antigas".
  final List<Map<String, dynamic>> regiao;

  /// Até quantos dias atrás o "+ antigas" pode alcançar — é a config
  /// `manual_search_horizon_days` do backend (180). Fica explícito na tela
  /// porque um relatório de 30 dias com "+antigas" ligado pode conter matéria
  /// de cinco meses atrás, e isso precisa estar escrito.
  final int horizonteDias;

  const ReportScreen({
    super.key,
    this.searchId,
    required this.cidades,
    required this.estado,
    required this.periodoDias,
    required this.results,
    this.foraDoPeriodo = const [],
    this.regiao = const [],
    this.horizonteDias = 180,
  });

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  bool _generatingLink = false;

  // Recorte client-side — re-fatiar é de graça, o dado já veio na busca.
  // null = período completo pedido; _includeOld inclui o balde fora_do_periodo.
  int? _sliceDias;
  bool _includeOld = false;
  /// Inclui o balde de município vizinho nos números do relatório.
  bool _includeRegiao = false;
  final Set<String> _cats = {};

  // Computed — função do recorte, recalculado a cada setState de filtro
  // (era late final, calculado 1x no initState sem filtro nenhum).
  Map<String, int> _crimeTypeCounts = {};
  Map<String, int> _categoryCounts = {};
  Map<String, int> _bairroCounts = {};
  List<Map<String, dynamic>> _byDate = [];
  int _totalOcorrencias = 0;
  int _totalEstatisticas = 0;
  List<Map<String, dynamic>> _estatisticas = [];
  List<Map<String, String>> _sourcesOficial = [];
  List<Map<String, String>> _sourcesMedia = [];

  // Radar — pontos vêm do backend já geocodados
  List<CrimePoint> _mapPoints = [];
  bool _mapLoading = true;

  // Executive (indicadores + resumo) — backend cacheia por cidade+estado+range
  ExecutiveData _executive = ExecutiveData.empty();
  bool _executiveLoading = false;

  @override
  void initState() {
    super.initState();
    _computeAnalytics();
    _loadMapPoints();
    _loadExecutive();
  }

  Future<void> _loadExecutive() async {
    if (widget.cidades.isEmpty || widget.estado.isEmpty) return;
    if (_estatisticas.isEmpty) return; // sem estatísticas no período → seção some

    setState(() => _executiveLoading = true);
    try {
      final api = context.read<ApiService>();
      final stats = _estatisticas
          .map((s) => <String, dynamic>{
                'resumo': s['resumo'] ?? '',
                'data_ocorrencia': s['data_ocorrencia'] ?? '',
                'source_url': s['source_url'] ?? s['url'],
              })
          .where((s) => (s['resumo'] as String).isNotEmpty)
          .toList();

      if (stats.isEmpty) {
        if (mounted) setState(() => _executiveLoading = false);
        return;
      }

      final raw = await api.getExecutiveFromStats(
        cidade: widget.cidades.first,
        estado: widget.estado,
        rangeDays: widget.periodoDias,
        estatisticas: stats,
        searchId: widget.searchId,
      );
      if (!mounted) return;
      setState(() {
        _executive = ExecutiveData.fromJson(raw);
        _executiveLoading = false;
      });
    } catch (e) {
      debugPrint('[Report] Executive error: $e');
      if (mounted) setState(() => _executiveLoading = false);
      // Fail silent — seção some, não atrapalha relatório.
    }
  }

  String _dateStr(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  // ⚠️ Mapa e executivo seguem o recorte FIXO da busca (armadilha 6.5 do
  // briefing): o geocode roda contra a cidade da requisição — re-fatiar o
  // mapa client-side pintaria bairro de Camaçari dentro de Salvador.
  Future<void> _loadMapPoints() async {
    if (widget.cidades.isEmpty) {
      if (mounted) setState(() => _mapLoading = false);
      return;
    }
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final from = now.subtract(Duration(days: widget.periodoDias));

      // Busca manual com searchId → backend lê de search_results.
      // Sem searchId (caso manual ad-hoc) → lê de news pelo período.
      final raw = await api.getMapPoints(
        cidade: widget.cidades.first,
        estado: widget.estado,
        dateFrom: _dateStr(from),
        dateTo: _dateStr(now),
        searchId: widget.searchId,
      );
      if (!mounted) return;
      setState(() {
        _mapPoints = raw.map(CrimePoint.fromJson).toList();
        _mapLoading = false;
      });
    } catch (e) {
      debugPrint('[Report] Map points error: $e');
      if (mounted) setState(() => _mapLoading = false);
    }
  }

  // Pool com o recorte de PERÍODO aplicado (categoria é aplicada depois,
  // dentro do _computeAnalytics, pra o donut continuar mostrando todas).
  List<Map<String, dynamic>> get _dateSubset {
    final pool = [
      ...widget.results,
      if (_includeOld) ...widget.foraDoPeriodo,
      if (_includeRegiao) ...widget.regiao,
    ];
    final dias = _sliceDias;
    if (dias == null) return pool;

    final now = DateTime.now();
    final cut = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: dias));
    return pool.where((r) {
      final d = DateTime.tryParse(r['data_ocorrencia'] as String? ?? '');
      return d == null || !d.isBefore(cut);
    }).toList();
  }

  /// `Kobrasol` para a cidade pedida, `Centro · Aparecida de Goiânia` para
  /// vizinha. Comparação sem acento/caixa porque o Filter2 devolve o nome como
  /// veio no texto da matéria.
  String _rotuloBairro(String bairro, Map<String, dynamic> r) {
    final cidade = (r['cidade'] as String? ?? '').trim();
    if (cidade.isEmpty) return bairro;

    String normal(String s) => s.toLowerCase().trim();
    final ehPedida = widget.cidades.any((c) => normal(c) == normal(cidade));
    return ehPedida ? bairro : '$bairro · $cidade';
  }

  void _computeAnalytics() {
    final subset = _dateSubset;

    _crimeTypeCounts = {};
    _categoryCounts = {};
    _bairroCounts = {};
    final dateCounts = <String, int>{};
    final estatisticas = <Map<String, dynamic>>[];
    int ocorrencias = 0;

    bool inCats(Map<String, dynamic> r) =>
        _cats.isEmpty ||
        _cats.contains(r['categoria_grupo'] as String? ?? 'institucional');

    for (final r in subset) {
      final natureza = r['natureza'] as String? ?? 'ocorrencia';

      if (natureza == 'estatistica') {
        estatisticas.add(r);
        continue;
      }

      // Donut vê todas as categorias do período (senão uma categoria
      // filtrada some da legenda e não dá pra reativar).
      final categoria = r['categoria_grupo'] as String? ?? 'institucional';
      _categoryCounts[categoria] = (_categoryCounts[categoria] ?? 0) + 1;

      if (!inCats(r)) continue;

      ocorrencias++;
      final tipo = r['tipo_crime'] as String? ?? 'outros';
      _crimeTypeCounts[tipo] = (_crimeTypeCounts[tipo] ?? 0) + 1;

      final bairro = r['bairro'] as String?;
      if (bairro != null && bairro.isNotEmpty) {
        // Bairro de município vizinho leva o nome da cidade junto. Sem isso,
        // com "+ região" ligado um bairro de Aparecida de Goiânia entrava no
        // ranking como se fosse de Goiânia — e o ranking de bairros é
        // exatamente o que alguém lê pra decidir onde reforçar operação.
        _bairroCounts[_rotuloBairro(bairro, r)] =
            (_bairroCounts[_rotuloBairro(bairro, r)] ?? 0) + 1;
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

    // Fontes: agrupa por hostname (mesmo veiculo com N materias vira 1 linha com count).
    final officialPattern = RegExp(
        r'\.gov\.br|\.ssp\.|\.seguranca\.|\.sesp\.|\.sspds\.|\.sejusp\.|\.segup\.',
        caseSensitive: false);
    final hostCountOficial = <String, int>{};
    final hostCountMedia = <String, int>{};

    for (final r in subset) {
      if (!inCats(r)) continue;
      final url = r['source_url'] as String? ?? r['url'] as String? ?? '';
      if (url.isEmpty) continue;
      String host;
      try {
        host = Uri.parse(url).host;
      } catch (_) {
        host = url;
      }
      if (officialPattern.hasMatch(url)) {
        hostCountOficial[host] = (hostCountOficial[host] ?? 0) + 1;
      } else {
        hostCountMedia[host] = (hostCountMedia[host] ?? 0) + 1;
      }
    }
    _sourcesOficial = hostCountOficial.entries
        .map((e) => {'name': e.key, 'count': e.value.toString()})
        .toList()
      ..sort((a, b) => int.parse(b['count']!).compareTo(int.parse(a['count']!)));
    _sourcesMedia = hostCountMedia.entries
        .map((e) => {'name': e.key, 'count': e.value.toString()})
        .toList()
      ..sort((a, b) => int.parse(b['count']!).compareTo(int.parse(a['count']!)));
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
                      final color = categoryColor(e.key);
                      final dimmed =
                          _cats.isNotEmpty && !_cats.contains(e.key);
                      return PieChartSectionData(
                        value: e.value.toDouble(),
                        color: color.withValues(alpha: dimmed ? 0.25 : 1),
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
                final color = categoryColor(e.key);
                final label = categoryLabel(e.key);
                final dimmed = _cats.isNotEmpty && !_cats.contains(e.key);
                // Tocar aplica o recorte: bairros, tendência e fontes viram
                // função da(s) categoria(s) selecionada(s).
                return InkWell(
                  onTap: () => setState(() {
                    if (!_cats.add(e.key)) _cats.remove(e.key);
                    _computeAnalytics();
                  }),
                  borderRadius: BorderRadius.circular(6),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Opacity(
                      opacity: dimmed ? 0.4 : 1,
                      child: Row(
                        children: [
                          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                          const SizedBox(width: 8),
                          Expanded(child: Text(label, style: GoogleFonts.exo2(fontSize: 12, color: SIMEopsColors.muted))),
                          Text('${e.value}', style: GoogleFonts.rajdhani(fontSize: 14, fontWeight: FontWeight.w700, color: SIMEopsColors.white)),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  String get _periodoLabel {
    if (_includeOld) return 'Tudo coletado';
    final d = _sliceDias ?? widget.periodoDias;
    return 'Ultimos $d dias';
  }

  /// O que está dentro deste relatório, em datas e cidades — não em adjetivos.
  ///
  /// ⚠️ ISTO EXISTE PORQUE O RELATÓRIO PODIA MENTIR SEM QUERER. Ligado o
  /// "+ antigas", um relatório pedido de 30 dias passava a conter matéria de
  /// até **180 dias** atrás (`manual_search_horizon_days`), e nada — nem o
  /// donut, nem o ranking de bairro, nem o total — dizia isso. É um documento
  /// que o cliente manda pra outra pessoa; ele tem que declarar o próprio
  /// recorte.
  Widget _buildRecorteDeclarado() {
    final hoje = DateTime.now();
    final dias = _sliceDias ?? widget.periodoDias;
    final inicio = hoje.subtract(Duration(days: dias));
    final f = DateFormat('dd/MM/yyyy');

    final linhas = <(IconData, String, Color)>[
      (
        Icons.event_available,
        '${f.format(inicio)} a ${f.format(hoje)}  ·  $dias dias',
        SIMEopsColors.tealLight,
      ),
      (
        Icons.location_city,
        widget.cidades.join(', '),
        SIMEopsColors.tealLight,
      ),
    ];

    if (_includeOld && widget.foraDoPeriodo.isNotEmpty) {
      linhas.add((
        Icons.history,
        '+ ${widget.foraDoPeriodo.length} anteriores a ${f.format(inicio)} '
            '(até ${widget.horizonteDias} dias atrás)',
        const Color(0xFFF59E0B),
      ));
    }

    if (_includeRegiao && widget.regiao.isNotEmpty) {
      linhas.add((
        Icons.travel_explore,
        '+ ${widget.regiao.length} de ${_cidadesDaRegiao()}',
        const Color(0xFFF59E0B),
      ));
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: SIMEopsColors.navyLight.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SIMEopsColors.teal.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final (icone, texto, cor) in linhas)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icone, size: 14, color: cor.withValues(alpha: 0.85)),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      texto,
                      style: GoogleFonts.exo2(
                        fontSize: 12,
                        height: 1.35,
                        color: cor == SIMEopsColors.tealLight
                            ? SIMEopsColors.muted
                            : cor,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  /// Municípios distintos presentes no balde de região, pra dizer QUAIS são.
  /// "8 da região metropolitana" não informa; "8 de Aparecida de Goiânia,
  /// Senador Canedo e mais 1" informa.
  String _cidadesDaRegiao() {
    final nomes = <String>{};
    for (final r in widget.regiao) {
      final c = (r['cidade'] as String? ?? '').trim();
      if (c.isNotEmpty) nomes.add(c);
    }
    if (nomes.isEmpty) return 'municípios vizinhos';
    final lista = nomes.toList()..sort();
    if (lista.length <= 2) return lista.join(' e ');
    return '${lista.take(2).join(', ')} e mais ${lista.length - 2}';
  }

  Widget _buildSliceChips() {
    final presets = const [7, 15, 30, 60, 90]
        .where((d) => d < widget.periodoDias)
        .toList();
    final hasOld = widget.foraDoPeriodo.isNotEmpty;
    final hasRegiao = widget.regiao.isNotEmpty;
    if (presets.isEmpty && !hasOld && !hasRegiao) {
      return const SizedBox.shrink();
    }

    // Data de corte do recorte atual — o rótulo do "+antigas" fala em data
    // concreta, não em "antigas". Adjetivo não deixa ninguém auditar nada.
    final corte = DateTime.now()
        .subtract(Duration(days: _sliceDias ?? widget.periodoDias));
    final corteLabel = DateFormat('dd/MM').format(corte);

    ChoiceChip chip(String label, bool selected, VoidCallback apply) {
      return ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => setState(() {
          apply();
          _computeAnalytics();
        }),
        selectedColor: SIMEopsColors.teal.withValues(alpha: 0.15),
        side: BorderSide(
          color: selected
              ? SIMEopsColors.teal
              : SIMEopsColors.teal.withValues(alpha: 0.15),
        ),
        labelStyle: GoogleFonts.exo2(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: selected ? SIMEopsColors.tealLight : SIMEopsColors.muted,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: SIMEopsColors.navyLight.withValues(alpha: 0.8),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (final d in presets)
            chip('${d}d', _sliceDias == d && !_includeOld, () {
              _sliceDias = d;
              _includeOld = false;
            }),
          chip('${widget.periodoDias}d', _sliceDias == null && !_includeOld,
              () {
            _sliceDias = null;
            _includeOld = false;
          }),
          // "+ 34 anteriores a 12/07" em vez de "+ antigas (34)": o usuário
          // precisa saber ATÉ ONDE vai, porque o horizonte é de 180 dias e um
          // relatório de 30 pode acabar com matéria de cinco meses atrás.
          if (hasOld)
            chip(
              '+ ${widget.foraDoPeriodo.length} anteriores a $corteLabel',
              _includeOld,
              () {
                _sliceDias = null;
                _includeOld = true;
              },
            ),
          // Toggle simétrico ao de antigas. Antes de 03/08 este balde nem
          // chegava ao relatório: sumia dos números sem uma linha dizendo.
          if (hasRegiao)
            chip(
              '+ ${widget.regiao.length} da região',
              _includeRegiao,
              () => _includeRegiao = !_includeRegiao,
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

      // reportUrl vem 100% do backend (baseado em ADMIN_PANEL_URL por ambiente).
      // Antes tinha fallback hardcoded pra staging admin, que causava misdirect
      // silencioso quando env var faltava no backend.
      final url = response['reportUrl'] as String?;
      if (url == null || url.isEmpty) {
        throw Exception('Backend não retornou reportUrl. Verifique ADMIN_PANEL_URL no servidor.');
      }

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
        title: Text('RELATÓRIO DE RISCO',
            style: GoogleFonts.rajdhani(
                fontWeight: FontWeight.w700, letterSpacing: 1.5, fontSize: 16)),
        actions: [
          IconButton(
            tooltip: 'Compartilhar relatório',
            onPressed: _generatingLink ? null : _generateAndShareLink,
            icon: _generatingLink
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.share),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
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
                          _periodoLabel,
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

              // O RECORTE, ESCRITO. Vem antes dos chips de propósito: quem lê
              // o relatório precisa saber o que está dentro dele ANTES de ver
              // qualquer número.
              _buildRecorteDeclarado(),

              // Re-fatiamento por período — client-side, custo zero
              _buildSliceChips(),

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

              // Radar de ocorrências
              if (_mapPoints.isNotEmpty) ...[
                _sectionTitle('Mapa de Ocorrências'),
                _card(child: CrimeRadarMap(points: _mapPoints)),
              ] else if (_mapLoading) ...[
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
                          Text('Carregando mapa...',
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

              // Indicadores da Regiao: Executive (cards + resumo + fontes) + tendencia.
              // Estatisticas brutas individuais ficam cobertas pelo resumo_complementar
              // do Executive — evita duplicar info em cards de texto longos.
              if (_executiveLoading || !_executive.isEmpty || _byDate.length > 1) ...[
                _sectionTitle('Indicadores da Região'),
                ExecutiveIndicators(
                  data: _executive,
                  showHeader: false,
                  loading: _executiveLoading,
                ),
                if (_byDate.length > 1)
                  _card(
                    child: WeeklyTrendBars(
                      data: aggregateByWeek(_byDate),
                    ),
                  ),
              ],

              // Fontes analisadas (widget compartilhado com city_detail)
              FontesAnalisadas(oficiais: _sourcesOficial, midias: _sourcesMedia),
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

}

