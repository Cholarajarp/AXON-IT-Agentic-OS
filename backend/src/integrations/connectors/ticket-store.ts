import { nanoid } from 'nanoid';
import { DurableJsonStore } from '../../services/durable-json-store.js';
import type { IntegrationType, ITSMTicket } from '../types.js';

interface TicketDefaults {
  externalId: string;
  type: ITSMTicket['type'];
  title: string;
  priority: ITSMTicket['priority'];
  status: string;
  metadata?: Record<string, unknown>;
}

export class TicketMemory {
  private tickets = new Map<string, ITSMTicket>();
  private hydrated = false;
  private readonly store: DurableJsonStore<ITSMTicket[]>;

  constructor(private readonly source: IntegrationType) {
    this.store = new DurableJsonStore<ITSMTicket[]>(`integrations/${source}-tickets.json`, []);
  }

  create(input: Partial<ITSMTicket>, defaults: TicketDefaults): ITSMTicket {
    this.hydrate();
    const now = Date.now();
    const ticket: ITSMTicket = {
      id: nanoid(12),
      externalId: defaults.externalId,
      type: input.type ?? defaults.type,
      title: input.title?.trim() || defaults.title,
      description: input.description ?? '',
      priority: input.priority ?? defaults.priority,
      status: input.status ?? defaults.status,
      assignee: input.assignee,
      source: this.source,
      createdAt: now,
      updatedAt: now,
      metadata: { ...defaults.metadata, ...input.metadata },
    };
    this.tickets.set(ticket.id, ticket);
    this.persist();
    return ticket;
  }

  update(id: string, updates: Partial<ITSMTicket>, defaults: TicketDefaults): ITSMTicket {
    this.hydrate();
    const existing = this.get(id);
    if (!existing) {
      return this.create({ ...updates, status: updates.status ?? defaults.status }, { ...defaults, externalId: id });
    }
    const updated: ITSMTicket = {
      ...existing,
      ...updates,
      id: existing.id,
      externalId: existing.externalId,
      source: this.source,
      metadata: { ...existing.metadata, ...updates.metadata },
      updatedAt: Date.now(),
    };
    this.tickets.set(updated.id, updated);
    this.persist();
    return updated;
  }

  get(id: string): ITSMTicket | null {
    this.hydrate();
    return this.tickets.get(id) ?? Array.from(this.tickets.values()).find((ticket) => ticket.externalId === id) ?? null;
  }

  list(): ITSMTicket[] {
    this.hydrate();
    return Array.from(this.tickets.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  nextExternalId(prefix: string, start: number, pad = 0): string {
    this.hydrate();
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escapedPrefix}(\\d+)$`);
    const max = this.list().reduce((current, ticket) => {
      const match = pattern.exec(ticket.externalId);
      return match ? Math.max(current, Number(match[1])) : current;
    }, start - 1);
    return `${prefix}${String(max + 1).padStart(pad, '0')}`;
  }

  private hydrate(): void {
    if (this.hydrated) return;
    for (const ticket of this.store.read()) {
      this.tickets.set(ticket.id, ticket);
    }
    this.hydrated = true;
  }

  private persist(): void {
    this.store.write(this.list());
  }
}
