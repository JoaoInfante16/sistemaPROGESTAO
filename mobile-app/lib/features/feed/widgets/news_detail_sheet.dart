import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/models/news_item.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/crime_labels.dart';
import '../../../core/widgets/cat_chip.dart';

/// A matéria aberta.
///
/// Existiu, foi marcada pra morrer (a ideia era o toque ir direto pra fonte), e
/// voltou por decisão do João — com a condição de **trazer informação que o
/// card não tem**. A folha antiga repetia manchete e resumo e acrescentava
/// pouco; era um degrau a mais entre a lista e o artigo.
///
/// O que só existe aqui:
///
/// - **rua**, quando o Filter2 extraiu (o card mostra até o bairro);
/// - o **tipo de crime granular** (`Roubo`) contra a categoria do card
///   (`Patrimonial`) — é o campo que o relatório usa pra contar;
/// - a **data por extenso**, com dia da semana;
/// - **todas as fontes**, cada uma abrindo sozinha, com a oficial marcada.
///
/// A fonte abre no navegador **externo**: nem WebView nem Custom Tab. Conteúdo
/// de terceiros não deve ser emoldurado como se fosse do app.
class NewsDetailSheet extends StatelessWidget {
  final NewsItem news;

  const NewsDetailSheet({super.key, required this.news});

