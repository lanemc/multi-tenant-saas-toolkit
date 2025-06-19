import { AuditEvent, AuditStore, AuditQueryFilter, AuditQuerySort, AuditQueryPagination } from './types';

export class InMemoryAuditStore implements AuditStore {
  private events: AuditEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
  }

  async log(event: AuditEvent): Promise<void> {
    this.events.push(event);
    
    // Rotate old events if we exceed max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  async query(options: AuditQueryOptions): Promise<AuditEvent[]> {
    let filtered = [...this.events];

    // Apply filters
    if (options.tenantId) {
      filtered = filtered.filter(e => e.tenantId === options.tenantId);
    }
    if (options.userId) {
      filtered = filtered.filter(e => e.userId === options.userId);
    }
    if (options.action) {
      filtered = filtered.filter(e => e.action === options.action);
    }
    if (options.resource) {
      filtered = filtered.filter(e => e.resource === options.resource);
    }
    if (options.resourceId) {
      filtered = filtered.filter(e => e.resourceId === options.resourceId);
    }
    if (options.result) {
      filtered = filtered.filter(e => e.result === options.result);
    }
    if (options.startDate) {
      filtered = filtered.filter(e => e.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter(e => e.timestamp <= options.endDate!);
    }

    // Sort
    const sortField = options.orderBy || 'timestamp';
    const sortOrder = options.order || 'desc';
    
    filtered.sort((a, b) => {
      const aVal = a[sortField as keyof AuditEvent];
      const bVal = b[sortField as keyof AuditEvent];
      
      if (aVal! < bVal!) return sortOrder === 'asc' ? -1 : 1;
      if (aVal! > bVal!) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    
    return filtered.slice(offset, offset + limit);
  }

  async count(options: AuditQueryOptions): Promise<number> {
    let filtered = [...this.events];

    // Apply same filters as query
    if (options.tenantId) {
      filtered = filtered.filter(e => e.tenantId === options.tenantId);
    }
    if (options.userId) {
      filtered = filtered.filter(e => e.userId === options.userId);
    }
    if (options.action) {
      filtered = filtered.filter(e => e.action === options.action);
    }
    if (options.resource) {
      filtered = filtered.filter(e => e.resource === options.resource);
    }
    if (options.resourceId) {
      filtered = filtered.filter(e => e.resourceId === options.resourceId);
    }
    if (options.result) {
      filtered = filtered.filter(e => e.result === options.result);
    }
    if (options.startDate) {
      filtered = filtered.filter(e => e.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter(e => e.timestamp <= options.endDate!);
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