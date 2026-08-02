// ============================================
// Configs que o painel admin NAO enxerga — so leitura
// ============================================
// `configManager.getAll()` (o que alimenta o painel) le SO as linhas de
// `system_config`. Nao mescla o DEFAULTS do codigo. Entao toda chave que existe
// no codigo e nao no banco fica INVISIVEL no painel — e, se for boolean, o
// Switch aparece DESLIGADO mesmo com o comportamento LIGADO.
//
// Uso: npx tsx scripts/diagnostico-configs-painel.ts

import { supabase } from '../src/config/database';
import { DEFAULTS } from '../src/services/configManager';

async function main() {
  const { data, error } = await supabase.from('system_config').select('key, value, category');
  if (error) throw new Error(error.message);

  const noBanco = new Map((data || []).map((r) => [r.key as string, r.value as string]));
  const noCodigo = Object.keys(DEFAULTS);

  const invisiveis = noCodigo.filter((k) => !noBanco.has(k));
  const divergentes = noCodigo.filter((k) => noBanco.has(k) && noBanco.get(k) !== DEFAULTS[k]);
  const orfas = [...noBanco.keys()].filter((k) => !noCodigo.includes(k));

  console.log(`\nDEFAULTS no codigo: ${noCodigo.length}   |   linhas no banco: ${noBanco.size}`);

  console.log(`\n\n🔴 INVISIVEIS NO PAINEL (${invisiveis.length}) — existem no codigo, nao no banco`);
  console.log('   O painel nao mostra. Se for boolean, o Switch aparece DESLIGADO mesmo valendo o default.\n');
  for (const k of invisiveis) {
    const v = DEFAULTS[k];
    const mente = v === 'true' ? '  ⚠️ VALE true, painel mostraria DESLIGADO' : '';
    console.log(`   ${k.padEnd(38)} default=${String(v).padEnd(8)}${mente}`);
  }

  console.log(`\n\n⚠️  DIVERGENTES (${divergentes.length}) — banco manda, e discorda do codigo\n`);
  for (const k of divergentes) {
    console.log(`   ${k.padEnd(38)} banco=${String(noBanco.get(k)).padEnd(10)} codigo=${DEFAULTS[k]}`);
  }

  console.log(`\n\n🧹 ORFAS (${orfas.length}) — no banco, sem contrapartida no codigo\n`);
  for (const k of orfas) console.log(`   ${k.padEnd(38)} = ${noBanco.get(k)}`);
  console.log();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
