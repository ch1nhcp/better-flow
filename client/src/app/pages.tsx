import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';

export function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="welcome-title">
        <p className="eyebrow">
          <span aria-hidden="true">&gt;_</span> BETTERFLOW / FOUNDATION
        </p>
        <h1 className="display-heading" id="welcome-title">
          Một khởi đầu
          <br />
          cho cả đội.
        </h1>
        <p className="intro">
          Codebase nền tảng đã sẵn sàng. Cùng xây dựng công cụ roadmap học tập và onboarding cho đội
          ngũ.
        </p>
        <a className="button" href="#foundation">
          Xem cấu trúc <span aria-hidden="true">↓</span>
        </a>
      </section>
      <div className="section-heading" id="foundation">
        <h2>Cấu trúc codebase</h2>
        <span className="section-meta">03 MODULES</span>
      </div>
      <section className="stack-grid" aria-label="Cấu trúc codebase">
        <article>
          <span className="number">01</span>
          <h3>Frontend</h3>
          <p>React + Vite + TypeScript</p>
          <p>React Router · TanStack Query</p>
          <code>client/src/</code>
        </article>
        <article>
          <span className="number">02</span>
          <h3>Backend</h3>
          <p>Express + TypeScript</p>
          <p>API health check · Error handling</p>
          <code>server/src/</code>
        </article>
        <article>
          <span className="number">03</span>
          <h3>Database</h3>
          <p>PostgreSQL 18 + pg</p>
          <p>Connection pool · SQL migrations</p>
          <code>server/db/</code>
        </article>
      </section>
      <aside className="note">
        <strong>Bước tiếp theo</strong>
        <p>
          Đọc README để chạy local và thống nhất các contract trong <code>docs/contracts.md</code>.
          Các tính năng Phase 1 sẽ được triển khai trong từng task riêng.
        </p>
      </aside>
    </>
  );
}

export function NotFoundPage() {
  return (
    <section className="empty-state">
      <p className="eyebrow">404 / KHÔNG TÌM THẤY</p>
      <h1>Trang này chưa tồn tại.</h1>
      <Link className="button" to="/">
        Về trang chủ
      </Link>
    </section>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  return (
    <main className="empty-state">
      <h1>Không thể mở trang.</h1>
      <p>{isRouteErrorResponse(error) ? `Lỗi ${error.status}` : 'Vui lòng tải lại trang.'}</p>
      <a className="button" href="/">
        Về trang chủ
      </a>
    </main>
  );
}
