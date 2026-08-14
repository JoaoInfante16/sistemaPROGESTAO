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
// Por isso o custo em minutos anda colado na contagem: a escolha só é honesta
// se o preço estiver na frente de quem escolhe.
//
// ── Redesenho de 09/08 ────────────────────────────────────────────────────
// Eram três cartões arredondados lado a lado, e o terceiro ("ESCOLHER") fingia
// ser preset: ele não é um atalho, é uma **porta**. Viraram duas linhas de
// preset mais um link, e a escolha manual foi pra uma folha — porque abrir a
// taxonomia inteira dentro do formulário empurrava o botão de iniciar pra fora
// da dobra.
//
// ── Redesenho de 14/08 ────────────────────────────────────────────────────
// O João: *"sobre esse essencial e completa eu tô achando estranho… deixamos só
// 'busca personalizada' onde fica as categorias"*, *"sempre faz busca
// completa"*, *"palavra chave deve ser acessível e não ficar escondida"*.
//
// 🚨 O diagnóstico de 09/08 estava certo e incompleto: a porta parou de parecer
// preset, mas **continuavam três caminhos pro mesmo campo**. Agora há um —
// `Busca personalizada` — e o estado inicial dele é o catálogo inteiro. O que
// era `Essencial` deixou de ser opção e o que era `Completa` virou o padrão.
//
// A palavra-chave subiu da folha pro formulário: estava a dois níveis de
// profundidade e é o campo que serve pro que é específico da cidade do cliente.
// A divisão ficou limpa — **catálogo na folha, texto livre na tela** — e ganhou
// um modo que ignora o catálogo e pergunta só o que foi digitado.
//
// O `?` ao lado da contagem abre a lista **só de leitura** ([FolhaOsAssuntos]):
// informar e editar viraram peças separadas, que é o que faltava em 09/08.

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

