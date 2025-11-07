import { clsx } from 'clsx';
import React from 'react';

export default function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-2xl bg-white/80 backdrop-blur shadow-sm', className)}>
      {children}
    </div>
  );
}
