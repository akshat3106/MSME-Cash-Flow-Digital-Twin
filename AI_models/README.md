---
title: CashTwin AI Layer
emoji: 📊
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

<!--
The YAML block above is required by Hugging Face Spaces (Docker SDK) and is
ignored everywhere else. app_port must match the Dockerfile's PORT/EXPOSE:
main.py builds its own loopback self-call URLs from $PORT, so a mismatch
makes /risk-graph fail-soft to anomaly_type "normal" instead of erroring.

GROQ_API_KEY must be set as a Space *Secret*, never committed - Spaces on
the free tier are public repositories.
-->

# AI Models & Intelligence Layer  
## MSME Cash-Flow Digital Twin

**Consent-Based Invoice Risk, Liquidity Forecasting & Working-Capital Resilience Platform**

This repository contains the complete specification and implementation of the **AI/ML Intelligence Layer** for the MSME Cash-Flow Digital Twin platform, built for the **Smart India Hackathon**.

The financial engine (cash balances, due dates, scenario math) remains fully deterministic and auditable.  
AI is layered on top **only** for:

- **Prediction** — When will this invoice actually be paid?
- **Detection** — What looks unusual?
- **Explanation** — Why is the model saying this?
- **Narration** — Turning numbers into plain language

AI never replaces core accounting logic. This clean separation is a deliberate architectural choice for explainability and audit-safety.

---

## Architecture Overview

```
Raw data (invoices, receivables, expenses, payment history)
        ↓
OCR + Validation                          (Model 4)
        ↓
Payment Behaviour Prediction              (Model 1)
        ↓
Probabilistic Cash-Flow Simulation        (Model 2)
        ↓
Risk & Anomaly Detection                  (Model 3)
        ↓
SHAP Explainability                       (Model 5)
        ↓
LLM Narration & Conversational Layer      (Model 6)
        ↓
Non-Debt-First Recommendation Ranker      (Model 7)
        ↓
Causal Risk Graph Builder                 (Model 8)
        ↓
Dashboard
```

| AI Layer                        | Responsibility                                      | Must NOT Do                     |
|--------------------------------|-----------------------------------------------------|---------------------------------|
| Payment Prediction (Random Forest) | Predict payment date distribution per invoice  | Decide loan approval            |
| Monte Carlo Simulation         | Turn distributions into cash-balance forecast      | Replace core cash formula       |
| Anomaly Detection              | Flag unusual expense/payment spikes                | Auto-block transactions         |
| OCR + Confidence Scoring       | Extract invoice fields + flag low-confidence       | Auto-correct without review     |
| SHAP Explainability            | Show which features drove a risk prediction        | Generate the prediction itself  |
| LLM (Groq / Llama 3.3 70B)     | Narrate computed numbers + answer Q&A              | Perform financial arithmetic    |
| Recommendation Ranker          | Transparently rank recovery options                | Opaque / autonomous decisioning |

---

## Models

### Model 1 — Payment Behaviour Prediction Engine
**Foundational model.** Every downstream module depends on it.

Predicts *when* each invoice will actually be paid as a probability distribution (P10 / P50 / P90) instead of trusting the stated “Net 30”.

- **Type**: `RandomForestRegressor` (200 trees). P10/P50/P90 are taken as
  percentiles across the individual trees' predictions, so the interval comes
  from the forest's own disagreement rather than a separate quantile objective.
  See `rf_quantile_predict()` in `model1_inference.py`.
- **Why Random Forest and not XGBoost**: because of INTERVAL CALIBRATION, not
  point accuracy. Benchmarked head-to-head with both as genuine quantile
  models - XGBoost using `reg:quantileerror` (pinball loss) at alpha
  0.1/0.5/0.9, Random Forest using the spread across its trees:

  | | MAE | P10-P90 coverage | Band width |
  |---|---|---|---|
  | Random Forest | 6.99 days | **82.6%** | 24.8 days |
  | XGBoost (quantile) | **6.67 days** | 65.6% | 16.1 days |

  XGBoost predicts the midpoint slightly better. But its interval is far too
  narrow: it contains the actual payment day only 65.6% of the time against a
  target of 80%. Random Forest lands at 82.6%. Since this product *shows the
  range* - the whole optimistic/expected/pessimistic forecast is built on it -
  an overconfident interval is a worse failure than a slightly less accurate
  midpoint. A band that is wrong a third of the time would make the cash-flow
  fan misleading rather than merely imprecise.

  (On the original single-business dataset Random Forest also won on point
  error, 7.27 vs 7.89 MAE - see `notebook/02_model_1_training.ipynb`. That
  advantage disappears at scale; calibration is the durable reason.)

  Reproduce: `uv run python benchmark_model1.py --only algorithms`
