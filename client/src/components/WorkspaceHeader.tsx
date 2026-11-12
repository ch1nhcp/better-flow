import type { ReactNode } from 'react';
import { Brand } from '../app/Brand';
import './workspace-shell.css';

export interface WorkspaceHeaderProps {
  leading?: ReactNode | undefined;
  accountEmail?: string | undefined;
  actions?: ReactNode | undefined;
  children?: ReactNode | undefined;
}

export function WorkspaceHeader({
  leading,
  accountEmail,
  actions,
  children,
}: WorkspaceHeaderProps) {
  const slotContent =
    children === undefined ? (
      <span className="workspace-header-default">Không gian làm việc</span>
    ) : (
      children
    );

  return (
    <header className="workspace-header">
      <div className="workspace-brand">
        {leading}
        <Brand />
        {slotContent !== null && slotContent !== false && (
          <div className="workspace-header-slot">{slotContent}</div>
        )}
      </div>
      {actions ? (
        <div className="workspace-header-actions">{actions}</div>
      ) : (
        accountEmail && (
          <p className="workspace-user-chip">
            <span aria-hidden="true" />
            {accountEmail}
          </p>
        )
      )}
    </header>
  );
}
