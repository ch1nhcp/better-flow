import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endSession, getSession, subscribeSession, tokenExpiresAt } from '../../lib/auth-session';
import { getCurrentUser } from './api';

export function useSession() {
  return useSyncExternalStore(subscribeSession, getSession);
}

export function useCurrentUser() {
  const session = useSession();
  return useQuery({
    queryKey: ['private', 'auth', 'me', session.version],
    queryFn: ({ signal }) => getCurrentUser(signal),
    enabled: session.token !== null,
  });
}

export function useSessionLifecycle() {
  const session = useSession();
  const navigate = useNavigate();
  const handledVersion = useRef<number | null>(null);

  useEffect(() => {
    if (!session.token) {
      if (session.endReason && handledVersion.current !== session.version) {
        handledVersion.current = session.version;
        void navigate('/login', {
          replace: true,
          state: { sessionExpired: session.endReason === 'expired' },
        });
      }
      return;
    }

    const expiresAt = tokenExpiresAt(session.token) ?? 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function checkExpiry() {
      clearTimeout(timer);
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) endSession(session, 'expired');
      else timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647));
    }

    checkExpiry();
    window.addEventListener('focus', checkExpiry);
    document.addEventListener('visibilitychange', checkExpiry);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', checkExpiry);
      document.removeEventListener('visibilitychange', checkExpiry);
    };
  }, [session, navigate]);
}
