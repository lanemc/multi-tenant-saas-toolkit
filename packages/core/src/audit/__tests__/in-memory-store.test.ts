import { InMemoryAuditStore } from '../stores/in-memory-store';
import { AuditEvent } from '../types';

describe('InMemoryAuditStore', () => {
  let store: InMemoryAuditStore;
  const mockDate = new Date('2024-01-01T00:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
    store = new InMemoryAuditStore({ maxEvents: 100 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('store()', () => {
    it('should store an audit event', async () => {
      const event: AuditEvent = {
        id: '1',
        timestamp: new Date(),
        actor: { id: 'user1', type: 'user' },
        action: 'create',
        resource: { type: 'document', id: 'doc1' },
        result: 'success',
        metadata: {},
        tenant: 'tenant1'
      };

      await store.store(event);
      const events = await store.getAll();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('should respect maxEvents limit and rotate old events', async () => {
      const storeWithLimit = new InMemoryAuditStore({ maxEvents: 3 });
      
      for (let i = 1; i <= 5; i++) {
        await storeWithLimit.store({
          id: `${i}`,
          timestamp: new Date(),
          actor: { id: 'user1', type: 'user' },
          action: 'create',
          resource: { type: 'document', id: `doc${i}` },
          result: 'success',
          metadata: {},
          tenant: 'tenant1'
        });
      }

      const events = await storeWithLimit.getAll();
      expect(events).toHaveLength(3);
      expect(events.map(e => e.id)).toEqual(['3', '4', '5']);
    });

    it('should handle concurrent stores safely', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        store.store({
          id: `${i}`,
          timestamp: new Date(),
          actor: { id: 'user1', type: 'user' },
          action: 'create',
          resource: { type: 'document', id: `doc${i}` },
          result: 'success',
          metadata: {},
          tenant: 'tenant1'
        })
      );

      await Promise.all(promises);
      const events = await store.getAll();
      expect(events).toHaveLength(10);
    });
  });

  describe('query()', () => {
    beforeEach(async () => {
      // Add test data
      const testEvents: AuditEvent[] = [
        {
          id: '1',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          actor: { id: 'user1', type: 'user' },
          action: 'create',
          resource: { type: 'document', id: 'doc1' },
          result: 'success',
          metadata: { ip: '192.168.1.1' },
          tenant: 'tenant1'
        },
        {
          id: '2',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          actor: { id: 'user2', type: 'user' },
          action: 'update',
          resource: { type: 'document', id: 'doc2' },
          result: 'success',
          metadata: { ip: '192.168.1.2' },
          tenant: 'tenant1'
        },
        {
          id: '3',
          timestamp: new Date('2024-01-01T12:00:00Z'),
          actor: { id: 'user1', type: 'user' },
          action: 'delete',
          resource: { type: 'document', id: 'doc3' },
          result: 'failure',
          metadata: { ip: '192.168.1.1', error: 'Permission denied' },
          tenant: 'tenant2'
        },
        {
          id: '4',
          timestamp: new Date('2024-01-02T10:00:00Z'),
          actor: { id: 'system', type: 'system' },
          action: 'backup',
          resource: { type: 'database', id: 'db1' },
          result: 'success',
          metadata: {},
          tenant: 'tenant1'
        }
      ];

      for (const event of testEvents) {
        await store.store(event);
      }
    });

    it('should filter by tenant', async () => {
      const results = await store.query({ tenant: 'tenant1' });
      expect(results).toHaveLength(3);
      expect(results.every(e => e.tenant === 'tenant1')).toBe(true);
    });

    it('should filter by actor', async () => {
      const results = await store.query({ actor: 'user1' });
      expect(results).toHaveLength(2);
      expect(results.every(e => e.actor.id === 'user1')).toBe(true);
    });

    it('should filter by action', async () => {
      const results = await store.query({ action: 'create' });
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('create');
    });

    it('should filter by resource type', async () => {
      const results = await store.query({ resourceType: 'document' });
      expect(results).toHaveLength(3);
      expect(results.every(e => e.resource.type === 'document')).toBe(true);
    });

    it('should filter by resource id', async () => {
      const results = await store.query({ resourceId: 'doc1' });
      expect(results).toHaveLength(1);
      expect(results[0].resource.id).toBe('doc1');
    });

    it('should filter by result', async () => {
      const results = await store.query({ result: 'failure' });
      expect(results).toHaveLength(1);
      expect(results[0].result).toBe('failure');
    });

    it('should filter by date range', async () => {
      const results = await store.query({
        startDate: new Date('2024-01-01T11:30:00Z'),
        endDate: new Date('2024-01-01T12:30:00Z')
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('3');
    });

    it('should apply multiple filters', async () => {
      const results = await store.query({
        tenant: 'tenant1',
        actor: 'user1',
        result: 'success'
      });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should sort results by timestamp descending by default', async () => {
      const results = await store.query({});
      expect(results.map(e => e.id)).toEqual(['4', '3', '2', '1']);
    });

    it('should sort results by specified field and order', async () => {
      const resultsAsc = await store.query({}, { field: 'action', order: 'asc' });
      expect(resultsAsc.map(e => e.action)).toEqual(['backup', 'create', 'delete', 'update']);

      const resultsDesc = await store.query({}, { field: 'action', order: 'desc' });
      expect(resultsDesc.map(e => e.action)).toEqual(['update', 'delete', 'create', 'backup']);
    });

    it('should apply pagination', async () => {
      const page1 = await store.query({}, undefined, { limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);
      expect(page1.map(e => e.id)).toEqual(['4', '3']);

      const page2 = await store.query({}, undefined, { limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
      expect(page2.map(e => e.id)).toEqual(['2', '1']);
    });

    it('should handle empty results', async () => {
      const results = await store.query({ tenant: 'nonexistent' });
      expect(results).toHaveLength(0);
    });

    it('should handle edge cases in date filtering', async () => {
      // Exact timestamp match
      const exactMatch = await store.query({
        startDate: new Date('2024-01-01T10:00:00Z'),
        endDate: new Date('2024-01-01T10:00:00Z')
      });
      expect(exactMatch).toHaveLength(1);
      expect(exactMatch[0].id).toBe('1');

      // Invalid date range
      const invalidRange = await store.query({
        startDate: new Date('2024-01-02T00:00:00Z'),
        endDate: new Date('2024-01-01T00:00:00Z')
      });
      expect(invalidRange).toHaveLength(0);
    });
  });

  describe('count()', () => {
    beforeEach(async () => {
      const testEvents: AuditEvent[] = [
        {
          id: '1',
          timestamp: new Date(),
          actor: { id: 'user1', type: 'user' },
          action: 'create',
          resource: { type: 'document', id: 'doc1' },
          result: 'success',
          metadata: {},
          tenant: 'tenant1'
        },
        {
          id: '2',
          timestamp: new Date(),
          actor: { id: 'user2', type: 'user' },
          action: 'update',
          resource: { type: 'document', id: 'doc2' },
          result: 'success',
          metadata: {},
          tenant: 'tenant1'
        },
        {
          id: '3',
          timestamp: new Date(),
          actor: { id: 'user1', type: 'user' },
          action: 'delete',
          resource: { type: 'document', id: 'doc3' },
          result: 'failure',
          metadata: {},
          tenant: 'tenant2'
        }
      ];

      for (const event of testEvents) {
        await store.store(event);
      }
    });

    it('should count all events when no filter provided', async () => {
      const count = await store.count({});
      expect(count).toBe(3);
    });

    it('should count filtered events', async () => {
      const tenantCount = await store.count({ tenant: 'tenant1' });
      expect(tenantCount).toBe(2);

      const resultCount = await store.count({ result: 'failure' });
      expect(resultCount).toBe(1);

      const multiFilterCount = await store.count({ 
        tenant: 'tenant1', 
        result: 'success' 
      });
      expect(multiFilterCount).toBe(2);
    });
  });

  describe('clear()', () => {
    it('should remove all events', async () => {
      await store.store({
        id: '1',
        timestamp: new Date(),
        actor: { id: 'user1', type: 'user' },
        action: 'create',
        resource: { type: 'document', id: 'doc1' },
        result: 'success',
        metadata: {},
        tenant: 'tenant1'
      });

      expect(await store.count({})).toBe(1);
      
      await store.clear();
      
      expect(await store.count({})).toBe(0);
      expect(await store.getAll()).toHaveLength(0);
    });
  });

  describe('getAll()', () => {
    it('should return all events in insertion order', async () => {
      const events: AuditEvent[] = [];
      for (let i = 1; i <= 3; i++) {
        const event = {
          id: `${i}`,
          timestamp: new Date(),
          actor: { id: 'user1', type: 'user' as const },
          action: 'create',
          resource: { type: 'document', id: `doc${i}` },
          result: 'success' as const,
          metadata: {},
          tenant: 'tenant1'
        };
        events.push(event);
        await store.store(event);
      }

      const allEvents = await store.getAll();
      expect(allEvents).toEqual(events);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null/undefined values gracefully', async () => {
      const event: AuditEvent = {
        id: '1',
        timestamp: new Date(),
        actor: { id: 'user1', type: 'user' },
        action: 'create',
        resource: { type: 'document', id: 'doc1' },
        result: 'success',
        metadata: { nullValue: null, undefinedValue: undefined },
        tenant: 'tenant1'
      };

      await store.store(event);
      const results = await store.query({ tenant: 'tenant1' });
      expect(results).toHaveLength(1);
    });

    it('should handle large metadata objects', async () => {
      const largeMetadata: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key${i}`] = `value${i}`;
      }

      const event: AuditEvent = {
        id: '1',
        timestamp: new Date(),
        actor: { id: 'user1', type: 'user' },
        action: 'create',
        resource: { type: 'document', id: 'doc1' },
        result: 'success',
        metadata: largeMetadata,
        tenant: 'tenant1'
      };

      await store.store(event);
      const results = await store.query({});
      expect(results[0].metadata).toEqual(largeMetadata);
    });
  });
});