import { Link } from 'react-router-dom';
import { Icon } from '../app/Icon';
import './workspace-shell.css';

export interface WorkspaceAccount {
  email: string;
  logout: () => void;
}

export interface WorkspaceSidebarProps {
  account?: WorkspaceAccount | undefined;
  activeNav?: 'roadmaps' | 'playground' | undefined;
}

export function WorkspaceSidebar({ account, activeNav = 'roadmaps' }: WorkspaceSidebarProps) {
  return (
    <aside className="workspace-sidebar" aria-label="Không gian làm việc">
      <nav aria-label="Điều hướng workspace">
        <p>KHÔNG GIAN LÀM VIỆC</p>
        <Link to="/roadmaps" aria-current={activeNav === 'roadmaps' ? 'page' : undefined}>
          <Icon name="map" /> Roadmap của tôi
        </Link>
        <Link to="/playground" aria-current={activeNav === 'playground' ? 'page' : undefined}>
          <Icon name="code" /> Playground
        </Link>
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
  );
}
