import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Link, Navigate, useBlocker, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Brand } from '../../app/Brand';
import { Icon } from '../../app/Icon';
import { WorkspaceHeader } from '../../components/WorkspaceHeader';
import { ApiError } from '../../lib/api';
import { endSession, getSession } from '../../lib/auth-session';
import { useCurrentUser, useSession } from '../auth/use-session';
import { createRoadmap, getRoadmapById, updateRoadmap } from './api';
import type {
  RoadmapDetail,
  RoadmapEdgePayload,
  RoadmapNodeData,
  RoadmapNodePayload,
  UpdateRoadmapRequest,
} from './api';
import { RoadmapStepNode } from './RoadmapStepNode';
import type { RoadmapFlowNode } from './RoadmapStepNode';
import { RoadmapCanvasBackground, RoadmapViewportControls } from './RoadmapCanvasControls';
import { roadmapEdgeOptions, roadmapFitOptions } from './roadmap-canvas-options';
import './roadmap-editor.css';

const maxNodes = 500;
const maxEdges = 1000;
const maxTitleLength = 255;
const maxDescriptionLength = 2000;
const nodeTypes = { default: RoadmapStepNode };

function parseRoadmapIdParam(rawId: string | undefined): number | null {
  if (rawId === undefined) return null;
  if (!/^[1-9]\d*$/.test(rawId)) return Number.NaN;
  const parsed = Number(rawId);
  if (!Number.isSafeInteger(parsed) || parsed > 2147483647) return Number.NaN;
  return parsed;
}

function getLocationTitle(state: unknown): string | undefined {
  if (!state || typeof state !== 'object' || !('title' in state)) return undefined;
  const candidate = state.title;
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate.trim()
    : undefined;
}

function serializeNodes(nodes: RoadmapFlowNode[]): RoadmapNodePayload[] {
  return nodes.map((node) => {
    const label = node.data.label.trim();
    const rawDesc = typeof node.data.description === 'string' ? node.data.description : '';
    const data: RoadmapNodeData = rawDesc.length > 0 ? { label, description: rawDesc } : { label };
    return {
      id: node.id,
      type: 'default',
      position: {
        x: Math.round(node.position.x * 100) / 100,
        y: Math.round(node.position.y * 100) / 100,
      },
      data,
    };
  });
}

function serializeEdges(edges: Edge[]): RoadmapEdgePayload[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type === 'default' ? 'default' : 'smoothstep',
    animated: Boolean(edge.animated),
  }));
}

