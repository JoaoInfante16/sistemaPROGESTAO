import 'package:flutter/material.dart';
import '../theme/simeops_colors.dart';

/// Silhueta de carregamento — o que a tela vai ser, desenhado antes de existir.
///
/// Trocou **14 `CircularProgressIndicator`** de tela cheia. O giro é o widget
/// mais Material que sobrou no app e não informa nada: não diz o que está
/// vindo, nem quanto, nem se vale esperar. A silhueta diz as três coisas só por
/// ter a forma da lista que vem depois — e o salto quando o conteúdo chega
/// deixa de existir, porque o layout já estava lá.
///
/// **Sem gradiente varrendo.** O shimmer de loja é uma animação decorativa, e
/// este app não tem nenhuma: o pulso é só o `opacity` indo e voltando devagar,
/// entre 0.35 e 0.75, em 1,1s. Lê como "isto ainda não é conteúdo" sem virar
/// enfeite.
///
/// Tudo em [SIMEopsColors.hairline] (1.8:1) — a tinta que a paleta **proíbe
/// para texto** justamente por não ser legível. É a tinta certa para uma forma
/// que não deve ser lida.
class Esqueleto extends StatefulWidget {
  final Widget child;

  const Esqueleto({super.key, required this.child});

  @override
  State<Esqueleto> createState() => _EsqueletoState();
}

class _EsqueletoState extends State<Esqueleto>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: Tween<double>(
      begin: 0.35,
      end: 0.75,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut)),
    child: IgnorePointer(child: widget.child),
  );
}

/// Um bloco da silhueta. Sem canto arredondado, como todo o resto do app.
class Barra extends StatelessWidget {
  final double largura;
  final double altura;

  const Barra(this.largura, [this.altura = 10, Key? key]) : super(key: key);

  @override
  Widget build(BuildContext context) =>
      Container(width: largura, height: altura, color: SIMEopsColors.hairline);
}

/// Largura em fração da linha — silhueta de item não pode ter largura fixa,
/// senão ela vira uma coluna reta e não parece texto.
class BarraFlex extends StatelessWidget {
  final double fracao;
  final double altura;

  const BarraFlex(this.fracao, [this.altura = 10, Key? key]) : super(key: key);

  @override
  Widget build(BuildContext context) => FractionallySizedBox(
    alignment: Alignment.centerLeft,
    widthFactor: fracao,
    child: Container(height: altura, color: SIMEopsColors.hairline),
  );
}

/// O fio de matérias — a anatomia do [TakeCard]: slug, manchete de duas linhas,
/// lide, créditos. Separadas pelo mesmo filete de 1px da lista real.
class EsqueletoDoFio extends StatelessWidget {
  final int itens;

  const EsqueletoDoFio({super.key, this.itens = 5});

  @override
  Widget build(BuildContext context) => Esqueleto(
    child: ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 6),
      children: [
        for (var i = 0; i < itens; i++) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 17, 18, 19),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BarraFlex(0.42, 9), // slug
                const SizedBox(height: 12),
                const BarraFlex(0.96, 17), // manchete, linha 1
                const SizedBox(height: 7),
                // A segunda linha da manchete varia: duas silhuetas idênticas
                // empilhadas leem como tabela, não como texto.
                BarraFlex(i.isEven ? 0.62 : 0.78, 17),
                const SizedBox(height: 13),
                const BarraFlex(0.88, 11), // lide
                const SizedBox(height: 11),
                const BarraFlex(0.30, 9), // créditos
              ],
            ),
          ),
          if (i < itens - 1)
            const Divider(height: 1, thickness: 1, color: SIMEopsColors.rule),
        ],
      ],
    ),
  );
}

/// O monitoramento: cabeçalho, e os cartões de cidade com a faixa de figuras.
class EsqueletoDeCidades extends StatelessWidget {
  final int itens;

  const EsqueletoDeCidades({super.key, this.itens = 3});

  @override
  Widget build(BuildContext context) => Esqueleto(
    child: ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 20),
      children: [
        for (var i = 0; i < itens; i++) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BarraFlex(0.28, 9), // etiqueta
                const SizedBox(height: 11),
                BarraFlex(i.isEven ? 0.66 : 0.44, 21), // nome
                const SizedBox(height: 16),
                // A faixa de números grandes com o rótulo embaixo.
                Row(
                  children: [
                    for (var c = 0; c < 4; c++) ...[
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Barra(19, 20),
                          SizedBox(height: 7),
                          Barra(38, 8),
                        ],
                      ),
                      if (c < 3) const SizedBox(width: 26),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 1, color: SIMEopsColors.rule),
        ],
      ],
    ),
  );
}

/// O histórico de consultas: etiqueta, cidade, linha de marcas.
class EsqueletoDeConsultas extends StatelessWidget {
  final int itens;

  const EsqueletoDeConsultas({super.key, this.itens = 4});

  @override
  Widget build(BuildContext context) => Esqueleto(
    child: ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 22),
      children: [
        for (var i = 0; i < itens; i++)
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const BarraFlex(0.34, 9),
                const SizedBox(height: 10),
                BarraFlex(i.isEven ? 0.50 : 0.36, 19),
                const SizedBox(height: 10),
                const BarraFlex(0.58, 9),
              ],
            ),
          ),
      ],
    ),
  );
}

/// O relatório: número-herói, frase de abertura, e os blocos de baixo.
class EsqueletoDeRelatorio extends StatelessWidget {
  const EsqueletoDeRelatorio({super.key});

  @override
  Widget build(BuildContext context) => Esqueleto(
    child: ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
      children: const [
        Barra(74, 44), // o número em Archivo hero
        SizedBox(height: 14),
        BarraFlex(0.94, 12),
        SizedBox(height: 8),
        BarraFlex(0.80, 12),
        SizedBox(height: 34),
        BarraFlex(0.30, 9), // título do bloco
        SizedBox(height: 16),
        BarraFlex(1, 96), // o gráfico / o mapa
        SizedBox(height: 34),
        BarraFlex(0.34, 9),
        SizedBox(height: 16),
        BarraFlex(0.90, 12),
        SizedBox(height: 9),
        BarraFlex(0.72, 12),
        SizedBox(height: 9),
        BarraFlex(0.84, 12),
      ],
    ),
  );
}

/// Um bloco de conteúdo dentro de uma tela que já carregou — indicadores,
/// taxonomia, fontes. Não tem cabeçalho porque ele já está desenhado em volta.
class EsqueletoDeBloco extends StatelessWidget {
  final int linhas;
  final double altura;

  const EsqueletoDeBloco({super.key, this.linhas = 3, this.altura = 12});

  @override
  Widget build(BuildContext context) => Esqueleto(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < linhas; i++) ...[
          BarraFlex(i.isEven ? 0.92 : 0.68, altura),
          if (i < linhas - 1) const SizedBox(height: 10),
        ],
      ],
    ),
  );
}
