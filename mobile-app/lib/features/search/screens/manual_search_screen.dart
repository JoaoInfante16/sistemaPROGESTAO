import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/data/brazilian_locations.dart';
import '../../../core/services/api_service.dart';
import '../widgets/multi_city_search_field.dart';
import 'report_screen.dart';

class ManualSearchScreen extends StatefulWidget {
  /// Se fornecido, retoma uma busca existente (do historico).
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
  bool _useKeyword = false;
  final _keywordCtrl = TextEditingController();
  bool _loadingLocations = true;

  // Search state
  String? _searchId;
  String _searchStatus = 'idle'; // idle, processing, completed, failed
  List<Map<String, dynamic>> _results = [];
  Map<String, dynamic>? _progress;
  Timer? _pollTimer;

  static const _periodos = {
    7: 'Ultimos 7 dias',
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
      _searchStatus = 'processing';
    });

    // Verificar status atual antes de polling
    try {
      final api = context.read<ApiService>();
      final status = await api.getManualSearchStatus(searchId);
      final s = status['status'] as String;

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
        // Ainda processando — iniciar polling
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
    _keywordCtrl.dispose();
    super.dispose();
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
        tipoCrime: (_useKeyword && _keywordCtrl.text.trim().length >= 2)
            ? _keywordCtrl.text.trim()
            : null,
      );

      setState(() => _searchId = searchId);
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
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      if (_searchId == null) return;
      final api = context.read<ApiService>();

      try {
        final status = await api.getManualSearchStatus(_searchId!);
        final s = status['status'] as String;

        // Atualizar progresso da pipeline
        final progress = status['progress'] as Map<String, dynamic>?;
        if (mounted && progress != null) {
          setState(() => _progress = progress);
        }

        if (s == 'completed' || s == 'failed') {
          _pollTimer?.cancel();

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
      } catch (_) {
        // Continue polling
      }
    });
  }

  void _resetSearch() {
    _pollTimer?.cancel();
    setState(() {
      _searchId = null;
      _searchStatus = 'idle';
      _results = [];
      _progress = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nova Busca'),
      ),
      body: _searchStatus == 'idle' ? _buildForm() : _buildResults(),
    );
  }

  Widget _buildForm() {
    if (_loadingLocations) {
      return const Center(child: CircularProgressIndicator());
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Estado
        DropdownButtonFormField<String>(
          key: const ValueKey('estado'),
          value: _selectedEstado,
          decoration: const InputDecoration(
            labelText: 'Estado',
            border: OutlineInputBorder(),
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
        const SizedBox(height: 12),

        // Cidades - multi-select search field
        MultiCitySearchField(
          key: ValueKey(_selectedEstado),
          estadoNome: _selectedEstado,
          onChanged: (cidades) {
            setState(() => _selectedCidades = cidades);
          },
        ),
        const SizedBox(height: 12),

        // Periodo
        DropdownButtonFormField<int>(
          key: const ValueKey('periodo'),
          value: _periodoDias,
          decoration: const InputDecoration(
            labelText: 'Periodo',
            border: OutlineInputBorder(),
          ),
          isExpanded: true,
          items: _periodos.entries
              .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
              .toList(),
          onChanged: (v) => setState(() => _periodoDias = v ?? 30),
        ),
        const SizedBox(height: 12),

        // Palavra-chave (tipo crime)
        Row(
          children: [
            Checkbox(
              value: _useKeyword,
              onChanged: (v) => setState(() => _useKeyword = v ?? false),
            ),
            Expanded(
              child: Text(
                'Filtrar por palavra-chave (opcional)',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _keywordCtrl,
          enabled: _useKeyword,
          maxLength: 50,
          decoration: InputDecoration(
            hintText: _useKeyword ? 'Ex: roubo, furto, homicidio...' : 'Todos',
            border: const OutlineInputBorder(),
            filled: !_useKeyword,
            fillColor: !_useKeyword
                ? Theme.of(context).colorScheme.surfaceContainerHighest
                : null,
            counterText: '',
          ),
        ),
        const SizedBox(height: 24),

        // Start button
        FilledButton.icon(
          onPressed:
              (_selectedEstado != null && _selectedCidades.isNotEmpty)
                  ? _startSearch
                  : null,
          icon: const Icon(Icons.search),
          label: const Text('Iniciar Busca'),
        ),
      ],
    );
  }

  static const _pipelineStages = [
    ('google_search', 'Pesquisando na web', Icons.search),
    ('ssp_scraping', 'Consultando SSP', Icons.shield),
    ('filtering', 'Filtrando com IA', Icons.filter_alt),
    ('fetching', 'Baixando conteudo', Icons.download),
    ('analyzing', 'Analisando noticias', Icons.psychology),
    ('saving', 'Salvando resultados', Icons.save),
  ];

  Widget _buildProgressStepper() {
    final currentStageNum = (_progress?['stage_num'] as int?) ?? 0;
    final details = _progress?['details'] as String?;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Processando busca...',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 24),
            ...List.generate(_pipelineStages.length, (index) {
              final (_, label, icon) = _pipelineStages[index];
              final stageNum = index + 1;
              final isCompleted = stageNum < currentStageNum;
              final isCurrent = stageNum == currentStageNum;
              final isPending = stageNum > currentStageNum;

              final color = isCompleted
                  ? Colors.green
                  : isCurrent
                      ? Theme.of(context).colorScheme.primary
                      : Colors.grey[400]!;

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    if (isCompleted)
                      Icon(Icons.check_circle, color: color, size: 28)
                    else if (isCurrent)
                      SizedBox(
                        width: 28,
                        height: 28,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: color,
                              ),
                            ),
                          ],
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
                            Text(
                              details,
                              style: TextStyle(
                                fontSize: 12,
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
                  child: FilledButton.tonalIcon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ReportScreen(
                            searchId: _searchId,
                            cidades: _selectedCidades.toList(),
                            estado: _selectedEstado!,
                            periodoDias: _periodoDias,
                            results: _results,
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.bar_chart),
                    label: const Text('Gerar Relatorio de Risco'),
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
                    'Nenhuma noticia encontrada para os filtros selecionados',
                    style: TextStyle(color: Colors.grey[500]),
                    textAlign: TextAlign.center,
                  ),
                )
              : ListView.builder(
                  itemCount: _results.length,
                  itemBuilder: (context, index) {
                    final r = _results[index];
                    return _ManualResultCard(result: r);
                  },
                ),
        ),
      ],
    );
  }
}

