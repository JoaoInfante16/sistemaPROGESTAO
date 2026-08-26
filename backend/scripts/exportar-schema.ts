// ============================================
// Exportar o schema REAL do banco — SO LEITURA
// ============================================
// Gera o DDL para recriar o banco em outro projeto Supabase (staging).
//
// 🚨 POR QUE NAO USAR AS MIGRATIONS: `src/database/schema.sql` declara 14
// tabelas e o banco tem 19 (faltam city_groups, city_group_members,
// billing_history, executive_cache, user_notification_prefs). E o replay das
// migrations do zero quebra na 010 (ver DEV_LOG). Reconstruir a partir dos
// arquivos produz um banco ERRADO, e o erro so aparece testando.
//
// 🚨 POR QUE NAO USAR pg_dump: nao existe pg_dump, psql, Docker nem Supabase
// CLI utilizavel nesta maquina (o `supabase db dump` exige Docker).
//
// A saida NAO e aproximada. Cada peca sai de um emissor de DDL do proprio
// Postgres — `pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_viewdef`,
// `pg_get_functiondef`, `pg_get_triggerdef` — que sao as MESMAS funcoes que o
// pg_dump chama por dentro. O que muda e so quem imprime.
//
// Uso:
//   npx tsx scripts/exportar-schema.ts [arquivo-de-saida]
//   (le DATABASE_URL do .env; default: ../workdesk/SQL/schema_staging.sql)

import { Client } from 'pg';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config();
// Desde 26/08 o `.env` aponta para STAGING — o dev local nao escreve mais em
// producao. Ler producao virou coisa explicita: PROD_* mora no .env.production.
dotenv.config({ path: resolve(__dirname, '../.env.production') });

/** A origem e producao. Cair no DATABASE_URL do .env e so o modo antigo. */
function urlOrigem(): string | undefined {
  return process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
}

// Extensoes que o Supabase ja instala em projeto novo. Emitir `CREATE
// EXTENSION` para elas so gera ruido ou erro de permissao — `supabase_vault`
// mora num schema que o dono do banco nao controla.
const EXTENSOES_GERENCIADAS = new Set(['plpgsql', 'supabase_vault', 'pg_stat_statements']);

/** Aspas duplas em identificador, sempre — nome com maiuscula ou reservado quebra sem elas. */
function id(nome: string): string {
  return `"${nome.replace(/"/g, '""')}"`;
}

interface Coluna {
  tabela: string;
  nome: string;
  tipo: string;
  notnull: boolean;
  padrao: string | null;
  identidade: string;
  gerada: string;
}

