import { NavigateOptions, To, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { runWithViewTransition } from '../lib/viewTransitions';

type NavigateFn = (to: To | number, options?: NavigateOptions) => void;

export function useViewNavigate(): NavigateFn {
  const navigate = useNavigate();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        runWithViewTransition(() => navigate(to));
        return;
      }
      runWithViewTransition(() => navigate(to, options));
    },
    [navigate]
  );
}
