# bunq Split — Hackathon 7.0

A multimodal AI-powered bill splitter built on top of the bunq API. Point your phone at a restaurant receipt, let Claude extract the items, pick who's splitting, and send real bunq payment requests in one tap.

## How it works

1. **Home** — see Alice's recent transactions (Transactions tab) and shared groups (Groups tab)
2. **Transaction detail** — tap any transaction and add a receipt photo
3. **Camera** — capture or upload a receipt image
4. **Digital bill** — Claude Vision extracts line items automatically
5. **Split flow** — choose who splits, how (equal / by item / custom %), review the settlement plan
6. **Settlement** — send real bunq.me payment request links to each person

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |

You also need two API keys:

- **bunq Sandbox API key** — create a sandbox account and get a key at [tinker.bunq.com](https://tinker.bunq.com)
- **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

---

## 1. Clone and configure environment

```bash
git clone <repo-url>
cd BunqHackathon7
```

Copy the environment template and fill in your keys:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
BUNQ_API_KEY=sandbox_...
BUNQ_SANDBOX=true
BUNQ_MONETARY_ACCOUNT_ID=    # leave blank — auto-detected on first run
```

---

## 2. Install backend dependencies

```bash
cd backend
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

---

## 3. Run the one-time sandbox setup

This script provisions 5 sandbox users (Alice, Bob, Carlos, Dana, Eva), funds each with €500 from the bunq sugar daddy, creates 5 demo payments from Alice, and seeds the default groups.

```bash
cd backend          # must run from inside backend/
python setup_sandbox.py
```

Expected output (abbreviated):

```
============================================================
bunq Sandbox Setup
============================================================

[1/3] Provisioning sandbox users...
  ✓ 5 users ready

[2/3] Creating demo transactions from Alice...
  ✓ Albert Heijn groceries → Bob (€62.40)
  ✓ Dinner at Restaurant Lastage → Carlos (€45.00)
  ✓ Airbnb Berlin accommodation → Dana (€180.00)
  ✓ Uber taxi to airport → Eva (€12.50)
  ✓ Movie tickets → Bob (€18.00)

[3/3] Seeding groups...
  ✓ Created group: 🏠 Roommates
  ✓ Created group: ✈️ Berlin Trip
============================================================
```

> You only need to run this once. Re-running is safe — it skips users and groups that already exist.

---

## 4. Start the backend

```bash
cd backend
uvicorn main:app --reload
```

The API runs on **http://localhost:8000**. Verify it's up:

```
GET http://localhost:8000/api/health
```

---

## 5. Install frontend dependencies

Open a new terminal:

```bash
cd frontend
npm install
```

---

## 6. Start the frontend

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

The Vite dev server proxies all `/api/*` requests to the backend on port 8000 — no extra config needed.

---

## Project structure

```
BunqHackathon7/
├── backend/
│   ├── main.py               # FastAPI app + lifespan
│   ├── routes.py             # All API endpoints
│   ├── bunq_service.py       # bunq API integration
│   ├── ai_extractor.py       # Claude Vision bill extraction
│   ├── sandbox_pool.py       # 5-user sandbox management
│   ├── groups_store.py       # Group JSON persistence
│   ├── setup_sandbox.py      # One-time setup script
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Screen router
│   │   ├── store/
│   │   │   └── tripStore.jsx # Global state (Context + Reducer)
│   │   ├── pages/            # One file per screen
│   │   └── components/       # Shared UI components
│   ├── package.json
│   └── vite.config.js
└── hackathon_toolkit/        # bunq SDK + example scripts
```

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/transactions?member_id=sp_0` | Alice's transaction list |
| `GET` | `/api/sandbox-users` | All 5 sandbox members with balances |
| `GET` | `/api/groups` | List groups |
| `POST` | `/api/groups` | Create a group |
| `POST` | `/api/extract-bill` | Upload receipt image → Claude extracts items |
| `POST` | `/api/request-payment` | Send bunq.me payment request |

---

## Running tests

**Backend:**

```bash
cd backend
pytest tests/ -v
```

**Frontend:**

```bash
cd frontend
npm test
```

---

## Sandbox users

After running `setup_sandbox.py`, five users are available:

| ID | Name | Role |
|----|------|------|
| `sp_0` | Alice | Main user (hardcoded) |
| `sp_1` | Bob | Contact |
| `sp_2` | Carlos | Contact |
| `sp_3` | Dana | Contact |
| `sp_4` | Eva | Contact |

Default groups:
- **Roommates** — Alice, Bob, Carlos
- **Berlin Trip** — Alice, Dana, Eva

---

## Troubleshooting

**`400 Bad Request` on payment creation**
Make sure the payment body only contains `amount`, `counterparty_alias`, and `description`. The `allow_bunqme` field belongs on `request-inquiry`, not `payment`.

**`bunq_context.json` / `sandbox_pool.json` session expired**
Delete both files and re-run `setup_sandbox.py` to reprovision fresh sessions.

**`ANTHROPIC_API_KEY` not set**
The `/api/extract-bill` endpoint requires `ANTHROPIC_API_KEY` in `backend/.env`. Bill extraction will fail with a 500 error without it.

**Port already in use**
- Backend default: 8000 — override with `uvicorn main:app --reload --port 8001`
- Frontend default: 5173 — Vite will auto-increment to 5174 if busy

**Transactions not showing**
The backend fetches real bunq transactions from the sandbox and falls back to 5 hardcoded demo items. If the sandbox pool isn't loaded, run `setup_sandbox.py` first, then restart the backend.
