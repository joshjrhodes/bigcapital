import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RpwContactNote } from '../models/RpwContactNote.model';
import { RpwContactProfile } from '../models/RpwContactProfile.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class ContactNotesService {
  constructor(
    @Inject(RpwContactNote.name)
    private readonly noteModel: TenantModelProxy<typeof RpwContactNote>,
    @Inject(RpwContactProfile.name)
    private readonly profileModel: TenantModelProxy<typeof RpwContactProfile>,
  ) {}

  public addNote(contactId: number, body: string) {
    return this.noteModel().query().insertAndFetch({ contactId, body });
  }

  public async deleteNote(noteId: number) {
    const deleted = await this.noteModel().query().deleteById(noteId);

    if (!deleted) throw new NotFoundException('The given note could not be found.');
  }

  public getProfile(contactId: number) {
    return this.profileModel().query().findOne({ contactId });
  }

  /**
   * Marks a customer tax-exempt (or clears it), with the reason and the STEC
   * certificate that makes it defensible.
   */
  public async setTaxExemption(
    contactId: number,
    values: {
      isTaxExempt: boolean;
      taxExemptionReason?: string;
      taxExemptionCertificateKey?: string;
    },
  ) {
    const patch = {
      isTaxExempt: values.isTaxExempt,
      taxExemptionReason: values.isTaxExempt ? values.taxExemptionReason ?? null : null,
      taxExemptionCertificateKey: values.isTaxExempt
        ? values.taxExemptionCertificateKey ?? null
        : null,
    };
    const existing = await this.getProfile(contactId);

    if (existing) {
      return this.profileModel().query().patchAndFetchById(existing.id, patch);
    }
    return this.profileModel().query().insertAndFetch({ contactId, ...patch });
  }

  /**
   * Sets the referral source. Referrals drive this business, so "who sent them"
   * is worth keeping even when nothing else about the customer changes.
   */
  public async setReferralSource(contactId: number, referralSource: string) {
    const existing = await this.getProfile(contactId);

    if (existing) {
      return this.profileModel()
        .query()
        .patchAndFetchById(existing.id, { referralSource });
    }
    return this.profileModel().query().insertAndFetch({ contactId, referralSource });
  }
}
