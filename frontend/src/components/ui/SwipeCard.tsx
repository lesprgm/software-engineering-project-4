import React, { useCallback, useImperativeHandle, useRef, useState, forwardRef } from 'react';
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
    setDx(nx);
    setDy(ny);
  };

  const cancel = useCallback(() => {
    setDragging(false);
    setDx(0);
    setDy(0);
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
      window.setTimeout(() => {
        onSwipe?.('left');
        setLeaving(null);
        setDx(0); setDy(0);
      }, 260);
    },
    swipeRight: () => {
      if (disabled || leaving) return;
      setLeaving('right');
      window.setTimeout(() => {
        onSwipe?.('right');
        setLeaving(null);
        setDx(0); setDy(0);
      }, 260);
    },
  }));

  const rotate = leaving ? (leaving === 'right' ? 15 : -15) : Math.max(-15, Math.min(15, dx / 10));
  const style = leaving
    ? { transform: `translate(${leaving === 'right' ? 500 : -500}px, 0px) rotate(${rotate}deg)`, transition: 'transform 250ms ease' as const }
    : dragging
    ? { transform: `translate(${dx}px, ${dy}px) rotate(${rotate}deg)` }
    : dx || dy
    ? { transform: 'translate(0, 0) rotate(0deg)', transition: 'transform 150ms ease' as const }
    : undefined;

  const likeOpacity = leaving === 'right' ? 1 : Math.min(1, Math.max(0, (dx - 20) / threshold));
  const nopeOpacity = leaving === 'left' ? 1 : Math.min(1, Math.max(0, (-dx - 20) / threshold));

  return (
    <div
      className={clsx('relative touch-pan-y select-none', className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={cancel}
      role="group"
      aria-roledescription="swipeable card"
    >
      <div style={style} className="will-change-transform">
        {children}
      </div>
      {/* Overlays */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-start justify-start p-4"
        style={{ opacity: likeOpacity }}
      >
        <span className="px-3 py-1 rounded-md border-2 border-green-600 text-green-700 font-bold bg-white/80">LIKE</span>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-start justify-end p-4"
        style={{ opacity: nopeOpacity }}
      >
        <span className="px-3 py-1 rounded-md border-2 border-red-600 text-red-700 font-bold bg-white/80">NOPE</span>
      </div>
    </div>
  );
});

export default SwipeCard;
