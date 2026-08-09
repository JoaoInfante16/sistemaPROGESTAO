import 'package:flutter/material.dart';

import '../../../core/models/assunto.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/widgets/cat_chip.dart';

// Seletor de ASSUNTOS da busca manual.
//
// A tese: o índice do Google tem teto de ~60-70 itens POR PERGUNTA, e não há
// parâmetro que mude isso (medido em 01-02/08). Pedir mais página do mesmo
// assunto não traz nada; perguntar outra coisa traz. Então "quantos assuntos"
// é a alavanca de volume — e o preço dela é tempo, ~36s por assunto.
//
// Por isso cada preset mostra a própria conta (quantos assuntos, quantos
// minutos) em vez de só um nome: "Essencial" sozinho não informa nada, e a
// escolha só é honesta se o custo estiver na frente de quem escolhe.
//
// ── Redesenho de 09/08 ────────────────────────────────────────────────────
// Eram três cartões arredondados lado a lado, e o terceiro ("ESCOLHER") fingia
// ser preset: ele não é um atalho, é uma **porta** — clicar não escolhe nada,
// abre a escolha manual. Botão que se parece com os vizinhos mas faz outra
// coisa é armadilha.
//
// Além disso, ao entrar no modo manual a lista inteira de assuntos se abria
// **dentro do formulário**: cinco blocos de fichas mais o campo de palavra-
// chave, empurrando o botão de iniciar para muito abaixo da dobra.
//
// Agora: dois presets como linhas, e a escolha manual numa folha. Nada foi
// removido — a taxonomia inteira e a palavra-chave livre continuam lá dentro.

/// Segundos por assunto numa janela de 30 dias.
///
/// RECALIBRADO em 03/08 com a primeira busca de lista completa, que é o caso
/// que este número existe pra prever:
///
/// | medição | assuntos | dias | tempo | → por assunto |
/// |---|---|---|---|---|
/// | Campo Grande (02/08) | 5 | 60 | 5min31 | 47s |
/// | **Goiânia (03/08)** | **17** | **34** | **~11min** | **36s** |
///
/// O 47 vinha de uma busca de 5 assuntos e superestimava em ~27% no caso de 17
/// — sublinear, porque o estágio 1 dispara as queries em paralelo e só os
/// estágios 4 e 5 crescem com o volume.
///
/// A medição de 03/08 já inclui a migration 027 (OpenAI 5 → 20 concorrentes),
/// que cortou o Filter2 de ~12min para 188s. Com a 028 (Jina 10 → 20) o estágio
/// 4 deve cair de 327s para ~165s, e este número tende a ~28 — **a confirmar
/// medindo**, não ajustar por dedução.
///
/// Errar pra cima é de propósito: prometer 11 e entregar 9 é melhor que o
/// contrário.
const _segundosPorAssunto = 36;

/// Estimativa de duração da busca.
///
/// Escala com a RAIZ do período, e não linearmente, porque é assim que os tetos
/// de coleta do backend escalam (`manualSearchCaps.ts`): o índice de notícias
/// rareia conforme se volta no tempo, então dobrar o período não dobra o que há
/// pra achar. Cidade grande rende mais que cidade pequena, então isto é uma
/// ordem de grandeza — o rótulo diz "~".
Duration estimativaBusca(int quantosAssuntos, int periodoDias) {
  if (quantosAssuntos <= 0) return Duration.zero;
  final fator = (periodoDias / 30).clamp(0.2, 12.0);
  final segundos = quantosAssuntos * _segundosPorAssunto * _raiz(fator);
  return Duration(seconds: segundos.round());
}

double _raiz(double x) {
  var r = x;
  for (var i = 0; i < 20; i++) {
    r = (r + x / r) / 2;
  }
  return r;
}

String formatarEstimativa(Duration d) {
  if (d.inSeconds < 60) return '~${d.inSeconds}s';
  final min = (d.inSeconds / 60).round();
  if (min < 60) return '~$min min';
  final h = min ~/ 60;
  final resto = min % 60;
  return resto > 0 ? '~${h}h ${resto}min' : '~${h}h';
}

enum _Modo { essencial, completa, personalizar }

class AssuntosField extends StatefulWidget {
  final Taxonomia taxonomia;
  final int periodoDias;

  /// Termos escolhidos, na ordem do catálogo (livres no fim).
  final ValueChanged<List<String>> onChanged;

  const AssuntosField({
    super.key,
    required this.taxonomia,
    required this.periodoDias,
    required this.onChanged,
  });

