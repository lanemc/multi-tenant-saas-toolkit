import { AuditEvent, AuditStore, AuditQueryFilter, AuditQuerySort, AuditQueryPagination } from './types';

export class InMemoryAuditStore implements AuditStore {
  private events: AuditEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
  }

  async store(event: AuditEvent): Promise<void> {
    this.events.push(event);
    
    // Rotate old events if we exceed max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  async query(
    filter: AuditQueryFilter,
    sort?: AuditQuerySort,
    pagination?: AuditQueryPagination
  ): Promise<AuditEvent[]> {
    let filtered = [...this.events];

    // Apply filters
    if (filter.tenant) {
      filtered = filtered.filter(e => e.tenant === filter.tenant);
    }
    if (filter.actor) {
      filtered = filtered.filter(e => e.actor.id === filter.actor);
    }
    if (filter.action) {
      filtered = filtered.filter(e => e.action === filter.action);
    }
    if (filter.resourceType) {
      filtered = filtered.filter(e => e.resource.type === filter.resourceType);
    }
    if (filter.resourceId) {
      filtered = filtered.filter(e => e.resource.id === filter.resourceId);
    }
    if (filter.result) {
      filtered = filtered.filter(e => e.result === filter.result);
    }
    if (filter.startDate) {
      filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
    }

    // Sort
    if (sort) {
      const sortField = sort.field;
      const sortOrder = sort.order;
      
      filtered.sort((a, b) => {
        let aVal: any, bVal: any;
        
        if (sortField === 'actor') {
          aVal = a.actor.id;
          bVal = b.actor.id;
        } else {
          aVal = a[sortField as keyof AuditEvent];
          bVal = b[sortField as keyof AuditEvent];
        }
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Pagination
    if (pagination) {
      const offset = pagination.offset || 0;
      const limit = pagination.limit || 100;
      return filtered.slice(offset, offset + limit);
    }
    
    return filtered;
  }

  async count(filter: AuditQueryFilter): Promise<number> {
    let filtered = [...this.events];

    // Apply same filters as query
    if (filter.tenant) {
      filtered = filtered.filter(e => e.tenant === filter.tenant);
    }
    if (filter.actor) {
      filtered = filtered.filter(e => e.actor.id === filter.actor);
    }
    if (filter.action) {
      filtered = filtered.filter(e => e.action === filter.action);
    }
    if (filter.resourceType) {
      filtered = filtered.filter(e => e.resource.type === filter.resourceType);
    }
    if (filter.resourceId) {
      filtered = filtered.filter(e => e.resource.id === filter.resourceId);
    }
    if (filter.result) {
      filtered = filtered.filter(e => e.result === filter.result);
    }
    if (filter.startDate) {
      filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
    }

    return filtered.length;
  }

  // Additional utility methods
  clear(): void {
    this.events = [];
  }

  getAll(): AuditEvent[] {
    return [...this.events];
  }
}