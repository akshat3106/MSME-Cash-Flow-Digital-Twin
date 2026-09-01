import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function PublicOnlyRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (currentUser) {
    const from = location.state?.from?.pathname || '/app';
    return <Navigate to={from} replace />;
  }

  return children ? children : <Outlet />;
}
