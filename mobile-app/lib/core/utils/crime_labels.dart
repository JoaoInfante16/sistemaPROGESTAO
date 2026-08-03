// Labels de tipo_crime (campo granular) — fonte única.
// city_card e news_detail_sheet ainda carregam mapas próprios; migram para cá
// na etapa do redesign dos cards.

const crimeTypeLabels = <String, String>{
  'roubo_furto': 'Roubo/Furto',
  'vandalismo': 'Vandalismo',
  'invasao': 'Invasão',
  'homicidio': 'Homicídio',
  'latrocinio': 'Latrocínio',
  'lesao_corporal': 'Lesão Corporal',
  'trafico': 'Tráfico',
  'operacao_policial': 'Operação Policial',
  'manifestacao': 'Manifestação',
  'bloqueio_via': 'Bloqueio de Via',
  'estelionato': 'Estelionato',
  'receptacao': 'Receptação',
  'crime_ambiental': 'Crime Ambiental',
  'trabalho_irregular': 'Trabalho Irregular',
  'estatistica': 'Estatística',
  'outros': 'Outros',
};

String crimeTypeLabel(String? tipo) {
  if (tipo == null || tipo.isEmpty) return 'Outros';
  final key = tipo.toLowerCase().replaceAll(' ', '_');
  return crimeTypeLabels[key] ?? tipo;
}
