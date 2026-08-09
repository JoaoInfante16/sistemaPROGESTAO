import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/models/crime_point.dart';
import '../../../core/models/executive_data.dart';
import '../../../core/services/api_service.dart';
import '../../../core/widgets/crime_radar_map.dart';
import '../../../core/widgets/executive_indicators.dart';
import '../../../core/widgets/fontes_analisadas.dart';
import '../../../core/widgets/interruptor.dart';
import '../../../core/widgets/report_pieces.dart';
import '../../../core/widgets/weekly_trend_bars.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../feed/widgets/take_card.dart' show EndMark;

/// O relatório de risco.
///
/// **A estrutura é a de antes** — recorte declarado, re-fatiamento, rosca por
/// categoria, mapa, ranking de bairro, indicadores e fontes. O que mudou foi a
/// língua: era a única tela do app ainda escrita em `Rajdhani` (dez lugares,
/// sendo que a regra é logotipo e só), `exo2` no corpo e **quatro raios de
/// canto diferentes** — 6, 12, 14 e 20 nos chips.
///
/// Duas mudanças que não são estética:
///
/// 1. **abre com uma frase, não com um gráfico.** Eram quatro caixinhas
///    (`107 / OCORRÊNCIAS`, `18 / BAIRROS`, `9 / TIPOS`) que obrigam o leitor a
///    montar sozinho a leitura. Agora o número grande vem com a frase que ele
///    significa, montada dos próprios dados — inclusive a ressalva de que isto
///    é o que a imprensa publicou, não o que a polícia registrou.
/// 2. **todo gráfico tem gêmeo em tabela.** Rosca e barra são boas pra ver
///    proporção e péssimas pra citar número — e este documento existe pra ser
///    citado por alguém que não estava na sala.
class RelatorioDeRisco extends StatefulWidget {
  final String? searchId;
  final List<String> cidades;
  final String estado;
  final int periodoDias;
  final List<Map<String, dynamic>> results;
  // Balde fora_do_periodo cru — itens mais antigos que a janela pedida, que a
  // busca coletou no caminho. É o pool do re-fatiamento "+ antigas".
  final List<Map<String, dynamic>> foraDoPeriodo;

  /// Balde `regiao` — ocorrências de município vizinho.
  ///
  /// Até 03/08 este relatório **nem recebia** esta lista: ela sumia sem aviso,
  /// que é a pior das opções (some do total e o usuário não sabe que sumiu).
  /// Agora entra como toggle, simétrico ao "+ antigas".
  final List<Map<String, dynamic>> regiao;

  /// Até quantos dias atrás o "+ antigas" pode alcançar — é a config
  /// `manual_search_horizon_days` do backend (180). Fica explícito na tela
  /// porque um relatório de 30 dias com "+antigas" ligado pode conter matéria
  /// de cinco meses atrás, e isso precisa estar escrito.
  final int horizonteDias;

  const RelatorioDeRisco({
    super.key,
    this.searchId,
    required this.cidades,
    required this.estado,
    required this.periodoDias,
    required this.results,
    this.foraDoPeriodo = const [],
    this.regiao = const [],
    this.horizonteDias = 180,
  });

  @override
  State<RelatorioDeRisco> createState() => _RelatorioDeRiscoState();
}

class _RelatorioDeRiscoState extends State<RelatorioDeRisco> {
  bool _generatingLink = false;

  // Recorte client-side — re-fatiar é de graça, o dado já veio na busca.
  // null = período completo pedido; _includeOld inclui o balde fora_do_periodo.
  int? _sliceDias;
  bool _includeOld = false;

  /// Inclui o balde de município vizinho nos números do relatório.
  bool _includeRegiao = false;
  final Set<String> _cats = {};

  // Computed — função do recorte, recalculado a cada setState de filtro
  // (era late final, calculado 1x no initState sem filtro nenhum).
  Map<String, int> _crimeTypeCounts = {};
  Map<String, int> _categoryCounts = {};
  Map<String, int> _bairroCounts = {};
  List<Map<String, dynamic>> _byDate = [];
  int _totalOcorrencias = 0;

  /// Quantas das contadas são de município vizinho. Sai da comparação de nome,
  /// não da origem do balde: com "+ região" ligado os dois pools viram um só, e
  /// a frase de abertura precisa saber quanto é de onde.
  int _totalRegiaoNoRecorte = 0;

  /// Ocorrências sem bairro na matéria — o que **não entra** no mapa nem no
  /// ranking. Declarar isso é o que separa um mapa de uma alegação.
  int _semBairro = 0;

