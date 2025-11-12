import { useEffect } from 'react';
import { useAuthStore, mapProfileToAuthUser } from '../store/auth';
import { usersService } from '../services/users';

export function useProfileBootstrap() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    if (!token) return;
    if (user?.id === token) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await usersService.getProfile();
        if (!cancelled) setUser(mapProfileToAuthUser(profile));
      } catch {
        /* ignore bootstrap failures */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id, setUser]);
}
