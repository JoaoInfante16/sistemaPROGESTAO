import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/models/preferencias_de_alerta.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/services/push_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/widgets/esqueleto.dart';
import '../../../core/widgets/interruptor.dart';
import '../../../core/widgets/masthead.dart';

/// Configurações — e, desde 13/08, **o único lugar** onde se configura alerta.
///
/// 🚨 A preferência de notificação morava numa tela própria, aberta por uma
/// linha daqui. Duas telas pra uma configuração de dez linhas: a pessoa tocava
/// em "Notificações" esperando ligar ou desligar e caía noutro lugar, com o
/// interruptor global repetido lá dentro — **duas chaves pro mesmo estado**, que
/// é como as duas começam a discordar.
///
/// Agora a linha traz o interruptor, e as cidades vêm logo abaixo, recuadas.
/// Nada além disso — João, 13/08: *"É toggle on off - tudo, cidade 1 on off,
/// cidade 2, cidade 3. Só isso."*
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  /// A chave global — vale pra este aparelho.
  bool _ligado = true;

  PreferenciasDeAlerta _prefs = const PreferenciasDeAlerta();

  /// 🚨 **A linha é o LUGAR, e lugar pode ser um grupo.**
  ///
  /// Isto listava cidade por cidade, vindo de `getLocations()`, e quebrava a
  /// Grande Florianópolis em três linhas. João, 13/08: *"os grupos nunca se
  /// separam"* — no monitoramento ele é um card só, no relatório é um recorte
  /// só, e aqui tinha que ser um interruptor só.
  ///
  /// Por isso a fonte passou a ser `getCitiesOverview()`, a **mesma** do
  /// dashboard: a unidade que a pessoa enxerga no app é a unidade que ela
  /// configura aqui. Duas listas de lugar com recortes diferentes é como as
  /// duas passam a discordar.
  ///
  /// [membros] são as cidades de verdade que aquela linha representa — é o que
  /// vai gravado, porque o filtro do backend compara com `news.cidade`, que é
  /// sempre município, nunca grupo.
  List<({String rotulo, String etiqueta, List<String> membros})> _lugares =
      const [];

  bool _carregando = true;
  bool _falhou = false;

  /// Lida do pacote instalado, não escrita à mão.
  /// Antes era a string '1.1.0' no meio do widget — e já estava errada (o
  /// pubspec dizia 1.1.1). Versão chumbada envelhece calada e depois manda o
  /// suporte investigar o bug errado.
  String _version = '';

  @override
  void initState() {
    super.initState();
    _carregar();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    final info = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() => _version = '${info.version} (${info.buildNumber})');
    }
  }

  /// 🚨 As três cargas são **independentes**, e isso é o conserto de um defeito
  /// real, visto no aparelho em 13/08: era um `try` só, em sequência, e o
  /// `getPreferenciasDeAlerta` no meio. Como a tabela `user_notification_prefs`
  /// ainda não existe (migration 032 escrita e não rodada), essa chamada falha
  /// — e derrubava junto a **lista de cidades**, que não tem nada a ver com
  /// ela. A tela dizia "não foi possível carregar" quando na verdade só a
  /// preferência tinha faltado.
  ///
  /// Cada falha agora custa só o que ela é:
  /// - chave global: mora no aparelho, nunca falha por rede;
  /// - preferência: falhando, cai no padrão (`null` = todas ligadas), que é
  ///   exatamente o comportamento de quem nunca abriu esta tela;
  /// - cidades: **a única** cuja falha é falha de verdade, porque sem elas não
  ///   há o que configurar.
  Future<void> _carregar() async {
    final api = context.read<ApiService>();

    final ligado = await PushService.areNotificationsEnabled();

    final prefs = await api.getPreferenciasDeAlerta().catchError((e) {
      debugPrint('[Configurações] preferências indisponíveis: $e');
      return const PreferenciasDeAlerta();
    });

    List<({String rotulo, String etiqueta, List<String> membros})>? lugares;
    try {
      final overview = await api.getCitiesOverview();
      lugares = [
        for (final raw in overview)
          () {
            final c = CityOverview.fromJson(raw);
            final membros = c.isGroup
                ? (c.cityNames ?? const <String>[])
                : <String>[c.name];
            return (
              rotulo: c.name,
              // Grupo diz de quantos municípios é feito; cidade avulsa diz a
              // UF. As duas respondem a mesma pergunta — "o que é isto?" — e
              // por isso ocupam a mesma posição na linha.
              etiqueta: c.isGroup
                  ? '${membros.length} '
                        '${membros.length == 1 ? 'CIDADE' : 'CIDADES'}'
                  : abbrState(c.parentState ?? ''),
              membros: membros,
            );
          }(),
      ]..removeWhere((l) => l.membros.isEmpty);
    } catch (e) {
      debugPrint('[Configurações] lugares: $e');
    }

    if (!mounted) return;
    setState(() {
      _ligado = ligado;
      _prefs = prefs;
      _lugares = lugares ?? const [];
      _carregando = false;
      _falhou = lugares == null;
    });
  }

  /// Todos os municípios de todas as linhas.
  ///
  /// 🚨 É a materialização de "todas", e ela é obrigatória antes de tirar o
  /// primeiro item: em [PreferenciasDeAlerta], `null` quer dizer **todas**, e
  /// `null` menos um item continuaria `null` — o toque não faria nada. É a
  /// armadilha central deste modelo.
  List<String> get _todosOsMunicipios => [
    for (final l in _lugares) ...l.membros,
  ];

  /// Um lugar está ligado quando **qualquer** município dele está.
  ///
  /// Não é "todos": um grupo cujo estado ficou pela metade (por um APK antigo,
  /// ou por preferência gravada antes desta tela existir) precisa aparecer
  /// ligado, senão a pessoa vê desligado e continua recebendo — que é a pior
  /// mentira que uma tela de alerta pode contar.
  bool _lugarLigado(List<String> membros) =>
      membros.any((m) => _prefs.aceitaCidade(m));

  /// Liga/desliga o lugar **inteiro**, porque grupo não se separa.
  Future<void> _alternarLugar(List<String> membros) async {
    final desligando = _lugarLigado(membros);
    var lista = [...(_prefs.cidades ?? _todosOsMunicipios)];
    if (desligando) {
      lista.removeWhere(membros.contains);
    } else {
      for (final m in membros) {
        if (!lista.contains(m)) lista.add(m);
      }
    }
    await _gravar(_prefs.copyWith(cidades: lista));
  }

  /// Grava a cada toque, sem botão de salvar.
  ///
  /// Tela de preferência com botão SALVAR é tela que perde escolha: a pessoa
  /// marca três coisas, volta pela seta e nada foi gravado. Falhando, o estado
  /// visual volta atrás — em vez de mentir que salvou.
  Future<void> _gravar(PreferenciasDeAlerta novas) async {
    final anteriores = _prefs;
    setState(() => _prefs = novas);
    try {
      await context.read<ApiService>().salvarPreferenciasDeAlerta(novas);
    } catch (_) {
      if (!mounted) return;
      setState(() => _prefs = anteriores);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível salvar. Tente de novo.'),
        ),
      );
    }
  }

  Future<void> _alternarGlobal(bool valor) async {
    setState(() => _ligado = valor);
    // Os dois serviços saem do `context` **antes** do primeiro await: depois
    // dele o widget pode já ter sido descartado, e ler o contexto aí é o
    // `use_build_context_synchronously` que o analyzer aponta.
    final api = context.read<ApiService>();
    final push = context.read<PushService>();
    try {
      await PushService.setNotificationsEnabled(valor);
      if (valor) {
        await push.registerCurrentDevice();
      } else {
        await api.unregisterDevice();
      }
    } catch (e) {
      debugPrint('[Configurações] toggle global: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();

    return ListView(
      padding: const EdgeInsets.only(bottom: 20),
      children: [
        const Masthead(titulo: 'Configurações'),

        const _Secao('CONTA'),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                auth.currentUser?.email ?? 'Modo anônimo',
                style: SIMEopsType.body().copyWith(fontSize: 18),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 6),
              // O amarelinho do OPS — pedido do João em 13/08.
              //
              // ⚠️ É uma reversão consciente: em 09/08 esta linha saiu do verde
              // com o argumento de que sessão ativa é o estado normal e não
              // merece ser o elemento mais saturado da tela. O João decidiu o
              // contrário, e a decisão é dele. Fica registrado pra ninguém
              // "consertar" de volta achando que foi descuido.
              Text(
                auth.isAuthenticated
                    ? 'SESSÃO ATIVA · ACESSO LIBERADO PELO ADMINISTRADOR'
                    : 'SEM LOGIN',
                style: SIMEopsType.slug(
                  color: auth.isAuthenticated
                      ? SIMEopsColors.greenLight
                      : SIMEopsColors.alert,
                ),
              ),
            ],
          ),
        ),

        _Secao('ALERTAS', direita: _ligado ? null : 'DESLIGADAS'),

        // A linha-mãe: ela **é** o interruptor, não uma porta pra outro lugar.
        _LinhaDeChave(
          titulo: 'Notificações',
          descricao: _ligado
              ? 'Avisa quando chega ocorrência nova e quando uma consulta termina'
              : 'Nenhum aviso — as ocorrências continuam sendo coletadas',
          valor: _ligado,
          onChanged: _alternarGlobal,
          destaque: true,
        ),

        if (_carregando)
          const Padding(
            padding: EdgeInsets.fromLTRB(18, 18, 18, 0),
            child: EsqueletoDeBloco(linhas: 5, altura: 14),
          )
        else if (_falhou)
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
            child: Text(
              'Não foi possível carregar as cidades. Verifique a conexão e '
              'volte a esta tela.',
              style: SIMEopsType.note(),
            ),
          )
        else
          // ⚠️ Aqui havia também ASSUNTOS (as 5 categorias) e uma chave de
          // "balanços e números". Saíram em 13/08: *"É toggle on off - tudo,
          // cidade 1 on off, cidade 2, cidade 3. Só isso."* Escolher assunto é
          // afinação que quase ninguém faz e que todo mundo tem que ler pra
          // decidir não fazer — e a tela de alerta é justamente onde o usuário
          // quer resolver em dois toques.
          //
          // O backend continua sabendo filtrar por categoria (`querReceber` em
          // `pushService.ts`); o app só não manda mais essa preferência, e
          // `categorias: null` quer dizer todas. Nada quebra, e o dia em que a
          // escolha voltar, o outro lado já está pronto.
          //
          // Com tudo desligado, escolher cidade não muda nada — e um controle
          // que não muda nada ensina que os controles dali não mudam nada.
          // Fica visível e apagado, não some: sumir esconderia o que a pessoa
          // já configurou.
          Opacity(
            opacity: _ligado ? 1 : 0.35,
            child: IgnorePointer(
              ignoring: !_ligado,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final l in _lugares)
                    _LinhaDeChave(
                      titulo: l.rotulo,
                      etiqueta: l.etiqueta,
                      valor: _lugarLigado(l.membros),
                      onChanged: (_) => _alternarLugar(l.membros),
                      recuada: true,
                    ),
                ],
              ),
            ),
          ),

        if (auth.isAuthenticated) ...[
          const SizedBox(height: 34),
          _LinhaDeToque(
            titulo: 'Sair da conta',
            cor: SIMEopsColors.alert,
            onTap: _confirmLogout,
          ),
        ],

        // ⚠️ A seção APLICATIVO ocupava duas linhas inteiras pra dizer a versão
        // e repetir o nome do app na tela do próprio app. Virou rodapé: a mesma
        // informação, num degrau de tipo que corresponde à importância dela.
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 30, 18, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Divider(color: SIMEopsColors.rule, height: 1),
              const SizedBox(height: 12),
              Text(
                'SIMEOPS ${_version.isEmpty ? '' : '$_version · '}PROGESTÃO',
                style: SIMEopsType.slug(color: SIMEopsColors.faint),
              ),
              const SizedBox(height: 3),
              Text(
                'Monitoramento de ocorrências na imprensa',
                style: SIMEopsType.slug(color: SIMEopsColors.faint),
              ),
            ],
          ),
        ),

        const SizedBox(height: 30),
      ],
    );
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: SIMEopsColors.navyLight,
        shape: const RoundedRectangleBorder(
          side: BorderSide(color: SIMEopsColors.ruleStrong),
        ),
        title: Text('Sair da conta', style: SIMEopsType.dialogTitle()),
        content: Text(
          // O desbloqueio pelo celular é apagado junto — senão o login
          // automático relogava na hora e o usuário não conseguia sair.
          'O acesso salvo neste aparelho é apagado. Para voltar você vai '
          'precisar do e-mail e da senha.',
          style: SIMEopsType.lead(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('CANCELAR'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<AuthService>().signOut();
            },
            child: const Text('SAIR'),
          ),
        ],
      ),
    );
  }
}

