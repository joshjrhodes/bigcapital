import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequestQuery } from '../../useQueryRequest';
import useApiRequest from '../../useRequest';
import {
  RPW_SALES_TAX_COUNTIES,
  RPW_SALES_TAX_COUNTY_SUMMARY,
  RPW_SALES_TAX_DOCUMENTS,
  RPW_SALES_TAX_SETTINGS,
} from './query-keys';

export { RpwSalesTaxQueryKeys } from './query-keys';

/**
 * RPW Ohio multi-county sales tax.
 *
 * These endpoints are not in the generated SDK — they belong to our own module,
 * so they go through the plain request hooks instead.
 */
export interface RpwCounty {
  id: number;
  county_name: string;
  odt_code: number | null;
  combined_rate: number;
  county_rate: number;
  state_rate: number;
  source_url: string | null;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
  verified_at: string | null;
  verified_by: string | null;
}

export interface RpwSalesTaxSettings {
  collection_enabled?: boolean;
  collectionEnabled?: boolean;
  default_county_id?: number | null;
  defaultCountyId?: number | null;
}

export function useRpwCounties(activeOnly = false, props?: Record<string, any>) {
  return useRequestQuery<RpwCounty[]>(
    [RPW_SALES_TAX_COUNTIES, activeOnly],
    {
      method: 'get',
      url: 'rpw/sales-tax/counties',
      params: activeOnly ? { activeOnly: true } : {},
    },
    // useRequestQuery hands back the raw axios response; unwrap it here so
    // components deal in plain data (same convention as organization/queries).
    { select: (res: { data: RpwCounty[] }) => res.data, defaultData: [], ...props },
  );
}

export function useRpwSalesTaxSettings(props?: Record<string, any>) {
  return useRequestQuery<RpwSalesTaxSettings>(
    [RPW_SALES_TAX_SETTINGS],
    { method: 'get', url: 'rpw/sales-tax/settings' },
    { select: (res: { data: RpwSalesTaxSettings }) => res.data, defaultData: {}, ...props },
  );
}

export function useRpwCountySummary(
  fromDate: string,
  toDate: string,
  props?: Record<string, any>,
) {
  return useRequestQuery<any>(
    [RPW_SALES_TAX_COUNTY_SUMMARY, fromDate, toDate],
    {
      method: 'get',
      url: 'rpw/sales-tax/reports/county-summary',
      params: { fromDate, toDate },
    },
    {
      select: (res: { data: any }) => res.data,
      defaultData: { rows: [], totals: {}, caveats: [] },
      ...props,
    },
  );
}

export interface RpwDocument {
  transactionType: string;
  transactionId: number;
  documentNumber: string | null;
  documentDate: string | null;
  customerName: string | null;
  amount: number;
  countyId: number | null;
  countyName: string | null;
}

export function useRpwDocuments(
  fromDate: string,
  toDate: string,
  props?: Record<string, any>,
) {
  return useRequestQuery<RpwDocument[]>(
    [RPW_SALES_TAX_DOCUMENTS, fromDate, toDate],
    {
      method: 'get',
      url: 'rpw/sales-tax/documents',
      params: { fromDate, toDate },
    },
    { select: (res: { data: RpwDocument[] }) => res.data, defaultData: [], ...props },
  );
}

export function useUpdateRpwCounty(props?: Record<string, any>) {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();

  return useMutation({
    ...props,
    mutationFn: ([id, values]: [number, Record<string, any>]) =>
      apiRequest.put(`rpw/sales-tax/counties/${id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RPW_SALES_TAX_COUNTIES] });
      queryClient.invalidateQueries({ queryKey: [RPW_SALES_TAX_SETTINGS] });
    },
  });
}

export function useUpdateRpwSalesTaxSettings(props?: Record<string, any>) {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();

  return useMutation({
    ...props,
    mutationFn: (values: Record<string, any>) =>
      apiRequest.put('rpw/sales-tax/settings', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RPW_SALES_TAX_SETTINGS] });
    },
  });
}

export function useSetRpwTransactionCounty(props?: Record<string, any>) {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();

  return useMutation({
    ...props,
    mutationFn: (values: {
      transactionType: string;
      transactionId: number;
      countyId: number;
    }) => apiRequest.post('rpw/sales-tax/transaction-county', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RPW_SALES_TAX_COUNTY_SUMMARY] });
      queryClient.invalidateQueries({ queryKey: [RPW_SALES_TAX_DOCUMENTS] });
    },
  });
}
