import { useId, useRef, useState } from 'react';
import type { FormEvent, ToggleEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Brand } from '../../app/Brand';
import { Icon } from '../../app/Icon';
import { WorkspaceShell } from '../../components/WorkspaceShell';
import type { WorkspaceAccount } from '../../components/WorkspaceSidebar';
import { ApiError } from '../../lib/api';
import { endSession } from '../../lib/auth-session';
import { useCurrentUser, useSession } from '../auth/use-session';
import { maxRoadmapTitleLength, validateRoadmapTitle } from '../roadmap-editor/validation';
import { deleteRoadmap, getRoadmaps } from './api';
import type { RoadmapItem } from './api';
import './workspace.css';

const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });

function RoadmapCard({
  roadmap,
  onOpenDetail,
  onDelete,
  isDeleting,
}: {
  roadmap: RoadmapItem;
  onOpenDetail: (roadmap: RoadmapItem) => void;
  onDelete: (roadmap: RoadmapItem) => void;
  isDeleting: boolean;
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleMenuToggle(event: ToggleEvent<HTMLDivElement>) {
    const isOpen = event.newState === 'open';
    setMenuOpen(isOpen);
    if (!isOpen || typeof CSS === 'undefined' || CSS.supports('position-area: block-end')) return;

    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 4;
    const fitsBelow = triggerRect.bottom + gap + menuRect.height <= window.innerHeight - 8;
    const top = fitsBelow
      ? triggerRect.bottom + gap
      : Math.max(8, triggerRect.top - gap - menuRect.height);
    const left = Math.max(
      8,
      Math.min(triggerRect.right - menuRect.width, window.innerWidth - menuRect.width - 8),
    );
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  return (
    <li className="roadmap-card">
      <div className="roadmap-thumbnail">
        <span className="step-count">{roadmap.steps.length} bước</span>
        <ol>
          {roadmap.steps.slice(0, 3).map((step, index) => (
            <li key={`${roadmap.id}-step-${index}`} title={step}>
              {step}
            </li>
          ))}
        </ol>
        {roadmap.steps.length > 3 && <small>+{roadmap.steps.length - 3} bước khác</small>}
      </div>
      <div className="roadmap-details">
        <div className="roadmap-title-row">
          <h2>
            <Link
              className="card-link"
              to={`/roadmaps/${roadmap.id}`}
              state={{ title: roadmap.title }}
            >
              {roadmap.title}
            </Link>
          </h2>
          <button
            ref={triggerRef}
            type="button"
            className="roadmap-menu-trigger"
            popoverTarget={menuId}
            aria-label={`Tùy chọn cho ${roadmap.title}`}
            aria-expanded={menuOpen}
            aria-controls={menuId}
          >
            <Icon name="moreVertical" />
          </button>
          <div
            ref={menuRef}
            id={menuId}
            popover="auto"
            className="roadmap-menu"
            onToggle={handleMenuToggle}
          >
            <button
              type="button"
              className="roadmap-menu-item"
              onClick={() => {
                menuRef.current?.hidePopover();
                onOpenDetail(roadmap);
              }}
            >
              Chi tiết
            </button>
            <button
              type="button"
              className="roadmap-menu-item danger"
              disabled={isDeleting}
              onClick={() => {
                menuRef.current?.hidePopover();
                onDelete(roadmap);
              }}
            >
              Xóa
            </button>
          </div>
        </div>
        <div className="roadmap-meta">
          <time dateTime={roadmap.updatedAt}>
            Cập nhật {dateFormat.format(new Date(roadmap.updatedAt))}
          </time>
          <span className={roadmap.shared ? 'visibility-badge shared' : 'visibility-badge'}>
            {roadmap.shared ? 'Đang chia sẻ' : 'Riêng tư'}
          </span>
        </div>
      </div>
    </li>
  );
}

function Workspace({ account }: { account: WorkspaceAccount }) {
  const [sort, setSort] = useState('recent');
  const [newTitle, setNewTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<RoadmapItem | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const deleteDialogTitleId = useId();
  const deleteDialogDescId = useId();
  const session = useSession();
  const queryClient = useQueryClient();
  const roadmapsQuery = useQuery({
    queryKey: ['private', 'roadmaps', session.version],
    queryFn: ({ signal }) => getRoadmaps(signal),
    enabled: session.token !== null,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteRoadmap,
    onMutate: () => {
      setDeleteError('');
    },
    onSuccess: (_data, deletedId) => {
      deleteDialogRef.current?.close();
      setPendingDelete(null);
      setDeleteError('');
      queryClient.setQueryData<RoadmapItem[]>(['private', 'roadmaps', session.version], (current) =>
        current?.filter((item) => item.id !== deletedId),
      );
      void queryClient.invalidateQueries({ queryKey: ['private', 'roadmaps'] });
      queryClient.removeQueries({ queryKey: ['private', 'roadmap', deletedId] });
    },
    onError: (error) => {
      setDeleteError(
        error instanceof ApiError ? error.message : 'Không thể xóa roadmap. Vui lòng thử lại.',
      );
    },
  });
  const roadmaps = [...(roadmapsQuery.data ?? [])].sort((a, b) => {
    if (sort === 'name') return a.title.localeCompare(b.title, 'vi');
    return sort === 'oldest'
      ? a.updatedAt.localeCompare(b.updatedAt)
      : b.updatedAt.localeCompare(a.updatedAt);
  });

  function openCreateDialog() {
    setNewTitle('');
    setTitleError('');
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }

  function closeCreateDialog() {
    dialogRef.current?.close();
    setNewTitle('');
    setTitleError('');
  }

  function openDeleteDialog(roadmap: RoadmapItem) {
    setPendingDelete(roadmap);
    setDeleteError('');
    deleteDialogRef.current?.showModal();
    cancelDeleteRef.current?.focus();
  }

  function closeDeleteDialog() {
    if (deleteMutation.isPending) return;
    deleteDialogRef.current?.close();
    setPendingDelete(null);
    setDeleteError('');
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateRoadmapTitle(newTitle);
    if (error) {
      setTitleError(error);
      inputRef.current?.focus();
      return;
    }
    const trimmed = newTitle.trim();
    closeCreateDialog();
    void navigate('/roadmaps/new', { state: { title: trimmed } });
  }

  return (
    <WorkspaceShell
      account={account}
      headerContent={<span className="workspace-header-default">Không gian làm việc</span>}
    >
      <div className="workspace-heading">
        <div>
          <h1>Roadmap của tôi</h1>
          <p>Lưu giữ và chia sẻ những lộ trình bạn xây dựng.</p>
        </div>
        <button className="button" type="button" onClick={openCreateDialog}>
          <Icon name="plus" /> Tạo roadmap
        </button>
      </div>
      <div className="workspace-toolbar">
        <span>{roadmaps.length} roadmap</span>
        <label>
          Sắp xếp
          <select value={sort} onChange={(event) => setSort(event.currentTarget.value)}>
            <option value="recent">Cập nhật gần nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="name">Tên A-Z</option>
          </select>
        </label>
      </div>
      <ul className="roadmap-grid" aria-label="Danh sách roadmap">
        {roadmaps.map((roadmap) => (
          <RoadmapCard
            key={roadmap.id}
            roadmap={roadmap}
            onOpenDetail={(item) => {
              void navigate(`/roadmaps/${item.id}`, { state: { title: item.title } });
            }}
            onDelete={openDeleteDialog}
            isDeleting={deleteMutation.isPending && deleteMutation.variables === roadmap.id}
          />
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        className="create-roadmap-dialog"
        aria-labelledby={dialogTitleId}
        closedby="any"
        onClose={() => {
          setNewTitle('');
          setTitleError('');
        }}
      >
        <form className="create-roadmap-form" onSubmit={handleCreateSubmit} noValidate>
          <h2 id={dialogTitleId}>Tạo roadmap mới</h2>
          <div className="create-roadmap-field">
            <label htmlFor={inputId}>
              Tên roadmap <span aria-hidden="true">*</span>
            </label>
            <input
              ref={inputRef}
              id={inputId}
              name="title"
              type="text"
              placeholder="Onboarding Frontend"
              value={newTitle}
              maxLength={maxRoadmapTitleLength}
              required
              aria-invalid={Boolean(titleError)}
              aria-describedby={titleError ? `${helpId} ${errorId}` : helpId}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setNewTitle(value);
                if (titleError && !validateRoadmapTitle(value)) setTitleError('');
              }}
            />
            <p id={helpId} className="create-roadmap-help">
              Bắt buộc · Tối đa 255 ký tự
            </p>
            {titleError && (
              <p id={errorId} className="create-roadmap-error" role="alert">
                {titleError}
              </p>
            )}
          </div>
          <div className="create-roadmap-actions">
            <button type="button" className="secondary-button" onClick={closeCreateDialog}>
              Hủy
            </button>
            <button type="submit" className="button">
              Tạo roadmap
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={deleteDialogRef}
        className="create-roadmap-dialog"
        aria-labelledby={deleteDialogTitleId}
        aria-describedby={deleteDialogDescId}
        closedby={deleteMutation.isPending ? 'none' : 'any'}
        onCancel={(event) => {
          if (deleteMutation.isPending) event.preventDefault();
        }}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setPendingDelete(null);
            setDeleteError('');
          }
        }}
      >
        <div className="delete-roadmap-body">
          <h2 id={deleteDialogTitleId}>Xóa roadmap?</h2>
          <p id={deleteDialogDescId} className="delete-roadmap-desc">
            Bạn có chắc muốn xóa roadmap <strong>{pendingDelete?.title}</strong>? Hành động này
            không thể hoàn tác.
          </p>
          {deleteError && (
            <p className="create-roadmap-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="create-roadmap-actions">
            <button
              ref={cancelDeleteRef}
              type="button"
              className="secondary-button"
              disabled={deleteMutation.isPending}
              onClick={closeDeleteDialog}
            >
              Hủy
            </button>
            <button
              type="button"
              className="secondary-button delete-roadmap-confirm"
              disabled={deleteMutation.isPending || !pendingDelete}
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              {deleteMutation.isPending ? 'Đang xóa…' : 'Xóa roadmap'}
            </button>
          </div>
        </div>
      </dialog>
    </WorkspaceShell>
  );
}

export function WorkspacePage() {
  const session = useSession();
  const user = useCurrentUser();
  if (!session.token) {
    return (
      <Navigate to="/login" replace state={{ sessionExpired: session.endReason === 'expired' }} />
    );
  }
  if (!user.data) {
    return (
      <main className="workspace-session">
        <Brand />
        <h1>Không gian làm việc</h1>
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
  return (
    <Workspace account={{ email: user.data.email, logout: () => endSession(session, 'logout') }} />
  );
}
