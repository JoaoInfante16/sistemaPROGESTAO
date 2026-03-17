// Script para popular banco com locations iniciais
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function seedLocations() {
  console.log('======================================');
  console.log('POPULANDO BANCO COM LOCATIONS INICIAIS');
  console.log('======================================\n');

  // 1. Criar estado São Paulo
  console.log('[1/3] Criando estado: Sao Paulo...');
  const { data: sp, error: spError } = await supabase
    .from('monitored_locations')
    .insert({
      type: 'state',
      name: 'São Paulo',
      active: true,
      mode: 'any',
      scan_frequency_minutes: 60,
    })
    .select()
    .single();

  if (spError) {
    if (spError.message.includes('unique_location')) {
      console.log('   [INFO] Sao Paulo ja existe, pulando...');
      const { data: existing } = await supabase
        .from('monitored_locations')
        .select('id')
        .eq('name', 'São Paulo')
        .eq('type', 'state')
        .single();
      sp = existing;
    } else {
      console.error('   [ERRO]', spError.message);
      return;
    }
  } else {
    console.log('   [OK] Estado criado!');
  }

  const spId = sp.id;

  // 2. Criar cidade São Paulo (capital)
  console.log('[2/3] Criando cidade: Sao Paulo (capital)...');
  const { error: spCityError } = await supabase
    .from('monitored_locations')
    .insert({
      type: 'city',
      name: 'São Paulo',
      parent_id: spId,
      active: true,
      mode: 'any',
      keywords: null,
      scan_frequency_minutes: 60,
    });

  if (spCityError) {
    if (spCityError.message.includes('unique_location')) {
      console.log('   [INFO] Cidade Sao Paulo ja existe, pulando...');
    } else {
      console.error('   [ERRO]', spCityError.message);
      return;
    }
  } else {
    console.log('   [OK] Cidade criada!');
  }

  // 3. Criar cidade Campinas
  console.log('[3/3] Criando cidade: Campinas...');
  const { error: campinasError } = await supabase
    .from('monitored_locations')
    .insert({
      type: 'city',
      name: 'Campinas',
      parent_id: spId,
      active: true,
      mode: 'any',
      keywords: null,
      scan_frequency_minutes: 60,
    });

  if (campinasError) {
    if (campinasError.message.includes('unique_location')) {
      console.log('   [INFO] Campinas ja existe, pulando...');
    } else {
      console.error('   [ERRO]', campinasError.message);
      return;
    }
  } else {
    console.log('   [OK] Cidade criada!');
  }

  // Verificar resultado
  console.log('\n======================================');
  console.log('VERIFICANDO RESULTADO...');
  console.log('======================================\n');

  const { data: allLocs } = await supabase
    .from('monitored_locations')
    .select('*')
    .order('created_at');

  const states = allLocs.filter(l => l.type === 'state');
  const cities = allLocs.filter(l => l.type === 'city');
  const activeCities = cities.filter(l => l.active);

  console.log(`Estados: ${states.length}`);
  console.log(`Cidades: ${cities.length} (${activeCities.length} ativas)`);
  console.log('\nDetalhes:');
  allLocs.forEach(loc => {
    console.log(`  - ${loc.name} (${loc.type}, ${loc.active ? 'ATIVO' : 'INATIVO'})`);
  });

  console.log('\n======================================');
  console.log('PRONTO!');
  console.log('======================================');
}

seedLocations();
