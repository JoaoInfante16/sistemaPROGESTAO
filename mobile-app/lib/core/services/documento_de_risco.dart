import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:pdf/pdf.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import 'api_service.dart';

/// O relatório saindo do app como **arquivo**.
///
/// **Por que arquivo e não link.** O link arrastava junto o problema do domínio
/// (hoje é um subdomínio do Render), a expiração e a dependência de o servidor
/// estar acordado. E a folha de compartilhamento do Android só oferece
/// *"Salvar em Arquivos"* / Drive quando o que se compartilha **é** um arquivo
/// — com texto, "só baixar" nem aparece. João, 13/08: *"clica em compartilhar,
/// abre o próprio sistema do Android ou iPhone para enviar para alguém ou só
/// baixar"*.
///
/// **Por que PDF e não `.html`.** Anexo `.html` é o pior dos dois mundos: o
/// Google Drive mostra o **código-fonte** em vez da página, e filtro de e-mail
/// corporativo trata como vetor de phishing.
///
/// **Por que a conversão roda aqui e não no servidor.** Chromium headless mora
/// na mesma caixa que roda o CRON 24/7, com pico de ~250MB em 512MB — um OOM
/// ali não derruba o relatório, derruba o monitoramento, que é o produto. Aqui
/// quem converte é a WebView do próprio aparelho, de graça.
///
/// 🚨 **`Printing.convertHtml` está DEPRECIADO** (desde a 5.12.0; ainda
/// presente na 5.14.3, que é a versão travada no pubspec). Por isso toda falha
/// — plataforma sem suporte, exceção, PDF vazio — **cai no link**, que é o
/// comportamento que existia antes. O botão nunca morre.
class DocumentoDeRisco {
  final ApiService _api;
  const DocumentoDeRisco(this._api);

  /// Gera o documento e entrega pra folha de compartilhamento do sistema.
  ///
  /// Devolve o que **de fato** aconteceu, pra tela poder dizer a verdade em vez
  /// de supor.
  Future<ResultadoDoCompartilhar> compartilhar({
    required List<String> cidades,
    required String estado,
    required String dateFrom,
    required String dateTo,
    String? searchId,
    Map<String, dynamic>? recorte,
    Map<String, dynamic>? analytics,
  }) async {
    final resposta = await _api.generateReport(
      cidades: cidades,
      estado: estado,
      dateFrom: dateFrom,
      dateTo: dateTo,
      searchId: searchId,
      recorte: recorte,
      analytics: analytics,
    );

    final url = resposta['reportUrl'] as String?;
    if (url == null || url.isEmpty) {
      throw Exception('O servidor não devolveu o endereço do relatório.');
    }

    final pdf = await _tentarPdf(url);
    if (pdf == null) {
      await _compartilharLink(url, cidades, estado);
      return ResultadoDoCompartilhar.link;
    }

    await Printing.sharePdf(bytes: pdf, filename: _nomeDoArquivo(cidades));
    return ResultadoDoCompartilhar.pdf;
  }

  /// Devolve os bytes do PDF, ou `null` se qualquer etapa não deu — e nunca
  /// levanta: a decisão de cair no link é desta função, não de quem chama.
  Future<Uint8List?> _tentarPdf(String url) async {
    try {
      final info = await Printing.info();
      if (!info.canConvertHtml || !info.canShare) {
        debugPrint(
          '[Documento] plataforma sem suporte '
          '(convertHtml=${info.canConvertHtml}, share=${info.canShare})',
        );
        return null;
      }

      // `formato=pdf` devolve o MESMO documento sem uma única referência
      // externa — tiles do mapa e fontes embutidos, barra de ações omitida.
      // É o que impede a WebView de fotografar antes de as imagens chegarem,
      // que é como o mapa sairia em branco.
      final resp = await http
          .get(Uri.parse('$url?formato=pdf'))
          .timeout(const Duration(seconds: 45));
      if (resp.statusCode != 200 || resp.bodyBytes.isEmpty) {
        debugPrint('[Documento] HTML veio ${resp.statusCode}');
        return null;
      }

      // Depreciada de propósito, e é o ponto do desenho: a alternativa é
      // Chromium no servidor. A queda está coberta pelo `catch` desta função.
      // ignore: deprecated_member_use
      final bytes = await Printing.convertHtml(
        html: utf8Decode(resp.bodyBytes),
        format: PdfPageFormat.a4,
      );
      if (bytes.isEmpty) {
        debugPrint('[Documento] convertHtml devolveu vazio');
        return null;
      }
      return bytes;
    } catch (e) {
      debugPrint('[Documento] PDF falhou, caindo no link: $e');
      return null;
    }
  }

  Future<void> _compartilharLink(
    String url,
    List<String> cidades,
    String estado,
  ) => Share.share(
    'SIMEops — Análise de Risco\n${cidades.join(", ")}/$estado\n\n$url',
  );

  /// O nome aparece no Drive, no WhatsApp e na caixa de entrada de quem recebe
  /// — então ele diz o que é, de onde e de quando, sem precisar abrir.
  String _nomeDoArquivo(List<String> cidades) {
    final hoje = DateTime.now();
    final data =
        '${hoje.day.toString().padLeft(2, '0')}-'
        '${hoje.month.toString().padLeft(2, '0')}-${hoje.year}';
    final onde = cidades.length > 2
        ? '${_semAcento(cidades.first)} e mais ${cidades.length - 1}'
        : cidades.map(_semAcento).join(' e ');
    return 'SIMEops - Analise de Risco - $onde - $data.pdf';
  }

  /// Nome de arquivo com acento sobrevive no Android e apanha em servidor de
  /// e-mail antigo. O documento lá dentro continua acentuado.
  static String _semAcento(String s) {
    const de = 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ';
    const para = 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC';
    final b = StringBuffer();
    for (final ch in s.split('')) {
      final i = de.indexOf(ch);
      b.write(i >= 0 ? para[i] : ch);
    }
    return b.toString();
  }
}

enum ResultadoDoCompartilhar {
  /// Saiu como arquivo, que é o caminho normal.
  pdf,

  /// A conversão não rolou e foi o link — o app segue útil, e a tela avisa.
  link,
}

/// O HTML vem em UTF-8 e `resp.body` decodifica pelo charset do cabeçalho —
/// que o Express manda certo, mas um proxy no meio pode reescrever. Ler os
/// bytes direto tira a dúvida: sem isto, `São José` chega `SÃ£o JosÃ©` **dentro
/// do PDF que vai pro cliente**.
String utf8Decode(Uint8List bytes) =>
    const Utf8Decoder(allowMalformed: true).convert(bytes);
