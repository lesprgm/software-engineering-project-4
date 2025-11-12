import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const scrollPositions = new Map<string, number>();

export function useScrollMemory() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = 'auto';
    };
  }, []);

  useLayoutEffect(() => {
    const key = location.key || location.pathname;
    const stored = scrollPositions.get(key);
    if (stored != null) {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: stored, left: 0, behavior: 'auto' });
      }
    } else if (navigationType !== 'POP') {
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    }
  }, [location, navigationType]);

  useEffect(() => {
    const key = location.key || location.pathname;
    return () => {
      if (typeof window !== 'undefined') {
        scrollPositions.set(key, window.scrollY);
      }
    };
  }, [location]);
}