/// 🚨 Teto do backend: `assuntos: z.array(...).min(1).max(20)`
/// (`validation.ts:157`). Com o padrão em **todos** os assuntos do catálogo (17),
/// a **4ª palavra-chave** estoura o limite e a consulta toma 400 — algo que quase
/// nunca acontecia quando o padrão eram 5. O app barra aqui, com explicação, em
/// vez de deixar a busca falhar depois de a pessoa apertar iniciar.
const _tetoDeAssuntos = 20;

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
  /// Termos do catálogo marcados. **Nasce com tudo** — ver [_marcarTudo].
  final Set<String> _marcados = {};

  /// Palavras-chave digitadas — não vivem no catálogo, mas viajam no mesmo
  /// campo `assuntos[]` e recebem o mesmo tratamento nos filtros do backend.
  final List<String> _livres = [];

  final _livreCtrl = TextEditingController();

  /// Ignora o catálogo e pergunta **só** o que foi digitado.
  bool _soPalavraChave = false;

  /// Explicação de por que o `ADICIONAR` recusou. Mora aqui e não num
  /// `SnackBar` porque a pessoa está olhando o campo, não o rodapé.
  String? _recusa;

  @override
  void initState() {
    super.initState();
    _marcarTudo(notificar: false);
  }

  @override
  void didUpdateWidget(AssuntosField old) {
    super.didUpdateWidget(old);
    // O catálogo chega depois do primeiro build (é uma chamada de rede).
    if (old.taxonomia.isEmpty && !widget.taxonomia.isEmpty) {
      _marcarTudo(notificar: true);
    }
  }

  @override
  void dispose() {
    _livreCtrl.dispose();
    super.dispose();
  }

  List<String> get _doCatalogo => widget.taxonomia.assuntos
      .where((a) => _marcados.contains(a.termo))
      .map((a) => a.termo)
      .toList();

  /// O que vai pro backend.
  ///
  /// 🚨 **Nunca pode sair vazio.** `buildManualSearchQueries`
  /// (`queryTemplates.ts:146`) faz `assuntos.length > 0 ? assuntos :
  /// getAssuntos()` — mandar lista vazia faz o backend buscar a lista padrão
  /// **inteira**, em silêncio, que é o oposto do que a tela prometeu. Por isso
  /// [_soPalavraChave] só liga com palavra digitada, e se desliga sozinho
  /// quando a última sai.
  List<String> get _selecionados =>
      _soPalavraChave ? [..._livres] : [..._doCatalogo, ..._livres];

  /// O padrão é perguntar **tudo**.
  ///
  /// Eram dois presets (`Essencial` 5 · `Completa` 17) mais uma porta que
  /// parecia um terceiro preset. Três caminhos pro mesmo campo, e o João achou
  /// estranho com razão. Agora há um caminho — a busca personalizada — e o
  /// estado inicial dele é o catálogo completo, então quem não quer escolher
  /// nada continua começando com um toque.
  void _marcarTudo({bool notificar = true}) {
    setState(() {
      _marcados
        ..clear()
        ..addAll(widget.taxonomia.assuntos.map((a) => a.termo));
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
    });
    widget.onChanged(_selecionados);
  }

  /// A lista de assuntos, **só pra ler** — é o que o `?` abre.
  ///
  /// ⚠️ É outra folha que a de escolha, de propósito: uma informa, a outra
  /// edita. Ter as duas no mesmo lugar foi o que fez o antigo `ESCOLHER ASSUNTO
  /// POR ASSUNTO` parecer um preset sendo uma porta.
  void _verAssuntos() => FolhaOsAssuntos.abrir(
    context,
    taxonomia: widget.taxonomia,
    marcados: _soPalavraChave ? const {} : _marcados,
    livres: _livres,
  );

  void _adicionarLivre() {
    final texto = _livreCtrl.text.trim();
    if (texto.length < 2) return;

    final jaExiste =
        _livres.any((l) => l.toLowerCase() == texto.toLowerCase()) ||
        widget.taxonomia.assuntos.any(
          (a) => a.termo.toLowerCase() == texto.toLowerCase(),
        );
    if (jaExiste) {
      setState(() {
        _recusa = 'Essa palavra já está na consulta.';
        _livreCtrl.clear();
      });
      return;
    }

    // O teto é do backend, não desta tela — e com o catálogo inteiro marcado
    // ele chega rápido. Recusar aqui, dizendo o que fazer, é melhor que deixar
    // a consulta tomar 400 depois do toque em iniciar.
    if (_selecionados.length >= _tetoDeAssuntos) {
      setState(() {
        _recusa =
            'A consulta cabe $_tetoDeAssuntos assuntos. Tire algum em '
            '"Busca personalizada" para abrir espaço.';
      });
      return;
    }

    setState(() {
      _livres.add(texto);
      _livreCtrl.clear();
      _recusa = null;
    });
    widget.onChanged(_selecionados);
  }

  void _removerLivre(String termo) {
    setState(() {
      _livres.remove(termo);
      _recusa = null;
      // Sem palavra nenhuma o modo exclusivo mandaria lista vazia, e o backend
      // buscaria a lista padrão inteira em silêncio. Desliga sozinho.
      if (_livres.isEmpty) _soPalavraChave = false;
    });
    widget.onChanged(_selecionados);
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

    final quantos = _selecionados.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // O rótulo da seção É a contagem: ela se move com a escolha, e o verde
        // do OPS marca o número que muda. Antes era um `O QUE PERGUNTAR` fixo
        // com o total escondido três linhas abaixo.
        Row(
          children: [
            Text(
              '$quantos ${quantos == 1 ? 'ASSUNTO' : 'ASSUNTOS'}',
              style: SIMEopsType.fieldLabel(color: SIMEopsColors.greenLight),
            ),
            const SizedBox(width: 9),
            _BotaoAjuda(onTap: _verAssuntos),
          ],
        ),
        _LinhaDeCampo(
          texto: 'Busca personalizada',
          apagada: _soPalavraChave,
          onTap: _soPalavraChave ? null : _abrirEscolha,
        ),

        const SizedBox(height: 26),
        Text('PALAVRA-CHAVE', style: SIMEopsType.fieldLabel()),
        // Subiu da folha pra cá em 14/08: estava a dois níveis de profundidade
        // (tela → folha → rolar até o fim), e é o campo que serve pro que é
        // específico da cidade do cliente — provavelmente o melhor motivo pra
        // alguém abrir uma consulta manual em vez de olhar o monitoramento.
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
                child: Text(
                  'ADICIONAR',
                  style: SIMEopsType.slug(color: SIMEopsColors.tealLight),
                ),
              ),
            ),
            suffixIconConstraints: const BoxConstraints(minWidth: 96),
          ),
        ),
        if (_recusa != null) ...[
          const SizedBox(height: 8),
          Text(
            _recusa!,
            style: SIMEopsType.note().copyWith(color: SIMEopsColors.alert),
          ),
        ],
        if (_livres.isNotEmpty) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: _livres
                .map(
                  (l) => _Ficha(
                    label: l,
                    cor: SIMEopsColors.tealLight,
                    ativo: true,
                    onTap: () => _removerLivre(l),
                    remover: true,
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 6),
          // Ligado, o catálogo inteiro sai da consulta e sobra só o que foi
          // digitado. Só existe com palavra na lista — sem isso a lista iria
          // vazia e o backend buscaria o padrão inteiro, calado.
          InkWell(
            onTap: () {
              setState(() => _soPalavraChave = !_soPalavraChave);
              widget.onChanged(_selecionados);
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Row(
                children: [
                  Icon(
                    _soPalavraChave
                        ? Icons.check_box
                        : Icons.check_box_outline_blank,
                    size: 19,
                    color: _soPalavraChave
                        ? SIMEopsColors.greenLight
                        : SIMEopsColors.faint,
                  ),
                  const SizedBox(width: 9),
                  Text(
                    'Buscar só palavra-chave',
                    style: SIMEopsType.body().copyWith(
                      fontSize: 14,
                      color: _soPalavraChave
                          ? SIMEopsColors.white
                          : SIMEopsColors.muted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// O `?` em círculo — o mesmo tratamento do ícone do dashboard.
class _BotaoAjuda extends StatelessWidget {
  final VoidCallback onTap;
  const _BotaoAjuda({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Container(
        width: 19,
        height: 19,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: SIMEopsColors.faint, width: 1),
        ),
        child: Text(
          '?',
          style: SIMEopsType.slug(color: SIMEopsColors.faint),
        ),
      ),
    );
  }
}

/// Linha que abre alguma coisa: texto à esquerda, seta à direita, filete
/// embaixo. Mesma anatomia do [SeletorLugar] — é o vocabulário de "isto abre".
class _LinhaDeCampo extends StatelessWidget {
  final String texto;
  final bool apagada;
  final VoidCallback? onTap;

  const _LinhaDeCampo({
    required this.texto,
    required this.onTap,
    this.apagada = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: SIMEopsColors.ruleStrong)),
        ),
        padding: const EdgeInsets.only(top: 13, bottom: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                texto,
                style: SIMEopsType.body().copyWith(
                  fontSize: 17,
                  color: apagada ? SIMEopsColors.faint : SIMEopsColors.white,
                ),
              ),
            ),
            Icon(
              Icons.chevron_right,
              size: 20,
              color: apagada ? SIMEopsColors.hairline : SIMEopsColors.muted,
            ),
          ],
        ),
      ),
    );
  }
}

