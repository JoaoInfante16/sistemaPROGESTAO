// ============================================
// Sistema de Deduplicação - 3 Camadas
// ============================================
// Camada 1: portão geo-temporal (SQL, grátis) — quem sequer é comparado
// Camada 2: similaridade de embedding (cosine, local, grátis) — ordena candidatos
// Camada 3: confirmação por GPT (paga) — quem decide
//
// 🚨 **A regra que atravessa as três, e que custou duas rodadas de conserto para
// ser aprendida: NÃO USAR COMO PORTÃO O QUE O PRÓPRIO GPT INVENTOU.**
//
// O Filter2 extrai `tipo_crime`, `data_ocorrencia` e `bairro`. Usar qualquer um
// deles como igualdade na camada 1 é circular: a duplicata nasce exatamente
// quando o GPT é inconsistente, que é exatamente quando o portão fecha. Foi
// assim com a data (17/08) e com o tipo (24/08). Sobrou `cidade` + janela — ver
// `findGeoTemporalCandidates`.

import { openai } from '../openaiClient';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { db } from '../../database/queries';
import type { DedupCandidate } from '../../database/queries';
import { cosineSimilarity } from '../../utils/helpers';
import { NewsExtraction, TipoCrime, TIPO_CRIME_GRUPO, rotuloTipoCrime } from '../../utils/types';
import { buildEmbeddingText, embeddingProvider } from '../../jobs/pipeline/pipelineCore';
import { cortarNaPalavra, cortarNaFrase } from '../filters/filter2GPT';

/**
 * ⚠️ Nome enganoso, mantido por compatibilidade: **este valor não é o que roda.**
 * Quem manda é o `dedup_similarity_threshold` do painel, que em 24/08 estava em
 * **0.70**. Em 17/08 eu raciocinei com o 0.85 daqui e cheguei à conclusão errada
 * sobre qual camada tinha deixado uma duplicata passar. Conferir no banco antes
 * de usar este número para qualquer coisa.
 */
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/**
 * Quantos candidatos acima do limiar chegam a ser perguntados ao GPT.
 *
 * 🚨 Era **1** — só o `topMatch`. Com a camada 1 filtrando por tipo, o pool era
 * pequeno e isso raramente doía; agora que o pool cresceu, o campeão do cosine
 * pode ser um quase-acerto enquanto a duplicata de verdade está em segundo. Três
 * é o suficiente para cobrir os clusters medidos (o maior tem 4 linhas) sem virar
 * uma conta de GPT por rodada.
 */
const MAX_CANDIDATOS_AO_GPT = 3;

export interface DedupResult {
  isDuplicate: boolean;
  existingId?: string;
  layer?: 1 | 2 | 3; // Qual camada decidiu
  tokensUsed: number;
}

/**
 * Verifica se uma notícia é duplicata usando 3 camadas progressivas.
 * Mais barato primeiro, mais preciso por último.
 *
 * Se for duplicata: as URLs extras do cluster intra-batch também viram sources da
 * notícia existente, **e o texto da linha sobrevivente é consolidado** — ver
 * `consolidarFusao`.
 */
