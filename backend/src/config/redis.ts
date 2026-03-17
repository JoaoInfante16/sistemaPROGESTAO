import IORedis from 'ioredis';
import { config } from './index';
import { logger } from '../middleware/logger';

export const redis = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null, // Requerido pelo BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  logger.info('Redis connected');
});
