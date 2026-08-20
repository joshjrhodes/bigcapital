import { BaseModel } from '@/models/Model';

export class RpwContactProfile extends BaseModel {
  public contactId!: number;
  public referralSource?: string;

  public createdAt!: Date;
  public updatedAt!: Date;

  static get tableName() {
    return 'rpw_contact_profiles';
  }

  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }
}
