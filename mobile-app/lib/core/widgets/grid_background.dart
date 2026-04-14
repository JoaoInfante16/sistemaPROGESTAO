import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

/// Grid animado sutil no estilo cybersec/operacional.
/// Movimento continuo infinito com mudancas suaves de direcao.
class GridBackground extends StatefulWidget {
  final Widget child;
  const GridBackground({super.key, required this.child});

  @override
  State<GridBackground> createState() => _GridBackgroundState();
}

class _GridBackgroundState extends State<GridBackground>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  double _elapsed = 0;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker((elapsed) {
      setState(() {
        _elapsed = elapsed.inMilliseconds / 1000.0;
      });
    })..start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(color: const Color(0xFF060D18)),
        CustomPaint(
          painter: _GridPainter(time: _elapsed),
          size: Size.infinite,
        ),
        widget.child,
      ],
    );
  }
}

class _GridPainter extends CustomPainter {
  final double time;
  const _GridPainter({required this.time});

  @override
  void paint(Canvas canvas, Size size) {
    const spacing = 52.0;
    // Slow speed: ~3 pixels per second base
    const speed = 3.0;

    // Pulse opacity between 0.02 and 0.05
    final opacity = 0.02 + 0.03 * (0.5 + 0.5 * sin(time * 0.8));
    final paint = Paint()
      ..color = const Color(0xFF1A8F9A).withValues(alpha: opacity)
      ..strokeWidth = 0.5;

    // Constant speed drift + subtle direction changes via sin waves
    // Speed never changes, only the direction wanders smoothly
    final dx = speed * time
        + 12 * sin(time * 0.08)
        + 7 * sin(time * 0.19);
    final dy = speed * time * 0.6
        + 10 * sin(time * 0.11)
        + 6 * sin(time * 0.27);

    // Modulo spacing for seamless tiling
    final offsetX = dx % spacing;
    final offsetY = dy % spacing;

    // Vertical lines
    for (double x = -spacing + offsetX; x < size.width + spacing; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    // Horizontal lines
    for (double y = -spacing + offsetY; y < size.height + spacing; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(_GridPainter old) => true;
}
