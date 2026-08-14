import 'package:share_plus/share_plus.dart';

import 'api_service.dart';

/// O relatório saindo do app — **como link**, e a página que abre traz o PDF.
///
/// ## Por que link, e não o arquivo pronto
///
/// Isto já foi arquivo, por dois dias, e voltou. Vale a história inteira porque
/// a ideia é sedutora e vai reaparecer:
///
/// O botão gerava o PDF **no próprio aparelho**, convertendo o mesmo HTML pela
/// WebView (`Printing.convertHtml`). Funcionava — em bancada. No A57, que é o
/// piso do parque de aparelhos, a conversão **não terminava em 90 segundos** e
/// caía no link mesmo assim, depois de um spinner mudo.
///
/// A causa está medida: o documento tem **906 KB**, e **797 KB (88%) são os 12
/// tiles do mapa em `@2x`**. Todo o resto — texto, tabelas e os gráficos em SVG
/// — são 22 KB. O documento é um mapa com um relatório em volta, e é isso que
/// não passa por uma WebView de aparelho modesto num tempo aceitável.
///
/// 🚨 **A lição não é "otimizar o mapa".** Mesmo que caísse pra 30s, seriam 30
/// segundos de espera para uma ação que o usuário espera ser instantânea. Um
/// link chega em ~1s, e quem quer o arquivo aperta **Baixar PDF** dentro da
/// página — que no Android abre o diálogo nativo de impressão: mesma engine,
/// mas com barra de progresso do sistema e botão de cancelar, em vez de um
/// spinner do app sem previsão nenhuma.
///
/// ⚠️ Junto com o arquivo saíram as dependências `printing` e `pdf` do pubspec.
/// Se alguém quiser tentar de novo, o caminho está no DEV_LOG de 13-14/08, com
/// as três armadilhas já mapeadas: `canConvertHtml` é sempre `false` no Android
/// (a flag mente, a capacidade existe), não há timeout em lugar nenhum do
/// plugin, e `onPageFinished` não espera a rede — por isso as fontes e os tiles
/// precisam estar embutidos.
///
/// ## Por que a página fica no backend, e não no painel admin
///
/// Ela morou no painel até 12/08, e sair de lá foi conserto, não gosto: eram
/// **dois renderizadores do mesmo documento**, e foi ali que o `cidade:
/// cidades.first` fez o texto do compartilhamento dizer "Florianópolis, São
/// José e Palhoça" enquanto a página entregava Florianópolis sozinha.
class DocumentoDeRisco {
  final ApiService _api;
  const DocumentoDeRisco(this._api);

  /// Manda o backend montar o documento e joga o endereço na folha do sistema.
  Future<void> compartilhar({
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

    // As cidades vão no texto porque o destinatário vê isto antes de abrir — e
    // porque foi exatamente aqui que o texto e o documento já discordaram.
    await Share.share(
      'SIMEops — Análise de Risco\n${cidades.join(", ")}/$estado\n\n$url',
    );
  }
}
