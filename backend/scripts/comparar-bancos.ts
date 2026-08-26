// ============================================
// Comparar dois bancos peca a peca — SO LEITURA
// ============================================
// O portao da separacao de ambientes. `exportar-schema.ts` gera o DDL a partir
// dos emissores do proprio Postgres, o que e exato — mas "exato" e uma
// afirmacao, e afirmacao sem medida e o que a regra zero da workdesk proibe.
// Este script MEDE: monta o mesmo inventario nos dois bancos e diffa.
//
// Compara: tabelas, colunas (tipo/notnull/default), constraints, indices,
// views, funcoes proprias, triggers, flags de RLS, policies e grants.
// NAO compara dados — para isso, `contar-linhas` no fim.
//
// Uso:
//   npx tsx scripts/comparar-bancos.ts
//   (DATABASE_URL = A, STAGING_DATABASE_URL = B)

import { Client } from 'pg';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: resolve(__dirname, '../.env.staging') });
// Desde 26/08 o `.env` aponta para STAGING. Producao virou PROD_*, explicita.
dotenv.config({ path: resolve(__dirname, '../.env.production') });

/** Um inventario e um mapa "chave legivel" -> "definicao". Diffar mapa e trivial. */
type Inventario = Map<string, string>;

async function inventariar(url: string): Promise<{ inv: Inventario; host: string }> {
  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await c.connect();
  const inv: Inventario = new Map();
  const q = async (sql: string) => (await c.query(sql)).rows;

  for (const r of await q(
    `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'`
  )) {
    inv.set(`tabela ${r.relname}`, 'existe');
  }

  for (const r of await q(
    `select c.relname||'.'||a.attname as k,
            format_type(a.atttypid,a.atttypmod)
              ||' notnull='||a.attnotnull
              ||' default='||coalesce(pg_get_expr(d.adbin,d.adrelid),'-') as v
       from pg_attribute a
       join pg_class c on c.oid=a.attrelid
       join pg_namespace n on n.oid=c.relnamespace
       left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped`
  )) {
    inv.set(`coluna ${r.k}`, r.v);
  }

  for (const r of await q(
    `select c.relname||'.'||con.conname as k, pg_get_constraintdef(con.oid) as v
       from pg_constraint con
       join pg_class c on c.oid=con.conrelid
       join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and con.contype in ('p','u','c','f')`
  )) {
    inv.set(`constraint ${r.k}`, r.v);
  }

  for (const r of await q(
    `select ic.relname as k, pg_get_indexdef(i.indexrelid) as v
       from pg_index i
       join pg_class t on t.oid=i.indrelid
       join pg_class ic on ic.oid=i.indexrelid
       join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='public'`
  )) {
    inv.set(`indice ${r.k}`, r.v);
  }

  for (const r of await q(
    `select c.relname as k, pg_get_viewdef(c.oid,true) as v
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='v'`
  )) {
    inv.set(`view ${r.k}`, r.v.trim());
  }

  // Sem as de extensao — senao entram as ~120 do pgvector dos dois lados.
  for (const r of await q(
    `select p.proname as k, pg_get_functiondef(p.oid) as v
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`
  )) {
    inv.set(`funcao ${r.k}`, r.v.trim());
  }

  for (const r of await q(
    `select c.relname||'.'||t.tgname as k, pg_get_triggerdef(t.oid) as v
       from pg_trigger t
       join pg_class c on c.oid=t.tgrelid
       join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and not t.tgisinternal`
  )) {
    inv.set(`trigger ${r.k}`, r.v);
  }

  for (const r of await q(
    `select c.relname as k, c.relrowsecurity::text as v
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r'`
  )) {
    inv.set(`rls ${r.k}`, r.v === 'true' ? 'LIGADA' : 'DESLIGADA');
  }

  for (const r of await q(
    `select tablename||'.'||policyname as k,
            cmd||' to '||roles::text||' using '||coalesce(qual,'-')
              ||' check '||coalesce(with_check,'-') as v
       from pg_policies where schemaname='public'`
  )) {
    inv.set(`policy ${r.k}`, r.v);
  }

  for (const r of await q(
    `select table_name||' -> '||grantee as k,
            string_agg(distinct privilege_type,',' order by privilege_type) as v
       from information_schema.role_table_grants
      where table_schema='public' and grantee in ('anon','authenticated','service_role')
      group by table_name, grantee`
  )) {
    inv.set(`grant ${r.k}`, r.v);
  }

  const h = new URL(url).hostname;
  await c.end();
  return { inv, host: h };
}

async function main(): Promise<void> {
  const a = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  const b = process.env.STAGING_DATABASE_URL;
  if (!a) throw new Error('PROD_DATABASE_URL ausente — esperado em backend/.env.production');
  if (!b) throw new Error('STAGING_DATABASE_URL ausente — esperado em backend/.env.staging');
  // Sem esta trava, dois apontamentos iguais dao FALSO VERDE no portao: o
  // script diria "IDENTICOS" comparando um banco consigo mesmo, e a separacao
  // pareceria verificada sem nunca ter sido.
  // `--autoteste` existe justamente para o caso legitimo: apontar os dois lados
  // para o mesmo banco e conferir que o inventario e deterministico (foi assim
  // que este script foi validado em 26/08 — 350 objetos, zero diferenca).
  if (a === b && !process.argv.includes('--autoteste')) {
    throw new Error(
      'A e B sao a MESMA url — comparar um banco consigo mesmo sempre da "identicos".\n' +
        '  Se a intencao e testar o proprio script, repetir com --autoteste.'
    );
  }

  const A = await inventariar(a);
  const B = await inventariar(b);

  console.log(`A (origem):  ${A.host}  — ${A.inv.size} objetos`);
  console.log(`B (destino): ${B.host}  — ${B.inv.size} objetos\n`);

  const chaves = [...new Set([...A.inv.keys(), ...B.inv.keys()])].sort();
  const soA: string[] = [];
  const soB: string[] = [];
  const difere: string[] = [];

  for (const k of chaves) {
    const va = A.inv.get(k);
    const vb = B.inv.get(k);
    if (va === undefined) soB.push(k);
    else if (vb === undefined) soA.push(k);
    else if (va !== vb) difere.push(`${k}\n      A: ${va}\n      B: ${vb}`);
  }

  const mostrar = (titulo: string, lista: string[]) => {
    if (lista.length === 0) return;
    console.log(`${titulo} (${lista.length}):`);
    for (const x of lista) console.log(`  - ${x}`);
    console.log();
  };

  mostrar('SO EM A (falta no destino)', soA);
  mostrar('SO EM B (sobrando no destino)', soB);
  mostrar('DIFEREM', difere);

  const total = soA.length + soB.length + difere.length;
  if (total === 0) {
    console.log('✅ IDENTICOS. Os dois bancos tem a mesma estrutura.');
    process.exit(0);
  }
  console.log(`❌ ${total} diferenca(s).`);
  console.log(
    '   Diferenca de RLS nas 4 tabelas da migration 035 e ESPERADA ate ela rodar\n' +
      '   nos dois bancos. Qualquer outra coisa e problema.'
  );
  process.exit(1);
}

main().catch((e) => {
  console.error('ERRO:', (e as Error).message);
  process.exit(1);
});
