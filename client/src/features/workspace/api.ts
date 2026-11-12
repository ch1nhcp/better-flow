import { apiRequest } from '../../lib/api';

interface RoadmapPreviewNode {
  id: string;
  label: string;
}

interface RoadmapSummaryResponse {
  id: number;
  title: string;
  nodeCount: number;
  previewNodes: RoadmapPreviewNode[];
  isPublic: boolean;
  shareCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapItem {
  id: number;
  title: string;
  description: string | null;
  updatedAt: string;
  shared: boolean;
  shareCode: string | null;
  steps: string[];
}

export async function getRoadmaps(signal?: AbortSignal): Promise<RoadmapItem[]> {
  const response = await apiRequest<{ data: { roadmaps: RoadmapSummaryResponse[] } }>('/roadmaps', {
    authenticated: true,
    ...(signal ? { signal } : {}),
  });

  if (!Array.isArray(response?.data?.roadmaps)) {
    throw new Error('Dữ liệu danh sách roadmap không hợp lệ.');
  }

  return response.data.roadmaps.map((roadmap) => ({
    id: roadmap.id,
    title: roadmap.title,
    description: null,
    updatedAt: roadmap.updatedAt,
    shared: roadmap.isPublic,
    shareCode: roadmap.shareCode ?? null,
    steps: Array.isArray(roadmap.previewNodes)
      ? roadmap.previewNodes
          .map((node) => node.label)
          .filter((label): label is string => typeof label === 'string' && label.length > 0)
      : [],
  }));
}

export async function deleteRoadmap(id: number): Promise<void> {
  await apiRequest<{ data: { message: string } }>(`/roadmaps/${id}`, {
    method: 'DELETE',
    authenticated: true,
  });
}
