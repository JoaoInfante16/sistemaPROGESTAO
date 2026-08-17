// ============================================
// ConfigManager - Configurações centralizadas
// ============================================
// Lê configs da tabela system_config no DB.
// Cache em memória + refresh a cada 5 minutos.
// Admin panel pode alterar qualquer config via API.

import { supabase } from '../../config/database';
import { logger } from '../../middleware/logger';
import { ASSUNTOS_TODOS } from '../../utils/taxonomia';

export interface ConfigEntry {
  key: string;
  value: string;
  description: string | null;
  category: string;
  value_type: 'string' | 'number' | 'boolean';
  updated_at: string;
  /**
   * De onde veio o valor. `default` = a chave NÃO existe em `system_config` e
   * quem manda é o `DEFAULTS` daqui.
   *
   * Existe porque o painel só enxergava o banco: chave ausente aparecia vazia,
   * e o admin via "desligado" num toggle que o backend estava tratando como
   * ligado. Foi o caso do `manual_search_web_enabled` (ramo web LIGADO no
   * backend, desligado na tela) e do `manual_search_analysis_cap` (campo em
   * branco onde o valor real era 0 = sem teto).
   */
  origem?: 'banco' | 'default';
}

// Defaults caso o DB não tenha configs (ou falhe)
// Exportado para o `scripts/diagnostico-configs-painel.ts` poder comparar o que
// existe no codigo com o que existe no banco — o painel so enxerga o banco.
export const DEFAULTS: Record<string, string> = {
  dedup_similarity_threshold: '0.85',
  // Camada 3 do dedup intra-batch da busca manual: confirma por GPT os pares na
  // faixa duvidosa (entre o threshold e 0.92). Desligado por default — a trava
  // geo-temporal da camada 1 ja resolve a maior parte dos falsos positivos.
  dedup_gpt_confirm_enabled: 'false',
  filter2_confidence_min: '0.7',
  content_fetch_concurrency: '5',
  // Quantos artigos a BUSCA MANUAL baixa em paralelo no estágio 4.
  //
  // Chave separada da `content_fetch_concurrency` de propósito: aquela é lida
  // também pelo `scanPipeline` e vive no banco compartilhado, então subi-la
  // mudaria o auto-scan e a produção junto. Mesmo padrão da
  // `manual_search_analysis_cap`.
  //
  // ⚠️ SÃO DOIS LIMITADORES EM SÉRIE, e subir só um não acelera nada:
  //   1. este pool (`asyncPool` do runContentFetch)
  //   2. `api_rate_limits.jina.max_concurrent` (o Bottleneck do rateLimiter)
  // Em 02/08 este estava em 5 e o outro em 10 — metade da vazão permitida
  // parada na mesa. Agora os dois vão a 20 (migration 028).
  //
  // Por que 20 agora: medido em 03/08, Goiânia com 17 assuntos baixou 393
  // artigos em **327s** — 63% do tempo da busca inteira. Com a lista completa
  // de assuntos o estágio 4 virou o gargalo de novo.
  //
  // ⚠️ PRÉ-REQUISITO, feito no mesmo commit: o `JinaContentFetcher` agora trata
  // 429 com `Retry-After`. Sem isso, subir a concorrência trocaria lentidão por
  // artigo perdido EM SILÊNCIO — o 429 não entrava na lista de fallback e o
  // artigo sumia sem aparecer em lugar nenhum.
  manual_search_fetch_concurrency: '20',
  search_max_results: '15',
  // Ramo web (indice organico) da busca manual — portais locais, prefeitura,
  // comunicado de policia. Conteudo que NAO aparece no indice de noticias.
  //
  // Ficou desligado por algumas horas em 2026-08-01, enquanto usava o scraper de
  // dataset (que saltou de 17-70s pra 660-978s e travava a busca). Religado ao
  // migrar pra SERP API, medida em 5/5 tentativas: 24-27 resultados em 4-19s.
  manual_search_web_enabled: 'true',
  // Teto de ARTIGOS ANALISADOS (Jina + GPT, ~$0.0025 cada), por busca de 30
  // dias. Os outros periodos escalam dele por raiz quadrada, sem faixas (ver
  // analiseMaxPorBusca). `0` = SEM TETO, que e a decisao do Joao em 02/08.
  //
  // CHAVE NOVA de proposito. A antiga (`manual_search_max_results_30d`) tem
  // significado DIFERENTE na `main`, que ainda roda em producao: la ela e o teto
  // de COLETA do stage 1. Como o Supabase e compartilhado, por `0` naquela linha
  // faria a busca do cliente coletar zero URL. Chave nova = cada versao le a
  // sua, sem coordenacao e sem mexer no banco.
  //
  // Como a linha nao existe no banco, vale este default — ou seja, o teto ja
  // nasce ABERTO. Pra ter fusivel de volta, e so por um numero no painel.
  manual_search_analysis_cap: '0',

  // ⚠️ As tres abaixo NAO sao lidas por este codigo. Ficam porque a `main` as le
  // (`_30d` como teto de coleta) e porque existem no banco. Some quando a main
  // for promovida — ver migration 024.
  manual_search_max_results_30d: '50',
  manual_search_max_results_60d: '50',
  manual_search_max_results_90d: '80',
  // Ate quantos dias atras uma noticia fora da janela ainda entra como "fora do
  // periodo" em vez de ser descartada. Casado com o teto de 180 da validacao:
  // nada mais velho que 6 meses entra no sistema, qualquer que seja a busca.
  manual_search_horizon_days: '180',
  monthly_budget_usd: '100',
  budget_warning_threshold: '0.9',
  scan_cron_schedule: '*/5 * * * *',
  worker_concurrency: '3',
  worker_max_per_minute: '10',
  scan_lock_ttl_minutes: '30',
  filter2_max_content_chars: '8000',
  push_enabled: 'true',
  auth_required: 'true',
  search_permission: 'authorized',
  // ASSUNTOS PESQUISADOS — a lista que o cliente controla pelo painel.
  //
  // Um por linha (vírgula também é aceita na leitura). Cada assunto vira uma
  // query `<assunto> <cidade>`, e a busca manual roda TODOS eles.
  //
  // É a única alavanca que aumenta o alcance de verdade. Medido em 02/08: o
  // Google serve ~60-70 itens úteis POR QUERY na lista ordenada por data, e
  // parar de paginar antes disso não é escolha nossa — São Paulo/90 dias tinha
  // 36 páginas de direito e a SERP secou na 23. Pedir mais páginas não traz
  // mais nada; perguntar outra coisa traz. Dois assuntos ≈ dois tetos.
  //
  // Regras que saíram da medição de 01/08 e valem pra qualquer assunto novo:
  //   - query CURTA ganha de query longa;
  //   - NUNCA pôr o estado — empurra pro institucional (quem desambigua cidade
  //     homônima é o pós-filtro do Filter2, lendo cidade e estado do corpo).
  //
  // 03/08: o default passou a ser a TAXONOMIA INTEIRA (ASSUNTOS_TODOS), e não os 5
  // de antes. O motivo é que os 5 cobriam 7 dos 16 tipos que o Filter2 sabe
  // classificar — vandalismo, invasão, receptação, latrocínio, greve,
  // bloqueio de via, estelionato, crime ambiental e trabalho irregular só
  // entravam de carona, se por acaso aparecessem numa das 5 perguntas.
  //
  // ⚠️ O CUSTO RECORRENTE NÃO SOBE. O auto-scan roda `search_queries_per_scan`
  // (=2) por vez, em RODÍZIO (ver buildQueries) — mais assuntos alargam o ciclo,
  // não a conta: cada um passa a ser revisitado a cada ~8,5h em vez de ~2,5h. E
  // como a janela do scan é de 2 dias, nada é perdido no intervalo.
  //
  // Quem roda a lista inteira de uma vez é a busca manual, e lá é exatamente
  // onde se quer volume — mas desde 03/08 quem escolhe quantos assuntos rodar
  // é o usuário, na tela, vendo o tempo estimado.
  //
  // A lista vem de `utils/taxonomia.ts` pra não haver duas verdades: a mesma
  // fonte alimenta as queries, a tela do app e a classificação.
  search_subjects: ASSUNTOS_TODOS.join('\n'),
  // Ingestão robusta - fontes
  multi_query_enabled: 'true',
  search_queries_per_scan: '2',
  google_news_rss_enabled: 'false',
  filter0_regex_enabled: 'true',
  // Billing
  billing_close_day: '1',
  // Janela de operação do auto-scan (horário de Brasília).
  // Fora da janela: CRON pula o tick sem enfileirar jobs — economiza Bright/Jina/OpenAI.
  scan_weekday_start: '6',       // seg-sex começa às 6h
  scan_weekday_end: '18',        // seg-sex para às 18h
  scan_weekend_enabled: 'false', // sáb+dom desligado por default
  scan_weekend_start: '6',
  scan_weekend_end: '18',
  scan_period_days: '4',         // janela do BrightData (era 2; 4 permite recuperar sáb/dom na segunda)
};

