# bunq Split — Hackathon 7.0

A multimodal AI-powered bill splitter built on the bunq API. Point your phone at a receipt, let Claude extract the items, choose who splits, and send real bunq payment requests in one tap. The app learns each person's ordering preferences over time and auto-suggests who ordered what on future bills.

**Flow:** Home → Transaction → Camera → Digital bill → Split target → Split method → Configure → Settlement → Sent (with live paid/pending status)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| GNU make | any |

> **Windows:** install `make` via [Chocolatey](https://chocolatey.org/) (`choco install make`) or use Git Bash which includes it.

Two API keys are required — get them before starting:

- **bunq Sandbox API key** — [tinker.bunq.com](https://tinker.bunq.com)
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)

---

## Quick start

```bash
# 1. Configure environment
cp backend/.env.example backend/.env
#    → edit backend/.env and fill in ANTHROPIC_API_KEY and BUNQ_API_KEY

# 2. Install everything
make install

# 3. Provision sandbox users, seed groups, create initial transactions
make setup

# 4. Terminal A — start the API
make backend

# 5. Terminal B — start the UI
make frontend
```

Open **http://localhost:5173** — Alice's balance and groups appear immediately.

---

## All make targets

```
make install        Install backend venv + pip deps + npm packages
make setup          One-time sandbox setup (provision users, seed data)

make backend        Start API server     http://localhost:8000
make frontend       Start React UI       http://localhost:5173

make add-payments   Add 3 more demo transactions to Alice's history
make approve        Approve all pending payment requests (friends pay up)

make test           Run backend (pytest) + frontend (vitest) tests
make test-backend   pytest only
make test-frontend  vitest only
```

---

## Demo scripts

### Add demo transactions

Each run of `make add-payments` creates 3 real bunq payments from Alice (cycles through 12 different merchants). Run it multiple times to build up a realistic transaction history.

```bash
make add-payments
# ✓ Albert Heijn groceries  → Bob    (€54.20)
# ✓ Dinner Café de Jaren    → Carlos (€38.50)
# ✓ Spotify subscription    → Dana   (€9.99)
```

### Approve payment requests

After splitting a bill in the app, friends' payment requests show as **pending** on the Sent screen. Run this script to simulate them paying:

```bash
make approve
# ✓ Bob paid €18.10 for 'Albert Heijn groceries'
# ✓ Carlos paid €12.80 for 'Albert Heijn groceries'
```

Then tap **Refresh** on the Sent screen — statuses update to **paid**.

To approve interactively (with a confirmation prompt):

```bash
cd backend && python approve_requests.py
```

---

## Environment variables

`backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...          # required — Claude Vision bill extraction
BUNQ_API_KEY=sandbox_...              # required — bunq sandbox API key
BUNQ_SANDBOX=true
BUNQ_MONETARY_ACCOUNT_ID=             # leave blank — auto-detected
```

---

## Project structure

```
BunqHackathon7/
├── Makefile
├── backend/
│   ├── main.py                 FastAPI app + lifespan
│   ├── routes.py               All API endpoints
│   ├── bunq_service.py         bunq API integration
│   ├── ai_extractor.py         Claude Vision bill extraction
│   ├── sandbox_pool.py         5-user sandbox management
│   ├── groups_store.py         Group JSON persistence
│   ├── splits_store.py         Split + payment status persistence
│   ├── preference_store.py     Per-group item preference history
│   ├── ai_suggester.py         Claude-powered assignment suggestions
│   ├── setup_sandbox.py        One-time sandbox setup script
│   ├── add_demo_payments.py    Adds 3 demo transactions per run
│   ├── approve_requests.py     Approves pending payment requests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx             Screen router
│   │   ├── store/tripStore.jsx Global state (Context + Reducer)
│   │   ├── pages/              One file per screen
│   │   └── components/         Shared UI components
│   ├── package.json
│   └── vite.config.js
└── hackathon_toolkit/          bunq SDK + example scripts
```

---

## Preference learning

When you split a bill by item, the app records who ordered what in `backend/preference_store.json`. After 2+ splits in the same group, it uses Claude to suggest assignments on the next bill — matching item names to each person's ordering history across categories (e.g. "Birra Moretti" → Bob, who always orders beer).

| Splits in group | Behaviour |
|-----------------|-----------|
| 0–1 | No suggestions — assign everything manually |
| 2+ | `✦ AI` badge appears on items that match someone's history |
| 5+ | High-confidence matches are pre-filled automatically |

Suggestions are silent: if the API fails or there's no history, the UI is unchanged. Any assignment you confirm — whether you accepted the suggestion or changed it — becomes the training data for the next split.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/sandbox-users` | Pool members + Alice's balance |
| `GET` | `/api/transactions?member_id=sp_0` | Alice's transaction list |
| `GET` | `/api/groups` | List groups with member details |
| `POST` | `/api/groups` | Create a group |
| `POST` | `/api/extract-bill` | Receipt image → Claude extracts items |
| `POST` | `/api/request-payment` | Create bunq.me payment request |
| `POST` | `/api/splits` | Record a completed split (stores item assignments for learning) |
| `GET` | `/api/splits/{split_id}` | Live paid/pending status for a split |
| `POST` | `/api/suggest-assignments` | Claude-powered item → person suggestions based on group history |

---

## Sandbox users

| ID | Name | Role |
|----|------|------|
| `sp_0` | Alice | Main user (always hardcoded) |
| `sp_1` | Bob | Contact |
| `sp_2` | Carlos | Contact |
| `sp_3` | Dana | Contact |
| `sp_4` | Eva | Contact |

Default groups seeded by `make setup`:
- **Roommates** — Alice, Bob, Carlos
- **Berlin Trip** — Alice, Dana, Eva

---

## Manual setup (without make)

<details>
<summary>Expand for step-by-step commands</summary>

```bash
# Backend
python -m venv backend/venv
source backend/venv/bin/activate        # Windows: backend\venv\Scripts\activate
pip install -r backend/requirements.txt

# Configure
cp backend/.env.example backend/.env    # then edit with your keys

# Provision sandbox
cd backend && python setup_sandbox.py

# Start backend
cd backend && python -m uvicorn main:app --reload

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

</details>

---

## Troubleshooting

**`bunq_context.json` / `sandbox_pool.json` session expired**
Delete both files and re-run `make setup` to get fresh sessions.

**`ANTHROPIC_API_KEY` not set**
Bill extraction (`/api/extract-bill`) and preference suggestions (`/api/suggest-assignments`) will 500. Set the key in `backend/.env`.

**App shows "Sandbox not set up"**
Run `make setup` first. The backend auto-loads the pool on startup once the file exists.

**Port already in use**
- Backend: `cd backend && python -m uvicorn main:app --reload --port 8001`
- Frontend: Vite auto-increments to 5174 if 5173 is busy

**`make` not found on Windows**
Install via Chocolatey: `choco install make` — or use Git Bash which bundles it.
