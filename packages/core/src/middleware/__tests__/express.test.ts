import { Request, Response, NextFunction } from 'express';

import { TenantContext } from '../../context/tenant-context';
import { 
  createTenantMiddleware, 
  requireTenantAuth, 
  requireRole, 
  requirePermission,
  TenantRequest 
} from '../express';

// Mock implementations
const mockRequest = (overrides: Partial<Request> = {}): Partial<TenantRequest> => ({
  headers: {},
  hostname: 'test.example.com',
  get: jest.fn((header: string) => {
    const headers = overrides.headers || {};
    return (headers as any)[header?.toLowerCase()];
  }),
  ...overrides
});

const mockResponse = (): Partial<Response> => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  send: jest.fn()
});

const mockNext: NextFunction = jest.fn();

describe('Express Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TenantContext.clear();
  });

  describe('createTenantMiddleware', () => {
    describe('subdomain strategy', () => {
      it('should extract tenant from subdomain', async () => {
        const middleware = createTenantMiddleware({
          strategy: 'subdomain'
        });

        const req = mockRequest({ hostname: 'tenant123.example.com' });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(req.tenant).toBe('tenant123');
        
        const context = TenantContext.get();
        expect(context?.tenantId).toBe('tenant123');
      });

      it('should handle localhost subdomain', async () => {
        const middleware = createTenantMiddleware({
          strategy: 'subdomain'
        });

        const req = mockRequest({ hostname: 'tenant123.localhost' });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(req.tenant).toBe('tenant123');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle missing subdomain', async () => {
        const middleware = createTenantMiddleware({
          strategy: 'subdomain'
        });

        const req = mockRequest({ hostname: 'example.com' });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(req.tenant).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('should exclude www subdomain', async () => {
        const middleware = createTenantMiddleware({
          strategy: 'subdomain'
        });

        const req = mockRequest({ hostname: 'www.example.com' });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(req.tenant).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('header strategy', () => {
      it('should extract tenant from header', async () => {
        const middleware = createTenantMiddleware({
          strategy: 'header',
          headerName: 'x-tenant-id'
        });

        const req = mockRequest({ 
          headers: { 'x-tenant-id': 'tenant456' },
          get: jest.fn((header) => header === 'x-tenant-id' ? 'tenant456' : undefined)
        });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(req.tenant).toBe('tenant456');
        expect(mockNext).toHaveBeenCalled();
        
        const context = TenantContext.get();
        expect(context?.tenantId).toBe('tenant456');
      });

      it('should use default header name', async () => {
        const middleware = createTenantMiddleware({
          strategy: 'header'
        });

        const req = mockRequest({ 
          get: jest.fn((header) => header === 'x-tenant-id' ? 'default-tenant' : undefined)
        });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(req.tenant).toBe('default-tenant');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle missing header', async () => {
        const middleware = createTenantMiddleware({
          strategy: 'header'
        });

        const req = mockRequest({ 
          get: jest.fn(() => undefined)
        });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(req.tenant).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('token strategy', () => {
      it('should extract tenant from JWT token', async () => {
        const mockDecodeToken = jest.fn().mockResolvedValue({ 
          tenantId: 'token-tenant',
          userId: 'user123',
          roles: ['user']
        });

        const middleware = createTenantMiddleware({
          strategy: 'token',
          decodeToken: mockDecodeToken
        });

        const req = mockRequest({ 
          get: jest.fn((header) => header === 'authorization' ? 'Bearer jwt-token' : undefined)
        });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(mockDecodeToken).toHaveBeenCalledWith('jwt-token');
        expect(req.tenant).toBe('token-tenant');
        expect(req.user).toEqual({
          id: 'user123',
          tenantId: 'token-tenant',
          roles: ['user']
        });
        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle malformed authorization header', async () => {
        const mockDecodeToken = jest.fn();

        const middleware = createTenantMiddleware({
          strategy: 'token',
          decodeToken: mockDecodeToken
        });

        const req = mockRequest({ 
          get: jest.fn((header) => header === 'authorization' ? 'InvalidFormat' : undefined)
        });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(mockDecodeToken).not.toHaveBeenCalled();
        expect(req.tenant).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle token decode errors', async () => {
        const mockDecodeToken = jest.fn().mockRejectedValue(new Error('Invalid token'));

        const middleware = createTenantMiddleware({
          strategy: 'token',
          decodeToken: mockDecodeToken
        });

        const req = mockRequest({ 
          get: jest.fn((header) => header === 'authorization' ? 'Bearer invalid-token' : undefined)
        });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(req.tenant).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('should require decodeToken function for token strategy', () => {
        expect(() => {
          createTenantMiddleware({ strategy: 'token' });
        }).toThrow('decodeToken function is required for token strategy');
      });
    });

    describe('custom strategy', () => {
      it('should use custom tenant resolver', async () => {
        const customResolver = jest.fn().mockResolvedValue({
          tenantId: 'custom-tenant',
          userId: 'custom-user'
        });

        const middleware = createTenantMiddleware({
          strategy: 'custom',
          customResolver
        });

        const req = mockRequest();
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(customResolver).toHaveBeenCalledWith(req, res);
        expect(req.tenant).toBe('custom-tenant');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle custom resolver errors', async () => {
        const customResolver = jest.fn().mockRejectedValue(new Error('Custom error'));

        const middleware = createTenantMiddleware({
          strategy: 'custom',
          customResolver
        });

        const req = mockRequest();
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(req.tenant).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });

      it('should require customResolver for custom strategy', () => {
        expect(() => {
          createTenantMiddleware({ strategy: 'custom' });
        }).toThrow('customResolver function is required for custom strategy');
      });
    });

    describe('tenant validation', () => {
      it('should validate tenant using custom validator', async () => {
        const tenantValidator = jest.fn().mockResolvedValue(true);

        const middleware = createTenantMiddleware({
          strategy: 'subdomain',
          tenantValidator
        });

        const req = mockRequest({ hostname: 'valid-tenant.example.com' });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(tenantValidator).toHaveBeenCalledWith('valid-tenant');
        expect(req.tenant).toBe('valid-tenant');
        expect(mockNext).toHaveBeenCalled();
      });

      it('should reject invalid tenant', async () => {
        const tenantValidator = jest.fn().mockResolvedValue(false);

        const middleware = createTenantMiddleware({
          strategy: 'subdomain',
          tenantValidator
        });

        const req = mockRequest({ hostname: 'invalid-tenant.example.com' });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(tenantValidator).toHaveBeenCalledWith('invalid-tenant');
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid tenant' });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should handle validator errors', async () => {
        const tenantValidator = jest.fn().mockRejectedValue(new Error('Validation error'));

        const middleware = createTenantMiddleware({
          strategy: 'subdomain',
          tenantValidator
        });

        const req = mockRequest({ hostname: 'error-tenant.example.com' });
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Tenant validation failed' });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should handle unexpected errors gracefully', async () => {
        const middleware = createTenantMiddleware({
          strategy: 'custom',
          customResolver: () => {
            throw new Error('Unexpected error');
          }
        });

        const req = mockRequest();
        const res = mockResponse();

        await middleware(req as TenantRequest, res as Response, mockNext);

        expect(req.tenant).toBeUndefined();
        expect(mockNext).toHaveBeenCalled();
      });
    });
  });

  describe('requireTenantAuth', () => {
    it('should pass when tenant is present', () => {
      const middleware = requireTenantAuth();

      const req = mockRequest({ tenant: 'tenant123' });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when tenant is missing', () => {
      const middleware = requireTenantAuth();

      const req = mockRequest();
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Tenant context required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should use custom error message', () => {
      const middleware = requireTenantAuth({
        errorMessage: 'Custom tenant required message'
      });

      const req = mockRequest();
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.json).toHaveBeenCalledWith({ error: 'Custom tenant required message' });
    });

    it('should use custom status code', () => {
      const middleware = requireTenantAuth({
        statusCode: 401
      });

      const req = mockRequest();
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireRole', () => {
    it('should pass when user has required role', () => {
      const middleware = requireRole('admin');

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123', 
          roles: ['admin', 'user'] 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when user lacks required role', () => {
      const middleware = requireRole('admin');

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123', 
          roles: ['user'] 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when user is not present', () => {
      const middleware = requireRole('admin');

      const req = mockRequest();
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle multiple required roles (any)', () => {
      const middleware = requireRole(['admin', 'moderator']);

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123', 
          roles: ['moderator', 'user'] 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when user has none of the required roles', () => {
      const middleware = requireRole(['admin', 'moderator']);

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123', 
          roles: ['user'] 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user with no roles', () => {
      const middleware = requireRole('admin');

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123' 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    it('should pass when user has required permission', () => {
      const middleware = requirePermission('users:read');

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123', 
          permissions: ['users:read', 'users:write'] 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when user lacks required permission', () => {
      const middleware = requirePermission('users:delete');

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123', 
          permissions: ['users:read', 'users:write'] 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when user is not present', () => {
      const middleware = requirePermission('users:read');

      const req = mockRequest();
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle multiple required permissions (any)', () => {
      const middleware = requirePermission(['users:admin', 'users:write']);

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123', 
          permissions: ['users:write', 'posts:read'] 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject when user has none of the required permissions', () => {
      const middleware = requirePermission(['users:admin', 'users:delete']);

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123', 
          permissions: ['users:read', 'posts:read'] 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user with no permissions', () => {
      const middleware = requirePermission('users:read');

      const req = mockRequest({ 
        user: { 
          id: 'user123', 
          tenantId: 'tenant123' 
        } 
      });
      const res = mockResponse();

      middleware(req as TenantRequest, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should work with middleware chain', async () => {
      const tenantMiddleware = createTenantMiddleware({
        strategy: 'header'
      });
      const authMiddleware = requireTenantAuth();
      const roleMiddleware = requireRole('admin');

      const req = mockRequest({ 
        get: jest.fn((header) => {
          if (header === 'x-tenant-id') return 'tenant123';
          return undefined;
        }),
        user: { 
          id: 'user123', 
          tenantId: 'tenant123', 
          roles: ['admin'] 
        }
      });
      const res = mockResponse();

      // Execute middleware chain
      await tenantMiddleware(req as TenantRequest, res as Response, mockNext);
      expect(req.tenant).toBe('tenant123');

      authMiddleware(req as TenantRequest, res as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);

      roleMiddleware(req as TenantRequest, res as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(3);
    });

    it('should handle middleware chain with failures', async () => {
      const tenantMiddleware = createTenantMiddleware({
        strategy: 'header'
      });
      const authMiddleware = requireTenantAuth();

      const req = mockRequest({ 
        get: jest.fn(() => undefined) // No tenant header
      });
      const res = mockResponse();

      // Execute middleware chain
      await tenantMiddleware(req as TenantRequest, res as Response, mockNext);
      expect(req.tenant).toBeUndefined();

      authMiddleware(req as TenantRequest, res as Response, mockNext);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockNext).toHaveBeenCalledTimes(1); // Only tenant middleware called next
    });
  });
});