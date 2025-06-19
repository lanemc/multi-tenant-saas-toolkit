import { TenantContext } from '../../context/tenant-context';
import { AuditLogger } from '../audit-logger';
import { AuditAction } from '../decorator';
import { AuditStore, AuditEvent } from '../types';

// Mock AuditStore for decorator tests
class MockDecoratorStore implements AuditStore {
  private events: AuditEvent[] = [];
  
  async store(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
  
  async query(): Promise<AuditEvent[]> {
    return this.events;
  }
  
  async count(): Promise<number> {
    return this.events.length;
  }
  
  getEvents(): AuditEvent[] {
    return this.events;
  }
  
  clear(): void {
    this.events = [];
  }
}

describe('@AuditAction Decorator', () => {
  let mockStore: MockDecoratorStore;
  
  beforeEach(() => {
    // Reset singleton and clear store
    (AuditLogger as any).instance = undefined;
    mockStore = new MockDecoratorStore();
    TenantContext.clear();
  });

  describe('Method decoration', () => {
    it('should audit successful method execution', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class TestService {
        @AuditAction({
          action: 'document.create',
          resourceType: 'document',
          getResourceId: (args) => args[0].id
        })
        async createDocument(doc: { id: string; name: string }) {
          return { ...doc, created: true };
        }
      }
      
      const service = new TestService();
      const result = await service.createDocument({ id: 'doc123', name: 'Test Doc' });
      
      expect(result).toEqual({ id: 'doc123', name: 'Test Doc', created: true });
      
      const events = mockStore.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'document.create',
        resource: { type: 'document', id: 'doc123' },
        result: 'success'
      });
    });

    it('should audit failed method execution', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class TestService {
        @AuditAction({
          action: 'document.delete',
          resourceType: 'document',
          getResourceId: (args) => args[0]
        })
        async deleteDocument(id: string) {
          throw new Error('Permission denied');
        }
      }
      
      const service = new TestService();
      
      await expect(service.deleteDocument('doc123')).rejects.toThrow('Permission denied');
      
      const events = mockStore.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'document.delete',
        resource: { type: 'document', id: 'doc123' },
        result: 'failure',
        metadata: { error: 'Permission denied' }
      });
    });

    it('should include custom metadata', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class TestService {
        @AuditAction({
          action: 'user.update',
          resourceType: 'user',
          getResourceId: (args) => args[0].id,
          getMetadata: (args, result) => ({
            updatedFields: args[0].fields,
            previousValues: result?.previous
          })
        })
        async updateUser(data: { id: string; fields: string[] }) {
          return { 
            id: data.id,
            updated: true,
            previous: { name: 'Old Name' }
          };
        }
      }
      
      const service = new TestService();
      await service.updateUser({ id: 'user123', fields: ['name', 'email'] });
      
      const events = mockStore.getEvents();
      expect(events[0].metadata).toMatchObject({
        updatedFields: ['name', 'email'],
        previousValues: { name: 'Old Name' }
      });
    });

    it('should work with sync methods', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class TestService {
        @AuditAction({
          action: 'calculation.performed',
          resourceType: 'calculation',
          getResourceId: () => 'calc-session'
        })
        calculate(a: number, b: number): number {
          return a + b;
        }
      }
      
      const service = new TestService();
      const result = service.calculate(5, 3);
      
      expect(result).toBe(8);
      
      // Wait for async audit logging
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const events = mockStore.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'calculation.performed',
        resource: { type: 'calculation', id: 'calc-session' },
        result: 'success'
      });
    });

    it('should handle tenant context', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      TenantContext.set({
        tenantId: 'tenant456',
        userId: 'user789',
        roles: ['admin']
      });
      
      class TestService {
        @AuditAction({
          action: 'admin.action',
          resourceType: 'system',
          getResourceId: () => 'system'
        })
        async performAdminAction() {
          return { success: true };
        }
      }
      
      const service = new TestService();
      await service.performAdminAction();
      
      const events = mockStore.getEvents();
      expect(events[0].tenant).toBe('tenant456');
      expect(events[0].actor).toEqual({ id: 'user789', type: 'user' });
    });

    it('should work with methods that return void', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class TestService {
        @AuditAction({
          action: 'notification.sent',
          resourceType: 'notification',
          getResourceId: (args) => args[0].id
        })
        async sendNotification(notification: { id: string; message: string }): Promise<void> {
          // Simulate sending notification
          console.log(`Sent: ${notification.message}`);
        }
      }
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const service = new TestService();
      await service.sendNotification({ id: 'notif123', message: 'Hello' });
      
      const events = mockStore.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'notification.sent',
        resource: { type: 'notification', id: 'notif123' },
        result: 'success'
      });
      
      consoleLogSpy.mockRestore();
    });

    it('should handle methods with multiple parameters', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class TestService {
        @AuditAction({
          action: 'file.copied',
          resourceType: 'file',
          getResourceId: (args) => args[0], // source file
          getMetadata: (args) => ({
            source: args[0],
            destination: args[1],
            options: args[2]
          })
        })
        async copyFile(source: string, destination: string, options?: { overwrite?: boolean }) {
          return { copied: true, size: 1024 };
        }
      }
      
      const service = new TestService();
      await service.copyFile('/path/source.txt', '/path/dest.txt', { overwrite: true });
      
      const events = mockStore.getEvents();
      expect(events[0].metadata).toMatchObject({
        source: '/path/source.txt',
        destination: '/path/dest.txt',
        options: { overwrite: true }
      });
    });

    it('should preserve original method behavior on errors', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class TestService {
        @AuditAction({
          action: 'validation.check',
          resourceType: 'data',
          getResourceId: () => 'validation-session'
        })
        async validateData(data: any) {
          if (!data.required) {
            throw new TypeError('Required field missing');
          }
          return { valid: true };
        }
      }
      
      const service = new TestService();
      
      await expect(service.validateData({}))
        .rejects.toThrow('Required field missing');
      
      const events = mockStore.getEvents();
      expect(events[0].result).toBe('failure');
      expect(events[0].metadata.error).toBe('Required field missing');
    });
  });

  describe('Error handling', () => {
    it('should not affect method execution if audit logging fails', async () => {
      const failingStore = new MockDecoratorStore();
      failingStore.store = jest.fn().mockRejectedValue(new Error('Store failure'));
      
      const logger = AuditLogger.getInstance({ store: failingStore });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      class TestService {
        @AuditAction({
          action: 'test.action',
          resourceType: 'test',
          getResourceId: () => 'test123'
        })
        async testMethod() {
          return { success: true };
        }
      }
      
      const service = new TestService();
      const result = await service.testMethod();
      
      expect(result).toEqual({ success: true });
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle getter function errors gracefully', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      class TestService {
        @AuditAction({
          action: 'test.action',
          resourceType: 'test',
          getResourceId: (args) => args[0].nonexistent.id, // Will throw
          getMetadata: (args) => ({ param: args[0].value })
        })
        async testMethod(data: { value: string }) {
          return { processed: data.value };
        }
      }
      
      const service = new TestService();
      const result = await service.testMethod({ value: 'test' });
      
      expect(result).toEqual({ processed: 'test' });
      
      // Should still log event with fallback values
      const events = mockStore.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].resource.id).toBe('unknown');
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Configuration edge cases', () => {
    it('should work with minimal configuration', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class TestService {
        @AuditAction({
          action: 'simple.action',
          resourceType: 'simple'
        })
        async simpleMethod() {
          return 'done';
        }
      }
      
      const service = new TestService();
      await service.simpleMethod();
      
      const events = mockStore.getEvents();
      expect(events[0]).toMatchObject({
        action: 'simple.action',
        resource: { type: 'simple', id: 'unknown' },
        result: 'success'
      });
    });

    it('should handle static methods', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class TestService {
        @AuditAction({
          action: 'static.action',
          resourceType: 'utility',
          getResourceId: () => 'utility-function'
        })
        static async utilityMethod(value: string) {
          return value.toUpperCase();
        }
      }
      
      const result = await TestService.utilityMethod('hello');
      
      expect(result).toBe('HELLO');
      
      const events = mockStore.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        action: 'static.action',
        resource: { type: 'utility', id: 'utility-function' }
      });
    });
  });

  describe('Inheritance and complex scenarios', () => {
    it('should work with inherited methods', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class BaseService {
        @AuditAction({
          action: 'base.action',
          resourceType: 'base',
          getResourceId: (args) => args[0]
        })
        async baseMethod(id: string) {
          return { base: true, id };
        }
      }
      
      class ExtendedService extends BaseService {
        async extendedMethod(id: string) {
          return await this.baseMethod(id);
        }
      }
      
      const service = new ExtendedService();
      await service.extendedMethod('test123');
      
      const events = mockStore.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].resource.id).toBe('test123');
    });

    it('should handle multiple decorators on class', async () => {
      const logger = AuditLogger.getInstance({ store: mockStore });
      
      class MultiService {
        @AuditAction({
          action: 'method1.action',
          resourceType: 'resource1',
          getResourceId: () => 'res1'
        })
        async method1() {
          return 'result1';
        }
        
        @AuditAction({
          action: 'method2.action',
          resourceType: 'resource2',
          getResourceId: () => 'res2'
        })
        async method2() {
          return 'result2';
        }
      }
      
      const service = new MultiService();
      await service.method1();
      await service.method2();
      
      const events = mockStore.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].action).toBe('method1.action');
      expect(events[1].action).toBe('method2.action');
    });
  });
});