class _ManualResultCard extends StatelessWidget {
  final Map<String, dynamic> result;

  const _ManualResultCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final tipoCrime = result['tipo_crime'] as String? ?? '';
    final cidade = result['cidade'] as String? ?? '';
    final bairro = result['bairro'] as String?;
    final resumo = result['resumo'] as String? ?? '';
    final dataStr = result['data_ocorrencia'] as String? ?? '';
    final confianca = (result['confianca'] as num?)?.toDouble();
    final sourceUrl = result['source_url'] as String? ?? '';

    DateTime? data;
    try {
      data = DateTime.parse(dataStr);
    } catch (_) {}

    final local = [cidade, if (bairro != null) bairro].join(', ');

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.blueGrey.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    tipoCrime.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.blueGrey,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                if (confianca != null) ...[
                  const SizedBox(width: 8),
                  Text(
                    '${(confianca * 100).toInt()}%',
                    style: TextStyle(color: Colors.grey[500], fontSize: 11),
                  ),
                ],
                const Spacer(),
                if (data != null)
                  Text(
                    DateFormat('dd/MM/yyyy').format(data),
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: Colors.grey[500]),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              resumo,
              style: Theme.of(context).textTheme.bodyMedium,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.location_on, size: 14, color: Colors.grey[400]),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    local,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: Colors.grey[600]),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (sourceUrl.isNotEmpty) ...[
                  Icon(Icons.link, size: 14, color: Colors.grey[400]),
                  const SizedBox(width: 4),
                  Text(
                    '1 fonte',
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall
                        ?.copyWith(color: Colors.grey[500]),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
