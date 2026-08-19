import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RpwTransactionCounty } from '../models/RpwTransactionCounty.model';
import { RpwCountyTaxRate } from '../models/RpwCountyTaxRate.model';
import { SetTransactionCountyDto } from '../dtos/RpwSalesTax.dto';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class SetTransactionCountyService {
  constructor(
    @Inject(RpwTransactionCounty.name)
    private readonly transactionCountyModel: TenantModelProxy<
      typeof RpwTransactionCounty
    >,
    @Inject(RpwCountyTaxRate.name)
    private readonly countyTaxRateModel: TenantModelProxy<typeof RpwCountyTaxRate>,
  ) {}

  /**
   * Records which county a job actually happened in, so the sale can be
   * reported to ODT under the right county later.
   */
  public async setCounty(dto: SetTransactionCountyDto) {
    const county = await this.countyTaxRateModel().query().findById(dto.countyId);

    if (!county) {
      throw new NotFoundException('The given county could not be found.');
    }
    const existing = await this.transactionCountyModel()
      .query()
      .findOne({
        transactionType: dto.transactionType,
        transactionId: dto.transactionId,
      });

    if (existing) {
      return this.transactionCountyModel()
        .query()
        .patchAndFetchById(existing.id, { countyId: dto.countyId });
    }
    return this.transactionCountyModel().query().insertAndFetch({
      transactionType: dto.transactionType,
      transactionId: dto.transactionId,
      countyId: dto.countyId,
    });
  }

  /**
   * Retrieves the county recorded against a document, if any.
   */
  public async getCounty(transactionType: string, transactionId: number) {
    return this.transactionCountyModel()
      .query()
      .findOne({ transactionType, transactionId })
      .withGraphFetched('county');
  }

  /**
   * Forgets the county of a deleted document, so the join table does not
   * accumulate rows pointing at things that no longer exist.
   */
  public async clearCounty(transactionType: string, transactionId: number) {
    return this.transactionCountyModel()
      .query()
      .where({ transactionType, transactionId })
      .delete();
  }
}
