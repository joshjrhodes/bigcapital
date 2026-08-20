import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ClsService, UseCls } from 'nestjs-cls';
import { MailTransporter } from '@/modules/Mail/MailTransporter.service';
import { TenantModel } from '@/modules/System/models/TenantModel';
import { SystemUser } from '@/modules/System/models/SystemUser';
import { FollowUpsService } from '../commands/FollowUps.service';
import { RpwCrmContactsService } from '../queries/GetCrmContacts.service';

/**
 * The 7am digest: what needs following up today.
 *
 * A follow-up nobody looks at is worth nothing, and this system has no reason
 * to be open at 7am — so the reminder comes to Josh rather than waiting for him
 * to come to it.
 *
 * Runs in the container, not on a laptop being awake, and skips silently when
 * there is nothing due. An empty inbox is the correct output on a quiet day.
 */
@Injectable()
export class FollowUpDigestJob {
  private readonly logger = new Logger(FollowUpDigestJob.name);

  constructor(
    private readonly followUps: FollowUpsService,
    private readonly contacts: RpwCrmContactsService,
    private readonly mailTransporter: MailTransporter,
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
    @Inject(TenantModel.name)
    private readonly tenantModel: typeof TenantModel,
    @Inject(SystemUser.name)
    private readonly systemUserModel: typeof SystemUser,
  ) {}

  @Cron('0 7 * * *')
  async sendDailyDigest() {
    try {
      await this.runForEachTenant();
    } catch (error) {
      this.logger.error(`Follow-up digest failed: ${(error as Error)?.message}`);
    }
  }

  /**
   * Exposed so the digest can be triggered by hand — testing a 7am email by
   * waiting until 7am is not a workable loop.
   */
  public async runForEachTenant(): Promise<{ tenants: number; sent: number }> {
    const tenants = await this.tenantModel.query().whereNotNull('initializedAt');
    let sent = 0;

    for (const tenant of tenants) {
      const user = await this.systemUserModel
        .query()
        .where('tenantId', tenant.id)
        .first();

      if (!user) continue;

      const delivered = await this.runForTenant(tenant.organizationId, user.id);
      if (delivered) sent += 1;
    }
    return { tenants: tenants.length, sent };
  }

  /**
   * A cron tick has no request behind it, so the tenant context has to be set
   * explicitly — the same thing the queue processors do.
   */
  @UseCls()
  async runForTenant(organizationId: string, userId: number): Promise<boolean> {
    this.cls.set('organizationId', organizationId);
    this.cls.set('userId', userId);

    const today = new Date().toISOString().slice(0, 10);
    const due = await this.followUps.due(today);

    if (!due.length) return false;

    const names = await this.contacts.getNamesByIds(
      due.map((item) => item.contactId).filter(Boolean) as number[],
    );
    const to =
      this.configService.get('mail.from.address') ||
      this.configService.get('mail.username');

    if (!to) {
      this.logger.warn('No from-address configured — skipping the follow-up digest.');
      return false;
    }
    const lines = due.map((item) => {
      const who = item.contactId ? names[item.contactId] ?? 'Unknown client' : 'General';
      const overdue = item.dueOn < today ? ' (overdue)' : '';
      return `• ${who}${overdue} — ${item.note}  [due ${item.dueOn}]`;
    });

    await this.mailTransporter.send({
      mailOptions: {
        from: `${this.configService.get('mail.from.name') ?? 'RPW Platform'} <${to}>`,
        to,
        subject: `Follow-ups for today (${due.length})`,
        text: [
          `${due.length} follow-up${due.length === 1 ? '' : 's'} due:`,
          '',
          ...lines,
          '',
          'Mark them done in the app when they are handled.',
        ].join('\n'),
      },
    } as any);

    this.logger.log(`Sent a follow-up digest with ${due.length} item(s).`);
    return true;
  }
}
