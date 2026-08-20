import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GetSaleEstimate } from './GetSaleEstimate.service';
import { transformEstimateToPdfTemplate } from '../utils';
import { EstimatePdfBrandingAttributes } from '../constants';
import { SaleEstimatePdfTemplate } from '@/modules/SaleInvoices/queries/SaleEstimatePdfTemplate.service';
import { ChromiumlyTenancy } from '@/modules/ChromiumlyTenancy/ChromiumlyTenancy.service';
import { PdfTemplateModel } from '@/modules/PdfTemplate/models/PdfTemplate';
import { events } from '@/common/events/events';
import { SaleEstimate } from '../models/SaleEstimate';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import {
  renderEstimatePaperTemplateHtml,
  renderRpwEstimatePaperTemplateHtml,
} from '@bigcapital/pdf-templates';
import { isRpwPdfTemplateName } from '@/modules/RpwBranding/RpwPdfTemplate.utils';
import { RpwPdfGeneratorService } from '@/modules/RpwPdfDesigner/RpwPdfGenerator.service';

@Injectable()
export class GetSaleEstimatePdf {
  constructor(
    private readonly chromiumlyTenancy: ChromiumlyTenancy,
    private readonly getSaleEstimate: GetSaleEstimate,
    private readonly estimatePdfTemplate: SaleEstimatePdfTemplate,
    private readonly eventPublisher: EventEmitter2,

    // ── RPW ── the visual designer, when a layout is active for estimates.
    @Inject(forwardRef(() => RpwPdfGeneratorService))
    private readonly rpwPdfGenerator: RpwPdfGeneratorService,

    @Inject(PdfTemplateModel.name)
    private readonly pdfTemplateModel: TenantModelProxy<
      typeof PdfTemplateModel
    >,

    @Inject(SaleEstimate.name)
    private readonly saleEstimateModel: TenantModelProxy<typeof SaleEstimate>,
  ) {}

  /**
   * Retrieve sale estimate html content.
   * @param {number} invoiceId -
   */
  public async saleEstimateHtml(estimateId: number): Promise<string> {
    const brandingAttributes =
      await this.getEstimateBrandingAttributes(estimateId);

    // ── RPW ── render the Rhodes Production Works layout when the document's
    // branding template is one of ours; anything else falls through to
    // upstream's stock template untouched.
    if (isRpwPdfTemplateName((brandingAttributes as any).templateName)) {
      return renderRpwEstimatePaperTemplateHtml({ ...brandingAttributes });
    }
    return renderEstimatePaperTemplateHtml({ ...brandingAttributes });
  }

  /**
   * Retrieve sale invoice pdf content.
   * @param {ISaleInvoice} saleInvoice - Sale estimate id.
   */
  public async getSaleEstimatePdf(
    saleEstimateId: number,
  ): Promise<[Buffer, string]> {
    const filename = await this.getSaleEstimateFilename(saleEstimateId);

    // ── RPW ── see SaleInvoicePdf: a designed layout takes precedence, and a
    // failure there falls through to the coded template rather than surfacing.
    const brandingAttributes =
      await this.getEstimateBrandingAttributes(saleEstimateId);
    const designedPdf = await this.rpwPdfGenerator.tryGenerate(
      'SaleEstimate',
      brandingAttributes,
    );
    if (designedPdf) {
      await this.eventPublisher.emitAsync(events.saleEstimate.onPdfViewed, {
        saleEstimateId,
      });
      return [designedPdf, filename];
    }

    // Retrieves the sale estimate html.
    const htmlContent = await this.saleEstimateHtml(saleEstimateId);
    const buffer = await this.chromiumlyTenancy.convertHtmlContent(htmlContent);

    const eventPayload = { saleEstimateId };

    // Triggers the `onSaleEstimatePdfViewed` event.
    await this.eventPublisher.emitAsync(
      events.saleEstimate.onPdfViewed,
      eventPayload,
    );
    return [buffer, filename];
  }

  /**
   * Retrieves the filename file document of the given estimate.
   * @param {number} estimateId - Estimate id.
   * @returns {Promise<string>}
   */
  private async getSaleEstimateFilename(estimateId: number) {
    const estimate = await this.saleEstimateModel()
      .query()
      .findById(estimateId);

    return `Estimate-${estimate.estimateNumber}`;
  }

  /**
   * Retrieves the given estimate branding attributes.
   * @param {number} estimateId - Estimate id.
   * @returns {Promise<EstimatePdfBrandingAttributes>}
   */
  async getEstimateBrandingAttributes(
    estimateId: number,
  ): Promise<EstimatePdfBrandingAttributes> {
    const saleEstimate = await this.getSaleEstimate.getEstimate(estimateId);
    // Retrieve the invoice template id of not found get the default template id.
    const templateId =
      saleEstimate.pdfTemplateId ??
      (
        await this.pdfTemplateModel().query().findOne({
          resource: 'SaleEstimate',
          default: true,
        })
      )?.id;
    const brandingTemplate =
      await this.estimatePdfTemplate.getEstimatePdfTemplate(templateId);
    // ── RPW ── read the template's name from the model rather than from the
    // branding service: its transformer only emits an allow-list of attributes
    // and drops `templateName`, which would silently fall back to the stock
    // layout.
    const templateRow = templateId
      ? await this.pdfTemplateModel().query().findById(templateId)
      : null;

    return {
      ...brandingTemplate.attributes,
      ...transformEstimateToPdfTemplate(saleEstimate),
      templateName: templateRow?.templateName,
    } as EstimatePdfBrandingAttributes;
  }
}
