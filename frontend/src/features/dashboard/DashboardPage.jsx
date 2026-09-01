import { ArrowRight, Info, Lightbulb, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import BracketFrame from '@/components/shared/BracketFrame';
import Button from '@/components/shared/Button';
import Card, { CardHeader } from '@/components/shared/Card';
import EmptyState from '@/components/shared/EmptyState';
import EyebrowLabel from '@/components/shared/EyebrowLabel';
import ForecastChart from '@/components/shared/ForecastChart';
import PageContainer from '@/components/shared/PageContainer';
import PageHeader from '@/components/shared/PageHeader';
import { Stagger, StaggerItem } from '@/components/shared/motion';
import RiskGraph from '@/components/shared/RiskGraph';
import SegmentedToggle from '@/components/shared/SegmentedToggle';
import useAsync from '@/hooks/useAsync';
import { formatDateLong } from '@/lib/format';
import {
  getBufferPressure,
  getConcentrationBreakdown,
  getDashboard,
  getPaymentBehaviour,
  getStatutoryExposure,
} from '@/mocks/api/dashboard';
import HeroStatStrip from './components/HeroStatStrip';
import ObligationsList from './components/ObligationsList';
import RiskBreakdownRow from './components/RiskBreakdownRow';
import StatutoryPositionBanner from './components/StatutoryPositionBanner';

/**
 * Dashboard (PRD 3.4) — the digital twin view and the product's home screen.
 */
export default function DashboardPage() {
  const [horizon, setHorizon] = useState(30);

  const { data, loading } = useAsync(() => getDashboard(horizon), [horizon]);
  const { data: behaviour } = useAsync(() => getPaymentBehaviour(), []);
  const { data: concentration } = useAsync(() => getConcentrationBreakdown(), []);
  const { data: buffer } = useAsync(() => getBufferPressure(horizon), [horizon]);
  const { data: statutory } = useAsync(() => getStatutoryExposure(), []);

  if (loading && !data) return <DashboardSkeleton />;

  if (data && data.forecast.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          title="Your twin has nothing to model yet"
          body="Import your first invoice to see your 30-day forecast."
          actionLabel="Import data"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Liquidity status"
        title={data.businessName}
        subtitle={`As of ${formatDateLong(new Date().toISOString())}`}
        actions={
          <>
            <SegmentedToggle
              label="Forecast horizon"
              value={horizon}
              onChange={setHorizon}
              size="sm"
              options={[
                { value: 7, label: '7 days' },
                { value: 30, label: '30 days' },
                { value: 60, label: '60 days' },
                { value: 90, label: '90 days' },
              ]}
            />
            <Button asChild variant="secondary" size="sm">
              <Link to="/app/scenarios">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Ask a scenario
              </Link>
            </Button>
          </>
        }
      />

      <HeroStatStrip data={data} />

      {data.forwardInvoiceCount === 0 ? (
        <StaggerItem as="section" index={2}>
          <div
            role="note"
            className="flex items-start gap-3 border border-info/30 bg-info-8 px-4 py-3"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
            <p className="text-body-sm text-chalk-hi">
              Every currently open invoice is already past its own predicted payment window, so
              there is nothing left to simulate day-by-day — this forecast reflects known cash
              burn only, with no upside or downside modeled. That usually means the invoice data
              is older than it looks relative to today, or this business has a real backlog of
              severely overdue receivables.
            </p>
          </div>
        </StaggerItem>
      ) : null}

      <StaggerItem as="section" index={3}>
        <Card>
          <CardHeader title="Cash-flow forecast" actions={<ChartLegend />} />
          <ForecastChart
            forecast={data.forecast}
            minimumBuffer={data.minimumBuffer}
            height={340}
            ariaSummary={
              data.daysToBreach == null
                ? `Projected cash stays above the minimum buffer for the next ${horizon} days.`
                : `Projected cash falls below the minimum operating buffer after ${data.daysToBreach} days, around ${formatDateLong(data.breachDate)}.`
            }
          />
        </Card>
      </StaggerItem>

      {behaviour && concentration && buffer ? (
        <RiskBreakdownRow
          concentration={concentration}
          behaviour={behaviour}
          buffer={buffer}
          minimumBuffer={data.minimumBuffer}
        />
      ) : null}

      {/* The one bracket-framed card on this screen — PRD 2.3 reserves the
          motif for the single thing the owner should look at first. */}
      <StaggerItem index={5}>
        <BracketFrame tone="risk">
          <Card as="section" padding="lg">
            <EyebrowLabel tone="risk">Why this risk exists</EyebrowLabel>
            <h2 className="mt-4 font-display text-heading-md text-chalk-hi">
              The chain behind your projected shortfall
            </h2>
            <p className="mt-2 max-w-2xl text-body-sm text-chalk-lo">
              Each step traces to real records. Select any node to open the invoices behind it.
            </p>
            <div className="mt-8">
              <RiskGraph nodes={data.riskGraph.nodes} edges={data.riskGraph.edges} />
            </div>
          </Card>
        </BracketFrame>
      </StaggerItem>

      {statutory ? <StatutoryPositionBanner exposure={statutory} /> : null}

      <ObligationsList obligations={data.upcomingObligations} />

      <Stagger className="grid gap-4 sm:grid-cols-2">
        <NextStepCard
          to="/app/scenarios"
          Icon={SlidersHorizontal}
          title="Run a scenario"
          body="Test a late payment, a sales drop or a cost rise against this forecast."
        />
        <NextStepCard
          to="/app/recommendations"
          Icon={Lightbulb}
          title="View recommendations"
          body="Compare recovery options, cheapest and least risky first."
        />
      </Stagger>
    </PageContainer>
  );
}

function ChartLegend() {
  const items = [
    { label: 'Optimistic', color: 'bg-viz-optimistic' },
    { label: 'Expected', color: 'bg-viz-expected' },
    { label: 'Pessimistic', color: 'bg-viz-pessimistic' },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-label-xs uppercase text-chalk-lo">
          <span className={`h-0.5 w-4 ${item.color}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function NextStepCard({ to, Icon, title, body }) {
  return (
    <StaggerItem>
      <Card as={Link} to={to} interactive className="group flex items-center gap-4">
        {/* The icon gets its own tinted plate so the row has a fixed left
            column — without it the three cards' text started at three
            different x positions depending on glyph width. */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-lime-8 text-lime-ink transition-colors duration-hover ease-out group-hover:bg-lime-16">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-heading-md text-chalk-hi">{title}</p>
          <p className="mt-1 text-body-sm text-chalk-lo">{body}</p>
        </div>
        <ArrowRight
          className="h-4 w-4 shrink-0 text-chalk-lo transition-transform duration-hover ease-out group-hover:translate-x-1 group-hover:text-chalk-hi"
          aria-hidden="true"
        />
      </Card>
    </StaggerItem>
  );
}

function DashboardSkeleton() {
  // Mirrors the real layout's rounding and rhythm so the swap to loaded
  // content does not visibly jump.
  return (
    <div
      className="mx-auto w-full max-w-[1440px] space-y-8 px-5 py-8 md:px-8"
      aria-busy="true"
      aria-label="Loading your forecast"
    >
      <div className="h-16 w-72 animate-pulse rounded-card bg-surface" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-card border border-edge-dark bg-surface"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-card border border-edge-dark bg-surface" />
    </div>
  );
}
