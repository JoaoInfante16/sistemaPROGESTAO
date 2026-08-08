import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';

import '../../../core/models/news_item.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/category_colors.dart';

/// A matéria no fio — substitui o `NewsCard` de caixa.
///
/// O redesign trocou **caixa por filete**: nada aqui tem borda, fundo ou canto
/// arredondado. A separação é um filete de 1px e o espaço em volta. Card com
/// borda empilhado 18 vezes vira lista de caixas; matéria separada por filete
/// vira jornal, que é o que o produto é.
///
/// Anatomia (de cima pra baixo):
///   slug       quadrado de cor + CATEGORIA · local · hora   (mono, 9.5)
///   manchete   Archivo 23 (30 quando urgente)
///   lide       resumo, Archivo 14.5 em tinta muted
///   créditos   veículo (teal) ............ N FONTES (verde, só quando > 1)
class TakeCard extends StatelessWidget {
  final NewsItem news;
  final VoidCallback? onTap;
  final VoidCallback? onToggleFavorite;

  /// Ocorrência grave e recente. O sinal é **peso**, não cor: filete branco na
  /// margem e manchete 30% maior. Vermelho não pode fazer dois papéis — ele já
  /// é a categoria Segurança, e "URGENTE" vermelho ao lado de "SEGURANÇA"
  /// vermelho lê como um rótulo só.
  ///
  /// Raro por construção (ver [isUrgent]): sinal que aparece sempre não é
  /// sinal, é ruído — foi o que aconteceu com o "NOVA" no card antigo.
  final bool urgent;

  const TakeCard({
    super.key,
    required this.news,
    this.onTap,
    this.onToggleFavorite,
    this.urgent = false,
  });

  /// Regra da urgência: categoria Segurança **e** publicada nas últimas 6h.
  /// Num dia de 18 itens isso dá 1 ou 2 — que é o ponto.
  static bool isUrgent(NewsItem n) {
    if (n.categoriaGrupo != 'seguranca') return false;
    return DateTime.now().difference(n.createdAt).inHours < 6;
  }

  /// "07:40" para hoje/ontem, "31/07" para o resto. O usuário que abre o feed
  /// de manhã quer a hora; quem olha um resultado de 30 dias quer a data.
  String get _stamp {
    final d = news.dataOcorrencia;
    final now = DateTime.now();
    final sameDay = d.year == now.year && d.month == now.month && d.day == now.day;
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday =
        d.year == yesterday.year && d.month == yesterday.month && d.day == yesterday.day;

    if (sameDay || isYesterday) {
      return '${d.hour.toString().padLeft(2, '0')}:'
          '${d.minute.toString().padLeft(2, '0')}';
    }
    return '${d.day.toString().padLeft(2, '0')}/'
        '${d.month.toString().padLeft(2, '0')}';
  }

  /// Cidade · bairro. É o campo elástico da slug: **trunca, não quebra**.
  String get _place {
    final parts = <String>[news.cidade];
    if (news.bairro != null && news.bairro!.isNotEmpty) parts.add(news.bairro!);
    return parts.join(' · ');
  }

  String? get _outlet {
    if (news.sources.isEmpty) return null;
    final first = news.sources.first;
    final name = first.sourceName;
    if (name != null && name.isNotEmpty) return name;
    try {
      return Uri.parse(first.url).host.replaceFirst('www.', '');
    } catch (_) {
      return null;
    }
  }

  bool get _isIndicador => news.natureza == 'estatistica';

