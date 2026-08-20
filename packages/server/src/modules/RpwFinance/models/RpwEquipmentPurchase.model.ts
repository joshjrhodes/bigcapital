import { BaseModel } from '@/models/Model';

/**
 * One piece of equipment bought for the business: what it is, its serial, how
 * it is treated for tax (Section 179 vs COGS), and where the bill of sale is.
 */
export class RpwEquipmentPurchase extends BaseModel {
  public tag!: 'section179' | 'cogs';
  public description!: string;
  public serialNumber?: string;
  public amount!: number;
  public purchasedOn!: string;
  public vendorName?: string;
  public referenceType?: string;
  public referenceId?: number;
  public attachmentKey?: string;
  public notes?: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  static get tableName() {
    return 'rpw_equipment_purchases';
  }

  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }
}