export async function deduplicateNews(
  newsData: NewsExtraction & { embedding: number[] },
  sourceUrl: string,
  similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD,
  extraSourceUrls: string[] = [],
): Promise<DedupResult> {
  const euSou = `"${newsData.titulo ?? newsData.resumo.slice(0, 50)}"`;

  // CAMADA 1: portão geo-temporal (SQL, instantâneo, grátis)
  const candidates = await db.findGeoTemporalCandidates(
    newsData.cidade,
    newsData.data_ocorrencia,
    newsData.estado,
  );

  if (candidates.length === 0) {
    logger.info(`[Dedup] ${euSou} → NOVA (camada 1: nenhum candidato na cidade/janela)`);
    return { isDuplicate: false, layer: 1, tokensUsed: 0 };
  }

  // CAMADA 2: similaridade de embedding (cosine, local)
  const validCandidates = candidates.filter(
    (c) => Array.isArray(c.embedding) && c.embedding.length === 1536,
  );
  if (validCandidates.length === 0) {
    logger.info(`[Dedup] ${euSou} → NOVA (camada 2: ${candidates.length} candidatos, nenhum com embedding válido)`);
    return { isDuplicate: false, layer: 2, tokensUsed: 0 };
  }

  const ranking = validCandidates
    .map((c) => ({ candidato: c, score: cosineSimilarity(newsData.embedding, c.embedding) }))
    .sort((a, b) => b.score - a.score);

  const acimaDoLimiar = ranking.filter((r) => r.score >= similarityThreshold);

  if (acimaDoLimiar.length === 0) {
    logger.info(
      `[Dedup] ${euSou} → NOVA (camada 2: melhor score ${ranking[0].score.toFixed(3)} < ${similarityThreshold}, ` +
        `entre ${validCandidates.length} candidatos)`,
    );
    return { isDuplicate: false, layer: 2, tokensUsed: 0 };
  }

  // CAMADA 3: confirmação por GPT — até MAX_CANDIDATOS_AO_GPT, do melhor pro pior
  const aPerguntar = acimaDoLimiar.slice(0, MAX_CANDIDATOS_AO_GPT);
  let tokensTotal = 0;

  for (const { candidato, score } of aPerguntar) {
    const { isDupe, tokensUsed } = await confirmDuplicateWithGPT(
      { titulo: newsData.titulo ?? null, resumo: newsData.resumo },
      { titulo: candidato.titulo, resumo: candidato.resumo },
    );
    tokensTotal += tokensUsed;

    if (!isDupe) {
      logger.debug(
        `[Dedup] ${euSou} ≠ "${candidato.titulo}" (score ${score.toFixed(3)}, GPT disse NO)`,
      );
      continue;
    }

    await db.insertNewsSource(candidato.id, sourceUrl);
    for (const extraUrl of extraSourceUrls) {
      await db.insertNewsSource(candidato.id, extraUrl);
    }

    const tokensFusao = await consolidarFusao(candidato, newsData);
    tokensTotal += tokensFusao;

    logger.info(
      `[Dedup] ${euSou} → FUNDIDA em ${candidato.id} "${candidato.titulo}" ` +
        `(score ${score.toFixed(3)}, ${1 + extraSourceUrls.length} fonte(s), ${tokensTotal} tokens)`,
    );
    return { isDuplicate: true, existingId: candidato.id, layer: 3, tokensUsed: tokensTotal };
  }

  logger.info(
    `[Dedup] ${euSou} → NOVA (camada 3: GPT disse NO para ${aPerguntar.length} candidato(s), ` +
      `melhor score ${aPerguntar[0].score.toFixed(3)})`,
  );
  return { isDuplicate: false, layer: 3, tokensUsed: tokensTotal };
}

// ============================================
// Camada 3 — a única que decide
// ============================================

export interface LadoDaComparacao {
  titulo: string | null;
  resumo: string;
}

/**
 * Compara dois relatos e responde se são o MESMO caso.
 *
 * Validado com `scripts/test-dedup-prompt.ts` e com o gabarito de produção em
 * `scripts/dedup-casos-reais.ts` — 15 pares reais, rotulados à mão.
 *
 * 🚨 **O prompt já foi SENSÍVEL À ORDEM, e isso deixava duplicata passar.**
 * Medido em 17/08 com o par real `Operação Olimpo` (cosine 0.8343):
 * `(antigo, novo)` deu **YES 5/5** e `(novo, antigo)` deu **NO 5/5** —
 * determinístico, temperature 0. O código chama sempre `(nova, existente)`, e a
 * nova costuma ser a mais detalhada porque é o follow-up: o modelo lia "detalhe
 * que só um tem" como fato divergente. As notas de assimetria e de simetria
 * levaram o mesmo par a YES 10/10 nos dois sentidos.
 *
 * ⚠️ **Quem mexer aqui: teste NAS DUAS ORDENS.** Um prompt que acerta num sentido
 * e erra no outro passa em qualquer bateria que só teste um lado — foi o que
 * aconteceu com os 10 pares validados em 04/16.
 *
 * 🚨 **A manchete entra na comparação desde 24/08.** Até então só os resumos eram
 * comparados, e a identidade do fato mora frequentemente no título — o nome da
 * operação, o bairro, a vítima.
 */
