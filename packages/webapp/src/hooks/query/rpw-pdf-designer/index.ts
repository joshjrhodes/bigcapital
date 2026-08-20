import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequestQuery } from '../../useQueryRequest';
import useApiRequest from '../../useRequest';

export const RPW_PDF_DESIGNS = 'RPW_PDF_DESIGNS';
export const RPW_PDF_DESIGN = 'RPW_PDF_DESIGN';
export const RPW_PDF_DESIGN_VERSIONS = 'RPW_PDF_DESIGN_VERSIONS';

export interface RpwDesignVersion {
  id: number;
  version: number;
  note: string | null;
  created_at: string;
  template_json?: string;
}

export interface RpwDesign {
  id: number;
  resource: string;
  name: string;
  is_active: boolean | number;
  active_version_id: number | null;
  active_version?: RpwDesignVersion;
}

export function useRpwDesigns(resource?: string, props?: Record<string, any>) {
  return useRequestQuery<RpwDesign[]>(
    [RPW_PDF_DESIGNS, resource],
    {
      method: 'get',
      url: 'rpw/pdf-designer/designs',
      params: resource ? { resource } : {},
    },
    { select: (res: { data: RpwDesign[] }) => res.data, defaultData: [], ...props },
  );
}

export function useRpwDesign(designId?: number, props?: Record<string, any>) {
  return useRequestQuery<RpwDesign>(
    [RPW_PDF_DESIGN, designId],
    { method: 'get', url: `rpw/pdf-designer/designs/${designId}` },
    {
      select: (res: { data: RpwDesign }) => res.data,
      enabled: Boolean(designId),
      ...props,
    },
  );
}

export function useRpwDesignVersions(designId?: number, props?: Record<string, any>) {
  return useRequestQuery<RpwDesignVersion[]>(
    [RPW_PDF_DESIGN_VERSIONS, designId],
    { method: 'get', url: `rpw/pdf-designer/designs/${designId}/versions` },
    {
      select: (res: { data: RpwDesignVersion[] }) => res.data,
      defaultData: [],
      enabled: Boolean(designId),
      ...props,
    },
  );
}

const invalidate = (queryClient: any) => {
  queryClient.invalidateQueries({ queryKey: [RPW_PDF_DESIGNS] });
  queryClient.invalidateQueries({ queryKey: [RPW_PDF_DESIGN] });
  queryClient.invalidateQueries({ queryKey: [RPW_PDF_DESIGN_VERSIONS] });
};

export function useEnsureRpwStockDesigns() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();

  return useMutation({
    mutationFn: () => apiRequest.post('rpw/pdf-designer/designs/ensure-stock', {}),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useSaveRpwDesign() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();

  return useMutation({
    mutationFn: ([id, values]: [number, { template: any; note?: string }]) =>
      apiRequest.put(`rpw/pdf-designer/designs/${id}`, values),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useActivateRpwDesign() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();

  return useMutation({
    mutationFn: ([id, active]: [number, boolean]) =>
      apiRequest.put(
        `rpw/pdf-designer/designs/${id}/${active ? 'activate' : 'deactivate'}`,
        {},
      ),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useRestoreRpwDesignVersion() {
  const queryClient = useQueryClient();
  const apiRequest = useApiRequest();

  return useMutation({
    mutationFn: ([id, versionId]: [number, number]) =>
      apiRequest.post(
        `rpw/pdf-designer/designs/${id}/versions/${versionId}/restore`,
        {},
      ),
    onSuccess: () => invalidate(queryClient),
  });
}

/**
 * Renders a preview and hands back an object URL for an <iframe>. Kept out of
 * React Query on purpose: it returns a binary blob, not cacheable state.
 */
export function useRpwDesignPreview() {
  const apiRequest = useApiRequest();

  return async (payload: {
    template?: any;
    resource?: string;
    documentId?: number;
  }): Promise<string> => {
    const response = await apiRequest.http({
      method: 'post',
      url: '/api/rpw/pdf-designer/preview',
      data: payload,
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data as Blob);
  };
}
