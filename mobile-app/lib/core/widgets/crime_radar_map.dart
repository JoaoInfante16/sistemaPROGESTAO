import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../models/crime_point.dart';
import '../theme/simeops_colors.dart';
import '../theme/simeops_type.dart';
import '../utils/category_colors.dart';
import '../utils/crime_labels.dart';
import 'cat_chip.dart';

// Radar de ocorrências. Um ponto por notícia, cor por categoria, glow leve.
// Overlap natural em hotspots (sem clustering agregado). Chips no topo pra
// filtrar por categoria. Tocar num ponto abre um mini-card com tipo, local e
// data. Enquadramento por fit-to-bounds. Usado em city_detail e report.
/// O que a tela sabe sobre a matéria de um pino: a manchete pra escrever no
/// card (null = usa o tipo de crime) e como abri-la.
typedef MateriaDoPonto = ({String? titulo, VoidCallback abrir});

class CrimeRadarMap extends StatefulWidget {
  final List<CrimePoint> points;
  final double height;

  /// A matéria por trás do pino, resolvida pela tela que hospeda o mapa — é
  /// ela que tem os itens em memória; o `CrimePoint` carrega só geografia e
  /// classificação.
  ///
  /// **Devolver null é o caso importante**: significa "não achei a matéria", e
  /// aí o card não escreve `ABRIR A MATÉRIA →`. Oferecer um link que não abre
  /// é pior que não oferecer nada — foi o que aconteceu na primeira versão
  /// disto, com o backend mandando índice posicional como id do ponto.
  final MateriaDoPonto? Function(CrimePoint)? materiaDoPonto;

  const CrimeRadarMap({
    super.key,
    required this.points,
    this.height = 280,
    this.materiaDoPonto,
  });

  @override
  State<CrimeRadarMap> createState() => _CrimeRadarMapState();
}

class _CrimeRadarMapState extends State<CrimeRadarMap> {
  final Set<String> _hidden = {}; // categorias desligadas pelo user
  final _mapController = MapController();
  CrimePoint? _selected;

  /// Mapa claro. Nasce desligado porque o app inteiro é escuro e um retângulo
  /// branco de 280px no meio do relatório é o objeto mais brilhante da tela —
  /// mas rua e nome de bairro se leem muito melhor no claro, e essa é a única
  /// coisa que se faz olhando de perto num mapa de 280px.
  bool _claro = false;

  /// A borda do ponto: branca sobre o mapa escuro, quase preta sobre o claro.
  /// Sem isso, no claro, os pontos amarelo e verde encostam no fundo e somem —
  /// as cinco cores de categoria foram medidas contra o navy, não contra papel.
  Color get _bordaDoPonto =>
      _claro ? const Color(0xFF0A1828) : Colors.white;

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

