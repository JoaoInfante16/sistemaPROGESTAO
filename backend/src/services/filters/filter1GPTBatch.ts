// ============================================
// Filtro 1 Batch - GPT Snippet Analysis (UMA chamada para TODOS)
// ============================================
// Substitui N chamadas individuais por 1 chamada batch.
// Economia: ~90% em API calls, ~84% em latência.

import * as Sentry from '@sentry/node';
import { openai } from '../openaiClient';
import { config } from '../../config';
import { logger } from '../../middleware/logger';


/**
 * Analisa TODOS os snippets em uma única chamada GPT.
 * Retorna array de booleans na mesma ordem dos snippets.
 *
 * Fallback: se o GPT retornar resposta inválida, assume todos como true
 * (safe default - permite que Filter2 faça análise mais profunda).
 */
const BATCH_CHUNK_SIZE = 30; // Max snippets por chamada GPT (evita estourar context window)

export interface Filter1Result {
  results: boolean[];
  tokensUsed: number;
}

export async function filter1GPTBatch(snippets: string[], assuntos?: string[]): Promise<Filter1Result> {
  if (snippets.length === 0) return { results: [], tokensUsed: 0 };

  // Se só tem 1 snippet, não precisa de batch
  if (snippets.length === 1) {
    const { result, tokensUsed } = await filter1Single(snippets[0], assuntos);
    return { results: [result], tokensUsed };
  }

  // Dividir em chunks pra não estourar context window do GPT
  if (snippets.length > BATCH_CHUNK_SIZE) {
    logger.info(`[Filter1Batch] Splitting ${snippets.length} snippets into chunks of ${BATCH_CHUNK_SIZE}`);

    const pedacos: string[][] = [];
    for (let i = 0; i < snippets.length; i += BATCH_CHUNK_SIZE) {
      pedacos.push(snippets.slice(i, i + BATCH_CHUNK_SIZE));
    }

    // EM PARALELO, e não em série como até 03/08.
    //
    // O `for` com `await` fazia os chunks esperarem uns aos outros sem motivo:
    // quem controla a vazão da OpenAI é o `rateLimiter` (Bottleneck), uma camada
    // acima — o serial aqui só desperdiçava a concorrência que já estava
    // permitida. Com 5 assuntos isso custava segundos; com a lista inteira da
    // taxonomia são ~30 chunks, e o desperdício vira minutos.
    //
    // `Promise.all` e não `allSettled` de propósito: `filter1GPTBatchSingle` já
    // trata erro internamente e só lança depois de 2 tentativas, e nesse caso o
    // certo é a busca inteira falhar pro BullMQ re-enfileirar — engolir aqui
    // descartaria snippets em silêncio.
    const resultados = await Promise.all(
      pedacos.map((chunk) => filter1GPTBatchSingle(chunk, assuntos))
    );

    return {
      results: resultados.flatMap((r) => r.results),
      tokensUsed: resultados.reduce((soma, r) => soma + r.tokensUsed, 0),
    };
  }

  return filter1GPTBatchSingle(snippets, assuntos);
}

/**
 * Linha extra do prompt quando o usuario escolheu os assuntos na tela (03/08).
 *
 * ⚠️ E o que faz a busca por palavra-chave livre nao ser uma promessa quebrada.
 * Sem isto, o Filter1 mata o que o usuario pediu ANTES do Jina: a lista de
 * `true` aceita "protesto VIOLENTO", entao `greve` de onibus, `bloqueio de
 * rodovia` pacifico ou qualquer termo fora do vocabulario de crime volta
 * `false`. O usuario pede uma coisa, recebe zero, e nao ha como saber por que.
 *
 * Preferido a engordar a lista fixa de palavras: assim vale pra qualquer termo
 * que o usuario digite, hoje e no futuro, sem a gente ter que adivinhar.
 *
 * Vazio quando ninguem escolheu nada — o prompt do auto-scan continua identico
 * ao que sempre foi.
 */
function contextoDosAssuntos(assuntos?: string[]): string {
  if (!assuntos || assuntos.length === 0) return '';
  return `\n- O USUARIO PEDIU ESPECIFICAMENTE por: ${assuntos.join(', ')}. Trecho sobre qualquer um desses assuntos = true, MESMO que nao seja crime nenhum (ex: greve de onibus, manifestacao pacifica, bloqueio de rodovia, acidente). Foi ele quem perguntou — nao descarte por "nao e seguranca publica".`;
}

