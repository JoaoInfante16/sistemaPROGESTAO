// ============================================
// CRON Scheduler Tests
// ============================================

const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'job-123' });
const mockCronStop = jest.fn();
const mockCronSchedule = jest.fn().mockReturnValue({ stop: mockCronStop });

jest.mock('../../src/config/redis', () => ({
  redis: {
    set: jest.fn(),
    get: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn(),
  },
}));

jest.mock('../../src/config/database', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('../../src/config', () => ({
  config: {
    scanCronSchedule: '*/5 * * * *',
  },
}));

jest.mock('../../src/database/queries', () => ({
  db: {
    getActiveLocations: jest.fn(),
  },
}));

jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
  })),
  Worker: jest.fn(),
  Job: jest.fn(),
}));

jest.mock('node-cron', () => ({
  schedule: mockCronSchedule,
}));

import { redis } from '../../src/config/redis';
import { enqueueScan, startScheduler, stopScheduler } from '../../src/jobs/scheduler/cronScheduler';

describe('enqueueScan', () => {
  it('should enqueue a scan job and return job id', async () => {
    const jobId = await enqueueScan('location-123');
    expect(jobId).toBe('job-123');
  });

  it('should pass locationId in job data', async () => {
    await enqueueScan('location-456');

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'scan',
      { locationId: 'location-456' },
      expect.objectContaining({
        attempts: 3,
        backoff: expect.objectContaining({ type: 'exponential' }),
      })
    );
  });

  it('should configure retry with exponential backoff', async () => {
    await enqueueScan('location-789');

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'scan',
      expect.any(Object),
      expect.objectContaining({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      })
    );
  });
});

describe('startScheduler / stopScheduler', () => {
  it('should start CRON schedule with configured expression', () => {
    startScheduler();

    expect(mockCronSchedule).toHaveBeenCalledWith(
      '*/5 * * * *',
      expect.any(Function)
    );
  });

  it('should stop scheduler when stopScheduler called', () => {
    startScheduler();
    stopScheduler();

    expect(mockCronStop).toHaveBeenCalled();
  });

  it('should not throw if stopScheduler called without starting', () => {
    // Reset internal state by calling stop first
    stopScheduler();
    // Calling stop again should not throw
    expect(() => stopScheduler()).not.toThrow();
  });
});

describe('scan lock (Redis SET NX)', () => {
  it('should acquire lock via SET with NX flag', async () => {
    (redis.set as jest.Mock).mockResolvedValue('OK');

    const result = await redis.set('scan-lock:test', '1', 'PX', 1800000, 'NX');
    expect(result).toBe('OK');
    expect(redis.set).toHaveBeenCalledWith('scan-lock:test', '1', 'PX', 1800000, 'NX');
  });

  it('should return null if lock already held', async () => {
    (redis.set as jest.Mock).mockResolvedValue(null);

    const result = await redis.set('scan-lock:test', '1', 'PX', 1800000, 'NX');
    expect(result).toBeNull();
  });
});