- **Key features**: Historical delay & variance, invoice amount, sector, recent
  payment trend, previous payment days, contractual term. All customer-history
  features are point-in-time (`.shift(1)` before any expanding/rolling window),
  so an invoice never sees its own outcome.
- **Cold-start**: Falls back to sector-average priors, shrinks thin history
  toward those priors, widens the P10-P90 interval, and flags confidence "low"
- **Output**: Per-invoice payment date range (P10, P50, P90) + confidence flag
- **Training**: `train_model1.py` (extracted from the notebooks so it is
  reproducible and can run across every business)

### Model 2 — Probabilistic Cash-Flow Simulation (Monte Carlo)
Converts per-invoice distributions into a full optimistic / expected / pessimistic cash-balance forecast and probability-based “Days to Liquidity Breach”.

- 2,000–5,000 vectorized draws
- Same engine powers baseline forecast **and** every what-if scenario
- Extremely lightweight (runs in well under a second)

### Model 3 — Anomaly & Volatility Detection
Flags unusual expenses, payments, or sudden behaviour shifts that a static dashboard would miss.

- Isolation Forest (unsupervised), trained per business on its own history
  (no labels required)
- Features are **deviations**, not raw values: an invoice is compared against
  that customer's own baseline and its sector's baseline, so a large invoice
  from a customer who always sends large invoices is not flagged
- Served from `anomaly/` + `api/anomaly_api.py`, reading the real invoice
  dataset. Note that `model3_anomaly_detection.py` in the repo root is an
  earlier standalone prototype on a 300-row toy table - nothing imports it,
  and it is not what runs.

### Model 4 — OCR Extraction & Confidence Scoring
Extracts structured fields from uploaded PDFs / images and surfaces low-confidence values for human review.

- PaddleOCR (preferred) or Tesseract + PyMuPDF for native PDFs
- Per-field confidence score → “needs verification” workflow
- Enables the “correctable financial AI” USP

### Model 5 — Explainability Engine (SHAP)
Produces ranked feature contributions for every risk prediction.

- SHAP TreeExplainer on the Random Forest model
- Structured output is fed to the LLM — the LLM never invents attributions

### Model 6 — LLM Narration & Conversational Layer
Turns structured model outputs into plain-language explanations and answers owner questions.

- **Model**: Llama 3.3 70B via Groq API
- **Strict role boundary**: LLM only narrates pre-computed numbers. It never performs arithmetic.
- System prompt explicitly forbids generating or altering numbers

### Model 7 — Non-Debt-First Recommendation Ranker
Transparently ranks recovery options (supplier extension, early payment, invoice financing, etc.) by cost, recovery time, and liquidity impact.

- Pure rule-based weighted multi-criteria scoring (no ML)
- Fully explainable by design — every ranked option shows its inputs in the UI

### Model 8 — Causal Risk Graph Builder
Builds a directed causal graph:  
`Customer → Delayed Payment → Cash Buffer Breach → Downstream Obligation at Risk`

- Deterministic graph construction (networkx optional on backend)
- Rendered with React Flow / D3 / Recharts on the frontend
- Most memorable visual for jury demos

---

## Dataset

The dataset is **generated, not collected** - this is a hackathon build and no
real MSME's receivables were used. `data/generate_invoices.py` is seeded and
parameterised, so every figure below is reproducible with one command:

```bash
uv run python data/generate_invoices.py     # 18 businesses
uv run python train_model1.py --all-businesses
```

| | |
|---|---|
| Businesses simulated | 18 (27 to 235 customers each) |
| Total invoices | 54,174 |
| Customers | 2,030 |
| Sectors | 10 |
| Split | time-based, 70 / 15 / 15 by issue date |

