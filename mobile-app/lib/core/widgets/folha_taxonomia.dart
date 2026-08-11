import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/assunto.dart';
import '../services/api_service.dart';
import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';
import 'cat_chip.dart';

/// O que cada categoria reúne.
///
/// Abre pelo `?` do cabeçalho do monitoramento — a casa, na altura da marca:
/// a pergunta é sobre o sistema inteiro, não sobre a cidade aberta. E é a
/// pergunta que o app faz o tempo todo sem responder: **o que é "Patrimonial"?
/// o que é "Segurança"?**
/// A palavra aparece na slug de toda matéria e num quadradinho colorido, e até
/// aqui o app nunca disse o que ela quer dizer — quem lê tinha que deduzir a
/// regra pelos exemplos. Categoria é a espinha do produto: é por ela que o
/// dashboard soma, que o relatório fatia e que a notificação vai ou não vai.
///
/// Vem do backend (`GET /settings/taxonomia`), o mesmo lugar de onde saem as
/// cores — **nunca de uma lista escrita aqui**. Uma segunda cópia da taxonomia
/// em Dart é exatamente o erro que já pintou Fraude de dois violetas diferentes
/// no mesmo APK, e aqui seria pior: uma tela que promete explicar o sistema
/// mentindo sobre ele.
class FolhaTaxonomia extends StatefulWidget {
  const FolhaTaxonomia({super.key});

  static Future<void> abrir(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    backgroundColor: SIMEopsColors.navy,
    shape: const RoundedRectangleBorder(),
    isScrollControlled: true,
    builder: (_) => const FolhaTaxonomia(),
  );

  @override
  State<FolhaTaxonomia> createState() => _FolhaTaxonomiaState();
}

class _FolhaTaxonomiaState extends State<FolhaTaxonomia> {
  Taxonomia? _tax;
  bool _falhou = false;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    try {
      final tax = await context.read<ApiService>().getTaxonomia();
      if (mounted) setState(() => _tax = tax);
    } catch (e) {
      debugPrint('[FolhaTaxonomia] $e');
      if (mounted) setState(() => _falhou = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tax = _tax;

    return SafeArea(
      child: ConstrainedBox(
        // Folha alta: são cinco blocos de texto corrido e a pessoa abriu isto
        // para ler. Mas não a tela inteira — o pedaço de feed que aparece
        // atrás é o que lembra de onde ela veio.
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.82,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: SIMEopsColors.white, width: 2),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('O que cada categoria reúne',
                      style: SIMEopsType.sheetTitle()),
                  if (tax != null) ...[
                    const SizedBox(height: 9),
                    Text(
                      '${tax.assuntos.length} ASSUNTOS · '
                      '${tax.categorias.length} CATEGORIAS',
                      style: SIMEopsType.slug(color: SIMEopsColors.faint),
                    ),
                  ],
                ],
              ),
            ),
            Flexible(
              child: tax != null
                  ? _lista(tax)
                  : Padding(
                      padding: const EdgeInsets.fromLTRB(18, 26, 18, 30),
                      child: _falhou
                          ? Text(
                              'A lista de assuntos mora no servidor e não veio '
                              'agora. Verifique a conexão e abra de novo.',
                              style: SIMEopsType.note(),
                            )
                          : const Center(child: CircularProgressIndicator()),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _lista(Taxonomia tax) => ListView(
    padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
    shrinkWrap: true,
    children: [
      for (final c in tax.categorias)
        if (tax.daCategoria(c.id).isNotEmpty) ...[
          const SizedBox(height: 20),
          Row(
            children: [
              CatChip(cor: c.cor),
              const SizedBox(width: 9),
              // O nome em tinta branca e a cor no quadrado: é a regra que
              // atravessa o app. Cinco categorias escritas em cinco matizes a
              // 11px sobre navy viram cinco borrões — o escuro come a
              // diferença de saturação, e daltonismo come o resto.
              Text(
                c.label.toUpperCase(),
                style: SIMEopsType.placeTab(active: true),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            tax.daCategoria(c.id).map((a) => a.label).join(' · '),
            style: SIMEopsType.lead(),
          ),
        ],
      const SizedBox(height: 24),
      // Duas frases com dois trabalhos: **o que o sistema faz** e **como se
      // muda isso**. A segunda existe porque a lista é fechada para quem usa —
      // e uma lista fechada sem porta de saída lê como limitação do produto,
      // não como configuração. Dizer de quem é a chave devolve o controle.
      Text(
        'São feitas varreduras na imprensa e em canais oficiais em busca de '
        'notícias sobre esses assuntos. Para incluir ou tirar um assunto da '
        'lista, fale com o administrador.',
        style: SIMEopsType.note(),
      ),
    ],
  );
}
