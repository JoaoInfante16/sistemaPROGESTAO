import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../../../core/models/news_item.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/local_db_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/utils/date_grouping.dart';
import '../../../core/widgets/category_filter_bar.dart';
import '../../../core/widgets/group_header.dart';
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

  // Recorte: categorias selecionadas (vazio = todas) + só não lidas.
  final Set<String> _selectedCats = {};
  bool _unreadOnly = false;
  // Grupos cujo estado expandido o usuário inverteu (toggle sobre o default).
  final Set<String> _toggledGroups = {};

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

  // Callbacks por ITEM (não por índice) — com filtro ativo os índices da
  // lista visível não batem com os de _news.
  Future<void> _markAsRead(NewsItem item) async {
    if (!item.isUnread) return;
    final api = context.read<ApiService>();
    try {
      await api.markAsRead(item.id);
      setState(() => item.isUnread = false);
    } catch (e) { debugPrint('[Feed] Mark read error: $e'); }
  }

  Future<void> _toggleFavorite(NewsItem item) async {
    final api = context.read<ApiService>();
    try {
      if (item.isFavorite) {
        await api.removeFavorite(item.id);
      } else {
        await api.addFavorite(item.id);
      }
      setState(() => item.isFavorite = !item.isFavorite);
    } catch (e) { debugPrint('[Feed] Toggle favorite error: $e'); }
  }

  bool _groupExpanded(NewsGroup g) =>
      _toggledGroups.contains(g.key) ? !g.defaultExpanded : g.defaultExpanded;

  void _toggleGroup(String key) {
    setState(() {
      if (!_toggledGroups.add(key)) _toggledGroups.remove(key);
    });
  }

  List<NewsItem> get _visibleNews => _news.where((n) {
        if (_unreadOnly && !n.isUnread) return false;
        if (_selectedCats.isNotEmpty &&
            !_selectedCats.contains(n.categoriaGrupo ?? 'institucional')) {
          return false;
        }
        return true;
      }).toList();

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
          Icon(Icons.newspaper,
              size: 64, color: SIMEopsColors.muted.withValues(alpha: 0.4)),
          const SizedBox(height: 16),
          Center(
            child: Text(
              'Nenhuma notícia ainda',
              style: GoogleFonts.exo2(
                  fontSize: 15, color: SIMEopsColors.muted),
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              'Puxe para baixo para atualizar',
              style: GoogleFonts.exo2(
                  fontSize: 12,
                  color: SIMEopsColors.muted.withValues(alpha: 0.6)),
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

    // Contagens por categoria sobre o que está carregado.
    final catCounts = <String, int>{};
    for (final n in _news) {
      final cat = n.categoriaGrupo ?? 'institucional';
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }

    final groups = groupNewsByDate(_visibleNews);

    final rows = <Widget>[];
    for (final g in groups) {
      final expanded = _groupExpanded(g);
      rows.add(GroupHeader(
        label: g.label,
        count: g.items.length,
        expanded: expanded,
        onTap: () => _toggleGroup(g.key),
      ));
      if (expanded) {
        for (final item in g.items) {
          rows.add(NewsCard(
            news: item,
            onTap: () {
              _markAsRead(item);
              NewsDetailSheet.show(context, item);
            },
            onMarkRead: () => _markAsRead(item),
            onToggleFavorite: () => _toggleFavorite(item),
          ));
        }
      }
    }
    if (_hasMore) {
      rows.add(const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      ));
    }

    return Stack(
      children: [
        Column(
          children: [
            // Barra de recorte: categorias + só não lidas
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                children: [
                  Expanded(
                    child: CategoryFilterBar(
                      counts: catCounts,
                      selected: _selectedCats,
                      onToggle: (cat) => setState(() {
                        if (!_selectedCats.add(cat)) {
                          _selectedCats.remove(cat);
                        }
                      }),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(right: 16, left: 6),
                    child: FilterChip(
                      label: Text(
                        'Não lidas',
                        style: GoogleFonts.exo2(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _unreadOnly
                              ? Colors.white
                              : SIMEopsColors.tealLight,
                        ),
                      ),
                      selected: _unreadOnly,
                      showCheckmark: false,
                      selectedColor: SIMEopsColors.teal,
                      backgroundColor:
                          SIMEopsColors.teal.withValues(alpha: 0.12),
                      side: BorderSide(
                        color: SIMEopsColors.teal
                            .withValues(alpha: _unreadOnly ? 0 : 0.4),
                      ),
                      onSelected: (_) =>
                          setState(() => _unreadOnly = !_unreadOnly),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refresh,
                child: rows.isEmpty || (rows.length == 1 && _hasMore)
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          const SizedBox(height: 80),
                          Center(
                            child: Text(
                              'Nada no recorte atual',
                              style: GoogleFonts.exo2(
                                  fontSize: 13, color: SIMEopsColors.muted),
                            ),
                          ),
                        ],
                      )
                    : ListView(
                        controller: _scrollCtrl,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(bottom: 80),
                        children: rows,
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
              backgroundColor: SIMEopsColors.teal,
              onPressed: _markAllAsRead,
              tooltip: 'Marcar todas como lidas',
              child: const Icon(Icons.done_all, color: Colors.white, size: 20),
            ),
          ),
      ],
    );
  }
}
