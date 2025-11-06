import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import Matches from './pages/Matches';
import Events from './pages/Events';
import Messages from './pages/Messages';
import Dates from './pages/Dates';
import Choose from './pages/Choose';
import { useAuthStore } from './store/auth';
import { ToastProvider } from './components/ToastProvider';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="container mx-auto max-w-6xl px-4 py-6 flex-1">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Choose /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
            <Route path="/dates" element={<ProtectedRoute><Dates /></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

            <Route path="*" element={<div className="text-gray-600">Page not found</div>} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