  int _totalEstatisticas = 0;
  List<Map<String, dynamic>> _estatisticas = [];
  List<Map<String, String>> _sourcesOficial = [];
  List<Map<String, String>> _sourcesMedia = [];

  // Radar — pontos vêm do backend já geocodados
  List<CrimePoint> _mapPoints = [];
  bool _mapLoading = true;

  // Executive (indicadores + resumo) — backend cacheia por cidade+estado+range
  ExecutiveData _executive = ExecutiveData.empty();
  bool _executiveLoading = false;

  @override
  void initState() {
    super.initState();
    _computeAnalytics();
    _loadMapPoints();
    _loadExecutive();
  }

  Future<void> _loadExecutive() async {
    if (widget.cidades.isEmpty || widget.estado.isEmpty) return;
    // Sem estatística no período a seção inteira some.
    if (_estatisticas.isEmpty) return;

    setState(() => _executiveLoading = true);
    try {
      final api = context.read<ApiService>();
      final stats = _estatisticas
          .map(
            (s) => <String, dynamic>{
              'resumo': s['resumo'] ?? '',
              'data_ocorrencia': s['data_ocorrencia'] ?? '',
              'source_url': s['source_url'] ?? s['url'],
            },
          )
          .where((s) => (s['resumo'] as String).isNotEmpty)
          .toList();

      if (stats.isEmpty) {
        if (mounted) setState(() => _executiveLoading = false);
        return;
      }

      final raw = await api.getExecutiveFromStats(
        cidade: widget.cidades.first,
        estado: widget.estado,
        rangeDays: widget.periodoDias,
        estatisticas: stats,
        searchId: widget.searchId,
      );
      if (!mounted) return;
      setState(() {
        _executive = ExecutiveData.fromJson(raw);
        _executiveLoading = false;
      });
    } catch (e) {
      debugPrint('[Report] Executive error: $e');
      if (mounted) setState(() => _executiveLoading = false);
      // Fail silent — seção some, não atrapalha relatório.
    }
  }

  String _dateStr(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  // ⚠️ Mapa e executivo seguem o recorte FIXO da busca (armadilha 6.5 do
  // briefing): o geocode roda contra a cidade da requisição — re-fatiar o
  // mapa client-side pintaria bairro de Camaçari dentro de Salvador.
  Future<void> _loadMapPoints() async {
    if (widget.cidades.isEmpty) {
      if (mounted) setState(() => _mapLoading = false);
      return;
    }
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final from = now.subtract(Duration(days: widget.periodoDias));

      // Busca manual com searchId → backend lê de search_results.
      // Sem searchId (caso manual ad-hoc) → lê de news pelo período.
      final raw = await api.getMapPoints(
        cidade: widget.cidades.first,
        estado: widget.estado,
        dateFrom: _dateStr(from),
        dateTo: _dateStr(now),
        searchId: widget.searchId,
      );
      if (!mounted) return;
      setState(() {
        _mapPoints = raw.map(CrimePoint.fromJson).toList();
        _mapLoading = false;
      });
    } catch (e) {
      debugPrint('[Report] Map points error: $e');
      if (mounted) setState(() => _mapLoading = false);
    }
  }

  // Pool com o recorte de PERÍODO aplicado (categoria é aplicada depois,
  // dentro do _computeAnalytics, pra o donut continuar mostrando todas).
  List<Map<String, dynamic>> get _dateSubset {
    final pool = [
      ...widget.results,
      if (_includeOld) ...widget.foraDoPeriodo,
      if (_includeRegiao) ...widget.regiao,
    ];
    final dias = _sliceDias;
    if (dias == null) return pool;

    final now = DateTime.now();
    final cut = DateTime(
      now.year,
      now.month,
      now.day,
    ).subtract(Duration(days: dias));
    return pool.where((r) {
      final d = DateTime.tryParse(r['data_ocorrencia'] as String? ?? '');
      return d == null || !d.isBefore(cut);
    }).toList();
  }

  bool _ehCidadePedida(Map<String, dynamic> r) {
    final cidade = (r['cidade'] as String? ?? '').trim();
    if (cidade.isEmpty) return true;
    String normal(String s) => s.toLowerCase().trim();
    return widget.cidades.any((c) => normal(c) == normal(cidade));
  }

