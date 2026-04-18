// ============================================
// Executive Service - resumo + indicadores visuais
// ============================================
// Transforma lista de estatísticas (natureza='estatistica') em:
//  - indicadores: cards visuais curados (% / absoluto / monetário)
//  - resumo_complementar: parágrafo textual dos que não viram card
//  - fontes: hostnames consolidados
//
// Chamado em 2 contextos:
//  - Dashboard (auto_scan): via getOrGenerateExecutive (com cache)
//  - Busca manual: direto no /analytics/report (sem cache separado; cacheia no report)
// Custo registrado em budget_tracking com details.stage='executive'.

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { db } from '../../database/queries';
import type { ExecutiveData } from '../../database/queries';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface StatisticInput {
  resumo: string;
  data_ocorrencia: string;
  source_url: string | null;
}

const SYSTEM_PROMPT = `Você é um analista de segurança pública pra relatórios executivos voltados a gestores de varejo e consultorias de análise de risco. Sua tarefa: transformar uma lista de notícias/estatísticas oficiais em um resumo executivo estruturado.

REGRAS CRÍTICAS:
- Use APENAS números explicitamente citados nos resumos. NUNCA invente, estime ou extrapole.
- Retorne JSON válido seguindo o schema exato fornecido.
- Português do Brasil.

SCHEMA DE SAÍDA (apenas JSON, sem texto fora):
{
  "indicadores": [
    {
      "valor": -31.6,
      "unidade": "%" ou null,
      "tipo": "percentual" | "absoluto" | "monetario",
      "sentido": "positivo" | "negativo" | "neutro",
      "label": "Mortes violentas",
      "contexto": "CE/Jan 2026",
      "fonte": "ceara.gov.br"
    }
  ],
  "resumo_complementar": "Destaque também para...",
  "fontes": ["ceara.gov.br", "sspds.ce.gov.br"]
}

REGRAS PRA INDICADORES:
- Inclua no máximo 4 indicadores (os mais relevantes).
- Só vire CARD estatísticas com número claro, impactante e que "fala por si":
  * Percentuais de variação ("-31,6%", "+15%")
  * Contagens destacadas ("47 presos", "1.245 apreensões")
  * Valores monetários ("R$ 4,2 milhões")
- Agrupe indicadores da MESMA métrica no MESMO período citando múltiplas fontes no campo "fonte" (separe por " · ").
- Mantenha separados indicadores da mesma métrica em períodos DIFERENTES (são tendências distintas).
- "sentido" pra crimes: queda = "positivo", alta = "negativo". Pra apreensões/operações: alta = "positivo".
- "contexto" deve ser curto (local/período): "CE/Jan 2026", "Fortaleza/Fev", "Mar 2026".
- "fonte" deve ser só o hostname (ex: "ceara.gov.br"), sem https://, sem path.

REGRAS PRA RESUMO_COMPLEMENTAR:
- Use SÓ pra estatísticas que NÃO viraram card (anúncios, programas, reforço de contingente, narrativas sem número autoexplicativo).
- 1 parágrafo curto (50-80 palavras).
- Se TUDO virou card, retorne null.

REGRAS PRA FONTES:
- Array único com todos os hostnames distintos que apareceram nos indicadores + resumo.
- Máx 8.

SE NÃO HOUVER ESTATÍSTICAS RELEVANTES (input vazio ou só ruído), retorne:
{ "indicadores": [], "resumo_complementar": null, "fontes": [] }`;

function extractHostname(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function formatStatisticsForPrompt(stats: StatisticInput[]): string {
  if (stats.length === 0) return '(nenhuma estatística no período)';
  return stats
    .map((s, i) => {
      const fonte = extractHostname(s.source_url);
      return `${i + 1}. [${s.data_ocorrencia}${fonte ? ` · ${fonte}` : ''}]\n${s.resumo}`;
    })
    .join('\n\n');
}

export async function generateExecutiveFromStatistics(
  statistics: StatisticInput[],
  source: 'auto_scan' | 'manual_search',
  meta: { cidade: string; estado: string; rangeDays: number },
): Promise<ExecutiveData> {
  // Curto-circuito: sem estatísticas, não chama GPT (economiza custo).
  if (statistics.length === 0) {
    return { indicadores: [], resumo_complementar: null, fontes: [] };
  }

  const userPrompt = `Estatísticas do período (${meta.cidade}/${meta.estado}, últimos ${meta.rangeDays} dias):\n\n${formatStatisticsForPrompt(statistics)}`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const tokensUsed = response.usage?.total_tokens || 0;
    const costUsd = (tokensUsed / 1_000_000) * 0.15; // gpt-4o-mini input+output blended

    // Track custo no billing (aparece no painel admin com stage=executive)
    await db.trackCost({
      source,
      provider: 'openai',
      cost_usd: costUsd,
      details: {
        stage: 'executive',
        cidade: meta.cidade,
        estado: meta.estado,
        range_days: meta.rangeDays,
        tokens: tokensUsed,
        stats_count: statistics.length,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.warn('[Executive] Empty response from GPT');
      return { indicadores: [], resumo_complementar: null, fontes: [] };
    }

    const parsed = JSON.parse(content) as ExecutiveData;
    // Saneamento mínimo: garante shape esperado mesmo se GPT errar.
    return {
      indicadores: Array.isArray(parsed.indicadores) ? parsed.indicadores.slice(0, 4) : [],
      resumo_complementar: typeof parsed.resumo_complementar === 'string' ? parsed.resumo_complementar : null,
      fontes: Array.isArray(parsed.fontes) ? parsed.fontes.slice(0, 8) : [],
    };
  } catch (error) {
    logger.error('[Executive] GPT generation failed:', error);
    // Fail open: retorna vazio (seção não aparece na UI) em vez de quebrar o relatório.
    return { indicadores: [], resumo_complementar: null, fontes: [] };
  }
}

// Dashboard (auto_scan): cache + geração on-demand.
// Se cache hit válido, retorna. Senão, gera via GPT e cacheia.
export async function getOrGenerateExecutive(
  cidade: string,
  estado: string,
  rangeDays: number,
  statistics: StatisticInput[],
): Promise<ExecutiveData> {
  const cached = await db.getExecutiveCache(cidade, estado, rangeDays);
  if (cached) return cached.data;

  const data = await generateExecutiveFromStatistics(statistics, 'auto_scan', {
    cidade,
    estado,
    rangeDays,
  });

  // Cacheia mesmo se veio vazio — evita re-chamar GPT pra dia inteiro se não há dado.
  await db.upsertExecutiveCache(cidade, estado, rangeDays, data);
  return data;
}
