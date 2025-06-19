import { TenantContext } from '../tenant-context';

describe('TenantContext', () => {
  beforeEach(() => {
    TenantContext.clear();
  });

  afterEach(() => {
    TenantContext.clear();
  });

  describe('set() and get()', () => {
    it('should store and retrieve tenant context', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['admin', 'user']
      };

      TenantContext.set(context);
      const retrieved = TenantContext.get();

      expect(retrieved).toEqual(context);
    });

    it('should return undefined when no context is set', () => {
      const retrieved = TenantContext.get();
      expect(retrieved).toBeUndefined();
    });

    it('should allow partial context objects', () => {
      const context = {
        tenantId: 'tenant123'
      };

      TenantContext.set(context);
      const retrieved = TenantContext.get();

      expect(retrieved).toEqual(context);
    });

    it('should allow updating context', () => {
      const initialContext = {
        tenantId: 'tenant123',
        userId: 'user456'
      };

      const updatedContext = {
        tenantId: 'tenant123',
        userId: 'user789',
        roles: ['admin']
      };

      TenantContext.set(initialContext);
      TenantContext.set(updatedContext);
      
      const retrieved = TenantContext.get();
      expect(retrieved).toEqual(updatedContext);
    });
  });

  describe('clear()', () => {
    it('should clear the context', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456'
      };

      TenantContext.set(context);
      expect(TenantContext.get()).toEqual(context);

      TenantContext.clear();
      expect(TenantContext.get()).toBeUndefined();
    });

    it('should not throw when clearing empty context', () => {
      expect(() => TenantContext.clear()).not.toThrow();
    });
  });

  describe('run()', () => {
    it('should run callback with context', async () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456'
      };

      const result = await TenantContext.run(context, () => {
        const retrieved = TenantContext.get();
        expect(retrieved).toEqual(context);
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should isolate context between different runs', async () => {
      const context1 = { tenantId: 'tenant1', userId: 'user1' };
      const context2 = { tenantId: 'tenant2', userId: 'user2' };

      const promises = [
        TenantContext.run(context1, async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return TenantContext.get();
        }),
        TenantContext.run(context2, async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          return TenantContext.get();
        })
      ];

      const [result1, result2] = await Promise.all(promises);

      expect(result1).toEqual(context1);
      expect(result2).toEqual(context2);
    });

    it('should not affect context outside of run', async () => {
      const outerContext = { tenantId: 'outer', userId: 'outer' };
      const innerContext = { tenantId: 'inner', userId: 'inner' };

      TenantContext.set(outerContext);

      await TenantContext.run(innerContext, () => {
        expect(TenantContext.get()).toEqual(innerContext);
      });

      expect(TenantContext.get()).toEqual(outerContext);
    });

    it('should handle async callbacks', async () => {
      const context = { tenantId: 'tenant123', userId: 'user456' };

      const result = await TenantContext.run(context, async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return TenantContext.get();
      });

      expect(result).toEqual(context);
    });

    it('should handle errors in callback', async () => {
      const context = { tenantId: 'tenant123', userId: 'user456' };

      await expect(
        TenantContext.run(context, () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('should handle sync callbacks', () => {
      const context = { tenantId: 'tenant123', userId: 'user456' };

      const result = TenantContext.run(context, () => {
        return TenantContext.get();
      });

      expect(result).toEqual(context);
    });
  });

  describe('getTenantId()', () => {
    it('should return tenant ID when context is set', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456'
      };

      TenantContext.set(context);
      expect(TenantContext.getTenantId()).toBe('tenant123');
    });

    it('should return undefined when no context is set', () => {
      expect(TenantContext.getTenantId()).toBeUndefined();
    });

    it('should return undefined when context has no tenantId', () => {
      const context = {
        userId: 'user456'
      };

      TenantContext.set(context);
      expect(TenantContext.getTenantId()).toBeUndefined();
    });
  });

  describe('getUserId()', () => {
    it('should return user ID when context is set', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456'
      };

      TenantContext.set(context);
      expect(TenantContext.getUserId()).toBe('user456');
    });

    it('should return undefined when no context is set', () => {
      expect(TenantContext.getUserId()).toBeUndefined();
    });

    it('should return undefined when context has no userId', () => {
      const context = {
        tenantId: 'tenant123'
      };

      TenantContext.set(context);
      expect(TenantContext.getUserId()).toBeUndefined();
    });
  });

  describe('getRoles()', () => {
    it('should return roles when context is set', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['admin', 'user']
      };

      TenantContext.set(context);
      expect(TenantContext.getRoles()).toEqual(['admin', 'user']);
    });

    it('should return empty array when no context is set', () => {
      expect(TenantContext.getRoles()).toEqual([]);
    });

    it('should return empty array when context has no roles', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456'
      };

      TenantContext.set(context);
      expect(TenantContext.getRoles()).toEqual([]);
    });
  });

  describe('hasRole()', () => {
    it('should return true when user has the role', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['admin', 'user']
      };

      TenantContext.set(context);
      expect(TenantContext.hasRole('admin')).toBe(true);
      expect(TenantContext.hasRole('user')).toBe(true);
    });

    it('should return false when user does not have the role', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['user']
      };

      TenantContext.set(context);
      expect(TenantContext.hasRole('admin')).toBe(false);
    });

    it('should return false when no context is set', () => {
      expect(TenantContext.hasRole('admin')).toBe(false);
    });

    it('should return false when context has no roles', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456'
      };

      TenantContext.set(context);
      expect(TenantContext.hasRole('admin')).toBe(false);
    });
  });

  describe('hasAnyRole()', () => {
    it('should return true when user has any of the roles', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['user']
      };

      TenantContext.set(context);
      expect(TenantContext.hasAnyRole(['admin', 'user'])).toBe(true);
    });

    it('should return false when user has none of the roles', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['guest']
      };

      TenantContext.set(context);
      expect(TenantContext.hasAnyRole(['admin', 'user'])).toBe(false);
    });

    it('should return false when no context is set', () => {
      expect(TenantContext.hasAnyRole(['admin', 'user'])).toBe(false);
    });

    it('should return false when empty roles array is passed', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['admin']
      };

      TenantContext.set(context);
      expect(TenantContext.hasAnyRole([])).toBe(false);
    });
  });

  describe('hasAllRoles()', () => {
    it('should return true when user has all of the roles', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['admin', 'user', 'editor']
      };

      TenantContext.set(context);
      expect(TenantContext.hasAllRoles(['admin', 'user'])).toBe(true);
    });

    it('should return false when user is missing some roles', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['user']
      };

      TenantContext.set(context);
      expect(TenantContext.hasAllRoles(['admin', 'user'])).toBe(false);
    });

    it('should return false when no context is set', () => {
      expect(TenantContext.hasAllRoles(['admin', 'user'])).toBe(false);
    });

    it('should return true when empty roles array is passed', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['admin']
      };

      TenantContext.set(context);
      expect(TenantContext.hasAllRoles([])).toBe(true);
    });
  });

  describe('Context isolation', () => {
    it('should maintain context isolation in nested async operations', async () => {
      const context1 = { tenantId: 'tenant1', userId: 'user1' };
      const context2 = { tenantId: 'tenant2', userId: 'user2' };

      const nestedOperation = async (expectedContext: any) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        expect(TenantContext.get()).toEqual(expectedContext);
        
        // Nested operation with different context
        return TenantContext.run(context2, async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          expect(TenantContext.get()).toEqual(context2);
          return 'nested-result';
        });
      };

      const result = await TenantContext.run(context1, () => {
        return nestedOperation(context1);
      });

      expect(result).toBe('nested-result');
    });

    it('should handle multiple concurrent contexts', async () => {
      const contexts = [
        { tenantId: 'tenant1', userId: 'user1' },
        { tenantId: 'tenant2', userId: 'user2' },
        { tenantId: 'tenant3', userId: 'user3' }
      ];

      const operations = contexts.map((context, index) => 
        TenantContext.run(context, async () => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
          return {
            index,
            context: TenantContext.get()
          };
        })
      );

      const results = await Promise.all(operations);

      results.forEach((result, index) => {
        expect(result.index).toBe(index);
        expect(result.context).toEqual(contexts[index]);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle null context', () => {
      TenantContext.set(null as any);
      expect(TenantContext.get()).toBeNull();
    });

    it('should handle undefined fields gracefully', () => {
      const context = {
        tenantId: undefined,
        userId: undefined,
        roles: undefined
      };

      TenantContext.set(context);
      expect(TenantContext.getTenantId()).toBeUndefined();
      expect(TenantContext.getUserId()).toBeUndefined();
      expect(TenantContext.getRoles()).toEqual([]);
    });

    it('should handle empty strings', () => {
      const context = {
        tenantId: '',
        userId: '',
        roles: []
      };

      TenantContext.set(context);
      expect(TenantContext.getTenantId()).toBe('');
      expect(TenantContext.getUserId()).toBe('');
      expect(TenantContext.getRoles()).toEqual([]);
    });

    it('should handle context with extra properties', () => {
      const context = {
        tenantId: 'tenant123',
        userId: 'user456',
        roles: ['admin'],
        extraProp: 'value',
        anotherProp: 123
      };

      TenantContext.set(context);
      const retrieved = TenantContext.get();
      expect(retrieved).toEqual(context);
    });
  });
});