import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, X } from 'lucide-react';
import { useAuth, getFriendlyAuthErrorMessage } from './AuthContext';
import Button from '@/components/shared/Button';

export default function ForgotPasswordModal({ open, onOpenChange, initialEmail = '' }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSubmitted(true);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSubmitted(false);
    onOpenChange(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-xl border border-edge-dark bg-surface p-6 shadow-2xl z-10 animate-fade-in text-chalk-hi">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-chalk-lo hover:bg-surface-2 hover:text-chalk-hi transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-edge-dark pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-16 text-lime">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 id="forgot-password-title" className="font-display text-base font-semibold text-chalk-hi">
              Reset your password
            </h2>
            <p className="text-body-sm text-chalk-lo">
              We will send a secure recovery link to your inbox
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-lime/30 bg-lime-16 p-4 text-lime">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-body-sm">
                <p className="font-semibold text-chalk-hi">Reset link dispatched</p>
                <p className="mt-1 text-chalk-lo">
                  If an account is associated with <span className="text-lime font-mono">{email}</span>, you will receive an email with instructions to reset your password shortly.
                </p>
              </div>
            </div>

            <Button onClick={handleClose} className="w-full">
              Back to Sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-risk/30 bg-risk-16 p-3 text-body-sm text-risk"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="reset-email" className="block text-label-xs uppercase font-semibold text-chalk-lo mb-1.5">
                Registered Email Address
              </label>
              <div className="relative flex items-center">
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@enterprise.in"
                  className="w-full rounded-lg border border-edge-dark bg-surface-2 pl-10 pr-3.5 py-2.5 text-body-sm text-chalk-hi placeholder:text-chalk-lo/50 focus:border-lime focus:outline-none transition-colors"
                />
                <Mail className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Sending link…
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
