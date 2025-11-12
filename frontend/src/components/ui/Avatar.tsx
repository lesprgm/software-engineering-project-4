import { clsx } from 'clsx';
import React, { useMemo, useState } from 'react';
import { DEFAULT_AVATAR } from '../../lib/media';

type Props = {
  src?: string | null;
  alt?: string;
  name?: string;
  className?: string;
};

const GRADIENTS = [
  'from-rose-400 via-fuchsia-500 to-indigo-500',
  'from-amber-400 via-orange-400 to-rose-500',
  'from-sky-400 via-cyan-400 to-emerald-400',
  'from-purple-400 via-purple-500 to-pink-500',
];

export default function Avatar({ src, alt = 'Avatar', name, className }: Props) {
  const [errored, setErrored] = useState(false);
  const useFallback = !src || errored;
  const initials = useMemo(() => {
    if (!name) return 'CC';
    const parts = name.trim().split(/\s+/);
    const letters = parts.slice(0, 2).map((chunk) => chunk[0]?.toUpperCase() ?? '');
    return letters.join('') || 'CC';
  }, [name]);
  const gradient = useMemo(() => {
    const seed = name ? name.length : 0;
    return GRADIENTS[seed % GRADIENTS.length];
  }, [name]);

  if (useFallback) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center rounded-full bg-gradient-to-br text-white font-semibold uppercase tracking-wide',
          gradient,
          className,
        )}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src || DEFAULT_AVATAR}
      alt={alt}
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
