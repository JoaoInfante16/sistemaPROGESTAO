import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/executive_data.dart';
import '../theme/simeops_colors.dart';
import 'esqueleto.dart';
import '../theme/simeops_type.dart';

/// "Indicadores da região" — os números que a imprensa publicou como
/// estatística (apreensões no semestre, variação de roubos, prejuízo estimado),
/// resumidos pelo GPT a partir das matérias de natureza `estatistica`.
///
/// **Deixou de ser carrossel em 09/08.** Eram fichas de 180px rolando na
/// horizontal dentro de um relatório que rola na vertical: o terceiro indicador
/// ficava escondido atrás de um gesto que ninguém adivinha, e num documento que
/// existe pra ser lido inteiro isso é perder informação de propósito. Agora é
/// lista, com a estrutura fixa que um indicador precisa ter para poder ser
/// citado: **valor · o que é · de quando/de quem**.
///
/// As duas cores de sentido também vinham de fora da paleta (`0xFF22C55E`,
/// `0xFFE05252`) — mais uma tabela de cor paralela, que é como a tela da cidade
/// já tinha ganhado uma terceira. Agora saem de `SIMEopsColors`.
class ExecutiveIndicators extends StatelessWidget {
  final ExecutiveData data;

  /// Quando `false`, o widget está dentro de uma seção que já tem título.
  final bool showHeader;

  /// A 1ª abertura da busca manual espera o GPT (~1-2s). Mostra o esqueleto em
  /// vez de seção vazia que aparece de repente.
  final bool loading;

  const ExecutiveIndicators({
    super.key,
    required this.data,
    this.showHeader = true,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    if (!loading && data.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showHeader) ...[
          Text('INDICADORES DA REGIÃO', style: SIMEopsType.dateline()),
          const SizedBox(height: 10),
        ],

        if (loading && data.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 22),
            child: EsqueletoDeBloco(linhas: 3),
          )
        else ...[
          for (final ind in data.indicadores) _LinhaIndicador(indicador: ind),

          // O parágrafo dos que não viraram indicador — prosa, em Archivo.
          if (data.resumoComplementar != null &&
              data.resumoComplementar!.trim().isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(data.resumoComplementar!, style: SIMEopsType.lead()),
          ],

          if (data.fontes.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 14,
              runSpacing: 6,
              children: [
                Text(
                  'FONTES',
                  style: SIMEopsType.slug(color: SIMEopsColors.faint),
                ),
                ...data.fontes.map(
                  (f) => InkWell(
                    onTap: () => launchUrl(
                      Uri.parse('https://$f'),
                      mode: LaunchMode.externalApplication,
                    ),
                    child: Text(
                      f,
                      style: SIMEopsType.credit(color: SIMEopsColors.tealLight),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ],
    );
  }
}

class _LinhaIndicador extends StatelessWidget {
  final ExecutiveIndicator indicador;
  const _LinhaIndicador({required this.indicador});

  /// A cor diz se é bom ou ruim **para quem opera segurança** — é o que o campo
  /// `sentido` guarda. Neutro fica em branco: nem todo número tem lado.
  Color get _cor {
    switch (indicador.sentido) {
      case 'positivo':
        return SIMEopsColors.greenLight;
      case 'negativo':
        return SIMEopsColors.alert;
      default:
        return SIMEopsColors.white;
    }
  }

  /// Seta só em percentual, e ela diz a **direção literal** do número (subiu ou
  /// caiu). Quem diz se isso é bom ou ruim é a cor.
  String? get _seta {
    if (indicador.tipo != 'percentual') return null;
    if (indicador.valor > 0) return '↑';
    if (indicador.valor < 0) return '↓';
    return null;
  }

  String _valorFormatado() {
    switch (indicador.tipo) {
      case 'percentual':
        final abs = indicador.valor.abs();
        final sinal = indicador.valor > 0
            ? '+'
            : indicador.valor < 0
            ? '-'
            : '';
        final str = abs == abs.roundToDouble()
            ? abs.toStringAsFixed(0)
            : abs.toStringAsFixed(1).replaceAll('.', ',');
        return '$sinal$str${indicador.unidade ?? '%'}';
      case 'monetario':
        final v = indicador.valor;
        if (v >= 1_000_000) {
          return 'R\$ ${(v / 1_000_000).toStringAsFixed(1).replaceAll('.', ',')} Mi';
        }
        if (v >= 1_000) return 'R\$ ${(v / 1_000).toStringAsFixed(0)} mil';
        return 'R\$ ${v.toStringAsFixed(0)}';
      case 'absoluto':
      default:
        final v = indicador.valor;
        if (v >= 1000) {
          return v
              .toStringAsFixed(0)
              .replaceAllMapped(
                RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
                (m) => '${m[1]}.',
              );
        }
        return v.toStringAsFixed(0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: SIMEopsColors.rule)),
      ),
      padding: const EdgeInsets.symmetric(vertical: 13),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                _valorFormatado(),
                style: SIMEopsType.figure(size: 21, color: _cor),
              ),
              if (_seta != null) ...[
                const SizedBox(width: 3),
                Text(_seta!, style: SIMEopsType.figure(size: 13, color: _cor)),
              ],
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  indicador.label,
                  style: SIMEopsType.rowTitle(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          if (indicador.contexto.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              indicador.contexto,
              style: SIMEopsType.slug(color: SIMEopsColors.faint),
            ),
          ],
        ],
      ),
    );
  }
}