/** Só para o painel saber que campo desenhar; o backend lê tudo como string. */
function inferirTipo(value: string): 'string' | 'number' | 'boolean' {
  if (value === 'true' || value === 'false') return 'boolean';
  if (value !== '' && !isNaN(Number(value))) return 'number';
  return 'string';
}

class ConfigManager {
  private configs: Map<string, string> = new Map();
  private lastRefresh: Date = new Date(0);
  private refreshIntervalMs = 5 * 60 * 1000; // 5 minutos

  /**
   * Retorna valor de uma config como string.
   */
  async get(key: string): Promise<string> {
    await this.ensureFresh();
    return this.configs.get(key) || DEFAULTS[key] || '';
  }

  /**
   * Retorna valor como number.
   */
  async getNumber(key: string): Promise<number> {
    const value = await this.get(key);
    return parseFloat(value);
  }

  /**
   * Retorna valor como boolean ('true' = true).
   */
  async getBoolean(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value === 'true';
  }

  /**
   * Retorna todas as configs com metadados (para admin panel).
   *
   * Mescla o banco com o `DEFAULTS`: chave que só existe em código entra na
   * lista marcada como `origem: 'default'`, com o valor que o backend de fato
   * está usando. Sem isso o painel mostrava o campo vazio — e um toggle vazio
   * lê como "desligado", que é a mentira oposta do que estava acontecendo.
   */
  async getAll(): Promise<ConfigEntry[]> {
    await this.ensureFresh();

    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .order('category')
      .order('key');

    if (error) {
      logger.error('[ConfigManager] Failed to get all configs:', error.message);
      return [];
    }

    const doBanco = (data || []) as ConfigEntry[];
    const noBanco = new Set(doBanco.map((c) => c.key));

    const sintéticas: ConfigEntry[] = Object.entries(DEFAULTS)
      .filter(([key]) => !noBanco.has(key))
      .map(([key, value]) => ({
        key,
        value,
        description: null,
        // Mesma categoria que o `set()` daria a estas chaves quando forem
        // salvas — assim a config não pula de grupo ao ser editada.
        category: 'ingestion',
        value_type: inferirTipo(value),
        updated_at: '',
        origem: 'default' as const,
      }));

    return [
      ...doBanco.map((c) => ({ ...c, origem: 'banco' as const })),
      ...sintéticas,
    ];
  }