  /// `Kobrasol` para a cidade pedida, `Centro · Aparecida de Goiânia` para
  /// vizinha. Comparação sem acento/caixa porque o Filter2 devolve o nome como
  /// veio no texto da matéria.
  String _rotuloBairro(String bairro, Map<String, dynamic> r) {
    final cidade = (r['cidade'] as String? ?? '').trim();
    if (cidade.isEmpty) return bairro;
    return _ehCidadePedida(r) ? bairro : '$bairro · $cidade';
  }

  void _computeAnalytics() {
    final subset = _dateSubset;

    _crimeTypeCounts = {};
    _categoryCounts = {};
    _bairroCounts = {};
    final dateCounts = <String, int>{};
    final estatisticas = <Map<String, dynamic>>[];
    int ocorrencias = 0;
    int daRegiao = 0;
    int semBairro = 0;

    bool inCats(Map<String, dynamic> r) =>
        _cats.isEmpty ||
        _cats.contains(r['categoria_grupo'] as String? ?? 'institucional');

    for (final r in subset) {
      final natureza = r['natureza'] as String? ?? 'ocorrencia';

      if (natureza == 'estatistica') {
        estatisticas.add(r);
        continue;
      }

      // Donut vê todas as categorias do período (senão uma categoria
      // filtrada some da legenda e não dá pra reativar).
      final categoria = r['categoria_grupo'] as String? ?? 'institucional';
      _categoryCounts[categoria] = (_categoryCounts[categoria] ?? 0) + 1;

      if (!inCats(r)) continue;

      ocorrencias++;
      if (!_ehCidadePedida(r)) daRegiao++;

      final tipo = r['tipo_crime'] as String? ?? 'outros';
      _crimeTypeCounts[tipo] = (_crimeTypeCounts[tipo] ?? 0) + 1;

      final bairro = r['bairro'] as String?;
      if (bairro != null && bairro.isNotEmpty) {
        // Bairro de município vizinho leva o nome da cidade junto. Sem isso,
        // com "+ região" ligado um bairro de Aparecida de Goiânia entrava no
        // ranking como se fosse de Goiânia — e o ranking de bairros é
        // exatamente o que alguém lê pra decidir onde reforçar operação.
        _bairroCounts[_rotuloBairro(bairro, r)] =
            (_bairroCounts[_rotuloBairro(bairro, r)] ?? 0) + 1;
      } else {
        semBairro++;
      }

      final date = r['data_ocorrencia'] as String?;
      if (date != null) {
        dateCounts[date] = (dateCounts[date] ?? 0) + 1;
      }
    }

    _totalOcorrencias = ocorrencias;
    _totalRegiaoNoRecorte = daRegiao;
    _semBairro = semBairro;
    _totalEstatisticas = estatisticas.length;
    _estatisticas = estatisticas;

    _byDate =
        dateCounts.entries
            .map((e) => <String, dynamic>{'date': e.key, 'count': e.value})
            .toList()
          ..sort(
            (a, b) => (a['date'] as String).compareTo(b['date'] as String),
          );

    // Fontes: agrupa por hostname (mesmo veiculo com N materias vira 1 linha com count).
    final officialPattern = RegExp(
      r'\.gov\.br|\.ssp\.|\.seguranca\.|\.sesp\.|\.sspds\.|\.sejusp\.|\.segup\.',
      caseSensitive: false,
    );
    final hostCountOficial = <String, int>{};
    final hostCountMedia = <String, int>{};

    for (final r in subset) {
      if (!inCats(r)) continue;
      final url = r['source_url'] as String? ?? r['url'] as String? ?? '';
      if (url.isEmpty) continue;
      String host;
      try {
        host = Uri.parse(url).host;
      } catch (_) {
        host = url;
      }
      if (officialPattern.hasMatch(url)) {
        hostCountOficial[host] = (hostCountOficial[host] ?? 0) + 1;
      } else {
        hostCountMedia[host] = (hostCountMedia[host] ?? 0) + 1;
      }
    }
    _sourcesOficial =
        hostCountOficial.entries
            .map((e) => {'name': e.key, 'count': e.value.toString()})
            .toList()
          ..sort(
            (a, b) => int.parse(b['count']!).compareTo(int.parse(a['count']!)),
          );
    _sourcesMedia =
        hostCountMedia.entries
            .map((e) => {'name': e.key, 'count': e.value.toString()})
            .toList()
          ..sort(
            (a, b) => int.parse(b['count']!).compareTo(int.parse(a['count']!)),
          );
  }

