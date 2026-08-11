import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/models/crime_point.dart';
import '../../../core/models/executive_data.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/utils/type_helpers.dart';
import '../../../core/widgets/crime_radar_map.dart';
import '../../../core/widgets/executive_indicators.dart';
import '../../../core/widgets/fontes_analisadas.dart';
import '../../../core/widgets/live_dot.dart';
import '../../../core/widgets/report_pieces.dart';
import '../../../core/widgets/weekly_trend_bars.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../feed/feed_filtro.dart';
import '../../feed/screens/feed_screen.dart';

class CityDetailScreen extends StatefulWidget {
  final CityOverview city;

  const CityDetailScreen({super.key, required this.city});

  @override
  State<CityDetailScreen> createState() => _CityDetailScreenState();
}

class _CityDetailScreenState extends State<CityDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Relatorio data
  Map<String, dynamic>? _summary;
  List<dynamic>? _trend;
  bool _loadingOverview = true;

  /// Janela do relatório da cidade, em dias. `null` = **desde o início**.
  ///
  /// Existia uma constante `30` chumbada em **três lugares** (`_loadOverview`,
  /// `_loadMapPoints` e o `rangeDays` do executivo), e ao lado delas um
  /// `_trendPeriod` que ia até 1 ano — mas mexia **só no gráfico de volume**.
  /// Ou seja: a página inteira dizia "30 dias" com um gráfico embaixo dizendo
  /// "1 ano", e nada na tela avisava. Dois períodos numa página é pior que um
  /// período errado, porque o leitor soma os dois sem saber.
  ///
  /// Agora é um só, no topo do relatório, e ele move tudo — números, mapa,
  /// bairros, volume e indicadores.
  int? _relatorioDias = 30;

  /// Teto de segurança do "desde o início", em dias.
  ///
  /// 🚨 Aqui havia `_inicioDosTempos = '2000-01-01'`, com a lógica de que
  /// qualquer data anterior ao banco devolve tudo. Só que o backend recusa
  /// janela acima de `JANELA_MAXIMA_DIAS = 3700` (`validation.ts:69`), e do ano
  /// 2000 até hoje são **9.719 dias**: `crime-summary` e `crime-trend` voltavam
  /// **400**, o `.catchError` engolia, e o `TUDO` abria o relatório zerado —
  /// com o mapa cheio de pinos em cima, porque `map-points` não tem esse teto e
  /// o executivo mandava `3650` e passava raspando.
  ///
  /// Só entra em cena quando a cidade não diz desde quando é monitorada
  /// (backend anterior a 10/08) ou quando a primeira ocorrência é absurda.
  static const _tetoDoTudo = 3650;

  /// Quantos dias o `TUDO` pede: **desde a primeira ocorrência da cidade**.
  ///
  /// É a data exata em que essa cidade entrou no monitoramento, não um chute
  /// de dez anos — o mesmo campo que decide quais janelas cabem na fila.
  /// O piso de 7 é exigência do schema do executivo (`rangeDays` mínimo).
  int get _diasDoTudo {
    final desde = widget.city.primeiraOcorrencia;
    if (desde == null) return _tetoDoTudo;
    return DateTime.now().difference(desde).inDays.clamp(7, _tetoDoTudo);
  }

  // Radar de ocorrências — pontos vem do backend já geocodados
  List<CrimePoint> _mapPoints = [];
  bool _mapLoading = false;

  // Executive (indicadores + resumo) — cacheado no backend
  ExecutiveData _executive = ExecutiveData.empty();
  bool _executiveLoading = false;

  // For groups: selected sub-city filter
  String? _selectedSubCity;

  // ⚠️ Aqui existiu o `_statPeriod`, janela só do número do cabeçalho, com o
  // menu `_PeriodCount` (`21 EM 30D ▾`) e o enum `StatPeriod`. Eram **dois
  // controles de janela na mesma tela** que não se falavam — cabeçalho em 30
  // dias e relatório em 90 mostravam dois números certos sobre a mesma cidade,
  // sem nada dizendo qual media o quê. O cabeçalho passou a dizer o acumulado,
  // que é fato fixo, e a janela ficou só com o relatório.

  /// Cabeçalho recolhido pela rolagem. Ver [_onScroll].
  bool _collapsed = false;

  /// O recorte do feed. Mora aqui, e não no `FeedScreen`, por dois motivos: o
  /// botão que o abre está na linha de cadernos (que é desta tela), e assim ele
  /// **sobrevive à troca de cidade** dentro do grupo — quem filtrou Segurança
  /// quer ver Segurança em Palhoça também.
  final _filtro = FeedFiltro();

  /// As cidades que o relatório soma — **ele herda a aba**, igual ao feed.
  ///
  /// `TODAS` num grupo são as quatro cidades; uma aba escolhida é só ela.
  ///
  /// Era um `_activeCidade` que, com `TODAS` selecionada, devolvia a **primeira
  /// cidade do grupo**. Na Grande Florianópolis o cabeçalho dizia `21 EM 30D` e
  /// o relatório logo abaixo abria com `12` — dois números verdadeiros medindo
  /// coisas diferentes, e nada na tela dizendo qual era qual.
  List<String> get _cidadesDoRelatorio {
    if (_selectedSubCity != null) return [_selectedSubCity!];
    final nomes = widget.city.cityNames;
    if (widget.city.isGroup && nomes != null && nomes.isNotEmpty) return nomes;
    return [widget.city.name];
  }

  bool get _isGroup => widget.city.isGroup;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      // O caderno ativo é desenhado à mão (não é mais TabBar), então precisa
      // de rebuild — inclusive no arraste, que muda o índice sem passar pelo
      // onTap.
      if (mounted) setState(() {});
      // Lazy load: so carrega overview quando o usuario abre a tab
      if (_tabController.index == 1 && _loadingOverview && _summary == null) {
        _loadOverview();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _dateStr(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// Início da janela, no formato que o backend espera.
  String get _relatorioDe =>
      _dateStr(DateTime.now().subtract(Duration(days: _relatorioRangeDays)));

  /// `rangeDays` do executivo — ele é chave de cache no backend, então "desde
  /// o início" precisa de um número, não de nulo.
  ///
  /// As quatro rotas do relatório (`crime-summary`, `crime-trend`,
  /// `map-points`, `executive`) saem daqui. Eram duas contas separadas — uma em
  /// data, outra em número — que discordavam justamente no `TUDO`.
  int get _relatorioRangeDays => _relatorioDias ?? _diasDoTudo;

  /// Troca a janela e recarrega **tudo** — era só o gráfico de volume.
  void _mudarJanela(int? dias) {
    if (_relatorioDias == dias) return;
    setState(() => _relatorioDias = dias);
    _loadOverview();
  }

  Future<void> _loadOverview() async {
    setState(() => _loadingOverview = true);
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();

      final summary = await api
          .getCrimeSummary(_cidadesDoRelatorio, _relatorioDe, _dateStr(now))
          .catchError((_) => <String, dynamic>{});

      if (mounted) {
        setState(() {
          _summary = summary;
          _loadingOverview = false;
        });
        _loadMapPoints();
        _loadTrend();
        _loadExecutive();
      }
    } catch (e) {
      debugPrint('[CityDetail] Relatorio error: $e');
      if (mounted) setState(() => _loadingOverview = false);
    }
  }

  Future<void> _loadExecutive() async {
    final estado = widget.city.parentState ?? '';
    if (estado.isEmpty) return;
    setState(() => _executiveLoading = true);
    try {
      final api = context.read<ApiService>();
      final raw = await api.getExecutive(
        cidades: _cidadesDoRelatorio,
        estado: estado,
        rangeDays: _relatorioRangeDays,
      );
      if (!mounted) return;
      setState(() {
        _executive = ExecutiveData.fromJson(raw);
        _executiveLoading = false;
      });
    } catch (e) {
      debugPrint('[CityDetail] Executive error: $e');
      if (mounted) setState(() => _executiveLoading = false);
      // Fail silent — seção some, não atrapalha o resto do relatório.
    }
  }

  Future<void> _loadTrend() async {
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final trendData = await api
          .getCrimeTrend(_cidadesDoRelatorio, _relatorioDe, _dateStr(now))
          .catchError((_) => <String, dynamic>{});
      if (mounted) {
        setState(() {
          // Backend retorna { dataPoints: [...] } via getCrimeTrend.
          // Antes lia 'trend' (campo inexistente) — chart ficava sempre vazio.
          _trend = trendData['dataPoints'] as List<dynamic>? ?? [];
        });
      }
    } catch (e) {
      debugPrint('[CityDetail] Trend error: $e');
    }
  }

  // Radar: backend geocoda + devolve lista pronta (CrimePoint).
  // Segue a MESMA janela do resto do relatório.
  Future<void> _loadMapPoints() async {
    final estado = widget.city.parentState ?? '';
    if (estado.isEmpty) return;

    setState(() => _mapLoading = true);
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final raw = await api.getMapPoints(
        cidades: _cidadesDoRelatorio,
        estado: estado,
        dateFrom: _relatorioDe,
        dateTo: _dateStr(now),
      );
      if (!mounted) return;
      setState(() {
        _mapPoints = raw.map(CrimePoint.fromJson).toList();
        _mapLoading = false;
      });
    } catch (e) {
      debugPrint('[CityDetail] Map points error: $e');
      if (mounted) setState(() => _mapLoading = false);
    }
  }

  void _onSubCityChanged(String? city) {
    setState(() => _selectedSubCity = city);
    _loadOverview();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _buildWireHeader(),
            if (_isGroup) _buildPlacesRow(),
            _buildCadernos(),
            Expanded(
              // Escuta a rolagem que SOBE dos filhos, sem tomar posse do
              // controller de nenhum deles. É o que permite o cabeçalho
              // encolher sem `NestedScrollView` + `SliverAppBar` — que
              // exigiria reescrever o `FeedScreen` e o `RefreshIndicator`
              // de cada aba, dois riscos por um ganho de layout.
              child: NotificationListener<ScrollNotification>(
                onNotification: _onScroll,
                child: TabBarView(
                  controller: _tabController,
                  children: [_buildFeedTab(), _buildOverviewTab()],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Encolhe o cabeçalho ao rolar, devolvendo ~85px de tela durante a leitura.
  ///
  /// Só rolagem **vertical**: o arrasto horizontal do `TabBarView` também
  /// emite `ScrollNotification`, e sem o filtro trocar de aba encolheria o
  /// cabeçalho. Histerese (56 pra fechar, 24 pra abrir) evita o tremor de
  /// abre-e-fecha quando a rolagem para exatamente no limiar.
  ///
  /// Devolve `false` de propósito: a notificação segue subindo, e o
  /// `RefreshIndicator` de cada aba continua funcionando.
  bool _onScroll(ScrollNotification n) {
    if (n.metrics.axis != Axis.vertical) return false;
    final p = n.metrics.pixels;
    if (!_collapsed && p > 56) {
      setState(() => _collapsed = true);
    } else if (_collapsed && p < 24) {
      setState(() => _collapsed = false);
    }
    return false;
  }

  /// Cabeçalho do fio: seta + marca, nome da cidade em corpo grande, a contagem
  /// do período, e o filete branco de 2px que fecha o bloco.
  ///
  /// Substitui a `AppBar` centralizada. O nome da cidade é o dado mais
  /// importante da tela e estava a 18px no meio de uma barra de 56px; agora
  /// abre a página a 30px, ancorado à esquerda como manchete de primeira.
  ///
  /// **A linha de estado: o problema era a COR, não a informação.**
  ///
  /// Primeira tentativa (08/08) foi apagar `SC`, `18 NOVAS` e o ponto verde,
  /// por serem repetição da tela anterior. Errado — comparando com o protótipo
  /// de referência ficou claro o que fazia a linha dele funcionar e a nossa
  /// não: **lá é tudo uma tinta só, costurado por `·`**; aqui eram três
  /// widgets em três cores (UF em `muted`, a contagem em branco com ícone,
  /// `18 NOVAS` em verde-claro). Três cores numa faixa de 9.5px é o que
  /// pesava, não os três dados.
  ///
  /// Agora: `● ÚLTIMA HÁ 2H` de um lado, `SC · 107 EM 30D ▾ · 18 NOVAS` do
  /// outro, tudo em `faint`. A contagem segue clicável — só parou de gritar.
  Widget _buildWireHeader() {
    final c = widget.city;

    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: SIMEopsColors.white, width: 2),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        18,
        _collapsed ? 2 : 8,
        18,
        _collapsed ? 6 : 12,
      ),
      child: AnimatedSize(
        duration: const Duration(milliseconds: 170),
        curve: Curves.easeOut,
        alignment: Alignment.topCenter,
        child: _collapsed ? _headerCompact(c) : _headerFull(c),
      ),
    );
  }

  Widget _headerCompact(CityOverview c) {
    return Row(
      key: const ValueKey('compacto'),
      children: [
        _backButton(),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            c.name,
            style: SIMEopsType.titleCompact(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _headerFull(CityOverview c) {
    final uf = c.parentState != null ? abbrState(c.parentState!) : null;

    return Column(
      key: const ValueKey('inteiro'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _backButton(),
            const SizedBox(width: 4),
            Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'SIME'),
                  TextSpan(
                    text: 'OPS',
                    style: TextStyle(color: SIMEopsColors.greenLight),
                  ),
                ],
              ),
              style: SIMEopsType.wordmark(size: 14),
            ),
          ],
        ),
        const SizedBox(height: 9),
        Text(c.name, style: SIMEopsType.title()),
        Row(
          children: [
            const LiveDot(),
            const SizedBox(width: 6),
            // ⚠️ `lastNewsAt` é o created_at da ocorrência mais recente, NÃO a
            // hora da varredura. Por isso o rótulo é "ÚLTIMA", não "VARREDURA":
            // cidade quieta com o scan rodando normalmente diria "VARREDURA HÁ
            // 3D" e faria o robô parecer parado.
            Text(
              c.lastNewsAt != null
                  ? 'ÚLTIMA ${_agoLabel(c.lastNewsAt!)}'
                  : 'MONITORANDO',
              style: SIMEopsType.slug(color: SIMEopsColors.faint),
            ),
            const Spacer(),
            // Costurado por "·" numa tinta só, como no protótipo. Cada peça em
            // sua cor era o que fazia a faixa brigar consigo mesma.
            if (uf != null)
              Text(
                '$uf · ',
                style: SIMEopsType.slug(color: SIMEopsColors.faint),
              ),
            // 🚨 Aqui morava o `_PeriodCount` — `21 EM 30D ▾`, um menu que
            // alternava entre 30 dias e o acumulado.
            //
            // Ele era **um segundo controle de janela**, e o relatório logo
            // abaixo já tem o dele (`7D 30D 90D 1A TUDO`). Os dois não
            // conversavam: dava pra ficar com o cabeçalho dizendo 21 e o
            // relatório dizendo 60, na mesma tela, sobre a mesma cidade.
            //
            // Agora o cabeçalho diz um **fato fixo** — quanto esta cidade
            // acumulou desde o início — e quem manda na janela é o relatório,
            // que é onde a pergunta "em que período?" faz sentido.
            Text(
              '${c.totalCrimes} '
              '${c.totalCrimes == 1 ? 'OCORRÊNCIA' : 'OCORRÊNCIAS'}',
              style: SIMEopsType.slug(color: SIMEopsColors.faint),
            ),
            if (c.unreadCount > 0)
              Text(
                ' · ${c.unreadCount} ${c.unreadCount == 1 ? 'NOVA' : 'NOVAS'}',
                style: SIMEopsType.slug(color: SIMEopsColors.faint),
              ),
          ],
        ),
      ],
    );
  }

  static String _agoLabel(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 60) return 'AGORA';
    if (d.inHours < 24) return 'HÁ ${d.inHours}H';
    return 'HÁ ${d.inDays}D';
  }

  Widget _backButton() => InkWell(
    onTap: () => Navigator.of(context).pop(),
    child: const Padding(
      padding: EdgeInsets.all(8),
      child: Icon(
        Icons.arrow_back_ios_new,
        size: 17,
        color: SIMEopsColors.muted,
      ),
    ),
  );

  /// As cidades do grupo. Rola na horizontal com degradê na borda direita —
  /// sem ele o scroll é invisível e o usuário nunca descobre que existe
  /// cidade cortada (Grande Goiânia tem 7).
  Widget _buildPlacesRow() {
    final names = widget.city.cityNames ?? const <String>[];
    return SizedBox(
      height: 40,
      child: ShaderMask(
        shaderCallback: (rect) => const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [Colors.white, Colors.white, Colors.transparent],
          stops: [0, 0.9, 1],
        ).createShader(rect),
        blendMode: BlendMode.dstIn,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(18, 12, 34, 0),
          children: [
            // `Todas` não leva número: o total já está no cabeçalho, uma linha
            // acima. Duas cópias do mesmo 18 na mesma dobra é o defeito que a
            // faixa de categoria tinha antes de virar folha.
            _PlaceTab(
              label: 'Todas',
              selected: _selectedSubCity == null,
              onTap: () => _onSubCityChanged(null),
            ),
            ...names.map(
              (c) => _PlaceTab(
                label: c,
                selected: _selectedSubCity == c,
                naoLidas: widget.city.naoLidasPorCidade[c] ?? 0,
                onTap: () => _onSubCityChanged(c),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Notícias | Relatório — em corpo de texto, não em caixa alta de `TabBar`.
  /// É a decisão mais permanente da tela e merece o maior peso depois do nome.
  ///
  /// O `FILTRAR` mora aqui, no espaço vazio à direita, e não numa faixa
  /// própria: a tela tinha **quatro faixas de controle** empilhadas antes da
  /// primeira manchete (abas de cidade, cadernos, chips de categoria e o
  /// `NÃO LIDAS`). A quarta virou este link. Ver [FeedFiltro].
  Widget _buildCadernos() {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
      ),
      padding: const EdgeInsets.fromLTRB(18, 15, 18, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < 2; i++) ...[
            InkWell(
              onTap: () => setState(() => _tabController.animateTo(i)),
              child: Container(
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: _tabController.index == i
                          ? SIMEopsColors.greenLight
                          : Colors.transparent,
                      width: 2,
                    ),
                  ),
                ),
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  i == 0 ? 'Notícias' : 'Relatório',
                  style: SIMEopsType.tab(active: _tabController.index == i),
                ),
              ),
            ),
            if (i == 0) const SizedBox(width: 22),
          ],
          const Spacer(),
          // Só no caderno de notícias: o relatório tem o período dele.
          if (_tabController.index == 0)
            InkWell(
              onTap: () => FolhaFiltro.abrir(context, _filtro),
              child: Padding(
                padding: const EdgeInsets.only(bottom: 11, left: 10),
                child: Text(
                  'FILTRAR',
                  style: SIMEopsType.slug(
                    color: _filtro.ativo
                        ? SIMEopsColors.greenLight
                        : SIMEopsColors.tealLight,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFeedTab() {
    if (_isGroup && _selectedSubCity == null) {
      // "Todas" — mostrar noticias de todas as cidades do grupo
      return FeedScreen(
        key: const ValueKey('group-all'),
        filtro: _filtro,
        citiesFilter: widget.city.cityNames,
      );
    }
    final cidade = _isGroup ? _selectedSubCity! : widget.city.name;
    return FeedScreen(
      key: ValueKey(cidade),
      filtro: _filtro,
      cityFilter: cidade,
    );
  }

  /// A aba Relatório da cidade — **a mesma peça** do relatório da busca manual.
  ///
  /// As duas telas desenhavam o mesmo relatório em código separado: dois
  /// donuts, dois rankings de bairro, dois `_statBox`, dois `_sectionTitle`.
  /// Foi assim que esta aqui acabou com uma **terceira tabela de cores** só
  /// dela (achada em 08/08) — quando o desenho é copiado, a correção chega numa
  /// cópia só. Agora as duas montam de `core/widgets/report_pieces.dart`.
  ///
  /// A diferença que sobra é a origem dos números: aqui eles vêm agregados pelo
  /// backend (`/analytics/crime-summary`, janela fixa de 30 dias); lá são
  /// calculados no aparelho a partir do resultado da consulta.
  Widget _buildOverviewTab() {
    if (_loadingOverview) {
      return const Center(child: CircularProgressIndicator());
    }

    final types = (_summary?['byCrimeType'] as List<dynamic>?) ?? [];
    final categories = (_summary?['byCategory'] as List<dynamic>?) ?? [];
    final bairros = (_summary?['topBairros'] as List<dynamic>?) ?? [];
    final totalCrimes = safeInt(_summary?['totalCrimes']);

    // O backend já manda {category, count, percentage} agrupado — não recalcula.
    final porCategoria = <String, int>{
      for (final c in categories)
        (c['category'] as String? ?? 'institucional'): safeInt(c['count']),
    };

    final rankBairros =
        (bairros.toList()..sort(
              (a, b) => safeInt(b['count']).compareTo(safeInt(a['count'])),
            ))
            .map(
              (b) => (
                (b['bairro'] as String? ?? 'Desconhecido'),
                safeInt(b['count']),
              ),
            )
            .toList();

    return RefreshIndicator(
      onRefresh: _loadOverview,
      color: SIMEopsColors.teal,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 20),
        children: [
          // Abre com uma frase montada dos próprios números, não com gráfico.
          // Eram quatro caixinhas (`107 / OCORRÊNCIAS`, `18 / BAIRROS`) que
          // obrigam quem lê a montar sozinho a leitura — e nenhuma delas dizia
          // a coisa mais importante, que é de onde o número vem.
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$totalCrimes', style: SIMEopsType.hero()),
                const SizedBox(height: 7),
                Text(
                  _fraseDaCidade(totalCrimes, rankBairros.length, types.length),
                  style: SIMEopsType.lead().copyWith(fontSize: 15),
                ),
              ],
            ),
          ),
          JanelaDoRelatorio(
            dias: _relatorioDias,
            onMudar: _mudarJanela,
            primeiraOcorrencia: widget.city.primeiraOcorrencia,
          ),

          if (porCategoria.isNotEmpty)
            BlocoRelatorio(
              titulo: 'Por categoria',
              child: RoscaCategorias(
                contagens: porCategoria,
                total: totalCrimes,
              ),
            ),

          if (rankBairros.isNotEmpty)
            BlocoRelatorio(
              titulo: 'Bairros mais citados',
              child: RankBarras(itens: rankBairros.take(8).toList()),
            ),

          if (_mapPoints.isNotEmpty)
            BlocoRelatorio(
              titulo: 'Distribuição no mapa',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 12),
                  CrimeRadarMap(points: _mapPoints),
                  const SizedBox(height: 9),
                  // A precisão do ponto, declarada. Um mapa que desenha 18 de
                  // 25 itens sem dizer isso deixa quem lê concluir que a
                  // cidade inteira está ali.
                  //
                  // Sem a explicação "o resto não traz bairro": ela era falsa
                  // nas duas telas — item sem bairro entra no mapa, no centro
                  // da cidade, com `precisao: 'cidade'`. Quem não entra é quem
                  // o geocode não conseguiu situar.
                  Text(
                    '${_mapPoints.length} de $totalCrimes '
                    '${totalCrimes == 1 ? 'ocorrência entrou' : 'ocorrências entraram'} '
                    'no mapa.',
                    style: SIMEopsType.note(color: SIMEopsColors.faint),
                  ),
                ],
              ),
            )
          else if (_mapLoading)
            const BlocoRelatorio(
              titulo: 'Distribuição no mapa',
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: SIMEopsColors.teal,
                    ),
                  ),
                ),
              ),
            ),

          BlocoRelatorio(titulo: 'Volume no tempo', child: _buildTendencia()),

          if (_executiveLoading || !_executive.isEmpty)
            BlocoRelatorio(
              titulo: 'Indicadores da região',
              child: Padding(
                padding: const EdgeInsets.only(top: 12),
                child: ExecutiveIndicators(
                  data: _executive,
                  showHeader: false,
                  loading: _executiveLoading,
                ),
              ),
            ),

          _buildFontesAnalisadas(),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  /// A frase de abertura, montada dos números da própria cidade.
  ///
  /// A ressalva metodológica vem **na primeira dobra**, não num rodapé: o
  /// número aqui é o que a imprensa publicou, e quem for citá-lo numa reunião
  /// precisa saber disso antes.
  String _fraseDaCidade(int total, int bairros, int tipos) {
    // A frase segue a janela — dizer "nos últimos 30 dias" com o seletor em
    // TUDO seria a mesma mentira que o carimbo `00:00` contava.
    final d = _relatorioDias;
    final janela = d == null
        ? 'desde o início do monitoramento'
        : d == 365
        ? 'no último ano'
        : 'nos últimos $d dias';

    if (total == 0) {
      return 'Nenhuma ocorrência publicada $janela. Cidade quieta '
          'na imprensa não é cidade sem ocorrência — é o que não virou notícia.';
    }
    final b = StringBuffer();
    b.write(total == 1 ? 'ocorrência publicada' : 'ocorrências publicadas');
    b.write(' $janela');
    if (bairros > 0) {
      b.write(', em $bairros ${bairros == 1 ? 'bairro' : 'bairros'}');
    }
    if (tipos > 0) {
      b.write(' e $tipos ${tipos == 1 ? 'tipo' : 'tipos'} de ocorrência');
    }
    b.write(
      '. É o que a imprensa noticiou — não o total registrado pelas '
      'polícias.',
    );
    return b.toString();
  }

  // ── Fontes Analisadas (uniforme com report_screen) ──
  // Backend retorna sources agrupados por hostname em /analytics/crime-summary:
  // [{ name, count, urls, type: 'oficial'|'midia' }]. Aqui só separa oficiais
  // de mídias, ordena por count, e joga no widget compartilhado.

  Widget _buildFontesAnalisadas() {
    final raw = (_summary?['sources'] as List<dynamic>?) ?? const [];
    if (raw.isEmpty) return const SizedBox.shrink();

    final oficiais = <Map<String, String>>[];
    final midias = <Map<String, String>>[];
    for (final s in raw) {
      final m = s as Map<String, dynamic>;
      final entry = <String, String>{
        'name': (m['name'] as String?) ?? '',
        'count': (m['count'] ?? 1).toString(),
      };
      if ((m['type'] as String?) == 'oficial') {
        oficiais.add(entry);
      } else {
        midias.add(entry);
      }
    }

    int cmp(Map<String, String> a, Map<String, String> b) =>
        int.parse(b['count']!).compareTo(int.parse(a['count']!));
    oficiais.sort(cmp);
    midias.sort(cmp);

    return FontesAnalisadas(oficiais: oficiais, midias: midias);
  }

  /// Volume no tempo.
  ///
  /// Perdeu o seletor próprio: ele tinha quatro períodos que moviam **só este
  /// gráfico**, enquanto o resto da página ficava preso em 30 dias. Agora
  /// quem manda é a [JanelaDoRelatorio] lá em cima, e ela move tudo junto.
  Widget _buildTendencia() {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: WeeklyTrendBars(
        data: (_trend ?? const [])
            .map((e) => e as Map<String, dynamic>)
            .toList(),
      ),
    );
  }
}

