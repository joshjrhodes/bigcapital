import { Module } from '@nestjs/common';
import { RpwSalesTaxController } from './RpwSalesTax.controller';
import { RpwSalesTaxApplication } from './RpwSalesTax.application';
import { RpwSalesTaxSettingsService } from './RpwSalesTaxSettings.service';
import { GetCountyTaxRatesService } from './queries/GetCountyTaxRates.service';
import { GetCountySalesTaxSummaryService } from './queries/GetCountySalesTaxSummary.service';
import { GetDocumentsWithCountyService } from './queries/GetDocumentsWithCounty.service';
import { UpdateCountyTaxRateService } from './commands/UpdateCountyTaxRate.service';
import { SetTransactionCountyService } from './commands/SetTransactionCounty.service';
import { RpwCountyTaxRate } from './models/RpwCountyTaxRate.model';
import { RpwTransactionCounty } from './models/RpwTransactionCounty.model';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { SettingsModule } from '../Settings/Settings.module';

/**
 * Ohio multi-county sales tax scaffolding for Rhodes Production Works.
 *
 * Additive by design: its own tables, its own routes, its own models. The only
 * upstream file it touches is App.module.ts, where it is imported.
 */
const models = [
  RegisterTenancyModel(RpwCountyTaxRate),
  RegisterTenancyModel(RpwTransactionCounty),
];

@Module({
  imports: [TenancyModule, SettingsModule, ...models],
  controllers: [RpwSalesTaxController],
  providers: [
    RpwSalesTaxApplication,
    RpwSalesTaxSettingsService,
    GetCountyTaxRatesService,
    GetCountySalesTaxSummaryService,
    GetDocumentsWithCountyService,
    UpdateCountyTaxRateService,
    SetTransactionCountyService,
  ],
  exports: [RpwSalesTaxApplication, RpwSalesTaxSettingsService, ...models],
})
export class RpwSalesTaxModule {}
