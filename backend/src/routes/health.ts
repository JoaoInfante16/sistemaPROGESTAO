import { Router, Request, Response } from 'express';
import { supabase } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config';

const router = Router();

const startedAt = Date.now();

router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, string | number> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    environment: config.nodeEnv,
    database: 'unknown',
    redis: 'unknown',
  };

  // Check database
  try {
    const { error } = await supabase.from('news').select('id').limit(1);
    checks.database = error ? `error: ${error.message}` : 'ok';
  } catch {
    checks.database = 'error: connection failed';
  }

  // Check Redis
  try {
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'error: unexpected response';
  } catch {
    checks.redis = 'error: connection failed';
  }

  const allOk = checks.database === 'ok' && checks.redis === 'ok';
  checks.status = allOk ? 'ok' : 'degraded';
  res.status(allOk ? 200 : 503).json(checks);
});

export default router;
