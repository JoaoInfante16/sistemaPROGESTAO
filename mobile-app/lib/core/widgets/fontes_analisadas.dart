import 'package:flutter/material.dart';
import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';

/// "Veículos analisados" — compartilhada entre a cidade (auto-scan) e o
/// relatório da busca manual.
///
/// Agrupa por hostname com contagem e separa **oficial** (gov.br, ssp, sesp…)
/// de imprensa. A distinção importa: uma ocorrência confirmada pela secretaria
/// de segurança e uma noticiada por um portal não têm o mesmo peso, e o
/// relatório precisa deixar isso visível sem precisar dizer.
///
/// Antes era uma caixa r12 com `[1]  ndmais.com.br  3x` em `exo2`. Agora é
/// ranking com filete: nome, contagem e a barra proporcional que já é a
/// linguagem do bairro logo acima. **Uma cor só** na barra — quantidade de
/// publicações não é juízo de valor sobre o veículo.
class FontesAnalisadas extends StatelessWidget {
  final List<Map<String, String>> oficiais;
  final List<Map<String, String>> midias;

  /// Quantos veículos aparecem antes do "+ N com menos de X". Oito é o que
  /// cabe sem a seção virar uma segunda lista de notícias.
  static const _visiveis = 8;

  const FontesAnalisadas({
    super.key,
    required this.oficiais,
    required this.midias,
  });

  @override
  Widget build(BuildContext context) {
    if (oficiais.isEmpty && midias.isEmpty) return const SizedBox.shrink();

    int conta(Map<String, String> f) => int.tryParse(f['count'] ?? '1') ?? 1;

    // Oficiais primeiro, sempre: são a fonte mais forte do documento.
    final todos = [
      ...oficiais.map((f) => (f, true)),
      ...midias.map((f) => (f, false)),
    ];
    final visiveis = todos.take(_visiveis).toList();
    final resto = todos.length - visiveis.length;
    final maior = visiveis.isEmpty ? 1 : conta(visiveis.first.$1);
    final corte = visiveis.isEmpty ? 0 : conta(visiveis.last.$1);

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 26, 18, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('VEÍCULOS ANALISADOS', style: SIMEopsType.dateline()),
          const SizedBox(height: 5),
          Text(
            [
              if (oficiais.isNotEmpty)
                '${oficiais.length} ${oficiais.length == 1 ? 'fonte oficial' : 'fontes oficiais'}',
              if (midias.isNotEmpty)
                '${midias.length} de imprensa',
            ].join(' · '),
            style: SIMEopsType.note(color: SIMEopsColors.faint),
          ),
          const SizedBox(height: 12),
          for (final (fonte, oficial) in visiveis)
            _Linha(
              nome: fonte['name'] ?? '',
              valor: conta(fonte),
              fracao: maior > 0 ? conta(fonte) / maior : 0,
              oficial: oficial,
            ),
          if (resto > 0)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                '+ $resto ${resto == 1 ? 'veículo' : 'veículos'} com menos de '
                '$corte ${corte == 1 ? 'publicação' : 'publicações'}.',
                style: SIMEopsType.note(color: SIMEopsColors.faint),
              ),
            ),
        ],
      ),
    );
  }
}

class _Linha extends StatelessWidget {
  final String nome;
  final int valor;
  final double fracao;
  final bool oficial;

  const _Linha({
    required this.nome,
    required this.valor,
    required this.fracao,
    required this.oficial,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
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
                    color: oficial ? SIMEopsColors.tealLight : SIMEopsColors.muted,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (oficial) ...[
                const SizedBox(width: 10),
                Text('OFICIAL',
                    style: SIMEopsType.slug(color: SIMEopsColors.faint)),
              ],
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
              widthFactor: fracao.clamp(0.0, 1.0),
              child: Container(color: SIMEopsColors.teal),
            ),
          ),
        ],
      ),
    );
  }
}

// Helper: agrupa uma lista de URLs em {oficiais, midias} deduplicados por
// hostname com count. Usado tanto pela busca manual (dados em memória) quanto
// pelo dashboard (dados vindo do backend).
class FontesAgrupadas {
  final List<Map<String, String>> oficiais;
  final List<Map<String, String>> midias;
  FontesAgrupadas({required this.oficiais, required this.midias});

  static final RegExp _officialPattern = RegExp(
      r'\.gov\.br|\.ssp\.|\.seguranca\.|\.sesp\.|\.sspds\.|\.sejusp\.|\.segup\.',
      caseSensitive: false);

  factory FontesAgrupadas.fromUrls(Iterable<String> urls) {
    final hostOficial = <String, int>{};
    final hostMedia = <String, int>{};
    for (final url in urls) {
      if (url.isEmpty) continue;
      String host;
      try {
        host = Uri.parse(url).host;
      } catch (_) {
        host = url;
      }
      if (_officialPattern.hasMatch(url)) {
        hostOficial[host] = (hostOficial[host] ?? 0) + 1;
      } else {
        hostMedia[host] = (hostMedia[host] ?? 0) + 1;
      }
    }

    List<Map<String, String>> toSortedList(Map<String, int> m) =>
        m.entries
            .map((e) => {'name': e.key, 'count': e.value.toString()})
            .toList()
          ..sort((a, b) => int.parse(b['count']!).compareTo(int.parse(a['count']!)));

    return FontesAgrupadas(
      oficiais: toSortedList(hostOficial),
      midias: toSortedList(hostMedia),
    );
  }
}
