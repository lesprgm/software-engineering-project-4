import { clsx } from 'clsx';
import { ReactNode } from 'react';

type SkeletonProps = {
  className?: string;
  loaded?: boolean;
  children?: ReactNode;
  transitionKey?: string;
};

export default function Skeleton({ className, loaded, children, transitionKey }: SkeletonProps) {
  if (children) {
    return (
      <div
        className={clsx(
          'relative rounded-2xl overflow-hidden skeleton-wrapper transition-all duration-300',
          loaded ? 'skeleton-loaded' : 'skeleton-loading',
          className
        )}
        style={transitionKey ? { viewTransitionName: transitionKey } : undefined}
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
      className={clsx('skeleton-shimmer rounded-2xl', className)}
      aria-hidden="true"
      style={transitionKey ? { viewTransitionName: transitionKey } : undefined}
    />
  );
}
