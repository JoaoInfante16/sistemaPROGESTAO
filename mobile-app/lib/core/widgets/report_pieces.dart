import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';
import '../utils/category_colors.dart';
import 'cat_chip.dart';

/// As peças do relatório, compartilhadas pelas **duas** telas que o desenham:
/// a aba Relatório da cidade (números do auto-scan, agregados pelo backend) e o
/// relatório da busca manual (números calculados no aparelho).
///
/// Elas eram duas implementações paralelas do mesmo desenho — dois donuts, dois
/// rankings de bairro, dois `_statBox`, dois `_sectionTitle`, dois `_card`. Foi
/// assim que a tela da cidade acabou com uma **terceira tabela de cores**
/// própria (achada na auditoria de 08/08): quando o desenho é copiado, a
/// correção só chega numa das cópias.

/// Rótulo de bloco: mono pequeno em caixa alta, e o espaço em branco fazendo o
/// trabalho que a caixa com borda fazia antes.
class BlocoRelatorio extends StatelessWidget {
  final String titulo;

  /// Ressalva metodológica — vai **colada no título**, não num rodapé que
  /// ninguém lê. "Citação na matéria, não é onde o fato ocorreu" muda como o
  /// número deve ser interpretado, então precisa ser lido antes dele.
  final String? nota;
  final Widget child;

  const BlocoRelatorio({
    super.key,
    required this.titulo,
    this.nota,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 26, 18, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titulo.toUpperCase(), style: SIMEopsType.dateline()),
          if (nota != null) ...[
            const SizedBox(height: 5),
            Text(nota!, style: SIMEopsType.note(color: SIMEopsColors.faint)),
          ],
          child,
        ],
      ),
    );
  }
}

/// Ranking com barra proporcional. **Uma cor só**, sempre.
///
/// Magnitude nominal não se colore por valor: pintar o primeiro bairro de
/// vermelho e o último de verde inventa um juízo ("perigoso"/"seguro") que o
/// dado não sustenta — são contagens de citação em matéria, não taxas por
/// habitante. O comprimento da barra já diz quem é maior.
class RankBarras extends StatelessWidget {
  final List<(String, int)> itens;

  const RankBarras({super.key, required this.itens});