One CSV per business (`data/raw/businesses/`). This is deliberate: every
consumer in this project reads its whole input file and treats it as one
business's book, so a mixed multi-business file would not error - it would
silently forecast 18 companies' receivables against one company's opening
cash. `MODEL1_DATA_PATH` selects which business the server runs on.

The generator's parameters were **measured from the original dataset**, not
invented: per-archetype delay distributions, per-sector amount distributions,
payment-term weights and flag rates all reproduce the observed figures. Three
archetypes (`improving`, `deteriorating`, `seasonal`) are genuinely
time-dependent rather than static noise, and `erratic_payer` is deliberately
left hard to predict.

### Model 1 results

Trained independently per business (18 models):

| Metric | Range | Mean |
|---|---|---|
| Test MAE | 5.42 - 8.68 days | 7.37 |
| P10-P90 interval coverage | 73.9% - 85.6% | **81.5%** |

Coverage is the metric that matters most here: the P10-P90 band contains the
actual payment day 81.5% of the time against a theoretical target of 80%. That
calibration is what justifies presenting a range instead of a single date.

Scaling from one business (5,305 invoices) to eighteen (54,174) left the error
essentially unchanged - 7.27 days on the original single business, 7.37 mean
across eighteen. Accuracy did not improve with more self-generated data, which
is the expected result if the model is learning payment behaviour rather than
memorising one book.

Per-business figures: `evaluation/model1_per_business_metrics.csv`.

### Benchmarks

`benchmark_model1.py` answers the questions that would otherwise be assertions.

**Is per-business training actually necessary?** Train on business A, test on
business B:

| | Test MAE |
|---|---|
| Tested on its own business | 6.79 days |
| Tested on a different business | 9.53 days |
| Degradation | **+40.3%** |

A model transferred to a business it was not trained on is 40% worse. That is
the measurement behind the per-business architecture - each MSME's customers
have their own payment culture, and a shared model averages it away.

**Does more history help?** Learning curve on B015, training on growing
slices of its own history:

| History used | Rows | MAE | Coverage |
|---|---|---|---|
| 10% | 396 | 7.58 | 67.6% |
| 25% | 990 | 7.61 | 71.6% |
| 50% | 1,980 | 7.75 | 74.3% |
| 100% | 3,960 | 7.81 | **79.6%** |

Worth reading carefully: more data did **not** reduce point error - it drifts
slightly upward, because payment behaviour has an irreducible noise floor and
a few hundred invoices already reach it. What more data buys is *calibration*:
coverage climbs from 67.6% to 79.6%, landing on the 80% target. With thin
history the model is not less accurate, it is **overconfident** - and for a
product whose output is a range, that is the failure mode that matters.

**Did scaling the dataset make the problem easier?** Old single-business
dataset vs the new eighteen:

| | Train rows | MAE | Coverage | Band width |
|---|---|---|---|---|
| Old (1 business, 5,305 invoices) | 3,470 | 6.24 | 88.2% | 31.0 days |
| New (18 businesses, 54,174) | 35,039 | 7.37 | 81.5% | 25.3 days |

Error rose slightly, which is the honest outcome - eighteen differently-shaped
books are a harder problem than one. Meanwhile the interval got both tighter
(31.0 to 25.3 days) and better calibrated (88.2% to 81.5%, against a target of
80%). The old model was not more accurate so much as more cautious.

**Known limitation.** These numbers measure the pipeline end-to-end on
simulated data. They are not a claim about real-world accuracy, and the model
has not been validated against a real MSME's receivables.

---

## Tech Stack

| Layer              | Technology                          | Used By                  |
|--------------------|-------------------------------------|--------------------------|
| Core ML            | scikit-learn RandomForestRegressor | Model 1                  |
| Simulation         | NumPy vectorized Monte Carlo       | Model 2                  |
| Anomaly Detection  | scikit-learn IsolationForest       | Model 3                  |
| OCR                | PaddleOCR / Tesseract + PyMuPDF    | Model 4                  |
| Explainability     | SHAP TreeExplainer                 | Model 5                  |
| LLM                | Groq API – Llama 3.3 70B           | Model 6                  |
| Ranking            | Plain Python / pandas              | Model 7                  |
| Graph              | networkx + React Flow / D3         | Model 8                  |
| Serving            | FastAPI + Pydantic                 | All models               |
| Storage            | PostgreSQL                         | Training data, audit log |
| Async (optional)   | Redis + Celery                     | Background recompute     |

