import { BaseModel } from '@/models/Model';

/**
 * An Ohio county and its combined sales tax rate.
 *
 * Rates are stored as percentages (6.75 means 6.75%). `verifiedAt` is null
 * until a human has checked the rate against tax.ohio.gov — ODT republishes
 * the table quarterly, so a rate that was right last quarter may not be.
 */
export class RpwCountyTaxRate extends BaseModel {
  public countyName!: string;
  public odtCode?: number;
  public combinedRate!: number;
  public countyRate!: number;
  public stateRate!: number;
  public sourceUrl?: string;
  public effectiveFrom?: Date;
  public effectiveTo?: Date;
  public isActive!: boolean;
  public verifiedAt?: Date;
  public verifiedBy?: string;

  /**
   * Table name.
   */
  static get tableName() {
    return 'rpw_county_tax_rates';
  }

  /**
   * Timestamps columns.
   */
  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * Virtual attributes.
   */
  static get virtualAttributes() {
    return ['isVerified'];
  }

  /**
   * A rate nobody has checked against ODT should not be charged to a client.
   */
  get isVerified(): boolean {
    return Boolean(this.verifiedAt);
  }

  /**
   * Model modifiers.
   */
  static get modifiers() {
    return {
      active(query) {
        query.where('is_active', true);
      },
      verified(query) {
        query.whereNotNull('verified_at');
      },
      sortedByName(query) {
        query.orderBy('county_name', 'ASC');
      },
    };
  }
}
