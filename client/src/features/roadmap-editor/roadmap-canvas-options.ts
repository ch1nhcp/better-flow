import { MarkerType } from '@xyflow/react';
import type { DefaultEdgeOptions } from '@xyflow/react';

export const roadmapEdgeOptions: DefaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--color-tertiary)' },
};

export const roadmapFitOptions = { padding: 0.2, maxZoom: 1 };
