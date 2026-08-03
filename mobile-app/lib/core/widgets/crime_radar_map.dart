import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import '../models/crime_point.dart';
import '../theme/simeops_colors.dart';
import '../utils/category_colors.dart';
import '../utils/crime_labels.dart';

// Radar de ocorrências. Um ponto por notícia, cor por categoria, glow leve.
// Overlap natural em hotspots (sem clustering agregado). Chips no topo pra
// filtrar por categoria. Tocar num ponto abre um mini-card com tipo, local e
// data. Enquadramento por fit-to-bounds. Usado em city_detail e report.
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
  final _mapController = MapController();
  CrimePoint? _selected;

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

  // O CircleLayer não tem onTap — resolve-se pelo ponto visível mais próximo
  // do toque, com raio de acerto de ~24px convertido pra metros no zoom atual.
  void _handleTap(TapPosition tapPos, LatLng latlng) {
    final visible =
        widget.points.where((p) => !_hidden.contains(p.categoria)).toList();
    if (visible.isEmpty) return;

    double zoom;
    try {
      zoom = _mapController.camera.zoom;
    } catch (_) {
      zoom = 12;
    }
    final metersPerPixel =
        156543.03 * cos(latlng.latitude * pi / 180) / pow(2, zoom);
    final threshold = 24 * metersPerPixel;

    const dist = Distance();
    CrimePoint? best;
    var bestD = double.infinity;
    for (final p in visible) {
      final d = dist(latlng, _jitter(p));
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    setState(() {
      _selected = (best != null && bestD <= threshold) ? best : null;
    });
  }

  String _fmtData(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(d.day)}/${two(d.month)}';
  }

  Widget _buildPointCard(CrimePoint p) {
    final color = categoryColor(p.categoria);
    final local = [
      if (p.bairro != null && p.bairro!.isNotEmpty) p.bairro!,
      if (p.rua != null && p.rua!.isNotEmpty) p.rua!,
    ].join(' · ');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: SIMEopsColors.navyMid.withValues(alpha: 0.95),
        border: Border.all(color: SIMEopsColors.teal.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  crimeTypeLabel(p.tipoCrime).toUpperCase(),
                  style: GoogleFonts.rajdhani(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                    color: SIMEopsColors.white,
                  ),
                ),
                if (local.isNotEmpty)
                  Text(
                    local,
                    style: GoogleFonts.exo2(
                      fontSize: 11,
                      color: SIMEopsColors.muted,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            _fmtData(p.data),
            style: GoogleFonts.jetBrainsMono(
              fontSize: 11,
              color: SIMEopsColors.muted.withValues(alpha: 0.8),
            ),
          ),
          const SizedBox(width: 4),
          InkWell(
            onTap: () => setState(() => _selected = null),
            child: Icon(Icons.close,
                size: 16, color: SIMEopsColors.muted.withValues(alpha: 0.7)),
          ),
        ],
      ),
    );
  }

  Widget _legendDot(double radius, String label) {
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: radius * 2,
            height: radius * 2,
            decoration: BoxDecoration(
              color: SIMEopsColors.muted.withValues(alpha: 0.7),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: GoogleFonts.rajdhani(
              fontSize: 9,
              letterSpacing: 1,
              fontWeight: FontWeight.w600,
              color: SIMEopsColors.muted.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
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

    // Centro de fallback: média das lat/lng visíveis (ou de todas)
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

    final selectedVisible =
        _selected != null && !_hidden.contains(_selected!.categoria);

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
                    if (_selected?.categoria == cat) _selected = null;
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
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: center,
                    initialZoom: 12,
                    // Enquadra todos os pontos (o centro na média errava feio
                    // com pontos espalhados); zoom limitado pra não colar
                    // demais quando é ponto único.
                    initialCameraFit: widget.points.length > 1
                        ? CameraFit.coordinates(
                            coordinates:
                                widget.points.map(_jitter).toList(),
                            padding: const EdgeInsets.all(28),
                            maxZoom: 15,
                          )
                        : null,
                    onTap: _handleTap,
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
                    // Glow halo — precisão rua fica maior e mais brilhante,
                    // cidade fica menor e mais apagado (sinaliza baixa confiança).
                    CircleLayer(
                      circles: visible.map((p) {
                        final color = categoryColor(p.categoria);
                        final glowRadius = switch (p.precisao) {
                          'rua' => 14.0,
                          'bairro' => 10.0,
                          _ => 8.0,
                        };
                        final glowAlpha = switch (p.precisao) {
                          'rua' => 0.28,
                          'bairro' => 0.18,
                          _ => 0.10,
                        };
                        return CircleMarker(
                          point: _jitter(p),
                          radius: glowRadius,
                          color: color.withValues(alpha: glowAlpha),
                          borderStrokeWidth: 0,
                        );
                      }).toList(),
                    ),
                    // Ponto sólido — rua destaca (raio maior + borda branca forte),
                    // cidade diminui (raio menor + alpha 0.6) pra diferenciar confiança.
                    CircleLayer(
                      circles: visible.map((p) {
                        final color = categoryColor(p.categoria);
                        final radius = switch (p.precisao) {
                          'rua' => 5.5,
                          'bairro' => 4.0,
                          _ => 3.0,
                        };
                        final coreAlpha = switch (p.precisao) {
                          'rua' => 1.0,
                          'bairro' => 0.9,
                          _ => 0.6,
                        };
                        final borderAlpha = switch (p.precisao) {
                          'rua' => 0.9,
                          'bairro' => 0.6,
                          _ => 0.3,
                        };
                        return CircleMarker(
                          point: _jitter(p),
                          radius: radius,
                          color: color.withValues(alpha: coreAlpha),
                          borderColor: Colors.white.withValues(alpha: borderAlpha),
                          borderStrokeWidth: p.precisao == 'rua' ? 1.2 : 0.8,
                        );
                      }).toList(),
                    ),
                    // Anel de seleção
                    if (selectedVisible)
                      CircleLayer(
                        circles: [
                          CircleMarker(
                            point: _jitter(_selected!),
                            radius: 10,
                            color: Colors.transparent,
                            borderColor:
                                Colors.white.withValues(alpha: 0.9),
                            borderStrokeWidth: 1.5,
                          ),
                        ],
                      ),
                  ],
                ),
                // Mini-card da ocorrência tocada
                if (selectedVisible)
                  Positioned(
                    left: 8,
                    right: 8,
                    bottom: 8,
                    child: _buildPointCard(_selected!),
                  ),
              ],
            ),
          ),
        ),
        // Legenda da precisão (o tamanho/brilho do ponto codifica confiança)
        Padding(
          padding: const EdgeInsets.only(top: 8, left: 2),
          child: Row(
            children: [
              _legendDot(5.5, 'RUA'),
              _legendDot(4, 'BAIRRO'),
              _legendDot(3, 'CIDADE'),
              const Spacer(),
              Text(
                'precisão do ponto',
                style: GoogleFonts.exo2(
                  fontSize: 10,
                  color: SIMEopsColors.muted.withValues(alpha: 0.5),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
