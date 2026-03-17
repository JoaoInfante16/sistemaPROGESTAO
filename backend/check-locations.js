// Script temporario para verificar locations no banco
require('dotenv').config({ path: '../backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkLocations() {
  const { data, error } = await supabase
    .from('monitored_locations')
    .select('*')
    .order('created_at');

  if (error) {
    console.error('ERRO:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('===================================');
    console.log('BANCO VAZIO!');
    console.log('Nenhuma location cadastrada.');
    console.log('===================================');
    return;
  }

  console.log('===================================');
  console.log('LOCATIONS NO BANCO:');
  console.log('===================================');

  data.forEach((loc, index) => {
    console.log(`\n[${index + 1}] ${loc.name}`);
    console.log(`    ID: ${loc.id}`);
    console.log(`    Tipo: ${loc.type}`);
    console.log(`    Ativo: ${loc.active ? 'SIM' : 'NAO'}`);
    console.log(`    Parent: ${loc.parent_id || '(sem parent)'}`);
    console.log(`    Mode: ${loc.mode || 'any'}`);
    console.log(`    Keywords: ${loc.keywords ? loc.keywords.join(', ') : '(nenhuma)'}`);
    console.log(`    Scan freq: ${loc.scan_frequency_minutes || 60} min`);
  });

  console.log('\n===================================');
  console.log(`TOTAL: ${data.length} registros`);

  const states = data.filter(l => l.type === 'state');
  const cities = data.filter(l => l.type === 'city');
  const activeCities = cities.filter(l => l.active);

  console.log(`Estados: ${states.length}`);
  console.log(`Cidades: ${cities.length} (${activeCities.length} ativas)`);
  console.log('===================================');
}

checkLocations();