/// A **busca personalizada**: o catálogo inteiro, por categoria.
///
/// Saiu de dentro do formulário e virou folha porque abria cinco blocos de
/// fichas no meio da tela e empurrava o botão de iniciar para fora da dobra.
///
/// ⚠️ **A palavra-chave não mora mais aqui.** Ela subiu pro formulário em 14/08
/// — estava a dois níveis de profundidade e é o campo que serve pro que é
/// específico da cidade do cliente. A divisão agora é limpa: **catálogo na
/// folha, texto livre na tela**, sem a mesma coisa em dois lugares.
class FolhaAssuntos extends StatefulWidget {
  final Taxonomia taxonomia;
  final Set<String> marcados;

  /// Só pra contar: elas entram no total e no tempo, mas não se editam aqui.
  final List<String> livres;
  final int periodoDias;

  const FolhaAssuntos({
    super.key,
    required this.taxonomia,
    required this.marcados,
    required this.livres,
    required this.periodoDias,
  });

  /// Devolve os marcados, ou null se fechou sem confirmar.
  static Future<(Set<String>,)?> abrir(
    BuildContext context, {
    required Taxonomia taxonomia,
    required Set<String> marcados,
    required List<String> livres,
    required int periodoDias,
  }) {
    return showModalBottomSheet<(Set<String>,)>(
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

  int get _total => _marcados.length + widget.livres.length;

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
                        child: Text('Busca personalizada',
                            style: SIMEopsType.sheetTitle()),
                      ),
                      InkWell(
                        onTap: () => setState(() => _marcados.clear()),
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
                ],
              ),
            ),
            // 🚨 `SafeArea` própria. Sem ela o `USAR ESTES` fica ATRÁS da barra
            // de navegação do sistema — foi o que a captura do João mostrou em
            // 14/08, com o botão cortado ao meio pelos três botões do Android.
            SafeArea(
              top: false,
              child: Container(
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
                            style: SIMEopsType.slug(
                                color: SIMEopsColors.greenLight)),
                        const Spacer(),
                        Text(_total == 0 ? '—' : tempo,
                            style: SIMEopsType.slug(
                                color: SIMEopsColors.greenLight)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _marcados.isEmpty && widget.livres.isEmpty
                            ? null
                            : () => Navigator.pop(context, (_marcados,)),
                        child: const Text('USAR ESTES'),
                      ),
                    ),
                  ],
                ),
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

