import 'package:flutter/material.dart';

import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/datas.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/widgets/entrada_de_lugar.dart';

/// Uma consulta no histórico.
///
/// Usa a mesma [EntradaDeLugar] do card da varredura — mesma anatomia,
/// conteúdo de outro propósito: ① de onde é, ② quando rodou, ③ o recorte
/// pedido, ④ o que achou.
///
/// Três correções de fundo em relação ao card antigo:
///
/// **1. A cidade virou o título.** Antes o estado ("Bahia") vinha grande e a
/// cidade ("Salvador") pequena e apagada embaixo. Está invertido: quem varre o
/// histórico procura *qual cidade buscou* — o estado não discrimina nada,
/// porque se busca cinco cidades do mesmo estado.
///
/// **2. "Concluída" deixou de ser selo verde.** Ele aparecia em praticamente
/// todo card, sempre igual, e era o elemento mais saturado da lista. Status
/// que quase sempre é o mesmo não pode gritar — quem merece cor é a falha, que
/// é a exceção. Sucesso agora é silêncio, e quem informa é a contagem.
///
/// **3. A contagem virou figura.** `56 RESULTADOS` era mono 9.5 no topo, do
/// mesmo tamanho de `30 DIAS` — o dado principal da entrada tinha o peso do
/// dado acessório. E **a falha ocupa esse mesmo lugar**: antes ela disputava a
/// linha com a hora, agora aparece onde o olho já vai buscar o número.
class HistoryCard extends StatelessWidget {
  final Map<String, dynamic> search;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;
  final bool selected;

  const HistoryCard({
    super.key,
    required this.search,
    required this.onTap,
    this.onLongPress,
    this.selected = false,
  });

  /// Só a hora: `11:22`. A lista é agrupada por dia (`HOJE`, `ONTEM`,
  /// `04 AGO`), então carimbar a data em cada item repetia vinte vezes o que
  /// o divisor logo acima já diz.
  static String _stamp(DateTime? d) {
    if (d == null) return '';
    return '${d.hour.toString().padLeft(2, '0')}:'
        '${d.minute.toString().padLeft(2, '0')}';
  }

  /// ④ — o que a consulta achou, ou por que não achou.
  Widget? _resultado({
    required bool failed,
    required bool running,
    required int? total,
  }) {
    if (failed) {
      return const Figura(
        valor: 'FALHOU',
        rotulo: 'TOQUE PARA TENTAR DE NOVO',
        corDoValor: SIMEopsColors.alert,
        corDoRotulo: SIMEopsColors.alert,
        tamanho: 15,
      );
    }
    if (running) {
      return const Figura(
        valor: 'EM ANDAMENTO',
        rotulo: 'TOQUE PARA ACOMPANHAR',
        corDoValor: SIMEopsColors.tealLight,
        tamanho: 15,
      );
    }
    if (total == null) return null;
    return Figura(
      valor: '$total',
      rotulo: total == 1 ? 'RESULTADO' : 'RESULTADOS',
    );
  }

  @override
  Widget build(BuildContext context) {
    final params = search['params'] as Map<String, dynamic>? ?? {};
    final status = search['status'] as String? ?? 'processing';
    final total = search['total_results'] as int?;
    final date = parseApiDate(search['created_at'] as String? ?? '');

    final estado = params['estado'] as String? ?? '';
    final cidades = (params['cidades'] as List<dynamic>?)
            ?.map((c) => c.toString())
            .toList() ??
        const <String>[];
    final periodo = params['periodo_dias'];
    final assuntos = (params['assuntos'] as List<dynamic>?)?.length;

    final failed = status == 'failed';
    final running = status != 'completed' && !failed;

    // O título é a cidade. Sem cidade (dado antigo), cai no estado.
    final titulo = cidades.isNotEmpty ? cidades.first : estado;

    // ③ — o recorte que define a consulta, em mono.
    //
    // A UF saiu daqui e subiu para ①: `MINAS GERAIS · 30 DIAS · 17 ASSUNTOS`
    // estourava a linha, e mesmo abreviada a UF é desambiguação de lugar — que
    // é o assunto da etiqueta de cima, não do recorte.
    final marks = <String>[
      if (periodo != null) '$periodo DIAS',
      if (assuntos != null && assuntos > 0) '$assuntos ASSUNTOS',
      if (cidades.length > 1) '+${cidades.length - 1} CIDADES',
    ];

    return EntradaDeLugar(
      onTap: onTap,
      onLongPress: onLongPress,
      selecionado: selected,
      comFilete: true,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
      etiquetaEsquerda: estado.isNotEmpty ? abbrState(estado) : null,
      etiquetaDireita: _stamp(date),
      nome: titulo,
      estiloDoNome: SIMEopsType.entryTitle(
        color: failed ? SIMEopsColors.faint : SIMEopsColors.white,
      ),
      qualificacao: marks.isEmpty
          ? null
          : Text(
              marks.join(' · '),
              style: SIMEopsType.slug(color: SIMEopsColors.faint),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
      figuras: _resultado(failed: failed, running: running, total: total),
    );
  }
}
