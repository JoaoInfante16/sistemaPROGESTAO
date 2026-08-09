import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/news_item.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/local_db_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/date_grouping.dart';
import '../../../core/widgets/category_filter_bar.dart';
import '../../../core/widgets/group_header.dart';
import '../widgets/take_card.dart';

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

    // Vazio NÃO é erro: cidade pequena passa dias sem ocorrência publicada, e
    // o app não pode fazer a realidade da imprensa local parecer falha dele.
    // Por isso texto explicando, e não ícone triste de "nada aqui".
    if (_news.isEmpty) {
      return RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 90, 18, 0),
          children: [
            Text('Nenhuma ocorrência\nno período', style: SIMEopsType.title()),
            const SizedBox(height: 14),
            Text(
              'A varredura roda o dia inteiro. Cidade pequena passa dias sem '
              'nada publicado — isso não é falha do app, é o volume da imprensa '
              'local.',
              style: SIMEopsType.lead(),
            ),
            const SizedBox(height: 26),
            OutlinedButton(
              onPressed: _refresh,
              child: const Text('VERIFICAR AGORA'),
            ),
          ],
        ),
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
        for (var i = 0; i < g.items.length; i++) {
          final item = g.items[i];
          rows.add(TakeCard(
            news: item,
            urgent: TakeCard.isUrgent(item),
            // A lista é agrupada por data logo acima, então o item mostra só
            // a hora — carimbar "31/07" dentro do grupo "31 JUL" era repetir.
            groupedByDate: true,
            onOpen: () => _markAsRead(item),
            onToggleFavorite: () => _toggleFavorite(item),
          ));
          // Filete entre matérias, nunca depois da última: no fim do grupo
          // quem separa é o divisor de data seguinte.
          if (i < g.items.length - 1) rows.add(const TakeRule());
        }
      }
    }
    if (_hasMore) {
      rows.add(const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      ));
    } else {
      // Diz "acabou" em vez de deixar o usuário rolando achando que carrega.
      rows.add(const EndMark());
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
                  InkWell(
                    onTap: () => setState(() => _unreadOnly = !_unreadOnly),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 13, 18, 13),
                      child: Text(
                        'NÃO LIDAS',
                        style: SIMEopsType.placeTab(active: _unreadOnly)
                            .copyWith(
                          color: _unreadOnly
                              ? SIMEopsColors.greenLight
                              : SIMEopsColors.faint,
                        ),
                      ),
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
                        padding: const EdgeInsets.fromLTRB(18, 70, 18, 0),
                        children: [
                          Text('Nada no recorte', style: SIMEopsType.title()),
                          const SizedBox(height: 12),
                          Text(
                            'As ${_news.length} ocorrências carregadas ficaram '
                            'de fora dos filtros. Toque numa categoria para '
                            'soltar o recorte.',
                            style: SIMEopsType.lead(),
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
        // Era um FAB redondo teal — a peça mais "Material" da tela inteira.
        // Vira retângulo achatado com rótulo em mono: diz o que faz (o ícone
        // `done_all` não dizia) e para de flutuar por cima da leitura.
        if (hasUnread && !_markedAllRead)
          Positioned(
            right: 18,
            bottom: 18,
            child: Material(
              color: SIMEopsColors.navyLight,
              child: InkWell(
                onTap: _markAllAsRead,
                child: Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: SIMEopsColors.ruleStrong),
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
                  child: Text(
                    'MARCAR TODAS LIDAS',
                    style: SIMEopsType.placeTab(active: false)
                        .copyWith(color: SIMEopsColors.muted),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