/// Cidade do grupo. Era cápsula arredondada teal (`_SubCityChip`) — a peça
/// mais Material da tela. Vira rótulo em mono com filete embaixo: o mesmo
/// vocabulário das outras faixas de controle, e ocupa metade da altura.
class _PlaceTab extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  /// Não-lidas daquela cidade. Zero (ou backend antigo) não desenha nada — a
  /// aba volta a ser só o nome. Um `0` ao lado de cada nome seria a mesma
  /// poluição que o `00:00` do carimbo: espaço gasto pra dizer nada.
  final int naoLidas;

  const _PlaceTab({
    required this.label,
    required this.selected,
    required this.onTap,
    this.naoLidas = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 17),
      child: InkWell(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: selected ? SIMEopsColors.greenLight : Colors.transparent,
                width: 1.5,
              ),
            ),
          ),
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                label.toUpperCase(),
                style: SIMEopsType.placeTab(active: selected),
              ),
              // O número é o motivo da fila existir: ele diz ONDE olhar. Fica
              // no verde das não-lidas mesmo na aba não selecionada — é a única
              // coisa da faixa que precisa ser vista sem ser procurada.
              if (naoLidas > 0) ...[
                const SizedBox(width: 6),
                Text(
                  '$naoLidas',
                  style: SIMEopsType.placeTab(
                    active: true,
                    color: SIMEopsColors.greenLight,
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

// O `_LiveDot` (ponto verde que pulsava ao lado de "ÚLTIMA HÁ 2H") foi
// removido em 08/08, e vale registrar por quê, porque a tentação de trazer de
// volta é grande: ele nunca apagava. Um indicador que está sempre no mesmo
// estado não informa nada — é a mesma armadilha do "1 FONTE" e do selo "NOVA".
//
// Ele só ganharia o lugar de volta podendo ficar âmbar, e para isso precisa de
// um dado que hoje NÃO existe: a hora da última varredura. O que o app tem é
// `lastNewsAt`, o `created_at` da ocorrência mais recente — que mede a
// imprensa, não o robô. Construir semáforo de saúde em cima disso seria
// reintroduzir a mesma mentira que o rótulo "VARREDURA HÁ" já contou uma vez.
//
// Se um dia valer a pena: o backend precisa expor o timestamp do scan.
