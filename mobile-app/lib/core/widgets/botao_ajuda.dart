import 'package:flutter/material.dart';

import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';

/// O `?` em círculo — **um só no app inteiro**.
///
/// Existiam dois, escritos em lugares diferentes e com cinco diferenças entre
/// si: 23px contra 19px, aro `teal` contra `faint`, tinta `tealLight` contra
/// `faint`, corpo 12 contra 9.5 e um `letterSpacing` sobrando. O João viu os
/// dois na mesma sessão e pediu um só — e é o pedido certo: são o mesmo botão
/// fazendo o mesmo trabalho em duas telas, e duas cópias de uma decisão viram
/// duas decisões na primeira vez que alguém mexe em uma.
///
/// Três escolhas que este arquivo fixa, e o porquê de cada uma:
///
/// - **O `?` é Archivo, não JetBrains Mono.** O mono tem a haste angulosa e o
///   bico cortado em diagonal — é desenho de fonte de código, e num glifo
///   solto de 13px isso lê como enfeite. A grotesca é o traço reto que o João
///   pediu. É a mesma exceção do [Masthead]: mono é campo de máquina, e um `?`
///   sozinho não é campo, é um sinal.
/// - **O aro é teal, nunca `faint`.** Em `faint` o botão fica na cor que o
///   sistema inteiro usa pra dizer *desabilitado* — a versão do formulário
///   estava assim e some no navy. Teal é a cor do que se pode tocar.
/// - **`letterSpacing: 0`.** O tracking do slug (1.24) é espaço **depois** da
///   letra: num texto de um caractere ele empurra o glifo pra esquerda dentro
///   do círculo. O `?` já é assimétrico (haste alta, ponto baixo), então some
///   ainda o meio pixel de baseline no [_deslocamento].
///
/// ⚠️ **Raio zero é regra de caixa**, e este é o segundo lugar do app que abre
/// exceção (o outro são os pinos do mapa): o círculo aqui não é uma caixa, é
/// uma marca. É ele que faz o `?` virar alvo — solto, do tamanho de um número
/// ao lado de um texto, era lido como sujeira de renderização.
class BotaoAjuda extends StatelessWidget {
  final VoidCallback onTap;

  /// Diâmetro do aro. O padrão serve às duas casas de hoje; existe porque o
  /// cabeçalho do monitoramento fica ao lado da marca e o do formulário ao
  /// lado de um rótulo de 9.5px.
  final double tamanho;

  const BotaoAjuda({super.key, required this.onTap, this.tamanho = 21});

  /// Meio pixel acima da linha de base ótica. Centralizar o `?` pela caixa do
  /// glifo deixa ele visualmente caído — a haste sobe e o ponto final ocupa a
  /// parte de baixo, então a massa de tinta fica em cima.
  static const _deslocamento = Offset(0, -0.5);

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      customBorder: const CircleBorder(),
      child: Container(
        width: tamanho,
        height: tamanho,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: SIMEopsColors.teal, width: 1.2),
        ),
        child: Transform.translate(
          offset: _deslocamento,
          child: Text(
            '?',
            style: SIMEopsType.body(color: SIMEopsColors.tealLight).copyWith(
              fontSize: tamanho * 0.62,
              fontWeight: FontWeight.w600,
              height: 1,
              letterSpacing: 0,
            ),
          ),
        ),
      ),
    );
  }
}
