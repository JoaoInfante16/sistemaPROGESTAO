// Script SIMPLES para popular locations (campos minimos)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function seedLocations() {
  console.log('======================================');
  console.log('POPULANDO LOCATIONS (campos minimos)');
  console.log('======================================\n');

  // 1. Estado São Paulo
  console.log('[1/3] Criando estado: Sao Paulo...');
  const { data: sp, error: spError } = await supabase
    .from('monitored_locations')
    .insert({
      type: 'state',
      name: 'São Paulo',
      active: true,
    })
    .select()
    .single();

  if (spError) {
    console.error('   [ERRO]', spError.message);
    console.log('\n[IMPORTANTE] Execute o schema.sql no Supabase primeiro!');
    return;
  }

  console.log('   [OK] ID:', sp.id);

  // 2. Cidade São Paulo
  console.log('[2/3] Criando cidade: Sao Paulo...');
  const { data: spCity, error: spCityError } = await supabase
    .from('monitored_locations')
    .insert({
      type: 'city',
      name: 'São Paulo',
      parent_id: sp.id,
      active: true,
    })
    .select()
    .single();

  if (spCityError) {
    console.error('   [ERRO]', spCityError.message);
    return;
  }

  console.log('   [OK] ID:', spCity.id);

  // 3. Cidade Campinas
  console.log('[3/3] Criando cidade: Campinas...');
  const { data: campinas, error: campinasError } = await supabase
    .from('monitored_locations')
    .insert({
      type: 'city',
      name: 'Campinas',
      parent_id: sp.id,
      active: true,
    })
    .select()
    .single();

  if (campinasError) {
    console.error('   [ERRO]', campinasError.message);
    return;
  }

  console.log('   [OK] ID:', campinas.id);

  // Verificar
  console.log('\n======================================');
  console.log('SUCESSO!');
  console.log('======================================');
  console.log('Estado: Sao Paulo');
  console.log('Cidades: Sao Paulo, Campinas (ambas ativas)');
  console.log('======================================');
}

seedLocations();
