import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import type { Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Brand } from '../../app/Brand';
import { ApiError } from '../../lib/api';
import { getSharedRoadmap } from '../roadmap-editor/api';
import type { RoadmapEdgePayload, RoadmapNodePayload } from '../roadmap-editor/api';
import {
  RoadmapCanvasBackground,
  RoadmapViewportControls,
} from '../roadmap-editor/RoadmapCanvasControls';
import { RoadmapStepNode } from '../roadmap-editor/RoadmapStepNode';
import type { RoadmapFlowNode } from '../roadmap-editor/RoadmapStepNode';
import { roadmapEdgeOptions, roadmapFitOptions } from '../roadmap-editor/roadmap-canvas-options';
import './shared-roadmap.css';

const nodeTypes = { default: RoadmapStepNode };

function toFlowNodes(nodes: RoadmapNodePayload[]): RoadmapFlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: 'default',
    position: {
      x: Number.isFinite(node.position?.x) ? node.position.x : 0,
      y: Number.isFinite(node.position?.y) ? node.position.y : 0,
    },
    data: {
      label: node.data?.label ?? '',
      ...(node.data?.description ? { description: node.data.description } : {}),
    },
  }));
}

function toFlowEdges(edges: RoadmapEdgePayload[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type === 'default' ? 'default' : 'smoothstep',
    animated: Boolean(edge.animated),
  }));
}

export function SharedRoadmapPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const code = shareCode?.trim() ?? '';

  const shareQuery = useQuery({
    queryKey: ['public', 'share', code],
    queryFn: ({ signal }) => getSharedRoadmap(code, signal),
    enabled: code.length > 0,
    retry: false,
  });

  const nodes = useMemo(
    () => (shareQuery.data ? toFlowNodes(shareQuery.data.nodes) : []),
    [shareQuery.data],
  );
  const edges = useMemo(
    () => (shareQuery.data ? toFlowEdges(shareQuery.data.edges) : []),
    [shareQuery.data],
  );

  if (
    code.length === 0 ||
    (shareQuery.isError && shareQuery.error instanceof ApiError && shareQuery.error.status === 404)
  ) {
    return (
      <div className="shared-roadmap-page product-theme">
        <header className="shared-roadmap-header">
          <Brand />
        </header>
        <main className="shared-roadmap-state">
          <div className="shared-roadmap-state-card">
            <h1>Liên kết không khả dụng</h1>
            <p>Roadmap không tồn tại hoặc không được chia sẻ</p>
            <p className="shared-roadmap-subtext">
              Hãy kiểm tra lại liên kết hoặc liên hệ người đã gửi.
            </p>
            <div className="shared-roadmap-state-actions">
              <Link className="button" to="/">
                Về trang chủ
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (shareQuery.isPending) {
    return (
      <div className="shared-roadmap-page product-theme">
        <header className="shared-roadmap-header">
          <Brand />
        </header>
        <main className="shared-roadmap-state">
          <div className="shared-roadmap-state-card" role="status">
            <p>Đang tải roadmap được chia sẻ…</p>
          </div>
        </main>
      </div>
    );
  }

  if (shareQuery.isError || !shareQuery.data) {
    return (
      <div className="shared-roadmap-page product-theme">
        <header className="shared-roadmap-header">
          <Brand />
        </header>
        <main className="shared-roadmap-state">
          <div className="shared-roadmap-state-card" role="alert">
            <h1>Không thể tải roadmap</h1>
            <p className="shared-roadmap-subtext">Đã xảy ra lỗi kết nối với máy chủ.</p>
            <div className="shared-roadmap-state-actions">
              <button className="button" type="button" onClick={() => void shareQuery.refetch()}>
                Thử lại
              </button>
              <Link className="secondary-button" to="/">
                Về trang chủ
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="shared-roadmap-page product-theme">
      <header className="shared-roadmap-header">
        <div className="shared-roadmap-header-left">
          <Brand />
          <h1 className="shared-roadmap-title">{shareQuery.data.title}</h1>
        </div>
        <span className="shared-roadmap-badge">Chỉ xem</span>
      </header>

      <main className="shared-roadmap-canvas roadmap-canvas" aria-label="Sơ đồ roadmap chỉ xem">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={roadmapEdgeOptions}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            edgesFocusable={false}
            deleteKeyCode={null}
            panOnDrag={true}
            zoomOnScroll={true}
            minZoom={0.05}
            fitView={true}
            fitViewOptions={roadmapFitOptions}
          >
            <RoadmapCanvasBackground />
          </ReactFlow>

          <div className="shared-roadmap-bottom">
            <RoadmapViewportControls />
            <p className="shared-roadmap-hint">Kéo nền để di chuyển</p>
          </div>
        </ReactFlowProvider>
      </main>
    </div>
  );
}