  @override
  Widget build(BuildContext context) {
    if (itens.isEmpty) return const SizedBox.shrink();
    final maior = itens.first.$2;

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        children: [
          for (final (nome, valor) in itens)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 9),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: Text(
                          nome,
                          style: SIMEopsType.placeTab(
                            active: false,
                            color: SIMEopsColors.muted,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text('$valor', style: SIMEopsType.placeTab(active: true)),
                    ],
                  ),
                  const SizedBox(height: 7),
                  Container(
                    height: 4,
                    color: SIMEopsColors.navyLight,
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: maior > 0 ? valor / maior : 0,
                      child: Container(color: SIMEopsColors.teal),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// `VER COMO TABELA →`, e a tabela.
///
/// Todo gráfico do relatório tem um. Rosca e barra mostram proporção e escondem
/// o número exato — e este documento existe pra ser citado por alguém que não
/// estava na sala. Ninguém cita "uns 40% mais ou menos". A tabela é também o
/// único caminho pra quem lê com leitor de tela.
class TabelaGemea extends StatefulWidget {
  /// `(nome, valor, terceira coluna)` — a terceira pode vir vazia.
  final List<(String, String, String)> linhas;

  const TabelaGemea({super.key, required this.linhas});

  @override
  State<TabelaGemea> createState() => _TabelaGemeaState();
}

class _TabelaGemeaState extends State<TabelaGemea> {
  bool _aberta = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => setState(() => _aberta = !_aberta),
          child: Padding(
            padding: const EdgeInsets.only(top: 11, bottom: 4),
            child: Text(
              _aberta ? 'ESCONDER A TABELA' : 'VER COMO TABELA →',
              style: SIMEopsType.slug(color: SIMEopsColors.tealLight),
            ),
          ),
        ),
        if (_aberta)
          for (final (a, b, c) in widget.linhas)
            Container(
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
              ),
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      a,
                      style: SIMEopsType.placeTab(
                        active: false,
                        color: SIMEopsColors.muted,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(b, style: SIMEopsType.placeTab(active: true)),
                  if (c.isNotEmpty) ...[
                    const SizedBox(width: 14),
                    SizedBox(
                      width: 44,
                      child: Text(
                        c,
                        textAlign: TextAlign.right,
                        style: SIMEopsType.placeTab(
                          active: false,
                          color: SIMEopsColors.faint,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
      ],
    );
  }
}

/// A rosca por categoria — **ela fica** (decisão do João em 09/08).
///
/// Carrega o panorama (uma categoria domina? está espalhado?) enquanto a
/// legenda carrega a comparação. O que mudou no redesign: filete fino em vez de
/// anel gordo, total no centro, e quadrado em vez de bolinha na legenda — a
/// mesma peça de categoria do resto do app.
///
/// Tocar numa categoria aplica o recorte, quando o dono da tela oferece isso
/// (`onToggle`). Sem `onToggle` a legenda é só leitura.
class RoscaCategorias extends StatelessWidget {
  final Map<String, int> contagens;
  final int total;
  final Set<String> selecionadas;
  final ValueChanged<String>? onToggle;

  const RoscaCategorias({
    super.key,
    required this.contagens,
    required this.total,
    this.selecionadas = const {},
    this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final ordenado = contagens.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final soma = ordenado.fold<int>(0, (s, e) => s + e.value);
    if (soma == 0) return const SizedBox.shrink();

    String pct(int v) => '${(v / soma * 100).round()}%';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Row(
            children: [
              SizedBox(
                width: 118,
                height: 118,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    PieChart(
                      PieChartData(
                        sections: ordenado.map((e) {
                          final apagada =
                              selecionadas.isNotEmpty &&
                              !selecionadas.contains(e.key);
                          return PieChartSectionData(
                            value: e.value.toDouble(),
                            color: categoryColor(
                              e.key,
                            ).withValues(alpha: apagada ? 0.22 : 1),
                            radius: 9,
                            showTitle: false,
                          );
                        }).toList(),
                        sectionsSpace: 2,
                        centerSpaceRadius: 46,
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('$total', style: SIMEopsType.figure(size: 26)),
                        const SizedBox(height: 4),
                        Text(
                          'TOTAL',
                          style: SIMEopsType.slug(color: SIMEopsColors.faint),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final e in ordenado)
                      _LinhaDaLegenda(
                        categoria: e.key,
                        valor: e.value,
                        pct: pct(e.value),
                        apagada:
                            selecionadas.isNotEmpty &&
                            !selecionadas.contains(e.key),
                        onTap: onToggle == null ? null : () => onToggle!(e.key),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        TabelaGemea(
          linhas: [
            for (final e in ordenado)
              (categoryLabel(e.key), '${e.value}', pct(e.value)),
          ],
        ),
      ],
    );
  }
}

class _LinhaDaLegenda extends StatelessWidget {
  final String categoria;
  final int valor;
  final String pct;
  final bool apagada;
  final VoidCallback? onTap;

  const _LinhaDaLegenda({
    required this.categoria,
    required this.valor,
    required this.pct,
    required this.apagada,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Opacity(
        opacity: apagada ? 0.45 : 1,
        child: Container(
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
          ),
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              CatChip(categoria: categoria),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  categoryLabel(categoria).toUpperCase(),
                  style: SIMEopsType.slug(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              SizedBox(
                width: 38,
                child: Text(
                  pct,
                  textAlign: TextAlign.right,
                  style: SIMEopsType.slug(color: SIMEopsColors.faint),
                ),
              ),
              SizedBox(
                width: 30,
                child: Text(
                  '$valor',
                  textAlign: TextAlign.right,
                  style: SIMEopsType.slug(color: SIMEopsColors.white),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A janela do relatório: `7D · 30D · 90D · 1A · TUDO`.
///
/// Nasceu de um defeito que o João pegou olhando a tela: o relatório da cidade
/// mostrava **sempre 30 dias**, sem dizer, e sem oferecer outra coisa — a
/// constante estava chumbada em três lugares. E logo abaixo havia um seletor
/// que ia até 1 ano mexendo **só no gráfico de volume**: a mesma página com
/// dois períodos, o que é pior que um período errado, porque quem lê soma os
/// dois sem saber.
///
/// `TUDO` é o ponto do exercício. O produto acumula desde que o auto-scan
/// começou a rodar, e até aqui não havia como ver isso — a cidade tinha
/// memória e a tela só mostrava o último mês.
///
/// Sem cápsula: é o mesmo vocabulário das abas de cidade, rótulo mono e filete
/// no ativo.
class JanelaDoRelatorio extends StatelessWidget {
  /// Dias da janela. `null` = desde o início.
  final int? dias;
  final ValueChanged<int?> onMudar;

  const JanelaDoRelatorio({
    super.key,
    required this.dias,
    required this.onMudar,
  });

  static const _opcoes = <(String, int?)>[
    ('7D', 7),
    ('30D', 30),
    ('90D', 90),
    ('1A', 365),
    ('TUDO', null),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
      child: Row(
        children: [
          for (final (rotulo, valor) in _opcoes)
            Padding(
              padding: const EdgeInsets.only(right: 17),
              child: InkWell(
                onTap: () => onMudar(valor),
                child: Container(
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: dias == valor
                            ? SIMEopsColors.greenLight
                            : Colors.transparent,
                        width: 1.5,
                      ),
                    ),
                  ),
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    rotulo,
                    style: SIMEopsType.placeTab(active: dias == valor),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
