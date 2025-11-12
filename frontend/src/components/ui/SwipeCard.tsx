import React, { useCallback, useImperativeHandle, useRef, useState, forwardRef, CSSProperties } from 'react';
import { clsx } from 'clsx';

type Props = {
  className?: string;
  onSwipe?: (dir: 'left' | 'right') => void;
  disabled?: boolean;
  children: React.ReactNode;
};

export type SwipeCardHandle = {
  swipeLeft: () => void;
  swipeRight: () => void;
};

const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { className, onSwipe, disabled, children }: Props,
  ref
) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<null | 'left' | 'right'>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const velocityRef = useRef(0);
  const lastMove = useRef<{ x: number; time: number } | null>(null);
  const threshold = 120;

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || leaving) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || disabled || leaving) return;
    const nx = e.clientX - start.current.x;
    const ny = e.clientY - start.current.y;
    const now = performance.now();
    if (lastMove.current) {
      const dt = Math.max(8, now - lastMove.current.time);
      velocityRef.current = (nx - lastMove.current.x) / dt;
    }
    lastMove.current = { x: nx, time: now };
    setDx(nx);
    setDy(ny);
  };

  const cancel = useCallback(() => {
    setDragging(false);
    setDx(0);
    setDy(0);
    velocityRef.current = 0;
    lastMove.current = null;
    start.current = null;
  }, []);

  const onPointerUp = () => {
    if (disabled || leaving) return cancel();
    if (Math.abs(dx) > threshold && Math.abs(dy) < 140) {
      const dir = dx > 0 ? 'right' : 'left';
      onSwipe?.(dir);
    }
    cancel();
  };

  // Imperative swipe trigger for buttons/keys
  useImperativeHandle(ref, () => ({
    swipeLeft: () => {
      if (disabled || leaving) return;
      setLeaving('left');
      velocityRef.current = -2;
      window.setTimeout(() => {
        onSwipe?.('left');
        setLeaving(null);
        setDx(0); setDy(0);
        velocityRef.current = 0;
      }, 260);
    },
    swipeRight: () => {
      if (disabled || leaving) return;
      setLeaving('right');
      velocityRef.current = 2;
      window.setTimeout(() => {
        onSwipe?.('right');
        setLeaving(null);
        setDx(0); setDy(0);
        velocityRef.current = 0;
      }, 260);
    },
  }));

  const velocityTilt = Math.max(-8, Math.min(8, velocityRef.current * 120));
  const rotate = leaving
    ? leaving === 'right'
      ? 18
      : -18
    : Math.max(-18, Math.min(18, dx / 12 + velocityTilt));
  const translateX = leaving ? (leaving === 'right' ? 500 : -500) : dx;
  const translateY = leaving ? 0 : dy;
  const transitionValue =
    leaving ? 'transform 250ms ease' : !dragging && (dx || dy) ? 'transform 150ms ease' : 'none';

  type MotionVars = CSSProperties & {
    '--card-translate-x'?: string;
    '--card-translate-y'?: string;
    '--card-rotate'?: string;
    '--card-transition'?: string;
  };
  type OverlayVars = CSSProperties & {
    '--card-like-opacity'?: string;
    '--card-nope-opacity'?: string;
  };

  const motionVars: MotionVars = {
    '--card-translate-x': `${translateX}px`,
    '--card-translate-y': `${translateY}px`,
    '--card-rotate': `${rotate}deg`,
    '--card-transition': transitionValue,
  };

  const likeOpacity = leaving === 'right' ? 1 : Math.min(1, Math.max(0, (dx - 20) / threshold));
  const nopeOpacity = leaving === 'left' ? 1 : Math.min(1, Math.max(0, (-dx - 20) / threshold));
  const overlayVars: OverlayVars = {
    '--card-like-opacity': likeOpacity.toString(),
    '--card-nope-opacity': nopeOpacity.toString(),
  };

  return (
    <div
      className={clsx('relative touch-pan-y select-none swipe-card-container', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancel}
      role="group"
      aria-roledescription="swipeable card"
      style={overlayVars}
    >
      <div className="swipe-card-motion will-change-transform relative rounded-2xl overflow-hidden" style={motionVars}>
        {children}
        <div aria-hidden className="pointer-events-none absolute inset-0 swipe-like-glow" />
        <div aria-hidden className="pointer-events-none absolute inset-0 swipe-nope-glow" />
      </div>
      {/* Overlays */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-start justify-start p-4 swipe-like-stamp"
      >
        <span className="px-3 py-1 rounded-md border-2 border-green-600 text-green-700 font-bold bg-white/80">LIKE</span>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-start justify-end p-4 swipe-nope-stamp"
      >
        <span className="px-3 py-1 rounded-md border-2 border-red-600 text-red-700 font-bold bg-white/80">NOPE</span>
      </div>
    </div>
  );
});

export default SwipeCard;
