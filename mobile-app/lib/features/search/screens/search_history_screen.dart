import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
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
                          return _HistoryCard(
                            search: _history[index],
                            onTap: () => _onTapSearch(_history[index]),
                          );
                        },
                      ),
                    ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final Map<String, dynamic> search;
  final VoidCallback onTap;

  const _HistoryCard({required this.search, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final params = search['params'] as Map<String, dynamic>? ?? {};
    final status = search['status'] as String? ?? 'processing';
    final totalResults = search['total_results'] as int?;
    final createdAt = search['created_at'] as String? ?? '';

    final estado = params['estado'] as String? ?? '';
    final cidades = (params['cidades'] as List<dynamic>?)
            ?.map((c) => c.toString())
            .toList() ??
        [];
    final tipoCrime = params['tipo_crime'] as String?;

    DateTime? date;
    try {
      date = DateTime.parse(createdAt);
    } catch (_) {}

    final statusColor = switch (status) {
      'completed' => Colors.green,
      'failed' => Colors.red,
      _ => Colors.blue,
    };
    final statusLabel = switch (status) {
      'completed' => 'Concluida',
      'failed' => 'Falhou',
      _ => 'Em andamento',
    };
    final statusIcon = switch (status) {
      'completed' => Icons.check_circle,
      'failed' => Icons.error,
      _ => Icons.hourglass_top,
    };

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: status chip + date
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(statusIcon, size: 14, color: statusColor),
                        const SizedBox(width: 4),
                        Text(
                          statusLabel,
                          style: TextStyle(
                            color: statusColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (totalResults != null && status == 'completed') ...[
                    const SizedBox(width: 8),
                    Text(
                      '$totalResults resultado${totalResults != 1 ? 's' : ''}',
                      style: TextStyle(color: Colors.grey[500], fontSize: 12),
                    ),
                  ],
                  const Spacer(),
                  if (date != null)
                    Text(
                      DateFormat('dd/MM/yyyy HH:mm').format(date),
                      style: TextStyle(color: Colors.grey[500], fontSize: 12),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              // Estado
              Row(
                children: [
                  Icon(Icons.location_on, size: 16, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      estado,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              // Cidades
              if (cidades.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  cidades.join(', '),
                  style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              // Tipo crime
              if (tipoCrime != null) ...[
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.blueGrey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    tipoCrime,
                    style: const TextStyle(
                      color: Colors.blueGrey,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
