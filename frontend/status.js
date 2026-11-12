// Maintenance gate.
//
// The flag is served from GitHub Pages rather than the VM because it has to
// survive the thing it reports on: the API host and the machine terminating its
// TLS go down together, so a flag served from either is unreachable exactly when
// it matters. See the Davidgil17/status repo.

const STATUS_URL = 'https://davidgil17.github.io/status/status.json';
const STATUS_APP_KEY = 'broadway-guesser';
const STATUS_TIMEOUT_MS = 2500;

// A published notice outranks a guess, so once one renders the offline wording
// must not replace it.
let gateShown = null; // null | 'offline' | 'notice'

function renderGate(title, message, until, button, onClick) {
  // Replaces rather than stacks, so a notice arriving after the offline guess
  // upgrades the wording in place.
  document.getElementById('maintenance-gate')?.remove();

  const modal = document.createElement('div');
  modal.id = 'maintenance-gate';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText =
    'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.85)';

  // Themed through the variables rather than hardcoded colours, so the gate
  // doesn't flash white on a dark theme.
  const card = document.createElement('div');
  card.style.cssText =
    'position:relative;background:var(--surface);border:1px solid var(--border);' +
    'border-radius:var(--radius);padding:2rem 1.75rem;width:min(90vw,420px);text-align:center';

  const h = document.createElement('h2');
  h.textContent = title;
  h.style.cssText = 'font-size:1.1rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--gold)';

  const p = document.createElement('p');
  p.textContent = message;
  p.style.cssText = 'margin-top:1rem;color:var(--text);line-height:1.5';

  card.append(h, p);

  if (until) {
    const when = document.createElement('p');
    when.textContent = `Expected back by ${until.toLocaleString()}`;
    when.style.cssText = 'margin-top:0.75rem;color:var(--text-muted);font-size:0.9rem';
    card.append(when);
  }

  const btn = document.createElement('button');
  btn.textContent = button;
  btn.style.cssText =
    'margin-top:1.5rem;padding:0.7rem 1.5rem;border:none;border-radius:var(--radius);' +
    'background:var(--gold);color:var(--bg);font:inherit;font-weight:600;cursor:pointer';
  btn.addEventListener('click', onClick);
  card.append(btn);

  modal.append(overlay, card);
  document.body.append(modal);
}

/**
 * The hedged variant, for a fetch that threw. The same situation covers a
 * planned outage and a laptop with no wifi, and the page cannot tell which, so
 * it says so rather than blaming a server that may be fine.
 */
function showOfflineGate() {
  if (gateShown) return;
  gateShown = 'offline';
  renderGate(
    "Can't reach the server",
    "We couldn't connect. This might be your connection, or the server may be down for maintenance.",
    null,
    'Reload',
    () => location.reload(),
  );
}

/** Active either because someone said so, or because we are inside a published window. */
function activeNotice(app, now) {
  if (!app) return null;
  const from = app.from ? new Date(app.from) : null;
  const to = app.to ? new Date(app.to) : null;
  const inWindow =
    from && to && !isNaN(from) && !isNaN(to) && now >= from && now <= to;
  if (app.maintenance !== true && !inWindow) return null;
  return {
    title: app.title || 'Down for maintenance',
    message: app.message || 'The site is temporarily unavailable. Please try again later.',
    // Only meaningful while the window is the reason we're showing this; an
    // override with a stale window must not promise a time that passed.
    until: inWindow ? to : null,
  };
}

/**
 * Fired non-blocking at load, never awaited before first paint: this site works
 * today and must not start depending on github.io being reachable to render.
 *
 * Fails open on every error. The status host is independent of the API, so being
 * unable to read the flag says nothing about whether the API is up.
 */
async function maintenanceGate(appKey = STATUS_APP_KEY) {
  try {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), STATUS_TIMEOUT_MS);
    // Pages serves this with max-age=600, so a flag flip would take ten minutes
    // to reach anyone. Bucketing to the minute caps that at 60s while still
    // letting every load in the same minute share one cached copy.
    const bucket = Math.floor(Date.now() / 60000);
    const res = await fetch(`${STATUS_URL}?t=${bucket}`, { signal: abort.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const file = await res.json();
    const notice = activeNotice(file.apps && file.apps[appKey], new Date());
    if (!notice) return;
    gateShown = 'notice';
    renderGate(notice.title, notice.message, notice.until, 'Reload', () => location.reload());
  } catch {
    // Fail open.
  }
}

maintenanceGate();
