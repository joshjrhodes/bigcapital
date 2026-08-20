import { Injectable } from '@nestjs/common';

/**
 * Turns the branding attributes that already drive the coded template into the
 * flat `inputs` object pdfme fills a design with.
 *
 * The field names here are the contract between the designer and the data: they
 * are what Josh sees in the sidebar, so they read as words rather than symbols.
 * A design that omits a field simply does not render it, and unknown inputs are
 * ignored — which is what keeps a hand-edited layout from breaking generation.
 */
@Injectable()
export class RpwPdfInputsService {
  /**
   * @param attributes - the same merged branding/document attributes the React
   *                     template receives.
   */
  public buildInputs(attributes: Record<string, any>): Record<string, any> {
    const lines = Array.isArray(attributes.lines) ? attributes.lines : [];

    // pdfme's table takes a 2D array (or a stringified one).
    const items = lines.map((line: any) => [
      [line?.item, line?.description].filter(Boolean).join('\n'),
      String(line?.quantity ?? ''),
      String(line?.rate ?? ''),
      String(line?.total ?? ''),
    ]);

    const taxes = Array.isArray(attributes.taxes) ? attributes.taxes : [];
    const taxLine = taxes.length
      ? taxes.map((tax: any) => `${tax.label}  ${tax.amount}`).join('   ')
      : '';

    return {
      logo: attributes.companyLogoUri || '',
      company_name: attributes.companyName || '',
      company_address: this.stripHtml(attributes.companyAddress),
      bill_to: this.stripHtml(attributes.customerAddress),
      job_county: attributes.jobSiteCounty ? `${attributes.jobSiteCounty}, Ohio` : '',

      doc_number: attributes.invoiceNumber || attributes.estimateNumber || '',
      doc_date: attributes.dateIssue || '',
      doc_second_date: attributes.dueDate || attributes.expirationDate || '',

      items: items.length ? items : [['', '', '', '']],

      subtotal: attributes.subtotal || '',
      tax: taxLine,
      total: attributes.total || '',
      amount_due: attributes.dueAmount || '',

      notes: attributes.statement || '',
      terms: attributes.termsConditions || '',
    };
  }

  /**
   * Addresses arrive as small HTML fragments; a PDF text field wants lines.
   */
  private stripHtml(value?: string): string {
    if (!value) return '';
    return value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
