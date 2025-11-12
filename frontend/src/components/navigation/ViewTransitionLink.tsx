import React from 'react';
import { Link, LinkProps, NavLink, NavLinkProps, useNavigate } from 'react-router-dom';
import { runWithViewTransition } from '../../lib/viewTransitions';

function shouldHandleEvent(event: React.MouseEvent<HTMLAnchorElement>) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    (!event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey)
  );
}

export function ViewTransitionLink({ onClick, to, replace, state, target, ...rest }: LinkProps) {
  const navigate = useNavigate();
  return (
    <Link
      to={to}
      replace={replace}
      state={state}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (!shouldHandleEvent(event) || (target && target !== '_self')) return;
        event.preventDefault();
        runWithViewTransition(() => navigate(to, { replace, state }));
      }}
      {...rest}
    />
  );
}

export function ViewTransitionNavLink({ onClick, to, replace, state, target, ...rest }: NavLinkProps) {
  const navigate = useNavigate();
  return (
    <NavLink
      to={to}
      replace={replace}
      state={state}
      target={target}
      onClick={(event) => {
        onClick?.(event);
        if (!shouldHandleEvent(event) || (target && target !== '_self')) return;
        event.preventDefault();
        runWithViewTransition(() => navigate(to, { replace, state }));
      }}
      {...rest}
    />
  );
}
