import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { LogoMark } from '@/layouts/AppShell';

export default function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-void px-4 text-center">
        <LogoMark className="h-10 w-10 animate-pulse text-lime" />
        <div className="flex items-center gap-2.5 text-chalk-hi">
          <Loader2 className="h-4 w-4 animate-spin text-lime" />
          <span className="font-display text-sm font-semibold tracking-wide">
            Verifying CashTwin session…
          </span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
}
