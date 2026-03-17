import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/news_item.dart';
import '../../../core/services/api_service.dart';
import '../../feed/widgets/news_card.dart';
import '../../feed/widgets/news_detail_sheet.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _searchCtrl = TextEditingController();
  List<NewsItem> _results = [];
  bool _loading = false;
  bool _searched = false;

  // Filtros
  String? _selectedCidade;
  String? _selectedTipoCrime;
  String _selectedPeriodo = 'todos';
  List<String> _cidades = [];
  bool _filtersExpanded = false;

  static const _tiposCrime = [
    'Todos',
    'Roubo',
    'Furto',
    'Assalto',
    'Homicidio',
    'Latrocinio',
    'Trafico',
    'Outro',
  ];

  static const _periodos = {
    'todos': 'Todos',
    '7': 'Ultimos 7 dias',
    '30': 'Ultimos 30 dias',
    '60': 'Ultimos 60 dias',
    '90': 'Ultimos 90 dias',
  };

  @override
  void initState() {
    super.initState();
    _loadCidades();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCidades() async {
    try {
      final api = context.read<ApiService>();
      final locations = await api.getLocations();
      final cidades = <String>[];
      for (final state in locations) {
        final cities = state['cities'] as List<dynamic>? ?? [];
        for (final city in cities) {
          final name = (city as Map<String, dynamic>)['name'] as String?;
          if (name != null) cidades.add(name);
        }
      }
      cidades.sort();
      if (mounted) setState(() => _cidades = cidades);
    } catch (_) {
      // Falha ao carregar cidades - dropdown fica vazio
    }
  }

  Future<void> _search() async {
    final query = _searchCtrl.text.trim();
    if (query.isEmpty) return;

    setState(() {
      _loading = true;
      _searched = true;
    });

    try {
      final api = context.read<ApiService>();

      String? dateFrom;
      if (_selectedPeriodo != 'todos') {
        final days = int.parse(_selectedPeriodo);
        final from = DateTime.now().subtract(Duration(days: days));
        dateFrom =
            '${from.year}-${from.month.toString().padLeft(2, '0')}-${from.day.toString().padLeft(2, '0')}';
      }

      final tipoCrime = (_selectedTipoCrime != null && _selectedTipoCrime != 'Todos')
          ? _selectedTipoCrime
          : null;

      final results = await api.searchNews(
        query,
        cidade: _selectedCidade,
        tipoCrime: tipoCrime,
        dateFrom: dateFrom,
      );
      setState(() {
        _results = results;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro na busca: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Buscar noticias...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: Icon(
                      _filtersExpanded
                          ? Icons.filter_list_off
                          : Icons.filter_list,
                      color: _hasActiveFilters()
                          ? Theme.of(context).colorScheme.primary
                          : null,
                    ),
                    onPressed: () =>
                        setState(() => _filtersExpanded = !_filtersExpanded),
                  ),
                  if (_searchCtrl.text.isNotEmpty)
                    IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() {
                          _results = [];
                          _searched = false;
                        });
                      },
                    ),
                ],
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _search(),
            onChanged: (_) => setState(() {}),
          ),
        ),

        // Filtros expansiveis
        if (_filtersExpanded)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Cidade
                    DropdownMenu<String>(
                      key: ValueKey('cidade-$_selectedCidade'),
                      label: const Text('Cidade'),
                      initialSelection: _selectedCidade,
                      expandedInsets: EdgeInsets.zero,
                      dropdownMenuEntries: [
                        const DropdownMenuEntry(value: '', label: 'Todas'),
                        ..._cidades.map((c) =>
                            DropdownMenuEntry(value: c, label: c)),
                      ],
                      onSelected: (v) => setState(
                          () => _selectedCidade = (v == null || v.isEmpty) ? null : v),
                    ),
                    const SizedBox(height: 8),
                    // Tipo de crime
                    DropdownMenu<String>(
                      key: ValueKey('crime-$_selectedTipoCrime'),
                      label: const Text('Tipo de crime'),
                      initialSelection: _selectedTipoCrime ?? 'Todos',
                      expandedInsets: EdgeInsets.zero,
                      dropdownMenuEntries: _tiposCrime
                          .map((t) => DropdownMenuEntry(value: t, label: t))
                          .toList(),
                      onSelected: (v) =>
                          setState(() => _selectedTipoCrime = v),
                    ),
                    const SizedBox(height: 8),
                    // Periodo
                    DropdownMenu<String>(
                      key: ValueKey('periodo-$_selectedPeriodo'),
                      label: const Text('Periodo'),
                      initialSelection: _selectedPeriodo,
                      expandedInsets: EdgeInsets.zero,
                      dropdownMenuEntries: _periodos.entries
                          .map((e) => DropdownMenuEntry(
                              value: e.key, label: e.value))
                          .toList(),
                      onSelected: (v) =>
                          setState(() => _selectedPeriodo = v ?? 'todos'),
                    ),
                    const SizedBox(height: 8),
                    // Limpar filtros
                    if (_hasActiveFilters())
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: _clearFilters,
                          child: const Text('Limpar filtros'),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),

        const SizedBox(height: 8),

        // Results
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : !_searched
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.search,
                              size: 64, color: Colors.grey[300]),
                          const SizedBox(height: 16),
                          Text(
                            'Busque por tipo de crime, cidade ou palavras-chave',
                            style: TextStyle(color: Colors.grey[500]),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : _results.isEmpty
                      ? Center(
                          child: Text(
                            'Nenhum resultado encontrado',
                            style: TextStyle(color: Colors.grey[500]),
                          ),
                        )
                      : ListView.builder(
                          itemCount: _results.length,
                          itemBuilder: (context, index) {
                            return NewsCard(
                              news: _results[index],
                              onTap: () => NewsDetailSheet.show(
                                  context, _results[index]),
                            );
                          },
                        ),
        ),
      ],
    );
  }

  bool _hasActiveFilters() {
    return _selectedCidade != null ||
        (_selectedTipoCrime != null && _selectedTipoCrime != 'Todos') ||
        _selectedPeriodo != 'todos';
  }

  void _clearFilters() {
    setState(() {
      _selectedCidade = null;
      _selectedTipoCrime = null;
      _selectedPeriodo = 'todos';
    });
  }
}
