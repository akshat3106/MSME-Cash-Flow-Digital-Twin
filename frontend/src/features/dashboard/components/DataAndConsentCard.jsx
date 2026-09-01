import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Card, { CardHeader } from '@/components/shared/Card';
import ConsentSwitchRow from '@/components/shared/ConsentSwitchRow';
import { StaggerItem } from '@/components/shared/motion';
import useConsent from '@/hooks/useConsent';
import { CONSENT_SCOPES } from '@/mocks/api/consent';
import InvoiceCsvUpload from '@/features/settings/components/InvoiceCsvUpload';

/**
 * Data upload and privacy consent, surfaced directly on the dashboard - not
 * just during onboarding or buried under Settings. Reuses the exact same
 * InvoiceCsvUpload and ConsentSwitchRow components as onboarding/Settings
 * (see [[frontend/src/features/onboarding/OnboardingFlow.jsx]] and
 * [[frontend/src/features/settings/PrivacyConsentPage.jsx]]) so all three
 * surfaces stay in sync automatically rather than drifting.
 */
export default function DataAndConsentCard() {
  const { consent, loading, setScope } = useConsent();

  return (
    <StaggerItem as="section" index={1}>
      <div className="grid gap-4 lg:grid-cols-2">
        <InvoiceCsvUpload />

        <Card padding="lg">
          <CardHeader
            title="Privacy & consent"
            actions={
              <Link
                to="/app/settings"
                className="inline-flex items-center gap-1 text-label-xs uppercase text-lime hover:underline"
              >
                Full settings <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <p className="mt-1 text-body-sm text-chalk-lo">
            What CashTwin is allowed to read and use for this twin.
          </p>

          {loading || !consent ? (
            <div className="mt-4 space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-control border border-edge-dark bg-surface-2" />
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {CONSENT_SCOPES.map((scope) => (
                <ConsentSwitchRow
                  key={scope.key}
                  title={scope.title}
                  description={scope.description}
                  checked={Boolean(consent[scope.key])}
                  onCheckedChange={(value) => setScope(scope.key, value)}
                  sensitive={scope.sensitive}
                />
              ))}
            </div>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-[12px] text-chalk-lo">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-lime" aria-hidden="true" />
            Every change here is written to your audit log.
          </p>
        </Card>
      </div>
    </StaggerItem>
  );
}
