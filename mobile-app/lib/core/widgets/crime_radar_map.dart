import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/crime_point.dart';
import '../utils/category_colors.dart';

// Radar de ocorrências. Um ponto por notícia, cor por categoria, glow leve.
// Overlap natural em hotspots (sem clustering agregado). Chips no topo pra
// filtrar por categoria — toggle independente. Usado em city_detail e report.
class CrimeRadarMap extends StatefulWidget {
  final List<CrimePoint> points;
  final double height;

  const CrimeRadarMap({
    super.key,
    required this.points,
    this.height = 280,
  });

  @override
  State<CrimeRadarMap> createState() => _CrimeRadarMapState();
}

class _CrimeRadarMapState extends State<CrimeRadarMap> {
  final Set<String> _hidden = {}; // categorias desligadas pelo user

  // Jitter determinístico pequeno (~±30m) pra pontos que caíram no centro do
  // bairro ou cidade — evita empilhar 10 ocorrências em 1 pixel. Baseado no id
  // pra ficar estável entre rebuilds.
  LatLng _jitter(CrimePoint p) {
    if (p.precisao == 'rua') return p.coords;
    final seed = p.id.hashCode;
    final rng = Random(seed);
    final radius = p.precisao == 'bairro' ? 0.0005 : 0.003; // ~50m / 300m
    final dLat = (rng.nextDouble() - 0.5) * 2 * radius;
    final dLng = (rng.nextDouble() - 0.5) * 2 * radius;
    return LatLng(p.lat + dLat, p.lng + dLng);
  }

  @override
  Widget build(BuildContext context) {
    final visible = widget.points.where((p) => !_hidden.contains(p.categoria)).toList();

    if (widget.points.isEmpty) {
      return SizedBox(
        height: widget.height,
        child: const Center(child: Text('Sem ocorrências geolocalizadas no período')),
      );
    }

    // Centro: média das lat/lng visíveis (ou de todas se nada visível)
    final basis = visible.isNotEmpty ? visible : widget.points;
    double avgLat = 0, avgLng = 0;
    for (final p in basis) {
      avgLat += p.lat;
      avgLng += p.lng;
    }
    final center = LatLng(avgLat / basis.length, avgLng / basis.length);

    // Categorias presentes nos dados (pra montar chips)
    final availableCats = widget.points.map((p) => p.categoria).toSet();
    final orderedCats = categoryOrder.where(availableCats.contains).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Chips de filtro
        SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: orderedCats.length,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (_, i) {
              final cat = orderedCats[i];
              final isOn = !_hidden.contains(cat);
              final color = categoryColor(cat);
              return FilterChip(
                label: Text(
                  categoryLabel(cat),
                  style: TextStyle(
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
                onSelected: (_) => setState(() {
                  if (isOn) {
                    _hidden.add(cat);
                  } else {
                    _hidden.remove(cat);
                  }
                }),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            height: widget.height,
            child: FlutterMap(
              options: MapOptions(
                initialCenter: center,
                initialZoom: 12,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                  subdomains: const ['a', 'b', 'c', 'd'],
                  userAgentPackageName: 'com.progestao.simeops',
                ),
                // Glow halo (pontos maiores, alpha baixo) — cria efeito "brilhante"
                CircleLayer(
                  circles: visible.map((p) {
                    final color = categoryColor(p.categoria);
                    return CircleMarker(
                      point: _jitter(p),
                      radius: 10,
                      color: color.withValues(alpha: 0.18),
                      borderStrokeWidth: 0,
                    );
                  }).toList(),
                ),
                // Ponto sólido central
                CircleLayer(
                  circles: visible.map((p) {
                    final color = categoryColor(p.categoria);
                    return CircleMarker(
                      point: _jitter(p),
                      radius: 4,
                      color: color.withValues(alpha: 0.9),
                      borderColor: Colors.white.withValues(alpha: 0.6),
                      borderStrokeWidth: 0.8,
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
