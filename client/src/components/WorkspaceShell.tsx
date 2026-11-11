import type { ReactNode } from 'react';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import type { WorkspaceAccount } from './WorkspaceSidebar';
import './workspace-shell.css';

export interface WorkspaceShellProps {
  account?: WorkspaceAccount | undefined;
  headerContent?: ReactNode | undefined;
  activeNav?: 'roadmaps' | 'playground' | undefined;
  children: ReactNode;
}

export function WorkspaceShell({
  account,
  headerContent,
  activeNav = 'roadmaps',
  children,
}: WorkspaceShellProps) {
  return (
    <div className="workspace">
      <a className="skip-link" href="#workspace-main">
        Đến nội dung chính
      </a>
      <WorkspaceHeader accountEmail={account?.email}>{headerContent}</WorkspaceHeader>
      <div className="workspace-body">
        <WorkspaceSidebar account={account} activeNav={activeNav} />
        <main className="workspace-main" id="workspace-main" tabIndex={-1}>
          <div className="workspace-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
