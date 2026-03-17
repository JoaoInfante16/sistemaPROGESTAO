import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';

class ManualSearchScreen extends StatefulWidget {
  const ManualSearchScreen({super.key});

  @override
  State<ManualSearchScreen> createState() => _ManualSearchScreenState();
}

class _ManualSearchScreenState extends State<ManualSearchScreen> {
  // Form
  List<Map<String, dynamic>> _locations = [];
  String? _selectedEstado;
  String? _selectedCidade;
  int _periodoDias = 30;
  String? _tipoCrime;
  bool _loadingLocations = true;

  // Search state
  String? _searchId;
  String _searchStatus = 'idle'; // idle, processing, completed, failed
  List<Map<String, dynamic>> _results = [];
  Timer? _pollTimer;

  static const _tiposCrime = [
    'Todos',
    'Roubo',
    'Furto',
    'Assalto',
    'Homicidio',
    'Latrocinio',
    'Trafico',
  ];

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
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadLocations() async {
    try {
      final api = context.read<ApiService>();
      final locations = await api.getLocations();
      if (mounted) {
        setState(() {
          _locations = locations;
          _loadingLocations = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingLocations = false);
    }
  }

  List<String> get _estados =>
      _locations.map((s) => s['name'] as String).toList();

  List<String> get _cidades {
    if (_selectedEstado == null) return [];
    final state = _locations.firstWhere(
      (s) => s['name'] == _selectedEstado,
      orElse: () => <String, dynamic>{},
    );
    final cities = state['cities'] as List<dynamic>? ?? [];
    return cities
        .map((c) => (c as Map<String, dynamic>)['name'] as String)
        .toList();
  }

  Future<void> _startSearch() async {
    if (_selectedEstado == null || _selectedCidade == null) return;

    final api = context.read<ApiService>();
    setState(() => _searchStatus = 'processing');

    try {
      final searchId = await api.triggerManualSearch(
        estado: _selectedEstado!,
        cidade: _selectedCidade!,
        periodoDias: _periodoDias,
        tipoCrime: (_tipoCrime != null && _tipoCrime != 'Todos')
            ? _tipoCrime
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
        // Info card
        Card(
          color: Theme.of(context).colorScheme.primaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Icon(Icons.info_outline,
                    color: Theme.of(context).colorScheme.onPrimaryContainer),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Esta busca dispara uma pesquisa no Google e analisa os resultados com IA. Tem um custo estimado de ~\$0.01 por busca.',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onPrimaryContainer,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Estado
        DropdownMenu<String>(
          label: const Text('Estado'),
          expandedInsets: EdgeInsets.zero,
          dropdownMenuEntries: _estados
              .map((e) => DropdownMenuEntry(value: e, label: e))
              .toList(),
          onSelected: (v) => setState(() {
            _selectedEstado = v;
            _selectedCidade = null;
          }),
        ),
        const SizedBox(height: 12),

        // Cidade
        DropdownMenu<String>(
          key: ValueKey('cidade-$_selectedEstado'),
          label: const Text('Cidade'),
          expandedInsets: EdgeInsets.zero,
          dropdownMenuEntries: _cidades
              .map((c) => DropdownMenuEntry(value: c, label: c))
              .toList(),
          onSelected: (v) => setState(() => _selectedCidade = v),
        ),
        const SizedBox(height: 12),

        // Periodo
        DropdownMenu<int>(
          label: const Text('Periodo'),
          initialSelection: _periodoDias,
          expandedInsets: EdgeInsets.zero,
          dropdownMenuEntries: _periodos.entries
              .map((e) => DropdownMenuEntry(value: e.key, label: e.value))
              .toList(),
          onSelected: (v) => setState(() => _periodoDias = v ?? 30),
        ),
        const SizedBox(height: 12),

        // Tipo crime
        DropdownMenu<String>(
          label: const Text('Tipo de crime (opcional)'),
          initialSelection: 'Todos',
          expandedInsets: EdgeInsets.zero,
          dropdownMenuEntries: _tiposCrime
              .map((t) => DropdownMenuEntry(value: t, label: t))
              .toList(),
          onSelected: (v) => setState(() => _tipoCrime = v),
        ),
        const SizedBox(height: 24),

        // Start button
        FilledButton.icon(
          onPressed:
              (_selectedEstado != null && _selectedCidade != null)
                  ? _startSearch
                  : null,
          icon: const Icon(Icons.search),
          label: const Text('Iniciar Busca'),
        ),
      ],
    );
  }

  Widget _buildResults() {
    if (_searchStatus == 'processing') {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(
              'Buscando noticias...',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Pesquisando no Google, analisando com IA...',
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: _resetSearch,
              child: const Text('Cancelar'),
            ),
          ],
        ),
      );
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
          child: Row(
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
