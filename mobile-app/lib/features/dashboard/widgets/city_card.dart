import 'package:flutter/material.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/widgets/entrada_de_lugar.dart';

/// Cidade no dashboard, em bloco de fio.
///
/// Era um `Card` com borda, ícone, badge vermelho e três readouts em cápsula.
/// Virou bloco aberto: nome em corpo grande, uma linha de qualificação e o
/// filete que separa do próximo.
///
/// **Cidade sem novidade não ganha bloco** — vira [QuietCityRow], uma linha de
/// ~44px. É o que faz a grade sobreviver a 20 cidades sem virar planilha: dia
/// quieto colapsa sozinho, dia agitado expande sozinho. A regra é semântica
/// (tem não lida?), não um "top N" arbitrário.
///
/// A anatomia mora em [EntradaDeLugar], compartilhada com o item de consulta.
/// Aqui fica só o que é desta tela.
class CityCard extends StatelessWidget {
  final CityOverview city;
  final VoidCallback onTap;

  const CityCard({super.key, required this.city, required this.onTap});

  /// A linha de qualificação (③).
  ///
  /// 🚨 **Aqui morava uma frase de três linhas que dizia o mesmo fato três
  /// vezes.** Ela abria com *"21 ocorrências em trinta dias"* — e a faixa de
  /// figuras logo abaixo soma exatamente 21. Seguia com *"Patrimonial responde
  /// por 52%, a maior fatia"* — e a maior figura da faixa é justamente
  /// `11 PATRIM.`. E a etiqueta de cima dizia `4 CIDADES`, que é a contagem dos
  /// nomes que a própria frase listava no fim.
  ///
  /// Três repetições, ~40px de altura, zero dado novo. O que sobrou é o único
  /// pedaço que **nenhuma figura mostra**: quais cidades o grupo reúne —
  /// "Grande Florianópolis" não informa nada a quem não é de lá, e o app é
  /// vendido para fora da cidade monitorada.
  ///
  /// Cidade sozinha e com ocorrência fica **muda**, e a posição some sem deixar
  /// vão. Cidade zerada fala, porque aí não há figura nenhuma para falar por
  /// ela.
  String? get _qualificacao {
    if (city.totalCrimes30d == 0) {
      return 'Sem ocorrência publicada nos últimos trinta dias.';
    }

    final names = city.cityNames;
    if (!city.isGroup || names == null || names.isEmpty) return null;

    if (names.length <= 3) {
      final ultimos = names.length == 1
          ? names.first
          : '${names.sublist(0, names.length - 1).join(', ')} e ${names.last}';
      return 'Reúne $ultimos.';
    }
    return 'Reúne ${names.take(3).join(', ')} e mais ${names.length - 3}.';
  }

  @override
  Widget build(BuildContext context) {
    // `abbrState`, não o nome cru: o backend manda "Santa Catarina" e a linha
    // saía como `SANTA CA…` truncada, comendo a largura do nome da cidade.
    final uf = city.parentState != null ? abbrState(city.parentState!) : null;
    final qualificacao = _qualificacao;

    return EntradaDeLugar(
      onTap: onTap,
      titulo: city.name,
      estiloDoTitulo: SIMEopsType.cityHeadline(),
      linhasDoTitulo: 2,
      // ① `SC · 6 NOVAS` — o `N CIDADES` que morava aqui virou os nomes em ③,
      // que é a mesma informação com o dado real em vez da contagem dele.
      etiquetaEsquerda: Text.rich(
        TextSpan(
          children: [
            if (uf != null && uf.isNotEmpty) TextSpan(text: uf.toUpperCase()),
            if (uf != null && uf.isNotEmpty && city.hasUnread)
              const TextSpan(text: ' · '),
            if (city.hasUnread)
              TextSpan(
                text:
                    '${city.unreadCount} ${city.unreadCount == 1 ? 'NOVA' : 'NOVAS'}',
                style: const TextStyle(color: SIMEopsColors.greenLight),
              ),
          ],
        ),
        style: SIMEopsType.slug(color: SIMEopsColors.faint),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      // ② a mesma frase que a `QuietCityRow` escreve e que o cabeçalho da
      // cidade escreve. Cidade quieta e cidade agitada dizem a mesma coisa no
      // mesmo lugar.
      etiquetaDireita: '${city.totalCrimes30d} EM 30D',
      qualificacao: qualificacao == null
          ? null
          : Text(qualificacao, style: SIMEopsType.lead()),
      figuras: city.categorias30d.isEmpty
          ? null
          : FaixaDeFiguras(contagens: city.categorias30d),
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
                uf != null && uf.isNotEmpty ? '${city.name} · $uf' : city.name,
                style: SIMEopsType.placeTab(
                  active: false,
                  color: SIMEopsColors.muted,
                ),
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
