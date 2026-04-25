import sys
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "hackathon_toolkit"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    from bunq_service import init_bunq
    from sandbox_pool import get_pool
    init_bunq()
    # Auto-load sandbox pool if it's already been provisioned
    pool = get_pool()
    try:
        pool.load_or_provision()
    except Exception as e:
        print(f"Warning: could not load sandbox pool: {e}")
    yield


app = FastAPI(title="bunq Trip Splitter", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


from routes import router
app.include_router(router)
