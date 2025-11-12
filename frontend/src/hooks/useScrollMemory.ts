import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const scrollPositions = new Map<string, number>();

function safeScroll(top: number) {
  if (typeof window === 'undefined') return;
  if (typeof window.scrollTo === 'function') {
    const fnSource = window.scrollTo.toString();
    if (!/notImplemented/.test(fnSource)) {
      window.scrollTo({ top, left: 0, behavior: 'auto' });
      return;
    }
  }
  if (typeof window.scroll === 'function') {
    const fnSource = window.scroll.toString();
    if (!/notImplemented/.test(fnSource)) {
      try {
        window.scroll(0, top);
      } catch {
        // ignore in non-browser envs
      }
    }
  }
}

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
      safeScroll(stored);
    } else if (navigationType !== 'POP') {
      safeScroll(0);
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
