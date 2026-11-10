import { Navigate, Outlet } from 'react-router-dom';
import { useSession, useSessionLifecycle } from '../features/auth/use-session';

export function Layout() {
  useSessionLifecycle();
  return (
    <div className="product-theme">
      <Outlet />
    </div>
  );
}

export function StartPage() {
  const session = useSession();
  return <Navigate to={session.token ? '/dashboard' : '/login'} replace />;
}
