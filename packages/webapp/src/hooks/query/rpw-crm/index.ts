import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequestQuery } from '../../useQueryRequest';
import useApiRequest from '../../useRequest';

export const RPW_CRM_CUSTOMERS = 'RPW_CRM_CUSTOMERS';
export const RPW_CRM_TIMELINE = 'RPW_CRM_TIMELINE';
export const RPW_CRM_FOLLOW_UPS = 'RPW_CRM_FOLLOW_UPS';

export interface RpwCrmCustomer {
  id: number;
  displayName: string;
  email: string | null;
  workPhone: string | null;
  referralSource: string | null;
}

export interface RpwTimelineEntry {
  kind: 'note' | 'event';
  id: number;
  at: string;
  summary: string;
  body?: string;
  event_type?: string;
}

export function useRpwCrmCustomers(props?: Record<string, any>) {
  return useRequestQuery<RpwCrmCustomer[]>(
    [RPW_CRM_CUSTOMERS],
    { method: 'get', url: 'rpw/crm/customers' },
    { select: (res: any) => res.data, defaultData: [], ...props },
  );
}

export function useRpwCrmTimeline(contactId?: number, props?: Record<string, any>) {
  return useRequestQuery<RpwTimelineEntry[]>(
    [RPW_CRM_TIMELINE, contactId],
    { method: 'get', url: `rpw/crm/customers/${contactId}/timeline` },
    {
      select: (res: any) => res.data,
      defaultData: [],
      enabled: Boolean(contactId),
      ...props,
    },
  );
}

export function useRpwFollowUps(today: string, props?: Record<string, any>) {
  return useRequestQuery<any>(
    [RPW_CRM_FOLLOW_UPS, today],
    { method: 'get', url: 'rpw/crm/follow-ups', params: { today } },
    {
      select: (res: any) => res.data,
      defaultData: { due: [], upcoming: [] },
      ...props,
    },
  );
}

const invalidate = (queryClient: any) => {
  queryClient.invalidateQueries({ queryKey: [RPW_CRM_FOLLOW_UPS] });
  queryClient.invalidateQueries({ queryKey: [RPW_CRM_TIMELINE] });
  queryClient.invalidateQueries({ queryKey: [RPW_CRM_CUSTOMERS] });
};

export function useAddRpwNote() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();
  return useMutation({
    mutationFn: ([contactId, body]: [number, string]) =>
      apiRequest.post(`rpw/crm/customers/${contactId}/notes`, { body }),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSetRpwReferralSource() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();
  return useMutation({
    mutationFn: ([contactId, referralSource]: [number, string]) =>
      apiRequest.put(`rpw/crm/customers/${contactId}/referral-source`, {
        referralSource,
      }),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSetRpwTaxExemption() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();
  return useMutation({
    mutationFn: ([contactId, values]: [number, Record<string, any>]) =>
      apiRequest.put(`rpw/crm/customers/${contactId}/tax-exemption`, values),
    onSuccess: () => invalidate(queryClient),
  });
}

/** Uploads an exemption certificate and resolves to its storage key. */
export function useUploadExemptionCertificate() {
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

export function useCreateRpwFollowUp() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();
  return useMutation({
    mutationFn: (values: Record<string, any>) =>
      apiRequest.post('rpw/crm/follow-ups', values),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useCompleteRpwFollowUp() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();
  return useMutation({
    mutationFn: (id: number) => apiRequest.put(`rpw/crm/follow-ups/${id}/done`, {}),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSnoozeRpwFollowUp() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();
  return useMutation({
    mutationFn: ([id, dueOn]: [number, string]) =>
      apiRequest.put(`rpw/crm/follow-ups/${id}/snooze`, { dueOn }),
    onSuccess: () => invalidate(queryClient),
  });
}
