import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/services/api_service.dart';
import '../widgets/mini_bar_chart.dart';
import '../widgets/mini_trend_chart.dart';

class ReportScreen extends StatefulWidget {
  final String? searchId;
  final List<String> cidades;
  final String estado;
  final int periodoDias;
  final List<Map<String, dynamic>> results;

  const ReportScreen({
    super.key,
    this.searchId,
    required this.cidades,
    required this.estado,
    required this.periodoDias,
    required this.results,
  });

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  bool _generatingLink = false;
  String? _reportUrl;

  // Computed analytics from results
  late final Map<String, int> _crimeTypeCounts;
  late final Map<String, int> _bairroCounts;
  late final Map<String, int> _dateCounts;
  late final List<Map<String, dynamic>> _byCrimeType;
  late final List<Map<String, dynamic>> _byDate;
  late final String _topCrimeType;
  late final int _totalCrimes;
  late final List<Map<String, String>> _sourcesOficial;
  late final List<Map<String, String>> _sourcesMedia;

  @override
  void initState() {
    super.initState();
    _computeAnalytics();
  }

  void _computeAnalytics() {
    _crimeTypeCounts = {};
    _bairroCounts = {};
    _dateCounts = {};

    for (final r in widget.results) {
      final tipo = r['tipo_crime'] as String? ?? 'Outro';
      _crimeTypeCounts[tipo] = (_crimeTypeCounts[tipo] ?? 0) + 1;

      final bairro = r['bairro'] as String?;
      if (bairro != null && bairro.isNotEmpty) {
        _bairroCounts[bairro] = (_bairroCounts[bairro] ?? 0) + 1;
      }

      final date = r['data_ocorrencia'] as String?;
      if (date != null) {
        _dateCounts[date] = (_dateCounts[date] ?? 0) + 1;
      }
    }

    _totalCrimes = widget.results.length;

    _byCrimeType = _crimeTypeCounts.entries
        .map((e) => <String, dynamic>{
              'tipo_crime': e.key,
              'count': e.value,
              'percentage': _totalCrimes > 0
                  ? (e.value / _totalCrimes * 100).round()
                  : 0,
            })
        .toList()
      ..sort((a, b) => (b['count'] as int).compareTo(a['count'] as int));

    _byDate = _dateCounts.entries
        .map((e) => <String, dynamic>{'date': e.key, 'count': e.value})
        .toList()
      ..sort((a, b) =>
          (a['date'] as String).compareTo(b['date'] as String));

    _topCrimeType =
        _byCrimeType.isNotEmpty ? _byCrimeType.first['tipo_crime'] as String : 'N/A';

    // Extract and classify sources
    final officialPattern = RegExp(
      r'\.gov\.br|\.ssp\.|\.seguranca\.|\.sesp\.|\.sspds\.|\.sejusp\.|\.segup\.',
      caseSensitive: false,
    );
    final seenUrls = <String>{};
    final oficial = <Map<String, String>>[];
    final media = <Map<String, String>>[];

    for (final r in widget.results) {
      final url = r['url'] as String? ?? '';
      if (url.isEmpty || seenUrls.contains(url)) continue;
      seenUrls.add(url);
      final entry = {'url': url, 'name': (r['fonte'] ?? r['source_name'] ?? url) as String};
      if (officialPattern.hasMatch(url)) {
        oficial.add(entry);
      } else {
        media.add(entry);
      }
    }
    _sourcesOficial = oficial;
    _sourcesMedia = media;
  }

  Future<void> _generateAndShareLink() async {
    setState(() => _generatingLink = true);

    try {
      final api = context.read<ApiService>();
      final now = DateTime.now();
      final dateFrom = DateTime(now.year, now.month, now.day)
          .subtract(Duration(days: widget.periodoDias));

      final response = await api.generateReport(
        cidade: widget.cidades.first,
        estado: widget.estado,
        dateFrom:
            '${dateFrom.year}-${dateFrom.month.toString().padLeft(2, '0')}-${dateFrom.day.toString().padLeft(2, '0')}',
        dateTo:
            '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}',
        searchId: widget.searchId,
      );

      final reportId = response['reportId'] as String;
      // The URL will be the admin panel domain + /report/ID
      // For now use a relative path - in production this would be the Vercel URL
      final url = 'https://admin.netrios.com/report/$reportId';

      setState(() => _reportUrl = url);

      if (mounted) {
        await Share.share(
          'Relatorio de Analise de Risco Criminal - ${widget.cidades.join(", ")}/${widget.estado}\n\n$url',
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro ao gerar relatorio: $e')),
        );
      }
    } finally {
      setState(() => _generatingLink = false);
    }
  }

