import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/services/api_service.dart';
import '../../../core/widgets/folha_taxonomia.dart';
import '../../../core/widgets/live_dot.dart';
import '../../../core/widgets/masthead.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/widgets/esqueleto.dart';
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
    await Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => CityDetailScreen(city: city)));
    // Reload badges when returning from detail
    _loadCities();
  }

  @override
  Widget build(BuildContext context) {
    // ⚠️ Aqui havia um `GridBackground` — grade animada a 60fps, com `Ticker`
    // repintando a tela inteira pra desenhar linhas a **2-5% de opacidade**.
    // Saiu em 13/08 a pedido do João: *"não tem personalidade, não é bonito,
    // não é tecnológico"*. Animação de fundo permanente é a pior troca possível
    // — cobra bateria o tempo todo por um efeito que ninguém repara, e some com
    // o silêncio que é a linguagem desta interface.
    return RefreshIndicator(
      onRefresh: _loadCities,
      color: SIMEopsColors.teal,
      child: _loading
          ? const EsqueletoDeCidades()
          : _error != null
          ? _buildError()
          : _cities.isEmpty
          ? _buildEmpty()
          : _buildGrid(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.cloud_off,
              size: 48,
              color: SIMEopsColors.muted.withValues(alpha: 0.4),
            ),
            const SizedBox(height: 16),
            Text(
              'Não foi possível carregar',
              style: TextStyle(color: SIMEopsColors.muted, fontSize: 14),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () {
                setState(() {
                  _loading = true;
                  _error = null;
                });
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
              Icon(
                Icons.location_city,
                size: 56,
                color: SIMEopsColors.muted.withValues(alpha: 0.3),
              ),
              const SizedBox(height: 16),
              Text(
                'Nenhuma cidade monitorada',
                style: TextStyle(color: SIMEopsColors.muted, fontSize: 15),
              ),
              const SizedBox(height: 6),
              Text(
                'Configure cidades no painel administrativo',
                style: TextStyle(
                  color: SIMEopsColors.muted.withValues(alpha: 0.6),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Municípios de verdade, não verbetes: um grupo vale pelas cidades que
  /// tem dentro. Somar `_cities.length` dizia "2 CIDADES" para um grupo de
  /// três mais uma avulsa — e o próprio card ao lado dizia "3 CIDADES".
  int get _municipios => _cities.fold<int>(
    0,
    (soma, c) =>
        soma + (c.isGroup ? (c.cityCount ?? c.cityNames?.length ?? 1) : 1),
  );

  /// ⚠️ Aqui morava a palavra **"PRAÇAS"**, e ela era jargão de redação (praça =
  /// a cidade que o jornal cobre). O usuário é gente de segurança pública, não
  /// de jornal: a metáfora do fio serve pra decidir *forma*, nunca pra escolher
  /// as palavras que aparecem na tela. Se um termo precisa ser explicado, ele
  /// não entra.
  ///
  /// `ÚLTIMA HÁ` é a ocorrência mais recente entre **todas** as cidades, não a
  /// hora da varredura (esse dado não existe — ver `LiveDot`). O rótulo diz
  /// exatamente isso e nada mais.
  Widget _buildMasthead() {
    DateTime? ultima;
    for (final c in _cities) {
      final t = c.lastNewsAt;
      if (t != null && (ultima == null || t.isAfter(ultima))) ultima = t;
    }

    return Masthead(
      esquerda: LiveMark(
        dot: const LiveDot(),
        label: ultima != null ? 'ÚLTIMA ${_agoLabel(ultima)}' : 'MONITORANDO',
      ),
      direita:
          '$_municipios '
          '${_municipios == 1 ? 'CIDADE' : 'CIDADES'}',
      // O `?` mora na casa, na altura da marca: é pergunta sobre o **sistema
      // inteiro** (o que essas cinco cores querem dizer, o que o robô procura),
      // não sobre a cidade que está aberta. Ver [FolhaTaxonomia].
      acao: InkWell(
        onTap: () => FolhaTaxonomia.abrir(context),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 0, 8),
          child: Text(
            '?',
            style: SIMEopsType.figure(size: 17, color: SIMEopsColors.tealLight),
          ),
        ),
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
    // Regra semântica, não "top N": num dia agitado a tela expande sozinha.
    //
    // 🚨 **Com o dia inteiro parado, ninguém colapsa.** A regra existe pra
    // fazer as cidades com novidade se destacarem; se NENHUMA tem, não há de
    // que destacar — colapsar só esconde o produto. O João abriu o app com 2
    // cidades, ambas sem não-lidas, e viu duas linhas de 44px e um vazio de
    // tela inteira. A regra foi desenhada pensando em 20 cidades e quebrava
    // silenciosamente em 2, que é o caso real de hoje.
    final temNovidade = _cities.any((c) => c.hasUnread);
    final loud = temNovidade
        ? _cities.where((c) => c.hasUnread).toList()
        : _cities;
    final quiet = temNovidade
        ? _cities.where((c) => !c.hasUnread).toList()
        : <CityOverview>[];

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(child: _buildMasthead()),

        SliverList(
          delegate: SliverChildBuilderDelegate((context, index) {
            final city = loud[index];
            return Column(
              children: [
                CityCard(city: city, onTap: () => _openCity(city)),
                // `ruleStrong`, não o filete do feed: aqui são dois ou três
                // blocos altos, e o traço precisa ser lido como "acabou esta
                // cidade". No feed, com 18 matérias, o filete fraco é o
                // certo — traço forte 18 vezes vira grade.
                if (index < loud.length - 1)
                  const Divider(
                    color: SIMEopsColors.ruleStrong,
                    height: 1,
                    thickness: 1,
                  ),
              ],
            );
          }, childCount: loud.length),
        ),

        if (quiet.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 26),
              child: Row(
                children: [
                  const SizedBox(width: 18),
                  Text(
                    'SEM NOVIDADE HOJE',
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

        const SliverToBoxAdapter(child: SizedBox(height: 90)),
      ],
    );
  }
}
