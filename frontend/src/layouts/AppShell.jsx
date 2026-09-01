import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Scale,
  Settings,
  SlidersHorizontal,
  Waypoints,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import cn from '@/lib/cn';
import CalculationLineage from '@/components/shared/CalculationLineage';
import DisclaimerBar from '@/components/shared/DisclaimerBar';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LineageContext } from '@/hooks/useLineage';
import { getLineage } from '@/mocks/api/lineage';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/components/shared/Toast';

/**
 * Authenticated shell — expandable sidebar from PRD 3.4 & UI Refinement Guide,
 * plus the contextual lineage drawer that any <Figure figureId="…" /> in the tree can open.
 */

const NAV = [
  { to: '/app', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/app/scenarios', label: 'Scenarios', Icon: SlidersHorizontal },
  { to: '/app/recommendations', label: 'Recovery Options', Icon: Lightbulb },
  { to: '/app/explainability', label: 'Risk Graph', Icon: Waypoints },
  { to: '/app/statutory', label: 'Legal Position', Icon: Scale },
  { to: '/app/invoices', label: 'Invoices', Icon: FileText },
  { to: '/app/settings', label: 'Settings', Icon: Settings },
];

export default function AppShell() {
  const [lineage, setLineage] = useState(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const openLineage = useCallback((figureId) => {
    setOpen(true);
    setLineage(null);
    getLineage(figureId).then(setLineage);
  }, []);

  const lineageValue = useMemo(() => ({ openLineage }), [openLineage]);

  return (
    <TooltipProvider delayDuration={150}>
      <LineageContext.Provider value={lineageValue}>
        <div className="min-h-screen bg-void">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-lime focus:px-4 focus:py-2 focus:text-label-xs focus:uppercase focus:text-ink-hi"
          >
            Skip to content
          </a>

          <Sidebar expanded={expanded} onToggle={() => setExpanded((v) => !v)} />

          {/* Content area with responsive left padding matching sidebar width */}
          <div
            className={cn(
              'min-h-screen transition-[padding] duration-300 ease-in-out',
              // The mobile nav is a fixed bottom bar, so the last ~72px of
              // every page was sitting underneath it — on the dashboard that
              // hid the footer disclaimer entirely. Reserve the strip back.
              'pb-[4.5rem] md:pb-0',
              expanded ? 'md:pl-60' : 'md:pl-16',
            )}
          >
            <main id="main" className="min-w-0">
              <Outlet />
            </main>

            <footer className="border-t border-edge-dark px-5 py-6 md:px-8">
              <DisclaimerBar />
            </footer>
          </div>

          <LineageDrawer open={open} onOpenChange={setOpen} lineage={lineage} />
        </div>
      </LineageContext.Provider>
    </TooltipProvider>
  );
}

function Sidebar({ expanded, onToggle }) {
  const { currentUser, businessName, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Mark Hussain';
  const displayEmail = currentUser?.email || 'mark@hussaincrafts.in';

  // Compute initials
  const initials = useMemo(() => {
    if (!displayName) return 'CT';
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  const handleLogout = async () => {
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
    }
  };

  const homeLink = (
    <Link
      to="/"
      className={cn(
        'group flex h-10 w-full items-center gap-3 rounded-lg px-2.5 transition-all text-body-sm font-medium',
        'text-chalk-lo hover:bg-surface-2 hover:text-chalk-hi border border-transparent',
      )}
    >
      <Home className="h-5 w-5 shrink-0 text-lime" aria-hidden="true" />
      {expanded ? (
        <span className="truncate flex items-center justify-between flex-1">
          <span>Go to Homepage</span>
          <ExternalLink className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
        </span>
      ) : null}
    </Link>
  );

  return (
    <aside
      aria-label="Main"
      className={cn(
        // Bottom tab bar on mobile, vertical sidebar from md up
        'fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-edge-dark bg-surface px-2 py-2',
        'md:inset-y-0 md:left-0 md:right-auto md:flex-col md:justify-between md:border-r md:border-t-0 md:p-3 transition-[width] duration-300 ease-in-out',
        expanded ? 'md:w-60' : 'md:w-16',
      )}
    >
      {/* Top Header & Brand */}
      <div className="hidden md:flex md:w-full md:flex-col md:gap-4">
        <div className="flex items-center justify-between px-1.5 py-2 border-b border-edge-dark/60 pb-3">
          <Link
            to="/"
            title="Go to CashTwin Homepage"
            className="flex items-center gap-2.5 min-w-0 overflow-hidden group"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-2 border border-edge-dark group-hover:border-lime transition-colors">
              <LogoMark className="h-5 w-5" />
            </span>
            {expanded ? (
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold text-chalk-hi group-hover:text-lime transition-colors truncate">
                  CashTwin
                </p>
                <p className="text-[10px] text-chalk-lo truncate font-mono uppercase">
                  {businessName || 'Hussain Crafts'}
                </p>
              </div>
            ) : null}
          </Link>

          {/* Toggle sidebar button on desktop */}
          <button
            type="button"
            onClick={onToggle}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-edge-dark bg-surface-2 text-chalk-lo hover:text-chalk-hi hover:border-lime/40 transition-colors"
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex flex-col gap-1 w-full">
          {NAV.map(({ to, label, Icon, end }) => {
            const navLink = (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'group relative flex h-10 w-full items-center gap-3 rounded-control px-2.5 text-body-sm font-medium',
                    'transition-colors duration-hover ease-out',
                    // The rail is the selected marker; it grows out of the left
                    // edge so the row itself does not have to shift or gain a
                    // border that changes its height.
                    'before:absolute before:left-0 before:top-1/2 before:h-0 before:w-[3px] before:-translate-y-1/2',
                    'before:rounded-r-full before:bg-lime before:transition-[height] before:duration-200 before:ease-out',
                    isActive
                      ? 'bg-lime-8 font-semibold text-chalk-hi before:h-5'
                      : 'text-chalk-lo hover:bg-surface-2 hover:text-chalk-hi',
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {expanded ? <span className="truncate">{label}</span> : null}
              </NavLink>
            );

            if (expanded) return <span key={to}>{navLink}</span>;

            return (
              <Tooltip key={to}>
                <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="z-[9999] hidden md:block">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}

          {/* Explicit Go to Homepage Link */}
          <div className="pt-2 mt-2 border-t border-edge-dark/50">
            {expanded ? (
              homeLink
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>{homeLink}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={14} className="z-[9999] hidden md:block">
                  Go to Homepage
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </nav>
      </div>


      {/* Mobile nav (all items horizontal) */}
      <div className="flex md:hidden w-full items-center justify-around">
        {NAV.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-control transition-colors',
                'transition-colors duration-hover ease-out',
                isActive ? 'bg-lime-8 text-lime-ink' : 'text-chalk-lo hover:text-chalk-hi',
              )
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Desktop User Footer Profile */}
      <div className="hidden md:flex md:w-full md:flex-col md:gap-2 border-t border-edge-dark/60 pt-3">
        <div className="flex items-center justify-between gap-2 px-1 py-1 rounded-control bg-surface-2/60 border border-edge-dark/40">
          <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime/20 border border-lime/40 text-lime font-display font-bold text-xs">
              {initials}
            </div>
            {expanded ? (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-chalk-hi truncate">{displayName}</p>
                <p className="text-[10px] text-chalk-lo truncate font-mono" title={displayEmail}>
                  {displayEmail}
                </p>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex h-6 w-6 shrink-0 items-center justify-center text-chalk-lo hover:text-risk transition-colors"
            title="Sign out of CashTwin"
            aria-label="Sign out of CashTwin"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}


function LineageDrawer({ open, onOpenChange, lineage }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{lineage?.label ?? 'How this was calculated'}</SheetTitle>
          <SheetDescription>
            {lineage?.explanation ??
              'Tracing this figure back to the records it came from.'}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          {lineage ? (
            <CalculationLineage lineage={lineage} showRunningTotal={false} />
          ) : (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-control border border-edge-dark bg-surface-2"
                />
              ))}
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export function LogoMark({ className }) {
  // Twin diamonds — the "digital twin" mark referenced in PRD 3.1.
  return (
    <svg viewBox="0 0 24 24" className={cn('h-6 w-6', className)} aria-hidden="true">
      <rect x="7" y="2" width="10" height="10" transform="rotate(45 12 7)" fill="var(--accent-lime)" />
      <rect
        x="7"
        y="12"
        width="10"
        height="10"
        transform="rotate(45 12 17)"
        fill="none"
        stroke="var(--accent-lime)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
