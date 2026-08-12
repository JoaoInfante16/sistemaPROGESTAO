import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/data/brazilian_locations.dart';
import '../../../core/models/assunto.dart';
import '../../../core/models/manual_search_results.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/crime_labels.dart';
import '../../../core/utils/datas.dart';
import '../../../core/utils/date_grouping.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/widgets/cat_chip.dart';
import '../../../core/widgets/dialogo_cancelar_consulta.dart';
import '../../../core/widgets/esqueleto.dart';
import '../../../core/widgets/fio_agrupado.dart';
import '../../../core/widgets/group_header.dart';
import '../../../core/widgets/grid_background.dart';
import '../../../core/widgets/masthead.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../widgets/assuntos_field.dart';
import '../widgets/seletor_lugar.dart';
import '../../feed/feed_filtro.dart';
import '../../feed/widgets/take_card.dart';
import '../../../core/models/news_item.dart';
import 'relatorio_de_risco.dart';

class ManualSearchScreen extends StatefulWidget {
  /// Se fornecido, retoma uma busca existente (do histórico).
  final String? resumeSearchId;

  const ManualSearchScreen({super.key, this.resumeSearchId});

  @override
  State<ManualSearchScreen> createState() => _ManualSearchScreenState();
}

class _ManualSearchScreenState extends State<ManualSearchScreen> {
  // Form
  String? _selectedEstado;
  Set<String> _selectedCidades = {};
  int _periodoDias = 30;

  /// Data escolhida no calendário; `null` = está num dos cinco pontos.
  /// `_periodoDias` continua sendo a verdade que vai pro backend — isto só
  /// guarda de onde o número veio, pra tela poder dizer "desde 12/03".
  DateTime? _desdeQuando;
  bool _loadingLocations = true;

  // Assuntos: o que perguntar ao Google. Catálogo vem do backend; a falha ao
  // buscá-lo não impede de pesquisar (o backend cai na lista do painel).
  Taxonomia _taxonomia = const Taxonomia();
  List<String> _assuntos = [];

  // Search state
  String? _searchId;

  /// Caderno aberto: 0 = as ocorrências, 1 = o relatório. Ver [_buildCadernos].
  ///
  /// Substituiu o `_reportId`, que existia só pra decidir se o botão dizia
  /// "gerar" ou "ver" um relatório que sempre existiu — ele é calculado do
  /// resultado que já está na mão, não gerado sob demanda. O `report_id` do
  /// backend continua importando **só** na hora de compartilhar, e isso mora
  /// dentro do próprio relatório.
  int _caderno = 0;
  // idle, loading, processing, completed, failed, cancelled
  String _searchStatus = 'idle';
  // Resposta crua do /results, com os três baldes SEMPRE separados (regra do
  // contrato). O ReportScreen recebe .results como veio; .foraDoPeriodo cru
  // alimenta o re-fatiamento por período (9.6).
  ManualSearchResults _searchData = const ManualSearchResults();
  // Os mesmos baldes convertidos uma vez (não por itemBuilder).
  List<NewsItem> _items = [];
  List<NewsItem> _regiaoItems = [];
  List<NewsItem> _foraItems = [];
  // Recorte da lista: a MESMA folha do feed (`FILTRAR`), não uma barra de
  // chips própria. A tela de resultado tinha a `CategoryFilterBar` fixa — cinco
  // fichas com cor e contagem permanentes na tela para um filtro que quase
  // sempre está desligado. Mora aqui e não no `FeedFiltro` global porque o
  // recorte de uma consulta morre com ela.
  final FeedFiltro _filtro = FeedFiltro();
  final Set<String> _toggledSections = {};

  /// Chaves dos achados que já passaram pela janela do worker — a contagem
  /// real do "já encontrado". Ver [_ingestAchados].
  final Set<String> _achadosVistos = {};

  /// Os últimos achados, pra mostrar. Janela, não histórico: ver [_ingestAchados].
  final List<Map<String, dynamic>> _achadosRecentes = [];
  Map<String, dynamic>? _progress;
  Timer? _pollTimer;
  DateTime? _searchStartTime;
  Timer? _elapsedTimer;
  String _elapsedText = '0s';
  final Map<int, String> _stageDetails = {};
  // Timestamp de quando cada stage começou — usado pra mostrar
  // [HH:MM:SS] + duração por stage na progress view.
  final Map<int, DateTime> _stageStartTimes = {};
  int _consecutiveErrors = 0;
  // Desistir por ESTAGNAÇÃO, não por relógio (regra do briefing/contrato):
  // enquanto stage_num, feitos ou atualizado_em avançarem, a busca está viva —
  // não importa se leva 5 ou 40 minutos. Parada real por 2 min = falha.
  // (Era _maxPolls = 200 → desistia em 10 min mesmo andando; esse número
  // mágico era o que travava período de 365 dias e multi-cidade no backend.)
  DateTime? _lastAdvanceAt;
  String? _lastProgressSig;
  static const _stallTimeout = Duration(minutes: 2);
  // 20 erros * 3s = 60s de tolerância — cobre cold-start do Render e flaps
  // de rede transitórios. Antes era 5 (~15s) → dava "Erro de conexão" falso
  // quando user retomava busca via histórico durante warm-up do backend.
  static const _maxConsecutiveErrors = 20;

  // Os cinco períodos de um toque. Sem valores intermediários: o slider livre
  // que existia aqui até 03/08 errava no dedo — pedir 30 e sair com 34 foi o
  // que o motivou a sair. Quem precisa de um número fora desses usa o
  // calendário, que é preciso por natureza.
  static const _periodoMarcas = [7, 30, 60, 90, 180];

  /// Teto do backend (`validation.ts`). Passar disso toma 400.
  static const _periodoMaximoDias = 180;

  @override
  void initState() {
    super.initState();
    _loadLocations();
    _loadTaxonomia();
    if (widget.resumeSearchId != null) {
      _resumeSearch(widget.resumeSearchId!);
    }
  }

  /// Catálogo de assuntos. Falhar aqui NÃO pode impedir de buscar: sem
  /// taxonomia, o seletor some e o backend usa a lista do painel — que é
  /// exatamente o comportamento anterior a esta tela existir.
  Future<void> _loadTaxonomia() async {
    try {
      final tax = await context.read<ApiService>().getTaxonomia();
      if (mounted) setState(() => _taxonomia = tax);
    } catch (e) {
      debugPrint('[ManualSearch] taxonomia indisponível: $e');
    }
  }

