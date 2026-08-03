import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../utils/category_colors.dart';

// Chips de filtro por categoria com contagem: `Segurança 31`.
// Seleção vazia = tudo visível (chips neutros). Tocar alterna a categoria
// no recorte. Mesma linguagem dos chips do CrimeRadarMap.
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
    final cats =
        categoryOrder.where((c) => (counts[c] ?? 0) > 0).toList();
    if (cats.length < 2) return const SizedBox.shrink();

    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: cats.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (_, i) {
          final cat = cats[i];
          final isOn = selected.contains(cat);
          final color = categoryColor(cat);
          return FilterChip(
            label: Text(
              '${categoryLabel(cat)} ${counts[cat]}',
              style: GoogleFonts.exo2(
                fontSize: 11,
                color: isOn ? Colors.white : color,
                fontWeight: FontWeight.w600,
              ),
            ),
            selected: isOn,
            showCheckmark: false,
            selectedColor: color,
            backgroundColor: color.withValues(alpha: 0.12),
            side: BorderSide(color: color.withValues(alpha: isOn ? 0 : 0.4)),
            onSelected: (_) => onToggle(cat),
          );
        },
      ),
    );
  }
}
