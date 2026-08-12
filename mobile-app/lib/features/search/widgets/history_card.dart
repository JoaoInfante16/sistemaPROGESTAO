import 'package:flutter/material.dart';

import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/datas.dart';
import '../../../core/utils/state_utils.dart';
import '../../../core/widgets/entrada_de_lugar.dart';

/// Uma consulta no histórico.
///
/// Correções de fundo em relação ao card antigo:
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
/// **3. `cancelled` existe.** O backend grava esse status ao cancelar
/// (`POST /manual-search/:id/cancel`) e o app não conhecia a palavra: a
/// consulta cancelada caía no `else` de "não concluída" e ficava
/// **`EM ANDAMENTO` para sempre**, em teal, como se ainda estivesse rodando.
///
/// **4. O resultado virou figura.** `91 RESULTADOS` vivia em mono 9.5, do mesmo
/// tamanho de tudo no card — sendo a única coisa que responde *"essa consulta
/// valeu a pena?"*. Agora é o número em 21px na quarta posição, que é onde o
/// card de cidade também põe os números dele. Deitado, não empilhado: numa
/// lista que se varre, empilhar custaria ~46px por item.
///
/// A anatomia mora em [EntradaDeLugar], compartilhada com o card de cidade.
class HistoryCard extends StatelessWidget {
  final Map<String, dynamic> search;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;
  final bool selected;

  /// Cancelar sem precisar abrir a consulta. Só chega preenchido quando a
  /// consulta está em andamento e a lista não está em modo de seleção — em
  /// seleção, todo toque no item é marcar/desmarcar.
  final VoidCallback? onCancel;

  const HistoryCard({
    super.key,
    required this.search,
    required this.onTap,
    this.onLongPress,
    this.selected = false,
    this.onCancel,
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
    final cidades =
        (params['cidades'] as List<dynamic>?)
            ?.map((c) => c.toString())
            .toList() ??
        const <String>[];
    final periodo = params['periodo_dias'];
    final assuntos = (params['assuntos'] as List<dynamic>?)?.length;

    final failed = status == 'failed';
    final cancelada = status == 'cancelled';
    final running = status != 'completed' && !failed && !cancelada;

    // O título é a cidade. Sem cidade (dado antigo), cai no estado.
    final titulo = cidades.isNotEmpty ? cidades.first : estado;

    // ③ o que define a consulta, em mono. A UF saiu daqui para a primeira
    // posição, onde o card de cidade também a põe.
    final marks = <String>[
      if (periodo != null) '$periodo DIAS',
      if (assuntos != null && assuntos > 0) '$assuntos ASSUNTOS',
      if (cidades.length > 1) '+${cidades.length - 1} CIDADES',
    ];

    return EntradaDeLugar(
      onTap: onTap,
      onLongPress: onLongPress,
      selecionado: selected,
      filete: true,
      titulo: titulo,
      estiloDoTitulo: SIMEopsType.entryTitle(
        color: failed || cancelada ? SIMEopsColors.faint : SIMEopsColors.white,
      ),
      // ① `abbrState`, não o nome por extenso: `MINAS GERAIS` estourava a linha
      // enquanto `MG` diz o mesmo em um terço da largura. A UF é desambiguação,
      // não conteúdo — ninguém lê "Minas Gerais" aqui, lê "MG".
      etiquetaEsquerda: estado.isEmpty
          ? null
          : Text(
              abbrState(estado),
              style: SIMEopsType.slug(color: SIMEopsColors.faint),
            ),
      etiquetaDireita: _stamp(date),
      qualificacao: marks.isEmpty
          ? null
          : Text(
              marks.join(' · '),
              style: SIMEopsType.slug(color: SIMEopsColors.faint),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
      // ④ **a exceção ocupa o lugar do número**, que é onde o olho já vai
      // buscar "e aí, deu no quê?". Antes falha e andamento brigavam com a hora
      // na linha de cima, longe da pergunta que respondem.
      figuras: _desfecho(failed, cancelada, running, total),
    );
  }

  Widget? _desfecho(bool failed, bool cancelada, bool running, int? total) {
    if (failed) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('FALHOU', style: SIMEopsType.slug(color: SIMEopsColors.alert)),
          const SizedBox(height: 7),
          Text(
            'TOQUE PARA TENTAR DE NOVO',
            style: SIMEopsType.slug(color: SIMEopsColors.alert),
          ),
        ],
      );
    }

    // Sem cor: cancelar foi decisão de quem usa, não incidente. Quem tem
    // direito a tinta de alarme é a falha.
    if (cancelada) {
      return Text(
        'CANCELADA',
        style: SIMEopsType.slug(color: SIMEopsColors.faint),
      );
    }

    if (running) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'EM ANDAMENTO',
            style: SIMEopsType.slug(color: SIMEopsColors.tealLight),
          ),
          // O cancelar em `muted`, que é a tinta de todo botão contornado do
          // app: o vermelho fica para o diálogo, não para um item que está
          // trabalhando normalmente.
          if (onCancel != null)
            Align(
              alignment: Alignment.centerLeft,
              child: InkWell(
                onTap: onCancel,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'CANCELAR A CONSULTA',
                    style: SIMEopsType.slug(color: SIMEopsColors.muted),
                  ),
                ),
              ),
            ),
        ],
      );
    }

    if (total == null) return null;
    return FiguraEmLinha(
      valor: total,
      rotulo: total == 1 ? 'RESULTADO' : 'RESULTADOS',
    );
  }
}