  Future<void> _resumeSearch(String searchId) async {
    setState(() {
      _searchId = searchId;
      _searchStatus = 'loading';
    });

    try {
      final api = context.read<ApiService>();
      final status = await api.getManualSearchStatus(searchId);
      final s = status['status'] as String;

      // Recuperar os params originais da consulta
      final params = status['params'] as Map<String, dynamic>?;

      if (mounted) {
        setState(() {
          if (params != null) {
            _selectedEstado = params['estado'] as String?;
            final cidades = params['cidades'];
            if (cidades is List) {
              _selectedCidades = cidades.map((c) => c.toString()).toSet();
            }
            _periodoDias = (params['periodo_dias'] as num?)?.toInt() ?? 30;
          }
        });
      }

      if (s == 'completed') {
        _ingestResults(await api.getManualSearchResults(searchId));
      } else if (s == 'failed') {
        if (mounted) setState(() => _searchStatus = 'failed');
      } else if (s == 'cancelled') {
        // Sem esta linha, consulta cancelada caía no `else` de "ainda
        // processando" e o app abria a tela de espera para ficar consultando,
        // de três em três segundos, um job que o backend já tirou da fila.
        if (mounted) setState(() => _searchStatus = 'cancelled');
      } else {
        // Realmente ainda processando — reconstrói cronologia dos stages
        // anteriores a partir do history persistido, depois inicia polling.
        final progress = status['progress'] as Map<String, dynamic>?;
        if (progress != null) {
          _ingestProgressHistory(progress);
          // Quem retoma pelo histórico entra com os últimos achados na tela em
          // vez de uma seção vazia até o primeiro polling.
          _ingestAchados(progress);
        }
        if (mounted) {
          setState(() {
            _searchStatus = 'processing';
            _progress = progress;
          });
        }
        _startElapsedTimer();
        _startPolling();
      }
    } catch (_) {
      if (mounted) {
        setState(() => _searchStatus = 'failed');
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Resultados expirados ou indisponiveis'),
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _elapsedTimer?.cancel();
    _filtro.dispose();
    super.dispose();
  }

  void _startElapsedTimer() {
    // Preserva _searchStartTime se já foi setado por _ingestProgressHistory
    // (caso do resume — cronômetro precisa refletir o início real, não agora).
    _searchStartTime ??= DateTime.now();
    _elapsedTimer?.cancel();
    _elapsedTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _searchStartTime == null) return;
      final diff = DateTime.now().difference(_searchStartTime!);
      setState(() {
        if (diff.inMinutes > 0) {
          _elapsedText = '${diff.inMinutes}m ${diff.inSeconds % 60}s';
        } else {
          _elapsedText = '${diff.inSeconds}s';
        }
      });
    });
  }

  Future<void> _loadLocations() async {
    try {
      await BrazilianLocations.instance.load();
    } catch (_) {
      // Asset load failed - unlikely but handle gracefully
    }
    if (mounted) {
      setState(() => _loadingLocations = false);
    }
  }

  Future<void> _startSearch() async {
    if (_selectedEstado == null || _selectedCidades.isEmpty) return;

    final api = context.read<ApiService>();
    setState(() => _searchStatus = 'processing');

    try {
      final searchId = await api.triggerManualSearch(
        estado: _selectedEstado!,
        cidades: _selectedCidades.toList(),
        periodoDias: _periodoDias,
        assuntos: _assuntos,
      );

      setState(() => _searchId = searchId);
      _startElapsedTimer();
      _startPolling();
    } catch (e) {
      setState(() => _searchStatus = 'failed');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Erro ao iniciar busca: $e')));
      }
    }
  }

  void _ingestResults(ManualSearchResults res) {
    if (!mounted) return;
    setState(() {
      _searchStatus = 'completed';
      _searchData = res;
      _items = res.results.map(NewsItem.fromSearchResult).toList();
      _regiaoItems = res.regiao
          .map((r) => NewsItem.fromSearchResult(r, cidadeVizinha: true))
          .toList();
      _foraItems = res.foraDoPeriodo.map(NewsItem.fromSearchResult).toList();
      _filtro.limpar();
      _toggledSections.clear();
    });
    _publicarContagens();
  }

  /// A folha do recorte precisa saber quantas ocorrências tem cada categoria.
  /// Publicado ao ingerir — nunca durante o build, que dispararia
  /// `notifyListeners` no meio de um frame.
  void _publicarContagens() {
    final counts = <String, int>{};
    for (final n in _items) {
      if (n.natureza == 'estatistica') continue;
      final cat = n.categoriaGrupo ?? 'institucional';
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    _filtro.publicarContagens(counts);
  }

  // Popula _stageStartTimes + _stageDetails do `history` persistido no backend.
  // Roda tanto no polling normal quanto no _resumeSearch — quando user volta
  // via histórico, reconstrói a cronologia completa dos stages anteriores.
  void _ingestProgressHistory(Map<String, dynamic> progress) {
    final history = progress['history'] as List<dynamic>?;
    if (history == null) return;

    for (final raw in history) {
      if (raw is! Map) continue;
      final n = (raw['stage_num'] as num?)?.toInt();
      if (n == null) continue;

      final startedStr = raw['started_at'] as String?;
      if (startedStr != null && !_stageStartTimes.containsKey(n)) {
        // `started_at` é escrito pelo Node e já vem com `Z`, mas passa pelo
        // mesmo helper das outras datas — um caminho só pra ler data da API.
        final parsed = parseApiDate(startedStr);
        if (parsed != null) _stageStartTimes[n] = parsed;
      }

      final d = raw['details'] as String?;
      if (d != null) _stageDetails[n] = d;
    }

    // Se ainda não temos _searchStartTime (user retomou via histórico),
    // adota o timestamp do stage 1 pra cronômetro bater com o real.
    final s1 = _stageStartTimes[1];
    if (s1 != null && _searchStartTime == null) {
      _searchStartTime = s1;
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _consecutiveErrors = 0;
    _lastAdvanceAt = DateTime.now();
    _lastProgressSig = null;
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      if (_searchId == null) return;

      final api = context.read<ApiService>();

      try {
        final status = await api.getManualSearchStatus(_searchId!);
        _consecutiveErrors = 0;
        final s = status['status'] as String;

        // Atualizar progresso da pipeline
        final progress = status['progress'] as Map<String, dynamic>?;
        if (mounted && progress != null) {
          _ingestProgressHistory(progress);
          _ingestAchados(progress);
          setState(() => _progress = progress);
        }

        // Detecção de estagnação: assinatura do que deveria estar se mexendo.
        if (progress != null) {
          final sig =
              '${progress['stage_num']}'
              '|${progress['feitos']}'
              '|${progress['atualizado_em']}';
          if (sig != _lastProgressSig) {
            _lastProgressSig = sig;
            _lastAdvanceAt = DateTime.now();
          }
        }
        final stalled =
            _lastAdvanceAt != null &&
            DateTime.now().difference(_lastAdvanceAt!) > _stallTimeout;
        if (stalled && s == 'processing') {
          _pollTimer?.cancel();
          _elapsedTimer?.cancel();
          if (mounted) {
            setState(() => _searchStatus = 'failed');
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'A busca parou de avançar. Tente novamente ou veja o histórico.',
                ),
              ),
            );
          }
          return;
        }

        // `cancelled` fecha o polling junto: a consulta pode ter sido
        // cancelada pela lista do histórico enquanto esta tela espera.
        if (s == 'completed' || s == 'failed' || s == 'cancelled') {
          _pollTimer?.cancel();
          _elapsedTimer?.cancel();

          if (s == 'completed') {
            _ingestResults(await api.getManualSearchResults(_searchId!));
          } else {
            if (mounted) setState(() => _searchStatus = s);
          }
        }
      } catch (e) {
        _consecutiveErrors++;
        debugPrint('[ManualSearch] Poll error #$_consecutiveErrors: $e');
        if (_consecutiveErrors >= _maxConsecutiveErrors) {
          // Sem sucesso após 60s — provavelmente o backend tá fora do ar.
          // Pausa polling mas NÃO marca como failed (a busca pode estar
          // rodando bem no backend; só a conexão client→server tá ruim).
          // Mensagem orienta user a voltar depois pelo histórico.
          _pollTimer?.cancel();
          _elapsedTimer?.cancel();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Sem conexão com o servidor. Volte ao histórico quando terminar.',
                ),
              ),
            );
          }
        }
      }
    });
  }

  void _resetSearch() {
    _pollTimer?.cancel();
    _elapsedTimer?.cancel();

    // Cancelar no backend se busca em andamento
    if (_searchId != null &&
        (_searchStatus == 'processing' || _searchStatus == 'loading')) {
      final api = context.read<ApiService>();
      api.cancelSearch(_searchId!).catchError((e) {
        debugPrint('[ManualSearch] Cancel error: $e');
      });
    }

    setState(() {
      _searchId = null;

      _searchStatus = 'idle';
      _searchData = const ManualSearchResults();
      _items = [];
      _regiaoItems = [];
      _foraItems = [];
      _filtro.limpar();
      _toggledSections.clear();
      _achadosVistos.clear();
      _achadosRecentes.clear();
      _progress = null;
      _searchStartTime = null;
      _elapsedText = '0s';
      _stageDetails.clear();
      _stageStartTimes.clear();
      _consecutiveErrors = 0;
      _lastAdvanceAt = null;
      _lastProgressSig = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isFormView = _searchStatus == 'idle';

    // O topo diz **de qual consulta** se trata assim que ela começa: o nome da
    // cidade no lugar da palavra "Consulta", o recorte à esquerda e, à direita,
    // o cronômetro enquanto roda ou o número quando acaba. Antes eram sete
    // minutos encarando um título genérico enquanto a cidade pedida — a única
    // coisa que importa na tela — não aparecia em lugar nenhum.
    final cidade = _selectedCidades.isNotEmpty
        ? _selectedCidades.first
        : (_selectedEstado ?? 'Consulta');
    final uf = _selectedEstado != null ? abbrState(_selectedEstado!) : null;
    final recorte = [
      if (uf != null) uf.toUpperCase(),
      '$_periodoDias DIAS',
    ].join(' · ');
    final concluida = _searchStatus == 'completed';

    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Masthead(
              titulo: isFormView ? 'Nova consulta' : cidade,
              onVoltar: () => Navigator.of(context).pop(),
              esquerda: isFormView
                  ? null
                  : Text(
                      recorte,
                      style: SIMEopsType.slug(color: SIMEopsColors.faint),
                    ),
              // Concluída, o canto direito fica **vazio**: a contagem já é o
              // número-herói logo abaixo, em Archivo 52. `86 OCORRÊNCIAS` em
              // mono 9.5 três linhas acima de um `86` gigante é o mesmo fato
              // dito duas vezes, e a versão pequena é a que ninguém lê.
              // Enquanto roda o cronômetro fica: aí não há número embaixo.
              //
              // 🚨 `_searchStartTime == null` é o que mata o **`0S` fantasma**
              // que o João viu na foto: entre disparar a busca e o backend
              // devolver o `searchId` (o estado `loading`), o cronômetro ainda
              // não começou, e o campo exibia o valor inicial `0s` — um
              // cronômetro parado no zero enquanto a tela carrega parece app
              // travado. Sem hora de início não há tempo decorrido; então não
              // se carimba nada.
              direita: isFormView
                  ? 'UMA CIDADE · REGIÃO INCLUSA'
                  : concluida || _searchStartTime == null
                  ? null
                  : _elapsedText.toUpperCase(),
            ),
            Expanded(
              child: _searchStatus == 'idle'
                  ? GridBackground(child: _buildForm())
                  : _searchStatus == 'loading'
                  ? const Padding(
                      padding: EdgeInsets.fromLTRB(18, 26, 18, 0),
                      child: EsqueletoDeBloco(linhas: 5, altura: 14),
                    )
                  : _buildResults(),
            ),
          ],
        ),
      ),
    );
  }

  /// O formulário, em **cinco blocos**: onde · o que perguntar · desde quando ·
  /// a conta · o botão.
  ///
  /// Eram **onze**, e o diagnóstico foi medido antes de mexer:
  ///
  /// - o tempo estimado aparecia **4 vezes** (3 cartões de preset + a caixa de
  ///   estimativa) — um número que aparece quatro vezes deixa de ser a moeda da
  ///   decisão e vira ruído;
  /// - **5 tratamentos diferentes** de caixa arredondada (dropdown r12, preset
  ///   r12, período r10, calendário r10, estimativa r12);
  /// - o 3º preset `ESCOLHER` **fingia ser preset**: é porta, não atalho;
  /// - o `MultiCitySearchField` foi construído pra N cidades mas `maxCities` já
  ///   era 1 — desenhava ficha removível, contador "1/1 cidades selecionadas" e
  ///   mensagem de limite pra um caso que não pode acontecer;
  /// - 3 blocos de texto explicativo (ícone de ajuda, descrição, disclaimer).
  ///
  /// O tempo agora aparece **duas** vezes, e é deliberado: nos presets, onde
  /// serve pra **comparar** (é a tese do produto — mais assunto custa minuto), e
  /// uma vez grande colado no botão, onde é a **decisão**. O plano dizia "uma
  /// vez só"; sem o tempo por preset o usuário não enxerga a troca antes de
  /// escolher, que é justamente o que a tela existe pra mostrar.
  Widget _buildForm() {
    if (_loadingLocations) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(18, 26, 18, 0),
        child: EsqueletoDeBloco(linhas: 6, altura: 14),
      );
    }

    final canSearch = _selectedEstado != null && _selectedCidades.isNotEmpty;
    final cidade = _selectedCidades.isEmpty ? null : _selectedCidades.first;

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 40),
      children: [
        // ── 1. ONDE ──────────────────────────────────────────────────────
        const SizedBox(height: 22),
        Text('ONDE', style: SIMEopsType.fieldLabel()),
        SeletorLugar(
          rotulo: 'UF',
          valor: _selectedEstado,
          vazio: 'Escolher estado',
          onTap: () async {
            final e = await Lugares.escolherEstado(context, _selectedEstado);
            if (e == null) return;
            setState(() {
              _selectedEstado = e;
              _selectedCidades = {};
            });
          },
        ),
        SeletorLugar(
          rotulo: 'CIDADE',
          valor: cidade,
          vazio: _selectedEstado == null
              ? 'Escolha o estado primeiro'
              : 'Escolher cidade',
          habilitado: _selectedEstado != null,
          onTap: () async {
            final c = await Lugares.escolherCidade(
              context,
              _selectedEstado!,
              cidade,
            );
            if (c == null) return;
            setState(() => _selectedCidades = {c});
          },
        ),
        const SizedBox(height: 9),
        Text(
          'A região metropolitana vem junto, sem custo extra — a consulta '
          'devolve as cidades vizinhas num balde separado.',
          style: SIMEopsType.note(),
        ),

        // ── 2. O QUE PERGUNTAR ───────────────────────────────────────────
        // Cada assunto é uma pergunta a mais ao buscador, e um teto novo de
        // ~60 notícias. O preço é tempo, e ele fica visível na própria linha.
        const SizedBox(height: 28),
        Text('O QUE PERGUNTAR', style: SIMEopsType.fieldLabel()),
        const SizedBox(height: 4),
        AssuntosField(
          taxonomia: _taxonomia,
          periodoDias: _periodoDias,
          onChanged: (lista) => setState(() => _assuntos = lista),
        ),

        // ── 3. DESDE QUANDO ──────────────────────────────────────────────
        //
        // O slider livre de 1 a 180 saiu em 03/08: no device ele erra. O próprio
        // João pediu 30 dias e a busca saiu com 34 — precisão que ninguém pediu
        // custando a que todo mundo queria. Os cinco pontos resolvem o caso
        // comum com um toque; o calendário cobre "desde o incidente tal".
        const SizedBox(height: 28),
        Text('DESDE QUANDO', style: SIMEopsType.fieldLabel()),
        const SizedBox(height: 10),
        _pontosPeriodo(),
        _linhaCalendario(),

        // ── 4. A CONTA ───────────────────────────────────────────────────
        const SizedBox(height: 28),
        _aConta(),

        // ── 5. O BOTÃO ───────────────────────────────────────────────────
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: canSearch ? _startSearch : null,
            child: const Text('INICIAR CONSULTA'),
          ),
        ),
      ],
    );
  }

  /// Os cinco períodos que resolvem quase tudo, um toque cada.
  ///
  /// Retângulos achatados encostados, sem borda e sem canto: o ativo se marca
  /// por filete embaixo e tinta branca, o mesmo vocabulário das abas de cidade
  /// e dos cadernos. Eram cinco cápsulas de canto 10 com borda teal — cinco
  /// caixas desenhadas pra dizer o que um filete diz.
  Widget _pontosPeriodo() {
    return Row(
      children: [
        for (final dias in _periodoMarcas)
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() {
                _periodoDias = dias;
                _desdeQuando = null; // sair do modo calendário
              }),
              behavior: HitTestBehavior.opaque,
              child: Container(
                margin: const EdgeInsets.only(right: 2),
                decoration: BoxDecoration(
                  color: _periodoDias == dias && _desdeQuando == null
                      ? SIMEopsColors.navyLight
                      : SIMEopsColors.navyMid,
                  border: Border(
                    bottom: BorderSide(
                      color: _periodoDias == dias && _desdeQuando == null
                          ? SIMEopsColors.greenLight
                          : Colors.transparent,
                      width: 2,
                    ),
                  ),
                ),
                padding: const EdgeInsets.symmetric(vertical: 13),
                child: Text(
                  '${dias}D',
                  textAlign: TextAlign.center,
                  style: SIMEopsType.placeTab(
                    active: _periodoDias == dias && _desdeQuando == null,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  /// Data de início livre — "desde 12/03".
  ///
  /// ⚠️ É data de INÍCIO, e não intervalo fechado, por uma razão medida: o
  /// Google só pagina de hoje pra trás. Buscar "1 a 31 de março" custaria os
  /// mesmos cinco meses que buscar "desde março" — a busca varre tudo no
  /// caminho de qualquer jeito (é o balde `fora_do_periodo`). Oferecer as duas
  /// pontas sugeriria uma economia que não existe.
  ///
  /// O recorte fechado já existe onde é de graça: no relatório, depois da
  /// busca, re-fatiando o que ela já trouxe (9.6).
  /// Uma linha abaixo dos cinco pontos, no mesmo padrão do seletor de lugar:
  /// rótulo à direita, valor à esquerda, filete embaixo. Era uma sexta caixa
  /// arredondada competindo com os cinco retângulos logo acima.
  Widget _linhaCalendario() {
    final ativo = _desdeQuando != null;
    return InkWell(
      onTap: _escolherDataInicio,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: SIMEopsColors.ruleStrong)),
        ),
        padding: const EdgeInsets.only(top: 15, bottom: 11),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(
                ativo
                    ? DateFormat('dd/MM/yyyy').format(_desdeQuando!)
                    : 'Escolher data exata',
                style: SIMEopsType.body().copyWith(
                  fontSize: 17,
                  color: ativo ? SIMEopsColors.white : SIMEopsColors.faint,
                ),
              ),
            ),
            const SizedBox(width: 12),
            if (ativo)
              InkWell(
                onTap: () => setState(() {
                  _desdeQuando = null;
                  _periodoDias = 30;
                }),
                child: Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: Text(
                    'LIMPAR',
                    style: SIMEopsType.slug(color: SIMEopsColors.tealLight),
                  ),
                ),
              ),
            Text(
              ativo ? '$_periodoDias DIAS' : 'OU DATA EXATA',
              style: SIMEopsType.slug(color: SIMEopsColors.faint),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _escolherDataInicio() async {
    final hoje = DateTime.now();
    // 180 dias é o teto do backend (`validation.ts`), não um número de tela —
    // pedir mais tomaria 400.
    final maisAntiga = hoje.subtract(const Duration(days: _periodoMaximoDias));

    final escolhida = await showDatePicker(
      context: context,
      initialDate: _desdeQuando ?? hoje.subtract(Duration(days: _periodoDias)),
      firstDate: maisAntiga,
      lastDate: hoje.subtract(const Duration(days: 1)),
      helpText: 'BUSCAR DESDE',
      fieldLabelText: 'Data de início',
    );
    if (escolhida == null) return;

    // Só a parte da data importa — o backend conta em dias inteiros.
    final dias = DateTime(hoje.year, hoje.month, hoje.day)
        .difference(DateTime(escolhida.year, escolhida.month, escolhida.day))
        .inDays;

    setState(() {
      _desdeQuando = escolhida;
      _periodoDias = dias.clamp(1, _periodoMaximoDias);
    });
  }

  /// A conta: o tempo como número grande, colado no botão.
  ///
  /// É a moeda da tela — o produto inteiro se resume a "mais assunto traz mais
  /// notícia e custa mais minuto". Estava numa caixa arredondada com ícone,
  /// dizendo em corpo de 12.5 o que agora diz em 40, e disputando atenção com
  /// os três cartões de preset que repetiam o mesmo número.
  Widget _aConta() {
    final n = _assuntos.length;
    final dur = estimativaBusca(n, _periodoDias);
    // Acima de ~12 min a espera deixa de ser "alguns instantes" e vira decisão
    // consciente — o aviso é o que transforma isso em escolha, não surpresa.
    final longa = dur.inMinutes >= 12;
    final cidades = _selectedCidades.length;

    return Container(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: SIMEopsColors.white, width: 2)),
      ),
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                n == 0 ? '—' : formatarEstimativa(dur).replaceFirst('~', ''),
                style: SIMEopsType.hero().copyWith(fontSize: 40),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 5),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        n == 0
                            ? 'NENHUM ASSUNTO'
                            : '$n ${n == 1 ? 'ASSUNTO' : 'ASSUNTOS'}'
                                  '${cidades > 0 ? ' · $_periodoDias DIAS' : ''}',
                        style: SIMEopsType.slug(color: SIMEopsColors.faint),
                        textAlign: TextAlign.end,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'ESTIMATIVA, NÃO GARANTIA',
                        style: SIMEopsType.slug(color: SIMEopsColors.faint),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (longa) ...[
            const SizedBox(height: 10),
            Text(
              'Consulta longa. Pode fechar o app — um aviso chega quando '
              'terminar.',
              style: SIMEopsType.note(),
            ),
          ],
        ],
      ),
    );
  }

  // O `_explicarAssuntos` (folha "Por que escolher assuntos", aberta por um
  // ícone de interrogação ao lado do rótulo) saiu em 09/08. O texto não morreu:
  // foi para dentro da `FolhaAssuntos`, encostado na escolha, que é onde ele é
  // acionável. Explicação atrás de "?" é explicação que ninguém lê — e essa em
  // particular é a tese do produto, não um detalhe.

  // ══════════════════════════════════════════════════════════════════════
  // A ESPERA
  // ══════════════════════════════════════════════════════════════════════

  /// Os sete estágios do backend, em uma palavra cada.
  ///
  /// Eram **cinco blocos** com nome de engenharia — `TRIAGEM RÁPIDA`,
  /// `LEITURA`, `ANÁLISE` —, e o agrupamento tinha um motivo técnico: só os
  /// estágios 4 e 5 mandavam contador, então os outros ficariam mudos se
  /// aparecessem sozinhos. Hoje cada `details` vira um `de → para` (ver
  /// [_valorDoPasso]) e todo passo tem o próprio resultado.
  ///
  /// Depois disso eles passaram por uma fase didática — `Descartar o que não é
  /// ocorrência`, `Extrair local, data e tipo` — e o João cortou: *"podia ser
  /// mais técnico, o cliente não precisa saber o que tá fazendo"*. Ele tem
  /// razão por dois motivos, e o segundo é o que decide:
  ///
  /// 1. explicar o processo não é função desta tela — quem espera quer saber
  ///    **se anda**, e é o número à direita que responde isso;
  /// 2. os nomes por extenso iam de **18 a 32 caracteres**, e como a coluna de
  ///    números é alinhada à direita, a borda do texto ficava serrilhada e o
  ///    olho não achava onde uma coluna terminava. Em uma palavra (5 a 13
  ///    caracteres) a linha vira **etiqueta**, que é o que ela sempre foi.
  ///
  /// Ficam em caixa alta e mono, como todo metadado do app.
  static const _passos = <String>[
    'BUSCA',
    'TRIAGEM',
    'RELEVÂNCIA',
    'COLETA',
    'EXTRAÇÃO',
    'DEDUPLICAÇÃO',
    'CONSOLIDAÇÃO',
  ];

  /// Quantos achados a janela ao vivo mostra de uma vez. Ver [_achadosRecentes].
  static const _achadosNaJanela = 8;

  // Formata Duration como "2.3s", "1m 12s".
  String _fmtDuration(Duration d) {
    if (d.inSeconds < 60) {
      final seconds = d.inMilliseconds / 1000;
      return '${seconds.toStringAsFixed(seconds < 10 ? 1 : 0)}s';
    }
    final m = d.inMinutes;
    final s = d.inSeconds - m * 60;
    return s > 0 ? '${m}m ${s}s' : '${m}m';
  }

  /// Primeiro inteiro do `details` daquele estágio.
  ///
  /// O backend escreve prosa (`619 URLs para filtrar`, `Consolidando 47
  /// resultados`) e o que a linha precisa é o número. O estágio 1 é o único
  /// cujo `details` conta outra coisa (`Pesquisando 3 cidades`) — e é
  /// justamente o único que esta tela nunca lê.
  int? _numero(int estagio) {
    final d = _stageDetails[estagio];
    if (d == null) return null;
    final m = RegExp(r'\d+').firstMatch(d);
    return m == null ? null : int.tryParse(m.group(0)!);
  }

  /// O que aparece à direita do passo: **o que ele fez com o número**.
  ///
  /// `619 → 412` é o que faz a espera contar uma história. Sem isso são sete
  /// linhas acendendo em ordem, e no fim ninguém aprendeu nada sobre a própria
  /// consulta — nem por que ela demorou, nem onde o material se perdeu.
  ///
  /// O `de` de um passo é o `para` do anterior: os números já estavam no
  /// `details` de cada estágio, ninguém precisou consultar nada a mais.
  String _valorDoPasso(int indice, int atual, int? feitos, int? total) {
    final passo = indice + 1;

    if (passo > atual) return '—';
    if (passo == atual) {
      if (feitos != null && total != null && total > 0) {
        return '$feitos / $total';
      }
      return '···';
    }

    String par(int? de, int? para) =>
        (de == null || para == null) ? '—' : '$de → $para';

    switch (passo) {
      case 1:
        final n = _numero(2);
        return n == null ? '—' : '$n LINKS';
      case 2:
        return par(_numero(2), _numero(3));
      case 3:
        return par(_numero(3), _numero(4));
      case 4:
        return par(_numero(4), _numero(5));
      case 5:
        return par(_numero(5), _numero(6));
      case 6:
        return par(_numero(6), _numero(7));
      default:
        final n = _numero(7);
        return n == null ? '—' : '$n OCORRÊNCIAS';
    }
  }

  /// Quanto falta no estágio corrente, pela taxa observada.
  ///
  /// Só depois de 5 itens **e** 5 segundos: antes disso a taxa é ruído, e uma
  /// estimativa que oscila de "40s" para "6min" é pior que nenhuma.
  String? _falta(int estagio, int feitos, int total) {
    final inicio = _stageStartTimes[estagio];
    if (inicio == null || feitos < 5 || total <= feitos) return null;
    final decorrido = DateTime.now().difference(inicio).inSeconds;
    if (decorrido < 5) return null;
    final restante = ((total - feitos) * decorrido / feitos).round();
    return 'FALTAM ~${_fmtDuration(Duration(seconds: restante))}';
  }

  /// Chave de um achado, pra contar sem contar duas vezes o mesmo item que
  /// voltou na janela seguinte do polling.
  String _chaveDoAchado(Map<String, dynamic> a) => [
    a['titulo'],
    a['tipo_crime'],
    a['cidade'],
    a['bairro'],
    a['data_ocorrencia'],
  ].join('|');

  /// Acumula os achados que passam pela janela do worker.
  ///
  /// O worker guarda só os 5 mais recentes (`ACHADOS_VISIVEIS`) e descarta o
  /// resto — mas o polling é de 3s e o estágio 5 leva minutos, então o app vê
  /// **todos** passarem. Guardar as chaves aqui custa zero e é a única forma de
  /// dizer quantas a consulta já achou: `feitos/total` conta o que foi
  /// analisado, não o que virou ocorrência.
  ///
  /// A **lista** continua sendo uma janela dos últimos [_achadosNaJanela], e
  /// isso é decisão, não preguiça: estes achados são **pré-dedup**. A mesma
  /// ocorrência publicada por três veículos chega três vezes, e o passo "juntar
  /// as repetidas" existe justamente pra resolver isso depois. Empilhar tudo na
  /// tela transformaria a duplicação — que é normal e esperada — num defeito
  /// visível, e o usuário ainda veria a lista encolher no fim.
  void _ingestAchados(Map<String, dynamic> progress) {
    final lista = progress['achados'] as List<dynamic>?;
    if (lista == null || lista.isEmpty) return;

    // Do mais antigo pro mais novo, pra quem entrar por último ficar no topo.
    for (final raw in lista.reversed) {
      if (raw is! Map) continue;
      final a = raw.cast<String, dynamic>();
      if (!_achadosVistos.add(_chaveDoAchado(a))) continue;
      _achadosRecentes.insert(0, a);
    }
    if (_achadosRecentes.length > _achadosNaJanela) {
      _achadosRecentes.removeRange(_achadosNaJanela, _achadosRecentes.length);
    }
  }

  Future<void> _confirmarCancelamento() async {
    if (await confirmarCancelamentoDeConsulta(context) && mounted) {
      _resetSearch();
    }
  }

  void _refazer() {
    _resetSearch();
    unawaited(_startSearch());
  }

  Widget _marca({
    required bool feito,
    required bool agora,
    required bool parou,
    Color corDaParada = SIMEopsColors.alert,
  }) {
    if (parou) {
      return Container(width: 8, height: 8, color: corDaParada);
    }
    if (feito) {
      return const Icon(Icons.check, size: 12, color: SIMEopsColors.greenLight);
    }
    if (agora) {
      return Container(width: 8, height: 8, color: SIMEopsColors.tealLight);
    }
    return Container(width: 3, height: 3, color: SIMEopsColors.faint);
  }

  /// Uma etapa: marca · nome · resultado. E, na corrente, o filete de avanço.
  ///
  /// Três tintas, medidas: corrente em branco (17.8:1), concluída em `muted`
  /// (8.0:1), pendente em `faint` (4.8:1). Pendente **não** desaparece —
  /// as etapas que ainda não rodaram são a prova de que a busca tem plano, e
  /// apagá-las mataria a função da lista.
  List<Widget> _linhaDoPasso(
    int i,
    int atual,
    int? feitos,
    int? total,
    bool falhou, {
    Color corDaParada = SIMEopsColors.alert,
  }) {
    final passo = i + 1;
    final feito = passo < atual;
    final agora = passo == atual;
    final parou = falhou && agora;

    final tinta = parou
        ? corDaParada
        : agora
        ? SIMEopsColors.white
        : feito
        ? SIMEopsColors.muted
        : SIMEopsColors.faint;

    final temBarra =
        agora && !falhou && feitos != null && total != null && total > 0;

    return [
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(
          children: [
            SizedBox(
              width: 13,
              child: Center(
                child: _marca(
                  feito: feito,
                  agora: agora,
                  parou: parou,
                  corDaParada: corDaParada,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                _passos[i],
                // `placeTab`, não `etapa`: o `etapa` existe pra desligar o
                // tracking quando a linha é frase. Agora é etiqueta de uma
                // palavra em caixa alta, e etiqueta pede o tracking de volta.
                style: SIMEopsType.placeTab(active: false, color: tinta),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              parou ? 'PAROU AQUI' : _valorDoPasso(i, atual, feitos, total),
              style: SIMEopsType.slug(
                color: parou
                    ? corDaParada
                    : agora
                    ? SIMEopsColors.tealLight
                    : feito
                    ? SIMEopsColors.faint
                    : SIMEopsColors.hairline,
              ),
            ),
          ],
        ),
      ),
      if (temBarra)
        Padding(
          // 25 = a marca (13) + o vão (12). O filete começa embaixo do nome.
          padding: const EdgeInsets.only(left: 25, bottom: 6),
          child: Row(
            children: [
              Expanded(
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: (feitos / total).clamp(0.0, 1.0)),
                  duration: const Duration(milliseconds: 600),
                  curve: Curves.easeOut,
                  builder: (_, v, __) => Container(
                    height: 2,
                    color: SIMEopsColors.rule,
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: v,
                      child: Container(color: SIMEopsColors.tealLight),
                    ),
                  ),
                ),
              ),
              if (_falta(passo, feitos, total) case final eta?) ...[
                const SizedBox(width: 10),
                Text(eta, style: SIMEopsType.slug(color: SIMEopsColors.faint)),
              ],
            ],
          ),
        ),
    ];
  }

  Widget _buildEspera({bool falhou = false, bool cancelada = false}) {
    final atual = (_progress?['stage_num'] as int?) ?? 0;
    final feitos = (_progress?['feitos'] as num?)?.toInt();
    final total = (_progress?['total'] as num?)?.toInt();

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < _passos.length; i++)
                ..._linhaDoPasso(
                  i,
                  atual,
                  feitos,
                  total,
                  falhou,
                  // Cancelamento também para a lista, mas em tinta neutra: o
                  // vermelho aqui diria "deu erro" sobre uma decisão de quem
                  // usa o app.
                  corDaParada: cancelada
                      ? SIMEopsColors.muted
                      : SIMEopsColors.alert,
                ),
            ],
          ),
        ),
        if (falhou)
          ..._blocoDaFalha(atual, cancelada: cancelada)
        else ...[
          if (_achadosVistos.isNotEmpty) ..._blocoDosAchados(),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 28, 18, 0),
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'PODE FECHAR O APP.\n'),
                  TextSpan(
                    text: 'UM AVISO CHEGA QUANDO TERMINAR.',
                    style: TextStyle(color: SIMEopsColors.muted),
                  ),
                ],
              ),
              style: SIMEopsType.slug(
                color: SIMEopsColors.faint,
              ).copyWith(height: 1.7),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
            child: OutlinedButton(
              onPressed: _confirmarCancelamento,
              child: const Text('CANCELAR A CONSULTA'),
            ),
          ),
        ],
        const SizedBox(height: 40),
      ],
    );
  }

  List<Widget> _blocoDosAchados() => [
    Padding(
      padding: const EdgeInsets.fromLTRB(18, 28, 18, 0),
      child: Row(
        children: [
          Text(
            'JÁ ENCONTRADO · ${_achadosVistos.length}',
            style: SIMEopsType.dateline(),
          ),
          const SizedBox(width: 11),
          const Expanded(child: Divider(color: SIMEopsColors.rule, height: 1)),
        ],
      ),
    ),
    for (final a in _achadosRecentes)
      _AchadoAoVivo(key: ValueKey(_chaveDoAchado(a)), achado: a),
  ];

  /// A falha **não** troca a tela por um ícone triste.
  ///
  /// O que existia aqui era um `error_outline` de 64px centralizado e a frase
  /// "A busca falhou" — que some com tudo que a pessoa acabou de ver e não diz
  /// onde parou. Agora a lista de etapas continua na tela, com a etapa que
  /// falhou marcada em vermelho: dá pra ver que 619 links foram achados e que
  /// a coleta morreu no download, o que é uma informação útil inclusive pra
  /// decidir se vale repetir agora ou mais tarde.
  List<Widget> _blocoDaFalha(int atual, {bool cancelada = false}) {
    final onde = (atual >= 1 && atual <= _passos.length)
        ? _passos[atual - 1]
        : null;

    final String texto;
    if (cancelada) {
      texto = onde == null
          ? 'Você cancelou esta consulta. Nada foi coletado.'
          : 'Você cancelou esta consulta na etapa $onde. O que já tinha '
                'sido coletado foi descartado.';
    } else if (onde == null) {
      texto =
          'A consulta não chegou a começar. Costuma ser conexão — '
          'refazer agora normalmente resolve.';
    } else {
      // Sem aspas em volta do `$onde`: a etapa já vem em caixa alta e mono, e
      // aspas em cima disso é o mesmo grifo duas vezes.
      texto =
          'A consulta parou na etapa $onde. O que já tinha sido '
          'coletado não fica salvo: refazer começa do zero.';
    }

    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 26, 18, 0),
        child: Container(
          padding: const EdgeInsets.fromLTRB(13, 12, 13, 13),
          decoration: BoxDecoration(
            color: SIMEopsColors.navyMid,
            border: Border(
              left: BorderSide(
                color: cancelada
                    ? SIMEopsColors.ruleStrong
                    : SIMEopsColors.alert,
                width: 2,
              ),
            ),
          ),
          child: Text(texto, style: SIMEopsType.note()),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
        child: FilledButton(
          onPressed: _refazer,
          child: const Text('REFAZER A CONSULTA'),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
        child: OutlinedButton(
          onPressed: _resetSearch,
          // `NOVA CONSULTA` e não `MUDAR A CONSULTA`: botão se chama como a
          // tela para onde leva, e o masthead do formulário diz `Nova
          // consulta`. Os três caminhos que voltam para lá tinham três nomes.
          child: const Text('NOVA CONSULTA'),
        ),
      ),
    ];
  }

  // ══════════════════════════════════════════════════════════════════════
  // O RESULTADO
  // ══════════════════════════════════════════════════════════════════════

  /// `ANTES DE 5 JUL` — o balde do que ficou fora da janela pedida, nomeado
  /// pela data real em vez de "fora do período", que obriga a lembrar qual era
  /// o período.
  String get _rotuloForaDoPeriodo {
    const meses = [
      'JAN',
      'FEV',
      'MAR',
      'ABR',
      'MAI',
      'JUN',
      'JUL',
      'AGO',
      'SET',
      'OUT',
      'NOV',
      'DEZ',
    ];
    final d =
        _desdeQuando ?? DateTime.now().subtract(Duration(days: _periodoDias));
    return 'ANTES DE ${d.day} ${meses[d.month - 1]}';
  }

  Widget _buildResults() {
    if (_searchStatus == 'processing') return _buildEspera();
    if (_searchStatus == 'failed') return _buildEspera(falhou: true);
    // Sem este caso, abrir uma consulta cancelada pelo histórico caía nos
    // cadernos — abas de notícia e relatório sobre um resultado que não existe.
    if (_searchStatus == 'cancelled') {
      return _buildEspera(falhou: true, cancelada: true);
    }

    return Column(
      children: [
        _buildCadernos(),
        Expanded(
          child: _caderno == 0
              ? _buildOcorrencias()
              : RelatorioDeRisco(
                  searchId: _searchId,
                  cidades: _selectedCidades.isNotEmpty
                      ? _selectedCidades.toList()
                      : [_selectedEstado ?? ''],
                  estado: _selectedEstado ?? '',
                  periodoDias: _periodoDias,
                  results: _searchData.results,
                  foraDoPeriodo: _searchData.foraDoPeriodo,
                  // Até 03/08 o relatório não recebia este balde: ele sumia
                  // dos números sem uma linha dizendo que tinha sumido.
                  regiao: _searchData.regiao,
                ),
        ),
      ],
    );
  }

  /// Os cadernos — **a mesma peça da tela da cidade**.
  ///
  /// Aqui o relatório se abria por um `FilledButton` verde de largura inteira,
  /// e a tela da cidade resolve a MESMA decisão (ver a lista ou ver o
  /// relatório) com duas palavras e um filete. Duas gramáticas para a mesma
  /// escolha, e uma delas gritando: o botão era o objeto mais saturado da tela,
  /// competindo com o resultado que a pessoa esperou sete minutos pra ler.
  ///
  /// O `FILTRAR` também mudou de lugar junto — some no caderno do relatório,
  /// que tem o recorte dele. Com isso morreu a linha `ÚLTIMOS 30 DIAS`, que
  /// repetia o que o cabeçalho já diz duas linhas acima.
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
              onTap: () => setState(() => _caderno = i),
              child: Container(
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: _caderno == i
                          ? SIMEopsColors.greenLight
                          : Colors.transparent,
                      width: 2,
                    ),
                  ),
                ),
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  i == 0 ? 'Ocorrências' : 'Relatório',
                  style: SIMEopsType.tab(active: _caderno == i),
                ),
              ),
            ),
            if (i == 0) const SizedBox(width: 22),
          ],
          const Spacer(),
          if (_caderno == 0)
            InkWell(
              onTap: _abrirFiltro,
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

  Widget _buildOcorrencias() {
    // Indicador de criminalidade não é ocorrência e nunca entrou na contagem —
    // ele é material de segunda ordem, e vai pro próprio balde lá embaixo.
    final ocorrencias = _items
        .where((n) => n.natureza != 'estatistica')
        .toList();
    final indicadores = _items
        .where((n) => n.natureza == 'estatistica')
        .toList();

    final visiveis = _filtro.categorias.isEmpty
        ? ocorrencias
        : ocorrencias
              .where(
                (n) => _filtro.categorias.contains(
                  n.categoriaGrupo ?? 'institucional',
                ),
              )
              .toList();

    final groups = groupNewsByDate(visiveis);
    final rows = <Widget>[];

    // Os três números que **nunca somam**, e é esse o ponto: o principal é o
    // que foi pedido; os outros dois são material que a consulta trouxe junto
    // e que o contrato mantém separado. Somá-los seria dizer que a cidade teve
    // 34 ocorrências quando teve 13.
    rows.add(
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Figura(
              valor: ocorrencias.length,
              rotulo: 'NO PERÍODO',
              destaque: true,
            ),
            _Figura(
              valor: _regiaoItems.length,
              rotulo: 'REGIÃO\nMETROPOLITANA',
            ),
            _Figura(
              valor: _foraItems.length,
              // `ANTES DE\n5 JUL` — a data real diz mais que "fora do período",
              // que obriga a lembrar qual era o período.
              rotulo: _foraItems.isEmpty
                  ? 'FORA DO\nPERÍODO'
                  : _rotuloForaDoPeriodo.replaceFirst(' DE ', ' DE\n'),
            ),
          ],
        ),
      ),
    );

    // Recorte curto rende pouco, e isso é da natureza da fonte — não é falha
    // da consulta. Dizer isso na hora evita a conclusão errada ("o app não
    // funciona") e aponta as duas alavancas reais.
    if (ocorrencias.length <= 2) {
      rows.add(
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
          child: Container(
            padding: const EdgeInsets.fromLTRB(13, 12, 13, 13),
            decoration: const BoxDecoration(
              color: SIMEopsColors.navyMid,
              border: Border(
                left: BorderSide(color: SIMEopsColors.teal, width: 2),
              ),
            ),
            child: Text(
              'Resultado magro é normal em recorte curto: a imprensa publica o '
              'que publica. Ampliar o período ou incluir mais assuntos é o que '
              'aumenta o alcance.',
              style: SIMEopsType.note(),
            ),
          ),
        ),
      );
    }

    // A linha do recorte só existe **quando há recorte**.
    //
    // Aqui ficava `ÚLTIMOS 30 DIAS` + um segundo `FILTRAR`. Os dois eram
    // repetição: o período já está no cabeçalho (`BA · 30 DIAS`) e o `FILTRAR`
    // já está na linha de cadernos, a 40px daqui — dois links idênticos na
    // mesma tela abrindo a mesma folha. O comentário do `_buildCadernos` até
    // afirmava que esta linha tinha morrido junto com a mudança; ela não
    // morreu.
    //
    // Com filtro ativo a frase volta, porque aí ela diz uma coisa que nenhum
    // outro lugar diz: **o que está escondido**.
    if (_filtro.ativo) {
      rows.add(
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
          child: Text(
            _filtro.descricao,
            style: SIMEopsType.slug(color: SIMEopsColors.tealLight),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      );
    }

    if (visiveis.isEmpty) {
      rows.add(
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 40, 18, 0),
          child: Text(
            ocorrencias.isEmpty
                ? 'A consulta não trouxe ocorrência nenhuma no período pedido.'
                : 'Nenhuma ocorrência nas categorias que você deixou marcadas.',
            style: SIMEopsType.note(),
          ),
        ),
      );
    }

    rows.addAll(
      linhasDoFioAgrupado(
        grupos: groups,
        aberto: (g) => _sectionExpanded(g.key, g.defaultExpanded),
        alternar: _toggleSection,
        separador: const TakeRule(),
        card: _take,
      ),
    );

    // Os baldes. `aberta` decide o padrão: a região metropolitana nasce ABERTA
    // desde 03/08 porque recolhida ela escondia resultado pago e entregue — a
    // busca de Goiânia tinha 8 ocorrências ali e parecia ter achado só 11.
    void addSection(
      String key,
      String label,
      List<NewsItem> items, {
      Color? accent,
      bool aberta = false,
    }) {
      if (items.isEmpty) return;
      final expanded = _sectionExpanded(key, aberta);
      rows.add(
        GroupHeader(
          label: label,
          count: items.length,
          expanded: expanded,
          accent: accent,
          onTap: () => _toggleSection(key),
        ),
      );
      if (expanded) {
        // 🚨 Estes três baldes renderizavam **na ordem crua do backend** —
        // nenhuma ordenação. Só a lista principal passava pelo agrupador, que é
        // quem ordena. Numa consulta, a região metropolitana chegava sorteada
        // enquanto o resto da tela estava em ordem cronológica. Pego pelo João
        // em 11/08.
        final ordenados = [...items]..sort(maisRecentePrimeiro);
        for (var i = 0; i < ordenados.length; i++) {
          rows.add(_take(ordenados[i]));
          if (i < ordenados.length - 1) rows.add(const TakeRule());
        }
      }
    }

    addSection(
      'sec:regiao',
      'REGIÃO METROPOLITANA',
      _regiaoItems,
      accent: SIMEopsColors.tealLight,
      aberta: true,
    );
    addSection(
      'sec:fora',
      _rotuloForaDoPeriodo,
      _foraItems,
      accent: SIMEopsColors.tealLight,
    );
    addSection(
      'sec:indicadores',
      'INDICADORES',
      indicadores,
      accent: categoryColor('institucional'),
    );

    rows.add(
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 30, 18, 0),
        // Era um botão de texto teal em mono 11 no fim de uma lista de 53
        // matérias — do tamanho de um metadado, na hora em que a pessoa
        // terminou de ler e a próxima coisa a fazer é outra consulta.
        child: OutlinedButton(
          onPressed: _resetSearch,
          child: const Text('NOVA CONSULTA'),
        ),
      ),
    );
    rows.add(const SizedBox(height: 40));

    return ListView(children: rows);
  }

  Future<void> _abrirFiltro() async {
    await FolhaFiltro.abrir(context, _filtro, mostrarNaoLidas: false);
    if (mounted) setState(() {});
  }

  /// A matéria do resultado é a **mesma peça** do feed.
  ///
  /// Era um `NewsCard` — caixa com borda, canto arredondado e barra de cor na
  /// lateral —, o único lugar do app que ainda desenhava assim depois do
  /// redesign. E ele ignorava o `titulo` que o Filter2 passou a escrever: os 53
  /// resultados de Fortaleza chegaram com manchete e a tela imprimia
  /// `ROUBO/FURTO · Barroso` no lugar dela.
  ///
  /// `groupedByDate: false` porque aqui os grupos também são baldes ("região
  /// metropolitana", "antes de 5 jul") e dentro deles a data volta a fazer
  /// falta no item.
  Widget _take(NewsItem item) =>
      TakeCard(news: item, groupedByDate: false, distingueLidas: false);

  bool _sectionExpanded(String key, bool defaultExpanded) =>
      _toggledSections.contains(key) ? !defaultExpanded : defaultExpanded;

  void _toggleSection(String key) {
    setState(() {
      if (!_toggledSections.add(key)) _toggledSections.remove(key);
    });
  }
}