class _Secao extends StatelessWidget {
  final String label;
  final String? direita;

  const _Secao(this.label, {this.direita});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 28, 18, 0),
    child: Row(
      children: [
        Text(label, style: SIMEopsType.dateline(color: SIMEopsColors.faint)),
        const SizedBox(width: 11),
        const Expanded(child: Divider(color: SIMEopsColors.rule, height: 1)),
        if (direita != null) ...[
          const SizedBox(width: 11),
          Text(direita!, style: SIMEopsType.slug(color: SIMEopsColors.faint)),
        ],
      ],
    ),
  );
}

/// Linha com interruptor.
///
/// [recuada] afasta da margem os itens que **dependem** da chave de cima — o
/// recuo é o que diz "isto está dentro daquilo" sem precisar de caixa nem de
/// título. [destaque] é da linha-mãe, que é a única em corpo cheio.
class _LinhaDeChave extends StatelessWidget {
  final String titulo;
  final String? descricao;
  final String? etiqueta;
  final bool valor;
  final ValueChanged<bool> onChanged;
  final bool recuada;
  final bool destaque;

  const _LinhaDeChave({
    required this.titulo,
    required this.valor,
    required this.onChanged,
    this.descricao,
    this.etiqueta,
    this.recuada = false,
    this.destaque = false,
  });

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => onChanged(!valor),
    child: Padding(
      padding: EdgeInsets.fromLTRB(recuada ? 30 : 18, 13, 18, 13),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        titulo,
                        style: SIMEopsType.body().copyWith(
                          fontSize: destaque ? 16 : 15,
                          color: valor
                              ? SIMEopsColors.white
                              : SIMEopsColors.muted,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (etiqueta != null) ...[
                      const SizedBox(width: 9),
                      Text(
                        etiqueta!,
                        style: SIMEopsType.slug(color: SIMEopsColors.faint),
                      ),
                    ],
                  ],
                ),
                if (descricao != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    descricao!,
                    style: SIMEopsType.lead(
                      color: SIMEopsColors.faint,
                    ).copyWith(fontSize: 12.5),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 14),
          Interruptor(value: valor, onChanged: onChanged),
        ],
      ),
    ),
  );
}

/// Linha que só leva a uma ação — hoje, só o sair.
class _LinhaDeToque extends StatelessWidget {
  final String titulo;
  final Color? cor;
  final VoidCallback onTap;

  const _LinhaDeToque({required this.titulo, required this.onTap, this.cor});

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    child: Container(
      decoration: const BoxDecoration(
        border: Border(
          top: BorderSide(color: SIMEopsColors.rule),
          bottom: BorderSide(color: SIMEopsColors.rule),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: Text(titulo, style: SIMEopsType.body().copyWith(color: cor)),
    ),
  );
}

// O `_Switch` retangular nasceu aqui e virou `core/widgets/interruptor.dart`
// em 09/08, quando o relatório precisou do mesmo desenho pra ligar a região
// metropolitana.
