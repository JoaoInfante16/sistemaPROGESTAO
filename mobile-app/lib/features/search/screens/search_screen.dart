import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../feed/widgets/take_card.dart';
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
                  padding: const EdgeInsets.fromLTRB(18, 90, 18, 0),
                  children: [
                    Text('Não foi possível\ncarregar o histórico',
                        style: SIMEopsType.title()),
                    const SizedBox(height: 12),
                    Text(
                      'As consultas anteriores estão no servidor. '
                      'Verifique a conexão e tente de novo.',
                      style: SIMEopsType.lead(),
                    ),
                    const SizedBox(height: 24),
                    OutlinedButton(
                      onPressed: _loadHistory,
                      child: const Text('TENTAR DE NOVO'),
                    ),
                  ],
                )
              : Stack(
                  children: [
                    ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: EdgeInsets.only(bottom: _selectMode ? 96 : 20),
                      children: [
                        if (!_selectMode) ...[
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
                            child: SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: _navigateToNewSearch,
                                child: const Text('NOVA CONSULTA'),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                        ],

                        // Modo de seleção múltipla
                        if (_selectMode)
                          Container(
                            decoration: const BoxDecoration(
                              border: Border(
                                bottom: BorderSide(color: SIMEopsColors.rule),
                              ),
                            ),
                            padding: const EdgeInsets.fromLTRB(6, 8, 18, 8),
                            child: Row(
                              children: [
                                IconButton(
                                  onPressed: _cancelSelection,
                                  icon: const Icon(Icons.close,
                                      size: 20, color: SIMEopsColors.muted),
                                ),
                                Text(
                                  '${_selected.length} SELECIONADA'
                                  '${_selected.length > 1 ? 'S' : ''}',
                                  style: SIMEopsType.slug(
                                      color: SIMEopsColors.white),
                                ),
                                const Spacer(),
                                InkWell(
                                  onTap: () => setState(() {
                                    if (_selected.length == _history.length) {
                                      _selected.clear();
                                    } else {
                                      for (final s in _history) {
                                        _selected
                                            .add(s['search_id'] as String? ?? '');
                                      }
                                    }
                                  }),
                                  child: Padding(
                                    padding:
                                        const EdgeInsets.symmetric(vertical: 10),
                                    child: Text(
                                      _selected.length == _history.length
                                          ? 'DESMARCAR TODAS'
                                          : 'MARCAR TODAS',
                                      style: SIMEopsType.slug(
                                          color: SIMEopsColors.tealLight),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                        if (_history.isNotEmpty) ...[
                          if (!_selectMode)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(18, 22, 18, 6),
                              child: Row(
                                children: [
                                  Text('CONSULTAS ANTERIORES',
                                      style: SIMEopsType.dateline()),
                                  const SizedBox(width: 11),
                                  const Expanded(
                                    child: Divider(
                                        color: SIMEopsColors.rule, height: 1),
                                  ),
                                ],
                              ),
                            ),
                          ..._history.map((search) {
                            final id = search['search_id'] as String? ?? '';
                            return HistoryCard(
                              search: search,
                              selected: _selected.contains(id),
                              onTap: () => _onTapSearch(search),
                              onLongPress: () => _onLongPressSearch(search),
                            );
                          }),
                          const EndMark(),
                        ] else ...[
                          Padding(
                            padding: const EdgeInsets.fromLTRB(18, 60, 18, 0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Nenhuma consulta\nainda',
                                    style: SIMEopsType.title()),
                                const SizedBox(height: 12),
                                Text(
                                  'A consulta varre a imprensa da cidade que '
                                  'você escolher, no período que você pedir. '
                                  'Leva alguns minutos e você pode fechar o '
                                  'app enquanto ela roda.',
                                  style: SIMEopsType.lead(),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),

                    if (_selectMode && _selected.isNotEmpty)
                      Positioned(
                        left: 18,
                        right: 18,
                        bottom: 18,
                        child: Material(
                          color: SIMEopsColors.alert,
                          child: InkWell(
                            onTap: _deleteSelected,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 18),
                              child: Center(
                                child: Text(
                                  'APAGAR ${_selected.length}',
                                  style: SIMEopsType.action(
                                      color: SIMEopsColors.white),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }
}