  /// Municípios distintos presentes no balde de região, pra dizer QUAIS são.
  /// "8 da região metropolitana" não informa; "8 de Aparecida de Goiânia,
  /// Senador Canedo e mais 1" informa.
  String _cidadesDaRegiao() {
    final nomes = <String>{};
    for (final r in widget.regiao) {
      final c = (r['cidade'] as String? ?? '').trim();
      if (c.isNotEmpty) nomes.add(c);
    }
    if (nomes.isEmpty) return 'municípios vizinhos';
    final lista = nomes.toList()..sort();
    if (lista.length <= 2) return lista.join(' e ');
    return '${lista.take(2).join(', ')} e mais ${lista.length - 2}';
  }

  Future<void> _generateAndShareLink() async {
    setState(() => _generatingLink = true);
    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final dateFrom = now.subtract(Duration(days: widget.periodoDias));

      final response = await api.generateReport(
        cidade: widget.cidades.first,
        estado: widget.estado,
        dateFrom: _dateStr(dateFrom),
        dateTo: _dateStr(now),
        searchId: widget.searchId,
      );

      // reportUrl vem 100% do backend (baseado em ADMIN_PANEL_URL por ambiente).
      // Antes tinha fallback hardcoded pra staging admin, que causava misdirect
      // silencioso quando env var faltava no backend.
      final url = response['reportUrl'] as String?;
      if (url == null || url.isEmpty) {
        throw Exception(
          'Backend não retornou reportUrl. Verifique ADMIN_PANEL_URL no servidor.',
        );
      }

      if (mounted) {
        await Share.share(
          'SIMEops — Relatório de Risco\n'
          '${widget.cidades.join(", ")}/${widget.estado}\n\n$url',
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Erro ao gerar relatório: $e')));
      }
    } finally {
      if (mounted) setState(() => _generatingLink = false);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // DATAS E FRASES
  // ══════════════════════════════════════════════════════════════════════

  static const _mesesLongos = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  // Datas escritas à mão, sem `DateFormat('pt_BR')`: a localização do intl
  // precisa de `initializeDateFormatting`, e sem ela a data sai em inglês —
  // num documento que o cliente encaminha pra outra pessoa.
  String _dataLonga(DateTime d) =>
      '${d.day} de ${_mesesLongos[d.month - 1]} de ${d.year}';
  String _horaCurta(DateTime d) =>
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  String _dataCurta(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';

  int get _diasDoRecorte => _sliceDias ?? widget.periodoDias;
  DateTime get _inicioDoRecorte =>
      DateTime.now().subtract(Duration(days: _diasDoRecorte));
  int get _veiculos => _sourcesOficial.length + _sourcesMedia.length;

  String _plural(int n, String um, String varios) => n == 1 ? um : varios;

  /// A frase de abertura, montada dos próprios números.
  ///
  /// Inclui a ressalva metodológica **na primeira dobra**, não num rodapé: o
  /// número que este documento dá é o que a imprensa publicou, e quem lê
  /// precisa saber disso antes de citá-lo numa reunião.
  String get _fraseDeAbertura {
    final b = StringBuffer();
    b.write(
      _plural(
        _totalOcorrencias,
        'ocorrência publicada',
        'ocorrências publicadas',
      ),
    );
    if (_veiculos > 0) {
      b.write(' por $_veiculos ${_plural(_veiculos, 'veículo', 'veículos')}');
    }
    b.write(' em $_diasDoRecorte ${_plural(_diasDoRecorte, 'dia', 'dias')}');

    if (_includeRegiao && _totalRegiaoNoRecorte > 0) {
      final naCidade = _totalOcorrencias - _totalRegiaoNoRecorte;
      b.write(
        ', sendo $naCidade em ${widget.cidades.first} e '
        '$_totalRegiaoNoRecorte na região metropolitana',
      );
    }
    b.write(
      '. É o que a imprensa noticiou — não o total registrado pelas '
      'polícias.',
    );
    return b.toString();
  }

  // ══════════════════════════════════════════════════════════════════════
  // PEÇAS
  // ══════════════════════════════════════════════════════════════════════

  /// A caixa que declara o recorte.
  ///
  /// ⚠️ ISTO EXISTE PORQUE O RELATÓRIO PODIA MENTIR SEM QUERER. Ligado o
  /// "+ antigas", um relatório pedido de 30 dias passava a conter matéria de
  /// até **180 dias** atrás (`manual_search_horizon_days`), e nada — nem a
  /// rosca, nem o ranking de bairro, nem o total — dizia isso. É um documento
  /// que o cliente manda pra outra pessoa; ele tem que declarar o próprio
  /// recorte, em datas e cidades, não em adjetivos.
  Widget _recorteDeclarado() {
    final hoje = DateTime.now();
    final linhas = <String>[
      '${_dataLonga(_inicioDoRecorte)} a ${_dataLonga(hoje)} · $_diasDoRecorte dias',
      widget.cidades.join(', ') +
          (_includeRegiao && widget.regiao.isNotEmpty
              ? ' e mais ${_cidadesDaRegiao()}'
              : ''),
      if (_veiculos > 0)
        'Fonte: $_veiculos ${_plural(_veiculos, 'veículo', 'veículos')} de imprensa',
      if (_includeOld && widget.foraDoPeriodo.isNotEmpty)
        'Inclui ${widget.foraDoPeriodo.length} anteriores a '
            '${_dataCurta(_inicioDoRecorte)} — até ${widget.horizonteDias} dias atrás',
      // Um documento que alguém encaminha precisa dizer de quando ele é.
      'Gerado em ${_dataCurta(hoje)} às ${_horaCurta(hoje)}',
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(13, 12, 13, 13),
        decoration: const BoxDecoration(
          color: SIMEopsColors.navyMid,
          border: Border(
            left: BorderSide(color: SIMEopsColors.white, width: 2),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'RECORTE DESTE DOCUMENTO',
              style: SIMEopsType.slug(color: SIMEopsColors.faint),
            ),
            const SizedBox(height: 8),
            for (final l in linhas)
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(l, style: SIMEopsType.note()),
              ),
          ],
        ),
      ),
    );
  }

