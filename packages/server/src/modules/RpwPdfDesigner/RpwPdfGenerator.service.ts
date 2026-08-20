import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpwPdfDesign } from './models/RpwPdfDesign.model';
import { RpwPdfDesignVersion } from './models/RpwPdfDesignVersion.model';
import { RpwPdfInputsService } from './RpwPdfInputs.service';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

/**
 * pdfme v6 ships as ES modules only, and this server compiles to CommonJS, so a
 * plain import becomes a require() and dies with ERR_REQUIRE_ESM at boot.
 * `new Function` hides the dynamic import from TypeScript's downlevelling, which
 * would otherwise rewrite it into that same require().
 *
 * Loaded once and cached: pdfme pulls in fontkit and pdf-lib, which is not work
 * to repeat per invoice.
 */
const importEsm = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<any>;

let pdfmeModules: Promise<{ generate: any; plugins: Record<string, any> }> | null =
  null;

function loadPdfme() {
  if (!pdfmeModules) {
    pdfmeModules = Promise.all([
      importEsm('@pdfme/generator'),
      importEsm('@pdfme/schemas'),
    ]).then(([generator, schemas]) => ({
      generate: generator.generate,
      // Registered explicitly: pdfme's default registry contains only `text`.
      plugins: {
        text: schemas.text,
        image: schemas.image,
        table: schemas.table,
        line: schemas.line,
        rectangle: schemas.rectangle,
        ellipse: schemas.ellipse,
        svg: schemas.svg,
      },
    }));
  }
  return pdfmeModules;
}

/**
 * Renders a document through a user-designed pdfme template.
 *
 * Every failure path returns null rather than throwing: a layout Josh edited by
 * hand must never be able to stop an invoice from being produced. The caller
 * treats null as "use the coded template", which is the Phase 1 design that has
 * always worked.
 */
@Injectable()
export class RpwPdfGeneratorService {
  private readonly logger = new Logger(RpwPdfGeneratorService.name);

  constructor(
    @Inject(RpwPdfDesign.name)
    private readonly designModel: TenantModelProxy<typeof RpwPdfDesign>,
    @Inject(RpwPdfDesignVersion.name)
    private readonly versionModel: TenantModelProxy<typeof RpwPdfDesignVersion>,
    private readonly inputsService: RpwPdfInputsService,
  ) {}

  /**
   * The design currently in use for a resource, or null if none is active.
   */
  public async getActiveDesign(resource: string) {
    return this.designModel()
      .query()
      .findOne({ resource, isActive: true })
      .withGraphFetched('activeVersion');
  }

  /**
   * Renders the document, or returns null if there is nothing to render with
   * or the render failed.
   */
  public async tryGenerate(
    resource: string,
    attributes: Record<string, any>,
  ): Promise<Buffer | null> {
    try {
      const design = await this.getActiveDesign(resource);
      const version = (design as any)?.activeVersion as RpwPdfDesignVersion | undefined;

      if (!design || !version) return null;

      const template = version.parsedTemplate?.()
        ?? this.parse(version.templateJson);

      if (!template) {
        this.logger.warn(
          `Design ${design.id} (${resource}) holds unreadable template JSON — using the coded template instead.`,
        );
        return null;
      }
      return await this.generateFromTemplate(template, attributes);
    } catch (error) {
      // Deliberately swallowed: the caller falls back to the coded template.
      this.logger.warn(
        `Designed ${resource} PDF failed to render (${(error as Error)?.message}) — using the coded template instead.`,
      );
      return null;
    }
  }

  /**
   * Renders an explicit template — used by the designer's preview, where a
   * failure should be reported rather than hidden.
   */
  public async generateFromTemplate(
    template: Record<string, any>,
    attributes: Record<string, any>,
  ): Promise<Buffer> {
    const { generate, plugins } = await loadPdfme();
    const inputs = this.inputsService.buildInputs(attributes);
    const pdf = await generate({
      template: template as any,
      inputs: [inputs],
      plugins: plugins as any,
    });
    return Buffer.from(pdf);
  }

  private parse(json: string): Record<string, any> | null {
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}