  /// O card do pino: **qual é a notícia**, quando, onde — e a porta pra ela.
  ///
  /// Antes ele dizia `HOMICÍDIO · Arenoso · 10/08` e acabava ali: o pino sabia
  /// classificar o fato e não sabia contar qual fato era. Quem tocava num
  /// ponto do mapa ficava sem saída — a matéria existia a um toque de
  /// distância, na lista, e o mapa não levava até ela.
  ///
  /// Canto zero e filete no lugar do canto 8 com borda teal translúcida, que
  /// era resto de antes do redesign.
  Widget _buildPointCard(CrimePoint p) {
    final local = [
      if (p.bairro != null && p.bairro!.isNotEmpty) p.bairro!,
      if (p.rua != null && p.rua!.isNotEmpty) p.rua!,
    ].join(' · ');

    final materia = widget.materiaDoPonto?.call(p);
    final titulo = materia?.titulo;

    return Material(
      color: SIMEopsColors.navyMid.withValues(alpha: 0.96),
      child: InkWell(
        onTap: materia?.abrir,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 9, 6, 11),
          decoration: const BoxDecoration(
            border: Border.fromBorderSide(
              BorderSide(color: SIMEopsColors.ruleStrong),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CatChip(cor: categoryColor(p.categoria)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${categoryLabel(p.categoria).toUpperCase()} · '
                      '${_fmtData(p.data)}',
                      style: SIMEopsType.slug(color: SIMEopsColors.faint),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  InkWell(
                    onTap: () => setState(() => _selected = null),
                    child: const Padding(
                      padding: EdgeInsets.all(6),
                      child: Icon(Icons.close,
                          size: 15, color: SIMEopsColors.muted),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                titulo ?? crimeTypeLabel(p.tipoCrime),
                style: SIMEopsType.entryTitle().copyWith(fontSize: 15),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (local.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  local,
                  style: SIMEopsType.slug(color: SIMEopsColors.muted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              if (materia != null) ...[
                const SizedBox(height: 9),
                Text(
                  'ABRIR A MATÉRIA →',
                  style: SIMEopsType.slug(color: SIMEopsColors.greenLight),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// A marca da legenda desenha **a mesma forma** que o mapa desenha. Antes
  /// eram três círculos cheios de tamanhos diferentes, ou seja: a legenda
  /// explicava um código que o mapa não usava mais do mesmo jeito.
  Widget _legendMark(String precisao, String label) {
    const cor = SIMEopsColors.muted;
    final vazado = precisao == 'cidade';

    return Padding(
      padding: const EdgeInsets.only(right: 14),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 11,
            height: 11,
            decoration: BoxDecoration(
              color: cor.withValues(
                alpha: switch (precisao) {
                  'rua' => 0.9,
                  'bairro' => 0.4,
                  _ => 0.0,
                },
              ),
              border: Border.all(color: cor, width: vazado ? 1.6 : 1),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(label, style: SIMEopsType.slug(color: SIMEopsColors.faint)),
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
        // Ligar/desligar categoria no mapa. Eram `FilterChip` — cápsula
        // preenchida da cor da categoria, o elemento mais saturado da tela pra
        // um controle que quase nunca é tocado. Agora é o quadrado de sempre
        // com o nome ao lado, e desligado ele apaga em vez de inverter.
        SizedBox(
          height: 30,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: orderedCats.length,
            separatorBuilder: (_, __) => const SizedBox(width: 16),
            itemBuilder: (_, i) {
              final cat = orderedCats[i];
              final isOn = !_hidden.contains(cat);
              return InkWell(
                onTap: () => setState(() {
                  if (isOn) {
                    _hidden.add(cat);
                    if (_selected?.categoria == cat) _selected = null;
                  } else {
                    _hidden.remove(cat);
                  }
                }),
                child: Opacity(
                  opacity: isOn ? 1 : 0.35,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CatChip(categoria: cat),
                      const SizedBox(width: 7),
                      Text(
                        categoryLabel(cat).toUpperCase(),
                        style: SIMEopsType.slug(
                          color: isOn
                              ? SIMEopsColors.muted
                              : SIMEopsColors.faint,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
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
                      urlTemplate:
                          'https://{s}.basemaps.cartocdn.com/'
                          '${_claro ? 'light_all' : 'dark_all'}'
                          '/{z}/{x}/{y}{r}.png',
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
                    // O ponto. **A precisão vira forma, não tamanho.**
                    //
                    // Era raio 5.5 / 4.0 / 3.0 — cinco pixels de diâmetro entre
                    // o mais preciso e o mais vago, em marcas que também mudam
                    // de cor e se sobrepõem. Ninguém compara área nessa escala:
                    // o João olhou o mapa e não conseguiu dizer qual ponto era
                    // rua e qual era cidade. Agora:
                    //
                    //   rua     ●  cheio      — sabemos o endereço
                    //   bairro  ◐  meio tom   — sabemos a região
                    //   cidade  ○  vazado     — **não sabemos onde foi**
                    //
                    // Vazado lê como furo de longe, que é literalmente o que um
                    // pino no centro da cidade é.
                    CircleLayer(
                      circles: visible.map((p) {
                        final color = categoryColor(p.categoria);
                        final radius = switch (p.precisao) {
                          'rua' => 5.5,
                          'bairro' => 5.0,
                          _ => 4.5,
                        };
                        final coreAlpha = switch (p.precisao) {
                          'rua' => 1.0,
                          'bairro' => 0.45,
                          _ => 0.0,
                        };
                        return CircleMarker(
                          point: _jitter(p),
                          radius: radius,
                          color: color.withValues(alpha: coreAlpha),
                          // No vazado a borda é a **cor da categoria** — sem
                          // ela o ponto sumiria por completo.
                          borderColor: p.precisao == 'cidade'
                              ? color
                              : _bordaDoPonto.withValues(
                                  alpha: p.precisao == 'rua' ? 0.9 : 0.6,
                                ),
                          borderStrokeWidth: p.precisao == 'cidade' ? 1.8 : 1.2,
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
        // Legenda da precisão — e, no lugar do rótulo `PRECISÃO DO PONTO`, a
        // troca do fundo do mapa.
        //
        // Aquele rótulo nomeava os três pontinhos à esquerda dele, só que do
        // outro lado da linha: lido de esquerda pra direita ele virava um
        // quarto item da legenda. A frase embaixo do mapa passou a explicar o
        // caso `CIDADE` em português, então ele ficou sem trabalho.
        Padding(
          padding: const EdgeInsets.only(top: 8, left: 2),
          child: Row(
            children: [
              _legendMark('rua', 'RUA'),
              _legendMark('bairro', 'BAIRRO'),
              _legendMark('cidade', 'CIDADE'),
              const Spacer(),
              InkWell(
                onTap: () => setState(() => _claro = !_claro),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 6,
                  ),
                  child: Text(
                    _claro ? 'MAPA ESCURO' : 'MAPA CLARO',
                    style: SIMEopsType.slug(color: SIMEopsColors.greenLight),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