function toFlowNodes(nodes: RoadmapNodePayload[]): RoadmapFlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: 'default',
    position: { x: node.position.x, y: node.position.y },
    data: {
      label: node.data.label,
      ...(typeof node.data.description === 'string' && node.data.description.length > 0
        ? { description: node.data.description }
        : {}),
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

function generateNodeId(existing: RoadmapFlowNode[]): string {
  const existingIds = new Set(existing.map((node) => node.id));
  let index = existing.length + 1;
  while (existingIds.has(`node-${index}`)) {
    index += 1;
  }
  return `node-${index}`;
}

function generateEdgeId(source: string, target: string, existing: Edge[]): string {
  const base = `edge-${source}-${target}`;
  const existingIds = new Set(existing.map((edge) => edge.id));
  if (!existingIds.has(base)) return base;
  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function validateTitle(raw: string): string | null {
  if (/[\r\n]/.test(raw)) return 'Tên roadmap phải nằm trên một dòng.';
  const trimmed = raw.trim();
  const len = [...trimmed].length;
  if (len < 1) return 'Tên roadmap không được để trống.';
  if (len > maxTitleLength) return 'Tên roadmap tối đa 255 ký tự.';
  return null;
}

function validateNodeFields(label: string, description: string): string | null {
  if (/[\r\n]/.test(label)) return 'Tên bước không được chứa ký tự xuống dòng.';
  const trimmedLabel = label.trim();
  const labelLen = [...trimmedLabel].length;
  if (labelLen < 1) return 'Tên bước không được để trống.';
  if (labelLen > maxTitleLength) return 'Tên bước tối đa 255 ký tự.';
  if (/[\r\n]/.test(description)) return 'Mô tả không được chứa ký tự xuống dòng.';
  if ([...description].length > maxDescriptionLength) return 'Mô tả tối đa 2.000 ký tự.';
  return null;
}

function StepInspectorForm({
  node,
  onApply,
  onDelete,
}: {
  node: RoadmapFlowNode;
  onApply: (label: string, description: string) => void;
  onDelete: () => void;
}) {
  const [draftLabel, setDraftLabel] = useState(node.data.label);
  const [draftDescription, setDraftDescription] = useState(
    typeof node.data.description === 'string' ? node.data.description : '',
  );
  const [fieldError, setFieldError] = useState('');
  const labelInputId = useId();
  const descriptionInputId = useId();
  const deleteNoteId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateNodeFields(draftLabel, draftDescription);
    if (error) {
      setFieldError(error);
      return;
    }
    setFieldError('');
    onApply(draftLabel.trim(), draftDescription);
  }

  return (
    <form className="editor-inspector-form" onSubmit={handleSubmit} noValidate>
      <div className="editor-field">
        <div className="editor-field-heading">
          <label htmlFor={labelInputId}>
            Tên bước <span aria-hidden="true">*</span>
          </label>
          <span className="editor-field-meta">
            {[...draftLabel].length} / {maxTitleLength}
          </span>
        </div>
        <input
          id={labelInputId}
          name="label"
          type="text"
          value={draftLabel}
          maxLength={maxTitleLength}
          required
          onChange={(event) => {
            const next = event.currentTarget.value;
            setDraftLabel(next);
            if (fieldError && !validateNodeFields(next, draftDescription)) {
              setFieldError('');
            }
          }}
        />
      </div>

      <div className="editor-field">
        <div className="editor-field-heading">
          <label htmlFor={descriptionInputId}>Mô tả (không bắt buộc)</label>
          <span className="editor-field-meta">
            {[...draftDescription].length} / {maxDescriptionLength}
          </span>
        </div>
        <textarea
          id={descriptionInputId}
          name="description"
          value={draftDescription}
          maxLength={maxDescriptionLength}
          onChange={(event) => {
            const next = event.currentTarget.value.replace(/[\r\n]+/g, ' ');
            setDraftDescription(next);
            if (fieldError && !validateNodeFields(draftLabel, next)) {
              setFieldError('');
            }
          }}
        />
      </div>

      {fieldError && (
        <p className="editor-field-error" role="alert">
          {fieldError}
        </p>
      )}

      <button type="submit" className="button">
        <Icon name="check" /> Áp dụng
      </button>
      <div className="editor-step-delete">
        <button
          type="button"
          className="secondary-button editor-delete-step"
          aria-describedby={deleteNoteId}
          onClick={onDelete}
        >
          <Icon name="trash" /> Xóa bước
        </button>
        <p id={deleteNoteId}>Xóa bước sẽ xóa toàn bộ các mũi tên kết nối với bước này.</p>
      </div>
    </form>
  );
}

interface SavedSnapshot {
  title: string;
  nodesJson: string;
  edgesJson: string;
}

function EditorCanvas({
  roadmapId,
  initialTitle,
  initialNodes,
  initialEdges,
  initialDirty,
  sessionVersion,
}: {
  roadmapId: number | null;
  initialTitle: string;
  initialNodes: RoadmapFlowNode[];
  initialEdges: Edge[];
  initialDirty: boolean;
  sessionVersion: number;
}) {
  const isNewMode = roadmapId === null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(initialTitle);
  const [nodes, setNodes] = useState<RoadmapFlowNode[]>(() =>
    initialNodes.map((node, index) => ({ ...node, selected: index === 0 })),
  );
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodes[0]?.id ?? null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [defaultEdgeType, setDefaultEdgeType] = useState<'smoothstep' | 'default'>('smoothstep');
  const [saveError, setSaveError] = useState('');
  const [isDirty, setIsDirty] = useState(initialDirty);
  const inspectorTitleRef = useRef<HTMLHeadingElement>(null);
  const allowNextNavigationRef = useRef(false);
  const leaveDialogRef = useRef<HTMLDialogElement>(null);
  const leaveDialogTitleId = useId();
  const edgeTypeSelectId = useId();

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (allowNextNavigationRef.current) {
      allowNextNavigationRef.current = false;
      return false;
    }
    if (!getSession().token) return false;
    return isDirty && currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const dialog = leaveDialogRef.current;
    if (!dialog) return;
    if (blocker.state === 'blocked' && !dialog.open) {
      dialog.showModal();
    } else if (blocker.state !== 'blocked' && dialog.open) {
      dialog.close();
    }
  }, [blocker.state]);

  const savedSnapshotRef = useRef<SavedSnapshot | null>(
    roadmapId === null
      ? null
      : {
          title: initialTitle.trim(),
          nodesJson: JSON.stringify(serializeNodes(initialNodes)),
          edgesJson: JSON.stringify(serializeEdges(initialEdges)),
        },
  );

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const createMutation = useMutation({
    mutationFn: createRoadmap,
    onSuccess: (created: RoadmapDetail) => {
      const nextNodes = toFlowNodes(created.nodes);
      const nextEdges = toFlowEdges(created.edges);
      savedSnapshotRef.current = {
        title: created.title.trim(),
        nodesJson: JSON.stringify(serializeNodes(nextNodes)),
        edgesJson: JSON.stringify(serializeEdges(nextEdges)),
      };
      allowNextNavigationRef.current = true;
      setIsDirty(false);
      setSaveError('');
      queryClient.setQueryData(['private', 'roadmap', created.id, sessionVersion], created);
      void queryClient.invalidateQueries({ queryKey: ['private', 'roadmaps'] });
      void navigate(`/roadmaps/${created.id}`, {
        replace: true,
        state: { title: created.title },
      });
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiError ? error.message : 'Không thể lưu roadmap. Vui lòng thử lại.',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRoadmapRequest }) =>
      updateRoadmap(id, payload),
    onSuccess: (updated: RoadmapDetail) => {
      const nextNodes = toFlowNodes(updated.nodes);
      const nextEdges = toFlowEdges(updated.edges);
      savedSnapshotRef.current = {
        title: updated.title.trim(),
        nodesJson: JSON.stringify(serializeNodes(nextNodes)),
        edgesJson: JSON.stringify(serializeEdges(nextEdges)),
      };
      setIsDirty(false);
      setSaveError('');
      queryClient.setQueryData(['private', 'roadmap', updated.id, sessionVersion], updated);
      void queryClient.invalidateQueries({ queryKey: ['private', 'roadmaps'] });
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiError ? error.message : 'Không thể lưu roadmap. Vui lòng thử lại.',
      );
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const saveStatus = saveError ? 'error' : isSaving ? 'saving' : isDirty ? 'dirty' : 'saved';

  const handleNodesChange = useCallback((changes: NodeChange<RoadmapFlowNode>[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
    const hasEdit = changes.some(
      (change) =>
        change.type === 'add' ||
        change.type === 'remove' ||
        (change.type === 'position' && change.position !== undefined),
    );
    if (hasEdit) {
      setIsDirty(true);
      setSaveError('');
    }
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
    const hasEdit = changes.some((change) => change.type === 'add' || change.type === 'remove');
    if (hasEdit) {
      setIsDirty(true);
      setSaveError('');
    }
  }, []);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      setEdges((prev) => {
        if (prev.length >= maxEdges) return prev;
        const duplicate = prev.some(
          (edge) => edge.source === connection.source && edge.target === connection.target,
        );
        if (duplicate) return prev;
        const newEdge: Edge = {
          id: generateEdgeId(connection.source, connection.target, prev),
          source: connection.source,
          target: connection.target,
          type: defaultEdgeType,
          animated: false,
        };
        return addEdge(newEdge, prev);
      });
      setIsDirty(true);
      setSaveError('');
    },
    [defaultEdgeType, setEdges],
  );

  function handleAddStep() {
    if (nodes.length >= maxNodes) {
      setSaveError(`Mỗi roadmap tối đa ${maxNodes} bước.`);
      return;
    }
    const id = generateNodeId(nodes);
    const stepNumber = String(nodes.length + 1).padStart(2, '0');
    const anchor = selectedNode ?? nodes[nodes.length - 1];
    const position = anchor
      ? { x: anchor.position.x, y: anchor.position.y + 130 }
      : { x: 240, y: 120 };
    const newNode: RoadmapFlowNode = {
      id,
      type: 'default',
      position,
      selected: true,
      data: { label: `${stepNumber} Bước mới` },
    };
    setNodes((prev) => [...prev.map((n): RoadmapFlowNode => ({ ...n, selected: false })), newNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setIsDirty(true);
    setSaveError('');
  }

  function handleApplyStep(label: string, description: string) {
    if (!selectedNode) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: description.length > 0 ? { label, description } : { label },
            }
          : node,
      ),
    );
    setIsDirty(true);
    setSaveError('');
  }

  function handleDeleteSelectedStep() {
    if (!selectedNode) return;
    const targetId = selectedNode.id;
    setNodes((prev) => prev.filter((node) => node.id !== targetId));
    setEdges((prev) => prev.filter((edge) => edge.source !== targetId && edge.target !== targetId));
    setSelectedNodeId(null);
    setIsDirty(true);
    setSaveError('');
  }

  function handleDeleteSelectedEdge() {
    if (!selectedEdgeId) return;
    setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    setIsDirty(true);
    setSaveError('');
  }

  function handleCloseInspector() {
    setNodes((prev) => prev.map((node) => (node.selected ? { ...node, selected: false } : node)));
    setEdges((prev) => prev.map((edge) => (edge.selected ? { ...edge, selected: false } : edge)));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    inspectorTitleRef.current?.focus();
  }

  function handleUpdateSelectedEdge(updates: {
    type?: 'smoothstep' | 'default';
    animated?: boolean;
  }) {
    if (!selectedEdgeId) return;
    setEdges((prev) =>
      prev.map((edge) =>
        edge.id === selectedEdgeId
          ? {
              ...edge,
              ...(updates.type !== undefined ? { type: updates.type } : {}),
              ...(updates.animated !== undefined ? { animated: updates.animated } : {}),
            }
          : edge,
      ),
    );
    setIsDirty(true);
    setSaveError('');
  }

  function handleSave() {
    const titleError = validateTitle(title);
    if (titleError) {
      setSaveError(titleError);
      return;
    }
    const trimmedTitle = title.trim();
    const serializedNodes = serializeNodes(nodes);
    const serializedEdges = serializeEdges(edges);

    if (isNewMode) {
      createMutation.mutate({
        title: trimmedTitle,
        nodes: serializedNodes,
        edges: serializedEdges,
      });
      return;
    }

    const prev = savedSnapshotRef.current;
    const nodesJson = JSON.stringify(serializedNodes);
    const edgesJson = JSON.stringify(serializedEdges);
    const payload: UpdateRoadmapRequest = {};
    if (!prev || prev.title !== trimmedTitle) payload.title = trimmedTitle;
    if (!prev || prev.nodesJson !== nodesJson) payload.nodes = serializedNodes;
    if (!prev || prev.edgesJson !== edgesJson) payload.edges = serializedEdges;

    if (payload.title === undefined && payload.nodes === undefined && payload.edges === undefined) {
      payload.title = trimmedTitle;
      payload.nodes = serializedNodes;
      payload.edges = serializedEdges;
    }

    updateMutation.mutate({ id: roadmapId, payload });
  }

  return (
    <div className="workspace editor-page">
      <WorkspaceHeader
        leading={
          <Link className="editor-back-link" to="/roadmaps" aria-label="Quay lại danh sách roadmap">
            <Icon name="chevronLeft" />
          </Link>
        }
        actions={
          <div className="editor-header-actions">
            <button
              type="button"
              className="secondary-button editor-header-btn"
              onClick={() => {
                console.log('Tải xuống roadmap:', {
                  id: roadmapId,
                  title: title.trim(),
                  nodes: serializeNodes(nodes),
                  edges: serializeEdges(edges),
                });
              }}
            >
              <Icon name="download" /> Tải xuống
            </button>
            <button
              type="button"
              className="secondary-button editor-header-btn"
              onClick={() => {
                console.log('Chia sẻ roadmap:', { id: roadmapId, title: title.trim() });
              }}
            >
              <Icon name="share" /> Chia sẻ
            </button>
            <button
              type="button"
              className="button editor-header-btn"
              disabled={isSaving}
              onClick={handleSave}
            >
              <Icon name="save" /> {isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        }
      >
        <div className="editor-title-meta">
          <input
            type="text"
            className="editor-title-input"
            aria-label="Tên roadmap"
            value={title}
            maxLength={maxTitleLength}
            onChange={(event) => {
              setTitle(event.currentTarget.value);
              setIsDirty(true);
              setSaveError('');
            }}
          />
          <span
            className={`editor-save-status ${saveStatus}`}
            role={saveError ? 'alert' : 'status'}
          >
            {saveError || (isSaving ? 'Đang lưu…' : isDirty ? 'Có thay đổi chưa lưu' : 'Đã lưu')}
          </span>
        </div>
      </WorkspaceHeader>

      <div className="editor-body">
        <section className="editor-canvas-pane roadmap-canvas" aria-label="Canvas roadmap">
          <div className="editor-canvas-top">
            <button type="button" className="button editor-add-btn" onClick={handleAddStep}>
              <Icon name="plus" /> Thêm bước
            </button>
            <span className="editor-node-count">
              {nodes.length} / {maxNodes} bước
            </span>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={roadmapEdgeOptions}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_event, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_event, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
            }}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }}
            deleteKeyCode={['Backspace', 'Delete']}
            minZoom={0.05}
            fitView={!isNewMode}
            fitViewOptions={roadmapFitOptions}
          >
            <RoadmapCanvasBackground />
          </ReactFlow>

          <div className="editor-canvas-bottom">
            <RoadmapViewportControls />
            <label className="editor-edge-type-label">
              Kiểu nối
              <select
                className="editor-edge-type-select"
                value={defaultEdgeType}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  if (value === 'smoothstep' || value === 'default') {
                    setDefaultEdgeType(value);
                  }
                }}
              >
                <option value="smoothstep">Gấp khúc</option>
                <option value="default">Đường cong</option>
              </select>
            </label>
          </div>
        </section>

        <aside
          className="editor-inspector"
          aria-label={selectedEdge ? 'Chi tiết kết nối' : 'Chi tiết bước'}
        >
          <div className="editor-inspector-head">
            <div>
              <h2 ref={inspectorTitleRef} tabIndex={-1}>
                {selectedEdge ? 'Chi tiết kết nối' : 'Chi tiết bước'}
              </h2>
              <p>
                {selectedNode
                  ? `Đang chọn: ${selectedNode.data.label}`
                  : selectedEdge
                    ? `${nodes.find((n) => n.id === selectedEdge.source)?.data.label ?? selectedEdge.source} → ${nodes.find((n) => n.id === selectedEdge.target)?.data.label ?? selectedEdge.target}`
                    : 'Chọn một bước hoặc mũi tên trên canvas để chỉnh sửa'}
              </p>
            </div>
            {(selectedNode || selectedEdge) && (
              <button
                type="button"
                className="editor-close-btn"
                aria-label="Bỏ chọn"
                onClick={handleCloseInspector}
              >
                <Icon name="close" />
              </button>
            )}
          </div>

          {selectedNode ? (
            <StepInspectorForm
              key={selectedNode.id}
              node={selectedNode}
              onApply={handleApplyStep}
              onDelete={handleDeleteSelectedStep}
            />
          ) : selectedEdge ? (
            <div className="editor-inspector-form">
              <div className="editor-field">
                <label htmlFor={edgeTypeSelectId}>Kiểu đường nối</label>
                <select
                  id={edgeTypeSelectId}
                  value={selectedEdge.type === 'default' ? 'default' : 'smoothstep'}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    if (value === 'smoothstep' || value === 'default') {
                      handleUpdateSelectedEdge({ type: value });
                    }
                  }}
                >
                  <option value="smoothstep">Gấp khúc (smoothstep)</option>
                  <option value="default">Đường cong (default)</option>
                </select>
              </div>
              <label className="editor-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(selectedEdge.animated)}
                  onChange={(event) =>
                    handleUpdateSelectedEdge({ animated: event.currentTarget.checked })
                  }
                />
                Hiệu ứng chuyển động (animated)
              </label>
              <div className="editor-inspector-footer">
                <button
                  type="button"
                  className="editor-delete-btn"
                  onClick={handleDeleteSelectedEdge}
                >
                  <Icon name="trash" /> Xóa kết nối
                </button>
              </div>
            </div>
          ) : (
            <p className="editor-empty-inspector">
              Kéo từ chấm tròn bên dưới một bước đến chấm tròn phía trên bước tiếp theo để tạo mũi
              tên.
            </p>
          )}
        </aside>
      </div>
      <dialog
        ref={leaveDialogRef}
        className="editor-leave-dialog"
        aria-labelledby={leaveDialogTitleId}
        onCancel={(event) => {
          event.preventDefault();
          blocker.reset?.();
        }}
      >
        <div className="editor-leave-content">
          <h2 id={leaveDialogTitleId}>Bạn có thay đổi chưa lưu</h2>
          <p>Nếu rời khỏi trang lúc này, các chỉnh sửa chưa lưu sẽ bị mất.</p>
          <div className="editor-leave-actions">
            <button
              type="button"
              className="secondary-button"
              autoFocus
              onClick={() => blocker.reset?.()}
            >
              Ở lại trang
            </button>
            <button type="button" className="button" onClick={() => blocker.proceed?.()}>
              Rời khỏi trang
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function EditorStateShell({
  accountEmail,
  title,
  children,
}: {
  accountEmail: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="workspace editor-page">
      <WorkspaceHeader accountEmail={accountEmail}>
        <div className="editor-header-title">
          <Link className="editor-back-link" to="/roadmaps" aria-label="Quay lại danh sách roadmap">
            <Icon name="chevronLeft" />
          </Link>
          <span>{title}</span>
        </div>
      </WorkspaceHeader>
      <main className="editor-state-screen">{children}</main>
    </div>
  );
}

