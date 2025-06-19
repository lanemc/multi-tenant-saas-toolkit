import { AuditStore, AuditEvent, AuditQueryFilter, AuditQuerySort, AuditQueryPagination } from '../types';

export interface InMemoryAuditStoreConfig {
  maxEvents?: number;
}

export class InMemoryAuditStore implements AuditStore {
  private events: AuditEvent[] = [];
  private maxEvents: number;

  constructor(config: InMemoryAuditStoreConfig = {}) {
    this.maxEvents = config.maxEvents || 10000;
  }

  async store(event: AuditEvent): Promise<void> {
    this.events.push(event);
    
    // Apply rotation if needed
    if (this.events.length > this.maxEvents) {
      const eventsToRemove = this.events.length - this.maxEvents;
      this.events.splice(0, eventsToRemove);
    }
  }

  async query(
    filter: AuditQueryFilter = {},
    sort?: AuditQuerySort,
    pagination?: AuditQueryPagination
  ): Promise<AuditEvent[]> {
    let results = this.events.filter(event => this.matchesFilter(event, filter));

    // Apply sorting
    if (sort) {
      results = this.sortEvents(results, sort);
    } else {
      // Default sort by timestamp descending
      results = results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    // Apply pagination
    if (pagination) {
      const start = pagination.offset || 0;
      const end = start + (pagination.limit || results.length);
      results = results.slice(start, end);
    }

    return results;
  }

  async count(filter: AuditQueryFilter = {}): Promise<number> {
    return this.events.filter(event => this.matchesFilter(event, filter)).length;
  }

  // Utility methods for testing
  async getAll(): Promise<AuditEvent[]> {
    return [...this.events];
  }

  async clear(): Promise<void> {
    this.events = [];
  }

  private matchesFilter(event: AuditEvent, filter: AuditQueryFilter): boolean {
    if (filter.tenant && event.tenant !== filter.tenant) {
      return false;
    }

    if (filter.actor && event.actor.id !== filter.actor) {
      return false;
    }

    if (filter.action && event.action !== filter.action) {
      return false;
    }

    if (filter.resourceType && event.resource.type !== filter.resourceType) {
      return false;
    }

    if (filter.resourceId && event.resource.id !== filter.resourceId) {
      return false;
    }

    if (filter.result && event.result !== filter.result) {
      return false;
    }

    if (filter.startDate && event.timestamp < filter.startDate) {
      return false;
    }

    if (filter.endDate && event.timestamp > filter.endDate) {
      return false;
    }

    return true;
  }

  private sortEvents(events: AuditEvent[], sort: AuditQuerySort): AuditEvent[] {
    return events.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sort.field) {
        case 'timestamp':
          aValue = a.timestamp.getTime();
          bValue = b.timestamp.getTime();
          break;
        case 'action':
          aValue = a.action;
          bValue = b.action;
          break;
        case 'result':
          aValue = a.result;
          bValue = b.result;
          break;
        case 'actor':
          aValue = a.actor.id;
          bValue = b.actor.id;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sort.order === 'asc' ? -1 : 1;
      } else if (aValue > bValue) {
        return sort.order === 'asc' ? 1 : -1;
      } else {
        return 0;
      }
    });
  }
}