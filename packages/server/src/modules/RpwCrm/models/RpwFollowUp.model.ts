import { BaseModel } from '@/models/Model';

export class RpwFollowUp extends BaseModel {
  public contactId?: number;
  public referenceType?: string;
  public referenceId?: number;
  public dueOn!: string;
  public note!: string;
  public doneAt?: Date;

  public createdAt!: Date;
  public updatedAt!: Date;

  static get tableName() {
    return 'rpw_follow_ups';
  }

  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }

  static get virtualAttributes() {
    return ['isDone'];
  }

  get isDone(): boolean {
    return Boolean(this.doneAt);
  }

  static get modifiers() {
    return {
      open(query) {
        query.whereNull('done_at');
      },
      /** Due today or overdue — what actually needs attention. */
      due(query, today: string) {
        query.whereNull('done_at').where('due_on', '<=', today);
      },
    };
  }
}
