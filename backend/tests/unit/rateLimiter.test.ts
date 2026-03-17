// ============================================
// DynamicRateLimiter Tests
// ============================================

jest.mock('../../src/config/database', () => ({
  supabase: {
    from: jest.fn(),
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

describe('DynamicRateLimiter', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('../../src/config/database', () => ({
      supabase: {
        from: jest.fn(),
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
  });

  it('should execute function through rate limiter', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelectEq = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { rateLimiter } = require('../../src/services/rateLimiter');

    const result = await rateLimiter.schedule('google', async () => 42);
    expect(result).toBe(42);
  });

  it('should use defaults when DB has no configs', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelectEq = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { rateLimiter } = require('../../src/services/rateLimiter');

    // Should not throw - uses default config for google
    const result = await rateLimiter.schedule('google', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('should use defaults when DB query fails', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelectEq = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { rateLimiter } = require('../../src/services/rateLimiter');

    const result = await rateLimiter.schedule('openai', async () => 'fallback');
    expect(result).toBe('fallback');
  });

  it('should create limiter for unknown provider with minimal defaults', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelectEq = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { rateLimiter } = require('../../src/services/rateLimiter');

    const result = await rateLimiter.schedule('unknown-provider', async () => 'created');
    expect(result).toBe('created');
  });

  it('should propagate errors from scheduled function', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelectEq = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { rateLimiter } = require('../../src/services/rateLimiter');

    await expect(
      rateLimiter.schedule('google', async () => {
        throw new Error('API failed');
      })
    ).rejects.toThrow('API failed');
  });

  it('should respect rate limits (not execute instantly)', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelectEq = jest.fn().mockResolvedValue({
      data: [
        { provider: 'test', max_concurrent: 1, min_time_ms: 100, daily_quota: null, monthly_quota: null, active: true },
      ],
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { rateLimiter } = require('../../src/services/rateLimiter');

    const start = Date.now();
    await rateLimiter.schedule('test', async () => 'a');
    await rateLimiter.schedule('test', async () => 'b');
    const elapsed = Date.now() - start;

    // With minTime=100ms and 2 sequential calls, should take at least 100ms
    expect(elapsed).toBeGreaterThanOrEqual(80); // small tolerance
  });
});
