import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/data/brazilian_locations.dart';
import '../../../core/services/api_service.dart';
import '../../../core/widgets/grid_background.dart';
import '../../../core/widgets/simeops_title.dart';
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
  // Timestamp de quando cada stage começou — usado pra mostrar
  // [HH:MM:SS] + duração por stage na progress view.
  final Map<int, DateTime> _stageStartTimes = {};
  int _pollCount = 0;
  int _consecutiveErrors = 0;
  static const _maxPolls = 200; // ~10 min at 3s intervals
  // 20 erros * 3s = 60s de tolerância — cobre cold-start do Render e flaps
  // de rede transitórios. Antes era 5 (~15s) → dava "Erro de conexão" falso
  // quando user retomava busca via histórico durante warm-up do backend.
  static const _maxConsecutiveErrors = 20;

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
        // Realmente ainda processando — reconstrói cronologia dos stages
        // anteriores a partir do history persistido, depois inicia polling.
        final progress = status['progress'] as Map<String, dynamic>?;
        if (progress != null) _ingestProgressHistory(progress);
        if (mounted) {
          setState(() {
            _searchStatus = 'processing';
            _progress = progress;
          });
        }
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
    // Preserva _searchStartTime se já foi setado por _ingestProgressHistory
    // (caso do resume — cronômetro precisa refletir o início real, não agora).
    _searchStartTime ??= DateTime.now();
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

  // Popula _stageStartTimes + _stageDetails do `history` persistido no backend.
  // Roda tanto no polling normal quanto no _resumeSearch — quando user volta
  // via histórico, reconstrói a cronologia completa dos stages anteriores.
  void _ingestProgressHistory(Map<String, dynamic> progress) {
    final history = progress['history'] as List<dynamic>?;
    if (history == null) return;

    for (final raw in history) {
      if (raw is! Map) continue;
      final n = (raw['stage_num'] as num?)?.toInt();
      if (n == null) continue;

      final startedStr = raw['started_at'] as String?;
      if (startedStr != null && !_stageStartTimes.containsKey(n)) {
        final parsed = DateTime.tryParse(startedStr);
        if (parsed != null) _stageStartTimes[n] = parsed.toLocal();
      }

      final d = raw['details'] as String?;
      if (d != null) _stageDetails[n] = d;
    }

    // Se ainda não temos _searchStartTime (user retomou via histórico),
    // adota o timestamp do stage 1 pra cronômetro bater com o real.
    final s1 = _stageStartTimes[1];
    if (s1 != null && _searchStartTime == null) {
      _searchStartTime = s1;
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
          _ingestProgressHistory(progress);
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
          // Sem sucesso após 60s — provavelmente o backend tá fora do ar.
          // Pausa polling mas NÃO marca como failed (a busca pode estar
          // rodando bem no backend; só a conexão client→server tá ruim).
          // Mensagem orienta user a voltar depois pelo histórico.
          _pollTimer?.cancel();
          _elapsedTimer?.cancel();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Sem conexão com o servidor. Volte ao histórico quando terminar.')),
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
      _stageStartTimes.clear();
      _pollCount = 0;
      _consecutiveErrors = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    // Título contextual: "NOVA BUSCA" só quando o user está preenchendo o form
    // (estado idle). Assim que a busca inicia ou ao ver resultados (inclusive de
    // busca anterior via histórico), usa a marca SIMEops — padrão do main_screen.
    final isFormView = _searchStatus == 'idle';

    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      appBar: AppBar(
        title: isFormView
            ? const Text('NOVA BUSCA') // herda style do AppBarTheme (main.dart)
            : const SimeopsTitle(),
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

  // Formata Duration como "2.3s", "1m 12s", "0.4s"
  String _fmtDuration(Duration d) {
    if (d.inSeconds < 60) {
      final seconds = d.inMilliseconds / 1000;
      return '${seconds.toStringAsFixed(seconds < 10 ? 1 : 0)}s';
    }
    final m = d.inMinutes;
    final s = d.inSeconds - m * 60;
    return s > 0 ? '${m}m ${s}s' : '${m}m';
  }

  // "[14:47:15]" — formato monospace estilo log
  String _fmtTimestamp(DateTime t) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '[${two(t.hour)}:${two(t.minute)}:${two(t.second)}]';
  }

  // Duração de cada stage concluído (tempo até próximo começar).
  // Stage corrente: agora - início. Pendente: null.
  Duration? _stageDuration(int stageNum, int currentStageNum) {
    final start = _stageStartTimes[stageNum];
    if (start == null) return null;
    if (stageNum < currentStageNum) {
      final nextStart = _stageStartTimes[stageNum + 1];
      if (nextStart != null) return nextStart.difference(start);
    }
    if (stageNum == currentStageNum) {
      return DateTime.now().difference(start);
    }
    return null;
  }

  Widget _metadataCard(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: SIMEopsColors.navyLight.withValues(alpha: 0.6),
          border: Border.all(color: SIMEopsColors.teal.withValues(alpha: 0.15)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: GoogleFonts.rajdhani(
                fontSize: 10,
                color: SIMEopsColors.muted.withValues(alpha: 0.7),
                letterSpacing: 1.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 14,
                color: SIMEopsColors.tealLight,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stageIndicator({required bool done, required bool current}) {
    final color = done
        ? SIMEopsColors.teal
        : current
            ? SIMEopsColors.tealLight
            : SIMEopsColors.muted.withValues(alpha: 0.3);
    if (done) {
      return Container(
        width: 14,
        height: 14,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
    }
    if (current) {
      return SizedBox(
        width: 14,
        height: 14,
        child: CircularProgressIndicator(strokeWidth: 2, color: color),
      );
    }
    return Container(
      width: 14,
      height: 14,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color, width: 1.5),
      ),
    );
  }

  Widget _buildProgressStepper() {
    final currentStageNum = (_progress?['stage_num'] as int?) ?? 0;
    final totalStages = _pipelineStages.length;
    final progressValue = currentStageNum / totalStages;
    final stageCounter = currentStageNum > 0 ? '$currentStageNum/$totalStages' : '—';

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header com metadata
          Row(
            children: [
              _metadataCard('ETAPA', stageCounter),
              const SizedBox(width: 8),
              _metadataCard('TEMPO', _elapsedText),
            ],
          ),
          const SizedBox(height: 20),

          // Progress bar central
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progressValue),
              duration: const Duration(milliseconds: 500),
              builder: (_, value, __) => LinearProgressIndicator(
                value: value,
                minHeight: 4,
                backgroundColor: SIMEopsColors.navyLight.withValues(alpha: 0.6),
                valueColor: AlwaysStoppedAnimation(SIMEopsColors.teal),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Lista de stages
          ...List.generate(totalStages, (index) {
            final (_, label, _) = _pipelineStages[index];
            final stageNum = index + 1;
            final isCompleted = stageNum < currentStageNum;
            final isCurrent = stageNum == currentStageNum;
            final startTime = _stageStartTimes[stageNum];
            final duration = _stageDuration(stageNum, currentStageNum);
            final detail = _stageDetails[stageNum];

            // Cor do texto principal por estado
            final labelColor = isCompleted
                ? SIMEopsColors.white
                : isCurrent
                    ? SIMEopsColors.tealLight
                    : SIMEopsColors.muted.withValues(alpha: 0.45);

            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Timestamp monospace (só quando stage já aconteceu)
                  SizedBox(
                    width: 72,
                    child: startTime != null
                        ? Text(
                            _fmtTimestamp(startTime),
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 10,
                              color: SIMEopsColors.muted.withValues(alpha: 0.6),
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),
                  const SizedBox(width: 10),
                  // Status indicator (círculo)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: _stageIndicator(done: isCompleted, current: isCurrent),
                  ),
                  const SizedBox(width: 10),
                  // Label + detail
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                label,
                                style: GoogleFonts.exo2(
                                  fontSize: 13,
                                  color: labelColor,
                                  fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                                ),
                              ),
                            ),
                            if (duration != null)
                              Text(
                                _fmtDuration(duration),
                                style: GoogleFonts.jetBrainsMono(
                                  fontSize: 10,
                                  color: isCompleted
                                      ? SIMEopsColors.muted.withValues(alpha: 0.7)
                                      : SIMEopsColors.tealLight.withValues(alpha: 0.8),
                                ),
                              ),
                          ],
                        ),
                        if (detail != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              detail,
                              style: GoogleFonts.exo2(
                                fontSize: 11,
                                color: SIMEopsColors.muted.withValues(alpha: isCompleted ? 0.7 : 0.9),
                              ),
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

          // Botão cancelar (estilo tático — borda teal, texto caps, letter-spacing)
          Center(
            child: OutlinedButton(
              onPressed: _resetSearch,
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: SIMEopsColors.teal.withValues(alpha: 0.6)),
                padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              ),
              child: Text(
                'CANCELAR',
                style: GoogleFonts.rajdhani(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 3,
                  color: SIMEopsColors.teal,
                ),
              ),
            ),
          ),
        ],
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

