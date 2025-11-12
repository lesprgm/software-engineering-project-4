import { useAuthStore } from '../store/auth';
import NotificationBell from './NotificationBell';
import { ViewTransitionLink, ViewTransitionNavLink } from './navigation/ViewTransitionLink';

export default function Navbar() {
  const token = useAuthStore((s) => s.token);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-rose-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`;

  return (
    <header className="bg-white border-b">
      <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <ViewTransitionLink to={token ? '/' : '/'} className="font-semibold text-xl">
          Campus Connect
        </ViewTransitionLink>
        <nav className="flex items-center gap-2">
          {token ? (
            <>
              <ViewTransitionNavLink to="/matches" className={linkClass}>
                Matches
              </ViewTransitionNavLink>
              <ViewTransitionNavLink to="/groups" className={linkClass}>
                Groups
              </ViewTransitionNavLink>
              <ViewTransitionNavLink to="/events" className={linkClass}>
                Events
              </ViewTransitionNavLink>
              <ViewTransitionNavLink to="/places" className={linkClass}>
                Places
              </ViewTransitionNavLink>
              <ViewTransitionNavLink to="/dates" className={linkClass}>
                Dates
              </ViewTransitionNavLink>
              <ViewTransitionNavLink to="/messages" className={linkClass}>
                Messages
              </ViewTransitionNavLink>
              <ViewTransitionNavLink to="/profile" className={linkClass}>
                Profile
              </ViewTransitionNavLink>
              <NotificationBell />
            </>
          ) : (
            <>
              <ViewTransitionNavLink to="/login" className={linkClass}>
                Login
              </ViewTransitionNavLink>
              <ViewTransitionNavLink to="/signup" className={linkClass}>
                Signup
              </ViewTransitionNavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
