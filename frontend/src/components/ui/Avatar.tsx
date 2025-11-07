import React, { useState } from 'react';
import { DEFAULT_AVATAR } from '../../lib/media';

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
};

export default function Avatar({ src, alt = 'Avatar', className }: Props) {
  const [errored, setErrored] = useState(false);
  const finalSrc = !src || errored ? DEFAULT_AVATAR : src;
  return (
    <img
      src={finalSrc}
      alt={alt}
      onError={() => setErrored(true)}
      className={className}
    />
  );
}

