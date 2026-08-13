import 'dart:math';
import 'package:flutter/material.dart';

import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';

/// A abertura do app — o funil, em movimento.
///
/// **Por que existe.** A tela de abertura era a marca parada num fundo navy, e
/// antes disso o app tinha uma grade animada de fundo em duas telas. As duas
/// coisas estavam erradas por motivos opostos: a grade animava o tempo todo sem
/// dizer nada (*"não tem personalidade, não é bonito, não é tecnológico"* —
/// João, 13/08), e a marca parada não dizia nada também, só que em silêncio.
///
/// **O que ela mostra.** O que o SIMEops faz, e não uma decoração: manchetes
/// sobem, quase todas se dissolvem no caminho, e de vez em quando **uma acende**
/// e segura uma batida antes de sair. É o funil — Filter0 → Filter1 → Jina →
/// Filter2 → dedup — como movimento. O contador embaixo (`322 LIDAS · 7
/// RETIDAS`) fecha a leitura pra quem não pegou pela imagem.
///
/// **Por que é o único lugar com animação no app.** Porque aqui a espera é
/// real e não dá pra desenhar silhueta: o app ainda não sabe se vai abrir o
/// login, o feed ou a troca de senha, então a forma de qualquer uma delas seria
/// chute. Em todo o resto, quem espera é o [Esqueleto].
///
/// **Custo.** Um `AnimationController` só, sem `Ticker` por linha; a lista de
/// manchetes é fixa e as posições saem de uma função do tempo, então não há
/// alocação por quadro. Ela vive o que a abertura viver — segundos, não a
/// sessão inteira.
class Abertura extends StatefulWidget {
  const Abertura({super.key});

  @override
  State<Abertura> createState() => _AberturaState();
}

