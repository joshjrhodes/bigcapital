import { Module, forwardRef } from '@nestjs/common';
import { RpwPdfDesignerController } from './RpwPdfDesigner.controller';
import { RpwPdfDesignerApplication } from './RpwPdfDesigner.application';
import { ManageDesignsService } from './commands/ManageDesigns.service';
import { RpwPdfGeneratorService } from './RpwPdfGenerator.service';
import { RpwPdfInputsService } from './RpwPdfInputs.service';
import { GetPreviewAttributesService } from './queries/GetPreviewAttributes.service';
import { RpwPdfDesign } from './models/RpwPdfDesign.model';
import { RpwPdfDesignVersion } from './models/RpwPdfDesignVersion.model';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { SaleInvoicesModule } from '../SaleInvoices/SaleInvoices.module';
import { SaleEstimatesModule } from '../SaleEstimates/SaleEstimates.module';

/**
 * Visual PDF designer (Phase 3).
 *
 * The generator service is exported so the invoice and estimate PDF services
 * can ask "is there a design for this?" without importing the whole module —
 * and so a failure there falls back to the coded template rather than
 * propagating.
 */
const models = [
  RegisterTenancyModel(RpwPdfDesign),
  RegisterTenancyModel(RpwPdfDesignVersion),
];

@Module({
  imports: [
    TenancyModule,
    // Circular by nature: the PDF services fall back into this module, and the
    // preview reaches back into them for real document data.
    forwardRef(() => SaleInvoicesModule),
    forwardRef(() => SaleEstimatesModule),
    ...models,
  ],
  controllers: [RpwPdfDesignerController],
  providers: [
    RpwPdfDesignerApplication,
    ManageDesignsService,
    RpwPdfGeneratorService,
    RpwPdfInputsService,
    GetPreviewAttributesService,
  ],
  exports: [RpwPdfGeneratorService, RpwPdfDesignerApplication, ...models],
})
export class RpwPdfDesignerModule {}
