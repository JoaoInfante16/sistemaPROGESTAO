import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../widgets/history_card.dart';
import 'manual_search_screen.dart';

class SearchHistoryScreen extends StatefulWidget {
  const SearchHistoryScreen({super.key});

  @override
  State<SearchHistoryScreen> createState() => _SearchHistoryScreenState();
}

class _SearchHistoryScreenState extends State<SearchHistoryScreen> {
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

  void _onTapSearch(Map<String, dynamic> search) {
    final status = search['status'] as String? ?? '';
    final searchId = search['search_id'] as String? ?? '';

    if (status == 'failed') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Esta busca falhou. Inicie uma nova.')),
      );
      return;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ManualSearchScreen(resumeSearchId: searchId),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Historico de Buscas'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: Colors.red),
                      const SizedBox(height: 12),
                      Text('Erro ao carregar historico',
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 16),
                      FilledButton.tonal(
                        onPressed: _loadHistory,
                        child: const Text('Tentar novamente'),
                      ),
                    ],
                  ),
                )
              : _history.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.search_off,
                              size: 64, color: Colors.grey[400]),
                          const SizedBox(height: 12),
                          Text(
                            'Nenhuma busca realizada ainda',
                            style: TextStyle(color: Colors.grey[500]),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadHistory,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _history.length,
                        itemBuilder: (context, index) {
                          return HistoryCard(
                            search: _history[index],
                            onTap: () => _onTapSearch(_history[index]),
                          );
                        },
                      ),
                    ),
    );
  }
}

