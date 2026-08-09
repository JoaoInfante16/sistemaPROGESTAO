import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/services/api_service.dart';
import '../../../core/widgets/grid_background.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../feed/widgets/take_card.dart';
import '../widgets/city_card.dart';
import 'city_detail_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<CityOverview> _cities = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCities();
  }

  Future<void> _loadCities() async {
    try {
      final api = context.read<ApiService>();
      final items = await api.getCitiesOverview();
      if (mounted) {
        setState(() {
          _cities = items.map((e) => CityOverview.fromJson(e)).toList();
          _loading = false;
          _error = null;
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

  void _openCity(CityOverview city) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CityDetailScreen(city: city),
      ),
    );
    // Reload badges when returning from detail
    _loadCities();
  }

  @override
  Widget build(BuildContext context) {
    return GridBackground(
      child: RefreshIndicator(
        onRefresh: _loadCities,
        color: SIMEopsColors.teal,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _buildError()
                : _cities.isEmpty
                    ? _buildEmpty()
                    : _buildGrid(),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off, size: 48, color: SIMEopsColors.muted.withValues(alpha: 0.4)),
            const SizedBox(height: 16),
            Text(
              'Não foi possível carregar',
              style: TextStyle(color: SIMEopsColors.muted, fontSize: 14),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () {
                setState(() { _loading = true; _error = null; });
                _loadCities();
              },
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        const SizedBox(height: 120),
        Center(
          child: Column(
            children: [
              Icon(Icons.location_city, size: 56, color: SIMEopsColors.muted.withValues(alpha: 0.3)),
              const SizedBox(height: 16),
              Text(
                'Nenhuma cidade monitorada',
                style: TextStyle(color: SIMEopsColors.muted, fontSize: 15),
              ),
              const SizedBox(height: 6),
              Text(
                'Configure cidades no painel administrativo',
                style: TextStyle(color: SIMEopsColors.muted.withValues(alpha: 0.6), fontSize: 13),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// O topo do jornal. A tela não tinha nenhum — abria direto no primeiro card.
  ///
  /// Ele nasce recebendo o que **saiu** do cabeçalho da cidade: a validade do
  /// que está na tela. A regra passou a ser *estado do sistema mora aqui, uma
  /// vez só; tela de conteúdo mostra conteúdo* — antes essa linha se repetia em
  /// quatro telas e, em cada uma, disputava espaço com o nome da praça.
  ///
  /// `ÚLTIMA HÁ` é a ocorrência mais recente entre **todas** as cidades, não a
  /// hora da varredura (esse dado não existe; ver a nota no fim do
  /// `city_detail_screen.dart`). O rótulo diz exatamente isso e nada mais.
  Widget _buildMasthead() {
    DateTime? ultima;
    for (final c in _cities) {
      final t = c.lastNewsAt;
      if (t != null && (ultima == null || t.isAfter(ultima))) ultima = t;
    }

    final marcas = <String>[
      '${_cities.length} ${_cities.length == 1 ? 'PRAÇA' : 'PRAÇAS'}',
      if (ultima != null) 'ÚLTIMA ${_agoLabel(ultima)}',
    ];

    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: SIMEopsColors.white, width: 2),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text.rich(
            TextSpan(children: [
              const TextSpan(text: 'SIME'),
              TextSpan(
                text: 'OPS',
                style: TextStyle(color: SIMEopsColors.greenLight),
              ),
            ]),
            style: SIMEopsType.wordmark(size: 25),
          ),
          const SizedBox(height: 9),
          Text(
            marcas.join(' · '),
            style: SIMEopsType.slug(color: SIMEopsColors.faint),
          ),
        ],
      ),
    );
  }

  static String _agoLabel(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 60) return 'AGORA';
    if (d.inHours < 24) return 'HÁ ${d.inHours}H';
    return 'HÁ ${d.inDays}D';
  }

  Widget _buildGrid() {
    // Cidade com novidade ganha o bloco inteiro; cidade quieta vira linha.
    // Regra semântica, não "top N": num dia parado a tela toda colapsa, num
    // dia agitado ela toda expande — é o que faz 4 e 20 cidades funcionarem
    // no mesmo layout.
    final loud = _cities.where((c) => c.hasUnread).toList();
    final quiet = _cities.where((c) => !c.hasUnread).toList();

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(child: _buildMasthead()),

        SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final city = loud[index];
              return Column(
                children: [
                  CityCard(city: city, onTap: () => _openCity(city)),
                  if (index < loud.length - 1) const TakeRule(),
                ],
              );
            },
            childCount: loud.length,
          ),
        ),

        if (quiet.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.only(top: loud.isEmpty ? 8 : 26),
              child: Row(
                children: [
                  const SizedBox(width: 18),
                  Text(
                    loud.isEmpty ? 'MONITORADAS' : 'SEM NOVIDADE HOJE',
                    style: SIMEopsType.dateline(color: SIMEopsColors.faint),
                  ),
                  const SizedBox(width: 11),
                  const Expanded(
                    child: Divider(color: SIMEopsColors.rule, height: 1),
                  ),
                  const SizedBox(width: 18),
                ],
              ),
            ),
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => QuietCityRow(
                city: quiet[index],
                onTap: () => _openCity(quiet[index]),
              ),
              childCount: quiet.length,
            ),
          ),
        ],

        const SliverToBoxAdapter(child: EndMark()),
        const SliverToBoxAdapter(child: SizedBox(height: 90)),
      ],
    );
  }
}

