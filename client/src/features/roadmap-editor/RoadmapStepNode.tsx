import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import type { RoadmapNodeData } from './api';

export type RoadmapFlowNode = Node<RoadmapNodeData, 'default'>;

export function RoadmapStepNode({ data, selected }: NodeProps<RoadmapFlowNode>) {
  return (
    <div className={selected ? 'roadmap-step-node selected' : 'roadmap-step-node'}>
      <Handle type="target" position={Position.Top} className="roadmap-step-handle" />
      <div className="roadmap-step-node-body">
        <strong className="roadmap-step-node-label">{data.label}</strong>
        {data.description && <p className="roadmap-step-node-desc">{data.description}</p>}
      </div>
      <Handle type="source" position={Position.Bottom} className="roadmap-step-handle" />
    </div>
  );
}
