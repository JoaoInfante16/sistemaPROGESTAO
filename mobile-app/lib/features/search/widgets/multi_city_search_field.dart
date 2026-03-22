import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/data/brazilian_locations.dart';

class MultiCitySearchField extends StatefulWidget {
  final String? estadoNome;
  final ValueChanged<Set<String>> onChanged;
  final int maxCities;

  const MultiCitySearchField({
    super.key,
    this.estadoNome,
    required this.onChanged,
    this.maxCities = 10,
  });

  @override
  State<MultiCitySearchField> createState() => _MultiCitySearchFieldState();
}

class _MultiCitySearchFieldState extends State<MultiCitySearchField> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<String> _suggestions = [];
  final _focusNode = FocusNode();
  final _layerLink = LayerLink();
  OverlayEntry? _overlayEntry;
  final Set<String> _selectedCities = {};

  bool get _atLimit => _selectedCities.length >= widget.maxCities;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(MultiCitySearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.estadoNome != widget.estadoNome) {
      _controller.clear();
      _selectedCities.clear();
      _hideSuggestions();
      widget.onChanged({});
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    _controller.dispose();
    _hideSuggestions();
    super.dispose();
  }

  void _onFocusChange() {
    if (_focusNode.hasFocus && _controller.text.isEmpty && widget.estadoNome != null) {
      // Show all cities when field gains focus with empty text
      _showAllCities();
    } else if (!_focusNode.hasFocus) {
      Future.delayed(const Duration(milliseconds: 200), () {
        if (mounted) _hideSuggestions();
      });
    }
  }

  void _showAllCities() {
    final locations = BrazilianLocations.instance;
    final allCities = locations.getCidades(widget.estadoNome!);
    final results = allCities
        .where((c) => !_selectedCities.contains(c))
        .toList();
    if (results.isNotEmpty) {
      setState(() => _suggestions = results);
      _showOverlay();
    }
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      final locations = BrazilianLocations.instance;
      final results = locations
          .searchCidades(value, estadoNome: widget.estadoNome)
          .where((c) {
        // Remove "City - UF" format to just city name for comparison
        final name = c.contains(' - ') ? c.split(' - ').first : c;
        return !_selectedCities.contains(name);
      }).toList();
      setState(() => _suggestions = results);
      if (results.isNotEmpty) {
        _showOverlay();
      } else {
        _hideSuggestions();
      }
    });
  }

  void _onSuggestionTap(String suggestion) {
    final cityName =
        suggestion.contains(' - ') ? suggestion.split(' - ').first : suggestion;
    setState(() {
      _selectedCities.add(cityName);
      _controller.clear();
      _suggestions = [];
    });
    _hideSuggestions();
    widget.onChanged(Set.from(_selectedCities));
    // Keep focus on input for quick multi-select
    if (!_atLimit) {
      _focusNode.requestFocus();
    }
  }

  void _removeCity(String city) {
    setState(() => _selectedCities.remove(city));
    widget.onChanged(Set.from(_selectedCities));
  }

  void _showOverlay() {
    _hideSuggestions();
    _overlayEntry = OverlayEntry(
      builder: (context) => Positioned(
        width: _getFieldWidth(),
        child: CompositedTransformFollower(
          link: _layerLink,
          showWhenUnlinked: false,
          offset: Offset(0, _getFieldHeight()),
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 250),
              child: ListView.builder(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: _suggestions.length,
                itemBuilder: (context, index) {
                  final s = _suggestions[index];
                  return ListTile(
                    dense: true,
                    leading: const Icon(Icons.add_circle_outline, size: 18),
                    title: Text(s, style: const TextStyle(fontSize: 14)),
                    onTap: () => _onSuggestionTap(s),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
    Overlay.of(context).insert(_overlayEntry!);
  }

  void _hideSuggestions() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  double _getFieldWidth() {
    final renderBox = context.findRenderObject() as RenderBox?;
    return renderBox?.size.width ?? 300;
  }

  double _getFieldHeight() {
    final renderBox = context.findRenderObject() as RenderBox?;
    return (renderBox?.size.height ?? 56) + 4;
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.estadoNome != null && !_atLimit;

    return CompositedTransformTarget(
      link: _layerLink,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _controller,
            focusNode: _focusNode,
            onChanged: _onChanged,
            enabled: enabled,
            decoration: InputDecoration(
              labelText: 'Cidades',
              hintText: widget.estadoNome == null
                  ? 'Selecione o estado primeiro'
                  : _atLimit
                      ? 'Limite de ${widget.maxCities} cidades atingido'
                      : 'Toque para ver cidades ou digite...',
              prefixIcon: const Icon(Icons.search),
              border: const OutlineInputBorder(),
              suffixIcon: _controller.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _controller.clear();
                        _hideSuggestions();
                      },
                    )
                  : widget.estadoNome != null && !_atLimit
                      ? const Icon(Icons.arrow_drop_down)
                      : null,
            ),
          ),
          if (_selectedCities.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: _selectedCities.map((city) {
                return Chip(
                  label: Text(city, style: const TextStyle(fontSize: 13)),
                  deleteIcon: const Icon(Icons.close, size: 16),
                  onDeleted: () => _removeCity(city),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  visualDensity: VisualDensity.compact,
                );
              }).toList(),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${_selectedCities.length}/${widget.maxCities} cidades selecionadas',
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
