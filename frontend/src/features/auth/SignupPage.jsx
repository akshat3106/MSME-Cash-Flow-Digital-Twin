import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, Loader2, ShieldCheck, User } from 'lucide-react';
import { useAuth, getFriendlyAuthErrorMessage } from './AuthContext';
import Button from '@/components/shared/Button';
import DisclaimerBar from '@/components/shared/DisclaimerBar';
import { CashTwinLogo } from '@/layouts/MarketingLayout';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.fullName.trim()) {
      setError('Please enter your full name as the authorized representative.');
      return;
    }
    if (!formData.businessName.trim()) {
      setError('Please enter your MSME enterprise or trade name.');
      return;
    }
    if (!formData.email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please check and re-enter.');
      return;
    }
    if (!formData.acceptTerms) {
      setError('Please accept the DPDP Act 2023 data processing terms to proceed.');
      return;
    }

    setLoading(true);
    try {
      await signup({
        email: formData.email.trim(),
        password: formData.password,
        displayName: formData.fullName.trim(),
        businessName: formData.businessName.trim(),
      });
      // Direct new registrations into the onboarding consent setup
      navigate('/onboarding');
    } catch (err) {
      console.error('Firebase signup error:', err);
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

          <div className="flex items-center gap-2 text-body-sm text-chalk-lo">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-lime hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6">
          {/* Card */}
          <div className="rounded-2xl border border-edge-dark bg-surface p-8 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="space-y-2 text-center pb-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime-16 px-3 py-1 text-xs font-semibold text-lime">
                <ShieldCheck className="h-3.5 w-3.5" /> Fast Onboarding · DPDP Ready
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-chalk-hi">
                Register Your MSME
              </h1>
              <p className="text-body-sm text-chalk-lo max-w-sm mx-auto">
                Create your secure account to generate a predictive cash-flow digital twin.
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
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="signup-name"
                    className="block text-label-xs uppercase font-semibold text-chalk-lo mb-1.5"
                  >
                    Owner / Rep Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="signup-name"
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full rounded-lg border border-edge-dark bg-surface-2 pl-10 pr-3.5 py-2.5 text-body-sm text-chalk-hi placeholder:text-chalk-lo/40 focus:border-lime focus:outline-none transition-colors"
                    />
                    <User className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
                  </div>
                </div>

                {/* Business Name */}
                <div>
                  <label
                    htmlFor="signup-business"
                    className="block text-label-xs uppercase font-semibold text-chalk-lo mb-1.5"
                  >
                    Enterprise Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="signup-business"
                      type="text"
                      required
                      value={formData.businessName}
                      onChange={(e) => handleChange('businessName', e.target.value)}
                      placeholder="e.g. Balaji Crafts"
                      className="w-full rounded-lg border border-edge-dark bg-surface-2 pl-10 pr-3.5 py-2.5 text-body-sm text-chalk-hi placeholder:text-chalk-lo/40 focus:border-lime focus:outline-none transition-colors"
                    />
                    <Building2 className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-label-xs uppercase font-semibold text-chalk-lo mb-1.5"
                >
                  Authorized Business Email
                </label>
                <div className="relative flex items-center">
                  <input
                    id="signup-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="owner@enterprise.in"
                    className="w-full rounded-lg border border-edge-dark bg-surface-2 pl-10 pr-3.5 py-2.5 text-body-sm text-chalk-hi placeholder:text-chalk-lo/40 focus:border-lime focus:outline-none transition-colors"
                  />
                  <Mail className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
                </div>
              </div>

              {/* Password */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-label-xs uppercase font-semibold text-chalk-lo mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full rounded-lg border border-edge-dark bg-surface-2 pl-10 pr-10 py-2.5 text-body-sm text-chalk-hi placeholder:text-chalk-lo/40 focus:border-lime focus:outline-none transition-colors"
                    />
                    <Lock className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 p-1 text-chalk-lo hover:text-chalk-hi focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signup-confirm"
                    className="block text-label-xs uppercase font-semibold text-chalk-lo mb-1.5"
                  >
                    Confirm Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="signup-confirm"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange('confirmPassword', e.target.value)}
                      placeholder="Repeat password"
                      className="w-full rounded-lg border border-edge-dark bg-surface-2 pl-10 pr-3.5 py-2.5 text-body-sm text-chalk-hi placeholder:text-chalk-lo/40 focus:border-lime focus:outline-none transition-colors"
                    />
                    <Lock className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Password helper hint */}
              <div className="flex items-center gap-1.5 text-[11px] text-chalk-lo">
                <CheckCircle2 className="h-3 w-3 text-lime" /> Password must contain at least 6 characters
              </div>

              {/* DPDP and Terms consent */}
              <div className="flex items-start gap-2.5 pt-2">
                <input
                  id="signup-terms"
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(e) => handleChange('acceptTerms', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-edge-dark bg-surface-2 text-lime focus:ring-lime"
                />
                <label htmlFor="signup-terms" className="text-body-sm text-chalk-lo select-none cursor-pointer leading-snug">
                  I agree to the CashTwin{' '}
                  <Link to="/terms" className="text-lime hover:underline" target="_blank">
                    Terms of Service
                  </Link>{' '}
                  and consent to privacy processing under the{' '}
                  <Link to="/privacy" className="text-lime hover:underline" target="_blank">
                    DPDP Act 2023
                  </Link>
                  .
                </label>
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-semibold">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating Account…
                    </>
                  ) : (
                    <>
                      Create MSME Account <ArrowRight className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            {/* Footer / Switch */}
            <div className="mt-6 border-t border-edge-dark pt-5 text-center text-body-sm text-chalk-lo">
              Already have an MSME account?{' '}
              <Link to="/login" className="font-semibold text-lime hover:underline">
                Sign in
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
    </div>
  );
}
