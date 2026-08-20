import { Injectable } from '@nestjs/common';
import { ManageDesignsService } from './commands/ManageDesigns.service';
import { RpwPdfGeneratorService } from './RpwPdfGenerator.service';
import { GetPreviewAttributesService } from './queries/GetPreviewAttributes.service';
import { buildRpwStockDesign } from './RpwStockDesign';

@Injectable()
export class RpwPdfDesignerApplication {
  constructor(
    private readonly manageDesigns: ManageDesignsService,
    private readonly generator: RpwPdfGeneratorService,
    private readonly previewAttributes: GetPreviewAttributesService,
  ) {}

  public listDesigns(resource?: string) {
    return this.manageDesigns.listDesigns(resource);
  }

  public getDesign(designId: number) {
    return this.manageDesigns.getDesign(designId);
  }

  public listVersions(designId: number) {
    return this.manageDesigns.listVersions(designId);
  }

  public createDesign(resource: string, name: string, template?: Record<string, any>) {
    return this.manageDesigns.createDesign(resource, name, template);
  }

  public saveDesign(designId: number, template: Record<string, any>, note?: string) {
    return this.manageDesigns.saveVersion(designId, template, note);
  }

  public restoreVersion(designId: number, versionId: number) {
    return this.manageDesigns.restoreVersion(designId, versionId);
  }

  public activateDesign(designId: number) {
    return this.manageDesigns.activateDesign(designId);
  }

  public deactivateDesign(designId: number) {
    return this.manageDesigns.deactivateDesign(designId);
  }

  public ensureStockDesigns() {
    return this.manageDesigns.ensureStockDesigns();
  }

  /** The stock layout, for "start over from the approved design". */
  public getStockTemplate(resource: string) {
    return buildRpwStockDesign(resource as any);
  }

  /**
   * Renders a preview PDF. Unlike document generation this reports failures,
   * because the whole point is to find out whether the layout works.
   */
  public async preview(options: {
    designId?: number;
    template?: Record<string, any>;
    resource?: string;
    documentId?: number;
  }): Promise<Buffer> {
    let template = options.template;
    let resource = options.resource;

    if (!template && options.designId) {
      const design = await this.manageDesigns.getDesign(options.designId);
      resource = resource ?? design.resource;
      template = (design as any).activeVersion?.parsedTemplate?.() ?? undefined;
    }
    resource = resource ?? 'SaleInvoice';

    if (!template) {
      template = buildRpwStockDesign(resource as any);
    }
    const attributes = await this.previewAttributes.getAttributes(
      resource,
      options.documentId,
    );
    return this.generator.generateFromTemplate(template, attributes);
  }
}
