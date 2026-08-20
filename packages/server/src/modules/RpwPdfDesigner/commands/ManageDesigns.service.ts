import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RpwPdfDesign } from '../models/RpwPdfDesign.model';
import { RpwPdfDesignVersion } from '../models/RpwPdfDesignVersion.model';
import { buildRpwStockDesign } from '../RpwStockDesign';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

const RESOURCES = ['SaleInvoice', 'SaleEstimate'];

@Injectable()
export class ManageDesignsService {
  constructor(
    @Inject(RpwPdfDesign.name)
    private readonly designModel: TenantModelProxy<typeof RpwPdfDesign>,
    @Inject(RpwPdfDesignVersion.name)
    private readonly versionModel: TenantModelProxy<typeof RpwPdfDesignVersion>,
  ) {}

  private assertResource(resource: string) {
    if (!RESOURCES.includes(resource)) {
      throw new BadRequestException(
        `Unknown resource '${resource}'. Expected one of: ${RESOURCES.join(', ')}.`,
      );
    }
  }

  public async listDesigns(resource?: string) {
    const query = this.designModel().query().orderBy('id', 'asc');

    if (resource) {
      this.assertResource(resource);
      query.where('resource', resource);
    }
    return query.withGraphFetched('activeVersion');
  }

  public async getDesign(designId: number) {
    const design = await this.designModel()
      .query()
      .findById(designId)
      .withGraphFetched('activeVersion');

    if (!design) throw new NotFoundException('The given design could not be found.');

    return design;
  }

  public async listVersions(designId: number) {
    await this.getDesign(designId);

    return this.versionModel()
      .query()
      .where('designId', designId)
      .orderBy('version', 'desc')
      .select('id', 'designId', 'version', 'note', 'createdAt');
  }

  /**
   * Creates a design. With no template supplied it starts from the stock
   * layout, so the first thing Josh sees is the design he already approved
   * rather than an empty page.
   */
  public async createDesign(
    resource: string,
    name: string,
    template?: Record<string, any>,
  ) {
    this.assertResource(resource);

    const design = await this.designModel().query().insertAndFetch({
      resource,
      name,
      isActive: false,
    });
    const seeded = template ?? buildRpwStockDesign(resource as any);
    const version = await this.saveVersion(design.id, seeded, 'Initial version');

    return this.getDesign(version.designId);
  }

  /**
   * Writes a new version and points the design at it. Previous versions are
   * left untouched — that is the whole point of them.
   */
  public async saveVersion(
    designId: number,
    template: Record<string, any>,
    note?: string,
  ) {
    if (!template || typeof template !== 'object' || !('schemas' in template)) {
      throw new BadRequestException(
        'That does not look like a pdfme template — expected an object with a `schemas` array.',
      );
    }
    const latest = await this.versionModel()
      .query()
      .where('designId', designId)
      .orderBy('version', 'desc')
      .first();

    const version = await this.versionModel().query().insertAndFetch({
      designId,
      version: (latest?.version ?? 0) + 1,
      templateJson: JSON.stringify(template),
      note: note ?? null,
    });
    await this.designModel()
      .query()
      .patch({ activeVersionId: version.id })
      .where('id', designId);

    return version;
  }

  /**
   * Rolls a design back by repointing it at an older version. The rollback
   * itself is recorded as a new version, so history stays append-only.
   */
  public async restoreVersion(designId: number, versionId: number) {
    const version = await this.versionModel().query().findById(versionId);

    if (!version || version.designId !== designId) {
      throw new NotFoundException('That version does not belong to this design.');
    }
    const template = version.parsedTemplate();

    if (!template) {
      throw new BadRequestException('That version holds unreadable template JSON.');
    }
    return this.saveVersion(designId, template, `Restored from version ${version.version}`);
  }

  /**
   * Makes a design the one used for its resource, and stands every sibling
   * down — only one layout can be in force at a time.
   */
  public async activateDesign(designId: number) {
    const design = await this.getDesign(designId);

    if (!design.activeVersionId) {
      throw new BadRequestException('That design has no saved version to activate.');
    }
    await this.designModel()
      .query()
      .patch({ isActive: false })
      .where('resource', design.resource);

    await this.designModel().query().patch({ isActive: true }).where('id', designId);

    return this.getDesign(designId);
  }

  /**
   * Stands a design down, which returns the resource to the coded template.
   */
  public async deactivateDesign(designId: number) {
    await this.getDesign(designId);
    await this.designModel().query().patch({ isActive: false }).where('id', designId);

    return this.getDesign(designId);
  }

  /**
   * Ensures a stock design row exists per resource. Idempotent, so it can run
   * on every boot of the module without accumulating rows.
   */
  public async ensureStockDesigns() {
    for (const resource of RESOURCES) {
      const existing = await this.designModel().query().findOne({ resource });

      if (!existing) {
        await this.createDesign(resource, 'RPW Stock Layout');
      }
    }
  }
}
