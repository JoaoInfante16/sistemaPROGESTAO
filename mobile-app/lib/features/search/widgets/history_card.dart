import 'package:flutter/material.dart';

import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/datas.dart';
import '../../../core/utils/state_utils.dart';

/// Uma consulta no histórico.
///
/// Duas correções de fundo em relação ao card antigo:
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

    // Linha de contexto: o que define a consulta, em mono.
    //
    // `abbrState`, não o nome por extenso: `MINAS GERAIS · 30 DIAS · 17
    // ASSUNTOS` estourava a linha e empurrava o resto pra fora, enquanto
    // `MG · 30 DIAS · 17 ASSUNTOS` diz o mesmo em um terço da largura. A UF é
    // desambiguação, não conteúdo — ninguém lê "Minas Gerais" aqui, lê "MG".
    final marks = <String>[
      if (estado.isNotEmpty) abbrState(estado),
      if (periodo != null) '$periodo DIAS',
      if (assuntos != null && assuntos > 0) '$assuntos ASSUNTOS',
      if (cidades.length > 1) '+${cidades.length - 1} CIDADES',
    ];

    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      child: Container(
        decoration: BoxDecoration(
          color: selected ? SIMEopsColors.navyLight : null,
          border: const Border(
            bottom: BorderSide(color: SIMEopsColors.rule),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 17),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (failed)
                  Text('FALHOU',
                      style: SIMEopsType.slug(color: SIMEopsColors.alert))
                else if (running)
                  Text('EM ANDAMENTO',
                      style: SIMEopsType.slug(color: SIMEopsColors.tealLight))
                else if (total != null)
                  Text(
                    '$total ${total == 1 ? 'RESULTADO' : 'RESULTADOS'}',
                    style: SIMEopsType.slug(color: SIMEopsColors.white),
                  ),
                const Spacer(),
                Text(_stamp(date),
                    style: SIMEopsType.slug(color: SIMEopsColors.faint)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              titulo,
              style: SIMEopsType.entryTitle(
                color: failed ? SIMEopsColors.faint : SIMEopsColors.white,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (marks.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                marks.join(' · '),
                style: SIMEopsType.slug(color: SIMEopsColors.faint),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            if (failed) ...[
              const SizedBox(height: 7),
              Text('TOQUE PARA TENTAR DE NOVO',
                  style: SIMEopsType.slug(color: SIMEopsColors.alert)),
            ],
          ],
        ),
      ),
    );
  }
}