/// **Os assuntos, só pra ler** — a folha que o `?` abre.
///
/// ⚠️ É outra peça que a [FolhaAssuntos], de propósito: esta **informa**, aquela
/// **edita**. Antes as duas eram a mesma, e o `ESCOLHER ASSUNTO POR ASSUNTO`
/// vivia na pilha dos presets parecendo um atalho quando era uma porta — que foi
/// o que o João apontou como "muito confusa" em 14/08.
///
/// Ela existe porque o padrão passou a ser o catálogo inteiro: "17 assuntos" é
/// uma contagem, não uma resposta, e quem gera um relatório pro cliente precisa
/// poder dizer o que a consulta perguntou sem entrar na tela de edição.
class FolhaOsAssuntos extends StatelessWidget {
  final Taxonomia taxonomia;
  final Set<String> marcados;
  final List<String> livres;

  const FolhaOsAssuntos({
    super.key,
    required this.taxonomia,
    required this.marcados,
    required this.livres,
  });

  static void abrir(
    BuildContext context, {
    required Taxonomia taxonomia,
    required Set<String> marcados,
    required List<String> livres,
  }) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: SIMEopsColors.navy,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(),
      builder: (_) => FolhaOsAssuntos(
        taxonomia: taxonomia,
        marcados: marcados,
        livres: livres,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final total = marcados.length + livres.length;

    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.75,
      child: Column(
        children: [
          Container(
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: SIMEopsColors.white, width: 2),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'O que a consulta pergunta',
                    style: SIMEopsType.sheetTitle(),
                  ),
                ),
                Text(
                  '$total ${total == 1 ? 'ASSUNTO' : 'ASSUNTOS'}',
                  style: SIMEopsType.slug(color: SIMEopsColors.greenLight),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
              children: [
                for (final cat in taxonomia.categorias)
                  ..._bloco(cat, taxonomia.daCategoria(cat.id)),
                if (livres.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text('PALAVRA-CHAVE', style: SIMEopsType.fieldLabel()),
                  const SizedBox(height: 8),
                  for (final l in livres)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        l,
                        style: SIMEopsType.body().copyWith(fontSize: 15),
                      ),
                    ),
                ],
                const SizedBox(height: 24),
                // A tese do produto, dita uma vez, onde a pergunta nasce.
                Text(
                  'Cada assunto é uma pergunta separada ao buscador, e ele '
                  'devolve no máximo ~60 notícias por pergunta. Perguntar mais '
                  'coisas é a única forma de achar mais — e cada assunto '
                  'acrescenta cerca de 35 segundos.',
                  style: SIMEopsType.note(),
                ),
              ],
            ),
          ),
          // 🚨 Mesma `SafeArea` do rodapé da outra folha, pelo mesmo motivo.
          SafeArea(
            top: false,
            child: Container(
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: SIMEopsColors.ruleStrong)),
              ),
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 10),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('FECHAR'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Só os assuntos **que estão na consulta**. Listar os de fora seria
  /// responder outra pergunta.
  List<Widget> _bloco(CategoriaTaxonomia cat, List<Assunto> itens) {
    final dentro = itens.where((a) => marcados.contains(a.termo)).toList();
    if (dentro.isEmpty) return const [];

    return [
      Padding(
        padding: const EdgeInsets.only(top: 18, bottom: 8),
        child: Row(
          children: [
            CatChip(categoria: cat.id),
            const SizedBox(width: 8),
            Text(cat.label.toUpperCase(), style: SIMEopsType.fieldLabel()),
          ],
        ),
      ),
      for (final a in dentro)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(
            a.label,
            style: SIMEopsType.body().copyWith(fontSize: 15),
          ),
        ),
    ];
  }
}
