import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/models/preferencias_de_alerta.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/push_service.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/widgets/cat_chip.dart';
import '../../../core/widgets/esqueleto.dart';
import '../../../core/widgets/interruptor.dart';
import '../../../core/widgets/masthead.dart';

/// O que chega neste aparelho.
///
/// **Por que a tela existe.** Até aqui o push ia para **todos os aparelhos
/// ativos, sem filtro nenhum** — o cliente de Florianópolis recebia ocorrência
/// de Porto Alegre, e um balanço estatístico (*"homicídios caíram 12%"*)
/// chegava com a mesma urgência de um homicídio no Centro. A única chave era o
/// `push_enabled` global do painel, que vale para todo mundo de uma vez.
///
/// **Ligado ou desligado, e só.** Decisão do João: quem define **como** avisa é
/// o Android, na tela de notificações dele, canal por canal. O app decide só
/// **o que** chega e o que é urgente. Repetir a escolha de som aqui dentro
/// criaria dois lugares para a mesma configuração — e é assim que os dois
/// passam a discordar.
class NotificacoesScreen extends StatefulWidget {
  const NotificacoesScreen({super.key});

  @override
  State<NotificacoesScreen> createState() => _NotificacoesScreenState();
}

class _NotificacoesScreenState extends State<NotificacoesScreen> {
  PreferenciasDeAlerta _prefs = const PreferenciasDeAlerta();
  List<({String estado, String cidade})> _cidades = const [];
  bool _carregando = true;
  bool _falhou = false;

  /// A chave global, a mesma da tela de Configurações.
  bool _ligado = true;

  @override
  void initState() {
    super.initState();
    _carregar();
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
      setState(() {
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
      debugPrint('[Notificações] toggle global: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final nomesDeCidade = _cidades.map((c) => c.cidade).toList();

    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 40),
          children: [
            Masthead(
              titulo: 'Notificações',
              onVoltar: () => Navigator.of(context).pop(),
              direita: _ligado ? 'ATIVADAS' : 'DESLIGADAS',
            ),

            _LinhaDeChave(
              titulo: 'Receber notificações',
              descricao: _ligado
                  ? 'Avisa quando uma consulta termina e quando chega ocorrência nova'
                  : 'Nenhum aviso — as ocorrências continuam sendo coletadas',
              valor: _ligado,
              onChanged: _alternarGlobal,
            ),

            if (_carregando)
              const Padding(
                padding: EdgeInsets.fromLTRB(18, 30, 18, 0),
                child: EsqueletoDeBloco(linhas: 6, altura: 14),
              )
            else if (_falhou)
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 30, 18, 0),
                child: Text(
                  'Não foi possível carregar as preferências. Verifique a '
                  'conexão e abra de novo.',
                  style: SIMEopsType.note(),
                ),
              )
            else ...[
              // Com tudo desligado, escolher cidade e assunto não muda nada —
              // e um controle que não muda nada ensina que os controles dali
              // não mudam nada. Fica visível e apagado, não some: sumir
              // esconderia o que a pessoa já configurou.
              Opacity(
                opacity: _ligado ? 1 : 0.35,
                child: IgnorePointer(
                  ignoring: !_ligado,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _Secao(
                        'CIDADES',
                        contagem: _contagem(
                          _prefs.cidades,
                          nomesDeCidade.length,
                        ),
                      ),
                      for (final c in _cidades)
                        _LinhaDeChave(
                          titulo: c.cidade,
                          descricao: abbrState(c.estado),
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
                        ),

                      _Secao(
                        'ASSUNTOS',
                        contagem: _contagem(
                          _prefs.categorias,
                          categoryOrder.length,
                        ),
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
                        ),

                      const _Secao('NÚMEROS E BALANÇOS'),
                      _LinhaDeChave(
                        titulo: 'Notícias de estatística',
                        descricao:
                            'Balanços e variações — "homicídios caíram 12%". '
                            'Não são ocorrências.',
                        valor: _prefs.estatisticas,
                        onChanged: (v) =>
                            _gravar(_prefs.copyWith(estatisticas: v)),
                      ),
                    ],
                  ),
                ),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(18, 34, 18, 0),
                child: Text(
                  'Ocorrência de Segurança chega pelo canal URGENTE; o resto '
                  'pelo ROTINA. O som de cada canal quem define é o Android, '
                  'em Configurações → Notificações → SIMEops.',
                  style: SIMEopsType.note(color: SIMEopsColors.faint),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// `2 DE 4` — e nada quando está tudo marcado, que é o estado normal.
  String? _contagem(List<String>? escolhidas, int total) {
    if (escolhidas == null) return null;
    return '${escolhidas.length} DE $total';
  }
}

class _Secao extends StatelessWidget {
  final String label;
  final String? contagem;

  const _Secao(this.label, {this.contagem});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 30, 18, 4),
    child: Row(
      children: [
        Text(label, style: SIMEopsType.dateline(color: SIMEopsColors.faint)),
        const SizedBox(width: 11),
        const Expanded(child: Divider(color: SIMEopsColors.rule, height: 1)),
        if (contagem != null) ...[
          const SizedBox(width: 11),
          Text(contagem!, style: SIMEopsType.slug(color: SIMEopsColors.faint)),
        ],
      ],
    ),
  );
}

class _LinhaDeChave extends StatelessWidget {
  final String titulo;
  final String? descricao;
  final String? chip;
  final bool valor;
  final ValueChanged<bool> onChanged;

  const _LinhaDeChave({
    required this.titulo,
    required this.valor,
    required this.onChanged,
    this.descricao,
    this.chip,
  });

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => onChanged(!valor),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(18, 13, 18, 13),
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
                Text(
                  titulo,
                  style: SIMEopsType.body().copyWith(
                    fontSize: 15,
                    color: valor ? SIMEopsColors.white : SIMEopsColors.muted,
                  ),
                ),
                if (descricao != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    descricao!,
                    style: SIMEopsType.slug(color: SIMEopsColors.faint),
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