async function confirmDuplicateWithGPT(
  a: LadoDaComparacao,
  b: LadoDaComparacao,
): Promise<{ isDupe: boolean; tokensUsed: number }> {
  const prompt = `Do these two news reports describe the SAME incident?

REPORT 1:
headline: "${a.titulo ?? ''}"
summary: "${a.resumo}"

REPORT 2:
headline: "${b.titulo ?? ''}"
summary: "${b.resumo}"

They describe the SAME incident if the core event matches: same approximate location, same time frame, same case, and details do not contradict each other.

IDENTITY ANCHORS — these identify a case:
- 🔒 DECISIVE: both reports naming the SAME police operation ("Operação Boreal", "Operação Ad Extremum"). A named operation is a unique identifier. When both name the same one, answer YES — no other difference outweighs it.
- 🔒 DECISIVE: both reports pointing at the SAME underlying crime — the same massacre with the same number of dead, the same robbery investigation, the same victim. This holds even when only ONE of them names the operation: an operation and the crime it investigates are one case.
- strong: the victim's name, age or description; the neighborhood or address

🚨 IGNORE THESE ENTIRELY when judging. They are not evidence in either direction, and reading them as "different" is the single most common mistake here:
- **the number of people arrested, detained, charged or denounced.** One outlet says eight, another says seven, and the figure changes during the day. This number carries NO information about whether the case is the same. Do not let it produce a NO.
- the amount seized, the estimated loss, the number of warrants
- which police force is credited
- one report naming the operation and the other not
- one summary being MORE DETAILED than the other. Detail present in only one side is not a contradiction. Judge only on facts that CONFLICT.

IS a contradiction — these mean DIFFERENT incidents:
- different victims
- a different neighborhood or address
- a genuinely different event (two separate crashes, two separate blockades on the same road)

SAME CASE, DIFFERENT MOMENTS — still the SAME incident, but ONLY when an identity anchor ties them to one another:
- articles covering different angles (victim found vs suspect arrested, early report vs follow-up)
- the crime and the police operation that later arrests the suspects FOR THAT crime
- an investigation update about a crime already reported

⚠️ This does NOT make every related police activity one case. Two separate police actions in the same city — a raid and a shootout, an operation and an arrest — are DIFFERENT incidents unless an anchor above ties them to the same underlying event. Sharing a crime type and a city is not an anchor.

The question is symmetric: the answer must not depend on which report is listed first.

Answer ONLY "YES" or "NO":`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
      temperature: 0,
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase();
    const tokensUsed = response.usage?.total_tokens || 0;
    return { isDupe: answer === 'YES', tokensUsed };
  } catch (error) {
    logger.error('[Dedup] GPT confirmation error:', error);
    return { isDupe: false, tokensUsed: 0 };
  }
}

// Camada 3 reusada pelo dedup intra-batch em camadas da busca manual
// (jobs/pipeline/intraBatchDedupLayered.ts) — mesmo prompt, mesma validacao.
export { confirmDuplicateWithGPT };

// Export para testes (nome antigo, mantido pra nao quebrar scripts)
export { confirmDuplicateWithGPT as _confirmDuplicateWithGPT };

// ============================================
// Fusão: consolidar, e não descartar
// ============================================

export interface TextoConsolidado {
  titulo: string;
  resumo: string;
  /** Texto da folha, unido. `null` quando nenhum dos lados tinha. */
  corpo: string | null;
  tipo_crime: TipoCrime;
  /** `false` = o relato novo não acrescentou nada; nada foi regravado. */
  mudou: boolean;
  tokensUsed: number;
}

