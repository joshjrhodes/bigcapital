import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequestQuery } from '../../useQueryRequest';
import useApiRequest from '../../useRequest';

export const RPW_TAX_RESERVE = 'RPW_TAX_RESERVE';
export const RPW_TAX_CALENDAR = 'RPW_TAX_CALENDAR';
export const RPW_EQUIPMENT = 'RPW_EQUIPMENT';
export const RPW_EQUIPMENT_REPORT = 'RPW_EQUIPMENT_REPORT';

export function useRpwTaxReserve(props?: Record<string, any>) {
  return useRequestQuery<any>(
    [RPW_TAX_RESERVE],
    { method: 'get', url: 'rpw/finance/tax-reserve' },
    { select: (res: any) => res.data, defaultData: null, ...props },
  );
}

export function useRpwTaxCalendar(props?: Record<string, any>) {
  return useRequestQuery<any[]>(
    [RPW_TAX_CALENDAR],
    { method: 'get', url: 'rpw/finance/tax-calendar' },
    { select: (res: any) => res.data, defaultData: [], ...props },
  );
}

export function useRpwEquipmentReport(year: number, props?: Record<string, any>) {
  return useRequestQuery<any>(
    [RPW_EQUIPMENT_REPORT, year],
    { method: 'get', url: 'rpw/finance/equipment/report', params: { year } },
    { select: (res: any) => res.data, defaultData: null, ...props },
  );
}

const invalidate = (queryClient: any) => {
  queryClient.invalidateQueries({ queryKey: [RPW_EQUIPMENT] });
  queryClient.invalidateQueries({ queryKey: [RPW_EQUIPMENT_REPORT] });
  queryClient.invalidateQueries({ queryKey: [RPW_TAX_RESERVE] });
};

export function useCreateRpwEquipment() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();
  return useMutation({
    mutationFn: (values: Record<string, any>) =>
      apiRequest.post('rpw/finance/equipment', values),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteRpwEquipment() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();
  return useMutation({
    mutationFn: (id: number) => apiRequest.delete(`rpw/finance/equipment/${id}`),
    onSuccess: () => invalidate(queryClient),
  });
}

/** Uploads a bill of sale and resolves to its object-storage key. */
export function useUploadBillOfSale() {
  const apiRequest = useApiRequest();

  return async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const response = await apiRequest.post('attachments', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data?.key;
  };
}
