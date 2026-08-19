import { Inject, Injectable } from '@nestjs/common';
import { RpwTransactionCounty } from '../models/RpwTransactionCounty.model';
import { RpwTaxableTransactionType } from '../RpwSalesTax.constants';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

export interface DocumentWithCounty {
  transactionType: string;
  transactionId: number;
  documentNumber: string | null;
  documentDate: string | null;
  customerName: string | null;
  amount: number;
  countyId: number | null;
  countyName: string | null;
}

/**
 * Lists sales documents alongside the job-site county recorded against them.
 *
 * This is what makes county reporting usable: it surfaces the documents that
 * still have no county, which are exactly the ones that would quietly go
 * missing from an ODT return.
 */
@Injectable()
export class GetDocumentsWithCountyService {
  constructor(
    @Inject(RpwTransactionCounty.name)
    private readonly transactionCountyModel: TenantModelProxy<
      typeof RpwTransactionCounty
    >,
  ) {}

  public async getDocuments(
    fromDate: string,
    toDate: string,
    limit = 100,
  ): Promise<DocumentWithCounty[]> {
    const knex = this.transactionCountyModel().knex();

    const invoices = await knex('sales_invoices as doc')
      .leftJoin('rpw_transaction_counties as tc', function () {
        this.on('tc.transactionId', '=', 'doc.id').andOnVal(
          'tc.transactionType',
          RpwTaxableTransactionType.SaleInvoice,
        );
      })
      .leftJoin('rpw_county_tax_rates as county', 'county.id', 'tc.countyId')
      .leftJoin('contacts as customer', 'customer.id', 'doc.customerId')
      .where('doc.invoiceDate', '>=', fromDate)
      .andWhere('doc.invoiceDate', '<=', toDate)
      .orderBy('doc.invoiceDate', 'desc')
      .limit(limit)
      .select(
        'doc.id as transactionId',
        'doc.invoiceNo as documentNumber',
        'doc.invoiceDate as documentDate',
        'doc.balance as amount',
        'customer.displayName as customerName',
        'county.id as countyId',
        'county.countyName as countyName',
      );

    const estimates = await knex('sales_estimates as doc')
      .leftJoin('rpw_transaction_counties as tc', function () {
        this.on('tc.transactionId', '=', 'doc.id').andOnVal(
          'tc.transactionType',
          RpwTaxableTransactionType.SaleEstimate,
        );
      })
      .leftJoin('rpw_county_tax_rates as county', 'county.id', 'tc.countyId')
      .leftJoin('contacts as customer', 'customer.id', 'doc.customerId')
      .where('doc.estimateDate', '>=', fromDate)
      .andWhere('doc.estimateDate', '<=', toDate)
      .orderBy('doc.estimateDate', 'desc')
      .limit(limit)
      .select(
        'doc.id as transactionId',
        'doc.estimateNumber as documentNumber',
        'doc.estimateDate as documentDate',
        'doc.amount as amount',
        'customer.displayName as customerName',
        'county.id as countyId',
        'county.countyName as countyName',
      );

    const shape = (row: any, type: string): DocumentWithCounty => ({
      transactionType: type,
      transactionId: Number(row.transactionId),
      documentNumber: row.documentNumber ?? null,
      documentDate: row.documentDate
        ? new Date(row.documentDate).toISOString().slice(0, 10)
        : null,
      customerName: row.customerName ?? null,
      amount: Number(row.amount ?? 0),
      countyId: row.countyId ? Number(row.countyId) : null,
      countyName: row.countyName ?? null,
    });

    return [
      ...invoices.map((row) => shape(row, RpwTaxableTransactionType.SaleInvoice)),
      ...estimates.map((row) => shape(row, RpwTaxableTransactionType.SaleEstimate)),
    ].sort((a, b) => (b.documentDate ?? '').localeCompare(a.documentDate ?? ''));
  }
}
