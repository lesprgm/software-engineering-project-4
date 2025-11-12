import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import OnboardingWizard from './components/OnboardingWizard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import Matches from './pages/Matches';
import Events from './pages/Events';
import Messages from './pages/Messages';
import Dates from './pages/Dates';
import Choose from './pages/Choose';
import Places from './pages/Places';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import MatchProfile from './pages/MatchProfile';
import { useAuthStore } from './store/auth';
import { ToastProvider } from './components/ToastProvider';
import Breadcrumbs from './components/navigation/Breadcrumbs';
import { useScrollMemory } from './hooks/useScrollMemory';
import { useNavigationStore } from './store/navigation';
import { useShimmerDirection } from './hooks/useShimmerDirection';
import { useProfileBootstrap } from './hooks/useProfileBootstrap';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  useScrollMemory();
  useShimmerDirection();
  useProfileBootstrap();
  const registerBreadcrumb = useNavigationStore((state) => state.register);

  useEffect(() => {
    registerBreadcrumb({ path: '/', label: 'Home', parent: null });
  }, [registerBreadcrumb]);

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <OnboardingWizard />
        <main className="container mx-auto max-w-6xl px-4 py-6 flex-1 view-transition-surface" data-route={location.pathname}>
          <Breadcrumbs />
          <Routes>
            <Route path="/" element={<ProtectedRoute><Choose /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
            <Route path="/matches/:matchId" element={<ProtectedRoute><MatchProfile /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
            <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
            <Route path="/dates" element={<ProtectedRoute><Dates /></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/places" element={<ProtectedRoute><Places /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />

            <Route path="*" element={<div className="text-gray-600">Page not found</div>} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