  @override
  State<AssuntosField> createState() => _AssuntosFieldState();
}

class _AssuntosFieldState extends State<AssuntosField> {
  _Modo _modo = _Modo.essencial;

  /// Termos do catálogo marcados.
  final Set<String> _marcados = {};

  /// Palavras-chave digitadas — não vivem no catálogo, mas viajam no mesmo
  /// campo `assuntos[]` e recebem o mesmo tratamento nos filtros do backend.
  final List<String> _livres = [];

  @override
  void initState() {
    super.initState();
    _aplicarPreset(_Modo.essencial, notificar: false);
  }

  @override
  void didUpdateWidget(AssuntosField old) {
    super.didUpdateWidget(old);
    // O catálogo chega depois do primeiro build (é uma chamada de rede).
    if (old.taxonomia.isEmpty && !widget.taxonomia.isEmpty) {
      _aplicarPreset(_modo, notificar: true);
    }
  }

  List<String> get _selecionados => [
        ...widget.taxonomia.assuntos
            .where((a) => _marcados.contains(a.termo))
            .map((a) => a.termo),
        ..._livres,
      ];

  void _aplicarPreset(_Modo modo, {bool notificar = true}) {
    setState(() {
      _modo = modo;
      if (modo == _Modo.essencial) {
        _marcados
          ..clear()
          ..addAll(widget.taxonomia.essenciais);
        _livres.clear();
      } else if (modo == _Modo.completa) {
        _marcados
          ..clear()
          ..addAll(widget.taxonomia.assuntos.map((a) => a.termo));
        _livres.clear();
      }
    });
    if (notificar) widget.onChanged(_selecionados);
  }

  Future<void> _abrirEscolha() async {
    final r = await FolhaAssuntos.abrir(
      context,
      taxonomia: widget.taxonomia,
      marcados: _marcados,
      livres: _livres,
      periodoDias: widget.periodoDias,
    );
    if (r == null) return;
    setState(() {
      _marcados
        ..clear()
        ..addAll(r.$1);
      _livres
        ..clear()
        ..addAll(r.$2);
      // Escolher à mão desmarca o preset — mesmo que o resultado coincida com
      // ele, quem mandou foi a escolha manual.
      _modo = _Modo.personalizar;
    });
    widget.onChanged(_selecionados);
  }

  /// Descrição do que está escolhido — é o que responde "o que é Essencial?"
  /// sem obrigar ninguém a abrir nada.
  String get _descricao {
    final total = _selecionados.length;
    if (total == 0) return 'Nenhum assunto escolhido.';

    if (_modo == _Modo.essencial) {
      final labels = widget.taxonomia.assuntos
          .where((a) => a.essencial)
          .map((a) => a.label.toLowerCase())
          .toList();
      return 'Crime comum: ${_listar(labels)}.';
    }
    if (_modo == _Modo.completa) {
      return 'Todos os assuntos do catálogo, de roubo a greve e crime ambiental.';
    }

    final labels = [
      ...widget.taxonomia.assuntos
          .where((a) => _marcados.contains(a.termo))
          .map((a) => a.label.toLowerCase()),
      ..._livres.map((l) => l.toLowerCase()),
    ];
    return _listar(labels.take(4).toList()) +
        (labels.length > 4 ? ' e mais ${labels.length - 4}.' : '.');
  }

  String _listar(List<String> itens) {
    if (itens.isEmpty) return '—';
    if (itens.length == 1) return itens.first;
    return '${itens.take(itens.length - 1).join(', ')} e ${itens.last}';
  }

  @override
  Widget build(BuildContext context) {
    final tax = widget.taxonomia;

    // Sem catálogo (rede falhou), a busca continua possível: o backend cai na
    // lista do painel, que é o comportamento anterior a esta tela existir.
    if (tax.isEmpty) {
      return Text(
        'Catálogo de assuntos indisponível — a busca vai usar a lista padrão.',
        style: SIMEopsType.note(),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _LinhaPreset(
          nome: 'Essencial',
          quantos: tax.essenciais.length,
          periodoDias: widget.periodoDias,
          ativo: _modo == _Modo.essencial,
          onTap: () => _aplicarPreset(_Modo.essencial),
        ),
        _LinhaPreset(
          nome: 'Completa',
          quantos: tax.assuntos.length,
          periodoDias: widget.periodoDias,
          ativo: _modo == _Modo.completa,
          onTap: () => _aplicarPreset(_Modo.completa),
        ),
        if (_modo == _Modo.personalizar)
          _LinhaPreset(
            nome: 'Escolhidos a dedo',
            quantos: _selecionados.length,
            periodoDias: widget.periodoDias,
            ativo: true,
            onTap: _abrirEscolha,
          ),
        // Porta, não preset: fica em corpo de link e fora da pilha de linhas,
        // porque clicar aqui não escolhe nada — abre a escolha.
        InkWell(
          onTap: _abrirEscolha,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 13),
            child: Text('ESCOLHER ASSUNTO POR ASSUNTO →',
                style: SIMEopsType.slug(color: SIMEopsColors.tealLight)),
          ),
        ),
        Text(_descricao, style: SIMEopsType.note()),
      ],
    );
  }
}

