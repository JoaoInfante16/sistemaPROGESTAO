import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/models/assunto.dart';
import '../../../core/theme/simeops_colors.dart';

// Seletor de ASSUNTOS da busca manual.
//
// A tese: o índice do Google tem teto de ~60-70 itens POR PERGUNTA, e não há
// parâmetro que mude isso (medido em 01-02/08). Pedir mais página do mesmo
// assunto não traz nada; perguntar outra coisa traz. Então "quantos assuntos"
// é a alavanca de volume — e o preço dela é tempo, ~47s por assunto.
//
// Por isso cada preset mostra a própria conta (quantos assuntos, quantos
// minutos) em vez de só um nome: "Essencial" sozinho não informa nada, e a
// escolha só é honesta se o custo estiver na frente de quem escolhe.

/// Segundos por assunto numa janela de 30 dias.
///
/// RECALIBRADO em 03/08 com a primeira busca de lista completa, que é o caso
/// que este número existe pra prever:
///
/// | medição | assuntos | dias | tempo | → por assunto |
/// |---|---|---|---|---|
/// | Campo Grande (02/08) | 5 | 60 | 5min31 | 47s |
/// | **Goiânia (03/08)** | **17** | **34** | **~11min** | **36s** |
///
/// O 47 vinha de uma busca de 5 assuntos e superestimava em ~27% no caso de 17
/// — sublinear, porque o estágio 1 dispara as queries em paralelo e só os
/// estágios 4 e 5 crescem com o volume.
///
/// A medição de 03/08 já inclui a migration 027 (OpenAI 5 → 20 concorrentes),
/// que cortou o Filter2 de ~12min para 188s. Com a 028 (Jina 10 → 20) o estágio
/// 4 deve cair de 327s para ~165s, e este número tende a ~28 — **a confirmar
/// medindo**, não ajustar por dedução.
///
/// Errar pra cima é de propósito: prometer 11 e entregar 9 é melhor que o
/// contrário.
const _segundosPorAssunto = 36;

/// Estimativa de duração da busca.
///
/// Escala com a RAIZ do período, e não linearmente, porque é assim que os tetos
/// de coleta do backend escalam (`manualSearchCaps.ts`): o índice de notícias
/// rareia conforme se volta no tempo, então dobrar o período não dobra o que há
/// pra achar. Cidade grande rende mais que cidade pequena, então isto é uma
/// ordem de grandeza — o rótulo diz "~".
Duration estimativaBusca(int quantosAssuntos, int periodoDias) {
  if (quantosAssuntos <= 0) return Duration.zero;
  final fator = (periodoDias / 30).clamp(0.2, 12.0);
  final segundos =
      quantosAssuntos * _segundosPorAssunto * _raiz(fator);
  return Duration(seconds: segundos.round());
}

double _raiz(double x) {
  var r = x;
  for (var i = 0; i < 20; i++) {
    r = (r + x / r) / 2;
  }
  return r;
}

String formatarEstimativa(Duration d) {
  if (d.inSeconds < 60) return '~${d.inSeconds}s';
  final min = (d.inSeconds / 60).round();
  if (min < 60) return '~$min min';
  final h = min ~/ 60;
  final resto = min % 60;
  return resto > 0 ? '~${h}h ${resto}min' : '~${h}h';
}

enum _Modo { essencial, completa, personalizar }

class AssuntosField extends StatefulWidget {
  final Taxonomia taxonomia;
  final int periodoDias;

  /// Termos escolhidos, na ordem do catálogo (livres no fim).
  final ValueChanged<List<String>> onChanged;

  const AssuntosField({
    super.key,
    required this.taxonomia,
    required this.periodoDias,
    required this.onChanged,
  });

  @override
  State<AssuntosField> createState() => _AssuntosFieldState();
}

class _AssuntosFieldState extends State<AssuntosField> {
  _Modo _modo = _Modo.essencial;

  /// Termos do catálogo marcados.
  final Set<String> _marcados = {};

  /// Palavras-chave digitadas — não vivem no catálogo, mas viajam no mesmo
  /// campo `assuntos[]` e recebem o mesmo tratamento nos filtros do backend.
  final List<String> _livres = [];

