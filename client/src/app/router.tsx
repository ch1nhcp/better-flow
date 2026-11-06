import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { HomePage, NotFoundPage, RouteErrorPage } from './pages';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
