import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'simeops_colors.dart';

/// Tipografia do SIMEops — linguagem de fio de agência.
///
/// Três famílias, cada uma com UM trabalho:
///   Archivo        manchete e corpo. Grotesca sólida, aguenta corpo grande
///                  com entrelinha apertada sem virar decoração.
///   JetBrains Mono todo metadado (slug, hora, contadores, rótulo de eixo).
///                  Avanço fixo = coluna alinhada = leitura em varredura.
///   Rajdhani       SÓ a marca SIMEOPS. É o logotipo, não uma fonte de texto.
///
/// Exo 2 saiu do corpo: é geométrica techy, e techy é exatamente o lugar-comum
/// de que o redesign está fugindo. Ela some conforme as telas migram.
///
/// Regra que atravessa o arquivo inteiro: **texto nunca veste a cor da série.**
/// Rótulo de categoria fica em tinta legível e a cor mora num quadrado de 7px
/// ao lado. Cinco categorias escritas em cinco matizes a 9.5px sobre navy
/// viram cinco borrões — o escuro come a diferença de saturação.
class SIMEopsType {
  const SIMEopsType._();

  // ─────────── manchete ───────────

  /// Manchete de matéria no feed.
  static TextStyle headline({Color? color}) => GoogleFonts.archivo(
        fontSize: 23,
        fontWeight: FontWeight.w700,
        height: 1.13,
        letterSpacing: -0.35,
        color: color ?? SIMEopsColors.white,
      );

  /// Matéria urgente. 30 contra 23 são 30% de diferença — isso se enxerga.
  /// A urgência mora aqui e no filete branco da margem, nunca numa palavra
  /// vermelha: vermelho é da categoria Segurança e não pode fazer dois papéis.
  static TextStyle headlineUrgent() => headline().copyWith(fontSize: 30);

  /// Título de tela (nome da cidade, "Nova consulta").
  static TextStyle title({Color? color}) => GoogleFonts.archivo(
        fontSize: 29,
        fontWeight: FontWeight.w700,
        height: 1.03,
        letterSpacing: -0.58,
        color: color ?? SIMEopsColors.white,
      );

  /// Título encolhido, quando o cabeçalho recolhe na rolagem.
  static TextStyle titleCompact() => GoogleFonts.archivo(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        height: 1.1,
        letterSpacing: -0.13,
        color: SIMEopsColors.white,
      );

  /// Cidade no dashboard.
  static TextStyle cityHeadline() => GoogleFonts.archivo(
        fontSize: 27,
        fontWeight: FontWeight.w700,
        height: 1.05,
        letterSpacing: -0.54,
        color: SIMEopsColors.white,
      );

  /// Número-herói do relatório.
  static TextStyle hero() => GoogleFonts.archivo(
        fontSize: 52,
        fontWeight: FontWeight.w700,
        height: 1,
        letterSpacing: -1.82,
        color: SIMEopsColors.white,
      );

  // ─────────── corpo ───────────

  /// Lide da matéria e resumo de cidade.
  static TextStyle lead({Color? color}) => GoogleFonts.archivo(
        fontSize: 14.5,
        height: 1.52,
        color: color ?? SIMEopsColors.muted,
      );

  /// Texto de interface (item de config, descrição de campo).
  static TextStyle body({Color? color}) => GoogleFonts.archivo(
        fontSize: 16,
        height: 1.4,
        color: color ?? SIMEopsColors.white,
      );

  /// Aba de caderno (Notícias / Relatório).
  static TextStyle tab({required bool active}) => GoogleFonts.archivo(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.18,
        color: active ? SIMEopsColors.white : SIMEopsColors.faint,
      );

  // ─────────── metadado (mono) ───────────

  /// Slug da matéria: categoria · local · hora.
  static TextStyle slug({Color? color}) => GoogleFonts.jetBrainsMono(
        fontSize: 9.5,
        letterSpacing: 1.24,
        color: color ?? SIMEopsColors.muted,
      );

  /// Divisor de data ("HOJE · 04 AGO") e cabeçalho de seção.
  static TextStyle dateline({Color? color}) => GoogleFonts.jetBrainsMono(
        fontSize: 9.5,
        letterSpacing: 2.09,
        color: color ?? SIMEopsColors.muted,
      );

  /// Veículo e contador de fontes.
  static TextStyle credit({Color? color}) => GoogleFonts.jetBrainsMono(
        fontSize: 9.5,
        letterSpacing: 0.57,
        color: color ?? SIMEopsColors.tealLight,
      );

  /// Aba de cidade dentro do grupo.
  static TextStyle placeTab({required bool active}) => GoogleFonts.jetBrainsMono(
        fontSize: 10,
        letterSpacing: 1.5,
        color: active ? SIMEopsColors.white : SIMEopsColors.faint,
      );

  /// Rótulo de campo de formulário.
  static TextStyle fieldLabel() => GoogleFonts.jetBrainsMono(
        fontSize: 9.5,
        letterSpacing: 1.9,
        color: SIMEopsColors.muted,
      );

  /// Número de contagem (categoria no dashboard, valor de ranking).
  /// Fica em tinta branca — a cor da categoria mora no quadrado ao lado.
  static TextStyle figure({double size = 21, Color? color}) =>
      GoogleFonts.jetBrainsMono(
        fontSize: size,
        height: 1,
        color: color ?? SIMEopsColors.white,
      );

  /// Nota de rodapé de gráfico, ressalva metodológica.
  static TextStyle note({Color? color}) => GoogleFonts.jetBrainsMono(
        fontSize: 9,
        height: 1.7,
        letterSpacing: 0.54,
        color: color ?? SIMEopsColors.faint,
      );

  /// Texto de botão de ação.
  static TextStyle action({Color? color}) => GoogleFonts.jetBrainsMono(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        letterSpacing: 2.86,
        color: color ?? SIMEopsColors.white,
      );

  /// Item da navegação inferior.
  static TextStyle navLabel({required bool active}) =>
      GoogleFonts.jetBrainsMono(
        fontSize: 10,
        letterSpacing: 1.6,
        color: active ? SIMEopsColors.greenLight : SIMEopsColors.faint,
      );

  // ─────────── marca ───────────

  /// Só o logotipo. Rajdhani não deve aparecer em mais nenhum lugar.
  static TextStyle wordmark({double size = 25}) => GoogleFonts.rajdhani(
        fontSize: size,
        fontWeight: FontWeight.w700,
        height: 1,
        letterSpacing: size * 0.1,
        color: SIMEopsColors.white,
      );
}
