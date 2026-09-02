/**
 * Backend gateway configuration.
 *
 * Every value here is overridable via environment variable, since none of
 * these numbers are "correct" in any absolute sense - AI_models/invoices.csv
 * is a large synthetic dataset (5,306 invoices, tens of millions in value)
 * with no associated opening_cash / daily_expense of its own. The frontend's
 * polished demo narrative (Shree Balaji Furniture Works, currentCash
 * 340000, minimumBuffer 200000 - see frontend/src/mocks/fixtures/business.js)
 * describes a DIFFERENT, much smaller, hand-authored business.
 *
 * Wiring the real models to the real dataset means the numbers on screen
 * will look nothing like that existing narrative (crores, not lakhs) unless
 * someone either re-scales the demo dataset or rewrites the UI copy. Picked
 * here as a reasonable placeholder scaled to this dataset - not a business
 * decision this file should be making silently forever.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AI_MODELS_ROOT =
  process.env.AI_MODELS_ROOT ?? path.resolve(__dirname, '..', '..', 'AI_models');

export const RAW_INVOICES_PATH = path.join(AI_MODELS_ROOT, 'invoices.csv');

// Model 1's own server (AI_models/main.py) defaults to reading a SEPARATE
// copy at data/raw/invoices.csv, not the root-level one this backend reads -
// the two happened to be identical when this was found, but are two
// distinct files on disk. A CSV upload has to overwrite both, or Model 1's
// server keeps scoring the old data while every other endpoint here uses
// the new one.
export const MODEL1_RAW_INVOICES_PATH = path.join(AI_MODELS_ROOT, 'data', 'raw', 'invoices.csv');

export const MODEL1_BASE_URL = process.env.MODEL1_BASE_URL ?? 'http://127.0.0.1:8000';
export const MODEL1_URL = process.env.MODEL1_URL ?? `${MODEL1_BASE_URL}/predict/open-invoices`;
export const MODEL1_RELOAD_URL = process.env.MODEL1_RELOAD_URL ?? `${MODEL1_BASE_URL}/reload-data`;

// Models 2, 7 and 8 - exposed as HTTP endpoints on the same Model 1 server
// (AI_models/main.py) instead of being called in-process, so this gateway
// never imports AI_models Python code directly.
export const SIMULATE_URL = process.env.SIMULATE_URL ?? `${MODEL1_BASE_URL}/simulate`;
export const RISK_GRAPH_URL = process.env.RISK_GRAPH_URL ?? `${MODEL1_BASE_URL}/risk-graph`;
export const RECOMMENDATIONS_URL =
  process.env.RECOMMENDATIONS_URL ?? `${MODEL1_BASE_URL}/recommendations`;

// Model 6 (LLM narration) - also on Model 1's server. Unlike the others this
// one reaches an external API (Groq) on every call, which is why the route
// in front of it is per-invoice and on demand rather than part of the
// dashboard payload.
export const NARRATE_URL = process.env.NARRATE_URL ?? `${MODEL1_BASE_URL}/narrate/invoice`;
export const NARRATE_LANGUAGES_URL =
  process.env.NARRATE_LANGUAGES_URL ?? `${MODEL1_BASE_URL}/narrate/languages`;

// Required for the pipeline to run at all - see routes/data.js's upload
// validation. Everything else in invoices.csv (actual_paid_date,
// days_to_payment, delay_vs_due_date, had_partial_payment_flag,
// is_big_ticket_spike) is only used for closed-invoice historical stats and
// degrades gracefully (as null) if missing, rather than breaking upload.
export const REQUIRED_INVOICE_COLUMNS = [
  'invoice_id', 'cust_number', 'customer_name', 'sector',
  'payment_term_days', 'invoice_amount', 'issue_date', 'due_date', 'status',
];

// Demo business parameters - see module docstring. Override with real
// figures once a real business's opening cash / daily burn is known.
//
// These are SWEPT, not chosen, and they are specific to whichever dataset
// the demo is pointed at. Re-run the sweep whenever that changes:
//
//     cd AI_models && uv run python data/sweep_demo_params.py --business B015
//
// Current dataset: business B015 of the generated set - 6,143 invoices,
// 230 customers, 491 open worth ~7.0 crore. Its expected inflow inside the
// 30-day horizon is heavily BACK-LOADED: only ~28 lakh arrives by day 18,
// then ~80 lakh more lands between day 18 and day 30. So the forecast's
// natural shape is a dip that recovers, and the burn rate has to be tuned
// against the trough rather than against the average.
//
// At 340_000/day cash troughs near 15.7 lakh on day 19, crosses the 20 lakh
// buffer around day 17, and recovers to ~55.6 lakh by day 30, with peak
// breach probability near 0.82. Neighbouring values fail in the two ways
// the previous dataset's tuning also had to avoid: 280_000 produces no
// breach at all (a flat, storyless line), while 360_000 pins breach
// probability at 0.95+ and a saturated gauge reads as broken rather than as
// a finding.
//
// The previous single-business dataset used 2_000_000 / 95_000 / 1_000_000.
// Those figures do not transfer - its receivables were an order of
// magnitude smaller.
export const DEFAULT_OPENING_CASH = Number(process.env.DEMO_OPENING_CASH ?? 5_000_000);
export const DEFAULT_DAILY_EXPENSE = Number(process.env.DEMO_DAILY_EXPENSE ?? 340_000);
export const DEFAULT_MIN_BUFFER = Number(process.env.DEMO_MIN_BUFFER ?? 2_000_000);
export const DEFAULT_N_SIMS = Number(process.env.DEMO_N_SIMS ?? 3000);

// Risk graph stays demo-legible instead of rendering the entire overdue
// backlog as one hairball - see AI_models/risk_graph/build_risk_graph.py.
export const RISK_GRAPH_MAX_FOCUS_INVOICES = Number(process.env.RISK_GRAPH_MAX_FOCUS_INVOICES ?? 6);

// MSMED Act 2006, Section 15: a buyer must pay an MSME supplier within the
// agreed term, and no agreed term can exceed 45 days from acceptance. A
// longer term written into the contract is unenforceable past this cap, so
// the statutory due date - not the invoice's own due_date - is the date a
// delay is legally measured from.
export const STATUTORY_TERM_DAYS = Number(process.env.STATUTORY_TERM_DAYS ?? 45);

// Section 16: interest on a delayed payment accrues at three times the bank
// rate notified by the RBI, compounded with monthly rests, and is owed
// automatically rather than on request.
//
// RBI_BANK_RATE must be checked against RBI's currently notified bank rate -
// it moves with monetary policy, and every interest figure this backend
// reports is wrong by the same proportion if it is stale.
export const RBI_BANK_RATE = Number(process.env.RBI_BANK_RATE ?? 0.06);
export const STATUTORY_INTEREST_MULTIPLE = Number(process.env.STATUTORY_INTEREST_MULTIPLE ?? 3);

// Section 2(n) defines a "supplier" as a MICRO or SMALL enterprise. A medium
// enterprise is not a supplier and cannot claim any of Chapter V - no 45-day
// cap, no Section 16 interest, no MSEFC referral. Showing a medium enterprise
// an interest entitlement would be showing it money it has no claim to, so
// this gates the whole statutory surface rather than decorating it.
//
// Placeholder until onboarding captures the real classification (Udyam
// registration is what establishes it - see Section 8(1)). 'small' is the
// permissive default purely so the demo dataset renders; a real deployment
// must not guess this.
export const ENTERPRISE_TIER = process.env.ENTERPRISE_TIER ?? 'small';

// A small enterprise that grows into medium keeps its Chapter V rights for
// three years from the date of upgradation. ISO date, or null if the
// business was never upgraded.
export const UPGRADED_TO_MEDIUM_ON = process.env.UPGRADED_TO_MEDIUM_ON ?? null;

// Limitation Act: a money claim is time-barred after three years, so
// interest forfeited on invoices settled longer ago than this is history,
// not a claim anyone can still file.
export const CLAIM_LIMITATION_YEARS = Number(process.env.CLAIM_LIMITATION_YEARS ?? 3);

export const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173'
).split(',');
