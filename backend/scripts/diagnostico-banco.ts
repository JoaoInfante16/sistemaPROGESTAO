// ============================================
// Diagnostico do banco — SO LEITURA
// ============================================
// Responde "quais migrations faltam?" e "esta tudo ok la?" olhando o estado real
// em vez do MIGRATIONS_LOG, que e preenchido a mao e por isso desatualiza.
//
// Nao altera NADA. Pode rodar a qualquer momento, inclusive contra producao.
//
// Uso: npx tsx scripts/diagnostico-banco.ts

import { supabase } from '../src/config/database';

const ok = (s: string) => `  ✅ ${s}`;
const nao = (s: string) => `  ❌ ${s}`;
const alerta = (s: string) => `  ⚠️  ${s}`;

/** Coluna existe? PostgREST devolve 42703 quando nao. */
async function temColuna(tabela: string, coluna: string): Promise<boolean | null> {
  const { error } = await supabase.from(tabela).select(coluna).limit(1);
  if (!error) return true;
  if (error.code === '42703' || /column .* does not exist/i.test(error.message)) return false;
  console.log(alerta(`nao consegui checar ${tabela}.${coluna}: ${error.message}`));
  return null;
}

async function temTabela(tabela: string): Promise<boolean | null> {
  const { error } = await supabase.from(tabela).select('*').limit(1);
  if (!error) return true;
  if (error.code === '42P01' || /does not exist/i.test(error.message)) return false;
  console.log(alerta(`nao consegui checar tabela ${tabela}: ${error.message}`));
  return null;
}

async function configs(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('system_config').select('key, value');
  if (error) throw new Error(`system_config ilegivel: ${error.message}`);
  return new Map((data || []).map((r) => [r.key as string, r.value as string]));
}

