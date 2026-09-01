import { Menu, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import cn from '@/lib/cn';
import SmoothScrollProvider from '@/components/shared/SmoothScrollProvider';
import TermsModal from '@/features/legal/TermsModal';
import PrivacyPolicyModal from '@/features/legal/PrivacyPolicyModal';
import ContactModal from '@/features/legal/ContactModal';
import { useAuth } from '@/features/auth/AuthContext';


/**
 * Marketing shell — sticky dark top nav with spotlight hover/active tracking,
 * 60fps smooth scrolling, and modern footer with modal popups.
 */

const NAV_LINKS = [
  { id: 'how-it-works', href: '/#how-it-works', label: 'How It Works' },
  { id: 'scenarios', href: '/#scenarios', label: 'Scenarios' },
  { id: 'modules', href: '/#modules', label: 'Capabilities' },
  { id: 'trust', href: '/#trust', label: 'Trust' },
  { id: 'consent', href: '/#consent', label: 'Consent' },
  { id: 'footer', href: '/#footer', label: 'Contact' },
];

export function CashTwinLogo({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <rect x="7" y="2" width="10" height="10" rx="2" transform="rotate(45 12 7)" fill="#00b074" />
      <rect
        x="7"
        y="12"
        width="10"
        height="10"
        rx="2"
        transform="rotate(45 12 17)"
        stroke="#0D1720"
        strokeWidth="2"
      />
    </svg>
  );
}

export default function MarketingLayout() {
  const { currentUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('');
  const [hoveredLink, setHoveredLink] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0, opacity: 0 });
  const navContainerRef = useRef(null);

  // Track active section on scroll or route changes
  useEffect(() => {
    if (location.pathname === '/terms') {
      setActiveSection('terms');
      return;
    }
    if (location.pathname === '/privacy') {
      setActiveSection('privacy');
      return;
    }
    if (location.pathname !== '/') {
      setActiveSection('');
      return;
    }

    const sectionIds = ['how-it-works', 'scenarios', 'modules', 'trust', 'consent', 'footer'];

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      if (scrollY < 160) {
        setActiveSection('');
        return;
      }

      if (windowHeight + scrollY >= document.documentElement.scrollHeight - 80) {
        setActiveSection('footer');
        return;
      }

      const focusThreshold = windowHeight * 0.32;
      let currentSection = '';

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= focusThreshold && rect.bottom >= focusThreshold) {
            currentSection = id;
            break;
          }
        }
      }

      if (!currentSection) {
        let minDistance = Infinity;
        for (const id of sectionIds) {
          const el = document.getElementById(id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= focusThreshold && rect.bottom > 0) {
              const dist = focusThreshold - rect.top;
              if (dist < minDistance) {
                minDistance = dist;
                currentSection = id;
              }
            }
          }
        }
      }

      if (currentSection) {
        setActiveSection(currentSection);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActiveSection(targetId);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.hash]);

  const handleNavClick = (e, link) => {
    e.preventDefault();
    if (location.pathname === '/') {
      const el = document.getElementById(link.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSection(link.id);
        window.history.replaceState(null, '', `#${link.id}`);
      }
    } else {
      navigate(`/#${link.id}`);
    }
    setMenuOpen(false);
  };

  const handleMouseMove = (e) => {
    if (!navContainerRef.current) return;
    const rect = navContainerRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setMousePosition((prev) => ({ ...prev, opacity: 0 }));
    setHoveredLink(null);
  };

  return (
    <SmoothScrollProvider>
      <div className="min-h-screen bg-[#FAF7F2] text-[#0D1720] flex flex-col justify-between selection:bg-[#00b074]/20 selection:text-[#0D1720]">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-[#00b074] focus:px-4 focus:py-2 focus:text-xs focus:font-medium focus:text-white"
        >
          Skip to content
        </a>

        {/* Clean Top Navbar */}
        <header className="sticky top-0 z-40 bg-[#FAF7F2]/90 backdrop-blur-md transition-all">
          <nav
            aria-label="Main"
            className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 md:px-10"
          >
            {/* Left brand */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3 group">
                <CashTwinLogo className="h-6 w-6 transition-transform group-hover:scale-105 duration-300" />
                <span className="text-[19px] font-bold tracking-tight text-[#0D1720] font-sans">
                  CashTwin
                </span>
              </Link>

              {/* Navigation Links */}
              <div
                ref={navContainerRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="relative hidden items-center gap-6 md:flex ml-4"
              >
                {NAV_LINKS.map((link) => {
                  const isActive = activeSection === link.id;

                  return (
                    <a
                      key={link.id}
                      href={link.href}
                      onClick={(e) => handleNavClick(e, link)}
                      className={cn(
                        'text-[14px] font-medium transition-colors duration-200 select-none',
                        isActive
                          ? 'text-[#0D1720] font-semibold'
                          : 'text-[#4A5568] hover:text-[#0D1720]',
                      )}
                    >
                      {link.label}
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Right Action buttons */}
            <div className="flex items-center gap-4">
              {currentUser ? (
                <Link
                  to="/app"
                  className="inline-flex items-center justify-center rounded-full bg-[#0D1720] px-5 py-2.5 text-[14px] font-medium text-white shadow-sm transition-all hover:bg-[#1A2530]"
                >
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="hidden sm:inline-flex items-center justify-center rounded-full bg-[#0D1720] px-5 py-2.5 text-[14px] font-medium text-white shadow-sm transition-all hover:bg-[#1A2530]"
                  >
                    Get started
                  </Link>

                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center px-3 py-2 text-[14px] font-medium text-[#0D1720] hover:text-[#00b074] transition-colors"
                  >
                    Sign in
                  </Link>
                </>
              )}

              <button
                type="button"
                className="p-1.5 text-[#4A5568] hover:text-[#0D1720] md:hidden"
                aria-expanded={menuOpen}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </nav>


          {/* Mobile menu drawer */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="border-t border-edge-dark bg-surface/98 backdrop-blur-xl px-5 py-4 md:hidden overflow-hidden shadow-xl"
              >
                <ul className="space-y-1.5 font-mono text-xs uppercase">
                  {NAV_LINKS.map((link) => {
                    const isActive = activeSection === link.id;
                    return (
                      <li key={link.id}>
                        <a
                          href={link.href}
                          onClick={(e) => handleNavClick(e, link)}
                          className={cn(
                            'flex items-center justify-between rounded-lg px-3.5 py-2.5 transition-all',
                            isActive
                              ? 'bg-[#24D6A0]/15 text-[#0D1720] font-bold border border-[#24D6A0]/40'
                              : 'text-[#6E7D87] hover:bg-surface-2 hover:text-[#0D1720]',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {isActive && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[#24D6A0] shadow-[0_0_6px_#24D6A0] animate-pulse" />
                            )}
                            {link.label}
                          </span>
                          {isActive && (
                            <span className="text-[10px] text-[#24D6A0] font-sans tracking-normal font-semibold">Active</span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>
                <div className="pt-3 border-t border-edge-dark mt-2">
                  <Link
                    to={currentUser ? "/app" : "/login"}
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center justify-center rounded-lg bg-surface border border-edge-dark py-2.5 text-xs font-semibold text-[#0D1720] hover:bg-surface-2 transition-all"
                  >
                    {currentUser ? 'Open Dashboard' : 'Sign in'}
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <main id="main" className="flex-1">
          <Outlet />
        </main>

        <Footer
          onOpenTerms={() => setTermsModalOpen(true)}
          onOpenPrivacy={() => setPrivacyModalOpen(true)}
          onOpenContact={() => setContactModalOpen(true)}
        />
        <TermsModal open={termsModalOpen} onOpenChange={setTermsModalOpen} />
        <PrivacyPolicyModal open={privacyModalOpen} onOpenChange={setPrivacyModalOpen} />
        <ContactModal open={contactModalOpen} onOpenChange={setContactModalOpen} />
      </div>
    </SmoothScrollProvider>
  );
}

function Footer({ onOpenTerms, onOpenPrivacy, onOpenContact }) {
  const columns = [
    {
      title: 'PRODUCT',
      links: [
        { label: 'How it works', to: '/#how-it-works' },
        { label: 'Scenarios', to: '/#scenarios' },
        { label: 'Capabilities', to: '/#modules' },
      ],
    },
    {
      title: 'COMPANY',
      links: [
        { label: 'About', to: '/#problem' },
        { label: 'Contact', onClick: onOpenContact },
        { label: 'Onboarding', to: '/onboarding' },
      ],
    },
    {
      title: 'LEGAL',
      links: [
        { label: 'Terms and conditions', onClick: onOpenTerms },
        { label: 'Privacy policy', onClick: onOpenPrivacy },
        { label: 'Consent policy', to: '/#consent' },
      ],
    },
  ];

  return (
    <footer id="footer" className="border-t border-[#1F2E3A] bg-[#0B1720] text-[#6E7D87]">
      <div className="mx-auto max-w-6xl px-6 py-14 md:px-8">
        {/* Top 4-Column Layout */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2.5 group w-fit">
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="none">
                <rect x="7" y="2" width="10" height="10" rx="1.5" transform="rotate(45 12 7)" fill="#24D6A0" />
                <rect
                  x="7"
                  y="12"
                  width="10"
                  height="10"
                  rx="1.5"
                  transform="rotate(45 12 17)"
                  stroke="#FFFFFF"
                  strokeWidth="1.75"
                />
              </svg>
              <span className="font-display text-xl font-bold text-white tracking-tight">CashTwin</span>
            </Link>
            <p className="text-sm text-[#6E7D87] max-w-xs leading-relaxed">
              A consent-first cash-flow digital twin for Indian MSMEs.
            </p>
            {/* Social / Channel Icons */}
            <div className="flex items-center gap-4 pt-1 text-[#6E7D87]">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors"
                aria-label="Twitter / X"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors"
                aria-label="LinkedIn"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                </svg>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors"
                aria-label="GitHub"
              >
                <svg fillRule="evenodd" clipRule="evenodd" className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Columns */}
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-mono text-xs font-semibold text-white tracking-wider uppercase mb-4">
                {column.title}
              </h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.onClick ? (
                      <button
                        type="button"
                        onClick={link.onClick}
                        className="text-sm text-[#6E7D87] transition-colors hover:text-white text-left cursor-pointer"
                      >
                        {link.label}
                      </button>
                    ) : link.to.startsWith('/#') ? (
                      <a
                        href={link.to.replace('/', '')}
                        className="text-sm text-[#6E7D87] transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-sm text-[#6E7D87] transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Regulatory Note Row */}
        <div className="mt-12 pt-6 border-t border-[#1F2E3A] flex items-start sm:items-center gap-2.5 text-xs text-[#6E7D87]">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#24D6A0] text-[#24D6A0] text-[10px] font-bold">
            !
          </span>
          <p className="leading-normal">
            CashTwin provides decision support only. It does not initiate, approve, or reject lending.
          </p>
        </div>

        {/* Bottom Sub-Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-[#6E7D87]">
          <span>&copy; 2026 CashTwin</span>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center rounded-full border border-[#24D6A0]/30 bg-[#24D6A0]/10 px-3.5 py-1 text-xs text-[#24D6A0] font-medium">
              Built for Indian MSMEs
            </span>
            <span className="inline-flex items-center rounded-full border border-[#24D6A0]/30 bg-[#24D6A0]/10 px-3.5 py-1 text-xs text-[#24D6A0] font-medium">
              DPDP Act 2023 compliant
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

