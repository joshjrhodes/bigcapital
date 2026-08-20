import { Inject, Injectable } from '@nestjs/common';
import { ProfitLossSheetService } from '@/modules/FinancialStatements/modules/ProfitLossSheet/ProfitLossSheetService';
import { ProfitLossAggregateNodeId } from '@/modules/FinancialStatements/modules/ProfitLossSheet/ProfitLossSheet.types';
import { Account } from '@/modules/Accounts/models/Account.model';
import { AccountTransaction } from '@/modules/Accounts/models/AccountTransaction.model';
import { SettingsStore } from '@/modules/Settings/SettingsStore';
import { SETTINGS_PROVIDER } from '@/modules/Settings/Settings.types';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

const SETTINGS_GROUP = 'rpw_finance';
const RESERVE_RATE_KEY = 'tax_reserve_rate';
const RESERVE_ACCOUNT_KEY = 'tax_reserve_account_id';

/** The discipline Josh already practises: 25% of net profit, not gross. */
const DEFAULT_RESERVE_RATE = 25;

export interface TaxReserveState {
  year: number;
  asOf: string;
  basis: 'cash';
  reserveRatePercent: number;
  ytdNetProfit: number;
  reserveTarget: number;
  reserveFunded: number;
  suggestedTransfer: number;
  reserveAccountId: number | null;
  reserveAccountName: string | null;
  caveats: string[];
}

/**
 * Reserve target vs funded.
 *
 * The target is computed from the same cash-basis P&L the reports screen shows
 * — not re-derived ledger math — so a Section 179 purchase that lowers profit
 * lowers the target automatically, which is exactly the "pull back the reserve"
 * behaviour the brief asks for.
 *
 * Funded is the balance of the tax-reserve savings account: what has actually
 * been moved, not what was intended.
 */
@Injectable()
export class TaxReserveService {
  constructor(
    private readonly profitLossSheet: ProfitLossSheetService,
    @Inject(SETTINGS_PROVIDER)
    private readonly settingsStore: () => SettingsStore,
    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,
    @Inject(AccountTransaction.name)
    private readonly accountTransactionModel: TenantModelProxy<
      typeof AccountTransaction
    >,
  ) {}

  public async getState(asOf?: string): Promise<TaxReserveState> {
    const today = asOf || new Date().toISOString().slice(0, 10);
    const year = Number(today.slice(0, 4));

    const [rate, reserveAccount] = await Promise.all([
      this.getReserveRate(),
      this.findReserveAccount(),
    ]);

    const netProfit = await this.getCashBasisNetProfit(`${year}-01-01`, today);
    const funded = reserveAccount
      ? await this.getAccountBalance(reserveAccount.id, today)
      : 0;

    const target = Math.max(0, (netProfit * rate) / 100);

    return {
      year,
      asOf: today,
      basis: 'cash',
      reserveRatePercent: rate,
      ytdNetProfit: netProfit,
      reserveTarget: round2(target),
      reserveFunded: round2(funded),
      suggestedTransfer: round2(Math.max(0, target - funded)),
      reserveAccountId: reserveAccount?.id ?? null,
      reserveAccountName: reserveAccount?.name ?? null,
      caveats: [
        'The reserve rate is a rule of thumb, not a tax computation — actual ' +
          'liability depends on the whole return. The CPA has the last word.',
        ...(reserveAccount
          ? []
          : [
              'No tax-reserve account was found, so "funded" reads as zero. ' +
                'Expected: the account named "Tax Reserve Savings" (code 1020).',
            ]),
      ],
    };
  }

  /**
   * YTD net profit from the same P&L the reports screen uses, on a cash basis
   * — Schedule C, cash-basis filer.
   */
  private async getCashBasisNetProfit(
    fromDate: string,
    toDate: string,
  ): Promise<number> {
    const sheet = await this.profitLossSheet.profitLossSheet({
      fromDate,
      toDate,
      basis: 'cash',
    } as any);

    const findNode = (nodes: any[]): any => {
      for (const node of nodes ?? []) {
        if (node?.id === ProfitLossAggregateNodeId.NET_INCOME) return node;
        const child = findNode(node?.children);
        if (child) return child;
      }
      return null;
    };
    const netIncome = findNode(sheet.data as any[]);

    return Number(netIncome?.total?.amount ?? 0);
  }

  /**
   * Balance of the reserve account as of a date: debits minus credits, since
   * it is an asset account.
   */
  private async getAccountBalance(accountId: number, asOf: string): Promise<number> {
    const row = (await this.accountTransactionModel()
      .query()
      .where('accountId', accountId)
      .where('date', '<=', asOf)
      .sum('debit as totalDebit')
      .sum('credit as totalCredit')
      .first()) as any;

    return Number(row?.totalDebit ?? 0) - Number(row?.totalCredit ?? 0);
  }

  private async findReserveAccount() {
    const store = await this.settingsStore();
    const configuredId = store.get({
      group: SETTINGS_GROUP,
      key: RESERVE_ACCOUNT_KEY,
    });

    if (configuredId) {
      const configured = await this.accountModel()
        .query()
        .findById(Number(configuredId));
      if (configured) return configured;
    }
    // Fall back to the account the provisioning script creates.
    return (
      (await this.accountModel().query().findOne({ code: '1020' })) ??
      (await this.accountModel()
        .query()
        .whereRaw('LOWER(name) LIKE ?', ['%tax reserve%'])
        .first())
    );
  }

  private async getReserveRate(): Promise<number> {
    const store = await this.settingsStore();
    const value = store.get({ group: SETTINGS_GROUP, key: RESERVE_RATE_KEY });
    const rate = Number(value);

    return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_RESERVE_RATE;
  }

  public async setReserveRate(ratePercent: number): Promise<void> {
    const store = await this.settingsStore();
    store.set({
      group: SETTINGS_GROUP,
      key: RESERVE_RATE_KEY,
      value: ratePercent,
    });
    await store.save();
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
