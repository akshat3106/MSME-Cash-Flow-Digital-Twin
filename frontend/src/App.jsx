import { RouterProvider } from 'react-router-dom';
import router from '@/routes/router';
import { ToastProvider } from '@/components/shared/Toast';
import { AuthProvider } from '@/features/auth/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  );
}
