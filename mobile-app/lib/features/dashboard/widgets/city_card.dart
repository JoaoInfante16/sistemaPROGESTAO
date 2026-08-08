import 'package:flutter/material.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/crime_labels.dart';

/// Cidade no dashboard, em bloco de fio.
///
/// Era um `Card` com borda, ícone, badge vermelho e três readouts em cápsula.
/// Virou bloco aberto: nome em corpo grande, uma frase de resumo escrita como
/// analista falaria, e o filete que separa do próximo.
///
/// **Cidade sem novidade não ganha bloco** — vira [QuietCityRow], uma linha de
/// ~44px. É o que faz a grade sobreviver a 20 cidades sem virar planilha: dia
/// quieto colapsa sozinho, dia agitado expande sozinho. A regra é semântica
/// (tem não lida?), não um "top N" arbitrário.
class CityCard extends StatelessWidget {
  final CityOverview city;
  final VoidCallback onTap;

  const CityCard({super.key, required this.city, required this.onTap});

  /// A frase de resumo. Nasce dos campos que o backend já manda — e é o único
  /// lugar do app em que ele fala como gente em vez de painel.
  String get _summary {
    final total = city.totalCrimes30d;
    if (total == 0) {
      return 'Sem ocorrência publicada nos últimos trinta dias.';
    }

    final buf = StringBuffer('$total ${total == 1 ? 'ocorrência' : 'ocorrências'} '
        'em trinta dias.');

    final top = city.topCrimeType;
    final pct = city.topCrimePercent;
    if (top != null && top.isNotEmpty && pct > 0) {
      buf.write(' ${crimeTypeLabel(top)} responde por '
          '${pct.toStringAsFixed(0)}%, a maior fatia.');
    }

    // Grupo: dizer QUAIS cidades. "Grande Florianópolis" não informa nada a
    // quem não é de lá, e o app é vendido para fora da cidade monitorada.
    final names = city.cityNames;
    if (city.isGroup && names != null && names.isNotEmpty) {
      final preview = names.take(3).join(', ');
      final extra = names.length - 3;
      buf.write(' $preview${extra > 0 ? ' e mais $extra' : ''}.');
    }

    return buf.toString();
  }

  @override
  Widget build(BuildContext context) {
    final uf = city.parentState;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 21, 18, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    [
                      if (uf != null && uf.isNotEmpty) uf.toUpperCase(),
                      if (city.isGroup) '${city.cityCount ?? 0} CIDADES',
                    ].join(' · '),
                    style: SIMEopsType.slug(color: SIMEopsColors.faint),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (city.hasUnread)
                  Text(
                    '${city.unreadCount} ${city.unreadCount == 1 ? 'NOVA' : 'NOVAS'}',
                    style: SIMEopsType.slug(color: SIMEopsColors.greenLight),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              city.name,
              style: SIMEopsType.cityHeadline(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            Text(_summary, style: SIMEopsType.lead()),
            _CategoryFigures(counts: city.categorias30d),
            const SizedBox(height: 15),
          ],
        ),
      ),
    );
  }
}

/// A quebra por categoria: `25 SEGUR. / 44 PATRIM. / ...`
///
/// O número fica em **tinta branca** e a cor mora no quadradinho ao lado —
/// número colorido a 21px sobre navy perde contraste e faz cinco matizes
/// brigarem entre si.
///
/// Mostra as **quatro maiores** e soma o resto em OUTRAS. Cinco colunas em
/// 412px dariam ~70px cada, e `INSTITUCIONAL` não cabe em 70px nem abreviado.
class _CategoryFigures extends StatelessWidget {
  final Map<String, int> counts;

  const _CategoryFigures({required this.counts});

  /// Abreviações que cabem na coluna. Categoria fora da lista usa o rótulo
  /// normal cortado — nunca some sem aparecer em OUTRAS.
  static const _curto = <String, String>{
    'seguranca': 'SEGUR.',
    'patrimonial': 'PATRIM.',
    'operacional': 'OPERAC.',
    'fraude': 'FRAUDE',
    'institucional': 'INSTIT.',
  };

  @override
  Widget build(BuildContext context) {
    if (counts.isEmpty) return const SizedBox.shrink();

    final ordenado = counts.entries.where((e) => e.value > 0).toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    if (ordenado.isEmpty) return const SizedBox.shrink();

    final colunas = <_Figure>[];
    for (final e in ordenado.take(4)) {
      colunas.add(_Figure(
        valor: e.value,
        rotulo: _curto[e.key] ?? categoryLabel(e.key).toUpperCase(),
        cor: categoryColor(e.key),
      ));
    }
    if (ordenado.length > 4) {
      final resto = ordenado.skip(4).fold<int>(0, (soma, e) => soma + e.value);
      if (resto > 0) {
        colunas.add(_Figure(
          valor: resto,
          rotulo: 'OUTRAS',
          cor: categoryColor('institucional'),
        ));
      }
    }

    return Container(
      margin: const EdgeInsets.only(top: 15),
      padding: const EdgeInsets.only(top: 12),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: SIMEopsColors.rule)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < colunas.length; i++) ...[
            if (i > 0) const SizedBox(width: 13),
            Expanded(child: colunas[i]),
          ],
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  final int valor;
  final String rotulo;
  final Color cor;

  const _Figure({required this.valor, required this.rotulo, required this.cor});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('$valor', style: SIMEopsType.figure()),
        const SizedBox(height: 7),
        Row(
          children: [
            Container(width: 6, height: 6, color: cor),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                rotulo,
                style: SIMEopsType.slug(color: SIMEopsColors.faint)
                    .copyWith(fontSize: 8.5, letterSpacing: 0.77),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Cidade sem nada novo: uma linha, não um bloco.
class QuietCityRow extends StatelessWidget {
  final CityOverview city;
  final VoidCallback onTap;

  const QuietCityRow({super.key, required this.city, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final uf = city.parentState;
    return InkWell(
      onTap: onTap,
      child: Container(
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Text(
                uf != null && uf.isNotEmpty
                    ? '${city.name} · ${uf.toUpperCase()}'
                    : city.name,
                style: SIMEopsType.placeTab(active: false)
                    .copyWith(color: SIMEopsColors.muted, fontSize: 11),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              '${city.totalCrimes30d} em 30d',
              style: SIMEopsType.placeTab(active: false).copyWith(fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}