  static Future<void> show(BuildContext context, NewsItem news) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: SIMEopsColors.navy,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(),
      builder: (_) => NewsDetailSheet(news: news),
    );
  }

  static const _diasDaSemana = [
    'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira',
    'sexta-feira', 'sábado', 'domingo',
  ];
  static const _meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];

  /// "sábado, 9 de agosto de 2026 · 14:32".
  ///
  /// À mão em vez de `DateFormat(..., 'pt_BR')` porque o locale do intl exige
  /// carregar dados de localização na partida do app — dependência de inicialização
  /// para formatar uma data por tela.
  String get _quando {
    final d = news.dataOcorrencia;
    final base = '${_diasDaSemana[d.weekday - 1]}, ${d.day} de '
        '${_meses[d.month - 1]} de ${d.year}';
    final h = news.horaPublicacao;
    return h != null ? '$base · $h' : base;
  }

  String get _onde {
    final partes = <String>[
      news.cidade,
      if (news.bairro != null && news.bairro!.isNotEmpty) news.bairro!,
    ];
    final uf = news.estadoUf;
    final cabeca = uf != null && uf.isNotEmpty
        ? '${partes.first}/$uf'
        : partes.first;
    return [cabeca, ...partes.skip(1)].join(' · ');
  }

  Future<void> _abrir(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('[NewsDetailSheet] falha ao abrir $url — $e');
    }
  }

  static String _host(NewsSource s) {
    final nome = s.sourceName;
    if (nome != null && nome.isNotEmpty) return nome;
    try {
      return Uri.parse(s.url).host.replaceFirst('www.', '');
    } catch (_) {
      return s.url;
    }
  }

  @override
  Widget build(BuildContext context) {
    final indicador = news.natureza == 'estatistica';
    final cat = indicador
        ? 'institucional'
        : (news.categoriaGrupo ?? 'institucional');

    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.88,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: SIMEopsColors.white, width: 2),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
            child: Row(
              children: [
                CatChip(categoria: cat),
                const SizedBox(width: 9),
                Text(
                  indicador ? 'INDICADOR' : categoryLabel(cat).toUpperCase(),
                  style: SIMEopsType.slug(),
                ),
                const Spacer(),
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
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 28),
              children: [
                Text(news.headline,
                    style: SIMEopsType.title().copyWith(fontSize: 27)),
                if (news.corpoDeLeitura.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  _Corpo(texto: news.corpoDeLeitura),
                ],
                const SizedBox(height: 26),

                // A ficha. É o que justifica a folha existir: o card mostra
                // categoria e bairro; aqui saem a rua e o tipo granular, que é
                // o campo com que o relatório conta.
                _Campo(rotulo: 'ONDE', valor: _onde),
                if (news.rua != null && news.rua!.isNotEmpty)
                  _Campo(rotulo: 'RUA', valor: news.rua!),
                _Campo(rotulo: 'QUANDO', valor: _quando),
                if (!indicador)
                  _Campo(rotulo: 'TIPO', valor: crimeTypeLabel(news.tipoCrime)),
                if (news.cidadeVizinha)
                  _Campo(
                    rotulo: 'RECORTE',
                    valor: 'Município vizinho, não a cidade consultada',
                  ),

                const SizedBox(height: 26),
                Row(
                  children: [
                    Text(
                      news.sources.length == 1
                          ? 'A FONTE'
                          : 'AS ${news.sources.length} FONTES',
                      style: SIMEopsType.dateline(),
                    ),
                    const SizedBox(width: 11),
                    const Expanded(
                      child: Divider(color: SIMEopsColors.rule, height: 1),
                    ),
                  ],
                ),
                for (final s in news.sources)
                  InkWell(
                    onTap: () => _abrir(s.url),
                    child: Container(
                      decoration: const BoxDecoration(
                        border: Border(
                          bottom: BorderSide(color: SIMEopsColors.rule),
                        ),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              _host(s),
                              style: SIMEopsType.credit(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 9),
                          // Verde de destaque: nesta folha o `LER →` é a única
                          // coisa que **sai do app**, e ele estava na mesma
                          // tinta teal do nome do veículo ao lado, que é só
                          // rótulo. Cor separa o que se toca do que se lê.
                          Text('LER →',
                              style: SIMEopsType.credit(
                                  color: SIMEopsColors.greenLight)),
                        ],
                      ),
                    ),
                  ),
                if (news.hasOfficialSource) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Uma das fontes é órgão oficial (prefeitura, polícia ou '
                    'governo), não imprensa.',
                    style: SIMEopsType.note(),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// O texto da matéria, em parágrafos.
///
/// 🚨 Existe porque até 25/08 esta folha mostrava o **mesmo** `resumo` do card,
/// caractere por caractere: tocar num item não entregava nenhuma palavra a mais.
/// O teto de 190 do resumo é do CARD (ele imprime inteiro, sem "ler mais") e não
/// pode subir sem quebrar o ritmo da lista — então o texto de leitura virou um
/// campo próprio, `news.corpo`, escrito pelo Filter2 no mesmo request.
///
/// Linha anterior à migration 034 não tem corpo e cai no resumo: a folha volta a
/// ser exatamente o que era, sem quebrar.
///
/// O primeiro parágrafo entra como **lide** — maior e em tinta cheia — e os
/// demais em corpo de leitura. Dá ao olho um ponto de entrada em vez de um
/// bloco uniforme.
class _Corpo extends StatelessWidget {
  final String texto;

  const _Corpo({required this.texto});

  @override
  Widget build(BuildContext context) {
    // O Filter2 separa parágrafo com linha em branco (regra 19). Partir por
    // linha e descartar as vazias cobre isso sem regex, e é tolerante a texto
    // antigo que venha em bloco único — nesse caso dá um parágrafo só.
    final paragrafos = <String>[];
    for (final linha in texto.split('\n')) {
      final t = linha.trim();
      if (t.isNotEmpty) paragrafos.add(t);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < paragrafos.length; i++) ...[
          if (i > 0) const SizedBox(height: 15),
          Text(
            paragrafos[i],
            style: i == 0
                ? SIMEopsType.lead(color: SIMEopsColors.white)
                    .copyWith(fontSize: 16.5, height: 1.58)
                : SIMEopsType.lead().copyWith(fontSize: 15.5, height: 1.62),
          ),
        ],
      ],
    );
  }
}

/// Linha da ficha: rótulo em mono na esquerda, valor em corpo na direita.
class _Campo extends StatelessWidget {
  final String rotulo;
  final String valor;

  const _Campo({required this.rotulo, required this.valor});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
      ),
      padding: const EdgeInsets.symmetric(vertical: 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 78,
            child: Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(rotulo,
                  style: SIMEopsType.slug(color: SIMEopsColors.faint)),
            ),
          ),
          Expanded(
            child: Text(valor, style: SIMEopsType.rowTitle()),
          ),
        ],
      ),
    );
  }
}
