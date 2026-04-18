import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/data/brazilian_locations.dart';
import '../../../core/services/api_service.dart';
import '../../../core/widgets/grid_background.dart';
import '../../../main.dart';
import '../widgets/multi_city_search_field.dart';
import '../../feed/widgets/news_card.dart';
import '../../feed/widgets/news_detail_sheet.dart';
import '../../../core/models/news_item.dart';
import 'report_screen.dart';

class ManualSearchScreen extends StatefulWidget {
  /// Se fornecido, retoma uma busca existente (do histórico).
  final String? resumeSearchId;

  const ManualSearchScreen({super.key, this.resumeSearchId});

  @override
  State<ManualSearchScreen> createState() => _ManualSearchScreenState();
}

class _ManualSearchScreenState extends State<ManualSearchScreen> {
  // Form
  String? _selectedEstado;
  Set<String> _selectedCidades = {};
  int _periodoDias = 30;
  bool _loadingLocations = true;

  // Search state
  String? _searchId;
  String? _reportId;
  String _searchStatus = 'idle'; // idle, processing, completed, failed
  List<Map<String, dynamic>> _results = [];
  Map<String, dynamic>? _progress;
  Timer? _pollTimer;
  DateTime? _searchStartTime;
  Timer? _elapsedTimer;
  String _elapsedText = '0s';
  final Map<int, String> _stageDetails = {};
  int _pollCount = 0;
  int _consecutiveErrors = 0;
  static const _maxPolls = 200; // ~10 min at 3s intervals
  static const _maxConsecutiveErrors = 5;

  static const _periodos = {
    30: 'Ultimos 30 dias',
    60: 'Ultimos 60 dias',
    90: 'Ultimos 90 dias',
  };

  @override
  void initState() {
    super.initState();
    _loadLocations();
    if (widget.resumeSearchId != null) {
      _resumeSearch(widget.resumeSearchId!);
    }
  }

  Future<void> _resumeSearch(String searchId) async {
    setState(() {
      _searchId = searchId;
      _searchStatus = 'loading';
    });

    try {
      final api = context.read<ApiService>();
      final status = await api.getManualSearchStatus(searchId);
      final s = status['status'] as String;

      // Recuperar params originais e report_id
      final params = status['params'] as Map<String, dynamic>?;
      final reportId = status['report_id'] as String?;
      if (mounted) {
        setState(() {
          _reportId = reportId;
          if (params != null) {
            _selectedEstado = params['estado'] as String?;
            final cidades = params['cidades'];
            if (cidades is List) {
              _selectedCidades = cidades.map((c) => c.toString()).toSet();
            }
            _periodoDias = (params['periodo_dias'] as num?)?.toInt() ?? 30;
          }
        });
      }

      if (s == 'completed') {
        final results = await api.getManualSearchResults(searchId);
        if (mounted) {
          setState(() {
            _searchStatus = 'completed';
            _results = results;
          });
        }
      } else if (s == 'failed') {
        if (mounted) setState(() => _searchStatus = 'failed');
      } else {
        // Realmente ainda processando — mostra pipeline + iniciar timer
        if (mounted) setState(() => _searchStatus = 'processing');
        _startElapsedTimer();
        _startPolling();
      }
    } catch (_) {
      if (mounted) {
        setState(() => _searchStatus = 'failed');
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Resultados expirados ou indisponiveis')),
        );
      }
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _elapsedTimer?.cancel();
    super.dispose();
  }

