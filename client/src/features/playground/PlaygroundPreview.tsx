import { useEffect, useMemo } from 'react';
import { Panel, ReactFlow, useNodesInitialized, useReactFlow } from '@xyflow/react';
import type { Dimensions, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  RoadmapCanvasBackground,
  RoadmapViewportControls,
} from '../roadmap-editor/RoadmapCanvasControls';
import { RoadmapStepNode } from '../roadmap-editor/RoadmapStepNode';
import type { RoadmapFlowNode } from '../roadmap-editor/RoadmapStepNode';
import type { CreateRoadmapRequest } from '../roadmap-editor/api';
import { roadmapEdgeOptions, roadmapFitOptions } from '../roadmap-editor/roadmap-canvas-options';

const nodeTypes = { default: RoadmapStepNode };

function ViewportTools({ nodes }: { nodes: RoadmapFlowNode[] }) {
  const initialized = useNodesInitialized();
  const { fitView, getViewport } = useReactFlow();

  useEffect(() => {
    if (!initialized) return;
    let active = true;
    const frame = requestAnimationFrame(() => {
      void fitView(roadmapFitOptions).then((fitted) => {
        if (active && fitted && nodes.length > 2 && getViewport().zoom < 0.6) {
          void fitView({ ...roadmapFitOptions, nodes: nodes.slice(0, 2) });
        }
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [fitView, getViewport, initialized, nodes]);

  return (
    <Panel position="bottom-left">
      <RoadmapViewportControls />
    </Panel>
  );
}

interface PlaygroundPreviewProps {
  roadmap: CreateRoadmapRequest | undefined;
  sizes: ReadonlyMap<string, Dimensions> | undefined;
  onNodesChange: (changes: NodeChange<RoadmapFlowNode>[]) => void;
  status: string;
}

export function PlaygroundPreview({
  roadmap,
  sizes,
  onNodesChange,
  status,
}: PlaygroundPreviewProps) {
  const nodes = useMemo(
    () =>
      (roadmap?.nodes ?? []).map((node) => ({
        ...node,
        measured: sizes?.get(node.id) ?? {},
      })),
    [roadmap?.nodes, sizes],
  );

  return (
    <section className="playground-panel" aria-labelledby="playground-preview-label">
      <div className="playground-panel-bar">
        <h2 id="playground-preview-label">Xem trước sơ đồ</h2>
        <span className="playground-layout-label">Tự sắp xếp: Từ trên xuống</span>
      </div>
      {status && (
        <p className="playground-preview-status" role="status">
          {status}
        </p>
      )}
      <div className="playground-canvas roadmap-canvas">
        <ReactFlow
          aria-label="Sơ đồ roadmap"
          nodes={nodes}
          edges={roadmap?.edges ?? []}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={roadmapEdgeOptions}
          onNodesChange={onNodesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          minZoom={0.05}
          fitView
          fitViewOptions={roadmapFitOptions}
        >
          <RoadmapCanvasBackground />
          {nodes.length > 0 && <ViewportTools nodes={nodes} />}
        </ReactFlow>
        {!nodes.length && (
          <p className="playground-canvas-empty">Thêm node trong Markdown để xem sơ đồ.</p>
        )}
      </div>
    </section>
  );
}
