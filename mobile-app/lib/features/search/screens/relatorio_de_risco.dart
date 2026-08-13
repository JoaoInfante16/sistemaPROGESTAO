import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/crime_point.dart';
import '../../../core/models/executive_data.dart';
import '../../../core/models/news_item.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/documento_de_risco.dart';
import '../../../core/widgets/crime_radar_map.dart';
import '../../../core/widgets/esqueleto.dart';
import '../../../core/widgets/executive_indicators.dart';
import '../../../core/widgets/fontes_analisadas.dart';
import '../../../core/widgets/interruptor.dart';
import '../../../core/widgets/report_pieces.dart';
import '../../../core/widgets/volume_no_tempo.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../feed/widgets/news_detail_sheet.dart';

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
  /// Enquanto o servidor monta o documento.
  bool _ocupado = false;

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

  /// Ocorrências sem bairro na matéria — o que fica **fora do ranking**.
  ///
  /// ⚠️ Aqui estava escrito "o que não entra no mapa nem no ranking", e a
  /// metade do mapa era falsa: o geocode do backend aceita só cidade e devolve
  /// o ponto com `precisao: 'cidade'`. Item sem bairro **entra no mapa**, no
  /// centro da cidade. Da premissa errada saiu a contradição que o João viu no
  /// aparelho — "34 de 86 não citam bairro" logo acima de "86 de 86 entraram
  /// no mapa — o resto não traz bairro".
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
        cidades: widget.cidades,
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
  /// Os nomes crus, ordenados. A capa do documento escreve **todos** — lá o
  /// espaço não é o da tela, e "e mais 1" numa apresentação é uma lacuna.
  List<String> _nomesDaRegiao() {
    final nomes = <String>{};
    for (final r in widget.regiao) {
      final c = (r['cidade'] as String? ?? '').trim();
      if (c.isNotEmpty) nomes.add(c);
    }
    return nomes.toList()..sort();
  }

  String _cidadesDaRegiao() {
    final lista = _nomesDaRegiao();
    if (lista.isEmpty) return 'municípios vizinhos';
    if (lista.length <= 2) return lista.join(' e ');
    return '${lista.take(2).join(', ')} e mais ${lista.length - 2}';
  }

  /// O recorte e as contagens **desta tela**, no formato que o backend espera.
  ///
  /// 🚨 Por que as contagens viajam. O backend sabe reconsultar tudo — e era o
  /// que ele fazia. Só que a tela é um re-fatiamento client-side (período,
  /// categoria, "+ antigas", "+ região") e o backend reconsultava **do zero**,
  /// ignorando os quatro. Papel e tela discordavam, e nenhum dos dois avisava.
  /// Mandando as contagens prontas, os dois passam a bater por construção.
  Map<String, dynamic> _paraODocumento() => {
    'total': _totalOcorrencias,
    'totalRegiao': _totalRegiaoNoRecorte,
    'semBairro': _semBairro,
    'totalEstatisticas': _totalEstatisticas,
    'byCategory': [
      for (final e in _categoryCounts.entries)
        {'categoria': e.key, 'count': e.value},
    ],
    'byCrimeType': [
      for (final e in (_crimeTypeCounts.entries.toList()
            ..sort((a, b) => b.value.compareTo(a.value))))
        {'tipo_crime': e.key, 'count': e.value},
    ],
    'topBairros': [
      for (final e in (_bairroCounts.entries.toList()
            ..sort((a, b) => b.value.compareTo(a.value))))
        {'bairro': e.key, 'count': e.value},
    ],
    'serie': _byDate,
    'sourcesOficial': [
      for (final s in _sourcesOficial)
        {'name': s['name'], 'count': int.tryParse(s['count'] ?? '0') ?? 0},
    ],
    'sourcesMedia': [
      for (final s in _sourcesMedia)
        {'name': s['name'], 'count': int.tryParse(s['count'] ?? '0') ?? 0},
    ],
  };

  /// Monta o documento e joga na folha de compartilhamento do sistema.
  ///
  /// Sai como **PDF** — o porquê e o plano B moram em [DocumentoDeRisco], que é
  /// a mesma peça usada pelo relatório do monitoramento.
  Future<void> _publicar() async {
    setState(() => _ocupado = true);
    // Os dois saem do context antes do await — depois dele o widget pode já ter
    // sido descartado.
    final documento = DocumentoDeRisco(context.read<ApiService>());
    final messenger = ScaffoldMessenger.of(context);
    try {
      final agora = DateTime.now();

      final resultado = await documento.compartilhar(
        cidades: widget.cidades,
        estado: widget.estado,
        dateFrom: _dateStr(_inicioDoRecorte),
        dateTo: _dateStr(agora),
        searchId: widget.searchId,
        recorte: {
          'dias': _diasDoRecorte,
          'origem': 'consulta',
          'antigas': _includeOld,
          'regiao': _includeRegiao,
          'categorias': _cats.toList(),
          if (widget.horizonteDias > 0) 'horizonteDias': widget.horizonteDias,
          if (_includeRegiao) 'municipiosVizinhos': _nomesDaRegiao(),
        },
        analytics: _paraODocumento(),
      );

      // Caiu no link: o app segue útil, mas **diz** o que aconteceu. Entregar
      // um link calado quando a pessoa esperava um arquivo é a diferença entre
      // um plano B e uma surpresa.
      if (mounted && resultado == ResultadoDoCompartilhar.link) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text(
              'Não deu para montar o PDF neste aparelho — foi o link do '
              'relatório, que abre em qualquer navegador.',
            ),
          ),
        );
      }
    } catch (e) {
      debugPrint('[Relatório] $e');
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Não foi possível montar o relatório. Tente de novo.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _ocupado = false);
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
  // A forma por extenso (`10 de julho de 2026`) saiu junto com a caixa de
  // recorte. Ela volta no documento exportado (Fase E2), que é onde a data
  // precisa ser lida por alguém que não estava nesta tela.

  /// `10 JUL` — a forma da tela, onde ela divide uma linha com mais três
  /// coisas e não pode gastar dezoito caracteres.
  String _dataMes(DateTime d) =>
      '${d.day} ${_mesesLongos[d.month - 1].substring(0, 3)}';
  // ⚠️ `_horaCurta` e `_dataCurta` moravam aqui. Serviam ao `GERADO 11/08
  // 18:21` da linha do recorte e ao `anteriores a 12/07` da chave — os dois
  // saíram: o carimbo de geração é do documento exportado, e a chave passou a
  // dizer a distância real em dias em vez de uma data de corte. Voltam junto
  // com o export da Fase E2, que é onde a hora de geração significa alguma
  // coisa.

  int get _diasDoRecorte => _sliceDias ?? widget.periodoDias;
  DateTime get _inicioDoRecorte =>
      DateTime.now().subtract(Duration(days: _diasDoRecorte));
  int get _veiculos => _sourcesOficial.length + _sourcesMedia.length;

  /// A que distância, **de verdade**, está a matéria mais antiga do balde
  /// "+ antigas".
  ///
  /// A tela dizia `ATÉ 180 DIAS ATRÁS`, e 180 é o horizonte teórico da
  /// configuração (`manual_search_horizon_days`) — não tem relação nenhuma com
  /// o que a consulta trouxe. Uma tolerância que soma **uma** notícia de 34
  /// dias antes anunciava seis meses e parecia defeito. Este número é medido
  /// no que está na mão.
  int get _diasAntesReais {
    var maior = 0;
    for (final r in widget.foraDoPeriodo) {
      final d = DateTime.tryParse(r['data_ocorrencia'] as String? ?? '');
      if (d == null) continue;
      final dias = _inicioDoRecorte.difference(d).inDays;
      if (dias > maior) maior = dias;
    }
    return maior;
  }

  String _plural(int n, String um, String varios) => n == 1 ? um : varios;

  /// A matéria por trás de um pino do mapa, **sem chamada nova**: os pontos
  /// nascem do mesmo array que esta tela já tem em memória.
  ///
  /// 🚨 Medido em 10/08: os itens de `search_results` **não têm `id`** (0 de
  /// 101; têm `source_url`). Com isso o `getSearchMapPointsRaw` caía no último
  /// fallback e mandava **índice posicional** — "0", "1", "2" —, que não
  /// identifica nada fora daquela lista e ainda muda quando o filtro dela
  /// muda. O backend passou a usar a `source_url`; enquanto o staging não
  /// sobe, o casamento por conteúdo é o que funciona.
  Map<String, dynamic>? _itemDoPonto(CrimePoint p) {
    final pool = [...widget.results, ...widget.regiao, ...widget.foraDoPeriodo];

    for (final r in pool) {
      final rid = (r['id'] ?? r['url'] ?? r['source_url'])?.toString();
      if (rid != null && rid == p.id) return r;
    }

    // Casamento por conteúdo, e **só quando é único**: dois roubos no mesmo
    // bairro no mesmo dia é caso real, e abrir "quase a matéria certa" é pior
    // que não abrir. Ambíguo devolve null, e o card não oferece o link.
    final iguais = pool
        .where(
          (r) =>
              (r['data_ocorrencia'] as String?) == p.data &&
              (r['tipo_crime'] as String?) == p.tipoCrime &&
              (r['bairro'] as String?) == p.bairro &&
              (r['rua'] as String?) == p.rua,
        )
        .toList();
    return iguais.length == 1 ? iguais.first : null;
  }

  /// Os pontos que o recorte **atual** deixa ver.
  ///
  /// O mapa passou a obedecer as mesmas chaves que os números: uma chamada só
  /// traz tudo marcado, e o filtro mora aqui. Antes o backend descartava os
  /// extras antes de geocodificar — ligar "+ região" mudava a página inteira e
  /// o mapa não se mexia.
  ///
  /// A regra é a mesma do `_dateSubset`, de propósito: item de outro balde
  /// aparece se a chave dele estiver ligada; item do balde principal responde
  /// à fatia de período (7D/15D/30D).
  List<CrimePoint> get _pontosNoRecorte => _mapPoints.where((p) {
    if (p.cidadeVizinha && !_includeRegiao) return false;
    if (p.foraDoPeriodo) return _includeOld;
    final d = DateTime.tryParse(p.data);
    return d == null || !d.isBefore(_inicioDoRecorte);
  }).toList();

  MateriaDoPonto? _materiaDoPonto(CrimePoint p) {
    final item = _itemDoPonto(p);
    if (item == null) return null;
    final t = (item['titulo'] as String?)?.trim();
    return (
      titulo: (t == null || t.isEmpty) ? null : t,
      abrir: () =>
          NewsDetailSheet.show(context, NewsItem.fromSearchResult(item)),
    );
  }

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

  /// O recorte, em **uma linha**.
  ///
  /// ⚠️ ELE EXISTE PORQUE O RELATÓRIO PODIA MENTIR SEM QUERER. Ligado o
  /// "+ antigas", um relatório pedido de 30 dias passa a conter matéria de até
  /// **180 dias** atrás (`manual_search_horizon_days`), e nada — nem a rosca,
  /// nem o ranking de bairro, nem o total — dizia isso.
  ///
  /// Era uma caixa de quatro linhas com filete branco, **antes** do número, e
  /// o João apontou o óbvio: ela empurrava o resultado pra fora da primeira
  /// tela pra dizer coisas que a frase de abertura já diz ("por 29 veículos em
  /// 30 dias", e quais cidades). O que sobrava de exclusivo era o intervalo
  /// exato e a hora de geração — e isso cabe numa linha, embaixo da frase.
  ///
  /// A caixa inteira continua fazendo sentido **no documento exportado**
  /// (Fase E2), onde quem lê nunca viu esta tela e não tem a frase acima.
  Widget _linhaDoRecorte() {
    final hoje = DateTime.now();
    final partes = <String>[
      '${_dataMes(_inicioDoRecorte)} – ${_dataMes(hoje)}',
      if (_includeOld && widget.foraDoPeriodo.isNotEmpty)
        'INCLUI ATÉ $_diasAntesReais DIAS ANTES',
      // Saiu o `GERADO 11/08 18:21`: dentro do app você **acabou** de gerar o
      // relatório e está olhando pra ele. Carimbo de geração só importa quando
      // o documento viaja — e aí ele volta, no exportado da Fase E2, onde quem
      // lê nunca viu esta tela.
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
      child: Text(
        partes.join(' · ').toUpperCase(),
        style: SIMEopsType.slug(color: SIMEopsColors.faint),
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
  /// O número que a chave mexe, em destaque.
  ///
  /// Verde de destaque — o mesmo do `OPS` e do filete da aba aberta. A frase
  /// da chave é a única do relatório em que **um número muda de valor** quando
  /// se toca em alguma coisa; pintar só ele é o que deixa isso visível sem
  /// escrever "atenção" em lugar nenhum.
  TextSpan _n(Object v) => TextSpan(
    text: '$v',
    style: const TextStyle(color: SIMEopsColors.greenLight),
  );

  Widget _chave({
    required String titulo,
    required List<InlineSpan> descricao,
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
                Text(titulo, style: SIMEopsType.rowTitle()),
                const SizedBox(height: 3),
                Text.rich(
                  TextSpan(children: descricao),
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
        // A abertura primeiro. Os controles vêm **depois**, porque só
        // interessam a quem já viu o número e quer mexer nele — ninguém abre um
        // relatório decidindo antes se inclui a região metropolitana. Estavam
        // em cima, e empurravam o resultado pra fora da primeira tela.
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
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
        _linhaDoRecorte(),
        _fatias(),

        if (widget.foraDoPeriodo.isNotEmpty || widget.regiao.isNotEmpty)
          const SizedBox(height: 20),
        if (widget.foraDoPeriodo.isNotEmpty)
          _chave(
            // `Incluir o que é mais antigo` não dizia de que tamanho era o
            // "mais antigo", e a descrição respondia com o horizonte teórico
            // (180 dias) em vez da distância real do que veio. Quem pediu 30
            // dias lia que o app ia trazer coisa de seis meses atrás.
            titulo: 'Aumentar a tolerância de período',
            descricao: [
              const TextSpan(text: 'Inclui '),
              _n(widget.foraDoPeriodo.length),
              TextSpan(
                text:
                    ' ${_plural(widget.foraDoPeriodo.length, 'notícia relevante', 'notícias relevantes')} '
                    'de até ',
              ),
              _n(_diasAntesReais),
              const TextSpan(text: ' dias antes do período pedido'),
            ],
            valor: _includeOld,
            onChanged: (v) => setState(() {
              _includeOld = v;
              _computeAnalytics();
            }),
          ),
        if (widget.regiao.isNotEmpty)
          _chave(
            titulo: 'Incluir a região metropolitana',
            descricao: [
              const TextSpan(text: 'Soma '),
              _n(widget.regiao.length),
              TextSpan(
                text:
                    ' ${_plural(widget.regiao.length, 'ocorrência', 'ocorrências')} '
                    'de ${_cidadesDaRegiao()}',
              ),
            ],
            valor: _includeRegiao,
            onChanged: (v) => setState(() {
              _includeRegiao = v;
              _computeAnalytics();
            }),
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
            // Sem ressalva metodológica em cima: **`MAIS CITADOS` já diz** que
            // o dado é citação, e a linha de baixo — quantas matérias não
            // citam bairro nenhum — informa a confiabilidade do ranking com um
            // número, que é mais forte que a frase. Decisão do João.
            titulo: 'Bairros mais citados',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RankBarras(itens: [for (final e in top) (e.key, e.value)]),
                if (_semBairro > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                      '$_semBairro de $_totalOcorrencias '
                      '${_plural(_totalOcorrencias, 'ocorrência não cita', 'ocorrências não citam')} '
                      'bairro na matéria.',
                      style: SIMEopsType.note(color: SIMEopsColors.faint),
                    ),
                  ),
              ],
            ),
          ),

        if (_pontosNoRecorte.isNotEmpty)
          BlocoRelatorio(
            titulo: 'Distribuição no mapa',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 12),
                CrimeRadarMap(
                  points: _pontosNoRecorte,
                  materiaDoPonto: _materiaDoPonto,
                ),
                const SizedBox(height: 9),
                // A precisão do ponto, declarada — um mapa que desenha 18 de
                // 25 itens sem dizer isso deixa quem lê concluir que a cidade
                // inteira está ali.
                //
                // O que a frase **não pode** mais dizer é que o resto ficou de
                // fora por falta de bairro: item sem bairro entra, no centro
                // da cidade, marcado como `CIDADE` na legenda de precisão. A
                // contradição estava na tela — "34 de 86 não citam bairro" e
                // "86 de 86 entraram no mapa" na mesma dobra.
                Text(
                  [
                    '${_pontosNoRecorte.length} de $_totalOcorrencias '
                        '${_plural(_totalOcorrencias, 'ocorrência entrou', 'ocorrências entraram')} '
                        'no mapa.',
                    if (_semBairro > 0)
                      '$_semBairro sem bairro na matéria ${_plural(_semBairro, 'cai', 'caem')} '
                          'no centro da cidade — são os pontos de precisão CIDADE.',
                  ].join(' '),
                  style: SIMEopsType.note(color: SIMEopsColors.faint),
                ),
              ],
            ),
          )
        else if (_mapLoading)
          BlocoRelatorio(
            titulo: 'Distribuição no mapa',
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 26),
              child: EsqueletoDeBloco(linhas: 4),
            ),
          ),

        if (_byDate.length > 1)
          BlocoRelatorio(
            titulo: 'Volume no tempo',
            child: Padding(
              padding: const EdgeInsets.only(top: 14),
              child: VolumeNoTempo(
                data: agruparNoTempo(_byDate, _diasDoRecorte),
              ),
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

        // ⚠️ Um botão, e o nome que o João pediu desde o começo. Eu tinha
        // partido em dois (ABRIR / ENVIAR) sem ninguém ter pedido: divisão que
        // o usuário não precisa fazer é decisão que a tela empurra pra ele.
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 30, 18, 0),
          child: FilledButton(
            onPressed: _ocupado ? null : _publicar,
            child: Text(
              _ocupado ? 'MONTANDO O DOCUMENTO…' : 'COMPARTILHAR RELATÓRIO',
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
          child: Text(
            // Este texto já mentiu: descrevia o link e o botão "Baixar PDF" de
            // dentro da página, depois de o botão ter passado a entregar o
            // arquivo pronto.
            'Sai em PDF com o recorte que está na tela, pronto para enviar ou '
            'salvar.',
            style: SIMEopsType.note(color: SIMEopsColors.faint),
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }
}