  final _livreCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _aplicarPreset(_Modo.essencial, notificar: false);
  }

  @override
  void didUpdateWidget(AssuntosField old) {
    super.didUpdateWidget(old);
    // O catálogo chega depois do primeiro build (é uma chamada de rede).
    if (old.taxonomia.isEmpty && !widget.taxonomia.isEmpty) {
      _aplicarPreset(_modo, notificar: true);
    }
  }

  @override
  void dispose() {
    _livreCtrl.dispose();
    super.dispose();
  }

  List<String> get _selecionados => [
        ...widget.taxonomia.assuntos
            .where((a) => _marcados.contains(a.termo))
            .map((a) => a.termo),
        ..._livres,
      ];

  void _aplicarPreset(_Modo modo, {bool notificar = true}) {
    setState(() {
      _modo = modo;
      if (modo == _Modo.essencial) {
        _marcados
          ..clear()
          ..addAll(widget.taxonomia.essenciais);
      } else if (modo == _Modo.completa) {
        _marcados
          ..clear()
          ..addAll(widget.taxonomia.assuntos.map((a) => a.termo));
      }
      // `personalizar` mantém o que já estava marcado — o usuário está partindo
      // de um preset e ajustando, não recomeçando do zero.
    });
    if (notificar) widget.onChanged(_selecionados);
  }

  void _alternar(String termo) {
    setState(() {
      if (_marcados.contains(termo)) {
        _marcados.remove(termo);
      } else {
        _marcados.add(termo);
      }
      _modo = _Modo.personalizar;
    });
    widget.onChanged(_selecionados);
  }

  void _adicionarLivre() {
    final texto = _livreCtrl.text.trim();
    if (texto.length < 2) return;

    final jaExiste = _livres.any((l) => l.toLowerCase() == texto.toLowerCase()) ||
        widget.taxonomia.assuntos
            .any((a) => a.termo.toLowerCase() == texto.toLowerCase());
    if (jaExiste) {
      _livreCtrl.clear();
      return;
    }

    setState(() {
      _livres.add(texto);
      _modo = _Modo.personalizar;
      _livreCtrl.clear();
    });
    widget.onChanged(_selecionados);
  }

  void _removerLivre(String termo) {
    setState(() => _livres.remove(termo));
    widget.onChanged(_selecionados);
  }

  /// Descrição do que está escolhido — é o que responde "o que é Essencial?"
  /// sem obrigar ninguém a abrir nada.
  String get _descricao {
    final total = _selecionados.length;
    if (total == 0) return 'Nenhum assunto escolhido.';

    if (_modo == _Modo.essencial) {
      final labels = widget.taxonomia.assuntos
          .where((a) => a.essencial)
          .map((a) => a.label.toLowerCase())
          .toList();
      return 'Crime comum: ${_listar(labels)}.';
    }
    if (_modo == _Modo.completa) {
      return 'Todos os assuntos da taxonomia, de roubo a greve e crime ambiental.';
    }

    final labels = [
      ...widget.taxonomia.assuntos
          .where((a) => _marcados.contains(a.termo))
          .map((a) => a.label.toLowerCase()),
      ..._livres.map((l) => l.toLowerCase()),
    ];
    return _listar(labels.take(4).toList()) +
        (labels.length > 4 ? ' e mais ${labels.length - 4}.' : '.');
  }

  String _listar(List<String> itens) {
    if (itens.isEmpty) return '—';
    if (itens.length == 1) return itens.first;
    return '${itens.take(itens.length - 1).join(', ')} e ${itens.last}';
  }

  @override
  Widget build(BuildContext context) {
    final tax = widget.taxonomia;

    // Sem catálogo (rede falhou), a busca continua possível: o backend cai na
    // lista do painel, que é o comportamento anterior a esta tela existir.
    if (tax.isEmpty) {
      return Text(
        'Catálogo de assuntos indisponível — a busca vai usar a lista padrão.',
        style: GoogleFonts.exo2(
          fontSize: 12,
          color: SIMEopsColors.muted.withValues(alpha: 0.6),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _presetCard(
              titulo: 'ESSENCIAL',
              quantos: tax.essenciais.length,
              modo: _Modo.essencial,
            ),
            const SizedBox(width: 8),
            _presetCard(
              titulo: 'COMPLETA',
              quantos: tax.assuntos.length,
              modo: _Modo.completa,
            ),
            const SizedBox(width: 8),
            _presetCard(
              titulo: 'ESCOLHER',
              quantos: null,
              modo: _Modo.personalizar,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          _descricao,
          style: GoogleFonts.exo2(
            fontSize: 12.5,
            height: 1.4,
            color: SIMEopsColors.muted.withValues(alpha: 0.85),
          ),
        ),
        if (_modo == _Modo.personalizar) ...[
          const SizedBox(height: 16),
          for (final cat in tax.categorias) ..._blocoCategoria(tax, cat),
          const SizedBox(height: 6),
          _campoLivre(),
        ],
      ],
    );
  }

  Widget _presetCard({
    required String titulo,
    required int? quantos,
    required _Modo modo,
  }) {
    final ativo = _modo == modo;
    // O "escolher" não tem contagem fixa — mostra a seleção atual.
    final n = quantos ?? _selecionados.length;
    final tempo = formatarEstimativa(estimativaBusca(n, widget.periodoDias));

    return Expanded(
      child: GestureDetector(
        onTap: () => _aplicarPreset(modo),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          decoration: BoxDecoration(
            color: ativo
                ? SIMEopsColors.teal.withValues(alpha: 0.14)
                : SIMEopsColors.navyLight.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: ativo
                  ? SIMEopsColors.teal
                  : SIMEopsColors.teal.withValues(alpha: 0.12),
              width: ativo ? 1.5 : 1,
            ),
          ),
          child: Column(
            children: [
              Text(
                titulo,
                style: GoogleFonts.exo2(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                  color: ativo ? SIMEopsColors.tealLight : SIMEopsColors.muted,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                n == 0 ? 'escolher' : '$n assunto${n == 1 ? '' : 's'}',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 10.5,
                  color: SIMEopsColors.muted.withValues(alpha: 0.75),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                n == 0 ? '—' : tempo,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: ativo
                      ? SIMEopsColors.tealLight
                      : SIMEopsColors.muted.withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _blocoCategoria(Taxonomia tax, CategoriaTaxonomia cat) {
    final itens = tax.daCategoria(cat.id);
    if (itens.isEmpty) return const [];

    return [
      Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 6),
        child: Row(
          children: [
            Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(color: cat.cor, shape: BoxShape.circle),
            ),
            const SizedBox(width: 7),
            Text(
              cat.label.toUpperCase(),
              style: GoogleFonts.exo2(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: SIMEopsColors.muted.withValues(alpha: 0.7),
              ),
            ),
          ],
        ),
      ),
      Wrap(
        spacing: 7,
        runSpacing: 7,
        children: itens.map((a) {
          final on = _marcados.contains(a.termo);
          return _chip(
            label: a.label,
            cor: cat.cor,
            ativo: on,
            onTap: () => _alternar(a.termo),
          );
        }).toList(),
      ),
    ];
  }

  Widget _chip({
    required String label,
    required Color cor,
    required bool ativo,
    required VoidCallback onTap,
    VoidCallback? onRemove,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.fromLTRB(11, 7, onRemove != null ? 6 : 11, 7),
        decoration: BoxDecoration(
          color: ativo
              ? cor.withValues(alpha: 0.18)
              : SIMEopsColors.navyLight.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: ativo ? cor : cor.withValues(alpha: 0.22),
            width: ativo ? 1.4 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: GoogleFonts.exo2(
                fontSize: 12.5,
                fontWeight: ativo ? FontWeight.w600 : FontWeight.w400,
                color: ativo ? Colors.white : SIMEopsColors.muted,
              ),
            ),
            if (onRemove != null) ...[
              const SizedBox(width: 3),
              GestureDetector(
                onTap: onRemove,
                child: Icon(Icons.close,
                    size: 14, color: SIMEopsColors.muted.withValues(alpha: 0.8)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _campoLivre() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        TextField(
          controller: _livreCtrl,
          onSubmitted: (_) => _adicionarLivre(),
          textInputAction: TextInputAction.done,
          style: GoogleFonts.exo2(fontSize: 13.5, color: Colors.white),
          decoration: InputDecoration(
            isDense: true,
            hintText: 'Palavra-chave (ex: acidente rodovia)',
            hintStyle: GoogleFonts.exo2(
              fontSize: 13,
              color: SIMEopsColors.muted.withValues(alpha: 0.5),
            ),
            prefixIcon: Icon(Icons.add,
                size: 19, color: SIMEopsColors.teal.withValues(alpha: 0.7)),
            suffixIcon: TextButton(
              onPressed: _adicionarLivre,
              child: Text(
                'ADD',
                style: GoogleFonts.exo2(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: SIMEopsColors.tealLight,
                ),
              ),
            ),
            border:
                OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        if (_livres.isNotEmpty) ...[
          const SizedBox(height: 9),
          Wrap(
            spacing: 7,
            runSpacing: 7,
            children: _livres
                .map((l) => _chip(
                      label: l,
                      cor: SIMEopsColors.teal,
                      ativo: true,
                      onTap: () {},
                      onRemove: () => _removerLivre(l),
                    ))
                .toList(),
          ),
        ],
      ],
    );
  }
}
