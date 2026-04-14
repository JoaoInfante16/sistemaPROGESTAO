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

  const FeedScreen({super.key, this.cityFilter});

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
      // Filtrar cache pela cidade se tiver filtro ativo
      final filtered = _cidadeFilter != null
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
      );
      await db.upsertNews(items);

      // Mark all as read na primeira abertura
      if (!_markedAllRead) {
        _markedAllRead = true;
        api.markAllAsRead().then((_) {
          if (mounted) {
            setState(() {
              for (final item in _news) {
                item.isUnread = false;
              }
            });
          }
        }).catchError((_) {});
      }

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
      );
      await db.upsertNews(items);

      setState(() {
        _news.addAll(items);
        _offset += items.length;
        _hasMore = items.length >= _limit;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
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

    return Column(
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

                return NewsCard(
                  news: _news[index],
                  onTap: () {
                    _markAsRead(index);
                    NewsDetailSheet.show(context, _news[index]);
                  },
                  onMarkRead: () => _markAsRead(index),
                  onToggleFavorite: () => _toggleFavorite(index),
                );
              },
            ),
          ),
        ),
      ],
    );
  }

}

