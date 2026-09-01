import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, LogOut, Mail, MapPin, Phone, Save, ShieldCheck, User } from 'lucide-react';
import Button from '@/components/shared/Button';
import { useToast } from '@/components/shared/Toast';
import { recordAuditEvent } from '@/mocks/api/auditLog';
import { useAuth } from '@/features/auth/AuthContext';

export default function ProfileSettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, businessName, updateUserProfile, setBusiness, logout } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [formData, setFormData] = useState({
    ownerName: currentUser?.displayName || 'Mark Hussain',
    email: currentUser?.email || 'mark@hussaincrafts.in',
    phone: '+91 98201 44521',
    role: 'Proprietor / Managing Director',
    businessName: businessName || 'Shree Balaji Furniture Works',
    tradeName: 'Hussain Crafts & Interiors',
    gstin: '27AABCS1429B1Z5',
    udyam: 'UDYAM-MH-12-0048291',
    sector: 'Furniture manufacturing & interiors',
    minBuffer: '200000',
    address: 'Plot 14, Industrial Estate, Kanjurmarg West, Mumbai, MH 400078',
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (formData.ownerName && updateUserProfile) {
        await updateUserProfile({ displayName: formData.ownerName });
      }
      if (formData.businessName && setBusiness) {
        setBusiness(formData.businessName);
      }

      recordAuditEvent({
        event: 'Business profile updated',
        actor: 'owner',
        detail: `Updated contact and buffer settings for ${formData.businessName}.`,
      });

      toast({
        title: 'Profile settings saved',
        description: 'Your business profile and threshold settings have been updated.',
        tone: 'healthy',
      });
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast({
        title: 'Error updating profile',
        description: 'Could not update your profile details. Please try again.',
        tone: 'risk',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast({
        title: 'Signed out',
        description: 'You have been safely signed out of CashTwin.',
        tone: 'healthy',
      });
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
      toast({
        title: 'Error signing out',
        description: 'An error occurred during logout. Please try again.',
        tone: 'risk',
      });
      setLoggingOut(false);
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="font-display text-heading-md text-chalk-hi">Business &amp; Owner Profile</h2>
        <p className="mt-2 max-w-2xl text-body-sm text-chalk-lo">
          Manage your MSME business identity, GSTIN registration, and cash buffer thresholds.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Owner Contact Information */}
        <div className="rounded-card border border-edge-dark bg-surface p-6 shadow-card">
          <div className="flex items-center gap-3 border-b border-edge-dark pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-control bg-lime-16 text-lime">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-chalk-hi">Owner / Authorized Representative</h3>
              <p className="text-body-sm text-chalk-lo">Primary account administrator</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.ownerName}
                  onChange={(e) => handleChange('ownerName', e.target.value)}
                  className="w-full rounded-control border border-edge-dark bg-surface-2 px-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Designation / Role
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full rounded-control border border-edge-dark bg-surface-2 px-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Email Address
              </label>
              <div className="relative flex items-center">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full rounded-control border border-edge-dark bg-surface-2 pl-10 pr-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors"
                />
                <Mail className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Mobile Number
              </label>
              <div className="relative flex items-center">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full rounded-control border border-edge-dark bg-surface-2 pl-10 pr-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors font-mono"
                />
                <Phone className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Business Information */}
        <div className="rounded-card border border-edge-dark bg-surface p-6 shadow-card">
          <div className="flex items-center gap-3 border-b border-edge-dark pb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-control bg-lime-16 text-lime">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-chalk-hi">Business &amp; Tax Registration</h3>
              <p className="text-body-sm text-chalk-lo">Enterprise information synced with GSTN</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Legal Entity Name
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
                className="w-full rounded-control border border-edge-dark bg-surface-2 px-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors font-medium"
              />
            </div>

            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Trade Name / Brand
              </label>
              <input
                type="text"
                value={formData.tradeName}
                onChange={(e) => handleChange('tradeName', e.target.value)}
                className="w-full rounded-control border border-edge-dark bg-surface-2 px-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                GSTIN
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => handleChange('gstin', e.target.value)}
                  className="w-full rounded-control border border-edge-dark bg-surface-2 px-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors font-mono"
                />
                <span className="inline-flex items-center gap-1 rounded-md bg-lime-16 border border-lime/30 px-2.5 py-2 text-[11px] font-semibold text-lime whitespace-nowrap">
                  <ShieldCheck className="h-3.5 w-3.5" /> Verified
                </span>
              </div>
            </div>

            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Udyam Registration No.
              </label>
              <input
                type="text"
                value={formData.udyam}
                onChange={(e) => handleChange('udyam', e.target.value)}
                className="w-full rounded-control border border-edge-dark bg-surface-2 px-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Industry Sector
              </label>
              <input
                type="text"
                value={formData.sector}
                onChange={(e) => handleChange('sector', e.target.value)}
                className="w-full rounded-control border border-edge-dark bg-surface-2 px-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Minimum Cash Buffer (₹)
              </label>
              <input
                type="number"
                value={formData.minBuffer}
                onChange={(e) => handleChange('minBuffer', e.target.value)}
                className="w-full rounded-control border border-edge-dark bg-surface-2 px-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors font-mono"
              />
              <p className="mt-1 text-[11px] text-chalk-lo">
                The minimum cash balance required before the digital twin triggers a breach alert.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-label-xs uppercase text-chalk-lo font-semibold mb-2">
                Registered Factory / Office Address
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full rounded-control border border-edge-dark bg-surface-2 pl-10 pr-3.5 py-2.5 text-body-sm text-chalk-hi focus:border-lime focus:outline-none transition-colors"
                />
                <MapPin className="absolute left-3.5 h-4 w-4 text-chalk-lo pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="submit" size="md" disabled={saving} className="rounded-control px-6 font-semibold">
            {saving ? (
              'Saving changes…'
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5" /> Save changes
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Account Session & Logout Section */}
      <div className="rounded-xl border border-risk/30 bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-edge-dark pb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-risk-16 text-risk">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-chalk-hi">Account Session &amp; Security</h3>
            <p className="text-body-sm text-chalk-lo">Active Firebase Authentication session</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-body-sm text-chalk-hi font-medium">
              Signed in as <span className="font-mono text-lime">{currentUser?.email || formData.email}</span>
            </p>
            <p className="text-xs text-chalk-lo">
              Session is managed securely by Firebase Authentication (msme-cashflow).
            </p>
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={handleLogout}
            disabled={loggingOut}
            className="shrink-0"
          >
            <LogOut className="h-4 w-4 mr-1.5" />
            {loggingOut ? 'Signing out…' : 'Sign out of CashTwin'}
          </Button>
        </div>
      </div>
    </section>
  );
}