async function contar(tabela: string): Promise<number | null> {
  const { count, error } = await supabase.from(tabela).select('*', { count: 'exact', head: true });
  return error ? null : count ?? null;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || '';
  console.log(`Banco: ${url.replace(/https:\/\/([^.]+)\..*/, '$1')} (projeto)\n`);

  const cfg = await configs();

  // ---------- MIGRATIONS ----------
  console.log('MIGRATIONS PENDENTES (segundo o MIGRATIONS_LOG)\n');

  const estado = await temColuna('news', 'estado');
  console.log(`019 — news.estado`);
  console.log(estado === true ? ok('APLICADA') : estado === false ? nao('FALTA — cidades homonimas seguem sem desambiguacao no banco') : '');

  const resumoAgregado = await temColuna('news', 'resumo_agregado');
  console.log(`\n020 — DROP news.resumo_agregado`);
  console.log(resumoAgregado === false ? ok('APLICADA') : resumoAgregado === true ? nao('FALTA — coluna morta ainda existe (inofensiva, so ocupa espaco)') : '');

  const webToggle = cfg.has('manual_search_web_enabled');
  console.log(`\n021 — config manual_search_web_enabled`);
  console.log(webToggle
    ? ok(`APLICADA (valor: ${cfg.get('manual_search_web_enabled')})`)
    : nao('FALTA — o backend cai no default do codigo, entao nao quebra'));

  const execCache = await temTabela('executive_cache');
  const execSearchId = execCache ? await temColuna('executive_cache', 'search_id') : null;
  console.log(`\n021/022 — executive_cache`);
  console.log(execCache === true ? ok('tabela existe') : nao('tabela NAO existe'));
  if (execCache === true) {
    console.log(execSearchId === true ? ok('coluna search_id existe (022 aplicada)') : nao('FALTA a 022 — search_id ausente'));
  }

  // 023 (a desta sessao)
  console.log(`\n023 — teto aberto + horizonte + dedup GPT  [criada em 02/08]`);
  const base = cfg.get('manual_search_max_results_30d');
  const horizonte = cfg.get('manual_search_horizon_days');
  const dedupGpt = cfg.get('dedup_gpt_confirm_enabled');
  console.log(base === '0'
    ? ok('manual_search_max_results_30d = 0 (teto aberto)')
    : nao(`FALTA — manual_search_max_results_30d = ${base ?? 'ausente'}, deveria ser 0`));
  console.log(horizonte
    ? ok(`manual_search_horizon_days = ${horizonte}`)
    : nao('FALTA — manual_search_horizon_days ausente (backend cai no default 180)'));
  console.log(dedupGpt !== undefined
    ? ok(`dedup_gpt_confirm_enabled = ${dedupGpt}`)
    : nao('FALTA — dedup_gpt_confirm_enabled ausente (backend cai no default false)'));

  // ---------- CONFIGS QUE IMPORTAM ----------
  console.log('\n\nCONFIGS QUE MUDAM O COMPORTAMENTO HOJE\n');
  const mostrar = [
    'dedup_similarity_threshold',
    'manual_search_max_results_30d',
    'manual_search_web_enabled',
    'search_max_results',
    'scan_period_days',
    'scan_weekday_start', 'scan_weekday_end', 'scan_weekend_enabled',
    'monthly_budget_usd',
    'filter2_confidence_min',
    'push_enabled',
  ];
  for (const k of mostrar) {
    const v = cfg.get(k);
    console.log(`  ${k.padEnd(32)} ${v ?? '(ausente — usa default do codigo)'}`);
  }

  const mortas = [
    'manual_search_max_results_60d', 'manual_search_max_results_90d',
    'scan_cron_schedule', 'worker_concurrency', 'worker_max_per_minute',
    'scan_lock_ttl_minutes', 'budget_warning_threshold',
  ].filter((k) => cfg.has(k));
  if (mortas.length > 0) {
    console.log(`\n  ${mortas.length} config(s) morta(s) no banco (o backend nao le nenhuma):`);
    console.log(`    ${mortas.join(', ')}`);
  }

  // ---------- SAUDE ----------
  console.log('\n\nSAUDE DOS DADOS\n');
  // `user_devices`, nao `devices` — a tabela `devices` nao existe.
  for (const t of ['news', 'search_cache', 'search_results', 'monitored_locations', 'user_devices', 'budget_tracking']) {
    const n = await contar(t);
    console.log(`  ${t.padEnd(22)} ${n === null ? '(ilegivel)' : n} linhas`);
  }

  // Buscas presas
  const { data: presas } = await supabase
    .from('search_cache')
    .select('search_id, created_at, params')
    .eq('status', 'processing')
    .order('created_at', { ascending: false });
  console.log(`\n  buscas em 'processing': ${presas?.length ?? 0}`);
  for (const p of presas || []) {
    const min = Math.round((Date.now() - Date.parse(p.created_at as string)) / 60000);
    const flag = min > 20 ? '⚠️  FANTASMA' : 'recente';
    console.log(`    ${(p.params as { cidades?: string[] })?.cidades?.join(', ') ?? '?'} — ha ${min} min  ${flag}`);
  }

  // Auto-scan — as colunas sao (stage, urls_processed, news_found), NAO
  // (operation, status). Pedir coluna inexistente faz o PostgREST devolver erro
  // e o bloco inteiro sumir em silencio.
  const { data: scans, error: scanErr } = await supabase
    .from('operation_logs')
    .select('created_at, stage, urls_processed, news_found')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n  AUTO-SCAN — ultimas execucoes');
  if (scanErr) {
    console.log(alerta(`operation_logs ilegivel: ${scanErr.message}`));
  } else if (!scans?.length) {
    console.log(nao('nenhum operation_log — o scan nunca registrou nada'));
  } else {
    const h = Math.round((Date.now() - Date.parse(scans[0].created_at as string)) / 3600000);
    console.log(`    ultimo ha ${h}h (${String(scans[0].created_at).substring(0, 16)})`);
    const semNoticia = scans.filter((s) => Number(s.news_found) === 0).length;
    console.log(`    ${semNoticia} das ultimas ${scans.length} execucoes acharam ZERO noticias`);
    for (const s of scans.slice(0, 5)) {
      console.log(`      ${String(s.created_at).substring(0, 16)} | urls=${String(s.urls_processed).padStart(3)} | news=${s.news_found}`);
    }
  }

  // Custo do mes
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const { data: custos } = await supabase
    .from('budget_tracking')
    .select('cost_usd')
    .gte('created_at', inicioMes.toISOString());
  const total = (custos || []).reduce((s, c) => s + Number(c.cost_usd || 0), 0);
  console.log(`\n  custo do mes ate agora: $${total.toFixed(4)} (orcamento: $${cfg.get('monthly_budget_usd') ?? '?'})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
