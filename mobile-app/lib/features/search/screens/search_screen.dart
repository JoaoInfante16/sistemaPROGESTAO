import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
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
    final status = search['status'] as String? ?? '';
    final searchId = search['search_id'] as String? ?? '';

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
                    const Icon(Icons.error_outline,
                        size: 48, color: Colors.red),
                    const SizedBox(height: 12),
                    Text(
                      'Erro ao carregar historico',
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
              : ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  children: [
                    // Nova Busca button
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: FilledButton.icon(
                        onPressed: _navigateToNewSearch,
                        icon: const Icon(Icons.travel_explore),
                        label: const Text('Nova Busca'),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // History section
                    if (_history.isNotEmpty) ...[
                      Text(
                        'Buscas anteriores',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              color: Colors.grey[600],
                            ),
                      ),
                      const SizedBox(height: 8),
                      ..._history.map((search) => HistoryCard(
                            search: search,
                            onTap: () => _onTapSearch(search),
                          )),
                    ] else ...[
                      const SizedBox(height: 80),
                      Icon(Icons.search_off,
                          size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 12),
                      Text(
                        'Nenhuma busca realizada ainda',
                        style: TextStyle(color: Colors.grey[500]),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Toque em "Nova Busca" para comecar',
                        style: TextStyle(
                            color: Colors.grey[400], fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ],
                ),
    );
  }
}
