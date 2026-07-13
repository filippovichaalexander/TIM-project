import type {
  ApiResponse, Branch, BuildingElement, Commit, Family, MergePreview, MergeRequest, Project,
} from '@tim/shared';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const json: ApiResponse<T> = await res.json();
  return json.data;
}

export const api = {
  getProjects: () => request<Project[]>('/api/projects'),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  getElements: (projectId: string, branchId?: string) =>
    request<BuildingElement[]>(`/api/projects/${projectId}/elements${branchId ? `?branchId=${branchId}` : ''}`),

  getBranches: (projectId: string) => request<Branch[]>(`/api/branches/project/${projectId}`),
  createBranch: (data: { projectId: string; name: string; authorId: string; parentBranchId?: string }) =>
    request<Branch>('/api/branches', { method: 'POST', body: JSON.stringify(data) }),
  commitBranch: (branchId: string, data: { message: string; authorId: string }) =>
    request<Commit>(`/api/branches/${branchId}/commit`, { method: 'POST', body: JSON.stringify(data) }),

  getMergeRequests: (projectId: string) => request<MergeRequest[]>(`/api/merge/project/${projectId}`),
  previewMerge: (sourceBranchId: string, targetBranchId: string) =>
    request<MergePreview>('/api/merge/preview', {
      method: 'POST',
      body: JSON.stringify({ sourceBranchId, targetBranchId }),
    }),
  createMergeRequest: (data: { projectId: string; sourceBranchId: string; targetBranchId: string; authorId: string; message?: string }) =>
    request<MergeRequest>('/api/merge', { method: 'POST', body: JSON.stringify(data) }),
  approveMerge: (id: string, reviewerId: string) =>
    request<MergeRequest>(`/api/merge/${id}/approve`, { method: 'POST', body: JSON.stringify({ reviewerId }) }),
  rejectMerge: (id: string, reviewerId: string) =>
    request<MergeRequest>(`/api/merge/${id}/reject`, { method: 'POST', body: JSON.stringify({ reviewerId }) }),

  getFamilies: () => request<Family[]>('/api/families'),
  getFamilyLibrary: () => request<Family[]>('/api/families/library'),
  uploadFamily: (data: { name: string; category: string; parameters?: unknown[] }) =>
    request<Family>('/api/families/upload', { method: 'POST', body: JSON.stringify(data) }),
};
