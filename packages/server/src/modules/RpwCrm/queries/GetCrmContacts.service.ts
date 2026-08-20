import { Inject, Injectable } from '@nestjs/common';
import { Contact } from '@/modules/Contacts/models/Contact';
import { RpwContactProfile } from '../models/RpwContactProfile.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

/**
 * Customer lookups for the CRM surfaces. Reads the accounting contacts table
 * but never writes to it.
 */
@Injectable()
export class RpwCrmContactsService {
  constructor(
    @Inject(Contact.name)
    private readonly contactModel: TenantModelProxy<typeof Contact>,
    @Inject(RpwContactProfile.name)
    private readonly profileModel: TenantModelProxy<typeof RpwContactProfile>,
  ) {}

  /**
   * Customers with their referral source, for the CRM picker.
   */
  public async listCustomers() {
    const [contacts, profiles] = await Promise.all([
      this.contactModel()
        .query()
        .where('contactService', 'customer')
        .orderBy('display_name', 'asc')
        .select('id', 'displayName', 'email', 'workPhone'),
      this.profileModel().query(),
    ]);
    const byContact = new Map(profiles.map((p) => [p.contactId, p]));

    return contacts.map((contact) => ({
      id: contact.id,
      displayName: (contact as any).displayName,
      email: (contact as any).email,
      workPhone: (contact as any).workPhone,
      referralSource: byContact.get(contact.id)?.referralSource ?? null,
    }));
  }

  public async getNamesByIds(ids: number[]): Promise<Record<number, string>> {
    if (!ids.length) return {};

    const contacts = await this.contactModel()
      .query()
      .whereIn('id', ids)
      .select('id', 'displayName');

    return Object.fromEntries(
      contacts.map((contact) => [contact.id, (contact as any).displayName]),
    );
  }
}