  @override
  Widget build(BuildContext context) {
    final cat = _isIndicador ? 'institucional' : (news.categoriaGrupo ?? 'institucional');
    final catColor = categoryColor(cat);
    final catLabel = _isIndicador ? 'INDICADOR' : categoryLabel(cat).toUpperCase();

    // Lida recua sem ícone e sem caixa: manchete perde peso e vai pra tinta
    // fraca. Não precisa de "já li" escrito — o contraste já diz.
    final read = !news.isUnread;
    final headlineStyle = urgent
        ? SIMEopsType.headlineUrgent()
        : SIMEopsType.headline(color: read ? SIMEopsColors.faint : null);

    return Slidable(
      startActionPane: ActionPane(
        motion: const ScrollMotion(),
        extentRatio: 0.25,
        children: [
          SlidableAction(
            onPressed: (_) => onToggleFavorite?.call(),
            backgroundColor:
                news.isFavorite ? SIMEopsColors.navyLight : SIMEopsColors.bookmark,
            foregroundColor: news.isFavorite ? SIMEopsColors.muted : Colors.white,
            icon: news.isFavorite ? Icons.bookmark_remove : Icons.bookmark_add,
            label: news.isFavorite ? 'Remover' : 'Salvar',
          ),
        ],
      ),
      child: InkWell(
        onTap: onTap,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Filete de urgência, na margem viva da página.
              SizedBox(
                width: 2,
                child: urgent
                    ? const ColoredBox(color: SIMEopsColors.white)
                    : const SizedBox.shrink(),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 17, 18, 19),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _Slug(
                        color: catColor,
                        label: catLabel,
                        place: _place,
                        stamp: _stamp,
                      ),
                      const SizedBox(height: 9),
                      Text(
                        news.headline,
                        style: headlineStyle,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (news.resumo.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          news.resumo,
                          style: SIMEopsType.lead(
                            color: read ? SIMEopsColors.faint : null,
                          ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: 11),
                      _Credits(
                        outlet: _outlet,
                        sourceCount: news.sources.length,
                        official: news.hasOfficialSource,
                        neighbour: news.cidadeVizinha,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Slug extends StatelessWidget {
  final Color color;
  final String label;
  final String place;
  final String stamp;

  const _Slug({
    required this.color,
    required this.label,
    required this.place,
    required this.stamp,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // O quadrado carrega a cor; a palavra fica em tinta legível.
        // Cinco categorias escritas em cinco matizes a 9.5px sobre navy viram
        // cinco borrões — fundo escuro come diferença de saturação.
        Container(width: 7, height: 7, color: color),
        const SizedBox(width: 9),
        Text(label, style: SIMEopsType.slug()),
        const SizedBox(width: 9),
        // Elástico: trunca. Se quebrasse, a hora pularia de linha e o ritmo
        // vertical da lista morreria — e é o ritmo que faz a varredura rápida.
        Expanded(
          child: Text(
            place,
            style: SIMEopsType.slug(color: SIMEopsColors.faint),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 9),
        Text(stamp, style: SIMEopsType.slug(color: SIMEopsColors.faint)),
      ],
    );
  }
}

class _Credits extends StatelessWidget {
  final String? outlet;
  final int sourceCount;
  final bool official;
  final bool neighbour;

  const _Credits({
    required this.outlet,
    required this.sourceCount,
    required this.official,
    required this.neighbour,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        if (outlet != null)
          Flexible(
            child: Text(
              outlet!,
              style: SIMEopsType.credit(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        if (official) ...[
          const SizedBox(width: 9),
          Text('OFICIAL', style: SIMEopsType.credit(color: SIMEopsColors.green)),
        ],
        if (neighbour) ...[
          const SizedBox(width: 9),
          Text('REGIÃO', style: SIMEopsType.credit(color: SIMEopsColors.muted)),
        ],
        const Spacer(),
        // Só aparece quando > 1. "1 FONTE" é o caso chato e estava em 100% dos
        // itens: rótulo que aparece sempre não informa. "3 FONTES" é sinal de
        // credibilidade — três veículos cobriram o mesmo fato — e era invisível.
        if (sourceCount > 1)
          Text(
            '$sourceCount FONTES',
            style: SIMEopsType.credit(color: SIMEopsColors.greenLight),
          ),
      ],
    );
  }
}

/// Divisor de data entre blocos de matéria: "HOJE · 04 AGO ────────".
class Dateline extends StatelessWidget {
  final String label;

  const Dateline(this.label, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
      child: Row(
        children: [
          Text(label.toUpperCase(), style: SIMEopsType.dateline()),
          const SizedBox(width: 11),
          const Expanded(child: Divider(color: SIMEopsColors.rule, height: 1)),
        ],
      ),
    );
  }
}

/// Filete entre matérias.
class TakeRule extends StatelessWidget {
  const TakeRule({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.symmetric(horizontal: 18),
        child: Divider(color: SIMEopsColors.rule, height: 1, thickness: 1),
      );
}

/// "— 30 —": marca de fim de matéria de redação. Diz "acabou, não travou" —
/// o fim de lista silencioso deixa o usuário rolando à toa achando que
/// tem mais carregando.
class EndMark extends StatelessWidget {
  const EndMark({super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 34, bottom: 20),
        child: Center(
          child: Text(
            '— 30 —',
            style: SIMEopsType.dateline(color: SIMEopsColors.hairline)
                .copyWith(letterSpacing: 3.4),
          ),
        ),
      );
}
