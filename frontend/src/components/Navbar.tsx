import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'bg-rose-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`;

  return (
    <header className="bg-white border-b">
      <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to={token ? '/' : '/'} className="font-semibold text-xl">Campus Connect</Link>
        <nav className="flex items-center gap-2">
          {token ? (
            <>
              <NavLink to="/" className={linkClass}>Matches</NavLink>
              <NavLink to="/events" className={linkClass}>Events</NavLink>
              <NavLink to="/dates" className={linkClass}>Dates</NavLink>
              <NavLink to="/messages" className={linkClass}>Messages</NavLink>
              <NavLink to="/profile" className={linkClass}>Profile</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>Login</NavLink>
              <NavLink to="/signup" className={linkClass}>Signup</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