/**
 * Reescreve a linha sobrevivente cobrindo os dois relatos, e regrava o vetor.
 *
 * 🚨 **Existe porque fundir estava JOGANDO FORA informação.** Até 24/08 a fusão
 * só adicionava a URL: a manchete e o resumo do relato novo eram descartados. Com
 * a camada 1 alargada, fundir virou rotina — e sem isto a linha que sobrevive
 * seria sempre a primeira. O caso real que decidiu: a morte de uma menina de 4
 * anos em Porto Alegre e a prisão do tio são o mesmo caso, e sem consolidar o
 * feed mostraria para sempre *"Menina de 4 anos é morta após maus-tratos"*, com a
 * prisão virando uma URL que ninguém vê.
 *
 * ⚠️ **Falha aqui NÃO desfaz a fusão.** As fontes já foram somadas quando esta
 * função é chamada; se o GPT ou o embedding falharem, a linha fica com o texto
 * antigo — que é exatamente o comportamento de antes, e não uma regressão. Erro
 * de rede não pode virar notícia duplicada.
 *
 * Devolve os tokens gastos (0 quando nada mudou ou quando degradou).
 */
async function consolidarFusao(
  existente: DedupCandidate,
  nova: NewsExtraction,
): Promise<number> {
  let consolidado: TextoConsolidado;
  try {
    consolidado = await reescreverNaFusao(existente, nova);
  } catch (err) {
    logger.error(`[Dedup] Consolidação falhou para ${existente.id}, texto antigo mantido: ${(err as Error).message}`);
    return 0;
  }

  if (!consolidado.mudou) {
    logger.debug(`[Dedup] ${existente.id}: relato novo não acrescenta, texto preservado`);
    return consolidado.tokensUsed;
  }

  try {
    // 🚨 MESMA formula do pipeline. O vetor e derivado do texto: regravar um sem
    // o outro faz os dois deixarem de corresponder, e a degradacao e silenciosa.
    const { embedding } = await embeddingProvider.generate(
      buildEmbeddingText({
        tipo_crime: consolidado.tipo_crime,
        estado: existente.estado || undefined,
        cidade: existente.cidade,
        bairro: existente.bairro || undefined,
        data_ocorrencia: existente.data_ocorrencia,
        resumo: consolidado.resumo,
      }),
    );

    await db.atualizarNoticiaFundida(existente.id, {
      titulo: consolidado.titulo,
      resumo: consolidado.resumo,
      corpo: consolidado.corpo,
      tipo_crime: consolidado.tipo_crime,
      categoria_grupo: TIPO_CRIME_GRUPO[consolidado.tipo_crime],
      embedding,
    });

    const virouOutro = consolidado.tipo_crime !== existente.tipo_crime;
    logger.info(
      `[Dedup] ${existente.id} consolidada: "${consolidado.titulo}"` +
        (virouOutro
          ? ` · tipo ${rotuloTipoCrime(existente.tipo_crime)} → ${rotuloTipoCrime(consolidado.tipo_crime)}`
          : ''),
    );
  } catch (err) {
    logger.error(`[Dedup] Gravação da consolidação falhou para ${existente.id}: ${(err as Error).message}`);
  }

  return consolidado.tokensUsed;
}

/**
 * A chamada de GPT que funde os dois textos. Separada de `consolidarFusao` para
 * poder ser rodada a seco (sem gravar) pelos scripts de verificação.
 *
 * As regras de manchete e resumo são as MESMAS do Filter2, de propósito — se
 * divergissem, o feed teria dois estilos de texto dependendo de a notícia ter
 * sido fundida ou não.
 */
