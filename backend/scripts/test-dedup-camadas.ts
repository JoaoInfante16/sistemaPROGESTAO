// ============================================
// Regressao do dedup em camadas (Fase 8.3)
// ============================================
// Nao usa rede: embeddings sinteticos e a camada 3 (GPT) desligada, que e o
// default. Roda em milissegundos e trava os casos que o algoritmo antigo errava.
//
// O caso que motivou tudo: dois homicidios DIFERENTES, mesma cidade, datas
// diferentes. Os resumos sao quase iguais ("homem e morto a tiros em Salvador"),
// entao o cosine bate alto e o algoritmo antigo fundia os dois — perdendo uma
// ocorrencia real. Baixar o threshold pra 0.70 piorou isso; subir pra 0.80 nao
// resolvia. A trava geo-temporal resolve de graca.
//
// Uso: npx tsx scripts/test-dedup-camadas.ts

import { runIntraBatchDedupLayered } from '../src/jobs/pipeline/intraBatchDedupLayered';
import { ExtractedNews } from '../src/jobs/pipeline/pipelineCore';

const THRESHOLD = 0.70; // o valor que o Joao usa hoje

// Vetores sinteticos: `base` e `quaseIgual` batem ~0.999 de cosine — pior caso
// pro algoritmo antigo, porque nada alem da data distingue os dois eventos.
const base = [1, 0.5, 0.3, 0.9, 0.2];
const quaseIgual = [1, 0.5, 0.3, 0.9, 0.21];
const diferente = [0.1, 0.9, -0.4, 0.2, 0.8];

let n = 0;
let ok = 0;

function noticia(over: Partial<ExtractedNews> & { sourceUrl: string }): ExtractedNews {
  return {
    e_crime: true,
    tipo_crime: 'homicidio',
    natureza: 'ocorrencia',
    categoria_grupo: 'seguranca',
    cidade: 'Salvador',
    estado: 'Bahia',
    data_ocorrencia: '2026-07-20',
    resumo: 'Homem e morto a tiros',
    confianca: 0.9,
    embedding: base,
    sourceType: 'news',
    ...over,
  } as ExtractedNews;
}

async function caso(
  nome: string,
  itens: ExtractedNews[],
  esperado: number,
  checar?: (r: Awaited<ReturnType<typeof runIntraBatchDedupLayered>>) => string | null,
): Promise<void> {
  n++;
  const r = await runIntraBatchDedupLayered(itens, '[teste]', { similarityThreshold: THRESHOLD });
  const erroExtra = checar ? checar(r) : null;

  if (r.consolidated.length === esperado && !erroExtra) {
    ok++;
    console.log(`  ✅ ${nome}`);
  } else {
    console.log(`  ❌ ${nome}`);
    console.log(`       esperado ${esperado} resultado(s), veio ${r.consolidated.length}`);
    if (erroExtra) console.log(`       ${erroExtra}`);
  }
}

async function main(): Promise<void> {
  console.log(`Dedup em camadas — threshold ${THRESHOLD}, camada 3 desligada\n`);

  // 1. O CASO QUE QUEBRAVA
  await caso(
    'crimes iguais em DATAS diferentes nao se fundem',
    [
      noticia({ sourceUrl: 'a', data_ocorrencia: '2026-07-20', embedding: base }),
      noticia({ sourceUrl: 'b', data_ocorrencia: '2026-07-25', embedding: quaseIgual }),
    ],
    2,
  );

  // 2. O que TEM que continuar fundindo
  await caso(
    'mesmo evento por dois veiculos se funde',
    [
      noticia({ sourceUrl: 'g1', embedding: base, confianca: 0.9 }),
      noticia({ sourceUrl: 'folha', embedding: quaseIgual, confianca: 1 }),
    ],
    1,
    (r) => (r.consolidated[0].sources.length === 2 ? null : `sources deveria ter 2, tem ${r.consolidated[0].sources.length}`),
  );

  // 3. Tolerancia de 1 dia entre veiculos
  await caso(
    'mesmo evento com 1 dia de diferenca se funde',
    [
      noticia({ sourceUrl: 'a', data_ocorrencia: '2026-07-20', embedding: base }),
      noticia({ sourceUrl: 'b', data_ocorrencia: '2026-07-21', embedding: quaseIgual }),
    ],
    1,
  );

  // 4. Bairro distingue
  await caso(
    'mesmo dia e tipo, BAIRROS diferentes, nao se fundem',
    [
      noticia({ sourceUrl: 'a', bairro: 'Cabula', embedding: base }),
      noticia({ sourceUrl: 'b', bairro: 'Pituba', embedding: quaseIgual }),
    ],
    2,
  );

  // 5. Bairro nulo e tolerante (o cosine decide)
  await caso(
    'bairro ausente em um dos dois nao impede a fusao',
    [
      noticia({ sourceUrl: 'a', bairro: 'Cabula', embedding: base }),
      noticia({ sourceUrl: 'b', embedding: quaseIgual }),
    ],
    1,
  );

  // 6. Tipo de crime distingue
  await caso(
    'tipos de crime diferentes nao se fundem',
    [
      noticia({ sourceUrl: 'a', tipo_crime: 'homicidio', embedding: base }),
      noticia({ sourceUrl: 'b', tipo_crime: 'roubo_furto', embedding: quaseIgual }),
    ],
    2,
  );

  // 7. Cidade vizinha nunca se funde com a principal
  await caso(
    'cidade vizinha nao e absorvida pela principal',
    [
      noticia({ sourceUrl: 'a', cidade: 'Salvador', embedding: base }),
      noticia({ sourceUrl: 'b', cidade: 'Camaçari', cidade_vizinha: true, embedding: quaseIgual }),
    ],
    2,
    (r) => {
      const principais = r.consolidated.filter((c) => !c.cidade_vizinha);
      return principais.length === 1 ? null : `deveria sobrar 1 principal, sobrou ${principais.length}`;
    },
  );

  // 8. A regra inclusiva na fronteira da janela
  await caso(
    'evento na fronteira vira PRINCIPAL, nao "fora do periodo"',
    [
      // O de fora tem confianca MAIOR — no algoritmo antigo ele seria o lider e
      // levaria o cluster inteiro pra fora do periodo.
      noticia({ sourceUrl: 'fora', data_ocorrencia: '2026-07-20', fora_do_periodo: true, confianca: 1, embedding: base }),
      noticia({ sourceUrl: 'dentro', data_ocorrencia: '2026-07-21', confianca: 0.8, embedding: quaseIgual }),
    ],
    1,
    (r) => (r.consolidated[0].fora_do_periodo ? 'cluster ficou marcado como fora do periodo' : null),
  );

  // 9. Sem parentesco semantico, nada se funde
  await caso(
    'mesma cidade e dia, mas assuntos diferentes, nao se fundem',
    [
      noticia({ sourceUrl: 'a', embedding: base }),
      noticia({ sourceUrl: 'b', embedding: diferente }),
    ],
    2,
  );

  // 10. Cluster de tres
  await caso(
    'tres veiculos do mesmo evento viram um so',
    [
      noticia({ sourceUrl: 'a', embedding: base }),
      noticia({ sourceUrl: 'b', embedding: quaseIgual }),
      noticia({ sourceUrl: 'c', embedding: base }),
    ],
    1,
    (r) => (r.consolidated[0].sources.length === 3 ? null : `sources deveria ter 3, tem ${r.consolidated[0].sources.length}`),
  );

  console.log(`\n${ok}/${n} corretos`);
  if (ok !== n) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
