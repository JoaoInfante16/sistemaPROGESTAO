import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../main.dart';

// Título branded "SIMEops" (SIME branco + OPS verde) usado no AppBar.
// Fonte única pra manter consistência visual em qualquer tela que mostre
// a marca como título (main_screen, manual_search_screen em estado de
// resultados, etc.).
class SimeopsTitle extends StatelessWidget {
  const SimeopsTitle({super.key});

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        style: GoogleFonts.rajdhani(
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: 2,
          color: SIMEopsColors.white,
        ),
        children: const [
          TextSpan(text: 'SIME'),
          TextSpan(text: 'OPS', style: TextStyle(color: SIMEopsColors.greenLight)),
        ],
      ),
    );
  }
}
