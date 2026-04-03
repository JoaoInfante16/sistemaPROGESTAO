// ============================================
// Dynamic Rate Limiter - FASE 3.5
// ============================================
// Lê configurações da tabela api_rate_limits no DB.
// Refresh automático a cada 5 minutos.
// Usa Bottleneck para controle de concorrência por provider.

import Bottleneck from 'bottleneck';
import { supabase } from '../../config/database';
import { logger } from '../../middleware/logger';

interface RateLimitConfig {
  provider: string;
  max_concurrent: number;
  min_time_ms: number;
  daily_quota: number | null;
  monthly_quota: number | null;
}

// Defaults caso o DB não tenha configs
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  google: { provider: 'google', max_concurrent: 1, min_time_ms: 100, daily_quota: 100, monthly_quota: null },
  perplexity: { provider: 'perplexity', max_concurrent: 2, min_time_ms: 200, daily_quota: 1000, monthly_quota: null },
  jina: { provider: 'jina', max_concurrent: 10, min_time_ms: 50, daily_quota: null, monthly_quota: null },
  openai: { provider: 'openai', max_concurrent: 5, min_time_ms: 200, daily_quota: null, monthly_quota: null },
  google_news_rss: { provider: 'google_news_rss', max_concurrent: 2, min_time_ms: 1000, daily_quota: null, monthly_quota: null },
  brave: { provider: 'brave', max_concurrent: 5, min_time_ms: 100, daily_quota: 1000, monthly_quota: null },
  brightdata: { provider: 'brightdata', max_concurrent: 10, min_time_ms: 100, daily_quota: null, monthly_quota: null },
};

class DynamicRateLimiter {
  private limiters: Map<string, Bottleneck> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private lastRefresh: Date = new Date(0);
  private refreshIntervalMs = 5 * 60 * 1000; // 5 minutos

  async getLimiter(provider: string): Promise<Bottleneck> {
    const now = new Date();
    if (now.getTime() - this.lastRefresh.getTime() > this.refreshIntervalMs) {
      await this.refreshConfigs();
    }

    if (!this.limiters.has(provider)) {
      this.createLimiter(provider);
    }

    return this.limiters.get(provider)!;
  }

  private async refreshConfigs(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('api_rate_limits')
        .select('*')
        .eq('active', true);

      if (error) {
        logger.error('[RateLimiter] Failed to refresh configs:', error.message);
        // Usar defaults se DB falhar
        this.useDefaults();
        return;
      }

      if (!data || data.length === 0) {
        logger.warn('[RateLimiter] No configs in DB, using defaults');
        this.useDefaults();
        return;
      }

      for (const row of data) {
        const cfg = row as RateLimitConfig;
        const existingCfg = this.configs.get(cfg.provider);

        // Recriar limiter apenas se config mudou
        if (
          existingCfg &&
          existingCfg.max_concurrent === cfg.max_concurrent &&
          existingCfg.min_time_ms === cfg.min_time_ms &&
          existingCfg.daily_quota === cfg.daily_quota
        ) {
          continue;
        }

        this.configs.set(cfg.provider, cfg);

        // Parar limiter antigo se existir
        const oldLimiter = this.limiters.get(cfg.provider);
        if (oldLimiter) {
          await oldLimiter.stop({ dropWaitingJobs: false });
          this.limiters.delete(cfg.provider);
        }

        this.createLimiter(cfg.provider);
      }

      this.lastRefresh = new Date();
      logger.debug(`[RateLimiter] Configs refreshed (${data.length} providers)`);
    } catch (error) {
      logger.error('[RateLimiter] Refresh error:', error);
      this.useDefaults();
    }
  }

  private useDefaults(): void {
    for (const [provider, cfg] of Object.entries(DEFAULT_CONFIGS)) {
      if (!this.configs.has(provider)) {
        this.configs.set(provider, cfg);
        this.createLimiter(provider);
      }
    }
    this.lastRefresh = new Date();
  }

  private createLimiter(provider: string): void {
    const cfg = this.configs.get(provider) || DEFAULT_CONFIGS[provider];
    if (!cfg) {
      logger.warn(`[RateLimiter] No config for provider: ${provider}, using minimal defaults`);
      this.limiters.set(
        provider,
        new Bottleneck({ maxConcurrent: 1, minTime: 500 })
      );
      return;
    }

    const limiter = new Bottleneck({
      maxConcurrent: cfg.max_concurrent,
      minTime: cfg.min_time_ms,
      reservoir: cfg.daily_quota ?? undefined,
      reservoirRefreshAmount: cfg.daily_quota ?? undefined,
      reservoirRefreshInterval: cfg.daily_quota ? 24 * 60 * 60 * 1000 : undefined,
    });

    limiter.on('depleted', () => {
      logger.warn(`[RateLimiter] ${provider} daily quota depleted!`);
    });

    this.limiters.set(provider, limiter);
    logger.debug(`[RateLimiter] Created limiter for ${provider}: concurrent=${cfg.max_concurrent}, minTime=${cfg.min_time_ms}ms`);
  }

  /**
   * Executa uma função respeitando o rate limit do provider.
   */
  async schedule<T>(provider: string, fn: () => Promise<T>): Promise<T> {
    const limiter = await this.getLimiter(provider);
    return limiter.schedule(fn);
  }
}

export const rateLimiter = new DynamicRateLimiter();
