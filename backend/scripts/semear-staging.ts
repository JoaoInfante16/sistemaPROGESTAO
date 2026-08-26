// ============================================
// Semear o banco de staging com os dados de configuracao
// ============================================
// Copia de DATABASE_URL (origem) para STAGING_DATABASE_URL (destino) so o que
// staging precisa para funcionar. A escolha do que NAO vai e a parte importante.
//
// 🚨 O QUE FICA DE FORA, e por que:
//   user_devices      tokens de push REAIS. Um teste em staging viraria
//                     notificacao no aparelho do cliente.
//   user_profiles     credencial de cliente real em ambiente de teste. Staging
//   / auth.users      entra com `auth_required=false` (ver no fim do script).
//   user_news_read    FK para user_profiles, que nao vai.
//   budget_tracking   9021 linhas de historico operacional. Ruido.
//   operation_logs    2509, idem.
//   billing_history   historico financeiro do negocio.
//   reports           conteudo de relatorio de cliente.
//   search_cache      cache e historico de busca — se refazem sozinhos.
//   search_results
//   executive_cache
//   pipeline_rejected_urls  janela de 24h, se reenche na primeira varredura.
//
// Uso:
//   npx tsx scripts/semear-staging.ts

import { Client } from 'pg';
import { resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: resolve(__dirname, '../.env.staging') });
// Desde 26/08 o `.env` aponta para STAGING. Producao virou PROD_*, explicita.
dotenv.config({ path: resolve(__dirname, '../.env.production') });

interface Passo {
  tabela: string;
  /** Colunas zeradas na copia — FK para auth.users, que nao e copiada. */
  anular?: string[];
  /** ORDER BY na leitura. So importa onde a FK aponta pra propria tabela. */
  ordem?: string;
  porque: string;
}

// A ordem da lista E a ordem de insercao: pai antes de filho, sempre.
const PLANO: Passo[] = [
  {
    tabela: 'system_config',
    anular: ['updated_by'],
    porque: 'o backend le tudo daqui; sem isso staging cai nos defaults do codigo',
  },
  {
    tabela: 'api_rate_limits',
    anular: ['updated_by'],
    porque: 'concorrencia de OpenAI/Jina — a 027 e a 028 moram aqui',
  },
  {
    tabela: 'monitored_locations',
    // parent_id aponta pra propria tabela (estado <- cidade). Raiz primeiro.
    ordem: 'parent_id nulls first, created_at',
    porque: 'as cidades escaneadas',
  },
  { tabela: 'city_groups', porque: 'agrupamento do feed' },
  { tabela: 'city_group_members', porque: 'depende de city_groups + monitored_locations' },
  { tabela: 'news', porque: 'feed nao nasce vazio; leva o embedding pro dedup ter material' },
  { tabela: 'news_sources', porque: 'depende de news' },
];

function host(url: string): string {
  return new URL(url).hostname;
}

async function main(): Promise<void> {
  const origemUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  const destinoUrl = process.env.STAGING_DATABASE_URL;
  if (!origemUrl) throw new Error('PROD_DATABASE_URL ausente — esperado em backend/.env.production');
  if (!destinoUrl) throw new Error('STAGING_DATABASE_URL ausente — esperado em backend/.env.staging');

  if (host(origemUrl) === host(destinoUrl)) {
    throw new Error(`RECUSADO: origem e destino sao o MESMO host (${host(origemUrl)}).`);
  }

  const origem = new Client({ connectionString: origemUrl, ssl: { rejectUnauthorized: false } });
  const destino = new Client({ connectionString: destinoUrl, ssl: { rejectUnauthorized: false } });
  await origem.connect();
  await destino.connect();

  console.log(`Origem:  ${host(origemUrl)} (so leitura)`);
  console.log(`Destino: ${host(destinoUrl)}\n`);

  await destino.query('BEGIN');
  try {
    for (const passo of PLANO) {
      const { tabela, anular = [], ordem } = passo;

      const cols = (
        await origem.query(
          `select column_name from information_schema.columns
            where table_schema='public' and table_name=$1 order by ordinal_position`,
          [tabela]
        )
      ).rows.map((r) => r.column_name as string);

      const sel = cols
        .map((c) => (anular.includes(c) ? `null as "${c}"` : `"${c}"`))
        .join(', ');
      const linhas = (
        await origem.query(
          `select ${sel} from public."${tabela}"${ordem ? ` order by ${ordem}` : ''}`
        )
      ).rows;

      if (linhas.length === 0) {
        console.log(`  ${tabela.padEnd(22)} 0 linhas na origem — nada a copiar`);
        continue;
      }

      // O destino deve estar limpo, mas semear duas vezes nao pode duplicar.
      await destino.query(`TRUNCATE public."${tabela}" CASCADE`);

      // json_populate_recordset faz o casting de cada campo para o tipo da
      // coluna — inclusive `vector(1536)` do embedding, que volta da origem
      // como texto. Montar placeholder para 17 colunas x 324 linhas a mao seria
      // o mesmo trabalho com mais chance de erro.
      const LOTE = 50;
      for (let i = 0; i < linhas.length; i += LOTE) {
        const fatia = linhas.slice(i, i + LOTE);
        await destino.query(
          `insert into public."${tabela}"
           select * from json_populate_recordset(null::public."${tabela}", $1::json)`,
          [JSON.stringify(fatia)]
        );
      }

      const n = (await destino.query(`select count(*)::int n from public."${tabela}"`)).rows[0].n;
      const nota = anular.length ? `  (${anular.join(',')} anulada)` : '';
      console.log(`  ${tabela.padEnd(22)} ${String(n).padStart(4)} linhas${nota}`);
      if (n !== linhas.length) {
        throw new Error(`${tabela}: copiou ${n} mas a origem tinha ${linhas.length}`);
      }
    }

    // ---------- staging entra sem senha ----------
    // Decisao do Joao em 26/08. `auth_required` e lido pelo backend
    // (middleware/auth.ts) e obedecido pelo app (main.dart), entao staging abre
    // direto no feed. Producao segue `true` — agora sao bancos diferentes, que
    // e justamente o que a separacao destrava.
    await destino.query(
      `update public.system_config set value = 'false' where key = 'auth_required'`
    );
    const auth = (
      await destino.query(`select value from public.system_config where key='auth_required'`)
    ).rows[0];
    console.log(`\n  auth_required no destino: ${auth ? auth.value : '(chave ausente!)'}`);

    await destino.query('COMMIT');
    console.log('\n✅ Semeado e commitado.');
  } catch (e) {
    await destino.query('ROLLBACK');
    console.error('\n❌ ROLLBACK — nada foi gravado no destino.');
    console.error(`   ${(e as Error).message}`);
    await origem.end();
    await destino.end();
    process.exit(1);
  }

  await origem.end();
  await destino.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('ERRO:', (e as Error).message);
  process.exit(1);
});
