import { createBrowserRouter } from 'react-router-dom';
import AppShell from '@/layouts/AppShell';
import MarketingLayout from '@/layouts/MarketingLayout';
import LandingPage from '@/features/landing/LandingPage';
import OnboardingFlow from '@/features/onboarding/OnboardingFlow';
import DashboardPage from '@/features/dashboard/DashboardPage';
import ScenarioSimulatorPage from '@/features/scenarios/ScenarioSimulatorPage';
import RecommendationsPage from '@/features/recommendations/RecommendationsPage';
import ExplainabilityPage from '@/features/explainability/ExplainabilityPage';
import InvoiceReviewPage from '@/features/invoices/InvoiceReviewPage';
import StatutoryPage from '@/features/statutory/StatutoryPage';
import SettingsLayout from '@/features/settings/SettingsLayout';
import PrivacyConsentPage from '@/features/settings/PrivacyConsentPage';
import AuditLogPage from '@/features/settings/AuditLogPage';
import ProfileSettingsPage from '@/features/settings/ProfileSettingsPage';
import DataSourcesPage from '@/features/settings/DataSourcesPage';
import NotificationsPage from '@/features/settings/NotificationsPage';

import TermsPage from '@/features/legal/TermsPage';
import PrivacyPolicyPage from '@/features/legal/PrivacyPolicyPage';
import ContactPage from '@/features/legal/ContactPage';

import LoginPage from '@/features/auth/LoginPage';
import SignupPage from '@/features/auth/SignupPage';
import ProtectedRoute from '@/features/auth/ProtectedRoute';
import PublicOnlyRoute from '@/features/auth/PublicOnlyRoute';

/**
 * Route table. Marketing and public auth sit outside the authenticated shell;
 * everything under /app and /onboarding is protected by Firebase Authentication.
 */
export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/terms', element: <TermsPage /> },
      { path: '/privacy', element: <PrivacyPolicyPage /> },
      { path: '/contact', element: <ContactPage /> },
    ],
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/onboarding', element: <OnboardingFlow /> },
      {
        path: '/app',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'scenarios', element: <ScenarioSimulatorPage /> },
          { path: 'recommendations', element: <RecommendationsPage /> },
          { path: 'explainability', element: <ExplainabilityPage /> },
          { path: 'invoices', element: <InvoiceReviewPage /> },
          { path: 'statutory', element: <StatutoryPage /> },
          {
            path: 'settings',
            element: <SettingsLayout />,
            children: [
              { index: true, element: <PrivacyConsentPage /> },
              { path: 'audit', element: <AuditLogPage /> },
              { path: 'profile', element: <ProfileSettingsPage /> },
              { path: 'data-sources', element: <DataSourcesPage /> },
              { path: 'notifications', element: <NotificationsPage /> },
            ],
          },
        ],
      },
    ],
  },
]);

export default router;

