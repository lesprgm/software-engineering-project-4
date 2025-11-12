import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigationStore } from '../store/navigation';

type Options = {
  parent?: string | null;
};

export function useBreadcrumb(label: string, options?: Options) {
  const location = useLocation();
  const register = useNavigationStore((state) => state.register);
  const setActive = useNavigationStore((state) => state.setActivePath);
  const pathKey = location.pathname;

  useEffect(() => {
    register({ path: pathKey, label, parent: options?.parent });
  }, [register, label, pathKey, options?.parent]);

  useEffect(() => {
    setActive(pathKey);
  }, [setActive, pathKey]);
}