  Future<void> _openSourceUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _openInBrowser() async {
    if (_reportUrl == null) return;
    final uri = Uri.parse(_reportUrl!);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Relatorio de Risco'),
        actions: [
          if (_reportUrl != null)
            IconButton(
              icon: const Icon(Icons.open_in_browser),
              onPressed: _openInBrowser,
              tooltip: 'Abrir no navegador',
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Text(
            'Analise Criminal',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            '${widget.cidades.join(", ")} - ${widget.estado} | Ultimos ${widget.periodoDias} dias',
            style: TextStyle(color: Colors.grey[600], fontSize: 14),
          ),
          const SizedBox(height: 20),

          // Summary cards
          Row(
            children: [
              _SummaryCard(
                label: 'Total',
                value: '$_totalCrimes',
                icon: Icons.article,
              ),
              const SizedBox(width: 12),
              _SummaryCard(
                label: 'Mais comum',
                value: _topCrimeType,
                icon: Icons.warning_amber,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _SummaryCard(
                label: 'Tipos',
                value: '${_crimeTypeCounts.length}',
                icon: Icons.category,
              ),
              const SizedBox(width: 12),
              _SummaryCard(
                label: 'Bairros',
                value: '${_bairroCounts.length}',
                icon: Icons.location_city,
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Bar chart - crime by type
          if (_byCrimeType.isNotEmpty) ...[
            _SectionTitle('Ocorrencias por Tipo'),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: MiniBarChart(data: _byCrimeType),
              ),
            ),
            const SizedBox(height: 24),
          ],

          // Trend chart
          if (_byDate.length > 1) ...[
            _SectionTitle('Tendencia Temporal'),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: MiniTrendChart(data: _byDate),
              ),
            ),
            const SizedBox(height: 24),
          ],

          // Top bairros
          if (_bairroCounts.isNotEmpty) ...[
            _SectionTitle('Bairros com Mais Incidencias'),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: () {
                    final sorted = _bairroCounts.entries.toList()
                      ..sort((a, b) => b.value.compareTo(a.value));
                    final top = sorted.take(8).toList();
                    final maxCount = top.first.value;
                    return top.asMap().entries.map((entry) {
                      final i = entry.key;
                      final e = entry.value;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 24,
                              child: Text(
                                '${i + 1}.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey[500],
                                ),
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(e.key,
                                          style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w500)),
                                      Text('${e.value}',
                                          style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey[600])),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  LinearProgressIndicator(
                                    value: e.value / maxCount,
                                    backgroundColor: Colors.grey[200],
                                    color: const Color(0xFF3b82f6),
                                    minHeight: 4,
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList();
                  }(),
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],

          // Sources - Oficial
          if (_sourcesOficial.isNotEmpty) ...[
            _SectionTitle('Fontes Oficiais (SSP/Gov)'),
            const SizedBox(height: 8),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: _sourcesOficial.map((s) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: InkWell(
                      onTap: () => _openSourceUrl(s['url']!),
                      child: Row(
                        children: [
                          Icon(Icons.shield, size: 14, color: Colors.green[700]),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              s['name']!,
                              style: TextStyle(
                                color: Colors.green[700],
                                fontSize: 13,
                                decoration: TextDecoration.underline,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )).toList(),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Sources - Midia
          _SectionTitle(
            _sourcesMedia.isNotEmpty
                ? 'Fontes Jornalisticas'
                : 'Fontes (${widget.results.length} noticias analisadas)',
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_sourcesMedia.isNotEmpty)
                    ..._sourcesMedia.take(10).map((s) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: InkWell(
                        onTap: () => _openSourceUrl(s['url']!),
                        child: Row(
                          children: [
                            const Icon(Icons.open_in_new, size: 14, color: Colors.blue),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                s['name']!,
                                style: const TextStyle(
                                  color: Colors.blue,
                                  fontSize: 13,
                                  decoration: TextDecoration.underline,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )),
                  if (_sourcesMedia.length > 10)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        '+ ${_sourcesMedia.length - 10} fontes adicionais',
                        style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                      ),
                    ),
                  if (_sourcesMedia.isEmpty)
                    Text(
                      'Dados coletados via Perplexity Search, Google News RSS, '
                      'portais de noticias regionais e SSPs.',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 32),

          // Action buttons
          FilledButton.icon(
            onPressed: _generatingLink ? null : _generateAndShareLink,
            icon: _generatingLink
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.share),
            label: Text(_generatingLink
                ? 'Gerando...'
                : 'Compartilhar Relatorio'),
          ),
          const SizedBox(height: 12),
          if (_reportUrl != null)
            OutlinedButton.icon(
              onPressed: _openInBrowser,
              icon: const Icon(Icons.open_in_browser),
              label: const Text('Abrir Dashboard Completo'),
            ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;

  const _SummaryCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 20, color: Colors.grey[400]),
              const SizedBox(height: 8),
              Text(
                value,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                label,
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