class _AberturaState extends State<Abertura>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  /// Manchetes de mentira, no registro do produto.
  ///
  /// 🚨 **Nenhuma delas cita cidade, bairro, rua ou nome.** Isto é tela de
  /// abertura: aparece antes de qualquer login, para qualquer pessoa que pegue
  /// o aparelho. Um texto plausível demais aqui vira vazamento de aparência —
  /// alguém lê "homicídio no Kobrasol" e não tem como saber que é enfeite.
  static const _linhas = <String>[
    'roubo a estabelecimento comercial',
    'apreensão de entorpecentes em rodovia',
    'furto de veículo em via pública',
    'operação integrada com apoio aéreo',
    'balanço trimestral aponta queda',
    'tentativa de furto em residência',
    'receptação de peças automotivas',
    'estelionato por aplicativo de mensagem',
    'colisão sem vítimas em cruzamento',
    'homicídio sob investigação',
    'tráfico em ponto de venda mapeado',
    'audiência pública sobre segurança',
    'ameaça registrada em delegacia',
    'lesão corporal em via movimentada',
    'apreensão de arma de fogo irregular',
  ];

  /// Quais índices **sobrevivem** ao funil. Um a cada cinco, mais ou menos, que
  /// é a ordem de grandeza real: o Filter0 sozinho descarta a maior parte.
  static const _retidas = {3, 9, 14};

  static const _duracao = Duration(seconds: 6);

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: _duracao)..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SIMEopsColors.navy,
      body: LayoutBuilder(
        builder: (context, restricao) {
          final alturaUtil = restricao.maxHeight;
          return AnimatedBuilder(
            animation: _c,
            builder: (context, _) => Stack(
              alignment: Alignment.center,
              children: [
                // As manchetes, por baixo.
                ..._linhas.asMap().entries.map(
                  (e) => _Manchete(
                    texto: e.value,
                    fase: _fase(e.key),
                    retida: _retidas.contains(e.key),
                    alturaUtil: alturaUtil,
                    largura: restricao.maxWidth,
                  ),
                ),

                // A marca, por cima, imóvel. Ela é a única coisa que não se
                // move — é o ponto fixo que faz o resto parecer fluxo.
                Container(
                  color: SIMEopsColors.navy.withValues(alpha: 0.86),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 26,
                    vertical: 14,
                  ),
                  child: Text.rich(
                    const TextSpan(
                      children: [
                        TextSpan(text: 'SIME'),
                        TextSpan(
                          text: 'OPS',
                          style: TextStyle(color: SIMEopsColors.greenLight),
                        ),
                      ],
                    ),
                    style: SIMEopsType.wordmark(size: 25),
                  ),
                ),

                // O contador — a leitura escrita, pra quem não pegou pela
                // imagem. Sobe junto com o tempo, e reinicia com o ciclo.
                Positioned(
                  bottom: 54,
                  child: Column(
                    children: [
                      SizedBox(
                        width: 148,
                        child: Divider(
                          color: SIMEopsColors.rule,
                          height: 1,
                        ),
                      ),
                      const SizedBox(height: 11),
                      Text(
                        '$_lidas LIDAS · $_retidasAgora RETIDAS',
                        style: SIMEopsType.slug(color: SIMEopsColors.faint),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  /// Posição de uma linha no ciclo: 0 = entrando por baixo, 1 = saiu por cima.
  ///
  /// Cada linha entra defasada da anterior, e o `% 1` faz o ciclo emendar sem
  /// costura — quando a primeira sai, ela já voltou por baixo.
  double _fase(int i) => (_c.value + i / _linhas.length) % 1.0;

  /// Contadores que sobem com o ciclo. Não são dados reais — e não fingem ser:
  /// o rótulo diz LIDAS/RETIDAS, que é o que o pipeline faz, sem carimbar
  /// cidade nem período.
  int get _lidas => 40 + (_c.value * 290).round();
  int get _retidasAgora => 1 + (_c.value * 8).round();
}

/// Uma manchete subindo.
///
/// Ela nasce fraca embaixo, ganha um pouco de tinta no meio do caminho e some
/// antes do topo — **exceto** se for retida: aí acende no amarelinho, fica
/// legível de verdade e segura por um trecho do percurso.
class _Manchete extends StatelessWidget {
  final String texto;
  final double fase;
  final bool retida;
  final double alturaUtil;
  final double largura;

  const _Manchete({
    required this.texto,
    required this.fase,
    required this.retida,
    required this.alturaUtil,
    required this.largura,
  });

  @override
  Widget build(BuildContext context) {
    // De baixo (fase 0) para cima (fase 1), com folga fora da tela nas duas
    // pontas pra ninguém aparecer ou sumir no meio do nada.
    final y = alturaUtil * (1.08 - fase * 1.16);

    // A curva da tinta: sobe até o meio do percurso e cai. `sin(pi * fase)` dá
    // exatamente isso, com 0 nas duas pontas.
    final curva = sin(pi * fase);

    // A retida acende mais e segura: o expoente menor alarga o platô da curva.
    final opacidade = retida
        ? (0.20 + 0.80 * pow(curva, 0.45)).toDouble()
        : (0.05 + 0.32 * curva).toDouble();

    // Quem passa reto fica levemente comprimida contra a margem; a retida
    // ocupa o centro. É a diferença entre "ruído de fundo" e "isto aqui".
    final recuo = retida ? 0.0 : (largura * 0.06) * (1 - curva);

    return Positioned(
      top: y,
      left: 18 + recuo,
      right: 18 + recuo,
      child: Opacity(
        opacity: opacidade.clamp(0.0, 1.0),
        child: Row(
          mainAxisAlignment: retida
              ? MainAxisAlignment.center
              : MainAxisAlignment.start,
          children: [
            if (retida) ...[
              Container(
                width: 5,
                height: 5,
                color: SIMEopsColors.greenLight,
              ),
              const SizedBox(width: 9),
            ],
            Flexible(
              child: Text(
                retida ? texto.toUpperCase() : texto,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: retida ? TextAlign.center : TextAlign.left,
                style: SIMEopsType.slug(
                  color: retida
                      ? SIMEopsColors.greenLight
                      : SIMEopsColors.muted,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
