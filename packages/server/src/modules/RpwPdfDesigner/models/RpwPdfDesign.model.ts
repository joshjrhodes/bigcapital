import { BaseModel } from '@/models/Model';
import { RpwPdfDesignVersion } from './RpwPdfDesignVersion.model';

/**
 * A user-editable PDF layout. The template JSON itself lives on the versions,
 * so the design row is a stable identity that points at whichever version is
 * currently live.
 */
export class RpwPdfDesign extends BaseModel {
  public resource!: string;
  public name!: string;
  public isActive!: boolean;
  public activeVersionId?: number;

  static get tableName() {
    return 'rpw_pdf_designs';
  }

  get timestamps() {
    return ['createdAt', 'updatedAt'];
  }

  static get modifiers() {
    return {
      active(query) {
        query.where('is_active', true);
      },
      forResource(query, resource: string) {
        query.where('resource', resource);
      },
    };
  }

  static get relationMappings() {
    return {
      activeVersion: {
        relation: BaseModel.BelongsToOneRelation,
        modelClass: RpwPdfDesignVersion,
        join: {
          from: 'rpw_pdf_designs.activeVersionId',
          to: 'rpw_pdf_design_versions.id',
        },
      },
      versions: {
        relation: BaseModel.HasManyRelation,
        modelClass: RpwPdfDesignVersion,
        join: {
          from: 'rpw_pdf_designs.id',
          to: 'rpw_pdf_design_versions.designId',
        },
      },
    };
  }
}
