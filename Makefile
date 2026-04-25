.PHONY: install setup backend frontend add-payments approve topup test test-backend test-frontend help

# ── Python detection ──────────────────────────────────────────────────────────
# Use venv Python if it exists; fall back to whatever python is in PATH.
# Windows venv uses Scripts/python.exe, Unix uses bin/python.
ifeq ($(OS),Windows_NT)
    _VENV_PY := backend/venv/Scripts/python.exe
else
    _VENV_PY := backend/venv/bin/python
endif

ifneq ($(wildcard $(_VENV_PY)),)
    PYTHON := $(abspath $(_VENV_PY))
else
    PYTHON := python
endif

# Absolute path so 'cd backend && $(PYTHON) ...' still resolves correctly
PYTHON := $(abspath $(PYTHON))

.DEFAULT_GOAL := help

# ── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo.
	@echo   bunq Split  /  Hackathon 7.0
	@echo.
	@echo   First-time setup
	@echo     make install        Install all dependencies
	@echo     make setup          Provision sandbox users + seed demo data
	@echo.
	@echo   Run the app  ^(two terminals^)
	@echo     make backend        API server  -^>  http://localhost:8000
	@echo     make frontend       React UI    -^>  http://localhost:5173
	@echo.
	@echo   Demo scripts
	@echo     make add-payments   Add 3 more demo transactions to Alice
	@echo     make approve        Approve all pending payment requests
	@echo     make topup          Add 500 euro to Alice^'s account
	@echo.
	@echo   Tests
	@echo     make test           Backend + frontend tests
	@echo     make test-backend   pytest only
	@echo     make test-frontend  vitest only
	@echo.

# ── First-time install ────────────────────────────────────────────────────────
install:
	python -m venv backend/venv
	$(abspath $(_VENV_PY)) -m pip install --upgrade pip -q
	$(abspath $(_VENV_PY)) -m pip install -r backend/requirements.txt
	cd frontend && npm install
	@echo.
	@echo   Done. Copy backend\.env.example to backend\.env and add your API keys.
	@echo   Then run: make setup
	@echo.

# ── One-time sandbox setup ────────────────────────────────────────────────────
setup:
	cd backend && $(PYTHON) setup_sandbox.py

# ── Servers (run in separate terminals) ───────────────────────────────────────
backend:
	cd backend && $(PYTHON) -m uvicorn main:app --reload

frontend:
	cd frontend && npm run dev

# ── Demo scripts ──────────────────────────────────────────────────────────────
add-payments:
	cd backend && $(PYTHON) add_demo_payments.py

approve:
	cd backend && $(PYTHON) approve_requests.py --all

topup:
	cd backend && $(PYTHON) topup.py

# ── Tests ─────────────────────────────────────────────────────────────────────
test-backend:
	cd backend && $(PYTHON) -m pytest tests/ -v

test-frontend:
	cd frontend && npm test

test: test-backend test-frontend
