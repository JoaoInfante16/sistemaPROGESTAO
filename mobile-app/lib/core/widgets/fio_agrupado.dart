import 'package:flutter/material.dart';
import '../models/news_item.dart';
import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';
import '../utils/date_grouping.dart';
import 'group_header.dart';

/// A divisória de dia **dentro** de uma semana aberta: `SEG 21 ─────────`.
///
/// É o que substitui a pasta de dia. Ela dá o corte que uma semana de 17 itens
/// precisa sem cobrar o toque que uma semana de 2 não deveria pagar — e sem
/// criar as pastas de um item só que a medição encontrou em 51% dos dias.
///
/// Mais fraca que o `GroupHeader` de propósito: `faint` contra `muted`, sem
/// contador e sem seta. Ela **não é clicável**, e nada nela pode sugerir que
/// seja.
class DivisoriaDoDia extends StatelessWidget {
  final DateTime dia;

  const DivisoriaDoDia(this.dia, {super.key});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(30, 18, 18, 8),
    child: Row(
      children: [
        Text(
          rotuloDoDia(dia),
          style: SIMEopsType.slug(color: SIMEopsColors.faint),
        ),
        const SizedBox(width: 10),
        const Expanded(
          child: Divider(color: SIMEopsColors.rule, height: 1, thickness: 1),
        ),
      ],
    ),
  );
}

/// Monta as linhas da lista agrupada — **uma peça só para as duas telas**.
///
/// O feed e o resultado da consulta desenhavam o mesmo laço em duplicata, cada
/// um com a sua cópia da regra de expandir. Com a árvore de mês/semana isso
/// viraria a mesma lógica escrita duas vezes em dois arquivos, que é como as
/// duas telas passam a divergir sem ninguém decidir.
///
/// O que cada tela ainda decide: como desenhar o card ([card]) e onde guarda o
/// estado de aberto ([aberto] / [alternar]).
List<Widget> linhasDoFioAgrupado({
  required List<NewsGroup> grupos,
  required bool Function(NewsGroup) aberto,
  required void Function(String key) alternar,
  required Widget Function(NewsItem) card,
  required Widget separador,
}) {
  final rows = <Widget>[];

  void desenharItens(List<NewsItem> items, {required bool comDivisoria}) {
    DateTime? diaAtual;
    for (var i = 0; i < items.length; i++) {
      final item = items[i];
      if (comDivisoria) {
        final d = DateTime(
          item.dataOcorrencia.year,
          item.dataOcorrencia.month,
          item.dataOcorrencia.day,
        );
        if (diaAtual == null || d != diaAtual) {
          diaAtual = d;
          rows.add(DivisoriaDoDia(d));
        } else if (i > 0) {
          rows.add(separador);
        }
      } else if (i > 0) {
        rows.add(separador);
      }
      rows.add(card(item));
    }
  }

  for (final g in grupos) {
    final abertoG = aberto(g);
    rows.add(
      GroupHeader(
        label: g.label,
        count: g.total,
        expanded: abertoG,
        onTap: () => alternar(g.key),
      ),
    );
    if (!abertoG) continue;

    if (g.semanas.isEmpty) {
      // Dia solto (últimos 7 dias) ou semana no nível de cima: a semana leva as
      // divisórias, o dia não — dentro de "ONTEM" toda matéria é de ontem.
      desenharItens(g.items, comDivisoria: g.ehSemana);
      continue;
    }

    for (final s in g.semanas) {
      final abertaS = aberto(s);
      rows.add(
        GroupHeader(
          label: s.label,
          count: s.total,
          expanded: abertaS,
          onTap: () => alternar(s.key),
          recuo: 12,
        ),
      );
      if (abertaS) desenharItens(s.items, comDivisoria: true);
    }
  }

  return rows;
}