  void _startElapsedTimer() {
    _searchStartTime = DateTime.now();
    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _searchStartTime == null) return;
      final diff = DateTime.now().difference(_searchStartTime!);
      setState(() {
        if (diff.inMinutes > 0) {
          _elapsedText = '${diff.inMinutes}m ${diff.inSeconds % 60}s';
        } else {
          _elapsedText = '${diff.inSeconds}s';
        }
      });
    });
  }

  Future<void> _loadLocations() async {
    try {
      await BrazilianLocations.instance.load();
    } catch (_) {
      // Asset load failed - unlikely but handle gracefully
    }
    if (mounted) {
      setState(() => _loadingLocations = false);
    }
  }

  List<String> get _estados => BrazilianLocations.instance.getEstados();

  Future<void> _startSearch() async {
    if (_selectedEstado == null || _selectedCidades.isEmpty) return;

    final api = context.read<ApiService>();
    setState(() => _searchStatus = 'processing');

    try {
      final searchId = await api.triggerManualSearch(
        estado: _selectedEstado!,
        cidades: _selectedCidades.toList(),
        periodoDias: _periodoDias,
      );

      setState(() => _searchId = searchId);
      _startElapsedTimer();
      _startPolling();
    } catch (e) {
      setState(() => _searchStatus = 'failed');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao iniciar busca: $e')),
        );
      }
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollCount = 0;
    _consecutiveErrors = 0;
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      if (_searchId == null) return;

      _pollCount++;
      if (_pollCount > _maxPolls) {
        _pollTimer?.cancel();
        _elapsedTimer?.cancel();
        if (mounted) {
          setState(() => _searchStatus = 'failed');
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Busca demorou demais. Verifique o histórico.')),
          );
        }
        return;
      }

      final api = context.read<ApiService>();

      try {
        final status = await api.getManualSearchStatus(_searchId!);
        _consecutiveErrors = 0;
        final s = status['status'] as String;

        // Atualizar progresso da pipeline
        final progress = status['progress'] as Map<String, dynamic>?;
        if (mounted && progress != null) {
          final stageNum = progress['stage_num'] as int? ?? 0;
          final details = progress['details'] as String?;
          if (_progress != null) {
            final prevStage = _progress!['stage_num'] as int? ?? 0;
            final prevDetails = _progress!['details'] as String?;
            if (prevStage > 0 && prevStage < stageNum && prevDetails != null) {
              _stageDetails[prevStage] = prevDetails;
            }
          }
          if (details != null) {
            _stageDetails[stageNum] = details;
          }
          setState(() => _progress = progress);
        }

        if (s == 'completed' || s == 'failed') {
          _pollTimer?.cancel();
          _elapsedTimer?.cancel();

          if (s == 'completed') {
            final results = await api.getManualSearchResults(_searchId!);
            if (mounted) {
              setState(() {
                _searchStatus = 'completed';
                _results = results;
              });
            }
          } else {
            if (mounted) setState(() => _searchStatus = 'failed');
          }
        }
      } catch (e) {
        _consecutiveErrors++;
        debugPrint('[ManualSearch] Poll error #$_consecutiveErrors: $e');
        if (_consecutiveErrors >= _maxConsecutiveErrors) {
          _pollTimer?.cancel();
          _elapsedTimer?.cancel();
          if (mounted) {
            setState(() => _searchStatus = 'failed');
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Erro de conexão. Verifique o histórico.')),
            );
          }
        }
      }
    });
  }

  Future<void> _openReport() async {
    if (_selectedEstado == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ReportScreen(
          searchId: _searchId,
          cidades: _selectedCidades.isNotEmpty
              ? _selectedCidades.toList()
              : [_selectedEstado!],
          estado: _selectedEstado!,
          periodoDias: _periodoDias,
          results: _results,
        ),
      ),
    );
    _checkForReport();
  }

  Future<void> _checkForReport() async {
    if (_searchId == null) return;
    try {
      final api = context.read<ApiService>();
      final status = await api.getManualSearchStatus(_searchId!);
      final reportId = status['report_id'] as String?;
      if (reportId != null && mounted) {
        setState(() => _reportId = reportId);
      }
    } catch (e) { debugPrint('[ManualSearch] Check report error: $e'); }
  }

  void _resetSearch() {
    _pollTimer?.cancel();
    _elapsedTimer?.cancel();

    // Cancelar no backend se busca em andamento
    if (_searchId != null && (_searchStatus == 'processing' || _searchStatus == 'loading')) {
      final api = context.read<ApiService>();
      api.cancelSearch(_searchId!).catchError((e) {
        debugPrint('[ManualSearch] Cancel error: $e');
      });
    }

    setState(() {
      _searchId = null;
      _reportId = null;
      _searchStatus = 'idle';
      _results = [];
      _progress = null;
      _searchStartTime = null;
      _elapsedText = '0s';
      _stageDetails.clear();
      _pollCount = 0;
      _consecutiveErrors = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      appBar: AppBar(
        title: Text('NOVA BUSCA',
            style: GoogleFonts.rajdhani(
              fontWeight: FontWeight.w700,
              letterSpacing: 1.5,
            )),
      ),
      body: _searchStatus == 'idle'
          ? GridBackground(child: _buildForm())
          : _searchStatus == 'loading'
              ? const Center(child: CircularProgressIndicator())
              : _buildResults(),
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: GoogleFonts.rajdhani(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.8,
          color: SIMEopsColors.muted.withValues(alpha: 0.7),
        ),
      ),
    );
  }

  Widget _buildForm() {
    if (_loadingLocations) {
      return const Center(child: CircularProgressIndicator());
    }

    final canSearch = _selectedEstado != null && _selectedCidades.isNotEmpty;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 120),
      children: [
        // ESTADO
        _sectionLabel('ESTADO'),
        DropdownButtonFormField<String>(
          key: const ValueKey('estado'),
          value: _selectedEstado,
          decoration: InputDecoration(
            hintText: 'Selecione o estado',
            prefixIcon: Icon(Icons.map_outlined,
                color: SIMEopsColors.teal.withValues(alpha: 0.6), size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          isExpanded: true,
          items: _estados
              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
              .toList(),
          onChanged: (v) => setState(() {
            _selectedEstado = v;
            _selectedCidades = {};
          }),
        ),
        const SizedBox(height: 18),

        // CIDADES
        _sectionLabel('CIDADES'),
        MultiCitySearchField(
          key: ValueKey(_selectedEstado),
          estadoNome: _selectedEstado,
          onChanged: (cidades) {
            setState(() => _selectedCidades = cidades);
          },
        ),
        const SizedBox(height: 18),

        // PERIODO — chips
        _sectionLabel('PERIODO'),
        Wrap(
          spacing: 8,
          children: _periodos.entries.map((e) {
            final selected = _periodoDias == e.key;
            return ChoiceChip(
              label: Text('${e.key} dias'),
              selected: selected,
              onSelected: (_) => setState(() => _periodoDias = e.key),
              selectedColor: SIMEopsColors.teal.withValues(alpha: 0.15),
              side: BorderSide(
                color: selected
                    ? SIMEopsColors.teal
                    : SIMEopsColors.teal.withValues(alpha: 0.15),
              ),
              labelStyle: GoogleFonts.exo2(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: selected ? SIMEopsColors.tealLight : SIMEopsColors.muted,
              ),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20)),
              backgroundColor: SIMEopsColors.navyLight.withValues(alpha: 0.8),
            );
          }).toList(),
        ),
        const SizedBox(height: 28),

        // INICIAR BUSCA
        SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton(
            onPressed: canSearch ? _startSearch : null,
            style: FilledButton.styleFrom(
              backgroundColor:
                  canSearch ? SIMEopsColors.teal : SIMEopsColors.navyLight,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(
              'INICIAR BUSCA',
              style: GoogleFonts.rajdhani(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 2,
                color: canSearch
                    ? Colors.white
                    : SIMEopsColors.muted.withValues(alpha: 0.4),
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),

        // Disclaimer
        Text(
          'A busca analisa notícias públicas e pode levar alguns instantes.',
          textAlign: TextAlign.center,
          style: GoogleFonts.exo2(
            fontSize: 12,
            color: SIMEopsColors.muted.withValues(alpha: 0.5),
          ),
        ),
      ],
    );
  }

  static const _pipelineStages = [
    ('searching', 'Pesquisando na web', Icons.travel_explore),
    ('filter0', 'Filtro de relevância', Icons.filter_list),
    ('filter1', 'Análise de títulos (IA)', Icons.smart_toy),
    ('fetching', 'Baixando artigos', Icons.cloud_download),
    ('analyzing', 'Extraindo dados (IA)', Icons.psychology),
    ('dedup', 'Consolidando resultados', Icons.compress),
    ('saving', 'Salvando', Icons.check_circle),
  ];

  Widget _buildProgressStepper() {
    final currentStageNum = (_progress?['stage_num'] as int?) ?? 0;
    final details = _progress?['details'] as String?;
    final progressValue = currentStageNum / _pipelineStages.length;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Processando busca...',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              _elapsedText,
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey[500],
              ),
            ),
            const SizedBox(height: 16),
            // Progress bar geral
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: progressValue),
                duration: const Duration(milliseconds: 500),
                builder: (_, value, __) => LinearProgressIndicator(
                  value: value,
                  minHeight: 6,
                ),
              ),
            ),
            const SizedBox(height: 24),
            ...List.generate(_pipelineStages.length, (index) {
              final (_, label, icon) = _pipelineStages[index];
              final stageNum = index + 1;
              final isCompleted = stageNum < currentStageNum;
              final isCurrent = stageNum == currentStageNum;
              final isPending = stageNum > currentStageNum;
              final stageDetail = _stageDetails[stageNum];

              final color = isCompleted
                  ? Colors.green
                  : isCurrent
                      ? Theme.of(context).colorScheme.primary
                      : Colors.grey[400]!;

              return AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                child: Row(
                  children: [
                    if (isCompleted)
                      AnimatedScale(
                        scale: 1.0,
                        duration: const Duration(milliseconds: 300),
                        child: Icon(Icons.check_circle, color: color, size: 28),
                      )
                    else if (isCurrent)
                      SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: color,
                        ),
                      )
                    else
                      Icon(Icons.circle_outlined, color: color, size: 28),
                    const SizedBox(width: 12),
                    Icon(icon, color: color, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label,
                            style: TextStyle(
                              color: isPending ? Colors.grey[500] : null,
                              fontWeight: isCurrent ? FontWeight.bold : null,
                            ),
                          ),
                          if (isCurrent && details != null)
                            AnimatedOpacity(
                              opacity: 1.0,
                              duration: const Duration(milliseconds: 200),
                              child: Text(
                                details,
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Theme.of(context).colorScheme.primary,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          if (isCompleted && stageDetail != null)
                            Text(
                              stageDetail,
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey[500],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: _resetSearch,
              child: const Text('Cancelar'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResults() {
    if (_searchStatus == 'processing') {
      return _buildProgressStepper();
    }

    if (_searchStatus == 'failed') {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.red),
            const SizedBox(height: 16),
            const Text('A busca falhou'),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: _resetSearch,
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      );
    }

    // completed
    return Column(
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_results.length} resultado${_results.length != 1 ? 's' : ''} encontrado${_results.length != 1 ? 's' : ''}',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: _resetSearch,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Nova busca'),
                  ),
                ],
              ),
              if (_results.isNotEmpty) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: _reportId != null
                      ? FilledButton.icon(
                          onPressed: () => _openReport(),
                          icon: const Icon(Icons.description),
                          label: const Text('Ver Relatório de Risco'),
                        )
                      : FilledButton.tonalIcon(
                          onPressed: (_selectedEstado != null) ? () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => ReportScreen(
                                  searchId: _searchId,
                                  cidades: _selectedCidades.isNotEmpty
                                      ? _selectedCidades.toList()
                                      : [_selectedEstado!],
                                  estado: _selectedEstado!,
                                  periodoDias: _periodoDias,
                                  results: _results,
                                ),
                              ),
                            );
                            // Após voltar da tela de relatório, checar se foi gerado
                            _checkForReport();
                          } : null,
                          icon: const Icon(Icons.bar_chart),
                          label: const Text('Gerar Relatório de Risco'),
                        ),
                ),
              ],
            ],
          ),
        ),
        // Results list
        Expanded(
          child: _results.isEmpty
              ? Center(
                  child: Text(
                    'Nenhuma notícia encontrada para os filtros selecionados',
                    style: TextStyle(color: Colors.grey[500]),
                    textAlign: TextAlign.center,
                  ),
                )
              : ListView.builder(
                  itemCount: _results.length,
                  itemBuilder: (context, index) {
                    final item = NewsItem.fromSearchResult(_results[index]);
                    return NewsCard(
                      news: item,
                      onTap: () => NewsDetailSheet.show(context, item),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

