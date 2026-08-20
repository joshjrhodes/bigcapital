import { Module } from '@nestjs/common';
import { RpwFinanceController } from './RpwFinance.controller';
import { TaxReserveService } from './TaxReserve.service';
import { EquipmentPurchasesService } from './EquipmentPurchases.service';
import { TaxCalendarService } from './TaxCalendar.service';
import { RpwEquipmentPurchase } from './models/RpwEquipmentPurchase.model';
import { TenancyModule } from '../Tenancy/Tenancy.module';
import { RegisterTenancyModel } from '../Tenancy/TenancyModels/Tenancy.module';
import { SettingsModule } from '../Settings/Settings.module';
import { ProfitLossSheetModule } from '../FinancialStatements/modules/ProfitLossSheet/ProfitLossSheet.module';

/**
 * RPW finance extensions (Phase 5).
 *
 * The reserve target is derived from the P&L service the reports screen
 * already uses — no ledger math is re-implemented here.
 */
const models = [RegisterTenancyModel(RpwEquipmentPurchase)];

@Module({
  imports: [TenancyModule, SettingsModule, ProfitLossSheetModule, ...models],
  controllers: [RpwFinanceController],
  providers: [TaxReserveService, EquipmentPurchasesService, TaxCalendarService],
  exports: [TaxReserveService, ...models],
})
export class RpwFinanceModule {}