export function RoadmapEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const session = useSession();
  const user = useCurrentUser();
  const parsedId = parseRoadmapIdParam(id);
  const isValidId = parsedId !== null && !Number.isNaN(parsedId);

  const detailQuery = useQuery({
    queryKey: ['private', 'roadmap', parsedId, session.version],
    queryFn: ({ signal }) => getRoadmapById(parsedId!, signal),
    enabled: Boolean(session.token && user.data && isValidId),
  });

  if (!session.token) {
    return (
      <Navigate to="/login" replace state={{ sessionExpired: session.endReason === 'expired' }} />
    );
  }

  if (!user.data) {
    return (
      <main className="workspace-session">
        <Brand />
        <h1>Trình chỉnh sửa roadmap</h1>
        {user.isError ? (
          <>
            <p role="alert">Chưa thể kiểm tra phiên đăng nhập.</p>
            <div className="workspace-session-actions">
              <button className="button" type="button" onClick={() => void user.refetch()}>
                Thử lại
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => endSession(session, 'logout')}
              >
                Đăng xuất
              </button>
            </div>
          </>
        ) : (
          <p role="status">Đang kiểm tra phiên đăng nhập…</p>
        )}
      </main>
    );
  }

  if (parsedId !== null && Number.isNaN(parsedId)) {
    return (
      <EditorStateShell accountEmail={user.data.email} title="Không gian làm việc">
        <div className="editor-state-card" role="alert">
          <p>ID roadmap không hợp lệ.</p>
          <Link className="button" to="/roadmaps">
            Về danh sách roadmap
          </Link>
        </div>
      </EditorStateShell>
    );
  }

  const fallbackTitle = getLocationTitle(location.state) ?? 'Roadmap chưa đặt tên';

  if (parsedId !== null) {
    if (detailQuery.isPending) {
      return (
        <EditorStateShell accountEmail={user.data.email} title={fallbackTitle}>
          <p role="status">Đang tải roadmap…</p>
        </EditorStateShell>
      );
    }

    if (detailQuery.isError) {
      return (
        <EditorStateShell accountEmail={user.data.email} title={fallbackTitle}>
          <div className="editor-state-card" role="alert">
            <p>
              {detailQuery.error instanceof ApiError
                ? detailQuery.error.message
                : 'Không thể tải roadmap.'}
            </p>
            <div className="editor-header-actions">
              <button className="button" type="button" onClick={() => void detailQuery.refetch()}>
                Thử lại
              </button>
              <Link className="secondary-button" to="/roadmaps">
                Về danh sách
              </Link>
            </div>
          </div>
        </EditorStateShell>
      );
    }

    const detail = detailQuery.data;
    const resolvedTitle =
      typeof detail.title === 'string' && detail.title.trim().length > 0
        ? detail.title
        : fallbackTitle;

    return (
      <ReactFlowProvider>
        <EditorCanvas
          roadmapId={detail.id}
          initialTitle={resolvedTitle}
          initialNodes={toFlowNodes(Array.isArray(detail.nodes) ? detail.nodes : [])}
          initialEdges={toFlowEdges(Array.isArray(detail.edges) ? detail.edges : [])}
          initialDirty={false}
          sessionVersion={session.version}
        />
      </ReactFlowProvider>
    );
  }

  return (
    <ReactFlowProvider>
      <EditorCanvas
        roadmapId={null}
        initialTitle={fallbackTitle}
        initialNodes={[]}
        initialEdges={[]}
        initialDirty={true}
        sessionVersion={session.version}
      />
    </ReactFlowProvider>
  );
}
