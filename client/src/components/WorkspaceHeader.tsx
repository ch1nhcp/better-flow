import type { ReactNode } from 'react';
import { Brand } from '../app/Brand';
import './workspace-shell.css';

export interface WorkspaceHeaderProps {
  accountEmail?: string | undefined;
  children?: ReactNode | undefined;
}

export function WorkspaceHeader({ accountEmail, children }: WorkspaceHeaderProps) {
  const slotContent =
    children === undefined ? (
      <span className="workspace-header-default">Không gian làm việc</span>
    ) : (
      children
    );

  return (
    <header className="workspace-header">
      <div className="workspace-brand">
        <Brand />
        {slotContent !== null && slotContent !== false && (
          <div className="workspace-header-slot">{slotContent}</div>
        )}
      </div>
      {accountEmail && (
        <p className="workspace-user-chip">
          <span aria-hidden="true" />
          {accountEmail}
        </p>
      )}
    </header>
  );
}