/// Um dos três números do resultado.
///
/// Número em Archivo 34 e rótulo em mono de duas linhas embaixo — o oposto do
/// cartão que existia aqui, que punha rótulo em cima, valor embaixo e uma
/// borda em volta. Os rótulos quebravam no meio da palavra (`OCORRÊNCI/AS`,
/// `INDICADORE/S`) porque três caixas com borda não cabem em 376px.
class _Figura extends StatelessWidget {
  final int valor;
  final String rotulo;
  final bool destaque;

  const _Figura({
    required this.valor,
    required this.rotulo,
    this.destaque = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$valor',
            style: SIMEopsType.hero().copyWith(
              fontSize: 34,
              letterSpacing: -1.02,
              color: destaque ? SIMEopsColors.white : SIMEopsColors.muted,
            ),
          ),
          const SizedBox(height: 7),
          Text(
            rotulo,
            style: SIMEopsType.slug(
              color: SIMEopsColors.faint,
            ).copyWith(height: 1.5),
          ),
        ],
      ),
    );
  }
}

/// Um achado chegando durante a espera.
///
/// Tem a anatomia da matéria — quadrado de categoria, slug, manchete — porque é
/// uma matéria: é o que a consulta acabou de extrair. O que ele **não** tem é
/// lide, crédito e toque: nada disso existe ainda, e o lugar de ler é o
/// resultado. Antes era `Roubo/Furto · Kobrasol` numa caixa com borda teal,
/// que é menos do que a tela sabia.
class _AchadoAoVivo extends StatelessWidget {
  final Map<String, dynamic> achado;

