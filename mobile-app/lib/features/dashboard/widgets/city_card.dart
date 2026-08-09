import 'package:flutter/material.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/widgets/entrada_de_lugar.dart';

/// Cidade no dashboard, em bloco de fio.
///
/// Era um `Card` com borda, ícone, badge vermelho e três readouts em cápsula.
/// Virou bloco aberto, e depois virou uma [EntradaDeLugar] — a mesma anatomia
/// que o item do histórico de consultas usa, preenchida com o que serve à
/// varredura.
///
/// **Cidade sem novidade não ganha bloco** — vira [QuietCityRow], uma linha de
/// ~44px. É o que faz a grade sobreviver a 20 cidades sem virar planilha: dia
/// quieto colapsa sozinho, dia agitado expande sozinho. A regra é semântica
/// (tem não lida?), não um "top N" arbitrário.
class CityCard extends StatelessWidget {
  final CityOverview city;
  final VoidCallback onTap;

  const CityCard({super.key, required this.city, required this.onTap});

  /// A posição ③ — e a regra dela é dura: **só entra o que nenhuma figura do
  /// card mostra.**
  ///
  /// Aqui moravam três frases. `"21 ocorrências em trinta dias"` virou a
  /// etiqueta ② (`21 EM 30D`), e `"Patrimonial responde por 52%, a maior
  /// fatia"` é literalmente a maior figura de ④ — o card afirmava o mesmo fato
  /// em duas linguagens, e era essa redundância, não os números, que fazia os
  /// 235px de altura.
  ///
  /// Sobra o que nenhum número diz: **quais** cidades o grupo reúne. "Grande
  /// Florianópolis" não informa nada a quem não é de lá, e o app é vendido para
  /// fora da cidade monitorada. Cidade sozinha não tem o que dizer aqui e fica
  /// muda — a linha inteira some.
  ///
  /// 🚨 A frase de vazio é a exceção: com zero ocorrência não há figura
  /// nenhuma, e o card precisa dizer que **não achou**, em vez de parecer
  /// quebrado.
  String? get _qualificacao {
    if (city.totalCrimes30d == 0) {
      return 'Sem ocorrência publicada nos últimos trinta dias.';
    }

    final names = city.cityNames;
    if (city.isGroup && names != null && names.isNotEmpty) {
      final mostrados = names.take(3).toList();
      final extra = names.length - mostrados.length;
      final lista = mostrados.length == 1
          ? mostrados.first
          : '${mostrados.take(mostrados.length - 1).join(', ')} e '
              '${mostrados.last}';
      return extra > 0 ? 'Reúne $lista e mais $extra.' : 'Reúne $lista.';
    }

    return null;
  }

  /// ① — de onde é, e o que há de novo. Duas tintas na mesma linha: o lugar em
  /// `faint`, a novidade em verde, porque é a única coisa da lista que pede
  /// ação hoje.
  Widget? _etiquetaEsquerda() {
    // `abbrState`, não o nome cru: o backend manda "Santa Catarina" e a linha
    // saía como `SANTA CA…` truncada, comendo a largura do nome da cidade.
    final uf = city.parentState != null ? abbrState(city.parentState!) : null;
    final temUf = uf != null && uf.isNotEmpty;

    if (!temUf && !city.hasUnread) return null;

    final novas =
        '${city.unreadCount} ${city.unreadCount == 1 ? 'NOVA' : 'NOVAS'}';
    final tinta = SIMEopsType.slug(color: SIMEopsColors.faint);

    return Text.rich(
      TextSpan(
        children: [
          if (temUf) TextSpan(text: uf.toUpperCase(), style: tinta),
          if (temUf && city.hasUnread) TextSpan(text: ' · ', style: tinta),
          if (city.hasUnread)
            TextSpan(
              text: novas,
              style: SIMEopsType.slug(color: SIMEopsColors.greenLight),
            ),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }

  /// ④ — a quebra por categoria.
  ///
  /// Mostra **toda categoria com contagem > 0**, no máximo cinco.
  ///
  /// Antes eram as quatro maiores + `OUTRAS`, e isso era uma mentira
  /// estrutural: as categorias são exatamente cinco, então `OUTRAS` **nunca
  /// agregava nada** — era a 5ª categoria escondida atrás de um rótulo genérico
  /// e pintada com a cor de `institucional`, que podia ser justamente outra.
  /// Chip que mente é pior que chip nenhum, e a regra do projeto é que a cor
  /// mora no chip.
  Widget? _figuras() {
    final ordenado = city.categorias30d.entries
        .where((e) => e.value > 0)
        .toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    if (ordenado.isEmpty) return null;

    return FaixaDeFiguras(
      figuras: [
        for (final e in ordenado.take(5))
          Figura(
            valor: '${e.value}',
            rotulo: _curto[e.key] ?? categoryLabel(e.key).toUpperCase(),
            categoria: e.key,
          ),
      ],
    );
  }

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
    final qualificacao = _qualificacao;

    // Ar generoso em cima e embaixo, e **nenhum filete**: com 15 no rodapé e 21
    // no topo do próximo, as duas cidades encostavam. Os blocos se separam por
    // ar; o único traço da tela é o que separa cidade quieta de cidade quieta.
    return EntradaDeLugar(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(18, 26, 18, 26),
      etiquetaEsquerdaRica: _etiquetaEsquerda(),
      // O mesmo `21 EM 30D` que a QuietCityRow escreve e que o cabeçalho da
      // cidade escreve: cidade quieta e cidade agitada dizem a mesma frase, no
      // mesmo lugar.
      etiquetaDireita: '${city.totalCrimes30d} EM 30D',
      nome: city.name,
      estiloDoNome: SIMEopsType.cityHeadline(),
      qualificacao: qualificacao == null
          ? null
          : Text(qualificacao, style: SIMEopsType.lead()),
      figuras: _figuras(),
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
