import { ApiError, apiRequest, apiResponse } from '../../lib/api';

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

export type RoadmapExportFormat = 'png' | 'markdown';

function attachmentFilename(disposition: string | null): string | undefined {
  const encoded = disposition?.match(/\bfilename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall back to the plain filename when the encoded value is malformed.
    }
  }
  return disposition?.match(/\bfilename="([^"]+)"/i)?.[1];
}

export async function exportRoadmap(
  id: number,
  format: RoadmapExportFormat,
  signal: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiResponse(`/roadmaps/${id}/export?format=${format}`, {
    authenticated: true,
    signal,
  });
  const expectedType = format === 'png' ? 'image/png' : 'text/markdown';
  const contentType = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== expectedType) {
    throw new ApiError(
      response.status,
      'INVALID_FILE_RESPONSE',
      'Máy chủ chưa trả về file cần tải.',
    );
  }

  const extension = format === 'png' ? 'png' : 'md';
  const filename =
    attachmentFilename(response.headers.get('Content-Disposition')) ?? `roadmap-${id}.${extension}`;
  return { blob: await response.blob(), filename };
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
