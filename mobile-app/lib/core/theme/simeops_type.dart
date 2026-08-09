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
///
/// **Segunda regra, de 08/08: mono maiúsculo é campo de máquina, não frase.**
/// Rótulo, contagem, slug e eixo — sim. Frase que alguém precisa *ler* — não.
/// Caixa alta destrói o formato da palavra, que é como se lê rápido; mono a 9px
/// com entrelinha larga é ótimo para coluna alinhada e péssimo para prosa. O
/// app tinha as ressalvas metodológicas (*"citação na matéria, não é onde o
/// fato ocorreu"*, *"não sai e-mail automático"*) escritas assim — ou seja, o
/// texto que sustenta a honestidade do produto era o mais difícil de ler da
/// tela. Prosa vai em [note], que é Archivo em caixa de sentença.
///
/// **Escala mono:** 9.5 (rótulo) · 11 (mono legível) · 13 (botão) · [figure].
/// Havia 8.5, 9, 9.5, 10, 10.5 e 11 convivendo — meio pixel de diferença
/// ninguém enxerga, mas desalinha coluna e faz o peso óptico oscilar.
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
  ///
  /// 30, igual ao [headlineUrgent]: eram 29 e 30, dois tamanhos a um pixel de
  /// distância fazendo trabalhos diferentes — ninguém distingue, e a promessa
  /// de que urgente é "30% maior" só valia contra a manchete normal.
  static TextStyle title({Color? color}) => GoogleFonts.archivo(
        fontSize: 30,
        fontWeight: FontWeight.w700,
        height: 1.03,
        letterSpacing: -0.6,
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

  /// Aba de cidade dentro do grupo, e mono legível em geral (linha de cidade
  /// quieta, marcas do histórico). 11 é o degrau em que mono deixa de ser
  /// rótulo e vira texto que se lê sem esforço.
  static TextStyle placeTab({required bool active, Color? color}) =>
      GoogleFonts.jetBrainsMono(
        fontSize: 11,
        letterSpacing: 1.5,
        color: color ??
            (active ? SIMEopsColors.white : SIMEopsColors.faint),
      );

  /// Linha de etapa da consulta (`Descartar o que não é ocorrência`).
  ///
  /// Mono 11 como o [placeTab], mas com o **tracking de rótulo desligado**:
  /// aqui é frase, não etiqueta. 1.5px entre letras num texto de 30 caracteres
  /// afasta as palavras umas das outras e obriga a soletrar.
  static TextStyle etapa({Color? color}) => GoogleFonts.jetBrainsMono(
        fontSize: 11,
        letterSpacing: 0.44,
        color: color ?? SIMEopsColors.faint,
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

  /// **Prosa**: ressalva metodológica, explicação de campo, mensagem de erro,
  /// rodapé que alguém precisa ler de verdade.
  ///
  /// Era mono 9 em caixa alta. Virou Archivo em caixa de sentença porque essas
  /// frases são o que separa o produto de um agregador irresponsável — e
  /// estavam escritas no estilo mais lento de ler do app inteiro. Ver a nota
  /// no topo do arquivo.
  ///
  /// Tinta `muted` (8.0:1), não `faint`: prosa não é metadado.
  static TextStyle note({Color? color}) => GoogleFonts.archivo(
        fontSize: 13,
        height: 1.55,
        color: color ?? SIMEopsColors.muted,
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
        fontSize: 11,
        letterSpacing: 1.6,
        color: active ? SIMEopsColors.greenLight : SIMEopsColors.faint,
      );

  /// Linha sob o logotipo ("MONITORAMENTO DE OCORRÊNCIAS · 24 HORAS").
  /// É acessório de marca, não prosa — por isso continua mono em caixa alta,
  /// e é o **único** bloco de várias linhas que pode ser assim.
  static TextStyle tagline() => GoogleFonts.jetBrainsMono(
        fontSize: 9.5,
        height: 1.7,
        letterSpacing: 1.8,
        color: SIMEopsColors.faint,
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
