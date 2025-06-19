import { Request } from 'express';

import { TenantContext } from '../../context/tenant-context';
import { AuditLogger } from '../audit-logger';
import { AuditStore, AuditEvent, AuditQueryFilter } from '../types';

// Mock AuditStore implementation
class MockAuditStore implements AuditStore {
  private events: AuditEvent[] = [];
  
  async store(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
  
  async query(filter: AuditQueryFilter): Promise<AuditEvent[]> {
    return this.events.filter(event => {
      if (filter.tenant && event.tenant !== filter.tenant) return false;
      if (filter.actor && event.actor.id !== filter.actor) return false;
      if (filter.action && event.action !== filter.action) return false;
      return true;
    });
  }
  
  async count(filter: AuditQueryFilter): Promise<number> {
    return (await this.query(filter)).length;
  }
  
  getEvents(): AuditEvent[] {
    return this.events;
  }
  
  clear(): void {
    this.events = [];
  }
}

describe('AuditLogger', () => {
  let mockStore: MockAuditStore;
  let mockRequest: Partial<Request>;
  
  beforeEach(() => {
    // Reset singleton
    (AuditLogger as any).instance = undefined;
    
    mockStore = new MockAuditStore();
    mockRequest = {
      ip: '192.168.1.100',
      get: jest.fn((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0';
        if (header === 'x-forwarded-for') return '10.0.0.1';
        return undefined;
      })
    };
    
    // Clear TenantContext
    TenantContext.clear();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = AuditLogger.getInstance();
      const instance2 = AuditLogger.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should allow configuration on first getInstance', () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      expect(() => AuditLogger.getInstance({ store: new MockAuditStore() }))
        .toThrow('AuditLogger has already been initialized');
    });
  });

