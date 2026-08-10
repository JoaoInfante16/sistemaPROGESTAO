// Só leitura: quantas linhas de `news` têm manchete de verdade.
//
// Toda linha de `news` nasce do AUTO-SCAN — a busca manual grava em
// `search_results` e nunca toca nesta tabela (ver `manualSearchWorker`, que
// monta `finalResults` em vez de chamar `insertNews`). Então esta contagem é,
// literalmente, "o auto-scan está criando manchete?".
//
// `titulo` é null nas linhas anteriores à migration 029 — nelas o app compõe
// um título a partir de tipo + bairro. A quebra por dia mostra a virada.
//
// Uso: npx tsx scripts/diagnostico-manchetes.ts [dias]

import { supabase } from '../src/config/database';

const dias = Number(process.argv[2] || 14);

async function main(): Promise<void> {
  const desde = new Date(Date.now() - dias * 86400_000).toISOString();

  const { data, error } = await supabase
    .from('news')
    .select('titulo, cidade, created_at')
    .gte('created_at', desde)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const linhas = data ?? [];

  if (linhas.length === 0) {
    console.log(`Nenhuma linha em news nos últimos ${dias} dias.`);
    return;
  }

  const porDia = new Map<string, { total: number; comTitulo: number }>();
  for (const l of linhas) {
    const dia = (l.created_at as string).slice(0, 10);
    const acc = porDia.get(dia) ?? { total: 0, comTitulo: 0 };
    acc.total++;
    if (((l.titulo as string | null) ?? '').trim().length > 0) acc.comTitulo++;
    porDia.set(dia, acc);
  }

  console.log(`news nos últimos ${dias} dias — ${linhas.length} linhas\n`);
  console.log('DIA          TOTAL   COM MANCHETE');
  for (const [dia, v] of [...porDia.entries()].sort()) {
    const pct = ((v.comTitulo / v.total) * 100).toFixed(0);
    console.log(`${dia}   ${String(v.total).padStart(5)}   ${String(v.comTitulo).padStart(5)}  (${pct}%)`);
  }

  const comTitulo = linhas.filter((l) => ((l.titulo as string | null) ?? '').trim().length > 0);
  console.log(`\nAmostra das 5 manchetes mais recentes:`);
  for (const l of comTitulo.slice(0, 5)) {
    console.log(`  [${(l.created_at as string).slice(0, 16)}] ${l.cidade} — ${l.titulo}`);
  }

  const sem = linhas.length - comTitulo.length;
  if (sem > 0) {
    console.log(`\n${sem} linha(s) sem manchete. As 3 mais recentes:`);
    for (const l of linhas.filter((x) => !((x.titulo as string | null) ?? '').trim()).slice(0, 3)) {
      console.log(`  [${(l.created_at as string).slice(0, 16)}] ${l.cidade}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
