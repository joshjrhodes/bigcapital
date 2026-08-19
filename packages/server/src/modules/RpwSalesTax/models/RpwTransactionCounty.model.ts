import { BaseModel } from '@/models/Model';
import { RpwCountyTaxRate } from './RpwCountyTaxRate.model';

/**
 * Links a sales document to the county its job actually happened in.
 *
 * Deliberately a join table rather than a column on SALES_INVOICES: upstream
 * owns that table, and this way a rebase can never collide with us.
 */
export class RpwTransactionCounty extends BaseModel {
  public transactionType!: string;
  public transactionId!: number;
  public countyId!: number;

  /**
   * Table name.
   */
  static get tableName() {
    return 'rpw_transaction_counties';
  }

  /**
   * Timestamps columns.
   */
  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }

  /**
   * Relation mappings.
   */
  static get relationMappings() {
    return {
      county: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: RpwCountyTaxRate,
        join: {
          from: 'rpw_transaction_counties.countyId',
          to: 'rpw_county_tax_rates.id',
        },
      },
    };
  }
}
