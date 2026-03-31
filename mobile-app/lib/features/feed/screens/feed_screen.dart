import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/news_item.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/local_db_service.dart';
import '../widgets/news_card.dart';
import '../widgets/news_detail_sheet.dart';

enum SortOrder { newest, oldest }

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

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
  String? _cidadeFilter;
  List<String> _cidades = [];
  SortOrder _sortOrder = SortOrder.newest;
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
      final cities = cached.map((e) => e.cidade).toSet().toList()..sort();
      setState(() {
        _news.addAll(cached);
        if (_cidades.isEmpty) _cidades = cities;
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

      final cities = items.map((e) => e.cidade).toSet().toList()..sort();
      if (_cidades.isEmpty && cities.isNotEmpty) {
        _cidades = cities;
      }

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

      if (_sortOrder == SortOrder.oldest) {
        items.sort((a, b) => a.dataOcorrencia.compareTo(b.dataOcorrencia));
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

      final newCities = items.map((e) => e.cidade).toSet();
      final merged = {..._cidades, ...newCities}.toList()..sort();

      if (_sortOrder == SortOrder.oldest) {
        items.sort((a, b) => a.dataOcorrencia.compareTo(b.dataOcorrencia));
      }

      setState(() {
        _news.addAll(items);
        _offset += items.length;
        _hasMore = items.length >= _limit;
        _loading = false;
        _cidades = merged;
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
    } catch (_) {}
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
    } catch (_) {}
  }

  void _applySortLocally() {
    setState(() {
      if (_sortOrder == SortOrder.newest) {
        _news.sort((a, b) => b.dataOcorrencia.compareTo(a.dataOcorrencia));
      } else {
        _news.sort((a, b) => a.dataOcorrencia.compareTo(b.dataOcorrencia));
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_initialLoad) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_news.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.newspaper, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Nenhuma noticia ainda',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey[600],
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Puxe para baixo para atualizar',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey[500],
                  ),
            ),
            const SizedBox(height: 24),
            FilledButton.tonal(
              onPressed: _refresh,
              child: const Text('Atualizar'),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        // Filter bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Row(
            children: [
              // City filter
              Expanded(
                child: _FilterDropdown(
                  icon: Icons.location_on_outlined,
                  label: _cidadeFilter ?? 'Todas as cidades',
                  onTap: () => _showCityPicker(),
                ),
              ),
              const SizedBox(width: 8),
              // Sort order
              _FilterDropdown(
                icon: _sortOrder == SortOrder.newest
                    ? Icons.arrow_downward
                    : Icons.arrow_upward,
                label: _sortOrder == SortOrder.newest
                    ? 'Recentes'
                    : 'Antigas',
                onTap: () {
                  setState(() {
                    _sortOrder = _sortOrder == SortOrder.newest
                        ? SortOrder.oldest
                        : SortOrder.newest;
                  });
                  _applySortLocally();
                },
              ),
            ],
          ),
        ),
        // News list
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

  void _showCityPicker() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Filtrar por cidade',
                style: Theme.of(ctx).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
            ),
            ListTile(
              leading: Icon(
                Icons.public,
                color: _cidadeFilter == null
                    ? Theme.of(ctx).colorScheme.primary
                    : null,
              ),
              title: const Text('Todas as cidades'),
              selected: _cidadeFilter == null,
              onTap: () {
                Navigator.pop(ctx);
                setState(() => _cidadeFilter = null);
                _refresh();
              },
            ),
            const Divider(height: 1),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _cidades.length,
                itemBuilder: (ctx, i) => ListTile(
                  leading: Icon(
                    Icons.location_city,
                    color: _cidadeFilter == _cidades[i]
                        ? Theme.of(ctx).colorScheme.primary
                        : null,
                  ),
                  title: Text(_cidades[i]),
                  selected: _cidadeFilter == _cidades[i],
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _cidadeFilter = _cidades[i]);
                    _refresh();
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterDropdown extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _FilterDropdown({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: Colors.grey[600]),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodySmall,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
