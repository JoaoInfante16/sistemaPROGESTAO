import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/datas.dart';
import '../../../core/widgets/dialogo_cancelar_consulta.dart';
import '../../../core/widgets/masthead.dart';
import '../widgets/history_card.dart';
import 'manual_search_screen.dart';

/// Divisor de dia do histórico: `HOJE ────────────`.
class _DiaHead extends StatelessWidget {
  final String label;

  const _DiaHead(this.label);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 22, 18, 6),
    child: Row(
      children: [
        Text(label, style: SIMEopsType.dateline()),
        const SizedBox(width: 11),
        const Expanded(child: Divider(color: SIMEopsColors.rule, height: 1)),
      ],
    ),
  );
}

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  List<Map<String, dynamic>> _history = [];
  bool _loading = true;
  String? _error;

  // Selection mode
  bool _selectMode = false;
  final Set<String> _selected = {};

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiService>();
      final history = await api.getSearchHistory();
      if (mounted) {
        setState(() {
          _history = history;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _navigateToNewSearch() async {
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const ManualSearchScreen()));
    _loadHistory();
  }

  void _onTapSearch(Map<String, dynamic> search) async {
    final searchId = search['search_id'] as String? ?? '';

    // Se em modo selecao, toggle selecao
    if (_selectMode) {
      setState(() {
        if (_selected.contains(searchId)) {
          _selected.remove(searchId);
          if (_selected.isEmpty) _selectMode = false;
        } else {
          _selected.add(searchId);
        }
      });
      return;
    }

    final status = search['status'] as String? ?? '';
    if (status == 'failed') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Esta busca falhou. Inicie uma nova.')),
      );
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ManualSearchScreen(resumeSearchId: searchId),
      ),
    );
    _loadHistory();
  }

  /// Cancela sem abrir a consulta.
  ///
  /// Dava para cancelar desde sempre, mas só de dentro da tela de espera — ou
  /// seja, era preciso entrar numa consulta que você já decidiu abandonar. O
  /// diálogo é o mesmo daquela tela, de propósito.
  Future<void> _cancelarBusca(String searchId) async {
    if (!await confirmarCancelamentoDeConsulta(context)) return;
    if (!mounted) return;

    try {
      await context.read<ApiService>().cancelSearch(searchId);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Não foi possível cancelar: $e')),
        );
      }
      return;
    }
    _loadHistory();
  }

  void _onLongPressSearch(Map<String, dynamic> search) {
    final searchId = search['search_id'] as String? ?? '';
    setState(() {
      _selectMode = true;
      _selected.add(searchId);
    });
  }

  void _cancelSelection() {
    setState(() {
      _selectMode = false;
      _selected.clear();
    });
  }

  Future<void> _deleteSelected() async {
    if (_selected.isEmpty) return;

    final count = _selected.length;
    final confirmed = await showDialog<bool>(
      context: context,
      // Mesmo diálogo das outras telas: fundo `navyLight`, canto zero e o
      // vermelho da paleta. Este aqui tinha `Colors.red` — a única cor do app
      // que não vinha de `SIMEopsColors` — e o canto arredondado padrão do
      // Material, que é justamente o que o tema global tirou de todo o resto.
      builder: (ctx) => AlertDialog(
        backgroundColor: SIMEopsColors.navyLight,
        shape: const RoundedRectangleBorder(
          side: BorderSide(color: SIMEopsColors.ruleStrong),
        ),
        title: Text(
          count > 1 ? 'Apagar $count consultas?' : 'Apagar a consulta?',
          style: SIMEopsType.dialogTitle(),
        ),
        content: Text(
          'O resultado sai do histórico e não volta. As ocorrências que ela '
          'encontrou continuam no feed da cidade.',
          style: SIMEopsType.lead(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('MANTER'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: SIMEopsColors.alert,
              foregroundColor: SIMEopsColors.white,
            ),
            child: const Text('APAGAR'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      final api = context.read<ApiService>();
      await api.deleteSearches(_selected.toList());
      _cancelSelection();
      _loadHistory();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '$count busca${count > 1 ? 's' : ''} removida${count > 1 ? 's' : ''}',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Erro ao deletar: $e')));
      }
    }
  }

  /// Agrupa o histórico por dia, preservando a ordem que veio do servidor
  /// (mais recente primeiro). Devolve pares `(rótulo, consultas)`.
  static List<(String, List<Map<String, dynamic>>)> _porDia(
    List<Map<String, dynamic>> historico,
  ) {
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
    final agora = DateTime.now();
    final hoje = DateTime(agora.year, agora.month, agora.day);

    final grupos = <(String, List<Map<String, dynamic>>)>[];
    for (final s in historico) {
      final d = parseApiDate(s['created_at'] as String? ?? '');
      final String rotulo;
      if (d == null) {
        rotulo = 'SEM DATA';
      } else {
        final dia = DateTime(d.year, d.month, d.day);
        if (dia == hoje) {
          rotulo = 'HOJE';
        } else if (dia == hoje.subtract(const Duration(days: 1))) {
          rotulo = 'ONTEM';
        } else {
          rotulo = '${d.day.toString().padLeft(2, '0')} ${meses[d.month - 1]}';
        }
      }
      if (grupos.isNotEmpty && grupos.last.$1 == rotulo) {
        grupos.last.$2.add(s);
      } else {
        grupos.add((rotulo, [s]));
      }
    }
    return grupos;
  }

  /// `▪ NOVA CONSULTA`, logo abaixo do filete.
  ///
  /// O quadradinho de 7px não é enfeite: sem ele a linha é mono 9.5, do mesmo
  /// tamanho e da mesma família dos metadados que ela tem em volta (`HOJE`,
  /// `91 RESULTADOS`, `BA · 30 DIAS`) — e nada distingue o que se toca do que
  /// só se lê. O quadrado é o que declara "isto é um comando".
  ///
  /// Não é um `CatChip`: aquele quadrado carrega **cor de categoria** e a
  /// palavra ao lado é o nome dela. Aqui é marca de ação. Mesmo tamanho, outro
  /// assunto — juntar os dois no mesmo widget seria ensinar que o quadradinho
  /// quer dizer duas coisas.
  ///
  /// `greenLight` e não o teal de ação: é o verde do `OPS` na marca e do
  /// filete da aba aberta — o destaque da casa. Escolha do João, olhando o
  /// aparelho. Fica registrado que esse verde já carrega "ativo", "não lida" e
  /// "fonte oficial"; esta é a quarta coisa que ele diz.
  Widget _acaoNovaConsulta() => InkWell(
    onTap: _navigateToNewSearch,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
      child: Row(
        children: [
          Container(width: 7, height: 7, color: SIMEopsColors.greenLight),
          const SizedBox(width: 9),
          Text(
            'NOVA CONSULTA',
            style: SIMEopsType.slug(color: SIMEopsColors.greenLight),
          ),
        ],
      ),
    ),
  );

  /// Nenhuma consulta ainda.
  ///
  /// **Sem masthead, e o botão por último** — é a anatomia que o feed vazio e
  /// o erro desta mesma tela já usam: título, prosa, ação. Antes o masthead
  /// ficava por cima (dois títulos empilhados, o de baixo maior que o de cima)
  /// e o botão vinha **antes** do título, ou seja: o grito chegava antes da
  /// frase que explica o que ele faz. Quem diz em que aba você está é a barra
  /// de navegação, não um segundo título.
  Widget _vazio() => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    padding: const EdgeInsets.fromLTRB(18, 90, 18, 0),
    children: [
      Text('Nenhuma consulta\nainda', style: SIMEopsType.title()),
      const SizedBox(height: 14),
      Text(
        'A consulta varre a imprensa da cidade que você escolher, no '
        'período que você pedir. Leva alguns minutos e você pode fechar o '
        'app enquanto ela roda.',
        style: SIMEopsType.lead(),
      ),
      const SizedBox(height: 26),
      OutlinedButton(
        onPressed: _navigateToNewSearch,
        child: const Text('NOVA CONSULTA'),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _loadHistory,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 90, 18, 0),
              children: [
                Text(
                  'Não foi possível\ncarregar o histórico',
                  style: SIMEopsType.title(),
                ),
                const SizedBox(height: 12),
                Text(
                  'As consultas anteriores estão no servidor. '
                  'Verifique a conexão e tente de novo.',
                  style: SIMEopsType.lead(),
                ),
                const SizedBox(height: 24),
                OutlinedButton(
                  onPressed: _loadHistory,
                  child: const Text('TENTAR DE NOVO'),
                ),
              ],
            )
          : _history.isEmpty
          ? _vazio()
          : Stack(
              children: [
                ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: EdgeInsets.only(bottom: _selectMode ? 96 : 20),
                  children: [
                    // Cabeçalho limpo, igual ao de Configurações: título e o
                    // filete branco, nada mais. Saíram de cima da linha o
                    // `SEGURE PARA SELECIONAR` e, depois, o próprio
                    // `NOVA CONSULTA` — o cabeçalho nomeia a tela, quem age é
                    // o corpo dela.
                    const Masthead(titulo: 'Consultas'),
                    if (!_selectMode) _acaoNovaConsulta(),

                    // Modo de seleção múltipla
                    if (_selectMode)
                      Container(
                        decoration: const BoxDecoration(
                          border: Border(
                            bottom: BorderSide(color: SIMEopsColors.rule),
                          ),
                        ),
                        padding: const EdgeInsets.fromLTRB(6, 8, 18, 8),
                        child: Row(
                          children: [
                            IconButton(
                              onPressed: _cancelSelection,
                              icon: const Icon(
                                Icons.close,
                                size: 20,
                                color: SIMEopsColors.muted,
                              ),
                            ),
                            Text(
                              '${_selected.length} SELECIONADA'
                              '${_selected.length > 1 ? 'S' : ''}',
                              style: SIMEopsType.slug(
                                color: SIMEopsColors.white,
                              ),
                            ),
                            const Spacer(),
                            InkWell(
                              onTap: () => setState(() {
                                if (_selected.length == _history.length) {
                                  _selected.clear();
                                } else {
                                  for (final s in _history) {
                                    _selected.add(
                                      s['search_id'] as String? ?? '',
                                    );
                                  }
                                }
                              }),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
                                child: Text(
                                  _selected.length == _history.length
                                      ? 'DESMARCAR TODAS'
                                      : 'MARCAR TODAS',
                                  style: SIMEopsType.slug(
                                    color: SIMEopsColors.tealLight,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Agrupado por dia (HOJE · ONTEM · 04 AGO), como no
                    // feed. Era um único "CONSULTAS ANTERIORES" com tudo
                    // embaixo: vinte itens iguais, sem nenhum ponto de
                    // apoio pro olho. O divisor é o que dá ritmo — e de
                    // quebra tira a data de dentro de cada item, que
                    // repetia a mesma informação vinte vezes.
                    ..._porDia(_history).expand(
                      (g) => [
                        if (!_selectMode) _DiaHead(g.$1),
                        ...g.$2.map((search) {
                          final id = search['search_id'] as String? ?? '';
                          return HistoryCard(
                            search: search,
                            selected: _selected.contains(id),
                            onTap: () => _onTapSearch(search),
                            onLongPress: () => _onLongPressSearch(search),
                            // Em modo de seleção não: ali todo toque no
                            // item é marcar, e um link que cancela no
                            // meio disso é armadilha.
                            onCancel: _selectMode
                                ? null
                                : () => _cancelarBusca(id),
                          );
                        }),
                      ],
                    ),
                    const SizedBox(height: 40),
                  ],
                ),

                if (_selectMode && _selected.isNotEmpty)
                  Positioned(
                    left: 18,
                    right: 18,
                    bottom: 18,
                    child: Material(
                      color: SIMEopsColors.alert,
                      child: InkWell(
                        onTap: _deleteSelected,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          child: Center(
                            child: Text(
                              'APAGAR ${_selected.length}',
                              style: SIMEopsType.action(
                                color: SIMEopsColors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
