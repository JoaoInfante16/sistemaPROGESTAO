import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/executive_data.dart';
import '../../main.dart';

// Seção "INDICADORES DA REGIÃO" no topo do relatório.
// Cards visuais + parágrafo complementar + fontes consolidadas.
// Não renderiza se data.isEmpty (sem estatísticas no período).
class ExecutiveIndicators extends StatelessWidget {
  final ExecutiveData data;

  const ExecutiveIndicators({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SIMEopsColors.navyLight.withValues(alpha: 0.6),
        border: Border.all(color: SIMEopsColors.teal.withValues(alpha: 0.2)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Cabeçalho da seção
          Text(
            'INDICADORES DA REGIÃO',
            style: GoogleFonts.rajdhani(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 2,
              color: SIMEopsColors.teal,
            ),
          ),
          const SizedBox(height: 12),

          // Cards horizontais scrolláveis
          if (data.indicadores.isNotEmpty)
            SizedBox(
              height: 108,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: data.indicadores.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, i) => _IndicatorCard(indicator: data.indicadores[i]),
              ),
            ),

          // Resumo complementar (narrativa dos que não viraram card)
          if (data.resumoComplementar != null && data.resumoComplementar!.trim().isNotEmpty) ...[
            if (data.indicadores.isNotEmpty) const SizedBox(height: 14),
            Text(
              data.resumoComplementar!,
              style: GoogleFonts.exo2(
                fontSize: 13,
                height: 1.4,
                color: Colors.white.withValues(alpha: 0.85),
              ),
            ),
          ],

          // Fontes
          if (data.fontes.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                Text(
                  'Fontes:',
                  style: GoogleFonts.rajdhani(
                    fontSize: 10,
                    color: SIMEopsColors.muted.withValues(alpha: 0.7),
                    letterSpacing: 1,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                ...data.fontes.map((f) => Text(
                      f,
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 11,
                        color: SIMEopsColors.tealLight.withValues(alpha: 0.9),
                      ),
                    )),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _IndicatorCard extends StatelessWidget {
  final ExecutiveIndicator indicator;
  const _IndicatorCard({required this.indicator});

  // Cor do valor: positivo=teal, negativo=vermelho, neutro=cinza claro
  Color get _valueColor {
    switch (indicator.sentido) {
      case 'positivo':
        return const Color(0xFF22C55E); // verde sucesso
      case 'negativo':
        return const Color(0xFFE05252); // vermelho alerta
      default:
        return SIMEopsColors.tealLight;
    }
  }

  // Seta pra percentuais (↑ positivo = queda de crime, ↓ negativo = aumento)
  // Regra: sinal do valor indica direção literal. Sentido é semântico (bom/ruim).
  String? get _arrow {
    if (indicator.tipo != 'percentual') return null;
    if (indicator.valor > 0) return '↑';
    if (indicator.valor < 0) return '↓';
    return null;
  }

  String _formatValue() {
    switch (indicator.tipo) {
      case 'percentual':
        final abs = indicator.valor.abs();
        final sign = indicator.valor > 0 ? '+' : indicator.valor < 0 ? '-' : '';
        final str = abs == abs.roundToDouble() ? abs.toStringAsFixed(0) : abs.toStringAsFixed(1).replaceAll('.', ',');
        return '$sign$str${indicator.unidade ?? '%'}';
      case 'monetario':
        // Mostra como "R$ 4,2 Mi" ou "R$ 250 mil" se unidade tiver sugestão,
        // senão formato curto baseado no valor.
        final v = indicator.valor;
        if (v >= 1_000_000) return 'R\$ ${(v / 1_000_000).toStringAsFixed(1).replaceAll('.', ',')} Mi';
        if (v >= 1_000) return 'R\$ ${(v / 1_000).toStringAsFixed(0)} mil';
        return 'R\$ ${v.toStringAsFixed(0)}';
      case 'absoluto':
      default:
        final v = indicator.valor;
        if (v >= 1000) {
          return v.toStringAsFixed(0).replaceAllMapped(
                RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
                (m) => '${m[1]}.',
              );
        }
        return v.toStringAsFixed(0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 140,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: SIMEopsColors.navy.withValues(alpha: 0.7),
        border: Border.all(color: _valueColor.withValues(alpha: 0.3)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Valor destacado + seta
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Flexible(
                child: Text(
                  _formatValue(),
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: _valueColor,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (_arrow != null) ...[
                const SizedBox(width: 2),
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    _arrow!,
                    style: TextStyle(fontSize: 14, color: _valueColor, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ],
          ),
          // Label + contexto
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                indicator.label,
                style: GoogleFonts.exo2(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withValues(alpha: 0.9),
                  height: 1.2,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (indicator.contexto.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  indicator.contexto,
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 9,
                    color: SIMEopsColors.muted.withValues(alpha: 0.7),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