  const _AchadoAoVivo({super.key, required this.achado});

  @override
  Widget build(BuildContext context) {
    final cat = achado['categoria_grupo'] as String? ?? 'institucional';
    final tipo = achado['tipo_crime'] as String?;
    final cidade = achado['cidade'] as String?;
    final bairro = achado['bairro'] as String?;
    final titulo = (achado['titulo'] as String?)?.trim();

    final manchete = (titulo != null && titulo.isNotEmpty)
        ? titulo
        : bairro != null && bairro.isNotEmpty
        ? '${crimeTypeLabel(tipo)} no $bairro'
        : '${crimeTypeLabel(tipo)} em ${cidade ?? ''}'.trim();

    final local = [
      if (cidade != null && cidade.isNotEmpty) cidade,
      if (bairro != null && bairro.isNotEmpty) bairro,
    ].join(' · ');

    final semMovimento = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: semMovimento ? 1 : 0, end: 1),
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOut,
      builder: (_, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, (1 - t) * -7),
          child: child,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 15, 18, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CatChip(categoria: cat),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    [
                      categoryLabel(cat).toUpperCase(),
                      if (local.isNotEmpty) local,
                    ].join(' · '),
                    style: SIMEopsType.slug(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  _dataCurta(achado['data_ocorrencia'] as String?),
                  style: SIMEopsType.slug(color: SIMEopsColors.faint),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              manchete,
              style: SIMEopsType.headline().copyWith(
                fontSize: 16.5,
                height: 1.22,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 15),
            const Divider(color: SIMEopsColors.rule, height: 1),
          ],
        ),
      ),
    );
  }

  static String _dataCurta(String? iso) {
    final d = DateTime.tryParse(iso ?? '');
    if (d == null) return '';
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';
  }
}
