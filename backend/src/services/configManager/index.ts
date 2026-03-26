// ============================================
// ConfigManager - Configurações centralizadas
// ============================================
// Lê configs da tabela system_config no DB.
// Cache em memória + refresh a cada 5 minutos.
// Admin panel pode alterar qualquer config via API.

import { supabase } from '../../config/database';
import { logger } from '../../middleware/logger';

export interface ConfigEntry {
  key: string;
  value: string;
  description: string | null;
  category: string;
  value_type: 'string' | 'number' | 'boolean';
  updated_at: string;
}

// Defaults caso o DB não tenha configs (ou falhe)
const DEFAULTS: Record<string, string> = {
  dedup_similarity_threshold: '0.85',
  filter2_confidence_min: '0.7',
  content_fetch_concurrency: '5',
  search_max_results: '15',
  manual_search_max_results_30d: '50',
  manual_search_max_results_60d: '50',
  manual_search_max_results_90d: '80',
  monthly_budget_usd: '100',
  budget_warning_threshold: '0.9',
  scan_cron_schedule: '*/5 * * * *',
  worker_concurrency: '3',
  worker_max_per_minute: '10',
  scan_lock_ttl_minutes: '30',
  filter2_max_content_chars: '4000',
  push_enabled: 'true',
  auth_required: 'true',
  search_permission: 'authorized',
  // Ingestão robusta - fontes
  multi_query_enabled: 'true',
  search_queries_per_scan: '2',
  google_news_rss_enabled: 'true',
  section_crawling_enabled: 'true',
  section_crawling_max_domains: '5',
  ssp_scraping_enabled: 'true',
  filter0_regex_enabled: 'true',
};

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

    return (data || []) as ConfigEntry[];
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