/// Um preset: nome à esquerda, a conta à direita, filete embaixo.
class _LinhaPreset extends StatelessWidget {
  final String nome;
  final int quantos;
  final int periodoDias;
  final bool ativo;
  final VoidCallback onTap;

  const _LinhaPreset({
    required this.nome,
    required this.quantos,
    required this.periodoDias,
    required this.ativo,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final tempo = formatarEstimativa(estimativaBusca(quantos, periodoDias));

    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            SizedBox(
              width: 16,
              child: ativo
                  ? Text('▸',
                      style:
                          SIMEopsType.slug(color: SIMEopsColors.greenLight))
                  : null,
            ),
            Expanded(
              child: Text(
                nome,
                style: SIMEopsType.body().copyWith(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color:
                      ativo ? SIMEopsColors.white : SIMEopsColors.muted,
                ),
              ),
            ),
            Text(
              '$quantos ASSUNTOS · $tempo',
              style: SIMEopsType.slug(
                color: ativo ? SIMEopsColors.tealLight : SIMEopsColors.faint,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A escolha manual: catálogo inteiro por categoria + palavra-chave livre.
///
/// Saiu de dentro do formulário e virou folha porque abria cinco blocos de
/// fichas no meio da tela e empurrava o botão de iniciar para fora da dobra.
/// **Nenhuma capacidade mudou** — é a mesma taxonomia e o mesmo campo livre.
class FolhaAssuntos extends StatefulWidget {
  final Taxonomia taxonomia;
  final Set<String> marcados;
  final List<String> livres;
  final int periodoDias;

  const FolhaAssuntos({
    super.key,
    required this.taxonomia,
    required this.marcados,
    required this.livres,
    required this.periodoDias,
  });

  /// Devolve `(marcados, livres)` ou null se fechou sem confirmar.
  static Future<(Set<String>, List<String>)?> abrir(
    BuildContext context, {
    required Taxonomia taxonomia,
    required Set<String> marcados,
    required List<String> livres,
    required int periodoDias,
  }) {
    return showModalBottomSheet<(Set<String>, List<String>)>(
      context: context,
      backgroundColor: SIMEopsColors.navy,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(),
      builder: (_) => FolhaAssuntos(
        taxonomia: taxonomia,
        marcados: marcados,
        livres: livres,
        periodoDias: periodoDias,
      ),
    );
  }

  @override
  State<FolhaAssuntos> createState() => _FolhaAssuntosState();
}

class _FolhaAssuntosState extends State<FolhaAssuntos> {
  late final Set<String> _marcados = {...widget.marcados};
  late final List<String> _livres = [...widget.livres];
  final _livreCtrl = TextEditingController();

  @override
  void dispose() {
    _livreCtrl.dispose();
    super.dispose();
  }

  int get _total => _marcados.length + _livres.length;

  void _adicionarLivre() {
    final texto = _livreCtrl.text.trim();
    if (texto.length < 2) return;

    final jaExiste =
        _livres.any((l) => l.toLowerCase() == texto.toLowerCase()) ||
            widget.taxonomia.assuntos
                .any((a) => a.termo.toLowerCase() == texto.toLowerCase());
    if (jaExiste) {
      _livreCtrl.clear();
      return;
    }
    setState(() {
      _livres.add(texto);
      _livreCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final tax = widget.taxonomia;
    final tempo =
        formatarEstimativa(estimativaBusca(_total, widget.periodoDias));

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.85,
        child: Column(
          children: [
            Container(
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: SIMEopsColors.white, width: 2),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text('Assuntos',
                            style: SIMEopsType.sheetTitle()),
                      ),
                      InkWell(
                        onTap: () => setState(() {
                          _marcados.clear();
                          _livres.clear();
                        }),
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Text('LIMPAR',
                              style: SIMEopsType.slug(
                                  color: SIMEopsColors.tealLight)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // A tese do produto, encostada na escolha. Vivia atrás de um
                  // ícone de "?" no formulário — e explicação atrás de
                  // interrogação é explicação que ninguém lê.
                  Text(
                    'Cada assunto é uma pergunta separada ao buscador, e ele '
                    'devolve no máximo ~60 notícias por pergunta. Perguntar '
                    'mais coisas é a única forma de achar mais — e cada '
                    'assunto acrescenta cerca de 35 segundos.',
                    style: SIMEopsType.note(),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: 18),
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                children: [
                  for (final cat in tax.categorias) ..._bloco(tax, cat),
                  const SizedBox(height: 22),
                  _campoLivre(),
                ],
              ),
            ),
            Container(
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: SIMEopsColors.ruleStrong),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 10),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text('$_total ${_total == 1 ? 'ASSUNTO' : 'ASSUNTOS'}',
                          style: SIMEopsType.slug(color: SIMEopsColors.white)),
                      const Spacer(),
                      Text(_total == 0 ? '—' : tempo,
                          style:
                              SIMEopsType.slug(color: SIMEopsColors.tealLight)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _total == 0
                          ? null
                          : () => Navigator.pop(context, (_marcados, _livres)),
                      child: const Text('USAR ESTES'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _bloco(Taxonomia tax, CategoriaTaxonomia cat) {
    final itens = tax.daCategoria(cat.id);
    if (itens.isEmpty) return const [];

    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 10),
        child: Row(
          children: [
            // Quadrado, não círculo: o resto do sistema não tem canto redondo,
            // e este é o mesmo objeto que aparece na slug da matéria.
            CatChip(cor: cat.cor),
            const SizedBox(width: 9),
            Text(cat.label.toUpperCase(),
                style: SIMEopsType.slug(color: SIMEopsColors.muted)),
          ],
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: Wrap(
          spacing: 7,
          runSpacing: 7,
          children: itens.map((a) {
            final on = _marcados.contains(a.termo);
            return _Ficha(
              label: a.label,
              cor: cat.cor,
              ativo: on,
              onTap: () => setState(() {
                if (!_marcados.add(a.termo)) _marcados.remove(a.termo);
              }),
            );
          }).toList(),
        ),
      ),
    ];
  }

  Widget _campoLivre() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('PALAVRA-CHAVE', style: SIMEopsType.fieldLabel()),
          TextField(
            controller: _livreCtrl,
            onSubmitted: (_) => _adicionarLivre(),
            textInputAction: TextInputAction.done,
            style: SIMEopsType.fieldValue(),
            decoration: InputDecoration(
              hintText: 'ex: acidente rodovia',
              suffixIcon: InkWell(
                onTap: _adicionarLivre,
                child: Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Text('ADICIONAR',
                      style:
                          SIMEopsType.slug(color: SIMEopsColors.tealLight)),
                ),
              ),
              suffixIconConstraints: const BoxConstraints(minWidth: 96),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Vira uma pergunta a mais ao buscador, igual aos assuntos do '
            'catálogo. Serve para o que é específico da sua cidade.',
            style: SIMEopsType.note(),
          ),
          if (_livres.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 7,
              runSpacing: 7,
              children: _livres
                  .map((l) => _Ficha(
                        label: l,
                        cor: SIMEopsColors.tealLight,
                        ativo: true,
                        onTap: () => setState(() => _livres.remove(l)),
                        remover: true,
                      ))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}

/// Ficha de assunto. Retângulo, não cápsula — o sistema não tem canto redondo.
class _Ficha extends StatelessWidget {
  final String label;
  final Color cor;
  final bool ativo;
  final VoidCallback onTap;
  final bool remover;

  const _Ficha({
    required this.label,
    required this.cor,
    required this.ativo,
    required this.onTap,
    this.remover = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        decoration: BoxDecoration(
          color: ativo ? cor.withValues(alpha: 0.16) : null,
          border: Border.all(
            color: ativo ? cor : SIMEopsColors.ruleStrong,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              // Texto em tinta legível, nunca na cor da série: a borda já
              // identifica a categoria.
              style: SIMEopsType.body().copyWith(
                fontSize: 13.5,
                color: ativo ? SIMEopsColors.white : SIMEopsColors.muted,
              ),
            ),
            if (remover) ...[
              const SizedBox(width: 6),
              const Icon(Icons.close, size: 14, color: SIMEopsColors.muted),
            ],
          ],
        ),
      ),
    );
  }
}
