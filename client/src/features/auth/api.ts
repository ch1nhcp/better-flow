import { apiRequest } from '../../lib/api';

export interface User {
  id: number;
  email: string;
  createdAt: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export function submitCredentials(mode: 'login' | 'register', credentials: Credentials) {
  return apiRequest<{ data: { token: string; user: User } }>(`/auth/${mode}`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function getCurrentUser(signal: AbortSignal) {
  const response = await apiRequest<{ data: { user: User } }>('/auth/me', {
    authenticated: true,
    signal,
  });
  return response.data.user;
}
