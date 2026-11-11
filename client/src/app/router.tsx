import { createBrowserRouter } from 'react-router-dom';
import { AuthPage } from '../features/auth/AuthPage';
import { RoadmapEditorPage } from '../features/roadmap-editor/RoadmapEditorPage';
import { WorkspacePage } from '../features/workspace/WorkspacePage';
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
      { path: 'roadmaps', element: <WorkspacePage /> },
      { path: 'roadmaps/new', element: <RoadmapEditorPage /> },
      { path: 'roadmaps/:id', element: <RoadmapEditorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
