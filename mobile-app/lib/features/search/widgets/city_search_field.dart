import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/data/brazilian_locations.dart';

class CitySearchField extends StatefulWidget {
  final String? estadoNome;
  final String? initialValue;
  final ValueChanged<String?> onSelected;

  const CitySearchField({
    super.key,
    this.estadoNome,
    this.initialValue,
    required this.onSelected,
  });

  @override
  State<CitySearchField> createState() => _CitySearchFieldState();
}

class _CitySearchFieldState extends State<CitySearchField> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<String> _suggestions = [];
  bool _showSuggestions = false;
  final _focusNode = FocusNode();
  final _layerLink = LayerLink();
  OverlayEntry? _overlayEntry;

  @override
  void initState() {
    super.initState();
    if (widget.initialValue != null) {
      _controller.text = widget.initialValue!;
    }
    _focusNode.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(CitySearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.estadoNome != widget.estadoNome) {
      _controller.clear();
      widget.onSelected(null);
      _hideSuggestions();
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
    if (!_focusNode.hasFocus) {
      // Delay to allow tap on suggestion
      Future.delayed(const Duration(milliseconds: 200), () {
        if (mounted) _hideSuggestions();
      });
    }
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      final locations = BrazilianLocations.instance;
      final results = locations.searchCidades(
        value,
        estadoNome: widget.estadoNome,
      );
      setState(() {
        _suggestions = results;
        _showSuggestions = results.isNotEmpty;
      });
      if (_showSuggestions) {
        _showOverlay();
      } else {
        _hideSuggestions();
      }
    });
    // Clear selection when typing
    widget.onSelected(null);
  }

  void _onSuggestionTap(String suggestion) {
    // If format is "City - UF", extract just the city name
    final cityName = suggestion.contains(' - ')
        ? suggestion.split(' - ').first
        : suggestion;
    _controller.text = cityName;
    widget.onSelected(cityName);
    _hideSuggestions();
    _focusNode.unfocus();
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
              constraints: const BoxConstraints(maxHeight: 200),
              child: ListView.builder(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: _suggestions.length,
                itemBuilder: (context, index) {
                  final s = _suggestions[index];
                  return ListTile(
                    dense: true,
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
    if (mounted) {
      setState(() => _showSuggestions = false);
    }
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
    return CompositedTransformTarget(
      link: _layerLink,
      child: TextField(
        controller: _controller,
        focusNode: _focusNode,
        onChanged: _onChanged,
        enabled: widget.estadoNome != null,
        decoration: InputDecoration(
          labelText: 'Cidade',
          hintText: widget.estadoNome == null
              ? 'Selecione o estado primeiro'
              : 'Digite para buscar...',
          prefixIcon: const Icon(Icons.search),
          border: const OutlineInputBorder(),
          suffixIcon: _controller.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    _controller.clear();
                    widget.onSelected(null);
                    _hideSuggestions();
                  },
                )
              : null,
        ),
      ),
    );
  }
}
