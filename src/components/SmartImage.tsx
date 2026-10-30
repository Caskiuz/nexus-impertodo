'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';

export default function SmartImage({
  src,
  fallback,
  alt,
  className,
  width,
  height,
  style
}: {
  src: string;
  fallback: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
}) {
  const [current, setCurrent] = useState(src);
  return (
    <img
      src={current}
      alt={alt}
      className={className}
      width={width}
      height={height}
      style={style}
      loading="lazy"
      onError={() => {
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}
