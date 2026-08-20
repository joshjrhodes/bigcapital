import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { SaleInvoicePdf } from '@/modules/SaleInvoices/queries/SaleInvoicePdf.service';
import { GetSaleEstimatePdf } from '@/modules/SaleEstimates/queries/GetSaleEstimatePdf';

/**
 * Supplies the data a preview renders with: a real document when one is named,
 * otherwise representative sample data.
 *
 * Sample data matters more than it sounds. A designer previewed with empty
 * strings looks fine and then falls apart on a real invoice, so the sample is
 * deliberately awkward — long descriptions, several lines, real-looking money.
 */
@Injectable()
export class GetPreviewAttributesService {
  constructor(
    @Inject(forwardRef(() => SaleInvoicePdf))
    private readonly saleInvoicePdf: SaleInvoicePdf,
    @Inject(forwardRef(() => GetSaleEstimatePdf))
    private readonly saleEstimatePdf: GetSaleEstimatePdf,
  ) {}

  public async getAttributes(
    resource: string,
    documentId?: number,
  ): Promise<Record<string, any>> {
    if (documentId) {
      if (resource === 'SaleEstimate') {
        return (await this.saleEstimatePdf.getEstimateBrandingAttributes(
          documentId,
        )) as any;
      }
      return (await this.saleInvoicePdf.getInvoiceBrandingAttributes(
        documentId,
      )) as any;
    }
    return this.sampleAttributes(resource);
  }

  public sampleAttributes(resource: string): Record<string, any> {
    const isEstimate = resource === 'SaleEstimate';

    return {
      companyName: 'Rhodes Production Works LTD',
      companyAddress: 'Greene County, Ohio<br/>937-555-0142<br/>josh@rhodespw.com',
      customerAddress:
        'Xenia Community Church<br/>1400 W Second St<br/>Xenia, OH 45385',
      jobSiteCounty: 'Greene',
      invoiceNumber: isEstimate ? '' : 'INV-00042',
      estimateNumber: isEstimate ? 'EST-00042' : '',
      dateIssue: 'August 20, 2026',
      dueDate: isEstimate ? '' : 'September 3, 2026',
      expirationDate: isEstimate ? 'September 19, 2026' : '',
      lines: [
        {
          item: 'Event Production — Day Rate',
          description: 'Two-day Easter production — load-in, show, strike.',
          quantity: '2',
          rate: '$950.00',
          total: '$1,900.00',
        },
        {
          item: 'Audio Engineering — Day Rate',
          description: 'Front-of-house engineering, both services.',
          quantity: '2',
          rate: '$750.00',
          total: '$1,500.00',
        },
        {
          item: 'Lighting Design',
          description: 'Lighting design and plot for the sanctuary.',
          quantity: '1',
          rate: '$750.00',
          total: '$750.00',
        },
        {
          item: 'Equipment Sub-Rental',
          description: 'Six moving heads, cross-rented for the weekend.',
          quantity: '1',
          rate: '$480.00',
          total: '$480.00',
        },
      ],
      taxes: [],
      subtotal: '$4,630.00',
      total: '$4,630.00',
      dueAmount: isEstimate ? '' : '$4,630.00',
      statement: 'Crew of four. Power and rigging provided by the venue.',
      termsConditions: isEstimate
        ? 'Estimate valid for 30 days. A signed acceptance and deposit hold the date.'
        : 'Net 14. Equipment remains the property of Rhodes Production Works LTD until paid in full.',
    };
  }
}
