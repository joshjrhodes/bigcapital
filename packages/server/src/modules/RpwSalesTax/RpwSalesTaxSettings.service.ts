import { Inject, Injectable } from '@nestjs/common';
import { SettingsStore } from '../Settings/SettingsStore';
import { SETTINGS_PROVIDER } from '../Settings/Settings.types';
import {
  RPW_SALES_TAX_SETTINGS,
  RPW_SETTINGS_GROUP,
} from './RpwSalesTax.constants';

/**
 * Reads and writes the RPW sales tax switches through the tenant settings
 * store, so no extra table is needed for two values.
 */
@Injectable()
export class RpwSalesTaxSettingsService {
  constructor(
    @Inject(SETTINGS_PROVIDER)
    private readonly settingsStore: () => SettingsStore,
  ) {}

  /**
   * Whether sales tax collection is switched on. Off until the Ohio vendor's
   * licence is approved.
   */
  public isCollectionEnabled = async (): Promise<boolean> => {
    const store = await this.settingsStore();

    return Boolean(
      store.get({
        group: RPW_SETTINGS_GROUP,
        key: RPW_SALES_TAX_SETTINGS.COLLECTION_ENABLED,
      }),
    );
  };

  /**
   * The county pre-selected on new documents, if one has been chosen.
   */
  public getDefaultCountyId = async (): Promise<number | null> => {
    const store = await this.settingsStore();
    const value = store.get({
      group: RPW_SETTINGS_GROUP,
      key: RPW_SALES_TAX_SETTINGS.DEFAULT_COUNTY_ID,
    });
    return value ? Number(value) : null;
  };

  public setCollectionEnabled = async (enabled: boolean): Promise<void> => {
    const store = await this.settingsStore();

    store.set({
      group: RPW_SETTINGS_GROUP,
      key: RPW_SALES_TAX_SETTINGS.COLLECTION_ENABLED,
      value: enabled,
    });
    await store.save();
  };

  public setDefaultCountyId = async (countyId: number): Promise<void> => {
    const store = await this.settingsStore();

    store.set({
      group: RPW_SETTINGS_GROUP,
      key: RPW_SALES_TAX_SETTINGS.DEFAULT_COUNTY_ID,
      value: countyId,
    });
    await store.save();
  };
}
