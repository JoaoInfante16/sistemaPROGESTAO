// ============================================
// Validation Schema Tests
// ============================================

import { schemas } from '../../src/middleware/validation';

describe('schemas.pagination', () => {
  it('should accept valid pagination', () => {
    const result = schemas.pagination.safeParse({ offset: '0', limit: '20' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.offset).toBe(0);
      expect(result.data.limit).toBe(20);
    }
  });

  it('should use defaults when omitted', () => {
    const result = schemas.pagination.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.offset).toBe(0);
      expect(result.data.limit).toBe(20);
    }
  });

  it('should reject negative offset', () => {
    const result = schemas.pagination.safeParse({ offset: '-1' });
    expect(result.success).toBe(false);
  });

  it('should reject limit > 100', () => {
    const result = schemas.pagination.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });

  it('should reject limit = 0', () => {
    const result = schemas.pagination.safeParse({ limit: '0' });
    expect(result.success).toBe(false);
  });
});

describe('schemas.createLocation', () => {
  it('should accept valid state', () => {
    const result = schemas.createLocation.safeParse({
      type: 'state',
      name: 'Rio de Janeiro',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('state');
      expect(result.data.scan_frequency_minutes).toBe(60); // default
      expect(result.data.mode).toBe('any'); // default
    }
  });

  it('should accept valid city with all options', () => {
    const result = schemas.createLocation.safeParse({
      type: 'city',
      name: 'Niteroi',
      parent_id: '550e8400-e29b-41d4-a716-446655440000',
      mode: 'keywords',
      keywords: ['assalto', 'roubo'],
      scan_frequency_minutes: 12,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid type', () => {
    const result = schemas.createLocation.safeParse({
      type: 'country',
      name: 'Brasil',
    });
    expect(result.success).toBe(false);
  });

  it('should reject name too short', () => {
    const result = schemas.createLocation.safeParse({
      type: 'state',
      name: 'A',
    });
    expect(result.success).toBe(false);
  });

  it('should reject scan_frequency_minutes < 5', () => {
    const result = schemas.createLocation.safeParse({
      type: 'city',
      name: 'Niteroi',
      scan_frequency_minutes: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject scan_frequency_minutes > 1440', () => {
    const result = schemas.createLocation.safeParse({
      type: 'city',
      name: 'Niteroi',
      scan_frequency_minutes: 2000,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid parent_id format', () => {
    const result = schemas.createLocation.safeParse({
      type: 'city',
      name: 'Niteroi',
      parent_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('schemas.updateLocation', () => {
  it('should accept partial update (active only)', () => {
    const result = schemas.updateLocation.safeParse({ active: false });
    expect(result.success).toBe(true);
  });

  it('should accept partial update (mode only)', () => {
    const result = schemas.updateLocation.safeParse({ mode: 'keywords' });
    expect(result.success).toBe(true);
  });

  it('should accept all fields', () => {
    const result = schemas.updateLocation.safeParse({
      active: true,
      mode: 'any',
      keywords: ['crime'],
      scan_frequency_minutes: 30,
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty object (no updates)', () => {
    const result = schemas.updateLocation.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('schemas.updateRateLimit', () => {
  it('should accept valid rate limit update', () => {
    const result = schemas.updateRateLimit.safeParse({
      max_concurrent: 10,
      min_time_ms: 100,
    });
    expect(result.success).toBe(true);
  });

  it('should reject max_concurrent > 50', () => {
    const result = schemas.updateRateLimit.safeParse({ max_concurrent: 100 });
    expect(result.success).toBe(false);
  });

  it('should reject min_time_ms < 10', () => {
    const result = schemas.updateRateLimit.safeParse({ min_time_ms: 5 });
    expect(result.success).toBe(false);
  });

  it('should accept null quotas', () => {
    const result = schemas.updateRateLimit.safeParse({
      daily_quota: null,
      monthly_quota: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('schemas.manualSearch', () => {
  it('should accept query-only search', () => {
    const result = schemas.manualSearch.safeParse({ query: 'assalto centro' });
    expect(result.success).toBe(true);
  });

  it('should accept full search with filters', () => {
    const result = schemas.manualSearch.safeParse({
      query: 'roubo em niteroi',
      cidade: 'Niteroi',
      tipoCrime: 'Roubo',
      dateFrom: '2026-01-01',
      dateTo: '2026-02-08',
    });
    expect(result.success).toBe(true);
  });

  it('should reject query too short', () => {
    const result = schemas.manualSearch.safeParse({ query: 'ab' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid date format', () => {
    const result = schemas.manualSearch.safeParse({
      query: 'test query',
      dateFrom: '01/01/2026',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid ISO date format', () => {
    const result = schemas.manualSearch.safeParse({
      query: 'test query',
      dateFrom: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });
});

describe('schemas.triggerManualSearch', () => {
  it('should accept valid trigger with defaults', () => {
    const result = schemas.triggerManualSearch.safeParse({
      estado: 'Rio de Janeiro',
      cidade: 'Niteroi',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periodo_dias).toBe(30); // default
    }
  });

  it('should accept all fields', () => {
    const result = schemas.triggerManualSearch.safeParse({
      estado: 'Rio de Janeiro',
      cidade: 'Niteroi',
      periodo_dias: 90,
      tipo_crime: 'Roubo',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing estado', () => {
    const result = schemas.triggerManualSearch.safeParse({
      cidade: 'Niteroi',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing cidade', () => {
    const result = schemas.triggerManualSearch.safeParse({
      estado: 'Rio de Janeiro',
    });
    expect(result.success).toBe(false);
  });

  it('should reject periodo_dias > 365', () => {
    const result = schemas.triggerManualSearch.safeParse({
      estado: 'RJ',
      cidade: 'Niteroi',
      periodo_dias: 400,
    });
    expect(result.success).toBe(false);
  });

  it('should reject periodo_dias < 1', () => {
    const result = schemas.triggerManualSearch.safeParse({
      estado: 'RJ',
      cidade: 'Niteroi',
      periodo_dias: 0,
    });
    expect(result.success).toBe(false);
  });
});