async function main(): Promise<void> {
  const saida = resolve(
    process.argv[2] || resolve(__dirname, '../../workdesk/SQL/schema_staging.sql')
  );

  const url = urlOrigem();
  if (!url) throw new Error('PROD_DATABASE_URL (.env.production) nem DATABASE_URL (.env) definidas');

  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await c.connect();

  const q = async <T = Record<string, unknown>>(sql: string, p?: unknown[]): Promise<T[]> =>
    (await c.query(sql, p)).rows as T[];

  const proj = (process.env.PROD_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(
    /https:\/\/([^.]+)\..*/,
    '$1'
  );
  const out: string[] = [];
  const L = (s = '') => out.push(s);

  L('-- =========================================================');
  L('-- SCHEMA extraido do banco VIVO — nao editar a mao');
  L(`-- Origem: projeto ${proj}`);
  L(`-- Gerado: ${new Date().toISOString()}`);
  L('-- Por: backend/scripts/exportar-schema.ts');
  L('--');
  L('-- Cada DDL abaixo saiu de um emissor do proprio Postgres');
  L('-- (pg_get_constraintdef / indexdef / viewdef / functiondef / triggerdef),');
  L('-- os mesmos que o pg_dump usa. Regerar em vez de editar.');
  L('-- =========================================================');
  L();
  // O default de varias colunas e `uuid_generate_v4()`, que mora no schema
  // `extensions` no Supabase. Sem isto no search_path, o CREATE TABLE falha.
  L('SET search_path = public, extensions;');
  L();

  // ---------- 1. EXTENSIONS ----------
  L('-- ---------- 1. EXTENSIONS ----------');
  const exts = await q<{ extname: string; nspname: string }>(
    `select e.extname, n.nspname
       from pg_extension e join pg_namespace n on n.oid = e.extnamespace
      order by e.extname`
  );
  for (const e of exts) {
    if (EXTENSOES_GERENCIADAS.has(e.extname)) {
      L(`-- (pulada, o Supabase ja instala) ${e.extname}`);
      continue;
    }
    L(`CREATE EXTENSION IF NOT EXISTS ${id(e.extname)} WITH SCHEMA ${id(e.nspname)};`);
  }
  L();

  // ---------- 2. TABELAS ----------
  L('-- ---------- 2. TABELAS ----------');
  const tabelas = (
    await q<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by c.relname`
    )
  ).map((r) => r.relname);

  const colunas = await q<Coluna>(
    `select c.relname                                as tabela,
            a.attname                                as nome,
            format_type(a.atttypid, a.atttypmod)     as tipo,
            a.attnotnull                             as notnull,
            pg_get_expr(d.adbin, d.adrelid)          as padrao,
            a.attidentity                            as identidade,
            a.attgenerated                           as gerada
       from pg_attribute a
       join pg_class     c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where n.nspname = 'public' and c.relkind = 'r'
        and a.attnum > 0 and not a.attisdropped
      order by c.relname, a.attnum`
  );

  for (const t of tabelas) {
    const cols = colunas.filter((x) => x.tabela === t);
    L(`CREATE TABLE IF NOT EXISTS public.${id(t)} (`);
    const linhas = cols.map((col) => {
      let s = `  ${id(col.nome)} ${col.tipo}`;
      if (col.identidade === 'a') s += ' GENERATED ALWAYS AS IDENTITY';
      else if (col.identidade === 'd') s += ' GENERATED BY DEFAULT AS IDENTITY';
      else if (col.gerada === 's' && col.padrao) s += ` GENERATED ALWAYS AS (${col.padrao}) STORED`;
      else if (col.padrao) s += ` DEFAULT ${col.padrao}`;
      if (col.notnull) s += ' NOT NULL';
      return s;
    });
    L(linhas.join(',\n'));
    L(');');
    L();
  }

  // ---------- 3. CONSTRAINTS ----------
  // Ordem importa: PK e UNIQUE antes das FK que apontam pra elas. CHECK no meio
  // (nao depende de nada). NOT NULL nao entra aqui — ja saiu inline no CREATE.
  L('-- ---------- 3. CONSTRAINTS (PK -> UNIQUE -> CHECK -> FK) ----------');
  const cons = await q<{ tabela: string; nome: string; def: string; tipo: string }>(
    `select c.relname as tabela, con.conname as nome,
            pg_get_constraintdef(con.oid) as def, con.contype::text as tipo
       from pg_constraint con
       join pg_class     c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and con.contype in ('p','u','c','f')
      order by case con.contype
                 when 'p' then 1 when 'u' then 2 when 'c' then 3 else 4 end,
               c.relname, con.conname`
  );
  for (const k of cons) {
    L(`ALTER TABLE public.${id(k.tabela)} ADD CONSTRAINT ${id(k.nome)} ${k.def};`);
  }
  L();

  // ---------- 4. INDICES ----------
  // So os que NAO pertencem a constraint — o ADD CONSTRAINT acima ja cria o
  // indice da PK e do UNIQUE, e recriar daria erro de nome duplicado.
  // Inclui o HNSW do pgvector, que e o que faz o dedup ser rapido.
  L('-- ---------- 4. INDICES (os de constraint saem no passo 3) ----------');
  const idx = await q<{ def: string }>(
    `select pg_get_indexdef(i.indexrelid) as def
       from pg_index     i
       join pg_class     t on t.oid = i.indrelid
       join pg_class     ic on ic.oid = i.indexrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and not exists (select 1 from pg_constraint con where con.conindid = i.indexrelid)
      order by t.relname, ic.relname`
  );
  for (const i of idx) L(`${i.def};`);
  L();

  // ---------- 5. VIEWS ----------
  L('-- ---------- 5. VIEWS ----------');
  const views = await q<{ nome: string; def: string }>(
    `select c.relname as nome, pg_get_viewdef(c.oid, true) as def
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v' order by c.relname`
  );
  for (const v of views) L(`CREATE OR REPLACE VIEW public.${id(v.nome)} AS\n${v.def}\n`);
  L();

  // ---------- 6. FUNCOES ----------
  // `deptype='e'` exclui o que pertence a extensao — sem isso saem as ~120
  // funcoes do pgvector, que o CREATE EXTENSION ja trouxe.
  L('-- ---------- 6. FUNCOES (as de extensao ficam de fora) ----------');
  const fns = await q<{ def: string }>(
    `select pg_get_functiondef(p.oid) as def
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and not exists (select 1 from pg_depend d
                         where d.objid = p.oid and d.deptype = 'e')
      order by p.proname`
  );
  for (const f of fns) L(`${f.def};\n`);
  L();

  // ---------- 7. TRIGGERS ----------
  L('-- ---------- 7. TRIGGERS ----------');
  const trg = await q<{ def: string }>(
    `select pg_get_triggerdef(t.oid) as def
       from pg_trigger   t
       join pg_class     c on c.oid = t.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal
      order by c.relname, t.tgname`
  );
  for (const t of trg) L(`${t.def};`);
  L();

  // ---------- 8. RLS ----------
  // Retrato do que o banco de origem tem HOJE. As 4 tabelas que estao abertas
  // (reports, billing_history, city_groups, city_group_members) seguem abertas
  // aqui de proposito: quem fecha e a migration 035, nos DOIS bancos, para a
  // mudanca ter um lugar so e ficar registrada no MIGRATIONS_LOG.
  L('-- ---------- 8. RLS (retrato da origem; a 035 fecha o resto) ----------');
  const rls = await q<{ relname: string; ativa: boolean }>(
    `select c.relname, c.relrowsecurity as ativa
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by c.relname`
  );
  for (const r of rls) {
    if (r.ativa) L(`ALTER TABLE public.${id(r.relname)} ENABLE ROW LEVEL SECURITY;`);
    else L(`-- ${r.relname}: RLS DESLIGADA na origem (a 035 fecha)`);
  }
  L();

  // ---------- 9. POLICIES ----------
  L('-- ---------- 9. POLICIES ----------');
  const pols = await q<{
    tablename: string;
    policyname: string;
    permissive: string;
    roles: string[] | string;
    cmd: string;
    qual: string | null;
    with_check: string | null;
  }>(`select tablename, policyname, permissive, roles, cmd, qual, with_check
        from pg_policies where schemaname = 'public'
       order by tablename, policyname`);
  for (const p of pols) {
    // `pg_policies.roles` e `name[]`, e o driver as vezes devolve o literal
    // cru do Postgres (`{anon,authenticated}`) em vez de array.
    const papeis = Array.isArray(p.roles)
      ? p.roles
      : String(p.roles).replace(/^\{|\}$/g, '').split(',').filter(Boolean);

    let s = `CREATE POLICY ${id(p.policyname)} ON public.${id(p.tablename)}`;
    s += `\n  AS ${p.permissive}`;
    s += `\n  FOR ${p.cmd}`;
    s += `\n  TO ${papeis.join(', ')}`;
    if (p.qual) s += `\n  USING (${p.qual})`;
    if (p.with_check) s += `\n  WITH CHECK (${p.with_check})`;
    L(`${s};`);
  }
  if (pols.length === 0) L('-- (nenhuma policy na origem)');
  L();

  // ---------- 10. GRANTS ----------
  // O Supabase tem default privileges que ja concedem a anon/authenticated/
  // service_role em tabela nova. Emitir explicitamente mesmo assim: se o
  // default nao pegar, o PostgREST responde permission denied e o app quebra
  // com uma mensagem que nao aponta pra causa.
  L('-- ---------- 10. GRANTS (paridade com a origem) ----------');
  const grants = await q<{ table_name: string; grantee: string; privs: string }>(
    `select table_name, grantee, string_agg(distinct privilege_type, ', ' order by privilege_type) as privs
       from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
      group by table_name, grantee
      order by table_name, grantee`
  );
  for (const g of grants) {
    L(`GRANT ${g.privs} ON public.${id(g.table_name)} TO ${id(g.grantee)};`);
  }
  L();

  L('-- ---------- fim ----------');

  writeFileSync(saida, out.join('\n'), 'utf8');
  await c.end();

  console.log(`Origem: projeto ${proj}`);
  console.log(`Saida:  ${saida}`);
  console.log(
    `  ${exts.length} extensions (${exts.filter((e) => EXTENSOES_GERENCIADAS.has(e.extname)).length} puladas), ` +
      `${tabelas.length} tabelas, ${colunas.length} colunas`
  );
  console.log(
    `  ${cons.length} constraints, ${idx.length} indices, ${views.length} views, ` +
      `${fns.length} funcoes, ${trg.length} triggers`
  );
  console.log(
    `  RLS ligada em ${rls.filter((r) => r.ativa).length}/${rls.length}, ` +
      `${pols.length} policies, ${grants.length} grants`
  );

  // O import de `pg` nao segura o event loop como o do pipelineCore, mas o
  // exit explicito e a regra da casa — dois timeouts ja foram gastos com isso.
  process.exit(0);
}

main().catch((e) => {
  console.error('ERRO:', (e as Error).message);
  process.exit(1);
});
