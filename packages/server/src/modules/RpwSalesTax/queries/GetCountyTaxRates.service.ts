import { Inject, Injectable } from '@nestjs/common';
import { RpwCountyTaxRate } from '../models/RpwCountyTaxRate.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class GetCountyTaxRatesService {
  constructor(
    @Inject(RpwCountyTaxRate.name)
    private readonly countyTaxRateModel: TenantModelProxy<typeof RpwCountyTaxRate>,
  ) {}

  /**
   * Retrieves the county rate table.
   * @param {boolean} activeOnly - only the counties Josh actually works in.
   */
  public async getCounties(activeOnly = false): Promise<RpwCountyTaxRate[]> {
    const query = this.countyTaxRateModel().query().modify('sortedByName');

    if (activeOnly) {
      query.modify('active');
    }
    return query;
  }

  /**
   * Retrieves a single county.
   */
  public async getCounty(countyId: number): Promise<RpwCountyTaxRate | undefined> {
    return this.countyTaxRateModel().query().findById(countyId);
  }
}
