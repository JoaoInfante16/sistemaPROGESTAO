import 'package:flutter/material.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/widgets/cat_chip.dart';

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
  ///
  /// 🚨 **A maior fatia é de CATEGORIA, não de tipo de crime.**
  ///
  /// Estava em `topCrimeType`, e isso punha duas taxonomias no mesmo card: a
  /// frase dizia *"Homicídio responde por 24%, a maior fatia"* e a linha logo
  /// abaixo mostrava `11 PATRIM. · 6 SEGUR.` — o leitor vê o maior número em
  /// Patrimonial e uma frase afirmando que o maior é Homicídio. Ambos estavam
  /// certos (homicídio é um *tipo* dentro do grupo Segurança), mas denominador
  /// diferente na mesma tela lê como erro, e num produto de dado número que
  /// não fecha é o defeito que mais destrói confiança.
  ///
  /// Agora sai da mesma fonte que os números: `categorias30d`.
  String get _summary {
    final total = city.totalCrimes30d;
    if (total == 0) {
      return 'Sem ocorrência publicada nos últimos trinta dias.';
    }

    final buf = StringBuffer('$total ${total == 1 ? 'ocorrência' : 'ocorrências'} '
        'em trinta dias.');

    final porCategoria = city.categorias30d.entries
        .where((e) => e.value > 0)
        .toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    if (porCategoria.isNotEmpty) {
      final maior = porCategoria.first;
      final somaCategorias =
          porCategoria.fold<int>(0, (s, e) => s + e.value);
      if (somaCategorias > 0) {
        final pct = maior.value * 100 / somaCategorias;
        buf.write(' ${categoryLabel(maior.key)} responde por '
            '${pct.toStringAsFixed(0)}%, a maior fatia.');
      }
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
    // `abbrState`, não o nome cru: o backend manda "Santa Catarina" e a linha
    // saía como `SANTA CA…` truncada, comendo a largura do nome da cidade.
    final uf = city.parentState != null ? abbrState(city.parentState!) : null;

    // Ar generoso em cima e embaixo. Com 15 no rodapé e 21 no topo do próximo,
    // as duas cidades encostavam: o olho não achava onde uma terminava. E o
    // que confundia junto era o **filete de dentro** do card (acima dos
    // números), desenhado igual ao filete de fora — dois traços iguais, um
    // separando parágrafo do mesmo bloco e o outro separando cidades. O de
    // dentro saiu; sobrou um traço só, e ele agora quer dizer uma coisa só.
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 26, 18, 0),
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
            const SizedBox(height: 26),
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
/// Mostra **toda categoria com contagem > 0**, no máximo cinco.
///
/// Antes eram as quatro maiores + `OUTRAS`, e isso era uma mentira estrutural:
/// as categorias são exatamente cinco, então `OUTRAS` **nunca agregava nada** —
/// era a 5ª categoria escondida atrás de um rótulo genérico e pintada com a cor
/// de `institucional`, que podia ser justamente outra. Chip que mente é pior
/// que chip nenhum, e a regra do projeto é que a cor mora no chip.
///
/// Cabe: 412 − 36 de margem − 4×13 de gap = 324px ÷ 5 = 65px por coluna, e
/// `PATRIM.` em mono 9.5 ocupa ~40px mais o chip.
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

    final colunas = [
      for (final e in ordenado.take(5))
        _Figure(
          valor: e.value,
          rotulo: _curto[e.key] ?? categoryLabel(e.key).toUpperCase(),
          categoria: e.key,
        ),
    ];

    // Sem filete em cima: os números a 21px já se separam sozinhos da prosa a
    // 14.5, e o traço que existia aqui competia com o que separa as cidades.
    return Container(
      margin: const EdgeInsets.only(top: 18),
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
  final String categoria;

  const _Figure({
    required this.valor,
    required this.rotulo,
    required this.categoria,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('$valor', style: SIMEopsType.figure()),
        const SizedBox(height: 7),
        Row(
          children: [
            CatChip(categoria: categoria),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                rotulo,
                style: SIMEopsType.slug(color: SIMEopsColors.faint)
                    .copyWith(letterSpacing: 0.77),
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
    final uf = city.parentState != null ? abbrState(city.parentState!) : null;
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
                    ? '${city.name} · $uf'
                    : city.name,
                style: SIMEopsType.placeTab(
                    active: false, color: SIMEopsColors.muted),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              '${city.totalCrimes30d} EM 30D',
              style: SIMEopsType.placeTab(active: false),
            ),
          ],
        ),
      ),
    );
  }
}
