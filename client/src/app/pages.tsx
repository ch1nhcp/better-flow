import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="route-message">
      <p>404 / KHÔNG TÌM THẤY</p>
      <h1>Trang này chưa tồn tại.</h1>
      <Link className="button" to="/">
        Về trang chủ
      </Link>
    </main>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  return (
    <main className="route-message">
      <h1>Không thể mở trang.</h1>
      <p>{isRouteErrorResponse(error) ? `Lỗi ${error.status}` : 'Vui lòng tải lại trang.'}</p>
      <a className="button" href="/">
        Về trang chủ
      </a>
    </main>
  );
}
