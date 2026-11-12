import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Dimensions, NodeChange } from '@xyflow/react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '../../app/Icon';
import { WorkspaceHeader } from '../../components/WorkspaceHeader';
import { ApiError } from '../../lib/api';
import { getSession } from '../../lib/auth-session';
import { useCurrentUser, useSession } from '../auth/use-session';
import type { RoadmapFlowNode } from '../roadmap-editor/RoadmapStepNode';
import { createRoadmap } from '../roadmap-editor/api';
import type { CreateRoadmapRequest } from '../roadmap-editor/api';
import { roadmapPayloadTooLarge } from '../roadmap-editor/validation';
import { MarkdownEditor } from './MarkdownEditor';
import { PlaygroundPreview } from './PlaygroundPreview';
import { SaveRoadmapDialog } from './SaveRoadmapDialog';
import { layoutRoadmap } from './layout';
import { parsePlaygroundMarkdown, sampleMarkdown } from './markdown';
import type { ParsedRoadmap, PlaygroundIssue } from './markdown';
import './playground.css';

interface Preview {
  graph: ParsedRoadmap;
  payload: CreateRoadmapRequest;
  sizes: ReadonlyMap<string, Dimensions>;
}

interface DraftResult {
  markdown: string;
  preview?: Preview | undefined;
  issues: PlaygroundIssue[];
}

function buildPreview(
  markdown: string,
  graph: ParsedRoadmap,
  sizes: ReadonlyMap<string, Dimensions>,
  previous: Preview | undefined,
): DraftResult {
  try {
    const payload = layoutRoadmap(graph, sizes);
    if (roadmapPayloadTooLarge(payload)) {
      return {
        markdown,
        preview: previous,
        issues: [
          {
            line: 1,
            column: 1,
            code: 'GRAPH_LIMIT_EXCEEDED',
            message: 'Dữ liệu lưu roadmap vượt quá giới hạn 1 MiB.',
          },
        ],
      };
    }
    return { markdown, preview: { graph, payload, sizes }, issues: [] };
  } catch {
    return {
      markdown,
      preview: previous,
      issues: [
        {
          line: 1,
          column: 1,
          code: 'LAYOUT_FAILED',
          message: 'Không thể tự sắp xếp sơ đồ này.',
        },
      ],
    };
  }
}

function compileDraft(markdown: string, previous?: Preview): DraftResult {
  const parsed = parsePlaygroundMarkdown(markdown);
  if (parsed.errors) return { markdown, preview: previous, issues: parsed.errors };

  const sizes = new Map<string, Dimensions>();
  for (const { id } of parsed.graph.nodes) {
    const size = previous?.sizes.get(id);
    if (size) sizes.set(id, size);
  }
  return buildPreview(markdown, parsed.graph, sizes, previous);
}

function Playground() {
  const [draft, setDraft] = useState(sampleMarkdown);
  const [result, setResult] = useState(() => compileDraft(sampleMarkdown));
  const [saveDraft, setSaveDraft] = useState<CreateRoadmapRequest | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({ mutationFn: createRoadmap });
  const isProcessing = draft !== result.markdown;
  const issues = isProcessing ? [] : result.issues;

  useEffect(() => {
    const timer = setTimeout(() => {
      setResult((current) =>
        current.markdown === draft ? current : compileDraft(draft, current.preview),
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [draft]);

  const measureNodes = useCallback(
    (changes: NodeChange<RoadmapFlowNode>[]) => {
      setResult((current) => {
        if (current.markdown !== draft || current.issues.length || !current.preview) return current;

        const { preview } = current;
        const sizes = new Map(preview.sizes);
        let changed = false;
        for (const change of changes) {
          if (change.type !== 'dimensions' || !change.dimensions) continue;
          const { width, height } = change.dimensions;
          const prior = sizes.get(change.id);
          if (width <= 0 || height <= 0 || (prior?.width === width && prior.height === height)) {
            continue;
          }
          sizes.set(change.id, { width, height });
          changed = true;
        }
        return changed ? buildPreview(draft, preview.graph, sizes, preview) : current;
      });
    },
    [draft],
  );

  const canSave = result.preview && !isProcessing && !issues.length && !mutation.isPending;
  const previewStatus = isProcessing
    ? 'Đang cập nhật sơ đồ…'
    : issues.length && result.preview
      ? 'Đang hiển thị bản xem trước hợp lệ gần nhất.'
      : '';

  function openSaveDialog() {
    if (!canSave || !result.preview) return;
    mutation.reset();
    setSaveDraft(result.preview.payload);
  }

  function save(payload: CreateRoadmapRequest) {
    if (mutation.isPending) return;
    const session = getSession();
    if (!session.token) return;

    mutation.mutate(payload, {
      onSuccess: (roadmap) => {
        if (getSession() !== session) return;
        queryClient.setQueryData(['private', 'roadmap', roadmap.id, session.version], roadmap);
        void queryClient.invalidateQueries({ queryKey: ['private', 'roadmaps'] });
        void navigate(`/roadmaps/${roadmap.id}`, {
          replace: true,
          state: { title: roadmap.title },
        });
      },
    });
  }

  return (
    <div className="workspace playground-page">
      <a className="skip-link" href="#playground-main">
        Đến nội dung chính
      </a>
      <WorkspaceHeader
        leading={
          <Link className="editor-back-link" to="/roadmaps" aria-label="Quay lại danh sách roadmap">
            <Icon name="chevronLeft" />
          </Link>
        }
        actions={
          <button className="button" type="button" disabled={!canSave} onClick={openSaveDialog}>
            <Icon name="save" />
            Lưu thành roadmap
          </button>
        }
      >
        <h1 className="playground-badge">Playground</h1>
      </WorkspaceHeader>
      <main className="playground-main" id="playground-main" tabIndex={-1}>
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          issues={issues}
          isSample={draft === sampleMarkdown}
          readOnly={mutation.isPending}
        />
        <PlaygroundPreview
          roadmap={result.preview?.payload}
          sizes={result.preview?.sizes}
          onNodesChange={measureNodes}
          status={previewStatus}
        />
      </main>
      {saveDraft && (
        <SaveRoadmapDialog
          roadmap={saveDraft}
          isSaving={mutation.isPending}
          saveError={
            mutation.isError
              ? mutation.error instanceof ApiError
                ? mutation.error.message
                : 'Không thể lưu roadmap. Vui lòng thử lại.'
              : null
          }
          onClose={() => setSaveDraft(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

export function PlaygroundPage() {
  const session = useSession();
  const user = useCurrentUser();
  if (!session.token) {
    return (
      <Navigate to="/login" replace state={{ sessionExpired: session.endReason === 'expired' }} />
    );
  }
  if (!user.data) {
    return (
      <main className="route-message">
        {user.isError ? (
          <>
            <p role="alert">Chưa thể kiểm tra phiên đăng nhập.</p>
            <button className="button" type="button" onClick={() => void user.refetch()}>
              Thử lại
            </button>
          </>
        ) : (
          <p role="status">Đang kiểm tra phiên đăng nhập…</p>
        )}
      </main>
    );
  }
  return <Playground key={session.version} />;
}
