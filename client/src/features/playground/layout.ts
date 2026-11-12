import { Graph, layout } from '@dagrejs/dagre';
import type { Dimensions } from '@xyflow/react';
import type { CreateRoadmapRequest } from '../roadmap-editor/api';
import type { ParsedRoadmap } from './markdown';

const fallbackSize = { width: 240, height: 100 };

function layoutKey(id: string) {
  return `node:${id}`;
}

export function layoutRoadmap(
  roadmap: ParsedRoadmap,
  sizes: ReadonlyMap<string, Dimensions>,
): CreateRoadmapRequest {
  if (!roadmap.nodes.length) return { ...roadmap, nodes: [] };

  const graph = new Graph({ directed: true });
  graph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 80, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of roadmap.nodes) {
    graph.setNode(layoutKey(node.id), { ...(sizes.get(node.id) ?? fallbackSize) });
  }
  for (const edge of roadmap.edges) {
    graph.setEdge(layoutKey(edge.source), layoutKey(edge.target));
  }
  layout(graph);

  return {
    ...roadmap,
    nodes: roadmap.nodes.map((node) => {
      const { x, y, width, height } = graph.node(layoutKey(node.id));
      const position = { x: x - width / 2, y: y - height / 2 };
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        throw new Error('Dagre returned an invalid node position.');
      }
      return { ...node, position };
    }),
  };
}
