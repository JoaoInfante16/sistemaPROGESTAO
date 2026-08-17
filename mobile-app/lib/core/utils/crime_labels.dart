// Labels de tipo_crime (campo granular) — fonte única.
// city_card e news_detail_sheet ainda carregam mapas próprios; migram para cá
// na etapa do redesign dos cards.

// ⚠️ Segunda cópia da tabela que vive em `backend/src/utils/types.ts`
// (`TIPO_CRIME_LABEL`). As duas precisam mudar juntas. Unificar via
// `GET /settings/taxonomia`, que o app já consome, está anotado no ROADMAP.
//
// 🚨 `roubo_furto` mostra **"Roubo"** por decisão do João em 14/08. A chave não
// muda — o banco, o prompt do Filter2 e as linhas gravadas continuam iguais.
const crimeTypeLabels = <String, String>{
  'roubo_furto': 'Roubo',
  'vandalismo': 'Vandalismo',
  'invasao': 'Invasão',
  'homicidio': 'Homicídio',
  'latrocinio': 'Latrocínio',
  'lesao_corporal': 'Lesão Corporal',
  'trafico': 'Tráfico',
  'operacao_policial': 'Operação Policial',
  'greve': 'Greve',
  // Congelado em 17/08 — nada novo classifica aqui, mas linha antiga aponta.
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