  describe('log()', () => {
    it('should log an event successfully', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      await logger.log({
        action: 'user.login',
        resource: { type: 'session', id: 'session123' },
        result: 'success',
        metadata: { method: 'password' }
      });
      
      const events = mockStore.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'user.login',
        resource: { type: 'session', id: 'session123' },
        result: 'success',
        metadata: { method: 'password' }
      });
      expect(events[0].id).toBeDefined();
      expect(events[0].timestamp).toBeInstanceOf(Date);
      expect(events[0].actor).toEqual({ id: 'anonymous', type: 'anonymous' });
    });

    it('should include tenant context when available', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      // Set tenant context
      TenantContext.set({
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['admin']
      });
      
      await logger.log({
        action: 'document.create',
        resource: { type: 'document', id: 'doc789' },
        result: 'success'
      });
      
      const events = mockStore.getEvents();
      expect(events[0].tenant).toBe('tenant123');
      expect(events[0].actor).toEqual({ id: 'user456', type: 'user' });
    });

    it('should sanitize sensitive data', async () => {
      const logger = AuditLogger.getInstance({ 
        store: mockStore,
        sensitiveFields: ['password', 'secret', 'token', 'apiKey']
      });
      
      await logger.log({
        action: 'user.update',
        resource: { type: 'user', id: 'user123' },
        result: 'success',
        metadata: {
          password: 'supersecret123',
          secret: 'mysecret',
          token: 'jwt-token-here',
          apiKey: 'api-key-123',
          normalField: 'visible-value'
        }
      });
      
      const events = mockStore.getEvents();
      expect(events[0].metadata).toEqual({
        password: '[REDACTED]',
        secret: '[REDACTED]',
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
        normalField: 'visible-value'
      });
    });

    it('should sanitize nested sensitive data', async () => {
      const logger = AuditLogger.getInstance({ 
        store: mockStore,
        sensitiveFields: ['password', 'credentials']
      });
      
      await logger.log({
        action: 'api.call',
        resource: { type: 'api', id: 'endpoint1' },
        result: 'success',
        metadata: {
          request: {
            body: {
              user: 'john',
              password: 'secret123',
              nested: {
                credentials: {
                  apiKey: 'key123',
                  apiSecret: 'secret456'
                }
              }
            }
          }
        }
      });
      
      const events = mockStore.getEvents();
      expect(events[0].metadata.request.body.password).toBe('[REDACTED]');
      expect(events[0].metadata.request.body.nested.credentials).toBe('[REDACTED]');
    });

    it('should extract request information when provided', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      await logger.log({
        action: 'api.access',
        resource: { type: 'api', id: '/users' },
        result: 'success',
        request: mockRequest as Request
      });
      
      const events = mockStore.getEvents();
      expect(events[0].metadata).toMatchObject({
        ip: '10.0.0.1', // Should use x-forwarded-for
        userAgent: 'Mozilla/5.0'
      });
    });

    it('should handle logging errors gracefully', async () => {
      const errorStore = new MockAuditStore();
      errorStore.store = jest.fn().mockRejectedValue(new Error('Store error'));
      
      const logger = AuditLogger.getInstance({ store: errorStore });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await expect(logger.log({
        action: 'test.action',
        resource: { type: 'test', id: '1' },
        result: 'success'
      })).resolves.not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to log audit event:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should work without a configured store', async () => {
      const logger = AuditLogger.getInstance();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await expect(logger.log({
        action: 'test.action',
        resource: { type: 'test', id: '1' },
        result: 'success'
      })).resolves.not.toThrow();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'AuditLogger: No store configured, audit event not persisted'
      );
      
      consoleWarnSpy.mockRestore();
    });

    it('should handle circular references in metadata', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      const circularObj: any = { a: 1 };
      circularObj.self = circularObj;
      
      await logger.log({
        action: 'test.circular',
        resource: { type: 'test', id: '1' },
        result: 'success',
        metadata: { circular: circularObj }
      });
      
      const events = mockStore.getEvents();
      expect(events).toHaveLength(1);
      // Should not throw and should handle circular reference
    });
  });

  describe('query()', () => {
    beforeEach(async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      // Add test data
      TenantContext.set({ tenantId: 'tenant1', userId: 'user1' });
      await logger.log({
        action: 'document.create',
        resource: { type: 'document', id: 'doc1' },
        result: 'success'
      });
      
      TenantContext.set({ tenantId: 'tenant2', userId: 'user2' });
      await logger.log({
        action: 'document.update',
        resource: { type: 'document', id: 'doc2' },
        result: 'success'
      });
      
      TenantContext.clear();
    });

    it('should query events with tenant filtering', async () => {
      const logger = AuditLogger.getInstance();
      
      TenantContext.set({ tenantId: 'tenant1' });
      const results = await logger.query({ action: 'document.create' });
      
      expect(results).toHaveLength(1);
      expect(results[0].tenant).toBe('tenant1');
    });

    it('should query all events when no tenant context', async () => {
      const logger = AuditLogger.getInstance();
      
      const results = await logger.query({});
      expect(results).toHaveLength(2);
    });

    it('should throw error when store is not configured', async () => {
      (AuditLogger as any).instance = undefined;
      const logger = AuditLogger.getInstance();
      
      await expect(logger.query({}))
        .rejects.toThrow('No audit store configured');
    });
  });

  describe('count()', () => {
    beforeEach(async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      // Add test data
      for (let i = 0; i < 5; i++) {
        TenantContext.set({ 
          tenantId: i < 3 ? 'tenant1' : 'tenant2',
          userId: `user${i}` 
        });
        
        await logger.log({
          action: i % 2 === 0 ? 'create' : 'update',
          resource: { type: 'document', id: `doc${i}` },
          result: 'success'
        });
      }
      
      TenantContext.clear();
    });

    it('should count events with filters', async () => {
      const logger = AuditLogger.getInstance();
      
      TenantContext.set({ tenantId: 'tenant1' });
      const count = await logger.count({ action: 'create' });
      
      expect(count).toBe(2); // Only tenant1's create actions
    });

    it('should count all events when no tenant context', async () => {
      const logger = AuditLogger.getInstance();
      
      const count = await logger.count({});
      expect(count).toBe(5);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined metadata gracefully', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      await logger.log({
        action: 'test.action',
        resource: { type: 'test', id: '1' },
        result: 'success',
        metadata: undefined
      });
      
      const events = mockStore.getEvents();
      expect(events[0].metadata).toEqual({});
    });

    it('should handle missing request headers', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      const minimalRequest = {
        ip: '127.0.0.1',
        get: jest.fn(() => undefined)
      };
      
      await logger.log({
        action: 'test.action',
        resource: { type: 'test', id: '1' },
        result: 'success',
        request: minimalRequest as any
      });
      
      const events = mockStore.getEvents();
      expect(events[0].metadata).toEqual({
        ip: '127.0.0.1',
        userAgent: undefined
      });
    });

    it('should generate unique IDs for events', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      const promises = Array.from({ length: 10 }, (_, i) =>
        logger.log({
          action: 'test.action',
          resource: { type: 'test', id: `${i}` },
          result: 'success'
        })
      );
      
      await Promise.all(promises);
      
      const events = mockStore.getEvents();
      const ids = events.map(e => e.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(10);
    });
  });
});