// ============================================
// Auth Middleware Tests
// ============================================

import { Request, Response } from 'express';

// Mock supabase before importing auth
jest.mock('../../src/config/database', () => ({
  supabaseAuth: {
    auth: {
      getUser: jest.fn(),
    },
  },
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../src/services/configManager', () => ({
  configManager: {
    getBoolean: jest.fn(),
    get: jest.fn(),
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

import { requireAuth, requireAdmin, conditionalAuth, requireSearchPermission } from '../../src/middleware/auth';
import { supabaseAuth, supabase } from '../../src/config/database';
import { configManager } from '../../src/services/configManager';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('requireAuth', () => {
  it('should return 401 if no Authorization header', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header is not Bearer', async () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', async () => {
    (supabaseAuth.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });

    const req = mockReq({ headers: { authorization: 'Bearer invalid-token' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should set req.user and call next on valid token', async () => {
    (supabaseAuth.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@test.com' } },
      error: null,
    });

    const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(req.user).toEqual({ id: 'user-123', email: 'test@test.com' });
    expect(next).toHaveBeenCalled();
  });

  it('should return 500 if supabase throws', async () => {
    (supabaseAuth.auth.getUser as jest.Mock).mockRejectedValue(new Error('Network error'));

    const req = mockReq({ headers: { authorization: 'Bearer token' } });
    const res = mockRes();
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('should return 401 if no user on request', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if user is not admin', async () => {
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: { is_admin: false },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });
    // Chain: from().select().eq().single()
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });

    const req = mockReq();
    req.user = { id: 'user-123' };
    const res = mockRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next if user is admin', async () => {
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: { is_admin: true },
      error: null,
    });
    (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });

    const req = mockReq();
    req.user = { id: 'admin-123' };
    const res = mockRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 500 if DB throws', async () => {
    (supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error('DB error');
    });

    const req = mockReq();
    req.user = { id: 'user-123' };
    const res = mockRes();
    const next = jest.fn();

    await requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('conditionalAuth', () => {
  it('should allow anonymous access when auth_required=false', async () => {
    (configManager.getBoolean as jest.Mock).mockResolvedValue(false);

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await conditionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('should extract user when auth_required=false and valid token provided', async () => {
    (configManager.getBoolean as jest.Mock).mockResolvedValue(false);
    (supabaseAuth.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@test.com' } },
      error: null,
    });

    const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = mockRes();
    const next = jest.fn();

    await conditionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-123', email: 'test@test.com' });
  });

  it('should still allow anonymous if token is invalid and auth_required=false', async () => {
    (configManager.getBoolean as jest.Mock).mockResolvedValue(false);
    (supabaseAuth.auth.getUser as jest.Mock).mockRejectedValue(new Error('Invalid'));

    const req = mockReq({ headers: { authorization: 'Bearer bad-token' } });
    const res = mockRes();
    const next = jest.fn();

    await conditionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('should require auth when auth_required=true', async () => {
    (configManager.getBoolean as jest.Mock).mockResolvedValue(true);

    const req = mockReq(); // no token
    const res = mockRes();
    const next = jest.fn();

    await conditionalAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireSearchPermission', () => {
  it('should allow anonymous when search_permission=all', async () => {
    (configManager.get as jest.Mock).mockResolvedValue('all');

    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await requireSearchPermission(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should require auth when search_permission=authorized', async () => {
    (configManager.get as jest.Mock).mockResolvedValue('authorized');

    const req = mockReq(); // no token
    const res = mockRes();
    const next = jest.fn();

    await requireSearchPermission(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should extract user when search_permission=all and valid token provided', async () => {
    (configManager.get as jest.Mock).mockResolvedValue('all');
    (supabaseAuth.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-456', email: 'user@test.com' } },
      error: null,
    });

    const req = mockReq({ headers: { authorization: 'Bearer token' } });
    const res = mockRes();
    const next = jest.fn();

    await requireSearchPermission(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-456', email: 'user@test.com' });
  });
});
