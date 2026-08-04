import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
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
import '../../../core/widgets/category_filter_bar.dart';
import '../../../core/widgets/group_header.dart';
import '../../../core/widgets/grid_background.dart';
import '../../../core/widgets/simeops_title.dart';
import '../../../core/theme/simeops_colors.dart';
import '../widgets/assuntos_field.dart';
import '../widgets/multi_city_search_field.dart';
import '../../feed/widgets/news_card.dart';
import '../../feed/widgets/news_detail_sheet.dart';
import '../../../core/models/news_item.dart';
import 'report_screen.dart';

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
  String? _reportId;
  String _searchStatus = 'idle'; // idle, processing, completed, failed
  // Resposta crua do /results, com os três baldes SEMPRE separados (regra do
  // contrato). O ReportScreen recebe .results como veio; .foraDoPeriodo cru
  // alimenta o re-fatiamento por período (9.6).
  ManualSearchResults _searchData = const ManualSearchResults();
  // Os mesmos baldes convertidos uma vez (não por itemBuilder).
  List<NewsItem> _items = [];
  List<NewsItem> _regiaoItems = [];
  List<NewsItem> _foraItems = [];
  // Recorte da lista: categorias (vazio = todas) + seções com toggle invertido.
  final Set<String> _filterCats = {};
  final Set<String> _toggledSections = {};
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

      // Recuperar params originais e report_id
      final params = status['params'] as Map<String, dynamic>?;
      final reportId = status['report_id'] as String?;
      if (mounted) {
        setState(() {
          _reportId = reportId;
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
      } else {
        // Realmente ainda processando — reconstrói cronologia dos stages
        // anteriores a partir do history persistido, depois inicia polling.
        final progress = status['progress'] as Map<String, dynamic>?;
        if (progress != null) _ingestProgressHistory(progress);
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
          const SnackBar(content: Text('Resultados expirados ou indisponiveis')),
        );
      }
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _elapsedTimer?.cancel();
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

  List<String> get _estados => BrazilianLocations.instance.getEstados();

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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao iniciar busca: $e')),
        );
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
      _filterCats.clear();
      _toggledSections.clear();
    });
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
          setState(() => _progress = progress);
        }

        // Detecção de estagnação: assinatura do que deveria estar se mexendo.
        if (progress != null) {
          final sig = '${progress['stage_num']}'
              '|${progress['feitos']}'
              '|${progress['atualizado_em']}';
          if (sig != _lastProgressSig) {
            _lastProgressSig = sig;
            _lastAdvanceAt = DateTime.now();
          }
        }
        final stalled = _lastAdvanceAt != null &&
            DateTime.now().difference(_lastAdvanceAt!) > _stallTimeout;
        if (stalled && s == 'processing') {
          _pollTimer?.cancel();
          _elapsedTimer?.cancel();
          if (mounted) {
            setState(() => _searchStatus = 'failed');
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                  content: Text(
                      'A busca parou de avançar. Tente novamente ou veja o histórico.')),
            );
          }
          return;
        }

        if (s == 'completed' || s == 'failed') {
          _pollTimer?.cancel();
          _elapsedTimer?.cancel();

          if (s == 'completed') {
            _ingestResults(await api.getManualSearchResults(_searchId!));
          } else {
            if (mounted) setState(() => _searchStatus = 'failed');
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
              const SnackBar(content: Text('Sem conexão com o servidor. Volte ao histórico quando terminar.')),
            );
          }
        }
      }
    });
  }

  Future<void> _openReport() async {
    if (_selectedEstado == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ReportScreen(
          searchId: _searchId,
          cidades: _selectedCidades.isNotEmpty
              ? _selectedCidades.toList()
              : [_selectedEstado!],
          estado: _selectedEstado!,
          periodoDias: _periodoDias,
          results: _searchData.results,
          foraDoPeriodo: _searchData.foraDoPeriodo,
        ),
      ),
    );
    _checkForReport();
  }

  Future<void> _checkForReport() async {
    if (_searchId == null) return;
    try {
      final api = context.read<ApiService>();
      final status = await api.getManualSearchStatus(_searchId!);
      final reportId = status['report_id'] as String?;
      if (reportId != null && mounted) {
        setState(() => _reportId = reportId);
      }
    } catch (e) { debugPrint('[ManualSearch] Check report error: $e'); }
  }

  void _resetSearch() {
    _pollTimer?.cancel();
    _elapsedTimer?.cancel();

    // Cancelar no backend se busca em andamento
    if (_searchId != null && (_searchStatus == 'processing' || _searchStatus == 'loading')) {
      final api = context.read<ApiService>();
      api.cancelSearch(_searchId!).catchError((e) {
        debugPrint('[ManualSearch] Cancel error: $e');
      });
    }

    setState(() {
      _searchId = null;
      _reportId = null;
      _searchStatus = 'idle';
      _searchData = const ManualSearchResults();
      _items = [];
      _regiaoItems = [];
      _foraItems = [];
      _filterCats.clear();
      _toggledSections.clear();
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
    // Título contextual: "NOVA BUSCA" só quando o user está preenchendo o form
    // (estado idle). Assim que a busca inicia ou ao ver resultados (inclusive de
    // busca anterior via histórico), usa a marca SIMEops — padrão do main_screen.
    final isFormView = _searchStatus == 'idle';

    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      appBar: AppBar(
        title: isFormView
            ? const Text('NOVA BUSCA') // herda style do AppBarTheme (main.dart)
            : const SimeopsTitle(),
      ),
      body: _searchStatus == 'idle'
          ? GridBackground(child: _buildForm())
          : _searchStatus == 'loading'
              ? const Center(child: CircularProgressIndicator())
              : _buildResults(),
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: GoogleFonts.rajdhani(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.8,
          color: SIMEopsColors.muted.withValues(alpha: 0.7),
        ),
      ),
    );
  }

  Widget _buildForm() {
    if (_loadingLocations) {
      return const Center(child: CircularProgressIndicator());
    }

    final canSearch = _selectedEstado != null && _selectedCidades.isNotEmpty;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 120),
      children: [
        // ESTADO
        _sectionLabel('ESTADO'),
        DropdownButtonFormField<String>(
          key: const ValueKey('estado'),
          value: _selectedEstado,
          decoration: InputDecoration(
            hintText: 'Selecione o estado',
            prefixIcon: Icon(Icons.map_outlined,
                color: SIMEopsColors.teal.withValues(alpha: 0.6), size: 20),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          isExpanded: true,
          items: _estados
              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
              .toList(),
          onChanged: (v) => setState(() {
            _selectedEstado = v;
            _selectedCidades = {};
          }),
        ),
        const SizedBox(height: 18),

        // CIDADES
        _sectionLabel('CIDADES'),
        MultiCitySearchField(
          key: ValueKey(_selectedEstado),
          estadoNome: _selectedEstado,
          onChanged: (cidades) {
            setState(() => _selectedCidades = cidades);
          },
        ),
        const SizedBox(height: 18),

        // O QUE BUSCAR — cada assunto é uma pergunta a mais ao Google, e um
        // teto novo de ~60 notícias. O preço é tempo, e ele fica visível.
        Row(
          children: [
            _sectionLabel('O QUE BUSCAR'),
            const Spacer(),
            IconButton(
              onPressed: _explicarAssuntos,
              icon: Icon(Icons.help_outline,
                  size: 18, color: SIMEopsColors.muted.withValues(alpha: 0.7)),
              visualDensity: VisualDensity.compact,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              tooltip: 'Por que escolher assuntos',
            ),
          ],
        ),
        const SizedBox(height: 4),
        AssuntosField(
          taxonomia: _taxonomia,
          periodoDias: _periodoDias,
          onChanged: (lista) => setState(() => _assuntos = lista),
        ),
        const SizedBox(height: 20),

        // PERIODO — cinco pontos e um calendário. Sem granulação.
        //
        // O slider livre de 1 a 180 saiu em 03/08: no device ele erra. O próprio
        // João pediu 30 dias e a busca saiu com 34 — precisão que ninguém pediu
        // custando a que todo mundo queria. Os cinco pontos resolvem o caso
        // comum com um toque; o calendário cobre "desde o incidente tal".
        _sectionLabel('PERIODO'),
        const SizedBox(height: 10),
        _pontosPeriodo(),
        const SizedBox(height: 12),
        _botaoCalendario(),
        const SizedBox(height: 18),

        // A CONTA — assuntos × período em minutos. Fica logo abaixo do período
        // pra trocar de ponto mexer no número na frente do usuário: é o único
        // lugar onde o custo de uma busca maior fica visível ANTES de começar.
        _caixaEstimativa(),
        const SizedBox(height: 20),

        // INICIAR BUSCA — estilo vem inteiro do FilledButtonTheme (primária teal)
        SizedBox(
          width: double.infinity,
          height: 52,
          child: FilledButton(
            onPressed: canSearch ? _startSearch : null,
            child: const Text('INICIAR BUSCA'),
          ),
        ),
        const SizedBox(height: 14),

        // Disclaimer
        Text(
          'A busca analisa notícias públicas e pode levar alguns instantes.',
          textAlign: TextAlign.center,
          style: GoogleFonts.exo2(
            fontSize: 12,
            color: SIMEopsColors.muted.withValues(alpha: 0.5),
          ),
        ),
      ],
    );
  }

  /// Os cinco períodos que resolvem quase tudo, um toque cada.
  Widget _pontosPeriodo() {
    return Row(
      children: _periodoMarcas.map((dias) {
        final ativo = _periodoDias == dias;
        return Expanded(
          child: GestureDetector(
            onTap: () => setState(() {
              _periodoDias = dias;
              _desdeQuando = null; // sair do modo calendário
            }),
            behavior: HitTestBehavior.opaque,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 3),
              padding: const EdgeInsets.symmetric(vertical: 11),
              decoration: BoxDecoration(
                color: ativo
                    ? SIMEopsColors.teal.withValues(alpha: 0.16)
                    : SIMEopsColors.navyLight.withValues(alpha: 0.8),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: ativo
                      ? SIMEopsColors.teal
                      : SIMEopsColors.teal.withValues(alpha: 0.12),
                  width: ativo ? 1.5 : 1,
                ),
              ),
              child: Column(
                children: [
                  Text(
                    '$dias',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: ativo
                          ? SIMEopsColors.tealLight
                          : SIMEopsColors.muted.withValues(alpha: 0.75),
                    ),
                  ),
                  Text(
                    'dias',
                    style: GoogleFonts.exo2(
                      fontSize: 9.5,
                      color: SIMEopsColors.muted.withValues(alpha: 0.55),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
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
  Widget _botaoCalendario() {
    final ativo = _desdeQuando != null;
    return GestureDetector(
      onTap: _escolherDataInicio,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: ativo
              ? SIMEopsColors.teal.withValues(alpha: 0.12)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: ativo
                ? SIMEopsColors.teal
                : SIMEopsColors.teal.withValues(alpha: 0.18),
          ),
        ),
        child: Row(
          children: [
            Icon(Icons.calendar_month_outlined,
                size: 17,
                color: ativo
                    ? SIMEopsColors.tealLight
                    : SIMEopsColors.muted.withValues(alpha: 0.7)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                ativo
                    ? 'Desde ${DateFormat('dd/MM/yyyy').format(_desdeQuando!)}'
                        ' · $_periodoDias dias'
                    : 'Escolher data de início',
                style: GoogleFonts.exo2(
                  fontSize: 13,
                  fontWeight: ativo ? FontWeight.w600 : FontWeight.w400,
                  color: ativo
                      ? SIMEopsColors.tealLight
                      : SIMEopsColors.muted.withValues(alpha: 0.75),
                ),
              ),
            ),
            if (ativo)
              GestureDetector(
                onTap: () => setState(() {
                  _desdeQuando = null;
                  _periodoDias = 30;
                }),
                child: Icon(Icons.close,
                    size: 16, color: SIMEopsColors.muted.withValues(alpha: 0.8)),
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

  /// A conta da busca: quantos assuntos, quantos dias, quantos minutos.
  Widget _caixaEstimativa() {
    final n = _assuntos.length;
    final dur = estimativaBusca(n, _periodoDias);
    // Acima de ~12 min a espera deixa de ser "alguns instantes" e vira decisão
    // consciente — o aviso é o que transforma isso em escolha, não surpresa.
    final longa = dur.inMinutes >= 12;

    final cor = longa ? const Color(0xFFF59E0B) : SIMEopsColors.teal;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: cor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(longa ? Icons.schedule : Icons.bolt, size: 17, color: cor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  n == 0
                      ? 'Nenhum assunto escolhido'
                      : '$n assunto${n == 1 ? '' : 's'} · $_periodoDias dias · '
                          '${formatarEstimativa(dur)}',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: longa ? cor : SIMEopsColors.tealLight,
                  ),
                ),
                if (longa) ...[
                  const SizedBox(height: 3),
                  Text(
                    'Busca longa — pode fechar o app, o push avisa quando terminar.',
                    style: GoogleFonts.exo2(
                      fontSize: 11.5,
                      color: SIMEopsColors.muted.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _explicarAssuntos() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: SIMEopsColors.navyMid,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 14, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: SIMEopsColors.muted.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              'Por que escolher assuntos',
              style: GoogleFonts.exo2(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Cada assunto é uma pergunta separada ao Google, e o Google '
              'devolve no máximo ~60 notícias por pergunta — pedir mais páginas '
              'da mesma pergunta não traz nada de novo.\n\n'
              'Por isso perguntar mais coisas é a única forma de encontrar '
              'mais. O preço é tempo: cada assunto acrescenta cerca de 45 '
              'segundos à busca.\n\n'
              'A palavra-chave livre busca qualquer coisa, mesmo fora da lista '
              '— greve, acidente numa rodovia, o que você precisar.',
              style: GoogleFonts.exo2(
                fontSize: 14,
                height: 1.55,
                color: SIMEopsColors.muted,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Funil de exibição — os 7 estágios do backend colapsados em 5 blocos.
  // Decisão de UI do briefing: mostrar o funil ao vivo, não 7 passos com check.
  // Estágios 4 (LEITURA) e 5 (ANÁLISE) são 85% do tempo e têm contador
  // feitos/total no /status; os demais só mudam de details.
  static const _funnelGroups = [
    ('BUSCANDO', [1]),
    ('TRIAGEM RÁPIDA', [2, 3]),
    ('LEITURA', [4]),
    ('ANÁLISE', [5]),
    ('AGRUPAMENTO', [6, 7]),
  ];

  static const _totalStages = 7;

  // Formata Duration como "2.3s", "1m 12s", "0.4s"
  String _fmtDuration(Duration d) {
    if (d.inSeconds < 60) {
      final seconds = d.inMilliseconds / 1000;
      return '${seconds.toStringAsFixed(seconds < 10 ? 1 : 0)}s';
    }
    final m = d.inMinutes;
    final s = d.inSeconds - m * 60;
    return s > 0 ? '${m}m ${s}s' : '${m}m';
  }

  // "[14:47:15]" — formato monospace estilo log
  String _fmtTimestamp(DateTime t) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '[${two(t.hour)}:${two(t.minute)}:${two(t.second)}]';
  }

  // Início de um grupo do funil = início do primeiro estágio dele que rodou.
  DateTime? _groupStart(List<int> stages) {
    for (final s in stages) {
      final t = _stageStartTimes[s];
      if (t != null) return t;
    }
    return null;
  }

  // Details mais recente dentro do grupo (o backend escreve por estágio).
  String? _groupDetail(List<int> stages) {
    for (final s in stages.reversed) {
      final d = _stageDetails[s];
      if (d != null) return d;
    }
    return null;
  }

  // Duração do grupo: concluído = início do próximo - início dele;
  // corrente = agora - início; pendente = null.
  Duration? _groupDuration(int groupIndex, int currentStageNum) {
    final stages = _funnelGroups[groupIndex].$2;
    final start = _groupStart(stages);
    if (start == null) return null;
    if (currentStageNum > stages.last) {
      // Concluído — procura o início do grupo seguinte que já rodou.
      for (var i = groupIndex + 1; i < _funnelGroups.length; i++) {
        final nextStart = _groupStart(_funnelGroups[i].$2);
        if (nextStart != null) return nextStart.difference(start);
      }
      return null;
    }
    if (stages.contains(currentStageNum)) {
      return DateTime.now().difference(start);
    }
    return null;
  }

  // Estimativa de término do estágio corrente pela taxa observada.
  String? _etaText(DateTime start, int feitos, int total) {
    if (feitos < 5 || total <= feitos) return null;
    final elapsed = DateTime.now().difference(start).inSeconds;
    if (elapsed < 5) return null;
    final restante = ((total - feitos) * elapsed / feitos).round();
    return '~${_fmtDuration(Duration(seconds: restante))}';
  }

  // "hoje" / "ontem" / "há N dias" — usado nos achados ao vivo.
  static String _relativeDate(String? iso) {
    final d = DateTime.tryParse(iso ?? '');
    if (d == null) return '';
    final now = DateTime.now();
    final diff = DateTime(now.year, now.month, now.day)
        .difference(DateTime(d.year, d.month, d.day))
        .inDays;
    if (diff <= 0) return 'hoje';
    if (diff == 1) return 'ontem';
    return 'há $diff dias';
  }

  Widget _metadataCard(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: SIMEopsColors.navyLight.withValues(alpha: 0.6),
          border: Border.all(color: SIMEopsColors.teal.withValues(alpha: 0.15)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: GoogleFonts.rajdhani(
                fontSize: 10,
                color: SIMEopsColors.muted.withValues(alpha: 0.7),
                letterSpacing: 1.5,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 14,
                color: SIMEopsColors.tealLight,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stageIndicator({required bool done, required bool current}) {
    final color = done
        ? SIMEopsColors.teal
        : current
            ? SIMEopsColors.tealLight
            : SIMEopsColors.muted.withValues(alpha: 0.3);
    if (done) {
      return Container(
        width: 14,
        height: 14,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
    }
    if (current) {
      return SizedBox(
        width: 14,
        height: 14,
        child: CircularProgressIndicator(strokeWidth: 2, color: color),
      );
    }
    return Container(
      width: 14,
      height: 14,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color, width: 1.5),
      ),
    );
  }

  Widget _buildProgressStepper() {
    final currentStageNum = (_progress?['stage_num'] as int?) ?? 0;
    final feitos = (_progress?['feitos'] as num?)?.toInt();
    final total = (_progress?['total'] as num?)?.toInt();
    final achados = (_progress?['achados'] as List<dynamic>?) ?? const [];
    final hasCounter = feitos != null && total != null && total > 0;

    // Barra geral: 7 estágios, com fração dentro dos que têm contador (4 e 5).
    double progressValue = 0;
    if (currentStageNum > 0) {
      final fraction = hasCounter
          ? (feitos / total).clamp(0.0, 1.0).toDouble()
          : 0.0;
      progressValue = ((currentStageNum - 1) + fraction) / _totalStages;
    }

    // Índice do bloco corrente do funil (pro metadata card).
    var currentGroup = 0;
    for (var i = 0; i < _funnelGroups.length; i++) {
      if (_funnelGroups[i].$2.contains(currentStageNum)) {
        currentGroup = i + 1;
        break;
      }
    }
    final groupCounter =
        currentGroup > 0 ? '$currentGroup/${_funnelGroups.length}' : '—';

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header com metadata
          Row(
            children: [
              _metadataCard('ETAPA', groupCounter),
              const SizedBox(width: 8),
              _metadataCard('TEMPO', _elapsedText),
            ],
          ),
          const SizedBox(height: 20),

          // Progress bar central
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: progressValue),
              duration: const Duration(milliseconds: 500),
              builder: (_, value, __) => LinearProgressIndicator(
                value: value,
                minHeight: 4,
                backgroundColor: SIMEopsColors.navyLight.withValues(alpha: 0.6),
                valueColor: AlwaysStoppedAnimation(SIMEopsColors.teal),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // O funil: 5 blocos, contador vivo dentro do corrente
          ...List.generate(_funnelGroups.length, (index) {
            final (label, stages) = _funnelGroups[index];
            final isCompleted = currentStageNum > stages.last;
            final isCurrent = stages.contains(currentStageNum);
            final startTime = _groupStart(stages);
            final duration = _groupDuration(index, currentStageNum);
            final detail = _groupDetail(stages);
            final showCounter = isCurrent && hasCounter;

            final labelColor = isCompleted
                ? SIMEopsColors.white
                : isCurrent
                    ? SIMEopsColors.tealLight
                    : SIMEopsColors.muted.withValues(alpha: 0.45);

            // Direita: contador vivo no corrente, duração no concluído.
            Widget trailing;
            if (showCounter) {
              final eta =
                  startTime != null ? _etaText(startTime, feitos, total) : null;
              trailing = Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '$feitos de $total',
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: SIMEopsColors.tealLight,
                    ),
                  ),
                  if (eta != null)
                    Text(
                      eta,
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 10,
                        color: SIMEopsColors.muted.withValues(alpha: 0.7),
                      ),
                    ),
                ],
              );
            } else if (duration != null) {
              trailing = Text(
                _fmtDuration(duration),
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10,
                  color: isCompleted
                      ? SIMEopsColors.muted.withValues(alpha: 0.7)
                      : SIMEopsColors.tealLight.withValues(alpha: 0.8),
                ),
              );
            } else {
              trailing = Text(
                '—',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10,
                  color: SIMEopsColors.muted.withValues(alpha: 0.35),
                ),
              );
            }

            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Timestamp monospace (só quando o bloco já começou)
                  SizedBox(
                    width: 72,
                    child: startTime != null
                        ? Text(
                            _fmtTimestamp(startTime),
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 10,
                              color: SIMEopsColors.muted.withValues(alpha: 0.6),
                            ),
                          )
                        : const SizedBox.shrink(),
                  ),
                  const SizedBox(width: 10),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: _stageIndicator(done: isCompleted, current: isCurrent),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          style: GoogleFonts.rajdhani(
                            fontSize: 13,
                            letterSpacing: 1.5,
                            color: labelColor,
                            fontWeight:
                                isCurrent ? FontWeight.w700 : FontWeight.w600,
                          ),
                        ),
                        if (detail != null && (isCompleted || isCurrent))
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              detail,
                              style: GoogleFonts.exo2(
                                fontSize: 11,
                                color: SIMEopsColors.muted
                                    .withValues(alpha: isCompleted ? 0.7 : 0.9),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  trailing,
                ],
              ),
            );
          }),

          // Achados ao vivo — chegam no estágio 5 (análise), os 5 mais recentes
          if (achados.isNotEmpty) ...[
            const SizedBox(height: 8),
            _sectionLabel('ÚLTIMOS ACHADOS'),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: SIMEopsColors.navyLight.withValues(alpha: 0.5),
                border: Border.all(
                    color: SIMEopsColors.teal.withValues(alpha: 0.15)),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Column(
                children: achados.whereType<Map<String, dynamic>>().map((a) {
                  final tipo = crimeTypeLabel(a['tipo_crime'] as String?);
                  final bairro = a['bairro'] as String?;
                  final quando = _relativeDate(a['data_ocorrencia'] as String?);
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Container(
                          width: 5,
                          height: 5,
                          decoration: const BoxDecoration(
                            color: SIMEopsColors.tealLight,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            bairro != null && bairro.isNotEmpty
                                ? '$tipo · $bairro'
                                : tipo,
                            style: GoogleFonts.exo2(
                              fontSize: 12.5,
                              color: SIMEopsColors.white,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          quando,
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 10,
                            color: SIMEopsColors.muted.withValues(alpha: 0.7),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],

          const SizedBox(height: 24),

          // A busca é job no servidor e sobrevive a fechar o app.
          Text(
            'Pode fechar o app — avisamos quando terminar.',
            textAlign: TextAlign.center,
            style: GoogleFonts.exo2(
              fontSize: 12,
              color: SIMEopsColors.muted.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: 14),

          // Botão cancelar — secundária (OutlinedButtonTheme: borda/texto teal)
          Center(
            child: OutlinedButton(
              onPressed: _resetSearch,
              style: OutlinedButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 36, vertical: 12),
              ),
              child: const Text('CANCELAR'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResults() {
    if (_searchStatus == 'processing') {
      return _buildProgressStepper();
    }

    if (_searchStatus == 'failed') {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                size: 64, color: SIMEopsColors.alert),
            const SizedBox(height: 16),
            const Text('A busca falhou'),
            const SizedBox(height: 16),
            FilledButton.tonal(
              onPressed: _resetSearch,
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      );
    }

    // completed — o dossiê: sumário, recorte, grupos por data e seções extras
    final ocorrencias =
        _items.where((n) => n.natureza != 'estatistica').toList();
    final indicadores =
        _items.where((n) => n.natureza == 'estatistica').toList();

    // Contagens por categoria (só ocorrências — estatística NÃO conta).
    final catCounts = <String, int>{};
    for (final n in ocorrencias) {
      final cat = n.categoriaGrupo ?? 'institucional';
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }

    final visiveis = _filterCats.isEmpty
        ? ocorrencias
        : ocorrencias
            .where((n) =>
                _filterCats.contains(n.categoriaGrupo ?? 'institucional'))
            .toList();

    final groups = groupNewsByDate(visiveis);

    final rows = <Widget>[];

    // Sumário — readouts
    rows.add(Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Row(
        children: [
          _metadataCard('OCORRÊNCIAS', '${ocorrencias.length}'),
          // A região entra no sumário, não só numa seção lá embaixo: Goiânia
          // com "11 OCORRÊNCIAS" tinha 8 da região metropolitana logo abaixo,
          // e a busca parecia ter rendido menos do que rendeu.
          if (_regiaoItems.isNotEmpty) ...[
            const SizedBox(width: 8),
            _metadataCard('REGIÃO', '+${_regiaoItems.length}'),
          ],
          const SizedBox(width: 8),
          _metadataCard('PERÍODO', '${_periodoDias}d'),
          if (indicadores.isNotEmpty) ...[
            const SizedBox(width: 8),
            _metadataCard('INDICADORES', '${indicadores.length}'),
          ],
        ],
      ),
    ));

    // Ações: relatório (primária) + nova busca (terciária)
    rows.add(Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Row(
        children: [
          if (_items.isNotEmpty)
            Expanded(
              child: _reportId != null
                  ? FilledButton.icon(
                      onPressed: () => _openReport(),
                      icon: const Icon(Icons.description, size: 18),
                      label: const Text('Ver Relatório de Risco'),
                    )
                  : FilledButton.tonalIcon(
                      onPressed: (_selectedEstado != null) ? () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ReportScreen(
                              searchId: _searchId,
                              cidades: _selectedCidades.isNotEmpty
                                  ? _selectedCidades.toList()
                                  : [_selectedEstado!],
                              estado: _selectedEstado!,
                              periodoDias: _periodoDias,
                              results: _searchData.results,
                              foraDoPeriodo: _searchData.foraDoPeriodo,
                            ),
                          ),
                        );
                        // Após voltar da tela de relatório, checar se foi gerado
                        _checkForReport();
                      } : null,
                      icon: const Icon(Icons.bar_chart, size: 18),
                      label: const Text('Gerar Relatório de Risco'),
                    ),
            ),
          const SizedBox(width: 4),
          TextButton.icon(
            onPressed: _resetSearch,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('Nova'),
          ),
        ],
      ),
    ));

    // Recorte por categoria
    rows.add(Padding(
      padding: const EdgeInsets.only(top: 12),
      child: CategoryFilterBar(
        counts: catCounts,
        selected: _filterCats,
        onToggle: (cat) => setState(() {
          if (!_filterCats.add(cat)) _filterCats.remove(cat);
        }),
      ),
    ));

    if (_items.isEmpty) {
      rows.add(Padding(
        padding: const EdgeInsets.only(top: 60),
        child: Center(
          child: Text(
            'Nenhuma notícia encontrada para os filtros selecionados',
            style: GoogleFonts.exo2(fontSize: 13, color: SIMEopsColors.muted),
            textAlign: TextAlign.center,
          ),
        ),
      ));
    }

    // Grupos por data (últimos 7 dias por dia, resto por semana)
    for (final g in groups) {
      final expanded = _sectionExpanded(g.key, g.defaultExpanded);
      rows.add(GroupHeader(
        label: g.label,
        count: g.items.length,
        expanded: expanded,
        onTap: () => _toggleSection(g.key),
      ));
      if (expanded) rows.addAll(g.items.map(_buildCard));
    }

    // Seções especiais, com cor destacada.
    //
    // `aberta` decide o padrão. A região metropolitana nasce ABERTA desde
    // 03/08: recolhida, ela escondia resultado pago e entregue — a busca de
    // Goiânia tinha 8 ocorrências ali e parecia ter achado só 11. As outras
    // duas continuam recolhidas porque são material de segunda ordem
    // (indicador não é ocorrência; "mais ocorrências" está fora do período
    // pedido).
    void addSection(String key, String label, List<NewsItem> items,
        {Color? accent, bool aberta = false}) {
      if (items.isEmpty) return;
      final expanded = _sectionExpanded(key, aberta);
      rows.add(GroupHeader(
        label: label,
        count: items.length,
        expanded: expanded,
        accent: accent,
        onTap: () => _toggleSection(key),
      ));
      if (expanded) rows.addAll(items.map(_buildCard));
    }

    addSection('sec:indicadores', 'INDICADORES', indicadores,
        accent: categoryColor('institucional'));
    addSection('sec:regiao', 'REGIÃO METROPOLITANA', _regiaoItems,
        accent: SIMEopsColors.tealLight, aberta: true);
    addSection('sec:fora', 'MAIS OCORRÊNCIAS', _foraItems,
        accent: SIMEopsColors.tealLight);

    rows.add(const SizedBox(height: 48));

    return ListView(children: rows);
  }

  bool _sectionExpanded(String key, bool defaultExpanded) =>
      _toggledSections.contains(key) ? !defaultExpanded : defaultExpanded;

  void _toggleSection(String key) {
    setState(() {
      if (!_toggledSections.add(key)) _toggledSections.remove(key);
    });
  }

  Widget _buildCard(NewsItem item) => NewsCard(
        news: item,
        onTap: () => NewsDetailSheet.show(context, item),
      );
}

