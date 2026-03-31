import 'dart:math';
import 'package:flutter/material.dart';

/// Grid animado sutil no estilo cybersec/operacional.
/// Linhas teal com 3% opacidade, 52px spacing, animacao de pulso lento.
class GridBackground extends StatefulWidget {
  final Widget child;
  const GridBackground({super.key, required this.child});

  @override
  State<GridBackground> createState() => _GridBackgroundState();
}

class _GridBackgroundState extends State<GridBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Background color
        Container(color: const Color(0xFF060D18)),
        // Animated grid
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return CustomPaint(
              painter: _GridPainter(
                progress: _controller.value,
              ),
              size: Size.infinite,
            );
          },
        ),
        // Content on top
        widget.child,
      ],
    );
  }
}

class _GridPainter extends CustomPainter {
  final double progress;
  const _GridPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    const spacing = 52.0;
    // Pulse opacity between 0.02 and 0.05
    final opacity = 0.02 + 0.03 * (0.5 + 0.5 * sin(progress * 2 * pi));
    final paint = Paint()
      ..color = const Color(0xFF1A8F9A).withValues(alpha: opacity)
      ..strokeWidth = 0.5;

    // Vertical lines
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    // Horizontal lines
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(_GridPainter old) => old.progress != progress;
}
