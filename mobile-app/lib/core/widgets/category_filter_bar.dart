import 'package:flutter/material.dart';
import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';
import '../utils/category_colors.dart';

/// Filtro por categoria: quadrado de cor + nome + contagem.
///
/// Antes era `FilterChip` do Material com o **texto na cor da categoria**.
/// Duas coisas quebravam ali: cinco textos coloridos a 11px sobre navy viram
/// cinco borrões (fundo escuro come diferença de saturação), e texto vestindo
/// a cor da série sempre perde contraste — `institucional` chegava a ler cinza.
///
/// Agora a cor mora num quadrado de 8px e o texto fica em tinta legível. O
/// mesmo princípio do slug da matéria: **cor identifica, texto informa.**
class CategoryFilterBar extends StatelessWidget {
  final Map<String, int> counts;
  final Set<String> selected;
  final void Function(String cat) onToggle;

  const CategoryFilterBar({
    super.key,
    required this.counts,
    required this.selected,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final cats = categoryOrder.where((c) => (counts[c] ?? 0) > 0).toList();
    if (cats.length < 2) return const SizedBox.shrink();

    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        itemCount: cats.length,
        separatorBuilder: (_, __) => const SizedBox(width: 16),
        itemBuilder: (_, i) {
          final cat = cats[i];
          final isOn = selected.contains(cat);
          return InkWell(
            onTap: () => onToggle(cat),
            child: Padding(
              // Sem fundo e sem borda: o alvo de toque vem do padding, não de
              // uma cápsula desenhada. Filete embaixo marca o selecionado.
              padding: const EdgeInsets.symmetric(vertical: 9),
              child: Container(
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: isOn
                          ? SIMEopsColors.greenLight
                          : Colors.transparent,
                      width: 1.5,
                    ),
                  ),
                ),
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(width: 8, height: 8, color: categoryColor(cat)),
                    const SizedBox(width: 8),
                    Text(
                      categoryLabel(cat).toUpperCase(),
                      style: SIMEopsType.placeTab(active: isOn),
                    ),
                    const SizedBox(width: 7),
                    Text(
                      '${counts[cat]}',
                      style: SIMEopsType.placeTab(active: false)
                          .copyWith(color: SIMEopsColors.faint),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
