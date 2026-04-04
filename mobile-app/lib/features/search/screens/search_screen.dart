import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../main.dart';
import '../widgets/history_card.dart';
import 'manual_search_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  List<Map<String, dynamic>> _history = [];
  bool _loading = true;
  String? _error;

  // Selection mode
  bool _selectMode = false;
  final Set<String> _selected = {};

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiService>();
      final history = await api.getSearchHistory();
      if (mounted) {
        setState(() {
          _history = history;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _navigateToNewSearch() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ManualSearchScreen()),
    );
    _loadHistory();
  }

  void _onTapSearch(Map<String, dynamic> search) async {
    final searchId = search['search_id'] as String? ?? '';

    // Se em modo selecao, toggle selecao
    if (_selectMode) {
      setState(() {
        if (_selected.contains(searchId)) {
          _selected.remove(searchId);
          if (_selected.isEmpty) _selectMode = false;
        } else {
          _selected.add(searchId);
        }
      });
      return;
    }

    final status = search['status'] as String? ?? '';
    if (status == 'failed') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Esta busca falhou. Inicie uma nova.')),
      );
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ManualSearchScreen(resumeSearchId: searchId),
      ),
    );
    _loadHistory();
  }

  void _onLongPressSearch(Map<String, dynamic> search) {
    final searchId = search['search_id'] as String? ?? '';
    setState(() {
      _selectMode = true;
      _selected.add(searchId);
    });
  }

  void _cancelSelection() {
    setState(() {
      _selectMode = false;
      _selected.clear();
    });
  }

  Future<void> _deleteSelected() async {
    if (_selected.isEmpty) return;

    final count = _selected.length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SIMEopsColors.navyMid,
        title: const Text('Deletar buscas?'),
        content: Text('$count busca${count > 1 ? 's' : ''} sera${count > 1 ? 'o' : ''} removida${count > 1 ? 's' : ''} permanentemente.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Deletar'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final api = context.read<ApiService>();
      await api.deleteSearches(_selected.toList());
      _cancelSelection();
      _loadHistory();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$count busca${count > 1 ? 's' : ''} removida${count > 1 ? 's' : ''}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao deletar: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadHistory,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  children: [
                    const SizedBox(height: 100),
                    const Icon(Icons.error_outline, size: 48, color: Colors.red),
                    const SizedBox(height: 12),
                    Text(
                      'Erro ao carregar histórico',
                      style: Theme.of(context).textTheme.titleMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: FilledButton.tonal(
                        onPressed: _loadHistory,
                        child: const Text('Tentar novamente'),
                      ),
                    ),
                  ],
                )
              : Stack(
                  children: [
                    ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: EdgeInsets.fromLTRB(16, 16, 16, _selectMode ? 80 : 16),
                      children: [
                        // Nova Busca button
                        if (!_selectMode)
                          SizedBox(
                            width: double.infinity,
                            height: 52,
                            child: FilledButton.icon(
                              onPressed: _navigateToNewSearch,
                              icon: const Icon(Icons.travel_explore),
                              label: const Text('Nova Busca'),
                            ),
                          ),
                        if (!_selectMode) const SizedBox(height: 20),

                        // Selection mode header
                        if (_selectMode) ...[
                          Row(
                            children: [
                              IconButton(
                                onPressed: _cancelSelection,
                                icon: const Icon(Icons.close),
                              ),
                              Text(
                                '${_selected.length} selecionada${_selected.length > 1 ? 's' : ''}',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const Spacer(),
                              TextButton(
                                onPressed: () {
                                  setState(() {
                                    if (_selected.length == _history.length) {
                                      _selected.clear();
                                    } else {
                                      for (final s in _history) {
                                        _selected.add(s['search_id'] as String? ?? '');
                                      }
                                    }
                                  });
                                },
                                child: Text(_selected.length == _history.length
                                    ? 'Desmarcar todos'
                                    : 'Selecionar todos'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                        ],

                        // History section
                        if (_history.isNotEmpty) ...[
                          if (!_selectMode)
                            Text(
                              'Buscas anteriores',
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    color: Colors.grey[600],
                                  ),
                            ),
                          if (!_selectMode) const SizedBox(height: 8),
                          ..._history.map((search) {
                            final searchId = search['search_id'] as String? ?? '';
                            final isSelected = _selected.contains(searchId);
                            return Stack(
                              children: [
                                HistoryCard(
                                  search: search,
                                  onTap: () => _onTapSearch(search),
                                  onLongPress: () => _onLongPressSearch(search),
                                ),
                                if (_selectMode)
                                  Positioned(
                                    top: 8,
                                    right: 8,
                                    child: Container(
                                      width: 24,
                                      height: 24,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: isSelected
                                            ? SIMEopsColors.teal
                                            : Colors.transparent,
                                        border: Border.all(
                                          color: isSelected
                                              ? SIMEopsColors.teal
                                              : SIMEopsColors.muted.withValues(alpha: 0.4),
                                          width: 2,
                                        ),
                                      ),
                                      child: isSelected
                                          ? const Icon(Icons.check, size: 16, color: Colors.white)
                                          : null,
                                    ),
                                  ),
                              ],
                            );
                          }),
                        ] else ...[
                          const SizedBox(height: 80),
                          Icon(Icons.search_off, size: 64, color: Colors.grey[400]),
                          const SizedBox(height: 12),
                          Text(
                            'Nenhuma busca realizada ainda',
                            style: TextStyle(color: Colors.grey[500]),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Toque em "Nova Busca" para comecar',
                            style: TextStyle(color: Colors.grey[400], fontSize: 13),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ],
                    ),

                    // Delete FAB
                    if (_selectMode && _selected.isNotEmpty)
                      Positioned(
                        left: 16,
                        right: 16,
                        bottom: 16,
                        child: SizedBox(
                          height: 52,
                          child: FilledButton.icon(
                            onPressed: _deleteSelected,
                            style: FilledButton.styleFrom(
                              backgroundColor: Colors.red,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            icon: const Icon(Icons.delete_outline, color: Colors.white),
                            label: Text(
                              'Deletar ${_selected.length}',
                              style: const TextStyle(color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }
}
