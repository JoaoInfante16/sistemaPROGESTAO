// ============================================
// Health Check Endpoint Tests
// ============================================

jest.mock('../../src/config/database', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../src/config/redis', () => ({
  redis: {
    ping: jest.fn(),
  },
}));

jest.mock('../../src/config', () => ({
  config: {
    nodeEnv: 'test',
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

import { Request, Response } from 'express';
import { supabase } from '../../src/config/database';
import { redis } from '../../src/config/redis';

// We need to extract the route handler directly
// Since health.ts exports a Router, we test the handler logic
describe('Health Check', () => {
  let handler: (req: Request, res: Response) => Promise<void>;

  beforeAll(() => {
    // Import the router and extract the GET /health handler
    const healthRouter = require('../../src/routes/health').default;
    // Express Router stores routes in stack
    const layer = healthRouter.stack.find(
      (l: { route?: { path: string } }) => l.route?.path === '/health'
    );
    handler = layer.route.stack[0].handle;
  });

  function mockRes(): Response {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res as unknown as Response;
  }

  it('should return 200 when all checks pass', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    (redis.ping as jest.Mock).mockResolvedValue('PONG');

    const res = mockRes();
    await handler({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        database: 'ok',
        redis: 'ok',
        environment: 'test',
      })
    );
  });

  it('should return 503 when database fails', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ error: { message: 'connection refused' } }),
      }),
    });
    (redis.ping as jest.Mock).mockResolvedValue('PONG');

    const res = mockRes();
    await handler({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        database: 'error: connection refused',
        redis: 'ok',
      })
    );
  });

  it('should return 503 when redis fails', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    (redis.ping as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const res = mockRes();
    await handler({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        database: 'ok',
        redis: 'error: connection failed',
      })
    );
  });

  it('should return 503 when both fail', async () => {
    (supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('DB down');
    });
    (redis.ping as jest.Mock).mockRejectedValue(new Error('Redis down'));

    const res = mockRes();
    await handler({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
      })
    );
  });

  it('should include uptime_seconds', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    (redis.ping as jest.Mock).mockResolvedValue('PONG');

    const res = mockRes();
    await handler({} as Request, res);

    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(typeof jsonCall.uptime_seconds).toBe('number');
  });

  it('should include timestamp', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    (redis.ping as jest.Mock).mockResolvedValue('PONG');

    const res = mockRes();
    await handler({} as Request, res);

    const jsonCall = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonCall.timestamp).toBeDefined();
    // Should be a valid ISO string
    expect(new Date(jsonCall.timestamp).toISOString()).toBe(jsonCall.timestamp);
  });
});
