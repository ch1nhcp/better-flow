import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../../app/Brand';
import { Icon } from '../../app/Icon';
import { ApiError } from '../../lib/api';
import { endSession, getSession, startSession } from '../../lib/auth-session';
import { submitCredentials } from './api';
import type { Credentials } from './api';
import { useCurrentUser, useSession } from './use-session';
import './auth.css';

const copy = {
  login: {
    title: 'Chào mừng trở lại',
    subtitle: 'Đăng nhập để tiếp tục quản lý các lộ trình của bạn.',
    action: 'Đăng nhập',
    switchPrompt: 'Chưa có tài khoản?',
    switchLabel: 'Đăng ký ngay',
    switchPath: '/register',
  },
  register: {
    title: 'Bắt đầu với Betterflow',
    subtitle: 'Tạo tài khoản để bắt đầu với không gian làm việc của bạn.',
    action: 'Tạo tài khoản',
    switchPrompt: 'Đã có tài khoản?',
    switchLabel: 'Đăng nhập',
    switchPath: '/login',
  },
};

function AuthPreview() {
  return (
    <aside className="auth-preview" aria-label="Giới thiệu Betterflow">
      <div>
        <p className="auth-version">
          <span aria-hidden="true" />
          Betterflow v1.0
        </p>
        <h2>
          Từ ý tưởng
          <br />
          đến lộ trình rõ ràng.
        </h2>
        <p>Dựng từng bước. Kết nối tư duy thành hệ thống trực quan, dễ hiểu.</p>
      </div>
      <div className="auth-flow" aria-label="Lộ trình minh họa">
        <div className="auth-flow-step">
          <strong>
            <span>01</span> Khởi đầu
          </strong>
          <p>Xác định mục tiêu và điều cần học</p>
        </div>
        <div className="auth-flow-arrow">
          <Icon name="arrowDown" />
        </div>
        <div className="auth-flow-step active">
          <strong>
            <span>02</span> Bước tiếp theo
          </strong>
          <p>Xây dựng nền tảng tư duy vững chắc</p>
        </div>
      </div>
      <p className="auth-preview-footer">
        <Icon name="shield" /> Không gian xây dựng roadmap cho đội ngũ
      </p>
    </aside>
  );
}

export function AuthPage({ mode }: { mode: keyof typeof copy }) {
  const session = useSession();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const locationState: unknown = useLocation().state;
  const [formError, setFormError] = useState('');
  const content = copy[mode];
  const registering = mode === 'register';
  const expired =
    typeof locationState === 'object' &&
    locationState !== null &&
    'sessionExpired' in locationState &&
    locationState.sessionExpired === true;
  const mutation = useMutation({
    mutationFn: (credentials: Credentials) => submitCredentials(mode, credentials),
    gcTime: 0,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(data.get('password') ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || [...email].length > 255) {
      setFormError('Vui lòng nhập email hợp lệ.');
      return;
    }
    if (!password || (registering && [...password].length < 8)) {
      setFormError(registering ? 'Mật khẩu cần ít nhất 8 ký tự.' : 'Vui lòng nhập mật khẩu.');
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setFormError('Mật khẩu không được vượt quá 72 byte UTF-8.');
      return;
    }

    setFormError('');
    const expectedSession = getSession();
    mutation.mutate(
      { email, password },
      {
        onSuccess: ({ data: result }) => {
          if (getSession() !== expectedSession) return;
          try {
            startSession(result.token);
          } catch {
            setFormError('Không thể lưu phiên đăng nhập. Hãy kiểm tra cài đặt trình duyệt.');
            return;
          }
          void navigate('/dashboard', { replace: true });
        },
        onError: (error) => {
          setFormError(
            error instanceof ApiError
              ? error.message
              : 'Không thể kết nối máy chủ. Vui lòng thử lại.',
          );
        },
      },
    );
  }

  if (session.token && user.data) return <Navigate to="/dashboard" replace />;

  return (
    <main className="auth-screen">
      <div className="auth-frame">
        <header className="auth-brand">
          <Brand />
        </header>
        <div className="auth-card">
          <section className="auth-form-panel" aria-labelledby="auth-title">
            <div>
              <h1 id="auth-title">{content.title}</h1>
              <p className="auth-subtitle">{content.subtitle}</p>
              {session.token ? (
                user.isError ? (
                  <div className="auth-feedback">
                    <p role="alert">Chưa thể kiểm tra phiên đăng nhập.</p>
                    <div className="auth-retry">
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
                  </div>
                ) : (
                  <p className="auth-feedback" role="status">
                    Đang kiểm tra phiên đăng nhập…
                  </p>
                )
              ) : (
                <>
                  {expired && (
                    <p className="auth-feedback" role="status">
                      Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
                    </p>
                  )}
                  {formError && (
                    <p className="auth-feedback auth-error" role="alert">
                      {formError}
                    </p>
                  )}
                  <form
                    className="auth-form"
                    onSubmit={submit}
                    noValidate
                    aria-busy={mutation.isPending}
                  >
                    <div className="auth-field">
                      <div className="auth-field-label">
                        <label htmlFor="auth-email">Email</label>
                        <span aria-hidden="true">*</span>
                      </div>
                      <input
                        id="auth-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    <div className="auth-field">
                      <div className="auth-field-label">
                        <label htmlFor="auth-password">Mật khẩu</label>
                        <span aria-hidden="true">*</span>
                      </div>
                      <input
                        id="auth-password"
                        name="password"
                        type="password"
                        autoComplete={registering ? 'new-password' : 'current-password'}
                        aria-describedby="auth-password-hint"
                        required
                      />
                      <p id="auth-password-hint">
                        {registering
                          ? 'Ít nhất 8 ký tự, tối đa 72 byte UTF-8.'
                          : 'Nhập mật khẩu của tài khoản Betterflow.'}
                      </p>
                    </div>
                    <button
                      className="button auth-submit"
                      type="submit"
                      disabled={mutation.isPending}
                    >
                      {mutation.isPending ? 'Đang gửi…' : content.action}
                    </button>
                  </form>
                </>
              )}
            </div>
            <p className="auth-switch">
              {content.switchPrompt} <Link to={content.switchPath}>{content.switchLabel}</Link>
            </p>
          </section>
          <AuthPreview />
        </div>
      </div>
    </main>
  );
}
