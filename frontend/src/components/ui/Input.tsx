import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string };

const Input = forwardRef<HTMLInputElement, Props>(({ className, label, error, id, ...rest }, ref) => {
  const inputId = id || rest.name || label || 'input';
  return (
    <label className="block text-sm">
      {label && (
        <span className="mb-1 block text-gray-700" htmlFor={inputId}>{label}</span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          'w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-rose-500',
          error ? 'border-red-500' : 'border-gray-300',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...rest}
      />
      {error && <span id={`${inputId}-error`} className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
});

export default Input;

