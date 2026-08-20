import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RpwFollowUp } from '../models/RpwFollowUp.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class FollowUpsService {
  constructor(
    @Inject(RpwFollowUp.name)
    private readonly followUpModel: TenantModelProxy<typeof RpwFollowUp>,
  ) {}

  public create(values: {
    contactId?: number;
    referenceType?: string;
    referenceId?: number;
    dueOn: string;
    note: string;
  }) {
    return this.followUpModel().query().insertAndFetch(values);
  }

  /**
   * Due today or earlier. Overdue items stay in this list rather than ageing
   * out of sight — a follow-up nobody did is exactly the one worth showing.
   */
  public due(today: string) {
    return this.followUpModel()
      .query()
      .modify('due', today)
      .orderBy('due_on', 'asc');
  }

  public upcoming(today: string, until: string) {
    return this.followUpModel()
      .query()
      .modify('open')
      .where('due_on', '>', today)
      .where('due_on', '<=', until)
      .orderBy('due_on', 'asc');
  }

  public forContact(contactId: number) {
    return this.followUpModel()
      .query()
      .where('contactId', contactId)
      .orderBy('due_on', 'asc');
  }

  public async complete(followUpId: number) {
    const updated = await this.followUpModel()
      .query()
      .patchAndFetchById(followUpId, { doneAt: new Date() });

    if (!updated) throw new NotFoundException('The given follow-up could not be found.');

    return updated;
  }

  /** Push it out without losing it. */
  public async snooze(followUpId: number, dueOn: string) {
    const updated = await this.followUpModel()
      .query()
      .patchAndFetchById(followUpId, { dueOn, doneAt: null });

    if (!updated) throw new NotFoundException('The given follow-up could not be found.');

    return updated;
  }

  public async remove(followUpId: number) {
    const deleted = await this.followUpModel().query().deleteById(followUpId);

    if (!deleted) throw new NotFoundException('The given follow-up could not be found.');
  }
}
