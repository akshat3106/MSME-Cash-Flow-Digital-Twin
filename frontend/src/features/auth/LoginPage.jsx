import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth, getFriendlyAuthErrorMessage } from './AuthContext';
import Button from '@/components/shared/Button';
import DisclaimerBar from '@/components/shared/DisclaimerBar';
import ForgotPasswordModal from './ForgotPasswordModal';
import { CashTwinLogo } from '@/layouts/MarketingLayout';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  // Preserve redirect destination or default to app dashboard
  const from = location.state?.from?.pathname || '/app';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      console.error('Firebase login error:', err);
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-void text-chalk-hi selection:bg-lime/20 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-edge-dark px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <CashTwinLogo className="h-6 w-6 transition-transform group-hover:scale-105" />
            <span className="font-display text-lg font-bold tracking-tight text-chalk-hi">
              CashTwin
            </span>
          </Link>

          <Link
            to="/signup"
            className="text-body-sm text-chalk-lo hover:text-lime transition-colors inline-flex items-center gap-1.5"
          >
            Create account <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Card */}
          <div className="rounded-2xl border border-edge-dark bg-surface p-8 shadow-2xl backdrop-blur-xl">
            {/* Header Badge & Title */}
            <div className="space-y-2 text-center pb-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime-16 px-3 py-1 text-xs font-semibold text-lime">
                <ShieldCheck className="h-3.5 w-3.5" /> MSME Enterprise Portal
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-hi">
                Sign in to CashTwin
              </h1>
              <p className="text-body-sm text-chalk-lo">
                Access your real-time cash flow digital twin and predictive simulations
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-lg border border-risk/30 bg-risk-16 p-3 text-body-sm text-risk"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-label-xs uppercase font-semibold text-chalk-lo mb-1.5"
                >
                  Authorized Email
                </label>
                <div className="relative flex items-center">
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@enterprise.in"
                    className="w-full rounded-lg border border-edge-dark bg-surface-2 pl-10 pr-3.5 py-2.5 text-body-sm text-chalk-hi placeholder:text-chalk-lo/40 focus:border-lime focus:outline-none transition-colors"
                  />
                  <Mail className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-label-xs uppercase font-semibold text-chalk-lo"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordOpen(true)}
                    className="text-[12px] font-medium text-lime hover:underline focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-edge-dark bg-surface-2 pl-10 pr-10 py-2.5 text-body-sm text-chalk-hi placeholder:text-chalk-lo/40 focus:border-lime focus:outline-none transition-colors"
                  />
                  <Lock className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 p-1 text-chalk-lo hover:text-chalk-hi focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-edge-dark bg-surface-2 text-lime focus:ring-lime"
                />
                <label htmlFor="remember-me" className="text-body-sm text-chalk-lo cursor-pointer select-none">
                  Keep me signed in on this device
                </label>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-semibold">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Authenticating…
                    </>
                  ) : (
                    <>
                      Sign in to Dashboard <ArrowRight className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Footer / Switch */}
            <div className="mt-6 border-t border-edge-dark pt-5 text-center text-body-sm text-chalk-lo">
              Don&apos;t have an account yet?{' '}
              <Link to="/signup" className="font-semibold text-lime hover:underline">
                Create MSME account
              </Link>
            </div>
          </div>

          <div className="text-center">
            <Link to="/" className="text-xs text-chalk-lo hover:text-chalk-hi transition-colors">
              ← Back to main website
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-edge-dark px-6 py-6 text-center">
        <div className="mx-auto max-w-4xl">
          <DisclaimerBar />
        </div>
      </footer>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
        initialEmail={email}
      />
    </div>
  );
}
