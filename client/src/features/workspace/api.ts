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
    steps: Array.isArray(roadmap.previewNodes)
      ? roadmap.previewNodes
          .map((node) => node.label)
          .filter((label): label is string => typeof label === 'string' && label.length > 0)
      : [],
  }));
}
