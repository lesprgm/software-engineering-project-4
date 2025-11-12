import { clsx } from 'clsx';
import { ReactNode, useEffect } from 'react';

type SkeletonProps = {
  className?: string;
  loaded?: boolean;
  children?: ReactNode;
  transitionKey?: string;
};

const REGISTERED_TRANSITIONS = new Set<string>();

function useViewTransitionClass(key?: string) {
  const sanitized = key?.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  useEffect(() => {
    if (!sanitized || typeof document === 'undefined' || REGISTERED_TRANSITIONS.has(sanitized)) {
      return;
    }
    const style = document.createElement('style');
    style.dataset.vtStyle = sanitized;
    style.textContent = `.vt-${sanitized}{view-transition-name:${sanitized};}`;
    document.head.appendChild(style);
    REGISTERED_TRANSITIONS.add(sanitized);
  }, [sanitized]);
  return sanitized ? `vt-${sanitized}` : undefined;
}

export default function Skeleton({ className, loaded, children, transitionKey }: SkeletonProps) {
  const transitionClass = useViewTransitionClass(transitionKey);
  if (children) {
    return (
      <div
        className={clsx(
          'relative rounded-2xl overflow-hidden skeleton-wrapper transition-all duration-300',
          loaded ? 'skeleton-loaded' : 'skeleton-loading',
          transitionClass,
          className
        )}
      >
        <div className={clsx('absolute inset-0 skeleton-shimmer transition-opacity duration-300', loaded && 'opacity-0 scale-95')} aria-hidden />
        <div className={clsx('relative transition-opacity duration-300', loaded ? 'opacity-100 delay-75' : 'opacity-0')}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('skeleton-shimmer rounded-2xl', transitionClass, className)}
      aria-hidden="true"
    />
  );
}
