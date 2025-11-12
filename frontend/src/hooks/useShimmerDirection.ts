import { useEffect } from 'react';

export function useShimmerDirection() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    let lastY = window.scrollY;
    let raf = 0;

    const setDirection = (nextY: number) => {
      const dir = nextY < lastY ? 'up' : 'down';
      document.documentElement.dataset.scrollDir = dir;
      lastY = nextY;
    };

    setDirection(window.scrollY);

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        setDirection(window.scrollY);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
}
