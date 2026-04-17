#!/usr/bin/env tsx
/**
 * Comparacao entre o prompt antigo e o novo do dedup camada 3.
 *
 * Uso:
 *   cd backend
 *   npx tsx scripts/test-dedup-prompt.ts
 *
 * Auto-contido: nao importa nada de src/. Os dois prompts estao hardcoded
 * aqui. A chave OPENAI_API_KEY vem do backend/.env via dotenv.
 */

import 'dotenv/config';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('[ERROR] OPENAI_API_KEY nao encontrada. Configure em backend/.env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ============================================
// PROMPT ANTIGO (antes da sessao 2026-04-16)
// ============================================
function oldPrompt(resumo1: string, resumo2: string): string {
  return `Do these two summaries describe the SAME criminal event?

Summary 1: "${resumo1}"
Summary 2: "${resumo2}"

Consider duplicate if:
- Location, date and crime type are identical
- Victims/suspects mentioned are the same
- Key details match

Answer ONLY "YES" or "NO":`;
}

// ============================================
// PROMPT NOVO (sessao 2026-04-16)
// ============================================
function newPrompt(resumo1: string, resumo2: string): string {
  return `You are comparing two news summaries that ALREADY share the same city, state, crime type and date. That is NOT sufficient to call them duplicates — two different crimes of the same type can happen on the same day in the same city.

Summary 1: "${resumo1}"
Summary 2: "${resumo2}"

They describe the SAME incident ONLY if the DISTINGUISHING DETAILS match:
- Exact location (neighborhood, street, establishment, landmark)
- Victims/suspects (names, ages, number of people, roles)
- Specific values (amounts stolen, injured count, weapons used)
- Modus operandi (how the crime happened — unique facts)
- Approximate time of day

If the two summaries describe DIFFERENT locations, DIFFERENT victims/suspects, DIFFERENT amounts, or DIFFERENT specifics, they are NOT duplicates, even if both are (for example) robberies in São Paulo today.

When in doubt, answer NO. A false "NO" just keeps two cards; a false "YES" loses an event permanently.

Answer ONLY "YES" or "NO":`;
}

// ============================================
// Test cases
// ============================================
interface TestCase {
  label: string;
  expected: 'YES' | 'NO';
  resumo1: string;
  resumo2: string;
}

const CASES: TestCase[] = [
  // ========== CLARO YES (3) — ambos prompts devem acertar ==========
  {
    label: 'Par 01 — YES claro: mesmo evento, veiculos diferentes',
    expected: 'YES',
    resumo1:
      'Assalto a joalheria Diamante em Copacabana, zona sul do Rio. Tres homens armados renderam funcionarios e levaram joias avaliadas em R$ 200 mil. Ocorrencia por volta das 14h30; trio fugiu em carro preto antes da chegada da PM.',
    resumo2:
      'Ladroes invadem joalheria no bairro de Copacabana. Prejuizo estimado em R$ 200 mil em pecas roubadas durante a tarde; tres assaltantes fugiram de carro.',
  },
  {
    label: 'Par 02 — YES claro: mesmo evento, escritas diferentes',
    expected: 'YES',
    resumo1:
      'Homicidio registrado no Jardim Angela, zona sul de Sao Paulo, na madrugada. Vitima, homem de 32 anos, foi atingida por disparos de arma de fogo dentro de um bar.',
    resumo2:
      'Tiroteio em bar do Jardim Angela deixa morto na zona sul paulistana. Homem de aproximadamente 30 anos foi alvejado com arma de fogo durante a madrugada de hoje.',
  },
  {
    label: 'Par 03 — YES claro: roubo de carro coberto por dois veiculos',
    expected: 'YES',
    resumo1:
      'Assalto a mao armada no Tatuape, zona leste de Sao Paulo. Motorista de 40 anos teve seu carro roubado por dois criminosos armados durante a noite.',
    resumo2:
      'Homem e rendido por dupla armada e tem automovel tomado no Tatuape durante a noite desta terca. Policia Militar foi acionada.',
  },

  // ========== CLARO NO (3) — ambos prompts devem acertar ==========
  {
    label: 'Par 04 — NO claro: crimes diferentes tipos distintos',
    expected: 'NO',
    resumo1:
      'Roubo a joalheria em Copacabana, zona sul do Rio. Criminosos armados levaram R$ 200 mil em joias durante a tarde.',
    resumo2:
      'Assalto a padaria em Botafogo, zona sul do Rio. Homem rendeu funcionario com faca e fugiu com R$ 300 do caixa na manha de hoje.',
  },
  {
    label: 'Par 05 — NO claro: crimes diferentes mesmo bairro, tipos diferentes',
    expected: 'NO',
    resumo1:
      'Assalto no Jardim Angela: homem de 30 anos foi abordado por dupla em motocicleta e teve celular e carteira roubados na manha desta quinta.',
    resumo2:
      'Homicidio no Jardim Angela: mulher de 50 anos foi morta a facadas dentro de casa. Marido e principal suspeito e foi detido pela policia.',
  },
  {
    label: 'Par 06 — NO claro: operacao policial vs assalto',
    expected: 'NO',
    resumo1:
      'Policia Militar prende traficantes em operacao no Jardim Ibirapuera: 50kg de cocaina apreendidos e 4 detidos.',
    resumo2:
      'Assalto em farmacia do Jardim Ibirapuera: homem armado leva R$ 2 mil em dinheiro do caixa durante a tarde.',
  },

  // ========== BORDERLINE NO (2) — velho provavelmente erra (YES) ==========
  {
    label: 'Par 07 — BORDERLINE NO: dois homicidios diferentes, mesmo bairro',
    expected: 'NO',
    resumo1:
      'Homicidio no Capao Redondo: homem de 45 anos foi morto a tiros dentro de casa durante a madrugada. Suspeito fugiu antes da chegada da policia.',
    resumo2:
      'Homicidio no Capao Redondo deixa mulher de 28 anos morta a facadas em via publica na manha de hoje. Marido e apontado como suspeito.',
  },
  {
    label: 'Par 08 — BORDERLINE NO: duas operacoes policiais mesma cidade',
    expected: 'NO',
    resumo1:
      'Operacao policial no Morro do Alemao termina com 3 presos e apreensao de drogas. Acao ocorreu na manha de hoje.',
    resumo2:
      'Policia faz operacao na Rocinha e prende 2 suspeitos de trafico. Acao ocorreu na tarde de hoje, com apreensao de armas.',
  },

  // ========== BORDERLINE YES (2) — novo pode errar (NO) ==========
  {
    label: 'Par 09 — BORDERLINE YES: mesmo evento, valores em formatos diferentes',
    expected: 'YES',
    resumo1:
      'Assalto a joalheria em Ipanema: criminosos levaram joias avaliadas em R$ 200 mil. Tres homens armados fugiram em carro preto durante a tarde.',
    resumo2:
      'Tres ladroes invadem joalheria de Ipanema e fogem com prejuizo estimado em cerca de R$ 200 mil. Ocorrencia registrada por volta das 15h.',
  },
  {
    label: 'Par 10 — BORDERLINE YES: mesmo evento, idade aproximada',
    expected: 'YES',
    resumo1:
      'Homicidio em Sao Goncalo: homem de 35 anos foi baleado em frente a um bar e nao resistiu aos ferimentos.',
    resumo2:
      'Tiroteio em bar de Sao Goncalo deixa um morto. Vitima, de aproximadamente 30 anos, morreu no local apos ser alvejada.',
  },
];

// ============================================
// Runner
// ============================================
async function askGPT(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 5,
    temperature: 0,
  });
  return (response.choices[0].message.content || '').trim().toUpperCase();
}

