// ============================================
// ConfigManager Tests
// ============================================

// Mock supabase before importing
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

// We need to test ConfigManager class directly, not the singleton
// So we re-import it fresh each time

describe('ConfigManager', () => {
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

  it('should return default value when DB is empty', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelect = jest.fn().mockResolvedValue({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { configManager } = require('../../src/services/configManager');

    const value = await configManager.get('dedup_similarity_threshold');
    expect(value).toBe('0.85');
  });

  it('should return DB value when available', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelect = jest.fn().mockResolvedValue({
      data: [{ key: 'dedup_similarity_threshold', value: '0.90' }],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { configManager } = require('../../src/services/configManager');

    const value = await configManager.get('dedup_similarity_threshold');
    expect(value).toBe('0.90');
  });

  it('should return empty string for unknown key with no default', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelect = jest.fn().mockResolvedValue({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { configManager } = require('../../src/services/configManager');

    const value = await configManager.get('nonexistent_key');
    expect(value).toBe('');
  });

  it('getNumber should parse float correctly', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelect = jest.fn().mockResolvedValue({
      data: [{ key: 'filter2_confidence_min', value: '0.75' }],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { configManager } = require('../../src/services/configManager');

    const value = await configManager.getNumber('filter2_confidence_min');
    expect(value).toBe(0.75);
  });

  it('getBoolean should return true for "true"', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelect = jest.fn().mockResolvedValue({
      data: [{ key: 'push_enabled', value: 'true' }],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { configManager } = require('../../src/services/configManager');

    const value = await configManager.getBoolean('push_enabled');
    expect(value).toBe(true);
  });

  it('getBoolean should return false for any non-"true" value', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelect = jest.fn().mockResolvedValue({
      data: [{ key: 'push_enabled', value: 'false' }],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { configManager } = require('../../src/services/configManager');

    const value = await configManager.getBoolean('push_enabled');
    expect(value).toBe(false);
  });

  it('should use defaults when DB query fails', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelect = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Connection failed' },
    });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { configManager } = require('../../src/services/configManager');

    const value = await configManager.get('monthly_budget_usd');
    expect(value).toBe('100');
  });

  it('should cache values and not query DB on every call', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelect = jest.fn().mockResolvedValue({
      data: [{ key: 'search_max_results', value: '15' }],
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { configManager } = require('../../src/services/configManager');

    // First call - triggers refresh
    await configManager.get('search_max_results');
    // Second call - should use cache
    const value = await configManager.get('search_max_results');

    expect(value).toBe('15');
    // from() should only be called once (during refresh)
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('set should update DB and local cache', async () => {
    const { supabase } = require('../../src/config/database');
    const mockUpdate = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    const mockSelect = jest.fn().mockResolvedValue({
      data: [{ key: 'push_enabled', value: 'true' }],
      error: null,
    });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'system_config') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return { select: mockSelect };
    });

    const { configManager } = require('../../src/services/configManager');

    // Initial load
    await configManager.get('push_enabled');

    // Update
    await configManager.set('push_enabled', 'false', 'admin-123');

    // Should return updated value from cache
    const value = await configManager.get('push_enabled');
    expect(value).toBe('false');
  });

  it('should have all expected default keys', async () => {
    const { supabase } = require('../../src/config/database');
    const mockSelect = jest.fn().mockResolvedValue({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

    const { configManager } = require('../../src/services/configManager');

    const expectedKeys = [
      'dedup_similarity_threshold',
      'filter2_confidence_min',
      'content_fetch_concurrency',
      'search_max_results',
      'monthly_budget_usd',
      'budget_warning_threshold',
      'scan_cron_schedule',
      'worker_concurrency',
      'worker_max_per_minute',
      'scan_lock_ttl_minutes',
      'filter2_max_content_chars',
      'push_enabled',
      'auth_required',
      'search_permission',
    ];

    for (const key of expectedKeys) {
      const value = await configManager.get(key);
      expect(value).not.toBe('');
    }
  });
});
