// ============================================
// Desativa noticias de cidade que NINGUEM monitora (Fase 11, achado #1)
// ============================================
// O pos-filtro aceitava cidade por substring, entao `São José do Cedro` entrou
// pelo scan de `São José`. O conserto no codigo (utils/helpers.mesmaCidade)
// impede novas; este script trata as que ja estao gravadas.
//
// NAO deleta: marca `active = false`. O feed filtra por `active`, entao somem da
// vista na hora e a volta e um UPDATE.
//
// Uso:
//   npx tsx scripts/limpar-cidades-intrusas.ts            → dry-run (so lista)
//   npx tsx scripts/limpar-cidades-intrusas.ts --aplicar   → desativa
//   npx tsx scripts/limpar-cidades-intrusas.ts --reverter  → religa o que este script desativou

import { supabase } from '../src/config/database';
import { mesmaCidade } from '../src/utils/helpers';

const APLICAR = process.argv.includes('--aplicar');
const REVERTER = process.argv.includes('--reverter');

async function main() {
  const { data: locs, error: eLoc } = await supabase
    .from('monitored_locations')
    .select('name, type, active');
  if (eLoc) throw new Error(`monitored_locations: ${eLoc.message}`);

  const cidadesMonitoradas = (locs || []).filter((l) => l.type === 'city').map((l) => l.name as string);
  console.log(`\nCidades monitoradas (${cidadesMonitoradas.length}): ${cidadesMonitoradas.join(', ')}`);

  if (REVERTER) {
    const { data, error } = await supabase
      .from('news')
      .update({ active: true })
      .eq('active', false)
      .select('id, cidade');
    if (error) throw new Error(error.message);
    console.log(`\n↩️  ${data?.length || 0} noticias religadas (active = true).`);
    return;
  }

  const { data: news, error } = await supabase
    .from('news')
    .select('id, cidade, estado, tipo_crime, data_ocorrencia, active');
  if (error) throw new Error(`news: ${error.message}`);

  // Intrusa = cidade que nao casa com NENHUMA monitorada pela regra nova.
  const intrusas = (news || []).filter(
    (n) => n.active !== false && !cidadesMonitoradas.some((m) => mesmaCidade(n.cidade as string, m, (n.estado as string) || undefined))
  );

  const porCidade = new Map<string, number>();
  for (const n of intrusas) {
    const k = `${n.cidade} / ${n.estado || '?'}`;
    porCidade.set(k, (porCidade.get(k) || 0) + 1);
  }

  console.log(`\nTotal de noticias ativas: ${(news || []).filter((n) => n.active !== false).length}`);
  console.log(`Intrusas (cidade nao monitorada): ${intrusas.length}\n`);
  if (porCidade.size === 0) {
    console.log('  Nada a fazer.');
    return;
  }
  console.table([...porCidade.entries()].sort((a, b) => b[1] - a[1]).map(([cidade, qtd]) => ({ cidade, qtd })));

  if (!APLICAR) {
    console.log('\n⚠️  DRY-RUN. Rode com --aplicar pra desativar.');
    return;
  }

  const ids = intrusas.map((n) => n.id as string);
  const { error: eUp } = await supabase.from('news').update({ active: false }).in('id', ids);
  if (eUp) throw new Error(`update falhou: ${eUp.message}`);
  console.log(`\n✅ ${ids.length} noticias desativadas (active = false). Reversivel com --reverter.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