  /**
   * Atualiza uma config no DB + cache local.
   */
  async set(key: string, value: string, updatedBy?: string): Promise<void> {
    // Upsert: cria se não existe, atualiza se já existe
    const { error } = await supabase
      .from('system_config')
      .upsert({
        key,
        value,
        category: DEFAULTS[key] !== undefined ? 'ingestion' : 'general',
        value_type: 'string',
        updated_at: new Date().toISOString(),
        updated_by: updatedBy || null,
      }, { onConflict: 'key' });

    if (error) {
      throw new Error(`Failed to update config ${key}: ${error.message}`);
    }

    // Atualizar cache local imediatamente
    this.configs.set(key, value);
  }

  private async ensureFresh(): Promise<void> {
    const now = new Date();
    if (now.getTime() - this.lastRefresh.getTime() > this.refreshIntervalMs) {
      await this.refresh();
    }
  }

  private async refresh(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('key, value');

      if (error) {
        logger.error('[ConfigManager] Failed to refresh:', error.message);
        this.useDefaults();
        return;
      }

      if (!data || data.length === 0) {
        logger.warn('[ConfigManager] No configs in DB, using defaults');
        this.useDefaults();
        return;
      }

      for (const row of data) {
        this.configs.set(row.key as string, row.value as string);
      }

      this.lastRefresh = new Date();
      logger.debug(`[ConfigManager] Refreshed ${data.length} configs`);
    } catch (error) {
      logger.error('[ConfigManager] Refresh error:', error);
      this.useDefaults();
    }
  }

  private useDefaults(): void {
    for (const [key, value] of Object.entries(DEFAULTS)) {
      if (!this.configs.has(key)) {
        this.configs.set(key, value);
      }
    }
    this.lastRefresh = new Date();
  }
}

export const configManager = new ConfigManager();
