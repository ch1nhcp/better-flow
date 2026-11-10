import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Brand } from '../../app/Brand';
import { Icon } from '../../app/Icon';
import { endSession } from '../../lib/auth-session';
import { useCurrentUser, useSession } from '../auth/use-session';
import { demoRoadmaps } from './demo-roadmaps';
import './workspace.css';

const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });

function RoadmapCard({ roadmap }: { roadmap: (typeof demoRoadmaps)[number] }) {
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
        <h2>{roadmap.title}</h2>
        <p>{roadmap.description}</p>
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

function Workspace({ account }: { account?: { email: string; logout: () => void } }) {
  const [sort, setSort] = useState('recent');
  const roadmaps = [...demoRoadmaps].sort((a, b) => {
    if (sort === 'name') return a.title.localeCompare(b.title, 'vi');
    return sort === 'oldest'
      ? a.updatedAt.localeCompare(b.updatedAt)
      : b.updatedAt.localeCompare(a.updatedAt);
  });
  const activePath = account ? '/dashboard' : '/demo';
  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-main">
        Đến nội dung chính
      </a>
      <header className="workspace-header">
        <div className="workspace-brand">
          <Brand />
          <span>Không gian làm việc</span>
        </div>
        <p className="workspace-user-chip">
          <span aria-hidden="true" />
          {account?.email ?? 'Chế độ demo'}
        </p>
      </header>
      <div className="workspace-body">
        <aside className="workspace-sidebar" aria-label="Không gian làm việc">
          <nav aria-label="Điều hướng workspace">
            <p>KHÔNG GIAN LÀM VIỆC</p>
            <Link to={activePath} aria-current="page">
              <Icon name="map" /> Roadmap của tôi
            </Link>
            <button type="button" disabled>
              <Icon name="code" /> Playground <small>Sắp có</small>
            </button>
          </nav>
          <div className="workspace-account">
            {account ? (
              <>
                <div className="workspace-account-card">
                  <strong>{account.email.split('@')[0]}</strong>
                  <span>{account.email}</span>
                </div>
                <button type="button" onClick={account.logout}>
                  <Icon name="logout" /> Đăng xuất
                </button>
              </>
            ) : (
              <Link to="/login">
                <Icon name="logout" /> Đăng nhập
              </Link>
            )}
          </div>
        </aside>
        <main className="workspace-main" id="workspace-main" tabIndex={-1}>
          <div className="workspace-content">
            <div className="workspace-heading">
              <div>
                <h1>Roadmap của tôi</h1>
                <p>Lưu giữ và chia sẻ những lộ trình bạn xây dựng.</p>
              </div>
              <button
                className="button"
                type="button"
                disabled
                aria-describedby="workspace-demo-notice"
              >
                <Icon name="plus" /> Tạo roadmap
              </button>
            </div>
            <p id="workspace-demo-notice" className="workspace-demo-notice">
              Dữ liệu minh họa · Tạo và lưu roadmap sắp có.
            </p>
            <div className="workspace-toolbar">
              <span>{roadmaps.length} roadmap mẫu</span>
              <label>
                Sắp xếp
                <select value={sort} onChange={(event) => setSort(event.currentTarget.value)}>
                  <option value="recent">Cập nhật gần nhất</option>
                  <option value="oldest">Cũ nhất</option>
                  <option value="name">Tên A-Z</option>
                </select>
              </label>
            </div>
            <ul className="roadmap-grid" aria-label="Roadmap mẫu">
              {roadmaps.map((roadmap) => (
                <RoadmapCard key={roadmap.title} roadmap={roadmap} />
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
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

export function DemoWorkspacePage() {
  return <Workspace />;
}
