import { Inject, Injectable } from '@nestjs/common';
import { RpwContactNote } from '../models/RpwContactNote.model';
import { RpwContactEvent } from '../models/RpwContactEvent.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

export interface TimelineEntry {
  kind: 'note' | 'event';
  id: number;
  at: string;
  summary: string;
  body?: string;
  eventType?: string;
  referenceType?: string;
  referenceId?: number;
}

/**
 * One chronological story per customer: what Josh wrote down, interleaved with
 * what the system recorded.
 */
@Injectable()
export class GetContactTimelineService {
  constructor(
    @Inject(RpwContactNote.name)
    private readonly noteModel: TenantModelProxy<typeof RpwContactNote>,
    @Inject(RpwContactEvent.name)
    private readonly eventModel: TenantModelProxy<typeof RpwContactEvent>,
  ) {}

  public async getTimeline(contactId: number, limit = 100): Promise<TimelineEntry[]> {
    const [notes, activity] = await Promise.all([
      this.noteModel()
        .query()
        .where('contactId', contactId)
        .orderBy('created_at', 'desc')
        .limit(limit),
      this.eventModel()
        .query()
        .where('contactId', contactId)
        .orderBy('occurred_at', 'desc')
        .limit(limit),
    ]);

    const entries: TimelineEntry[] = [
      ...notes.map((note) => ({
        kind: 'note' as const,
        id: note.id,
        at: new Date(note.createdAt).toISOString(),
        summary: 'Note',
        body: note.body,
      })),
      ...activity.map((event) => ({
        kind: 'event' as const,
        id: event.id,
        at: new Date(event.occurredAt).toISOString(),
        summary: event.summary,
        eventType: event.eventType,
        referenceType: event.referenceType,
        referenceId: event.referenceId,
      })),
    ];

    return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  }
}
