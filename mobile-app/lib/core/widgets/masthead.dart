import 'package:flutter/material.dart';

import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';

/// O topo de uma aba: logotipo **ou** título, uma linha de estado, e o filete
/// branco de 2px que fecha o bloco.
///
/// Nasceu de um erro meu: eu pus um cabeçalho no dashboard sem olhar que o
/// `MainScreen` já tinha uma `AppBar` com a marca centralizada — o aparelho
/// mostrava **dois SIMEOPS empilhados**. A `AppBar` saiu e cada aba passou a
/// ser dona do próprio topo, que é como a referência funciona: título ancorado
/// à esquerda, no corpo da página, rolando junto com ela. Barra fixa de 56px
/// centralizada é vocabulário Material, não de jornal — e custa altura em toda
/// tela, para sempre.
///
/// A marca fica **só no dashboard**, que é a casa. Nas outras abas quem ocupa o
/// lugar é o nome da tela: repetir o logotipo em três abas é dizer três vezes
/// em que app a pessoa está.
class Masthead extends StatelessWidget {
  /// Título da aba. Quando null, desenha o logotipo (uso do dashboard).
  final String? titulo;

  /// Canto esquerdo da linha de estado — normalmente `LiveDot` + texto.
  final Widget? esquerda;

  /// Canto direito da linha de estado.
  final String? direita;

  // ⚠️ Aqui existiu um `onDireita`, que fazia o [direita] virar botão de
  // texto. Viveu uma tarde: a ação subiu para a linha de estado do cabeçalho e
  // desceu de novo para o corpo da tela, porque cabeçalho **nomeia**, corpo
  // **age** — e o de Consultas ficou igual ao de Configurações, que é o que se
  // queria. Parâmetro sem nenhum usuário não fica na peça compartilhada.

  /// Quando a tela foi empilhada: desenha seta + marca acima do título, igual
  /// ao cabeçalho da cidade.
  final VoidCallback? onVoltar;

  /// Canto direito da linha do **título**, na altura da marca — não da linha
  /// de estado logo abaixo. É onde cabe uma ação de tela inteira que não é
  /// sobre o conteúdo listado (hoje: o `?` da taxonomia, no monitoramento).
  final Widget? acao;

  const Masthead({
    super.key,
    this.titulo,
    this.esquerda,
    this.direita,
    this.onVoltar,
    this.acao,
  });

  @override
  Widget build(BuildContext context) {
    final temLinha = esquerda != null || direita != null;

    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: SIMEopsColors.white, width: 2),
        ),
      ),
      padding: EdgeInsets.fromLTRB(18, onVoltar != null ? 6 : 14, 18, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (onVoltar != null) ...[
            Row(
              children: [
                InkWell(
                  onTap: onVoltar,
                  child: const Padding(
                    padding: EdgeInsets.all(8),
                    child: Icon(Icons.arrow_back_ios_new,
                        size: 17, color: SIMEopsColors.muted),
                  ),
                ),
                const SizedBox(width: 4),
                Text.rich(
                  TextSpan(children: [
                    const TextSpan(text: 'SIME'),
                    TextSpan(
                      text: 'OPS',
                      style: TextStyle(color: SIMEopsColors.greenLight),
                    ),
                  ]),
                  style: SIMEopsType.wordmark(size: 14),
                ),
              ],
            ),
            const SizedBox(height: 9),
          ],
          // A linha do título vira `Row` **só** quando há ação — sem ela, o
          // texto continua sendo filho direto da coluna, como sempre foi.
          Builder(
            builder: (_) {
              final tituloWidget = titulo == null
                  ? Text.rich(
                      TextSpan(children: [
                        const TextSpan(text: 'SIME'),
                        TextSpan(
                          text: 'OPS',
                          style: TextStyle(color: SIMEopsColors.greenLight),
                        ),
                      ]),
                      style: SIMEopsType.wordmark(size: 25),
                    )
                  : Text(titulo!, style: SIMEopsType.sheetTitle());

              if (acao == null) return tituloWidget;
              return Row(
                children: [
                  Expanded(child: tituloWidget),
                  acao!,
                ],
              );
            },
          ),
          if (temLinha) ...[
            const SizedBox(height: 9),
            Row(
              children: [
                if (esquerda != null) esquerda!,
                const Spacer(),
                if (direita != null)
                  Text(direita!,
                      style: SIMEopsType.slug(color: SIMEopsColors.faint)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// `● ÚLTIMA HÁ 1D` — o par que vai no [Masthead.esquerda].
class LiveMark extends StatelessWidget {
  final Widget dot;
  final String label;

  const LiveMark({super.key, required this.dot, required this.label});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          dot,
          const SizedBox(width: 6),
          Text(label, style: SIMEopsType.slug(color: SIMEopsColors.faint)),
        ],
      );
}
