const tokenKey = 'betterflow.authToken';

interface Session {
  token: string | null;
  version: number;
  endReason: 'expired' | 'logout' | null;
}

function readToken() {
  try {
    return localStorage.getItem(tokenKey);
  } catch {
    return null;
  }
}

let session: Session = { token: readToken(), version: 0, endReason: null };
const listeners = new Set<() => void>();

export const getSession = () => session;

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(token: string | null, endReason: Session['endReason']) {
  session = { token, version: session.version + 1, endReason };
  for (const listener of listeners) listener();
}

export function startSession(token: string) {
  localStorage.setItem(tokenKey, token);
  publish(token, null);
}

export function endSession(expected: Session, reason: 'expired' | 'logout') {
  if (session !== expected || !session.token) return;
  const storedToken = readToken();
  if (storedToken && storedToken !== session.token) {
    publish(storedToken, null);
    return;
  }
  try {
    localStorage.removeItem(tokenKey);
  } catch {
    // End the in-memory session even when browser storage is unavailable.
  }
  publish(null, reason);
}

// exp is used for scheduling only. The API verifies the signature.
export function tokenExpiresAt(token: string): number | undefined {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return undefined;
    const payload: unknown = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload !== 'object' || payload === null || !('exp' in payload)) return undefined;
    if (typeof payload.exp !== 'number' || !Number.isSafeInteger(payload.exp * 1000))
      return undefined;
    return payload.exp * 1000;
  } catch {
    return undefined;
  }
}

function syncStorage(event: StorageEvent) {
  if (event.key !== tokenKey && event.key !== null) return;
  const token = readToken();
  if (token !== session.token) publish(token, token ? null : 'logout');
}

window.addEventListener('storage', syncStorage);
if (import.meta.hot)
  import.meta.hot.dispose(() => window.removeEventListener('storage', syncStorage));
