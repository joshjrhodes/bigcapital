import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpwContactEvent } from '../models/RpwContactEvent.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

/**
 * Writes an entry onto a customer's timeline.
 *
 * Swallows its own failures on purpose: this is a side-effect of sending an
 * invoice or taking a payment, and a timeline write must never be the reason
 * one of those fails.
 */
@Injectable()
export class LogContactEventService {
  private readonly logger = new Logger(LogContactEventService.name);

  constructor(
    @Inject(RpwContactEvent.name)
    private readonly eventModel: TenantModelProxy<typeof RpwContactEvent>,
  ) {}

  public async log(entry: {
    contactId: number;
    eventType: string;
    referenceType?: string;
    referenceId?: number;
    summary: string;
    occurredAt?: Date;
  }): Promise<void> {
    if (!entry.contactId) return;

    try {
      await this.eventModel()
        .query()
        .insert({
          ...entry,
          referenceType: entry.referenceType ?? null,
          referenceId: entry.referenceId ?? null,
          occurredAt: entry.occurredAt ?? new Date(),
        });
    } catch (error) {
      // The unique index means a re-sent mail or a retried job lands here,
      // which is the intended outcome rather than a problem.
      const message = (error as Error)?.message ?? '';

      if (!/duplicate|unique/i.test(message)) {
        this.logger.warn(`Could not log a contact event: ${message}`);
      }
    }
  }
}
