import 'package:flutter/material.dart';

import '../../core/theme/simeops_colors.dart';
import '../../core/theme/simeops_type.dart';
import '../../core/utils/category_colors.dart';
import '../../core/widgets/cat_chip.dart';

/// O recorte do feed: quais categorias e se só as não lidas.
///
/// Mora **fora** do `FeedScreen` porque o botão que o abre está na linha de
/// cadernos (`Notícias | Relatório`), que pertence à tela da cidade. Assim o
/// recorte também sobrevive à troca de cidade dentro do grupo, que é o
/// comportamento que se espera: quem filtrou por Segurança quer ver Segurança
/// em Palhoça também.
///
/// **Por que deixou de ser uma barra de chips.** A tela tinha quatro faixas de
/// controle empilhadas antes da primeira manchete, e a barra de categorias era
/// a pior delas: cinco fichas com cor, nome e contagem, mais um `NÃO LIDAS`,
/// permanentes na tela — para um filtro que na maior parte do tempo está
/// desligado. Interface de filtro ocupando espaço fixo é o caso clássico de
/// pagar o custo do caso raro em todo uso do caso comum.
///
/// Agora é um link. E a linha que descreve o recorte só aparece quando existe
/// recorte: sem filtro, nada é dito, porque não há nada a dizer.
class FeedFiltro extends ChangeNotifier {
  final Set<String> categorias = {};
  bool apenasNaoLidas = false;

  /// Contagem por categoria do que está carregado. Quem preenche é o
  /// `FeedScreen` — é ele que tem as notícias.
  Map<String, int> contagens = const {};

  bool get ativo => categorias.isNotEmpty || apenasNaoLidas;

  /// O recorte em uma linha: `SEGURANÇA · PATRIMONIAL · NÃO LIDAS`.
  String get descricao {
    final partes = [
      for (final c in categoryOrder)
        if (categorias.contains(c)) categoryLabel(c).toUpperCase(),
      if (apenasNaoLidas) 'NÃO LIDAS',
    ];
    return partes.join(' · ');
  }

  void alternar(String cat) {
    if (!categorias.add(cat)) categorias.remove(cat);
    notifyListeners();
  }

  void alternarNaoLidas() {
    apenasNaoLidas = !apenasNaoLidas;
    notifyListeners();
  }

  void limpar() {
    categorias.clear();
    apenasNaoLidas = false;
    notifyListeners();
  }

  void publicarContagens(Map<String, int> novas) {
    contagens = novas;
    notifyListeners();
  }
}

/// Folha do recorte. Abre pelo `FILTRAR` da linha de cadernos.
class FolhaFiltro extends StatefulWidget {
  final FeedFiltro filtro;

  /// `SÓ NÃO LIDAS` só faz sentido onde existe lido e não lido. No resultado de
  /// uma consulta manual não existe: tudo acabou de ser extraído, nada foi
  /// aberto ainda. A linha ficaria lá oferecendo um filtro que não filtra nada.
  final bool mostrarNaoLidas;

  const FolhaFiltro({
    super.key,
    required this.filtro,
    this.mostrarNaoLidas = true,
  });

  static Future<void> abrir(
    BuildContext context,
    FeedFiltro filtro, {
    bool mostrarNaoLidas = true,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: SIMEopsColors.navy,
      shape: const RoundedRectangleBorder(),
      builder: (_) =>
          FolhaFiltro(filtro: filtro, mostrarNaoLidas: mostrarNaoLidas),
    );
  }

  @override
  State<FolhaFiltro> createState() => _FolhaFiltroState();
}

class _FolhaFiltroState extends State<FolhaFiltro> {
  FeedFiltro get f => widget.filtro;

  @override
  Widget build(BuildContext context) {
    final cats =
        categoryOrder.where((c) => (f.contagens[c] ?? 0) > 0).toList();

    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
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
                  child: Text('Recorte',
                      style: SIMEopsType.sheetTitle()),
                ),
                if (f.ativo)
                  InkWell(
                    onTap: () {
                      f.limpar();
                      setState(() {});
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: Text('LIMPAR',
                          style:
                              SIMEopsType.slug(color: SIMEopsColors.tealLight)),
                    ),
                  ),
              ],
            ),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              children: [
                for (final c in cats)
                  _Linha(
                    marcada: f.categorias.contains(c),
                    onTap: () {
                      f.alternar(c);
                      setState(() {});
                    },
                    esquerda: Row(
                      children: [
                        CatChip(categoria: c),
                        const SizedBox(width: 10),
                        Text(categoryLabel(c).toUpperCase(),
                            style: SIMEopsType.placeTab(
                                active: f.categorias.contains(c))),
                      ],
                    ),
                    direita: '${f.contagens[c]}',
                  ),
                if (widget.mostrarNaoLidas) ...[
                  const SizedBox(height: 10),
                  _Linha(
                    marcada: f.apenasNaoLidas,
                    onTap: () {
                      f.alternarNaoLidas();
                      setState(() {});
                    },
                    esquerda: Text('SÓ NÃO LIDAS',
                        style: SIMEopsType.placeTab(active: f.apenasNaoLidas)),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 10),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('VER'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Linha extends StatelessWidget {
  final Widget esquerda;
  final String? direita;
  final bool marcada;
  final VoidCallback onTap;

  const _Linha({
    required this.esquerda,
    required this.marcada,
    required this.onTap,
    this.direita,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
        ),
        padding: const EdgeInsets.fromLTRB(18, 15, 18, 15),
        child: Row(
          children: [
            Expanded(child: esquerda),
            if (direita != null) ...[
              Text(direita!,
                  style: SIMEopsType.placeTab(
                      active: false, color: SIMEopsColors.faint)),
              const SizedBox(width: 14),
            ],
            // Quadrado, não Checkbox: o Material desenha cápsula e ondinha, e
            // é a única peça arredondada que sobraria na tela.
            Container(
              width: 15,
              height: 15,
              decoration: BoxDecoration(
                border: Border.all(
                  color: marcada
                      ? SIMEopsColors.greenLight
                      : SIMEopsColors.ruleStrong,
                ),
                color: marcada ? SIMEopsColors.greenLight : null,
              ),
              child: marcada
                  ? const Icon(Icons.check, size: 12, color: SIMEopsColors.navy)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
