import { BaseModel } from '@/models/Model';

/**
 * One saved revision of a design. Immutable once written: saving again writes
 * the next version rather than editing this one, which is what makes rollback
 * trustworthy.
 */
export class RpwPdfDesignVersion extends BaseModel {
  public designId!: number;
  public version!: number;
  public templateJson!: string;
  public note?: string;

  static get tableName() {
    return 'rpw_pdf_design_versions';
  }

  get timestamps() {
    return ['createdAt'];
  }

  /**
   * The stored template as an object, or null if it is unreadable — a design
   * that cannot be parsed must fall back rather than throw mid-render.
   */
  public parsedTemplate(): Record<string, any> | null {
    try {
      return JSON.parse(this.templateJson);
    } catch {
      return null;
    }
  }
}
