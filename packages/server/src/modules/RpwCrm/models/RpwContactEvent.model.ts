import { BaseModel } from '@/models/Model';

/**
 * An auto-logged moment in a customer's history. Written by event subscribers,
 * never by hand.
 */
export class RpwContactEvent extends BaseModel {
  public contactId!: number;
  public eventType!: string;
  public referenceType?: string;
  public referenceId?: number;
  public summary!: string;
  public occurredAt!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;

  static get tableName() {
    return 'rpw_contact_events';
  }

  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }
}
