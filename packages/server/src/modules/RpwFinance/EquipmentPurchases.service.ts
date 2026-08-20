import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RpwEquipmentPurchase } from './models/RpwEquipmentPurchase.model';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class EquipmentPurchasesService {
  constructor(
    @Inject(RpwEquipmentPurchase.name)
    private readonly purchaseModel: TenantModelProxy<typeof RpwEquipmentPurchase>,
  ) {}

  public list(year?: number) {
    const query = this.purchaseModel().query().orderBy('purchased_on', 'desc');

    if (year) {
      query
        .where('purchased_on', '>=', `${year}-01-01`)
        .where('purchased_on', '<=', `${year}-12-31`);
    }
    return query;
  }

  public create(values: Partial<RpwEquipmentPurchase>) {
    return this.purchaseModel().query().insertAndFetch(values);
  }

  public async update(id: number, values: Partial<RpwEquipmentPurchase>) {
    const updated = await this.purchaseModel().query().patchAndFetchById(id, values);

    if (!updated) throw new NotFoundException('The given purchase could not be found.');

    return updated;
  }

  public async remove(id: number) {
    const deleted = await this.purchaseModel().query().deleteById(id);

    if (!deleted) throw new NotFoundException('The given purchase could not be found.');
  }

  /**
   * The CPA-ready view: everything bought in a year, split by treatment, with
   * serials and whether a bill of sale is on file.
   */
  public async report(year: number) {
    const purchases = await this.list(year);

    const summarize = (tag: string) => {
      const rows = purchases.filter((purchase) => purchase.tag === tag);
      return {
        count: rows.length,
        total: rows.reduce((sum, row) => sum + Number(row.amount), 0),
        missingSerial: rows.filter((row) => !row.serialNumber).length,
        missingBillOfSale: rows.filter((row) => !row.attachmentKey).length,
      };
    };
    return {
      year,
      purchases,
      section179: summarize('section179'),
      cogs: summarize('cogs'),
      caveats: [
        'Section 179 vs COGS treatment here is a record of intent — the ' +
          'election itself happens on the return. Never bonus depreciation ' +
          '(Ohio addback).',
        'Used-equipment purchases need a bill of sale with serial numbers on ' +
          'file; rows missing either are counted above.',
      ],
    };
  }
}
