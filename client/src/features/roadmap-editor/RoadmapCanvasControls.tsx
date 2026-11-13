import { Background, BackgroundVariant, useReactFlow, useViewport } from '@xyflow/react';
import { Icon } from '../../app/Icon';
import { roadmapFitOptions } from './roadmap-canvas-options';
import './roadmap-canvas.css';

export function RoadmapCanvasBackground() {
  return <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#cbd5e1" />;
}

export function RoadmapViewportControls() {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <div className="roadmap-viewport-tools" role="group" aria-label="Điều khiển sơ đồ">
      <button type="button" aria-label="Thu nhỏ" onClick={() => void zoomOut()}>
        <Icon name="minus" />
      </button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="Phóng to" onClick={() => void zoomIn()}>
        <Icon name="plus" />
      </button>
      <button
        type="button"
        className="roadmap-fit-button"
        onClick={() => void fitView(roadmapFitOptions)}
      >
        <Icon name="fit" /> Vừa khung
      </button>
    </div>
  );
}
