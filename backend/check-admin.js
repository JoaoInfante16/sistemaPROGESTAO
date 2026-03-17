// Verificar se usuario é admin
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkAdmin() {
  console.log('Verificando usuarios admin...\n');

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*');

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('NENHUM USUARIO NO BANCO!');
    console.log('Crie um usuario admin via Supabase Dashboard (Authentication)');
    return;
  }

  console.log('=== USUARIOS NO BANCO ===\n');
  data.forEach((user, i) => {
    console.log(`[${i + 1}] ${user.email}`);
    console.log(`    ID: ${user.id}`);
    console.log(`    Admin: ${user.is_admin ? 'SIM' : 'NAO'}`);
    console.log(`    Ativo: ${user.active ? 'SIM' : 'NAO'}`);
    console.log('');
  });

  const admins = data.filter(u => u.is_admin);
  console.log(`Total: ${data.length} usuarios (${admins.length} admins)`);
}

checkAdmin();
