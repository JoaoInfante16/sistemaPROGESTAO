// Leitura de timestamp vindo da API.
//
// ⚠️ O BACKEND MANDA DOIS FORMATOS DIFERENTES, e um deles mente:
//
//   escrito pelo Node   → "2026-08-03T22:02:58.123Z"   tem o Z, é UTC declarado
//   escrito pelo Postgres → "2026-07-21T15:43:54.493171"  SEM sufixo nenhum
//
// As colunas `created_at` são `TIMESTAMP` (sem time zone) com `DEFAULT NOW()`, e
// o servidor Supabase roda em UTC — então o valor guardado É UTC, só que sem
// marcador. `DateTime.parse` de uma string sem sufixo devolve um DateTime
// marcado como LOCAL, com os números de UTC dentro: a tela mostrava 15:43 pra
// uma busca das 12:43 de Brasília, 3 horas adiantada.
//
// `.toLocal()` sozinho não resolve — num DateTime já marcado como local ele é
// no-op. Tem que declarar o UTC ANTES de converter, que é o que esta função faz.
//
// Corrigir aqui e não no schema é deliberado: as colunas vivem no banco
// compartilhado que a `main` (produção, código de junho) também lê. Um
// `ALTER COLUMN ... timestamptz` mudaria o que a produção enxerga na hora, sem
// deploy — a armadilha nº 1 do projeto.
DateTime? parseApiDate(String? raw) {
  if (raw == null || raw.isEmpty) return null;

  // Já traz fuso (o `Z` do Node, ou um offset tipo `+00:00`)? Então o parse já
  // sabe o que fazer. O teste do offset olha só a parte da HORA, senão o hífen
  // da data (`2026-07-21`) seria confundido com um offset negativo.
  final horaIdx = raw.indexOf('T');
  final hora = horaIdx >= 0 ? raw.substring(horaIdx) : raw;
  final temFuso = hora.endsWith('Z') || hora.contains('+') || hora.contains('-');

  final parsed = DateTime.tryParse(temFuso ? raw : '${raw}Z');
  return parsed?.toLocal();
}
