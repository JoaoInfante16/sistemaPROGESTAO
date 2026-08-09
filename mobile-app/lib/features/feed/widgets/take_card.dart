import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/models/news_item.dart';
import '../../../core/theme/simeops_colors.dart';
import '../../../core/theme/simeops_type.dart';
import '../../../core/utils/category_colors.dart';
import '../../../core/widgets/cat_chip.dart';
import 'news_detail_sheet.dart';

/// A matéria no fio — substitui o `NewsCard` de caixa.
///
/// O redesign trocou **caixa por filete**: nada aqui tem borda, fundo ou canto
/// arredondado. A separação é um filete de 1px e o espaço em volta. Card com
/// borda empilhado 18 vezes vira lista de caixas; matéria separada por filete
/// vira jornal, que é o que o produto é.
///
/// Anatomia (de cima pra baixo):
///   slug       quadrado de cor + CATEGORIA · local · hora   (mono, 9.5)
///   manchete   Archivo 23 (30 quando urgente), **2 linhas**
///   lide       resumo, Archivo 14.5 em tinta muted, 2 linhas fechado
///   créditos   veículo · N FONTES ............... OFICIAL
///
/// **Forma fixa (08/08).** Antes eram `maxLines: 3` na manchete *e* na lide:
/// um item podia ter 6 linhas de texto e outro 2. Numa lista de 18, altura
/// que oscila desse jeito mata o ritmo vertical — e o ritmo é a única razão de
/// uma lista ser *varrida* em vez de lida. Medindo: Archivo 23 em 376px úteis
/// dá ~32 caracteres por linha, e o Filter2 escreve manchete de 70. Se uma
/// manchete precisa de 3 linhas, o problema é a manchete, não o layout.
class TakeCard extends StatefulWidget {
  final NewsItem news;

  /// Chamado ao abrir (não a cada toque): é o gancho de "marcar como lida".
  final VoidCallback? onOpen;
  final VoidCallback? onToggleFavorite;

  /// A lista já está agrupada por data (o `GroupHeader` diz `HOJE · 04 AGO`),
  /// então o item mostra só a hora. Nos resultados da busca os grupos são
  /// baldes ("região metropolitana", "antes de 5 jul") e a data volta a ser
  /// necessária no item.
  final bool groupedByDate;

  /// Ocorrência grave e recente. O sinal é **peso**, não cor: filete branco na
  /// margem e manchete 30% maior. Vermelho não pode fazer dois papéis — ele já
  /// é a categoria Segurança, e "URGENTE" vermelho ao lado de "SEGURANÇA"
  /// vermelho lê como um rótulo só.
  ///
  /// Raro por construção (ver [isUrgent]): sinal que aparece sempre não é
  /// sinal, é ruído — foi o que aconteceu com o "NOVA" no card antigo.
  final bool urgent;

  const TakeCard({
    super.key,
    required this.news,
    this.onOpen,
    this.onToggleFavorite,
    this.groupedByDate = false,
    this.urgent = false,
  });

  /// Regra da urgência: categoria Segurança **e** publicada nas últimas 6h.
  /// Num dia de 18 itens isso dá 1 ou 2 — que é o ponto.
  static bool isUrgent(NewsItem n) {
    if (n.categoriaGrupo != 'seguranca') return false;
    return DateTime.now().difference(n.createdAt).inHours < 6;
  }

  @override
  State<TakeCard> createState() => _TakeCardState();
}

class _TakeCardState extends State<TakeCard> {
  // A sanfona (matéria expandindo no lugar) viveu algumas horas em 09/08 e foi
  // descartada pelo João com um argumento melhor que o meu.
  //
  // Meu raciocínio: resumo longo precisa de um lugar, logo expande. O dele
  // inverte a premissa: **se o parágrafo cabe inteiro, não precisa de lugar
  // nenhum.** E aí o toque passa a ter UM significado — abrir a fonte — em vez
  // de dois, "ler o resto" ou "abrir o artigo", que o usuário não conseguia
  // distinguir antes de tocar.
  //
  // O que torna isso possível é o teto de 195 caracteres no `resumo`, cortado
  // em fim de frase pelo Filter2. Ver `cortarNaFrase` em `filter2GPT.ts`.

  NewsItem get news => widget.news;

  /// O carimbo da slug: hora quando ela existe, data quando é o que há, e
  /// **nada** quando não há nem uma nem outra.
  ///
  /// 🚨 Aqui morava um bug que aparecia em **100% dos itens**: o carimbo lia a
  /// hora de `dataOcorrencia`, e essa coluna é `DATE` no Postgres — ou seja,
  /// sempre meia-noite. Toda matéria do app exibia `00:00`, na linha mais
  /// disputada do card, dizendo nada. Pego pelo João olhando o aparelho.
  ///
  /// A hora agora vem de `hora_publicacao` (migration 030), que é a que o
  /// veículo imprimiu. Quando o artigo não informa, o campo some — inventar
  /// meia-noite é pior do que não carimbar.
  String get _stamp {
    final hora = news.horaPublicacao;
    if (widget.groupedByDate) return hora ?? '';

    final d = news.dataOcorrencia;
    final data =
        '${d.day.toString().padLeft(2, '0')}/'
        '${d.month.toString().padLeft(2, '0')}';
    return hora != null ? '$data · $hora' : data;
  }

