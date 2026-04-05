// ============================================
// Billing Scheduler — fecha o mes no dia 01
// ============================================

import cron from 'node-cron';
import { supabase } from '../../config/database';
import { configManager } from '../../services/configManager';
import { logger } from '../../middleware/logger';

let billingTask: cron.ScheduledTask | null = null;

/**
 * Fecha o mes anterior: soma custos por provider, salva em billing_history.
 */
export async function closeMonth(): Promise<void> {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  const startOfPrev = `${monthStr}-01T00:00:00.000Z`;
  const startOfCurrent = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;

  logger.info(`[Billing] Closing month ${monthStr}...`);

  // Check if already closed
  const { data: existing } = await supabase
    .from('billing_history')
    .select('id')
    .eq('month', monthStr)
    .single();

  if (existing) {
    logger.info(`[Billing] Month ${monthStr} already closed, skipping`);
    return;
  }

  // Get all costs from previous month
  const { data: costs, error } = await supabase
    .from('budget_tracking')
    .select('provider, cost_usd, source')
    .gte('created_at', startOfPrev)
    .lt('created_at', startOfCurrent);

  if (error) {
    logger.error(`[Billing] Failed to fetch costs: ${error.message}`);
    return;
  }

  if (!costs || costs.length === 0) {
    logger.info(`[Billing] No costs for ${monthStr}, saving empty record`);
  }

  // Calculate totals
  const breakdown: Record<string, number> = {};
  let totalCost = 0;

  for (const row of costs || []) {
    const cost = Number(row.cost_usd);
    totalCost += cost;
    breakdown[row.provider] = (breakdown[row.provider] || 0) + cost;
  }

  // Round breakdown values
  for (const key of Object.keys(breakdown)) {
    breakdown[key] = parseFloat(breakdown[key].toFixed(4));
  }

  // Count scans from operation_logs
  const { count: scanCount } = await supabase
    .from('operation_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfPrev)
    .lt('created_at', startOfCurrent);

  // Save to billing_history
  const { error: insertError } = await supabase
    .from('billing_history')
    .insert({
      month: monthStr,
      total_cost_usd: parseFloat(totalCost.toFixed(4)),
      total_scans: scanCount || 0,
      breakdown,
    });

  if (insertError) {
    logger.error(`[Billing] Failed to save billing: ${insertError.message}`);
    return;
  }

  logger.info(`[Billing] Month ${monthStr} closed: $${totalCost.toFixed(4)}, ${scanCount || 0} scans`);
}

/**
 * Inicia cron que verifica diariamente se hoje e o dia de fechar billing.
 * Roda todo dia as 00:05 UTC, mas so fecha se for o dia configurado.
 */
export function startBillingScheduler(): void {
  // Verifica todo dia as 00:05 UTC
  billingTask = cron.schedule('5 0 * * *', async () => {
    try {
      const closeDay = await configManager.getNumber('billing_close_day');
      const today = new Date().getUTCDate();

      if (today === closeDay) {
        logger.info(`[Billing] Today is day ${closeDay}, closing previous month...`);
        await closeMonth();
      }
    } catch (err) {
      logger.error(`[Billing] Error: ${(err as Error).message}`);
    }
  });

  logger.info('[Billing] Scheduler started (checks daily at 00:05 UTC)');
}

export function stopBillingScheduler(): void {
  if (billingTask) {
    billingTask.stop();
    billingTask = null;
    logger.info('[Billing] Scheduler stopped');
  }
}
