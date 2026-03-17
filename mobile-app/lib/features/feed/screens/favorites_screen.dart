import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/news_item.dart';
import '../../../core/services/api_service.dart';
import '../widgets/news_card.dart';
import '../widgets/news_detail_sheet.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final List<NewsItem> _favorites = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<ApiService>();
    setState(() => _loading = true);

    try {
      final items = await api.getFavorites();
      setState(() {
        _favorites.clear();
        _favorites.addAll(items);
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao carregar favoritos: $e')),
        );
      }
    }
  }

  Future<void> _removeFavorite(int index) async {
    final item = _favorites[index];
    final api = context.read<ApiService>();
    try {
      await api.removeFavorite(item.id);
      setState(() => _favorites.removeAt(index));
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_favorites.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.favorite_border, size: 64, color: Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              'Nenhum favorito ainda',
              style: TextStyle(color: Colors.grey[500]),
            ),
            const SizedBox(height: 8),
            Text(
              'Deslize uma noticia para a direita para favoritar',
              style: TextStyle(color: Colors.grey[400], fontSize: 12),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        itemCount: _favorites.length,
        itemBuilder: (context, index) {
          return NewsCard(
            news: _favorites[index],
            onTap: () => NewsDetailSheet.show(context, _favorites[index]),
            onToggleFavorite: () => _removeFavorite(index),
          );
        },
      ),
    );
  }
}