async function filter1GPTBatchSingle(snippets: string[], assuntos?: string[]): Promise<Filter1Result> {
  // Prompt em pt-BR (mesma lingua dos snippets) + exemplos few-shot cobrindo
  // casos de borda onde o modelo tende a errar sem contexto: crimes em
  // ambiente esportivo/cultural, apreensoes pela Receita, jogo do bicho,
  // estatisticas oficiais. Reduz falso negativo em comparacao ao prompt
  // anterior em ingles sem exemplos.
  const prompt = `Analise os ${snippets.length} trechos de noticia abaixo. Para cada um, decida se ele é sobre SEGURANÇA PÚBLICA (crime, polícia, violência, operação policial, apreensão, estatística de criminalidade).

Retorne JSON com array de booleanos na ordem dos trechos:
{"results": [true, false, true, ...]}

REGRAS:
- Retorne EXATAMENTE ${snippets.length} valores.
- true = conteudo de segurança pública: roubo, furto, homicidio, latrocinio, lesao, trafico, receptacao, estelionato, operacao policial, apreensao, prisao, protesto violento, bloqueio, tiroteio, estatistica de crimes, contravencao (ex: jogo do bicho).
- false = NAO eh seguranca publica: esporte (jogo, resultado, transferencia), novela, fofoca, horoscopo, resenha de filme/show, cotacao financeira, previsao do tempo, concurso publico, nota tecnica sem dado, entretenimento em geral.
- Crimes em ambiente de entretenimento/esporte CONTAM: "torcedor morto em briga" = true, "assalto interrompe show" = true, "Receita Federal apreende drogas" = true, "jogo do bicho movimenta milhoes" = true.
- Se for operacao/apreensao mesmo sem mencionar suspeito preso, CONTA = true.${contextoDosAssuntos(assuntos)}

EXEMPLOS:
Trecho: "Torcedor do Flamengo morre apos briga em estadio"
Resposta: true (homicidio, mesmo em contexto esportivo)

Trecho: "Receita Federal apreende 50kg de cocaina em Foz do Iguacu"
Resposta: true (apreensao de drogas)

Trecho: "Jogo do bicho movimenta R$ 2 milhoes por mes em Curitiba"
Resposta: true (contravencao)

Trecho: "Assalto interrompe show de Anitta em Sao Paulo"
Resposta: true (crime)

Trecho: "Corinthians vence Palmeiras por 2x0 no classico"
Resposta: false (esporte puro)

Trecho: "Receita Federal abre concurso com 400 vagas"
Resposta: false (administrativo, sem crime)

Trecho: "Horoscopo da semana: Aries tera sorte no trabalho"
Resposta: false (entretenimento)

TRECHOS A ANALISAR:
${snippets.map((snippet, index) => `${index}. "${snippet}"`).join('\n')}`;

  // Retry 1x antes de fallback "all true"
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0].message.content || '{}';
    const tokensUsed = response.usage?.total_tokens || 0;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logger.error(`[Filter1Batch] Attempt ${attempt}: Invalid JSON response: ${raw.substring(0, 200)}`);
      if (attempt < 2) continue;
      return { results: snippets.map(() => true), tokensUsed };
    }

    // Validar resposta
    if (!Array.isArray(data.results)) {
      logger.error(`[Filter1Batch] Attempt ${attempt}: results is not array: ${raw.substring(0, 200)}`);
      if (attempt < 2) continue;
      return { results: snippets.map(() => true), tokensUsed };
    }

    // GPT às vezes retorna ±1-2 itens. Ajustar em vez de descartar tudo.
    if (data.results.length !== snippets.length) {
      logger.warn(`[Filter1Batch] Length mismatch: expected ${snippets.length}, got ${data.results.length}. Adjusting.`);

      if (data.results.length > snippets.length) {
        // Truncar extras
        data.results = data.results.slice(0, snippets.length);
      } else {
        // Paddar faltantes com true (safe: deixa Filter2 decidir)
        while (data.results.length < snippets.length) {
          data.results.push(true);
        }
      }
    }

    // Garantir que todos são boolean
    logger.info(`[Filter1Batch] ${snippets.length} snippets, ${tokensUsed} tokens`);
    return { results: (data.results as unknown[]).map((val: unknown) => val === true), tokensUsed };
  } catch (error) {
    Sentry.captureException(error, { tags: { provider: 'openai', stage: 'filter1' } });
    logger.error(`[Filter1Batch] Attempt ${attempt} GPT error:`, error);
    if (attempt < 2) continue;
    // API exception apos retry: NAO fallback "all true" (explodiria budget em Jina+Filter2).
    // Throw para BullMQ re-enfileirar com backoff. Sentry ja capturou -> alerta por email.
    // Quando OpenAI voltar, job sai da fila e pipeline continua.
    throw new Error(`[Filter1Batch] OpenAI falhou apos 2 tentativas: ${(error as Error).message}`);
  }
  } // end for

  // Unreachable — loop acima sempre retorna ou lanca.
  throw new Error('[Filter1Batch] estado inesperado apos loop de retry');
}

/**
 * Fallback para snippet único (evita overhead do batch com 1 item).
 */
async function filter1Single(snippet: string, assuntos?: string[]): Promise<{ result: boolean; tokensUsed: number }> {
  const prompt = `O trecho abaixo é sobre SEGURANÇA PÚBLICA (crime, polícia, operação, apreensão, estatistica de criminalidade, contravencao)?

REGRAS:
- Crime em ambiente de entretenimento/esporte CONTA (ex: "torcedor morto" = SIM, "assalto em show" = SIM).
- Apreensao/operacao da Receita Federal ou PF CONTA.
- Esporte puro, novela, fofoca, horoscopo, cotacao, previsao do tempo, concurso publico = NAO.${contextoDosAssuntos(assuntos)}

Trecho: "${snippet}"

Responda APENAS "SIM" ou "NAO":`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
      temperature: 0,
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase().replace(/[^A-Z]/g, '');
    const tokensUsed = response.usage?.total_tokens || 0;
    return { result: answer === 'SIM' || answer === 'YES', tokensUsed };
  } catch (error) {
    logger.error('[Filter1Single] GPT error:', error);
    return { result: false, tokensUsed: 0 };
  }
}
