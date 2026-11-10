import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';
import { subscribeSession } from './auth-session';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
  },
});

const unsubscribe = subscribeSession(() => {
  const privateQueries = { queryKey: ['private'] };
  void queryClient.cancelQueries(privateQueries, { revert: false });
  queryClient.removeQueries(privateQueries);
});
if (import.meta.hot) import.meta.hot.dispose(unsubscribe);
