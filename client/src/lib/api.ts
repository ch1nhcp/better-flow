import { endSession, getSession, tokenExpiresAt } from './auth-session';

const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isErrorResponse(value: unknown): value is { error: { code: string; message: string } } {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const error = value.error;
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

interface ApiOptions extends RequestInit {
  authenticated?: boolean;
}

export async function apiResponse(path: string, options: ApiOptions = {}): Promise<Response> {
  const { authenticated, ...request } = options;
  const session = getSession();
  const headers = new Headers(request.headers);
  if (authenticated) {
    if (!session.token || (tokenExpiresAt(session.token) ?? 0) <= Date.now()) {
      endSession(session, 'expired');
      throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn.');
    }
    headers.set('Authorization', `Bearer ${session.token}`);
  }
  if (request.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBase}${path}`, { ...request, headers });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error = isErrorResponse(payload) ? payload.error : undefined;
    if (
      authenticated &&
      response.status === 401 &&
      error?.code === 'UNAUTHORIZED' &&
      !request.signal?.aborted
    ) {
      endSession(session, 'expired');
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'Không thể kết nối với máy chủ.',
    );
  }
  return response;
}

export async function apiRequest<T>(path: string, options?: ApiOptions): Promise<T> {
  const response = await apiResponse(path, options);
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  // Each feature validates or types its response at the API boundary.
  return payload as T;
}
