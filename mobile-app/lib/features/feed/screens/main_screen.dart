import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/category_colors.dart';
import '../../dashboard/screens/dashboard_screen.dart';
import '../../search/screens/search_screen.dart';
import '../../settings/screens/settings_screen.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  /// **A casa fica no meio.** `Monitoramento` é a palavra mais longa das três e
  /// a aba mais usada: na ponta esquerda ela desequilibrava a barra (13 letras
  /// contra 9 e 6) e ainda ficava no canto mais difícil de alcançar com uma
  /// mão. No centro, os flancos se equivalem e o polegar chega sem esticar.
  ///
  /// É uma convenção quebrada de propósito — quase todo app põe a casa à
  /// esquerda. Com três abas e o filete marcando onde você está, resolve no
  /// primeiro toque.
  static const _monitoramento = 1;

  int _currentIndex = _monitoramento;
  int _unreadCount = 0;

  late final List<Widget> _tabs = [
    const SearchScreen(),
    const DashboardScreen(),
    const SettingsScreen(),
  ];

  /// `CONSULTAS`, não `Busca`: a tela se chama Consultas, o botão diz NOVA
  /// CONSULTA e o histórico fala em consulta cancelada. A aba era a única
  /// sobrevivente da palavra antiga. `Monitoramento` também substituiu
  /// `Dashboard`, que era a única das três em inglês.
  static const _rotulos = ['CONSULTAS', 'MONITORAMENTO', 'CONFIG'];

  @override
  void initState() {
    super.initState();
    _loadUnreadCount();
    _publicarCores();
  }

  Future<void> _loadUnreadCount() async {
    try {
      final api = context.read<ApiService>();
      final count = await api.getUnreadCount();
      if (mounted) setState(() => _unreadCount = count);
    } catch (e) { debugPrint('[Main] Unread count error: $e'); }
  }

  /// Puxa a taxonomia UMA vez na entrada e publica as cores de categoria pro
  /// app inteiro (ver `aplicarCoresDaTaxonomia`). A cor é dado do backend —
  /// sem isto, cada tela pintava pela cópia local e as duas tabelas já
  /// divergiram uma vez (Fraude violeta Tailwind na busca, violeta validado
  /// no feed, no mesmo APK). Falhou a rede? O fallback local segura.
  Future<void> _publicarCores() async {
    try {
      final tax = await context.read<ApiService>().getTaxonomia();
      aplicarCoresDaTaxonomia({
        for (final c in tax.categorias) c.id: c.cor,
      });
    } catch (e) {
      debugPrint('[Main] Taxonomia indisponível, cores locais valem: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Sem `AppBar`. Cada aba desenha o próprio topo com o `Masthead` — a
      // barra fixa centralizada duplicava a marca (dois SIMEOPS empilhados no
      // dashboard) e comia 56px de toda tela, para sempre.
      body: SafeArea(
        bottom: false,
        child: IndexedStack(
          index: _currentIndex,
          children: _tabs,
        ),
      ),
      bottomNavigationBar: _barraDeSecoes(),
    );
  }

  /// A barra de baixo era o último pedaço de Material do app: ícone de
  /// biblioteca, rótulo em caixa de sentença e uma cápsula atrás do ativo que
  /// o tema já tinha precisado apagar. Agora é a **mesma peça dos cadernos e
  /// das abas de cidade** — palavra, filete verde de 2px no ativo, sem caixa e
  /// sem ícone. De quebra devolve 16px de altura para toda tela do app.
  ///
  /// Sem ícone, o badge de não lidas não tem onde grudar: vira número em verde
  /// ao lado da palavra, que é como o card da cidade já escreve `6 NOVAS`.
  Widget _barraDeSecoes() => Container(
    decoration: const BoxDecoration(
      color: SIMEopsColors.navy,
      border: Border(top: BorderSide(color: SIMEopsColors.rule)),
    ),
    child: SafeArea(
      top: false,
      child: SizedBox(
        height: 50,
        child: Row(
          children: [
            for (var i = 0; i < _rotulos.length; i++)
              Expanded(child: _aba(i)),
          ],
        ),
      ),
    ),
  );

  Widget _aba(int i) {
    final ativo = _currentIndex == i;
    final naoLidas = i == _monitoramento && _unreadCount > 0;

    return InkWell(
      onTap: () {
        setState(() => _currentIndex = i);
        if (i == _monitoramento) _loadUnreadCount();
      },
      child: Center(
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(
                color: ativo ? SIMEopsColors.greenLight : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          padding: const EdgeInsets.only(top: 9),
          // `Monitoramento` + contador chega perto dos 120px que sobram por
          // coluna numa tela de 360dp. O `scaleDown` só entra em ação nessas —
          // nas demais o texto fica no tamanho da escala.
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text.rich(
              TextSpan(
                text: _rotulos[i],
                children: [
                  if (naoLidas)
                    TextSpan(
                      text: '  $_unreadCount',
                      style: const TextStyle(color: SIMEopsColors.greenLight),
                    ),
                ],
              ),
              style: SIMEopsType.navLabel(active: ativo),
            ),
          ),
        ),
      ),
    );
  }
}
