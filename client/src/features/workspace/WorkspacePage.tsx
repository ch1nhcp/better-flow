import { useId, useRef, useState } from 'react';
import type { ToggleEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { Brand } from '../../app/Brand';
import { Icon } from '../../app/Icon';
import { WorkspaceShell } from '../../components/WorkspaceShell';
import type { WorkspaceAccount } from '../../components/WorkspaceSidebar';
import { endSession } from '../../lib/auth-session';
import { useCurrentUser, useSession } from '../auth/use-session';
import { getRoadmaps } from './api';
import type { RoadmapItem } from './api';
import './workspace.css';

const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });

function RoadmapCard({ roadmap }: { roadmap: RoadmapItem }) {
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
          {roadmap.steps.slice(0, 3).map((step) => (
            <li key={step} title={step}>
              {step}
            </li>
          ))}
        </ol>
        {roadmap.steps.length > 3 && <small>+{roadmap.steps.length - 3} bước khác</small>}
      </div>
      <div className="roadmap-details">
        <div className="roadmap-title-row">
          <h2>{roadmap.title}</h2>
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
                console.log('Chi tiết roadmap:', roadmap);
                menuRef.current?.hidePopover();
              }}
            >
              Chi tiết
            </button>
            <button
              type="button"
              className="roadmap-menu-item danger"
              onClick={() => {
                console.log('Xóa roadmap:', roadmap);
                menuRef.current?.hidePopover();
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
  const session = useSession();
  const roadmapsQuery = useQuery({
    queryKey: ['private', 'roadmaps', session.version],
    queryFn: ({ signal }) => getRoadmaps(signal),
    enabled: session.token !== null,
  });
  const roadmaps = [...(roadmapsQuery.data ?? [])].sort((a, b) => {
    if (sort === 'name') return a.title.localeCompare(b.title, 'vi');
    return sort === 'oldest'
      ? a.updatedAt.localeCompare(b.updatedAt)
      : b.updatedAt.localeCompare(a.updatedAt);
  });
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
        <button className="button" type="button" disabled aria-describedby="workspace-notice">
          <Icon name="plus" /> Tạo roadmap
        </button>
      </div>
      <p id="workspace-notice" className="workspace-demo-notice">
        Tạo và lưu roadmap sắp có.
      </p>
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
          <RoadmapCard key={roadmap.title} roadmap={roadmap} />
        ))}
      </ul>
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
