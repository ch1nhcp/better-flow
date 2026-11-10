import { createBrowserRouter } from 'react-router-dom';
import { AuthPage } from '../features/auth/AuthPage';
import { DemoWorkspacePage, WorkspacePage } from '../features/workspace/WorkspacePage';
import { Layout, StartPage } from './Layout';
import { NotFoundPage, RouteErrorPage } from './pages';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <StartPage /> },
      { path: 'login', element: <AuthPage key="login" mode="login" /> },
      { path: 'register', element: <AuthPage key="register" mode="register" /> },
      { path: 'dashboard', element: <WorkspacePage /> },
      { path: 'demo', element: <DemoWorkspacePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