interface Result {
  label: string;
  expected: string;
  oldAns: string;
  newAns: string;
  oldOk: boolean;
  newOk: boolean;
}

async function main(): Promise<void> {
  console.log('\n=== Teste comparativo do prompt de dedup (camada 3) ===');
  console.log(`Modelo: ${MODEL}`);
  console.log(`Casos: ${CASES.length}\n`);

  const results: Result[] = [];

  for (const tc of CASES) {
    process.stdout.write(`  ${tc.label}... `);
    const [oldAns, newAns] = await Promise.all([
      askGPT(oldPrompt(tc.resumo1, tc.resumo2)),
      askGPT(newPrompt(tc.resumo1, tc.resumo2)),
    ]);
    const oldOk = oldAns === tc.expected;
    const newOk = newAns === tc.expected;
    results.push({ label: tc.label, expected: tc.expected, oldAns, newAns, oldOk, newOk });
    console.log(`old=${oldAns.padEnd(3)} (${oldOk ? 'OK' : 'X '})  new=${newAns.padEnd(3)} (${newOk ? 'OK' : 'X '})`);
  }

  const oldHits = results.filter((r) => r.oldOk).length;
  const newHits = results.filter((r) => r.newOk).length;

  console.log('\n=== Resumo ===');
  console.log(`Prompt antigo: ${oldHits}/${results.length} acertos`);
  console.log(`Prompt novo:   ${newHits}/${results.length} acertos`);

  const regressions = results.filter((r) => r.oldOk && !r.newOk);
  if (regressions.length > 0) {
    console.log(`\n[REGRESSAO] Prompt novo piorou em ${regressions.length} caso(s):`);
    for (const r of regressions) console.log(`  - ${r.label}  (esperado ${r.expected}, novo disse ${r.newAns})`);
  }

  const gains = results.filter((r) => !r.oldOk && r.newOk);
  if (gains.length > 0) {
    console.log(`\n[GANHO] Prompt novo corrigiu em ${gains.length} caso(s):`);
    for (const r of gains) console.log(`  - ${r.label}  (esperado ${r.expected}, antigo dava ${r.oldAns})`);
  }

  if (regressions.length === 0 && newHits === results.length) {
    console.log('\nOK — prompt novo passou em todos os casos sem regressao.');
  }
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
