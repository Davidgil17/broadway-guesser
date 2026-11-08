from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import engine, Base
from .ratelimit import RateLimitMiddleware
from .routers.game import router

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


# No public API docs: they only map the endpoints out for anyone probing them.
app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

# Added before CORS so CORS wraps it: a 429 still carries CORS headers and the
# browser can read it instead of reporting a network error.
app.add_middleware(RateLimitMiddleware)

# broadwayguesser.com is served as static files by GitHub Pages and calls this
# API cross-origin. The JSON POSTs preflight, so OPTIONS has to be answered too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://broadwayguesser.com", "https://www.broadwayguesser.com"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(router)

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/", include_in_schema=False)
async def serve_index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/archive", include_in_schema=False)
async def serve_archive():
    return FileResponse(FRONTEND_DIR / "archive.html")


@app.get("/leaderboard", include_in_schema=False)
async def serve_leaderboard():
    return FileResponse(FRONTEND_DIR / "leaderboard.html")