export async function reescreverNaFusao(
  existente: { titulo: string | null; resumo: string; corpo?: string | null; tipo_crime: string },
  nova: { titulo?: string; resumo: string; corpo?: string | null; tipo_crime: string },
): Promise<TextoConsolidado> {
  const tipoExistente = existente.tipo_crime as TipoCrime;

  const prompt = `Two news reports describe the SAME incident. Produce the consolidated version that replaces the published one.

PUBLISHED (currently in the feed):
headline: "${existente.titulo ?? ''}"
summary: "${existente.resumo}"
body: "${existente.corpo ?? ''}"
crime_type: ${existente.tipo_crime}

NEW REPORT:
headline: "${nova.titulo ?? ''}"
summary: "${nova.resumo}"
body: "${nova.corpo ?? ''}"
crime_type: ${nova.tipo_crime}

RULES:
1. "changed": false when the NEW REPORT adds nothing the PUBLISHED one does not already convey. This is the common case — do not rewrite for style. When false, repeat the published headline and summary verbatim.
2. "changed": true only when the new report brings something the published one lacks: an arrest, a death or other outcome, a named police operation, a figure, a location detail, a charge.
3. 🚨 The result is a UNION, not a replacement. Every concrete fact present in EITHER report must survive: people killed, people injured, what was seized, the named operation, the charge, the outcome. Dropping a fact that one side had is a FAILURE, even when the other side reads better. An arrest that followed a crime belongs in the result; the crime is not erased by the arrest.
3b. When space forces a choice, keep facts in this order: (a) victims — killed, injured; (b) what happened and where; (c) the outcome — arrests, charges; (d) the operation name; (e) amounts seized or lost.
3c. When a FIGURE differs between the two reports (seven arrested vs eight), keep the PUBLISHED report's figure. You cannot tell which outlet is right, and silently adopting the other rewrites history on every merge.
4. "crime_type": the type that describes the case NOW, from this list: ${Object.keys(TIPO_CRIME_GRUPO).join(', ')}. If an assault became a homicide, return homicidio. Keep the published type when nothing changed the nature of the case.
5. "headline": Brazilian Portuguese, at most 70 characters. Journalistic present tense ("Homem é preso após...", not "Homem foi preso"). Sober: no ALL CAPS, no exclamation marks, no value judgments, no victim or suspect full names, no gore.
6. "summary": Brazilian Portuguese, at most 190 characters, COMPLEMENTARY to the headline and never a paraphrase of it. The reader has already read the headline; every clause must add something it could not fit.
7. "body": Brazilian Portuguese, at most 900 characters, 2 to 4 short paragraphs separated by a blank line. This is the reading text of the opened sheet, and it is where the UNION actually fits — the 190-char summary cannot hold three outlets. Same sober register. Do NOT print full names of victims or of suspects who have not been convicted. Return "" only when NEITHER side has a body.

Return ONLY this JSON:
{"changed": true|false, "headline": "...", "summary": "...", "body": "...", "crime_type": "..."}`;

  const response = await openai.chat.completions.create({
    model: config.openaiModel,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const tokensUsed = response.usage?.total_tokens || 0;
  const bruto = response.choices[0].message.content ?? '{}';
  const data = JSON.parse(bruto) as {
    changed?: boolean;
    headline?: string;
    summary?: string;
    body?: string;
    crime_type?: string;
  };

  const semMudanca: TextoConsolidado = {
    titulo: existente.titulo ?? '',
    resumo: existente.resumo,
    corpo: existente.corpo ?? null,
    tipo_crime: tipoExistente,
    mudou: false,
    tokensUsed,
  };

  if (data.changed !== true) return semMudanca;

  const titulo = (data.headline ?? '').trim();
  const resumo = (data.summary ?? '').trim();
  // Texto vazio nao substitui texto bom — degrada pra "nao mudou".
  if (titulo.length === 0 || resumo.length === 0) {
    logger.warn('[Dedup] Consolidação devolveu texto vazio; mantendo o publicado');
    return semMudanca;
  }

  // Tipo desconhecido nao vira `outros` calado: mantem o que estava.
  const tipoNovo = (data.crime_type ?? '').trim();
  const tipoValido = Object.prototype.hasOwnProperty.call(TIPO_CRIME_GRUPO, tipoNovo)
    ? (tipoNovo as TipoCrime)
    : tipoExistente;

  // Corpo vazio nao apaga corpo que existia — degrada pro que ja estava.
  const corpoNovo = (data.body ?? '').trim();
  const corpo = corpoNovo.length > 0
    ? cortarNaFrase(corpoNovo, 900)
    : (existente.corpo ?? null);

  return {
    titulo: cortarNaPalavra(titulo, 70),
    resumo: cortarNaFrase(resumo, 190),
    corpo,
    tipo_crime: tipoValido,
    mudou: true,
    tokensUsed,
  };
}
