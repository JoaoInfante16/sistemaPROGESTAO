#!/usr/bin/env tsx
/**
 * Bateria do dedup contra o gabarito de producao.
 *
 * Uso:
 *   cd backend
 *   npx tsx scripts/test-dedup-gabarito.ts
 *
 * 🚨 RODA NAS DUAS ORDENS, e isso nao e zelo: em 17/08 o prompt do dedup dava
 * YES 5/5 num sentido e NO 5/5 no outro para o MESMO par, deterministicamente.
 * Uma bateria que so testa um lado teria passado.
 *
 * Somente leitura: le `news` e pergunta ao GPT. Nao grava nada.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { confirmDuplicateWithGPT } from '../src/services/deduplication';
import { CASOS, CASOS_COBRADOS, CasoDedup } from './dedup-casos-reais';

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

interface Linha {
  id: string;
  titulo: string | null;
  resumo: string;
  tipo_crime: string;
  cidade: string;
}

async function carregarLinhas(): Promise<Map<string, Linha>> {
  const { data, error } = await sb
    .from('news')
    .select('id, titulo, resumo, tipo_crime, cidade')
    .limit(3000);
  if (error) throw new Error(error.message);
  const porPrefixo = new Map<string, Linha>();
  for (const r of data as unknown as Linha[]) {
    porPrefixo.set(String(r.id).slice(0, 8), r);
  }
  return porPrefixo;
}

async function main() {
  const linhas = await carregarLinhas();
  let acertos = 0;
  let cobrados = 0;
  const falhas: string[] = [];

  for (const caso of CASOS as CasoDedup[]) {
    const a = linhas.get(caso.a);
    const b = linhas.get(caso.b);
    if (!a || !b) {
      console.log(`  ??  ${caso.a} / ${caso.b} — linha nao encontrada no banco (limpou?)`);
      continue;
    }

    const ab = await confirmDuplicateWithGPT(
      { titulo: a.titulo, resumo: a.resumo },
      { titulo: b.titulo, resumo: b.resumo },
    );
    const ba = await confirmDuplicateWithGPT(
      { titulo: b.titulo, resumo: b.resumo },
      { titulo: a.titulo, resumo: a.resumo },
    );

    const esperaIgual = caso.esperado === 'IGUAL';
    const okAB = ab.isDupe === esperaIgual;
    const okBA = ba.isDupe === esperaIgual;
    const ok = okAB && okBA;
    const simetrico = ab.isDupe === ba.isDupe;

    if (!caso.falhaConhecida) {
      cobrados++;
      if (ok) acertos++;
      else falhas.push(`${caso.a}/${caso.b} (esperado ${caso.esperado})`);
    }

    const marca = caso.falhaConhecida ? (ok ? 'BONUS' : 'known') : ok ? 'OK   ' : 'FALHA';
    const assimetria = simetrico ? '' : '  🚨 ASSIMETRICO';
    console.log(
      `  ${marca}  ${caso.esperado.padEnd(9)} A->B=${ab.isDupe ? 'YES' : 'NO '} B->A=${ba.isDupe ? 'YES' : 'NO '}${assimetria}`,
    );
    console.log(`         ${String(a.titulo).slice(0, 62)}`);
    console.log(`         ${String(b.titulo).slice(0, 62)}`);
    if (!ok && !caso.falhaConhecida) console.log(`         por que deveria: ${caso.porque.slice(0, 150)}`);
    console.log();
  }

  console.log('='.repeat(64));
  console.log(`  ${acertos}/${cobrados} nos casos cobrados`);
  const conhecidas = CASOS.length - CASOS_COBRADOS.length;
  if (conhecidas > 0) console.log(`  (${conhecidas} falha(s) conhecida(s) fora do criterio)`);
  if (falhas.length) {
    console.log('\n  FALHOU:');
    falhas.forEach((f) => console.log(`    ${f}`));
  }
  console.log('='.repeat(64));
  process.exit(acertos === cobrados ? 0 : 1);
}

main();
