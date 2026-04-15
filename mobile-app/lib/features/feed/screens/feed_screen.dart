import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/news_item.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/local_db_service.dart';
import '../widgets/news_card.dart';
import '../widgets/news_detail_sheet.dart';

class FeedScreen extends StatefulWidget {
  /// Se fornecido, fixa o filtro de cidade (usado no CityDetailScreen)
  final String? cityFilter;
  /// Se fornecido, filtra por lista de cidades (usado em grupos)
  final List<String>? citiesFilter;

  const FeedScreen({super.key, this.cityFilter, this.citiesFilter});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final List<NewsItem> _news = [];
  final _scrollCtrl = ScrollController();
  bool _loading = false;
  bool _initialLoad = true;
  bool _hasMore = true;
  int _offset = 0;
  static const _limit = 20;
  late final String? _cidadeFilter = widget.cityFilter;
  late final List<String>? _cidadesFilter = widget.citiesFilter;
  bool _markedAllRead = false;

  @override
  void initState() {
    super.initState();
    _loadCached();
    _refresh();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
            _scrollCtrl.position.maxScrollExtent - 200 &&
        !_loading &&
        _hasMore) {
      _loadMore();
    }
  }

  Future<void> _loadCached() async {
    final db = context.read<LocalDbService>();
    final cached = await db.getCachedNews(limit: 50);
    if (cached.isNotEmpty && _news.isEmpty) {
      // Filtrar cache pela cidade/cidades se tiver filtro ativo
      final filtered = _cidadesFilter != null
          ? cached.where((n) => _cidadesFilter.contains(n.cidade)).toList()
          : _cidadeFilter != null
              ? cached.where((n) => n.cidade == _cidadeFilter).toList()
              : cached;
      setState(() {
        _news.addAll(filtered);
      });
    }
  }

  Future<void> _refresh() async {
    final api = context.read<ApiService>();
    final db = context.read<LocalDbService>();

    setState(() {
      _offset = 0;
      _hasMore = true;
    });

    try {
      final items = await api.getNews(
        offset: 0,
        limit: _limit,
        cidade: _cidadeFilter,
        cidades: _cidadesFilter,
      );
      await db.upsertNews(items);

      items.sort((a, b) => b.dataOcorrencia.compareTo(a.dataOcorrencia));
      setState(() {
        _news.clear();
        _news.addAll(items);
        _offset = items.length;
        _hasMore = items.length >= _limit;
        _initialLoad = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _initialLoad = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao carregar: $e')),
        );
      }
    }
  }

  Future<void> _loadMore() async {
    if (_loading) return;
    final api = context.read<ApiService>();
    final db = context.read<LocalDbService>();
    setState(() => _loading = true);

    try {
      final items = await api.getNews(
        offset: _offset,
        limit: _limit,
        cidade: _cidadeFilter,
        cidades: _cidadesFilter,
      );
      await db.upsertNews(items);

      setState(() {
        _news.addAll(items);
        _news.sort((a, b) => b.dataOcorrencia.compareTo(a.dataOcorrencia));
        _offset += items.length;
        _hasMore = items.length >= _limit;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _markAllAsRead() async {
    final api = context.read<ApiService>();
    try {
      await api.markAllAsRead();
      setState(() {
        for (final n in _news) {
          n.isUnread = false;
        }
        _markedAllRead = true;
      });
    } catch (e) {
      debugPrint('[Feed] Mark all read error: $e');
    }
  }

  Future<void> _markAsRead(int index) async {
    final item = _news[index];
    if (!item.isUnread) return;
    final api = context.read<ApiService>();
    try {
      await api.markAsRead(item.id);
      setState(() => _news[index].isUnread = false);
    } catch (e) { debugPrint('[Feed] Mark read error: $e'); }
  }

  Future<void> _toggleFavorite(int index) async {
    final item = _news[index];
    final api = context.read<ApiService>();
    try {
      if (item.isFavorite) {
        await api.removeFavorite(item.id);
      } else {
        await api.addFavorite(item.id);
      }
      setState(() => _news[index].isFavorite = !item.isFavorite);
    } catch (e) { debugPrint('[Feed] Toggle favorite error: $e'); }
  }

  @override
  Widget build(BuildContext context) {
    if (_initialLoad) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_news.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 80),
          Icon(Icons.newspaper, size: 64, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Center(
            child: Text(
              'Nenhuma notícia ainda',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              'Puxe para baixo para atualizar',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[500],
                  ),
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: FilledButton.tonal(
              onPressed: _refresh,
              child: const Text('Atualizar'),
            ),
          ),
        ],
      );
    }

    final hasUnread = _news.any((n) => n.isUnread);

    return Stack(
      children: [
        Column(
          children: [
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refresh,
                child: ListView.builder(
                  controller: _scrollCtrl,
                  itemCount: _news.length + (_hasMore ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == _news.length) {
                      return const Padding(
                        padding: EdgeInsets.all(16),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }

                    final item = _news[index];
                    final showDateHeader = index == 0 ||
                        _dateKey(item.dataOcorrencia) != _dateKey(_news[index - 1].dataOcorrencia);

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (showDateHeader)
                          _DateHeader(date: item.dataOcorrencia),
                        NewsCard(
                          news: item,
                          onTap: () {
                            _markAsRead(index);
                            NewsDetailSheet.show(context, item);
                          },
                          onMarkRead: () => _markAsRead(index),
                          onToggleFavorite: () => _toggleFavorite(index),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ],
        ),
        if (hasUnread && !_markedAllRead)
          Positioned(
            right: 16,
            bottom: 16,
            child: FloatingActionButton.small(
              backgroundColor: const Color(0xFF1A8F9A),
              onPressed: _markAllAsRead,
              tooltip: 'Marcar todas como lidas',
              child: const Icon(Icons.done_all, color: Colors.white, size: 20),
            ),
          ),
      ],
    );
  }

  String _dateKey(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class _DateHeader extends StatelessWidget {
  final DateTime date;
  const _DateHeader({required this.date});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(date.year, date.month, date.day);
    final diff = today.difference(d).inDays;

    String label;
    if (diff == 0) {
      label = 'Hoje';
    } else if (diff == 1) {
      label = 'Ontem';
    } else if (diff < 7) {
      const weekdays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
      label = weekdays[date.weekday - 1];
    } else {
      label = '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
      child: Row(
        children: [
          Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.08))),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF5A6A7A),
                letterSpacing: 1.2,
              ),
            ),
          ),
          Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.08))),
        ],
      ),
    );
  }
}
