import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/models/city_overview.dart';
import '../../../core/services/api_service.dart';
import '../../../core/widgets/grid_background.dart';
import '../../../main.dart';
import '../widgets/city_card.dart';
import 'city_detail_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<CityOverview> _cities = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCities();
  }

  Future<void> _loadCities() async {
    try {
      final api = context.read<ApiService>();
      final items = await api.getCitiesOverview();
      if (mounted) {
        setState(() {
          _cities = items.map((e) => CityOverview.fromJson(e)).toList();
          _loading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  void _openCity(CityOverview city) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CityDetailScreen(city: city),
      ),
    );
    // Reload badges when returning from detail
    _loadCities();
  }

  @override
  Widget build(BuildContext context) {
    return GridBackground(
      child: RefreshIndicator(
        onRefresh: _loadCities,
        color: SIMEopsColors.teal,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _buildError()
                : _cities.isEmpty
                    ? _buildEmpty()
                    : _buildGrid(),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off, size: 48, color: SIMEopsColors.muted.withValues(alpha: 0.4)),
            const SizedBox(height: 16),
            Text(
              'Nao foi possivel carregar',
              style: TextStyle(color: SIMEopsColors.muted, fontSize: 14),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () {
                setState(() { _loading = true; _error = null; });
                _loadCities();
              },
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        const SizedBox(height: 120),
        Center(
          child: Column(
            children: [
              Icon(Icons.location_city, size: 56, color: SIMEopsColors.muted.withValues(alpha: 0.3)),
              const SizedBox(height: 16),
              Text(
                'Nenhuma cidade monitorada',
                style: TextStyle(color: SIMEopsColors.muted, fontSize: 15),
              ),
              const SizedBox(height: 6),
              Text(
                'Configure cidades no painel administrativo',
                style: TextStyle(color: SIMEopsColors.muted.withValues(alpha: 0.6), fontSize: 13),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGrid() {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        const SliverToBoxAdapter(child: SizedBox(height: 16)),

        // City cards vertical list
        SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final city = _cities[index];
              return CityCard(
                city: city,
                onTap: () => _openCity(city),
              );
            },
            childCount: _cities.length,
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 200)),
      ],
    );
  }

}

