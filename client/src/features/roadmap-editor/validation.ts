import type { CreateRoadmapRequest } from './api';

export const maxRoadmapTitleLength = 255;

export function validateRoadmapTitle(raw: string): string | null {
  if (/[\r\n]/.test(raw)) return 'Tên roadmap phải nằm trên một dòng.';
  const length = [...raw.trim()].length;
  if (length < 1) return 'Vui lòng nhập tên roadmap.';
  if (length > maxRoadmapTitleLength) return `Tên roadmap tối đa ${maxRoadmapTitleLength} ký tự.`;
  return null;
}

export function roadmapPayloadTooLarge(payload: CreateRoadmapRequest): boolean {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength > 1_048_576;
}
