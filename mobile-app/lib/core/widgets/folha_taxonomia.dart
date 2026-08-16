import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/assunto.dart';
import '../services/api_service.dart';
import '../theme/simeops_colors.dart';
import 'esqueleto.dart';
import '../theme/simeops_type.dart';
import 'cat_chip.dart';

/// **A tese do produto, escrita uma vez só.**
///
/// Vive nas duas folhas de `?` do app — esta ([FolhaTaxonomia], no cabeçalho do
/// monitoramento) e a `FolhaOsAssuntos` do formulário de consulta —, e é uma
/// constante e não duas cópias porque texto duplicado apodrece torto: em 14/08
/// as duas explicações já divergiam, uma falando em *"varreduras"* e a outra em
/// *"o buscador"*, uma peça que não existe em lugar nenhum do produto.
///
/// Cada folha acrescenta **uma** frase própria depois desta, porque as duas
/// respondem perguntas diferentes: no monitoramento a pergunta é *"o que esse
/// negócio fica fazendo o dia todo"*, na consulta é *"o que esta consulta vai
/// perguntar, e o que isso me custa"*. Foi por isso que o texto não virou um só
/// — o custo em minutos numa tela onde ninguém espera, ou o *"fale com o
/// administrador"* numa tela onde a pessoa mexe na lista sozinha, viram ruído
/// no lugar exato onde o app está tentando ganhar confiança.
///
/// ⚠️ **Sem número que apodrece.** A versão antiga prometia *"cerca de 35
/// segundos"* por assunto — número que sai de `_segundosPorAssunto`, já
/// recalibrado duas vezes (47 → 36). A precisão fica na barra da consulta, que
/// lê a constante; aqui fica a ordem de grandeza.
const comoOSistemaPergunta =
    'Cada assunto é uma pergunta separada à imprensa e aos canais oficiais, e '
    'cada pergunta traz no máximo ~60 notícias. Por isso a lista é grande: '
    'perguntar mais assuntos é a única forma de achar mais.';

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
                  Text(
                    'O que cada categoria reúne',
                    style: SIMEopsType.sheetTitle(),
                  ),
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
                          : const Padding(
                              padding: EdgeInsets.only(top: 8),
                              child: EsqueletoDeBloco(linhas: 6, altura: 14),
                            ),
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
      Text(comoOSistemaPergunta, style: SIMEopsType.note()),
      const SizedBox(height: 14),
      // O fecho desta casa. Existe porque aqui a lista é **fechada** para quem
      // usa — e uma lista fechada sem porta de saída lê como limitação do
      // produto, não como configuração. Dizer de quem é a chave devolve o
      // controle. Na consulta é o contrário: a lista é da pessoa, e por isso
      // lá o fecho fala de preço, não de permissão.
      Text(
        'A lista roda sozinha, todo dia. Para incluir ou tirar um assunto, '
        'fale com o administrador.',
        style: SIMEopsType.note(),
      ),
    ],
  );
}
