import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/news_item.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/local_db_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/date_grouping.dart';
import '../../../core/widgets/esqueleto.dart';
import '../../../core/widgets/fio_agrupado.dart';
import '../feed_filtro.dart';
import '../widgets/take_card.dart';

class FeedScreen extends StatefulWidget {
  /// Se fornecido, fixa o filtro de cidade (usado no CityDetailScreen)
  final String? cityFilter;

  /// Se fornecido, filtra por lista de cidades (usado em grupos)
  final List<String>? citiesFilter;

  /// O recorte (categorias + só não lidas). Vive na tela da cidade porque o
  /// botão que o abre está na linha de cadernos, e porque assim ele sobrevive
  /// à troca de cidade dentro do grupo. Ver [FeedFiltro].
  final FeedFiltro filtro;

  const FeedScreen({
    super.key,
    required this.filtro,
    this.cityFilter,
    this.citiesFilter,
  });

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

  FeedFiltro get _filtro => widget.filtro;

  // Grupos cujo estado expandido o usuário inverteu (toggle sobre o default).
  final Set<String> _toggledGroups = {};

  @override
  void initState() {
    super.initState();
    _loadCached();
    _refresh();
    _scrollCtrl.addListener(_onScroll);
    _filtro.addListener(_onFiltroMudou);
  }

  @override
  void dispose() {
    _filtro.removeListener(_onFiltroMudou);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onFiltroMudou() {
    if (mounted) setState(() {});
  }

  /// A folha do filtro precisa saber quantas ocorrências tem cada categoria, e
  /// quem sabe isso é aqui. Publicado a cada carga — nunca durante o build,
  /// que dispararia `notifyListeners` no meio de um frame.
  void _publicarContagens() {
    final counts = <String, int>{};
    for (final n in _news) {
      final cat = n.categoriaGrupo ?? 'institucional';
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    _filtro.publicarContagens(counts);
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

      items.sort(maisRecentePrimeiro);
      setState(() {
        _news.clear();
        _news.addAll(items);
        _offset = items.length;
        _hasMore = items.length >= _limit;
        _initialLoad = false;
      });
      _publicarContagens();
    } catch (e) {
      if (mounted) {
        setState(() => _initialLoad = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Erro ao carregar: $e')));
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
        _news.sort(maisRecentePrimeiro);
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
    } catch (e) {
      debugPrint('[Feed] Mark read error: $e');
    }
  }

  bool _groupExpanded(NewsGroup g) =>
      _toggledGroups.contains(g.key) ? !g.defaultExpanded : g.defaultExpanded;

  void _toggleGroup(String key) {
    setState(() {
      if (!_toggledGroups.add(key)) _toggledGroups.remove(key);
    });
  }

  List<NewsItem> get _visibleNews => _news.where((n) {
    if (_filtro.apenasNaoLidas && !n.isUnread) return false;
    if (_filtro.categorias.isNotEmpty &&
        !_filtro.categorias.contains(n.categoriaGrupo ?? 'institucional')) {
      return false;
    }
    return true;
  }).toList();

  @override
  Widget build(BuildContext context) {
    if (_initialLoad) {
      return const EsqueletoDoFio();
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
    final groups = groupNewsByDate(_visibleNews);

    // O laço de desenhar grupo/semana/divisória mora em `fio_agrupado.dart`,
    // compartilhado com o resultado da consulta. Aqui fica só o que é desta
    // tela: como é o card e onde mora o estado de aberto.
    final rows = linhasDoFioAgrupado(
      grupos: groups,
      aberto: _groupExpanded,
      alternar: _toggleGroup,
      separador: const TakeRule(),
      card: (item) => TakeCard(
        news: item,
        urgent: TakeCard.isUrgent(item),
        // A lista é agrupada por data logo acima, então o item mostra só a
        // hora — carimbar "31/07" dentro do grupo "31 JUL" era repetir.
        groupedByDate: true,
        onOpen: () => _markAsRead(item),
      ),
    );
    if (_hasMore) {
      rows.add(
        const Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    } else {
      // Sem marca de fim: o que dizia "acabou" era um carimbo, e a lista
      // acabando já diz isso. Sobra o ar do rodapé.
      rows.add(const SizedBox(height: 40));
    }

    return Stack(
      children: [
        Column(
          children: [
            // A barra de chips de categoria saiu daqui: era a quarta faixa de
            // controle empilhada antes da primeira manchete, com cor, contagem
            // e um toggle, permanente, pra um filtro quase sempre desligado.
            // Virou o `FILTRAR` da linha de cadernos + a folha de recorte.
            //
            // Sobra esta linha, e **só quando existe recorte** — sem filtro não
            // há nada a dizer, e dizer "todas as categorias" era outro rótulo
            // que aparece sempre e por isso não informa.
            if (_filtro.ativo)
              Container(
                width: double.infinity,
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
                ),
                padding: const EdgeInsets.fromLTRB(18, 9, 18, 9),
                child: Text(
                  _filtro.descricao,
                  style: SIMEopsType.slug(color: SIMEopsColors.tealLight),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
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
                            'de fora do recorte atual.',
                            style: SIMEopsType.lead(),
                          ),
                          const SizedBox(height: 24),
                          OutlinedButton(
                            onPressed: _filtro.limpar,
                            child: const Text('SOLTAR O RECORTE'),
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 15,
                    vertical: 13,
                  ),
                  child: Text(
                    'MARCAR TODAS LIDAS',
                    style: SIMEopsType.placeTab(
                      active: false,
                    ).copyWith(color: SIMEopsColors.muted),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
