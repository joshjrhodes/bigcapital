import { BaseModel } from '@/models/Model';

export class RpwContactNote extends BaseModel {
  public contactId!: number;
  public body!: string;

  public createdAt!: Date;
  public updatedAt!: Date;

  static get tableName() {
    return 'rpw_contact_notes';
  }

  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }
}