  /// Cidade · bairro. É o campo elástico da slug: **trunca, não quebra**.
  String get _place {
    final parts = <String>[news.cidade];
    if (news.bairro != null && news.bairro!.isNotEmpty) parts.add(news.bairro!);
    return parts.join(' · ');
  }

  static String _host(NewsSource s) {
    final name = s.sourceName;
    if (name != null && name.isNotEmpty) return name;
    try {
      return Uri.parse(s.url).host.replaceFirst('www.', '');
    } catch (_) {
      return s.url;
    }
  }

  String? get _outlet =>
      news.sources.isEmpty ? null : _host(news.sources.first);

  bool get _isIndicador => news.natureza == 'estatistica';

  /// Toque na matéria: marca lida e abre a folha.
  ///
  /// Chegou a ir **direto pra URL externa** por algumas horas em 09/08, e o
  /// João barrou: jogar o usuário pra fora do app num toque é decisão grande
  /// demais pra um toque, e a folha ainda tem o que dizer — rua, tipo granular,
  /// data por extenso e todas as fontes. Ver `NewsDetailSheet`.
  void _abrir() {
    widget.onOpen?.call();
    NewsDetailSheet.show(context, news);
  }

  Future<void> _abrirFonte(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('[TakeCard] falha ao abrir $url — $e');
    }
  }

  /// `3 FONTES` é tocável e lista as outras.
  ///
  /// Sem isso, tirar a sanfona perderia as fontes secundárias: o toque no card
  /// abre só a primeira. É o caso raro (a maioria dos itens tem uma fonte só) e
  /// por isso mora atrás de um toque no próprio número, que já estava na tela.
  void _listarFontes() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: SIMEopsColors.navy,
      shape: const RoundedRectangleBorder(),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: SIMEopsColors.white, width: 2),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
              child: Text(
                '${news.sources.length} veículos cobriram',
                style: SIMEopsType.title().copyWith(fontSize: 22),
              ),
            ),
            _Fontes(
              sources: news.sources,
              nome: _host,
              onAbrir: (url) async {
                Navigator.pop(context);
                await _abrirFonte(url);
              },
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cat = _isIndicador
        ? 'institucional'
        : (news.categoriaGrupo ?? 'institucional');
    final catLabel = _isIndicador
        ? 'INDICADOR'
        : categoryLabel(cat).toUpperCase();

    // Lida recua sem ícone e sem caixa: manchete perde peso e vai pra tinta
    // fraca. Não precisa de "já li" escrito — o contraste já diz.
    final read = !news.isUnread;
    final headlineStyle = widget.urgent
        ? SIMEopsType.headlineUrgent()
        : SIMEopsType.headline(color: read ? SIMEopsColors.faint : null);

    return Slidable(
      startActionPane: ActionPane(
        motion: const ScrollMotion(),
        extentRatio: 0.25,
        children: [
          SlidableAction(
            onPressed: (_) => widget.onToggleFavorite?.call(),
            backgroundColor: news.isFavorite
                ? SIMEopsColors.navyLight
                : SIMEopsColors.bookmark,
            foregroundColor: news.isFavorite
                ? SIMEopsColors.muted
                : Colors.white,
            icon: news.isFavorite ? Icons.bookmark_remove : Icons.bookmark_add,
            label: news.isFavorite ? 'Remover' : 'Salvar',
          ),
        ],
      ),
      child: InkWell(
        onTap: _abrir,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Filete de urgência, na margem viva da página.
              SizedBox(
                width: 2,
                child: widget.urgent
                    ? const ColoredBox(color: SIMEopsColors.white)
                    : const SizedBox.shrink(),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 17, 18, 19),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _Slug(
                        categoria: cat,
                        label: catLabel,
                        place: _place,
                        stamp: _stamp,
                      ),
                      const SizedBox(height: 9),
                      Text(
                        news.headline,
                        style: headlineStyle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (news.resumo.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        // INTEIRO, sem "ler mais". `maxLines: 5` é só rede de
                        // segurança pro texto antigo (escrito antes do teto de
                        // 195) e pro pior caso tipográfico — não é o normal.
                        Text(
                          news.resumo,
                          style: SIMEopsType.lead(
                            color: read ? SIMEopsColors.faint : null,
                          ),
                          maxLines: 5,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: 11),
                      _Credits(
                        outlet: _outlet,
                        sourceCount: news.sources.length,
                        official: news.hasOfficialSource,
                        onVerFontes: news.sources.length > 1
                            ? _listarFontes
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Slug extends StatelessWidget {
  final String categoria;
  final String label;
  final String place;
  final String stamp;

  const _Slug({
    required this.categoria,
    required this.label,
    required this.place,
    required this.stamp,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // O quadrado carrega a cor; a palavra fica em tinta legível.
        // Cinco categorias escritas em cinco matizes a 9.5px sobre navy viram
        // cinco borrões — fundo escuro come diferença de saturação.
        CatChip(categoria: categoria),
        const SizedBox(width: 9),
        Text(label, style: SIMEopsType.slug()),
        const SizedBox(width: 9),
        // Elástico: trunca. Se quebrasse, a hora pularia de linha e o ritmo
        // vertical da lista morreria — e é o ritmo que faz a varredura rápida.
        Expanded(
          child: Text(
            place,
            style: SIMEopsType.slug(color: SIMEopsColors.faint),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        // Some inteiro quando não há hora nem data pra dizer — inclusive o
        // espaçador, senão sobra um buraco à direita.
        if (stamp.isNotEmpty) ...[
          const SizedBox(width: 9),
          Text(stamp, style: SIMEopsType.slug(color: SIMEopsColors.faint)),
        ],
      ],
    );
  }
}

/// Quem contou, e se é fonte oficial.
///
/// Era a faixa mais barulhenta e a menos útil do card: até quatro fichas em
/// três matizes — veículo em teal, `OFICIAL` em verde, `REGIÃO` em cinza e
/// `3 FONTES` em verde-claro. Dois verdes diferentes, significando coisas
/// diferentes, a 9.5px. E quebrava a regra que o projeto já tinha escrito:
/// **verde é da interface, nunca do conteúdo**.
///
/// Agora: veículo e contagem são um fato só, em tinta única; `OFICIAL` é o
/// **único** token colorido, porque é o único que muda como se lê o item.
/// `REGIÃO` saiu — a slug logo acima já nomeia a cidade, era a mesma
/// informação dita duas vezes.
class _Credits extends StatelessWidget {
  final String? outlet;
  final int sourceCount;
  final bool official;

  /// Só quando há mais de uma fonte: abre a lista das outras.
  final VoidCallback? onVerFontes;

  const _Credits({
    required this.outlet,
    required this.sourceCount,
    required this.official,
    this.onVerFontes,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (outlet != null)
          Flexible(
            child: Text(
              outlet!,
              style: SIMEopsType.credit(color: SIMEopsColors.faint),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        // "1 FONTE" não aparece: era o caso chato e estava em ~100% dos itens, e
        // rótulo que aparece sempre não informa. "3 FONTES" é sinal real de
        // credibilidade — três veículos cobriram o mesmo fato — e era invisível.
        // Aqui ele também é a porta pras outras duas.
        if (sourceCount > 1) ...[
          Text(' · ', style: SIMEopsType.credit(color: SIMEopsColors.faint)),
          InkWell(
            onTap: onVerFontes,
            child: Text(
              '$sourceCount FONTES',
              style: SIMEopsType.credit(color: SIMEopsColors.tealLight),
            ),
          ),
        ],
        const Spacer(),
        if (official)
          Text(
            'OFICIAL',
            style: SIMEopsType.credit(color: SIMEopsColors.green),
          ),
      ],
    );
  }
}

/// As fontes, abertas junto com a sanfona.
///
/// Abre no **navegador externo**, não em WebView nem Custom Tab: o conteúdo é
/// de terceiros e o app não deve emoldurar matéria alheia como se fosse dele.
class _Fontes extends StatelessWidget {
  final List<NewsSource> sources;
  final String Function(NewsSource) nome;
  final Future<void> Function(String) onAbrir;

  const _Fontes({
    required this.sources,
    required this.nome,
    required this.onAbrir,
  });

  @override
  Widget build(BuildContext context) {
    if (sources.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(color: SIMEopsColors.rule, height: 1, thickness: 1),
        const SizedBox(height: 4),
        for (final s in sources)
          InkWell(
            onTap: () => onAbrir(s.url),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 9),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      nome(s),
                      style: SIMEopsType.credit(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 9),
                  Text(
                    'LER →',
                    style: SIMEopsType.credit(color: SIMEopsColors.tealLight),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// Divisor de data entre blocos de matéria: "HOJE · 04 AGO ────────".
class Dateline extends StatelessWidget {
  final String label;

  const Dateline(this.label, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
      child: Row(
        children: [
          Text(label.toUpperCase(), style: SIMEopsType.dateline()),
          const SizedBox(width: 11),
          const Expanded(child: Divider(color: SIMEopsColors.rule, height: 1)),
        ],
      ),
    );
  }
}

/// Filete entre matérias.
class TakeRule extends StatelessWidget {
  const TakeRule({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(horizontal: 18),
    child: Divider(color: SIMEopsColors.rule, height: 1, thickness: 1),
  );
}

// ⚠️ Aqui morava o `EndMark`, a marca de fim de lista — primeiro como "— 30 —"
// (fim de matéria de redação), depois como "FIM". João matou as duas: *"não
// precisa escrever fim também né"*. E é verdade: a lista acabando já é a
// evidência de que acabou, e sete telas carimbavam a mesma palavra pra dizer o
// que a rolagem diz sozinha. Sobrou o ar do rodapé em cada uma delas.
