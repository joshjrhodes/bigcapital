import { Inject, Injectable } from '@nestjs/common';
import { RpwTransactionCounty } from '../models/RpwTransactionCounty.model';
import { RpwTaxableTransactionType } from '../RpwSalesTax.constants';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

export interface CountySalesTaxSummaryRow {
  countyId: number;
  countyName: string;
  combinedRate: number;
  isVerified: boolean;
  invoiceCount: number;
  grossSales: number;
  taxCollected: number;
}

export interface CountySalesTaxSummary {
  fromDate: string;
  toDate: string;
  collectionEnabled: boolean;
  rows: CountySalesTaxSummaryRow[];
  totals: {
    invoiceCount: number;
    grossSales: number;
    taxCollected: number;
  };
  caveats: string[];
}

/**
 * Sales broken out by job-site county — the shape Ohio wants when a vendor
 * reports to ODT, since tax is owed at the rate of the county the work
 * happened in, not the county the business is registered in.
 */
@Injectable()
export class GetCountySalesTaxSummaryService {
  constructor(
    @Inject(RpwTransactionCounty.name)
    private readonly transactionCountyModel: TenantModelProxy<
      typeof RpwTransactionCounty
    >,
  ) {}

  public async getSummary(
    fromDate: string,
    toDate: string,
    collectionEnabled: boolean,
  ): Promise<CountySalesTaxSummary> {
    const model = this.transactionCountyModel();

    const rows = (await model
      .query()
      .alias('tc')
      .join('rpw_county_tax_rates as county', 'county.id', 'tc.countyId')
      .join('sales_invoices as invoice', 'invoice.id', 'tc.transactionId')
      .where('tc.transactionType', RpwTaxableTransactionType.SaleInvoice)
      // Draft invoices have not been sent to anyone, so they are not sales yet.
      .whereNotNull('invoice.deliveredAt')
      .andWhere('invoice.invoiceDate', '>=', fromDate)
      .andWhere('invoice.invoiceDate', '<=', toDate)
      .groupBy('county.id', 'county.countyName', 'county.combinedRate', 'county.verifiedAt')
      .select(
        'county.id as countyId',
        'county.countyName as countyName',
        'county.combinedRate as combinedRate',
        'county.verifiedAt as verifiedAt',
      )
      .count('invoice.id as invoiceCount')
      .sum('invoice.balance as grossSales')
      .sum('invoice.taxAmountWithheld as taxCollected')
      .castTo<any[]>()) as any[];

    const mapped: CountySalesTaxSummaryRow[] = rows.map((row) => ({
      countyId: Number(row.countyId),
      countyName: row.countyName,
      combinedRate: Number(row.combinedRate),
      isVerified: Boolean(row.verifiedAt),
      invoiceCount: Number(row.invoiceCount ?? 0),
      grossSales: Number(row.grossSales ?? 0),
      taxCollected: Number(row.taxCollected ?? 0),
    }));

    return {
      fromDate,
      toDate,
      collectionEnabled,
      rows: mapped,
      totals: {
        invoiceCount: mapped.reduce((sum, row) => sum + row.invoiceCount, 0),
        grossSales: mapped.reduce((sum, row) => sum + row.grossSales, 0),
        taxCollected: mapped.reduce((sum, row) => sum + row.taxCollected, 0),
      },
      caveats: [
        'Gross sales are shown as invoiced. Which RPW services are taxable in ' +
          'Ohio versus exempt is a question for the CPA and is deliberately not ' +
          'encoded here.',
        'Invoices with no job-site county recorded are not in this report — set ' +
          'the county on every invoice once collection is switched on.',
        ...(collectionEnabled
          ? []
          : ['Sales tax collection is currently OFF, so tax collected is expected to be zero.']),
      ],
    };
  }

  /**
   * Delivered invoices in the period that carry no county, so nothing quietly
   * goes unreported.
   */
  public async getUnassignedInvoiceCount(
    fromDate: string,
    toDate: string,
  ): Promise<number> {
    const model = this.transactionCountyModel();
    const knex = model.knex();

    // A left join rather than a correlated NOT EXISTS: raw SQL would bypass
    // knex's identifier mapping (this connection uppercases column names), and
    // a hand-written raw fragment is exactly the kind of thing that breaks
    // silently later.
    const result = await knex('sales_invoices as invoice')
      .leftJoin('rpw_transaction_counties as tc', function () {
        this.on('tc.transactionId', '=', 'invoice.id').andOnVal(
          'tc.transactionType',
          RpwTaxableTransactionType.SaleInvoice,
        );
      })
      .whereNull('tc.id')
      .whereNotNull('invoice.deliveredAt')
      .andWhere('invoice.invoiceDate', '>=', fromDate)
      .andWhere('invoice.invoiceDate', '<=', toDate)
      .count('invoice.id as count')
      .first();

    return Number((result as any)?.count ?? 0);
  }
}
