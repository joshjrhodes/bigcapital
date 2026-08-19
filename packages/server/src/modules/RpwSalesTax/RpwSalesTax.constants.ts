/**
 * RPW Ohio multi-county sales tax — shared constants.
 */

/** Settings group used for every RPW-specific setting. */
export const RPW_SETTINGS_GROUP = 'rpw_sales_tax';

export const RPW_SALES_TAX_SETTINGS = {
  /**
   * Master switch. Stays off until Josh's Ohio vendor's licence is approved —
   * charging sales tax without one is not a thing you want to do by accident.
   */
  COLLECTION_ENABLED: 'collection_enabled',

  /** County pre-selected on a new estimate or invoice. */
  DEFAULT_COUNTY_ID: 'default_county_id',
};

/** Document types that can carry a job-site county. */
export enum RpwTaxableTransactionType {
  SaleInvoice = 'SaleInvoice',
  SaleEstimate = 'SaleEstimate',
}
