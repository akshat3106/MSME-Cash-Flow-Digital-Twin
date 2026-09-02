import cn from '@/lib/cn';
import Card from '@/components/shared/Card';
import EyebrowLabel from '@/components/shared/EyebrowLabel';
import Figure from '@/components/shared/Figure';
import Pill from '@/components/shared/Pill';
import { Stagger, StaggerItem } from '@/components/shared/motion';
import { formatCurrencyShort } from '@/lib/format';

/**
 * The risk breakdown row (PRD 3.4.4): concentration, payment behaviour and
 * buffer pressure — the three "why" cards behind the headline number.
 */
export default function RiskBreakdownRow({ concentration, behaviour, buffer, minimumBuffer }) {
  // No `items-start` on the grid: these three cards hold different amounts of
  // content (a 4-row list, a 5-row table, a sparkline) and left to their
  // natural heights they ended the row on three different baselines. The
  // default `stretch` squares off the bottom edge.
  return (
    <Stagger className="grid gap-4 lg:grid-cols-3">
      <StaggerItem className="flex">
        <ConcentrationCard rows={concentration} />
      </StaggerItem>
      <StaggerItem className="flex">
        <BehaviourCard rows={behaviour} />
      </StaggerItem>
      <StaggerItem className="flex">
        <BufferCard series={buffer} minimumBuffer={minimumBuffer} />
      </StaggerItem>
    </Stagger>
  );
}

const BAR_TONES = ['bg-risk', 'bg-caution', 'bg-info', 'bg-lime', 'bg-chalk-lo'];

// The API returns EVERY customer holding an outstanding invoice, sorted by
// amount. That is the right payload - the question "where do my receivables
// sit" is answered by the top few, but the tail has to be counted somewhere
// or the percentages stop adding up.
//
// It is not a list to render in full. A business with a couple of hundred
// active customers turned this card into a several-thousand-pixel column of
// near-identical 1% rows that buried every other panel on the dashboard, and
// answered nothing: concentration risk is about whether a FEW customers hold
// the money, so the tail is one fact ("the other 185 hold 71%"), not 185.
//
// Four named rows plus a rolled-up remainder is also what BAR_TONES was
// built for - five tones, the last a muted grey that reads as "everyone
// else" rather than as a fifth highlighted customer.
const NAMED_ROWS = 4;

function foldTail(rows) {
  if (!rows || rows.length <= NAMED_ROWS + 1) return rows ?? [];

  const named = rows.slice(0, NAMED_ROWS);
  const tail = rows.slice(NAMED_ROWS);

  return [
    ...named,
    {
      id: '__other__',
      name: `Other customers (${tail.length})`,
      amount: tail.reduce((sum, row) => sum + row.amount, 0),
      pct: tail.reduce((sum, row) => sum + row.pct, 0),
    },
  ];
}

function ConcentrationCard({ rows }) {
  const display = foldTail(rows);

  return (
    <Card as="section" className="w-full">
      <EyebrowLabel tone="watch">Customer concentration</EyebrowLabel>
      <h3 className="mt-4 font-display text-heading-md text-chalk-hi">
        Where your receivables sit
      </h3>

      <div className="mt-5 flex h-2.5 w-full overflow-hidden" role="presentation">
        {display.map((row, i) => (
          <span
            key={row.id}
            className={cn(BAR_TONES[i % BAR_TONES.length])}
            style={{ width: `${row.pct}%` }}
          />
        ))}
      </div>

      <ul className="mt-5 space-y-2.5">
        {display.map((row, i) => (
          <li key={row.id} className="flex items-center gap-2.5 text-body-sm">
            <span
              className={cn('h-2 w-2 shrink-0', BAR_TONES[i % BAR_TONES.length])}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-chalk-hi">{row.name}</span>
            <span data-numeric className="tabular text-chalk-lo">
              {row.pct.toFixed(0)}%
            </span>
            <span data-numeric className="w-16 text-right tabular text-chalk-hi">
              {formatCurrencyShort(row.amount)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BehaviourCard({ rows }) {
  return (
    <Card as="section" className="w-full">
      <EyebrowLabel tone="risk">Payment behaviour</EyebrowLabel>
      <h3 className="mt-4 font-display text-heading-md text-chalk-hi">
        How late they actually pay
      </h3>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-edge-dark">
              <th scope="col" className="pb-2 text-label-xs uppercase text-chalk-lo">
                Customer
              </th>
              <th scope="col" className="pb-2 text-label-xs uppercase text-chalk-lo">
                Terms
              </th>
              <th scope="col" className="pb-2 text-label-xs uppercase text-chalk-lo">
                Typical
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row) => (
              <tr key={row.id} className="border-b border-edge-dark last:border-b-0">
                <td className="py-2.5 text-body-sm text-chalk-hi">
                  <span className="flex items-center gap-2">
                    {row.name}
                    {row.severity === 'high' ? <Pill status="overdue">Late</Pill> : null}
                  </span>
                </td>
                <td className="py-2.5 text-body-sm text-chalk-lo">{row.contractualTerm}</td>
                <td className="py-2.5 text-body-sm text-chalk-hi">{row.typicalRange}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BufferCard({ series, minimumBuffer }) {
  const values = series.map((p) => p.value);
  const min = Math.min(...values, minimumBuffer) * 0.92;
  const max = Math.max(...values) * 1.04;
  const width = 300;
  const height = 70;

  const x = (i) => (i / Math.max(values.length - 1, 1)) * width;
  const y = (v) => height - ((v - min) / (max - min || 1)) * height;
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  const lowest = Math.min(...values);
  const breaches = lowest < minimumBuffer;

  return (
    <Card as="section" className="w-full">
      <EyebrowLabel tone={breaches ? 'risk' : 'healthy'}>Cash buffer pressure</EyebrowLabel>
      <h3 className="mt-4 font-display text-heading-md text-chalk-hi">
        How close you get to the floor
      </h3>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-5 h-20 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Cash falls to a low of ${formatCurrencyShort(lowest)} against a minimum buffer of ${formatCurrencyShort(minimumBuffer)}.`}
      >
        <line
          x1="0"
          x2={width}
          y1={y(minimumBuffer)}
          y2={y(minimumBuffer)}
          stroke="var(--risk-red)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <path d={line} fill="none" stroke="var(--viz-expected)" strokeWidth="2" />
      </svg>

      <dl className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <dt className="text-body-sm text-chalk-lo">Lowest point</dt>
          <dd className={cn('text-body-sm', breaches ? 'text-risk' : 'text-chalk-hi')}>
            <Figure value={lowest} variant="currencyShort" tone={breaches ? 'risk' : 'default'} />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-body-sm text-chalk-lo">Minimum buffer</dt>
          <dd className="text-body-sm text-chalk-hi">
            <Figure value={minimumBuffer} variant="currencyShort" />
          </dd>
        </div>
      </dl>

      {breaches ? (
        <p className="mt-3 border-t border-edge-dark pt-3 text-label-xs uppercase text-risk">
          Projected to fall below buffer
        </p>
      ) : null}
    </Card>
  );
}