  /// Re-fatiar o período. Sem `ChoiceChip` — a cápsula r20 era a peça mais
  /// arredondada do app.
  Widget _fatias() {
    final presets = const [
      7,
      15,
      30,
      60,
      90,
    ].where((d) => d < widget.periodoDias).toList();
    if (presets.isEmpty) return const SizedBox.shrink();

    Widget fatia(String rotulo, bool ativa, VoidCallback aplicar) {
      return Padding(
        padding: const EdgeInsets.only(right: 17),
        child: InkWell(
          onTap: () => setState(() {
            aplicar();
            _computeAnalytics();
          }),
          child: Container(
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: ativa ? SIMEopsColors.greenLight : Colors.transparent,
                  width: 1.5,
                ),
              ),
            ),
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(rotulo, style: SIMEopsType.placeTab(active: ativa)),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
      child: Row(
        children: [
          for (final d in presets)
            fatia('${d}D', _sliceDias == d, () => _sliceDias = d),
          fatia(
            '${widget.periodoDias}D',
            _sliceDias == null,
            () => _sliceDias = null,
          ),
        ],
      ),
    );
  }

  /// Linha com interruptor: nome, o que ele faz em números, e a chave.
  ///
  /// Substitui os dois chips ambíguos (`+ 34 anteriores a 12/07`,
  /// `+ 12 da região`). Chip aceso e chip apagado parecem a mesma coisa a um
  /// metro de distância — e estes dois **mudam todos os números da página**.
  Widget _chave({
    required String titulo,
    required String descricao,
    required bool valor,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
      ),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(titulo, style: SIMEopsType.body().copyWith(fontSize: 15)),
                const SizedBox(height: 3),
                Text(
                  descricao,
                  style: SIMEopsType.note(
                    color: SIMEopsColors.faint,
                  ).copyWith(fontSize: 12.5),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Interruptor(value: valor, onChanged: onChanged),
        ],
      ),
    );
  }

  /// A rosca fica — decisão do João em 09/08.

  // ══════════════════════════════════════════════════════════════════════
  // BUILD
  // ══════════════════════════════════════════════════════════════════════
  /// Deixou de ser tela em 09/08.
  ///
  /// O relatório abria empilhado, por um botão verde de largura inteira, e a
  /// tela da cidade resolvia **a mesma decisão** — ver a lista ou ver o
  /// relatório — com uma aba discreta de duas palavras. Duas gramáticas para a
  /// mesma escolha, e a da cidade é a certa: ali o relatório é um caderno do
  /// mesmo jornal, não um destino. Então isto virou corpo, e quem desenha o
  /// topo é a tela que o hospeda.
  @override
  Widget build(BuildContext context) {
    final bairros = _bairroCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final top = bairros.take(8).toList();

    return ListView(
      padding: const EdgeInsets.only(bottom: 20),
      children: [
        _recorteDeclarado(),
        _fatias(),

        if (widget.foraDoPeriodo.isNotEmpty || widget.regiao.isNotEmpty)
          const SizedBox(height: 20),
        if (widget.foraDoPeriodo.isNotEmpty)
          _chave(
            titulo: 'Incluir o que é mais antigo',
            descricao:
                'Soma ${widget.foraDoPeriodo.length} ocorrências '
                'anteriores a ${_dataCurta(_inicioDoRecorte)}, '
                'até ${widget.horizonteDias} dias atrás',
            valor: _includeOld,
            onChanged: (v) => setState(() {
              _includeOld = v;
              _computeAnalytics();
            }),
          ),
        if (widget.regiao.isNotEmpty)
          _chave(
            titulo: 'Incluir a região metropolitana',
            descricao:
                'Soma ${widget.regiao.length} ocorrências '
                'de ${_cidadesDaRegiao()}',
            valor: _includeRegiao,
            onChanged: (v) => setState(() {
              _includeRegiao = v;
              _computeAnalytics();
            }),
          ),

        // A abertura: o número e o que ele quer dizer.
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 26, 18, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('$_totalOcorrencias', style: SIMEopsType.hero()),
              const SizedBox(height: 7),
              Text(
                _fraseDeAbertura,
                style: SIMEopsType.lead().copyWith(fontSize: 15),
              ),
            ],
          ),
        ),

        if (_categoryCounts.isNotEmpty)
          BlocoRelatorio(
            titulo: 'Por categoria',
            child: RoscaCategorias(
              contagens: _categoryCounts,
              total: _totalOcorrencias,
              selecionadas: _cats,
              onToggle: (cat) => setState(() {
                if (!_cats.add(cat)) _cats.remove(cat);
                _computeAnalytics();
              }),
            ),
          ),

        if (top.isNotEmpty)
          BlocoRelatorio(
            titulo: 'Bairros mais citados',
            nota:
                'Citação na matéria — não é onde o fato ocorreu em '
                '100% dos casos.',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RankBarras(itens: [for (final e in top) (e.key, e.value)]),
                if (_semBairro > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                      '$_semBairro ${_plural(_semBairro, 'ocorrência não tem', 'ocorrências não têm')} '
                      'bairro identificado na matéria.',
                      style: SIMEopsType.note(color: SIMEopsColors.faint),
                    ),
                  ),
                TabelaGemea(
                  linhas: [for (final e in bairros) (e.key, '${e.value}', '')],
                ),
              ],
            ),
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
                // A precisão do ponto, declarada. Um mapa que desenha
                // 18 de 25 itens sem dizer isso deixa quem lê concluir
                // que a cidade inteira está ali.
                Text(
                  '${_mapPoints.length} de $_totalOcorrencias '
                  '${_plural(_totalOcorrencias, 'ocorrência entrou', 'ocorrências entraram')} '
                  'no mapa — o resto não traz bairro na matéria.',
                  style: SIMEopsType.note(color: SIMEopsColors.faint),
                ),
              ],
            ),
          )
        else if (_mapLoading)
          BlocoRelatorio(
            titulo: 'Distribuição no mapa',
            child: const Padding(
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

        if (_byDate.length > 1)
          BlocoRelatorio(
            titulo: 'Volume por semana',
            child: Padding(
              padding: const EdgeInsets.only(top: 14),
              child: WeeklyTrendBars(data: aggregateByWeek(_byDate)),
            ),
          ),

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

        if (_totalEstatisticas > 0 && _executive.isEmpty)
          BlocoRelatorio(
            titulo: 'Indicadores da região',
            child: Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                '$_totalEstatisticas ${_plural(_totalEstatisticas, 'indicador foi coletado', 'indicadores foram coletados')} '
                'no período, mas o resumo não pôde ser montado agora.',
                style: SIMEopsType.note(color: SIMEopsColors.faint),
              ),
            ),
          ),

        FontesAnalisadas(oficiais: _sourcesOficial, midias: _sourcesMedia),

        Padding(
          padding: const EdgeInsets.fromLTRB(18, 30, 18, 0),
          child: FilledButton(
            onPressed: _generatingLink ? null : _generateAndShareLink,
            child: Text(
              _generatingLink ? 'GERANDO O LINK…' : 'COMPARTILHAR RELATÓRIO',
            ),
          ),
        ),
        const EndMark(),
      ],
    );
  }
}
