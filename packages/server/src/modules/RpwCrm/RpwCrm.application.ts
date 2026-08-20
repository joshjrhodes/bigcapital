import { Injectable } from '@nestjs/common';
import { ContactNotesService } from './commands/ContactNotes.service';
import { FollowUpsService } from './commands/FollowUps.service';
import { GetContactTimelineService } from './queries/GetContactTimeline.service';
import { RpwCrmContactsService } from './queries/GetCrmContacts.service';
import { FollowUpDigestJob } from './jobs/FollowUpDigest.job';

@Injectable()
export class RpwCrmApplication {
  constructor(
    private readonly notes: ContactNotesService,
    private readonly followUps: FollowUpsService,
    private readonly timeline: GetContactTimelineService,
    private readonly contacts: RpwCrmContactsService,
    private readonly digest: FollowUpDigestJob,
  ) {}

  public listCustomers() {
    return this.contacts.listCustomers();
  }

  public getTimeline(contactId: number) {
    return this.timeline.getTimeline(contactId);
  }

  public addNote(contactId: number, body: string) {
    return this.notes.addNote(contactId, body);
  }

  public deleteNote(noteId: number) {
    return this.notes.deleteNote(noteId);
  }

  public setReferralSource(contactId: number, referralSource: string) {
    return this.notes.setReferralSource(contactId, referralSource);
  }

  public createFollowUp(values: any) {
    return this.followUps.create(values);
  }

  public completeFollowUp(id: number) {
    return this.followUps.complete(id);
  }

  public snoozeFollowUp(id: number, dueOn: string) {
    return this.followUps.snooze(id, dueOn);
  }

  public deleteFollowUp(id: number) {
    return this.followUps.remove(id);
  }

  public followUpsForContact(contactId: number) {
    return this.followUps.forContact(contactId);
  }

  /**
   * What needs attention: due or overdue now, plus what is coming in the next
   * fortnight so nothing arrives as a surprise.
   */
  public async followUpBoard(today: string) {
    const until = new Date(new Date(today).getTime() + 14 * 86400000)
      .toISOString()
      .slice(0, 10);

    const [due, upcoming] = await Promise.all([
      this.followUps.due(today),
      this.followUps.upcoming(today, until),
    ]);
    const names = await this.contacts.getNamesByIds(
      [...due, ...upcoming].map((f) => f.contactId).filter(Boolean) as number[],
    );
    const decorate = (item: any) => ({
      ...item,
      contactName: item.contactId ? names[item.contactId] ?? null : null,
      isOverdue: item.dueOn < today,
    });

    return { today, due: due.map(decorate), upcoming: upcoming.map(decorate) };
  }

  /** Runs the 7am digest now — the only sane way to test a 7am email. */
  public sendDigestNow() {
    return this.digest.runForEachTenant();
  }
}
