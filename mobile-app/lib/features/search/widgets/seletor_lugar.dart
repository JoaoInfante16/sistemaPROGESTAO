import 'package:flutter/material.dart';

import '../../../core/data/brazilian_locations.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';

/// Linha de escolha: rótulo à esquerda, valor à direita, filete embaixo.
///
/// Substitui o `MultiCitySearchField`, que foi construído para N cidades e
/// nunca foi usado assim — `maxCities` já era 1. Ele ainda desenhava chip
/// removível, contador "1/1 cidades selecionadas" e mensagem de limite: três
/// peças de interface para um caso que não pode acontecer.
///
/// Também troca o overlay ancorado (`CompositedTransformTarget` + `OverlayEntry`
/// posicionado à mão) por uma folha. No celular a folha é mais confiável — não
/// briga com o teclado nem sai da tela perto do rodapé — e dá espaço pra lista
/// inteira em vez de cinco sugestões espremidas.
class SeletorLugar extends StatelessWidget {
  final String rotulo;
  final String? valor;
  final String vazio;
  final bool habilitado;
  final VoidCallback onTap;

  const SeletorLugar({
    super.key,
    required this.rotulo,
    required this.valor,
    required this.vazio,
    required this.onTap,
    this.habilitado = true,
  });

  @override
  Widget build(BuildContext context) {
    final preenchido = valor != null && valor!.isNotEmpty;
    return InkWell(
      onTap: habilitado ? onTap : null,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: SIMEopsColors.ruleStrong)),
        ),
        padding: const EdgeInsets.only(top: 13, bottom: 11),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(
                preenchido ? valor! : vazio,
                style: SIMEopsType.body().copyWith(
                  fontSize: 17,
                  color: preenchido
                      ? (habilitado ? SIMEopsColors.white : SIMEopsColors.faint)
                      : SIMEopsColors.faint,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 12),
            Text(rotulo, style: SIMEopsType.slug(color: SIMEopsColors.faint)),
          ],
        ),
      ),
    );
  }
}

/// Folha de escolha com busca. Serve estado e cidade — a única diferença é a
/// lista que entra.
class FolhaEscolha extends StatefulWidget {
  final String titulo;
  final List<String> opcoes;
  final String? atual;

  const FolhaEscolha({
    super.key,
    required this.titulo,
    required this.opcoes,
    this.atual,
  });

  /// Abre e devolve o escolhido, ou null se fechou sem escolher.
  static Future<String?> abrir(
    BuildContext context, {
    required String titulo,
    required List<String> opcoes,
    String? atual,
  }) {
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: SIMEopsColors.navy,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(),
      builder: (_) =>
          FolhaEscolha(titulo: titulo, opcoes: opcoes, atual: atual),
    );
  }

  @override
  State<FolhaEscolha> createState() => _FolhaEscolhaState();
}

class _FolhaEscolhaState extends State<FolhaEscolha> {
  final _busca = TextEditingController();
  late List<String> _filtradas = widget.opcoes;

  @override
  void dispose() {
    _busca.dispose();
    super.dispose();
  }

  /// Sem acento e em minúsculas: quem digita "sao jose" tem que achar
  /// "São José". Buscar cidade brasileira exigindo acento é hostil.
  static String _norm(String s) {
    const de = 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ';
    const para = 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC';
    var r = s.toLowerCase();
    for (var i = 0; i < de.length; i++) {
      r = r.replaceAll(de[i], para[i].toLowerCase());
    }
    return r;
  }

  void _filtrar(String q) {
    final n = _norm(q.trim());
    setState(() {
      _filtradas = n.isEmpty
          ? widget.opcoes
          : widget.opcoes.where((o) => _norm(o).contains(n)).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final alturaTeclado = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: alturaTeclado),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.78,
        child: Column(
          children: [
            Container(
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: SIMEopsColors.white, width: 2)),
              ),
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(widget.titulo, style: SIMEopsType.title()),
                      ),
                      InkWell(
                        onTap: () => Navigator.pop(context),
                        child: const Padding(
                          padding: EdgeInsets.all(6),
                          child: Icon(Icons.close,
                              size: 20, color: SIMEopsColors.muted),
                        ),
                      ),
                    ],
                  ),
                  TextField(
                    autofocus: true,
                    onChanged: _filtrar,
                    controller: _busca,
                    style: SIMEopsType.body().copyWith(fontSize: 17),
                    decoration: InputDecoration(
                      hintText: 'digite para filtrar',
                      hintStyle: SIMEopsType.body()
                          .copyWith(fontSize: 17, color: SIMEopsColors.faint),
                      filled: false,
                      contentPadding: const EdgeInsets.only(top: 10, bottom: 8),
                      enabledBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: SIMEopsColors.rule),
                      ),
                      focusedBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: SIMEopsColors.tealLight),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _filtradas.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(18, 30, 18, 0),
                      child: Text('Nada com esse nome.',
                          style: SIMEopsType.lead()),
                    )
                  : ListView.builder(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      itemCount: _filtradas.length,
                      itemBuilder: (_, i) {
                        final o = _filtradas[i];
                        final atual = o == widget.atual;
                        return InkWell(
                          onTap: () => Navigator.pop(context, o),
                          child: Container(
                            decoration: const BoxDecoration(
                              border: Border(
                                bottom: BorderSide(color: SIMEopsColors.rule),
                              ),
                            ),
                            padding:
                                const EdgeInsets.fromLTRB(18, 15, 18, 15),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    o,
                                    style: SIMEopsType.body().copyWith(
                                      color: atual
                                          ? SIMEopsColors.greenLight
                                          : SIMEopsColors.white,
                                    ),
                                  ),
                                ),
                                if (atual)
                                  Text('ATUAL',
                                      style: SIMEopsType.slug(
                                          color: SIMEopsColors.greenLight)),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Atalhos que já sabem de onde vem a lista.
class Lugares {
  const Lugares._();

  static Future<String?> escolherEstado(BuildContext context, String? atual) =>
      FolhaEscolha.abrir(
        context,
        titulo: 'Estado',
        opcoes: BrazilianLocations.instance.getEstados()..sort(),
        atual: atual,
      );

  static Future<String?> escolherCidade(
    BuildContext context,
    String estado,
    String? atual,
  ) =>
      FolhaEscolha.abrir(
        context,
        titulo: 'Cidade',
        opcoes: BrazilianLocations.instance.getCidades(estado)..sort(),
        atual: atual,
      );
}
