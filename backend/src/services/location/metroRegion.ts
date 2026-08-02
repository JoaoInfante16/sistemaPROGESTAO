// ============================================
// Regiao metropolitana — GPT com cache no Redis
// ============================================
// Responde "quais municipios formam a regiao metropolitana de X?".
//
// Por que GPT e nao dataset: sao 5.570 municipios e o cliente pode pedir busca
// em qualquer um. Manter tabela disso e trabalho perpetuo pra um dado que muda
// pouco e que o modelo ja sabe. O cache faz cada cidade custar UMA chamada de
// GPT por mes; o resto sai do Redis.
//
// Regra de ouro: isto NUNCA pode derrubar uma busca. Qualquer falha (GPT fora,
// JSON invalido, Redis mudo) devolve lista vazia e a busca segue exatamente como
// se a feature nao existisse.

import { openai } from '../openaiClient';
import { redis } from '../../config/redis';
import { logger } from '../../middleware/logger';
import { normalizeText } from '../../utils/helpers';


// 30 dias. Regiao metropolitana muda por lei estadual, na ordem de anos.
const TTL_SEGUNDOS = 30 * 24 * 60 * 60;

// gpt-4o-mini, NAO gpt-5-nano: o nano gasta o orcamento de saida em reasoning
// tokens e devolve vazio (gotcha registrado na CLAUDE.md).
const MODEL = 'gpt-4o-mini';

// Teto de seguranca. Nenhuma regiao metropolitana brasileira real passa disso
// (a maior, Sao Paulo, tem 39) — mais que isso e alucinacao ou o modelo listando
// o estado inteiro, e a lista some.
const MAX_MUNICIPIOS = 45;

const TIMEOUT_MS = 15_000;

function chaveCache(cidade: string, estado: string): string {
  return `metro:${normalizeText(estado).replace(/\s+/g, '-')}:${normalizeText(cidade).replace(/\s+/g, '-')}`;
}

/**
 * Municipios da regiao metropolitana de `cidade`, SEM a propria cidade.
 * Lista vazia = sem regiao metropolitana conhecida, ou falha (os dois casos
 * levam ao mesmo comportamento: a busca segue so com a cidade pedida).
 */
export async function getMetroRegion(cidade: string, estado: string): Promise<string[]> {
  const chave = chaveCache(cidade, estado);

  try {
    const cacheado = await redis.get(chave);
    if (cacheado !== null) {
      const lista = JSON.parse(cacheado) as string[];
      logger.info(`[MetroRegion] ${cidade}/${estado}: ${lista.length} municipios (cache)`);
      return lista;
    }
  } catch (err) {
    // Redis fora nao e motivo pra nao perguntar ao GPT.
    logger.warn(`[MetroRegion] cache ilegivel para ${cidade}: ${(err as Error).message}`);
  }

  let lista: string[];
  try {
    lista = await consultarGPT(cidade, estado);
  } catch (err) {
    logger.warn(`[MetroRegion] GPT falhou para ${cidade}/${estado}: ${(err as Error).message} — seguindo sem regiao`);
    return [];
  }

  try {
    // Cacheia inclusive a lista vazia: "esta cidade nao tem regiao metropolitana"
    // e uma resposta legitima e nao deve ser reperguntada a cada busca.
    await redis.set(chave, JSON.stringify(lista), 'EX', TTL_SEGUNDOS);
  } catch (err) {
    logger.warn(`[MetroRegion] nao consegui cachear ${cidade}: ${(err as Error).message}`);
  }

  logger.info(`[MetroRegion] ${cidade}/${estado}: ${lista.length} municipios (GPT)`);
  return lista;
}

async function consultarGPT(cidade: string, estado: string): Promise<string[]> {
  const resp = await openai.chat.completions.create(
    {
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Voce responde sobre divisao territorial brasileira. Responda APENAS com JSON, ' +
            'sem texto em volta, no formato {"municipios": ["Nome 1", "Nome 2"]}.',
        },
        {
          role: 'user',
          content:
            `Liste os municipios que formam a Regiao Metropolitana de ${cidade}, ${estado} (Brasil), ` +
            `EXCLUINDO ${cidade}. Use os nomes oficiais dos municipios, sem a sigla do estado. ` +
            `Se ${cidade} nao integra nenhuma regiao metropolitana oficial, responda {"municipios": []}. ` +
            `Nao invente municipios e nao liste o estado inteiro.`,
        },
      ],
    },
    { timeout: TIMEOUT_MS },
  );

  const raw = resp.choices[0]?.message?.content?.trim();
  if (!raw) return [];

  const parsed = JSON.parse(raw) as { municipios?: unknown };
  if (!Array.isArray(parsed.municipios)) return [];

  const cidadeNorm = normalizeText(cidade);
  const vistos = new Set<string>();
  const lista: string[] = [];

  for (const m of parsed.municipios) {
    if (typeof m !== 'string') continue;
    const nome = m.trim();
    if (nome.length < 2) continue;

    const norm = normalizeText(nome);
    // O modelo as vezes reinclui a propria cidade apesar do EXCLUINDO.
    if (norm === cidadeNorm || vistos.has(norm)) continue;

    vistos.add(norm);
    lista.push(nome);
  }

  if (lista.length > MAX_MUNICIPIOS) {
    logger.warn(`[MetroRegion] ${cidade}/${estado} devolveu ${lista.length} municipios (> ${MAX_MUNICIPIOS}) — descartando como alucinacao`);
    return [];
  }

  return lista;
}

/**
 * Uniao das regioes metropolitanas de varias cidades, ja sem as cidades pedidas.
 * Busca multi-cidade em geral e da mesma regiao (ex.: Grande Florianopolis), e
 * sem tirar as pedidas uma viraria "vizinha" da outra.
 */
export async function getMetroRegionForCities(cidades: string[], estado: string): Promise<string[]> {
  const listas = await Promise.all(cidades.map((c) => getMetroRegion(c, estado)));

  const pedidas = new Set(cidades.map(normalizeText));
  const vistos = new Set<string>();
  const uniao: string[] = [];

  for (const lista of listas) {
    for (const nome of lista) {
      const norm = normalizeText(nome);
      if (pedidas.has(norm) || vistos.has(norm)) continue;
      vistos.add(norm);
      uniao.push(nome);
    }
  }

  return uniao;
}
