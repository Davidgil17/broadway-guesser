"""Rate limiting, kept in memory.

uvicorn runs a single worker, so one in-process table sees every request.
A restart clears it, which is fine for a limiter.

The app sits behind reverse proxies, so the TCP peer is always a proxy. The
visitor's address comes from X-Forwarded-For: each proxy appends the address
it received the request from, so the entry TRUSTED_PROXY_HOPS from the right
is the one our outermost trusted proxy saw. Entries further left are supplied
by the visitor and can be forged, so they are never used.

On this deployment the visitor's address never arrives. The outer proxy
(dz-core, which we do not control) strips X-Forwarded-For and adds nothing, so
our own Caddy sets it to just its peer and GET /api/whoami reports
192.168.122.1 for every request on the internet. No hop count recovers an
address that was never sent.

So these limits are one site-wide ceiling, not per-visitor fairness, and they
are sized for that: high enough that real traffic never reaches them, low
enough to stop a runaway client or a scraper. The original per-IP values would
have capped the whole site at ten registrations an hour.

The X-Forwarded-For logic stays because it is correct and costs nothing: if
dz-core is ever configured to forward the client address, per-IP buckets resume
by themselves and these limits should come back down. Verify with
GET /api/whoami, which shows the address actually being keyed on.

Nothing here is forgeable: because dz-core strips an inbound X-Forwarded-For,
a visitor cannot choose their own bucket.
"""

import os
import time
from collections import deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

TRUSTED_PROXY_HOPS = int(os.environ.get("TRUSTED_PROXY_HOPS", "2"))
ENABLED = os.environ.get("RATE_LIMIT", "on").lower() != "off"

# (method, path prefix) -> (max requests, window seconds). First match wins.
RULES: list[tuple[str, str, int, int]] = [
    # Lower than the rest on purpose: this is the one endpoint that sends mail,
    # so the ceiling is what stops the inbox being used as a megaphone.
    ("POST", "/api/feedback", 30, 3600),
    ("POST", "/api/register", 200, 3600),
    ("POST", "/api/guess", 300, 60),
    ("POST", "/api/scores", 300, 60),
    ("GET", "/api/", 1200, 60),
]

_hits: dict[tuple[str, str], deque] = {}
_last_sweep = 0.0


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        chain = [part.strip() for part in forwarded.split(",") if part.strip()]
        if chain:
            return chain[-TRUSTED_PROXY_HOPS] if len(chain) >= TRUSTED_PROXY_HOPS else chain[0]
    return request.client.host if request.client else "unknown"


def _rule_for(method: str, path: str):
    for rule_method, prefix, limit, window in RULES:
        if method == rule_method and path.startswith(prefix):
            return prefix, limit, window
    return None


def _sweep(now: float) -> None:
    """Drop buckets that have gone quiet so the table cannot grow forever."""
    global _last_sweep
    if now - _last_sweep < 300:
        return
    _last_sweep = now
    longest = max(window for *_, window in RULES)
    for key in [k for k, q in _hits.items() if not q or now - q[-1] > longest]:
        del _hits[key]


def check(ip: str, method: str, path: str, now: float | None = None) -> int | None:
    """Record a hit. Returns seconds to wait if over the limit, else None."""
    rule = _rule_for(method, path)
    if rule is None:
        return None
    prefix, limit, window = rule
    now = time.monotonic() if now is None else now
    _sweep(now)
    q = _hits.setdefault((ip, prefix), deque())
    while q and now - q[0] >= window:
        q.popleft()
    if len(q) >= limit:
        return max(1, int(window - (now - q[0])) + 1)
    q.append(now)
    return None


def reset() -> None:
    _hits.clear()


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if ENABLED and request.method != "OPTIONS":
            wait = check(client_ip(request), request.method, request.url.path)
            if wait is not None:
                return JSONResponse(
                    {"detail": "Too many requests. Try again shortly."},
                    status_code=429,
                    headers={"Retry-After": str(wait)},
                )
        return await call_next(request)
