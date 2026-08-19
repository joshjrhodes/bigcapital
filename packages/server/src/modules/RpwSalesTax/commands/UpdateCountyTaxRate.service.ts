import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RpwCountyTaxRate } from '../models/RpwCountyTaxRate.model';
import { UpdateCountyTaxRateDto } from '../dtos/RpwSalesTax.dto';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class UpdateCountyTaxRateService {
  constructor(
    @Inject(RpwCountyTaxRate.name)
    private readonly countyTaxRateModel: TenantModelProxy<typeof RpwCountyTaxRate>,
  ) {}

  /**
   * Updates one county's rate, activation or verification state.
   *
   * Changing the rate clears the verification: a new number is a new claim,
   * and it has to be checked against tax.ohio.gov before it can be charged.
   */
  public async updateCounty(
    countyId: number,
    dto: UpdateCountyTaxRateDto,
    verifiedBy?: string,
  ): Promise<RpwCountyTaxRate> {
    const county = await this.countyTaxRateModel().query().findById(countyId);

    if (!county) {
      throw new NotFoundException('The given county could not be found.');
    }
    const changes: Record<string, any> = {};

    if (dto.combinedRate !== undefined && dto.combinedRate !== county.combinedRate) {
      changes.combinedRate = dto.combinedRate;
      changes.countyRate = Number(
        (dto.combinedRate - Number(county.stateRate)).toFixed(4),
      );
      changes.verifiedAt = null;
      changes.verifiedBy = null;
    }
    if (dto.isActive !== undefined) {
      changes.isActive = dto.isActive;
    }
    if (dto.sourceUrl !== undefined) {
      changes.sourceUrl = dto.sourceUrl;
    }
    if (dto.verified !== undefined) {
      changes.verifiedAt = dto.verified ? new Date() : null;
      changes.verifiedBy = dto.verified ? verifiedBy ?? 'unknown' : null;
    }
    return this.countyTaxRateModel().query().patchAndFetchById(countyId, changes);
  }
}
