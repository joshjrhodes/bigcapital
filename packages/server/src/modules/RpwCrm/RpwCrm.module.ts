import { Module } from '@nestjs/common';
import { RpwCrmController } from './RpwCrm.controller';
import { RpwCrmApplication } from './RpwCrm.application';
import { ContactNotesService } from './commands/ContactNotes.service';
import { FollowUpsService } from './commands/FollowUps.service';
import { LogContactEventService } from './commands/LogContactEvent.service';
import { GetContactTimelineService } from './queries/GetContactTimeline.service';
import { RpwCrmContactsService } from './queries/GetCrmContacts.service';
import { CrmActivitySubscriber } from './subscribers/CrmActivity.subscriber';
import { FollowUpDigestJob } from './jobs/FollowUpDigest.job';
import { RpwContactNote } from './models/RpwContactNote.model';
import { RpwContactEvent } from './models/RpwContactEvent.model';
import { RpwContactProfile } from './models/RpwContactProfile.model';
import { RpwFollowUp } from './models/RpwFollowUp.model';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { MailModule } from '../Mail/Mail.module';

/**
 * Lightweight CRM (Phase 4).
 *
 * Additive in the strongest sense: it reads the contacts table, listens to
 * events the accounting modules already emit, and writes only to its own
 * tables. No accounting module knows it exists.
 */
const models = [
  RegisterTenancyModel(RpwContactNote),
  RegisterTenancyModel(RpwContactEvent),
  RegisterTenancyModel(RpwContactProfile),
  RegisterTenancyModel(RpwFollowUp),
];

@Module({
  imports: [TenancyModule, MailModule, ...models],
  controllers: [RpwCrmController],
  providers: [
    RpwCrmApplication,
    ContactNotesService,
    FollowUpsService,
    LogContactEventService,
    GetContactTimelineService,
    RpwCrmContactsService,
    CrmActivitySubscriber,
    FollowUpDigestJob,
  ],
  exports: [RpwCrmApplication, ...models],
})
export class RpwCrmModule {}
