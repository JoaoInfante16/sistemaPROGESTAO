// ============================================
// Aplicar o schema exportado num banco de destino
// ============================================
// Le o .sql gerado por `exportar-schema.ts` e roda no banco apontado por
// STAGING_DATABASE_URL (backend/.env.staging), dentro de UMA transacao: ou
// entra inteiro, ou nao entra nada.
//
// 🚨 TRES TRAVAS, porque o custo de errar o destino aqui e destruir producao:
//   1. o destino sai de STAGING_DATABASE_URL — nunca de DATABASE_URL
//   2. se as duas URLs apontarem para o MESMO host, aborta
//   3. se o destino ja tiver tabela em `public`, aborta (a menos de --forcar)
//
// Uso:
//   npx tsx scripts/aplicar-schema.ts [arquivo.sql] [--forcar]

import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: resolve(__dirname, '../.env.staging') });
// Desde 26/08 o `.env` aponta para STAGING. Producao virou PROD_*, explicita —
// a trava do "mesmo host" abaixo precisa conhecer as DUAS para valer alguma coisa.
dotenv.config({ path: resolve(__dirname, '../.env.production') });

function host(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forcar = args.includes('--forcar');
  const arquivo = resolve(
    args.find((a) => !a.startsWith('--')) ||
      resolve(__dirname, '../../workdesk/SQL/schema_staging.sql')
  );

  const destino = process.env.STAGING_DATABASE_URL;
  const origem = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

  if (!destino) {
    throw new Error('STAGING_DATABASE_URL ausente — esperado em backend/.env.staging');
  }

  // TRAVA 2: mesmo host = mesmo banco. Nao existe motivo legitimo para isso.
  if (origem && host(origem) === host(destino)) {
    throw new Error(
      `RECUSADO: STAGING_DATABASE_URL aponta para o MESMO host de DATABASE_URL (${host(destino)}).\n` +
        '  Isto rodaria DDL de recriacao em producao.'
    );
  }

  const sql = readFileSync(arquivo, 'utf8');
  console.log(`Arquivo:  ${arquivo} (${sql.length} bytes)`);
  console.log(`Destino:  ${host(destino)}`);
  console.log(`Origem:   ${origem ? host(origem) : '(nao definida)'} — nao sera tocada\n`);

  const c = new Client({
    connectionString: destino,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await c.connect();

  // TRAVA 3: banco de destino tem que estar limpo.
  const jaTem = (
    await c.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 1`
    )
  ).rows.map((r) => r.relname as string);

  if (jaTem.length > 0 && !forcar) {
    await c.end();
    throw new Error(
      `RECUSADO: o destino ja tem ${jaTem.length} tabela(s) em public: ${jaTem.slice(0, 6).join(', ')}${jaTem.length > 6 ? '...' : ''}\n` +
        '  Se for mesmo pra reaplicar por cima, repetir com --forcar.'
    );
  }

  try {
    await c.query('BEGIN');
    await c.query(sql);
    await c.query('COMMIT');
    console.log('✅ Aplicado e commitado.');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('❌ ROLLBACK — nada foi aplicado.');
    console.error(`   ${(e as Error).message}`);
    await c.end();
    process.exit(1);
  }

  const depois = (
    await c.query(
      `select count(*)::int n from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'`
    )
  ).rows[0].n;
  console.log(`   ${depois} tabelas em public no destino.`);
  console.log('\nProximo passo: npx tsx scripts/comparar-bancos.ts');

  await c.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('ERRO:', (e as Error).message);
  process.exit(1);
});
