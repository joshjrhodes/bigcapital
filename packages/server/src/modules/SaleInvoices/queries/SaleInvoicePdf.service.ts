import { Inject, Injectable, forwardRef } from '@nestjs/common';
import {
  renderInvoicePaperTemplateHtml,
  renderRpwInvoicePaperTemplateHtml,
} from '@bigcapital/pdf-templates';
import { isRpwPdfTemplateName } from '@/modules/RpwBranding/RpwPdfTemplate.utils';
import { RpwPdfGeneratorService } from '@/modules/RpwPdfDesigner/RpwPdfGenerator.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GetSaleInvoice } from './GetSaleInvoice.service';
import { transformInvoiceToPdfTemplate } from '../utils';
import { SaleInvoicePdfTemplate } from './SaleInvoicePdfTemplate.service';
import { ChromiumlyTenancy } from '@/modules/ChromiumlyTenancy/ChromiumlyTenancy.service';
import { SaleInvoice } from '../models/SaleInvoice';
import { PdfTemplateModel } from '@/modules/PdfTemplate/models/PdfTemplate';
import { events } from '@/common/events/events';
import { InvoicePdfTemplateAttributes } from '../SaleInvoice.types';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class SaleInvoicePdf {
  constructor(
    private chromiumlyTenancy: ChromiumlyTenancy,
    private getInvoiceService: GetSaleInvoice,
    private invoiceBrandingTemplateService: SaleInvoicePdfTemplate,
    private eventPublisher: EventEmitter2,

    // ── RPW ── the visual designer, when a layout is active for invoices.
    @Inject(forwardRef(() => RpwPdfGeneratorService))
    private rpwPdfGenerator: RpwPdfGeneratorService,

    @Inject(SaleInvoice.name)
    private saleInvoiceModel: TenantModelProxy<typeof SaleInvoice>,

    @Inject(PdfTemplateModel.name)
    private pdfTemplateModel: TenantModelProxy<typeof PdfTemplateModel>,
  ) {}

  /**
   * Retrieve sale invoice html content.
   * @param {ISaleInvoice} saleInvoice -
   * @returns {Promise<string>}
   */
  public async getSaleInvoiceHtml(invoiceId: number): Promise<string> {
    const brandingAttributes =
      await this.getInvoiceBrandingAttributes(invoiceId);

    // ── RPW ── render the Rhodes Production Works layout when the document's
    // branding template is one of ours; anything else falls through to
    // upstream's stock template untouched.
    if (isRpwPdfTemplateName((brandingAttributes as any).templateName)) {
      return renderRpwInvoicePaperTemplateHtml({ ...brandingAttributes });
    }
    return renderInvoicePaperTemplateHtml({
      ...brandingAttributes,
    });
  }

  /**
   * Retrieve sale invoice pdf content.
   * @param {ISaleInvoice} saleInvoice -
   * @returns {Promise<[Buffer, string]>}
   */
  public async getSaleInvoicePdf(invoiceId: number): Promise<[Buffer, string]> {
    const filename = await this.getInvoicePdfFilename(invoiceId);

    // ── RPW ── a layout Josh designed himself wins when one is active. It
    // returns null on any failure — an edited design must never be able to
    // stop an invoice being produced, so we fall through to the coded template.
    const brandingAttributes = await this.getInvoiceBrandingAttributes(invoiceId);
    const designedPdf = await this.rpwPdfGenerator.tryGenerate(
      'SaleInvoice',
      brandingAttributes,
    );
    if (designedPdf) {
      await this.eventPublisher.emitAsync(events.saleInvoice.onPdfViewed, {
        saleInvoiceId: invoiceId,
      });
      return [designedPdf, filename];
    }
    const htmlContent = await this.getSaleInvoiceHtml(invoiceId);

    // Converts the given html content to pdf document.
    const buffer = await this.chromiumlyTenancy.convertHtmlContent(htmlContent);
    const eventPayload = { saleInvoiceId: invoiceId };

    // Triggers the `onSaleInvoicePdfViewed` event.
    await this.eventPublisher.emitAsync(
      events.saleInvoice.onPdfViewed,
      eventPayload,
    );
    return [buffer, filename];
  }

  /**
   * Retrieves the filename pdf document of the given invoice.
   * @param {number} invoiceId
   * @returns {Promise<string>}
   */
  private async getInvoicePdfFilename(invoiceId: number): Promise<string> {
    const invoice = await this.saleInvoiceModel().query().findById(invoiceId);
    return `Invoice-${invoice.invoiceNo}`;
  }

  /**
   * Retrieves the branding attributes of the given sale invoice.
   * @param {number} invoiceId
   * @returns {Promise<InvoicePdfTemplateAttributes>}
   */
  public async getInvoiceBrandingAttributes(
    invoiceId: number,
  ): Promise<InvoicePdfTemplateAttributes> {
    const invoice = await this.getInvoiceService.getSaleInvoice(invoiceId);

    // Retrieve the invoice template id or get the default template id if not found.
    const templateId =
      invoice.pdfTemplateId ??
      (
        await this.pdfTemplateModel().query().findOne({
          resource: 'SaleInvoice',
          default: true,
        })
      )?.id;

    // Get the branding template attributes.
    const brandingTemplate =
      await this.invoiceBrandingTemplateService.getInvoicePdfTemplate(
        templateId,
      );

    // ── RPW ── read the template's name from the model rather than from the
    // branding service: its transformer only emits an allow-list of attributes
    // and drops `templateName`, which would silently fall back to the stock
    // layout.
    const templateRow = templateId
      ? await this.pdfTemplateModel().query().findById(templateId)
      : null;

    // Merge the branding template attributes with the invoice.
    return {
      ...brandingTemplate.attributes,
      ...transformInvoiceToPdfTemplate(invoice),
      templateName: templateRow?.templateName,
    } as InvoicePdfTemplateAttributes;
  }
}