**Environment**
- Python 3.10+
- No GPU required (tree-based models + API-hosted LLM)
- Groq free tier is sufficient for hackathon demo volume

```bash
pip install scikit-learn shap numpy pandas \
            paddleocr pymupdf groq fastapi pydantic networkx
```

---

##Build Order (Hackathon Timeline)

| Priority       | Model                              | Reason                                      |
|----------------|------------------------------------|---------------------------------------------|
| **P0 **   | Sample dataset + Model 1          | Everything downstream depends on this       |
| **P0 **   | Model 2 (Monte Carlo)             | Core forecast & scenario engine             |
| **P1 **   | Model 7 (Recommendation Ranker)   | Simple, high demo value                     |
| **P1**    | Model 5 (SHAP)                    | Near-instant once Model 1 exists            |
| **P1**    | Model 6 (LLM Narration)           | Wraps SHAP + forecast into plain language   |
| **P2**    | Model 4 (OCR + Confidence)        | Needed for the “live correction” demo moment|
| **P2**    | Model 8 (Causal Risk Graph)       | Visualization layer                         |
| **P3**    | Model 3 (Anomaly Detection)       | Nice-to-have, not essential for core demo   |

> Generate the dataset **first** — every other model depends on it.
> `data/generate_invoices.py` now does this reproducibly; see the Dataset
> section above for the figures it currently produces.

---

## AI Unique Selling Points (USPs)

1. **Probabilistic forecasting, not a single guessed number**  
   Optimistic / expected / pessimistic bands come from a real model distribution, not a hardcoded ±20% rule.

2. **Causal risk graph instead of a risk score**  
   Judges remember a visual causal chain far longer than “82/100”.

3. **SHAP-linked explanations, not templated text**  
   Every explanation is traceable to real feature contributions.

4. **Live correction → live recompute**  
   Edit one OCR-imported value on stage and watch forecast, risk graph, and recommendations update in real time.

5. **Recovery ranked by time-to-safe-cash, not just cost**  
   Time-to-safe-position is a first-class metric.

6. **Confidence-aware AI, not false certainty**  
   Low-confidence OCR fields and cold-start predictions are explicitly flagged.

7. **Clean separation of arithmetic vs. AI**  
   Financial engine does the math. ML predicts & detects. LLM only narrates.  
   This architecture pre-empts the “is this just an LLM wrapper?” question.

---

## Suggested Project Structure

```
AI_models/
├── main.py                       # FastAPI server - every model's endpoints
├── model1_inference.py           # Model 1 features + prediction (shared with Model 5)
├── train_model1.py               # Model 1 training, one business or all
├── simulation/                   # Model 2 - Monte Carlo + quantile sampler
├── anomaly/                      # Model 3 - features, detector, explainer
├── api/anomaly_api.py            # Model 3 - endpoints (mounted into main.py)
├── ocr_extraction.py             # Model 4
├── model5_shap.py                # Model 5
├── model6_explanation.py         # Model 6 - Groq/Llama narration
├── model_7.py                    # Model 7 - recommendation ranker
├── risk_graph/                   # Model 8
├── model3_anomaly_detection.py   # legacy standalone prototype - NOT served
├── data/
│   ├── generate_invoices.py      # seeded dataset generator
│   ├── rebase_demo_dates.py      # repositions demo data onto "today"
│   ├── raw/businesses/           # one CSV per simulated MSME
│   └── processed/
├── models/                       # trained artifacts (joblib)
├── evaluation/                   # metrics, reports, charts
├── notebook/                     # exploration & original training notebooks
└── tests/
```

---

## License

This project is developed for the **Smart India Hackathon**.  
All rights reserved by the team.

---

**Prepared for**: AI/ML Development Track  
**Role**: AI Developer
