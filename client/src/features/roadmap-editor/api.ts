import { apiRequest } from '../../lib/api';

export interface RoadmapNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
}

export interface RoadmapNodePayload {
  id: string;
  type: 'default';
  position: {
    x: number;
    y: number;
  };
  data: RoadmapNodeData;
}

export interface RoadmapEdgePayload {
  id: string;
  source: string;
  target: string;
  type?: 'smoothstep' | 'default';
  animated?: boolean;
}

export interface RoadmapDetail {
  id: number;
  userId: number;
  title: string;
  nodes: RoadmapNodePayload[];
  edges: RoadmapEdgePayload[];
  isPublic: boolean;
  shareCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoadmapRequest {
  title: string;
  nodes: RoadmapNodePayload[];
  edges: RoadmapEdgePayload[];
}

export interface UpdateRoadmapRequest {
  title?: string;
  nodes?: RoadmapNodePayload[];
  edges?: RoadmapEdgePayload[];
}

export async function getRoadmapById(id: number, signal?: AbortSignal): Promise<RoadmapDetail> {
  const response = await apiRequest<{ data: { roadmap: RoadmapDetail } }>(`/roadmaps/${id}`, {
    authenticated: true,
    ...(signal ? { signal } : {}),
  });
  return response.data.roadmap;
}

export async function createRoadmap(payload: CreateRoadmapRequest): Promise<RoadmapDetail> {
  const response = await apiRequest<{ data: { roadmap: RoadmapDetail } }>('/roadmaps', {
    method: 'POST',
    authenticated: true,
    body: JSON.stringify(payload),
  });
  return response.data.roadmap;
}

export async function updateRoadmap(
  id: number,
  payload: UpdateRoadmapRequest,
): Promise<RoadmapDetail> {
  const response = await apiRequest<{ data: { roadmap: RoadmapDetail } }>(`/roadmaps/${id}`, {
    method: 'PUT',
    authenticated: true,
    body: JSON.stringify(payload),
  });
  return response.data.roadmap;
}
