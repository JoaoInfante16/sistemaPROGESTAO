import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import '../../../core/models/preferencias_de_alerta.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/services/push_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/widgets/cat_chip.dart';
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
/// Agora a linha traz o interruptor, e o que ela controla vem logo abaixo. São
/// 3 cidades e 5 assuntos: cabe. Decisão do João (13/08): *"notificações tem que
/// ter ligado ou desligado... aparece as cidades do monitoramento e daí ele pode
/// desligar cada uma. Ou até 5 nem coloca em pushdown."*
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  /// A chave global — vale pra este aparelho.
  bool _ligado = true;

  PreferenciasDeAlerta _prefs = const PreferenciasDeAlerta();
  List<({String estado, String cidade})> _cidades = const [];
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

  Future<void> _carregar() async {
    final api = context.read<ApiService>();
    try {
      final ligado = await PushService.areNotificationsEnabled();
      final prefs = await api.getPreferenciasDeAlerta();
      final hierarquia = await api.getLocations();

      final cidades = <({String estado, String cidade})>[];
      for (final estado in hierarquia) {
        final nomeEstado = estado['name'] as String? ?? '';
        for (final c in (estado['cities'] as List<dynamic>? ?? [])) {
          final nome = (c as Map<String, dynamic>)['name'] as String? ?? '';
          if (nome.isNotEmpty) {
            cidades.add((estado: nomeEstado, cidade: nome));
          }
        }
      }

      if (!mounted) return;
      setState(() {
        _ligado = ligado;
        _prefs = prefs;
        _cidades = cidades;
        _carregando = false;
      });
    } catch (_) {
      if (!mounted) return;
      // A chave global vive no aparelho e não depende de rede — ela continua
      // valendo mesmo quando o resto não carrega.
      final ligado = await PushService.areNotificationsEnabled();
      if (!mounted) return;
      setState(() {
        _ligado = ligado;
        _carregando = false;
        _falhou = true;
      });
    }
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

  /// Marcar/desmarcar item de uma lista onde **`null` quer dizer "todos"**.
  ///
  /// Desmarcar o primeiro item precisa materializar a lista inteira antes de
  /// tirar um: sem isso, `null` menos um item continuaria `null`, e o toque não
  /// faria nada. É a armadilha central deste modelo, e ela mora aqui.
  List<String> _alternar(List<String>? atual, List<String> todos, String item) {
    final lista = [...(atual ?? todos)];
    if (lista.contains(item)) {
      lista.remove(item);
    } else {
      lista.add(item);
    }
    return lista;
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
    final nomesDeCidade = _cidades.map((c) => c.cidade).toList();

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
              'Não foi possível carregar as cidades e os assuntos. Verifique a '
              'conexão e volte a esta tela.',
              style: SIMEopsType.note(),
            ),
          )
        else
          // Com tudo desligado, escolher cidade e assunto não muda nada — e um
          // controle que não muda nada ensina que os controles dali não mudam
          // nada. Fica visível e apagado, não some: sumir esconderia o que a
          // pessoa já configurou.
          Opacity(
            opacity: _ligado ? 1 : 0.35,
            child: IgnorePointer(
              ignoring: !_ligado,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final c in _cidades)
                    _LinhaDeChave(
                      titulo: c.cidade,
                      etiqueta: abbrState(c.estado),
                      valor: _prefs.aceitaCidade(c.cidade),
                      onChanged: (_) => _gravar(
                        _prefs.copyWith(
                          cidades: _alternar(
                            _prefs.cidades,
                            nomesDeCidade,
                            c.cidade,
                          ),
                        ),
                      ),
                      recuada: true,
                    ),

                  _Secao(
                    'ASSUNTOS',
                    direita: _contagem(_prefs.categorias, categoryOrder.length),
                  ),
                  for (final cat in categoryOrder)
                    _LinhaDeChave(
                      titulo: categoryLabel(cat),
                      chip: cat,
                      valor: _prefs.aceitaCategoria(cat),
                      onChanged: (_) => _gravar(
                        _prefs.copyWith(
                          categorias: _alternar(
                            _prefs.categorias,
                            categoryOrder,
                            cat,
                          ),
                        ),
                      ),
                      recuada: true,
                    ),
                  _LinhaDeChave(
                    titulo: 'Balanços e números',
                    descricao:
                        '"Homicídios caíram 12%" — são estatísticas, '
                        'não ocorrências',
                    valor: _prefs.estatisticas,
                    onChanged: (v) => _gravar(_prefs.copyWith(estatisticas: v)),
                    recuada: true,
                  ),
                ],
              ),
            ),
          ),

        Padding(
          padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
          child: Text(
            'Ocorrência de Segurança chega pelo canal URGENTE; o resto pelo '
            'ROTINA. O som de cada canal quem define é o Android, em '
            'Configurações → Notificações → SIMEops.',
            style: SIMEopsType.note(color: SIMEopsColors.faint),
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

  /// `2 DE 5` — e nada quando está tudo marcado, que é o estado normal.
  String? _contagem(List<String>? escolhidas, int total) {
    if (escolhidas == null) return null;
    return '${escolhidas.length} DE $total';
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
  final String? chip;
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
    this.chip,
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
          if (chip != null) ...[
            CatChip(categoria: chip!),
            const SizedBox(width: 10),
          ],
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
