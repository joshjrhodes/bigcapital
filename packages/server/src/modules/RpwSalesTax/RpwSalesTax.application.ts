import { BadRequestException, Injectable } from '@nestjs/common';
import { GetCountyTaxRatesService } from './queries/GetCountyTaxRates.service';
import { GetCountySalesTaxSummaryService } from './queries/GetCountySalesTaxSummary.service';
import { GetDocumentsWithCountyService } from './queries/GetDocumentsWithCounty.service';
import { UpdateCountyTaxRateService } from './commands/UpdateCountyTaxRate.service';
import { SetTransactionCountyService } from './commands/SetTransactionCounty.service';
import { RpwSalesTaxSettingsService } from './RpwSalesTaxSettings.service';
import {
  SetTransactionCountyDto,
  UpdateCountyTaxRateDto,
  UpdateSalesTaxSettingsDto,
} from './dtos/RpwSalesTax.dto';

@Injectable()
export class RpwSalesTaxApplication {
  constructor(
    private readonly getCountyTaxRatesService: GetCountyTaxRatesService,
    private readonly getCountySummaryService: GetCountySalesTaxSummaryService,
    private readonly getDocumentsService: GetDocumentsWithCountyService,
    private readonly updateCountyTaxRateService: UpdateCountyTaxRateService,
    private readonly setTransactionCountyService: SetTransactionCountyService,
    private readonly settingsService: RpwSalesTaxSettingsService,
  ) {}

  public getCounties(activeOnly = false) {
    return this.getCountyTaxRatesService.getCounties(activeOnly);
  }

  public updateCounty(
    countyId: number,
    dto: UpdateCountyTaxRateDto,
    verifiedBy?: string,
  ) {
    return this.updateCountyTaxRateService.updateCounty(countyId, dto, verifiedBy);
  }

  public setTransactionCounty(dto: SetTransactionCountyDto) {
    return this.setTransactionCountyService.setCounty(dto);
  }

  public getTransactionCounty(transactionType: string, transactionId: number) {
    return this.setTransactionCountyService.getCounty(transactionType, transactionId);
  }

  public async getSettings() {
    const [collectionEnabled, defaultCountyId] = await Promise.all([
      this.settingsService.isCollectionEnabled(),
      this.settingsService.getDefaultCountyId(),
    ]);
    return { collectionEnabled, defaultCountyId };
  }

  /**
   * Updates the sales tax switches.
   *
   * Turning collection on is guarded: every county in the picker must have a
   * rate that a human has checked against tax.ohio.gov. Charging a client the
   * wrong rate is the expensive kind of mistake, and an unchecked rate copied
   * from a quarterly table is exactly how that happens.
   */
  public async updateSettings(dto: UpdateSalesTaxSettingsDto) {
    if (dto.collectionEnabled === true) {
      const counties = await this.getCountyTaxRatesService.getCounties(true);
      const unverified = counties.filter((county) => !county.verifiedAt);

      if (counties.length === 0) {
        throw new BadRequestException(
          'No counties are active, so there is nothing to collect against.',
        );
      }
      if (unverified.length > 0) {
        throw new BadRequestException(
          'Sales tax collection cannot be switched on while these counties ' +
            'have unverified rates: ' +
            unverified.map((county) => county.countyName).join(', ') +
            '. Check each rate against tax.ohio.gov and mark it verified first.',
        );
      }
    }
    if (dto.collectionEnabled !== undefined) {
      await this.settingsService.setCollectionEnabled(dto.collectionEnabled);
    }
    if (dto.defaultCountyId !== undefined) {
      const county = await this.getCountyTaxRatesService.getCounty(dto.defaultCountyId);

      if (!county) {
        throw new BadRequestException('The given default county does not exist.');
      }
      await this.settingsService.setDefaultCountyId(dto.defaultCountyId);
    }
    return this.getSettings();
  }

  public getDocuments(fromDate: string, toDate: string) {
    return this.getDocumentsService.getDocuments(fromDate, toDate);
  }

  public async getCountySummary(fromDate: string, toDate: string) {
    const collectionEnabled = await this.settingsService.isCollectionEnabled();
    const [summary, unassignedInvoices] = await Promise.all([
      this.getCountySummaryService.getSummary(fromDate, toDate, collectionEnabled),
      this.getCountySummaryService.getUnassignedInvoiceCount(fromDate, toDate),
    ]);
    return { ...summary, unassignedInvoices };
  }
}
