import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from 'react-router-dom';
import { getHealth } from '../features/system/api';

export function Layout() {
  const health = useQuery({ queryKey: ['system', 'health'], queryFn: getHealth });

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      <header className="header">
        <Link className="brand" to="/" aria-label="Betterflow trang chủ">
          <span className="brand-mark" aria-hidden="true">
            [b]
          </span>
          betterflow
        </Link>
        <span className="badge">
          PHASE 01 <span aria-hidden="true">/</span> STARTER
        </span>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <span>Nền tảng cho roadmap học tập & onboarding.</span>
        <span className="system-status" role="status">
          <span
            className={`status-dot ${health.isSuccess ? 'is-online' : ''}`}
            aria-hidden="true"
          />
          {health.isPending
            ? 'Đang kết nối API...'
            : health.isSuccess
              ? 'API đã kết nối'
              : 'Chưa kết nối API'}
        </span>
      </footer>
    </div>
  );
}
