const THEME_KEY = 'broadway_theme';

function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'classic');
}

function applyTheme(name) {
  document.documentElement.dataset.theme = name;
  localStorage.setItem(THEME_KEY, name);
  document.querySelectorAll('.theme-option').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === name);
  });
}

function openThemePicker() {
  document.getElementById('theme-modal').style.display = 'flex';
}

function closeThemePicker() {
  document.getElementById('theme-modal').style.display = 'none';
}

// Absolute so the Pages copy on broadwayguesser.com can reach the API, which is
// only served from the VM. Resolves same-origin when served from the VM itself.
const API_BASE = 'https://broadway.dg.darrigozik.com';
const CANONICAL_HOST = 'broadwayguesser.com';

const TODAY = new Date().toISOString().slice(0, 10);
const urlDate = new URLSearchParams(window.location.search).get('date');
let activeDate = (urlDate && urlDate <= TODAY) ? urlDate : TODAY;

const ALL_BROADWAY_SHOWS = [
  "& Juliet",
  "1776",
  "9 to 5: The Musical",
  "42nd Street",
  "A Beautiful Noise",
  "A Chorus Line",
  "A Christmas Story: The Musical",
  "A Funny Thing Happened on the Way to the Forum",
  "A Gentleman's Guide to Love and Murder",
  "A Little Night Music",
  "A Strange Loop",
  "Aida",
  "Ain't Misbehavin'",
  "Ain't Too Proud",
  "Aladdin",
  "Allegro",
  "Almost Famous",
  "American Idiot",
  "Amélie",
  "An American in Paris",
  "Anastasia",
  "Annie",
  "Annie Get Your Gun",
  "Anything Goes",
  "Applause",
  "Assassins",
  "Avenue Q",
  "Bandstand",
  "Barnum",
  "Beautiful: The Carole King Musical",
  "Beauty and the Beast",
  "Beetlejuice",
  "Bells Are Ringing",
  "Big River",
  "Billy Elliot",
  "Blood Brothers",
  "Bloody Bloody Andrew Jackson",
  "Bonnie & Clyde",
  "Boop! The Musical",
  "Brigadoon",
  "Bright Star",
  "Bring It On: The Musical",
  "Buena Vista Social Club",
  "Bullets Over Broadway",
  "Bye Bye Birdie",
  "Cabaret",
  "Camelot",
  "Can-Can",
  "Candide",
  "Caroline, or Change",
  "Carousel",
  "Catch Me If You Can",
  "Cats",
  "Charlie and the Chocolate Factory",
  "Chess",
  "Chicago",
  "City of Angels",
  "Come From Away",
  "Company",
  "Crazy for You",
  "Curtains",
  "Damn Yankees",
  "Days of Wine and Roses",
  "Dead Outlaw",
  "Dear Evan Hansen",
  "Death Becomes Her",
  "Diana",
  "Dirty Rotten Scoundrels",
  "Dreamgirls",
  "Elf the Musical",
  "Escape to Margaritaville",
  "Evita",
  "Falsettos",
  "Fela!",
  "Fiddler on the Roof",
  "Finian's Rainbow",
  "Fiorello!",
  "Flower Drum Song",
  "Floyd Collins",
  "Follies",
  "Footloose",
  "Frozen",
  "Fun Home",
  "Funny Girl",
  "Gentlemen Prefer Blondes",
  "Ghost the Musical",
  "Girl from the North Country",
  "Godspell",
  "Grand Hotel",
  "Grease",
  "Grey Gardens",
  "Groundhog Day",
  "Gutenberg! The Musical!",
  "Guys and Dolls",
  "Gypsy",
  "Hadestown",
  "Hair",
  "Hairspray",
  "Hamilton",
  "Harmony",
  "Head Over Heels",
  "Hell's Kitchen",
  "Hello, Dolly!",
  "Here Lies Love",
  "Holiday Inn",
  "Honeymoon in Vegas",
  "How to Succeed in Business Without Really Trying",
  "If/Then",
  "Illinoise",
  "In the Heights",
  "Into the Woods",
  "Jagged Little Pill",
  "Jekyll & Hyde",
  "Jelly's Last Jam",
  "Jersey Boys",
  "Jesus Christ Superstar",
  "Joseph and the Amazing Technicolor Dreamcoat",
  "Just in Time",
  "Kimberly Akimbo",
  "King Kong",
  "Kinky Boots",
  "Kiss Me, Kate",
  "Kiss of the Spider Woman",
  "La Cage aux Folles",
  "Lady in the Dark",
  "Legally Blonde",
  "Lempicka",
  "Les Misérables",
  "Little Shop of Horrors",
  "Little Women",
  "Mack & Mabel",
  "Mame",
  "Mamma Mia!",
  "Man of La Mancha",
  "Mary Poppins",
  "Matilda",
  "Maybe Happy Ending",
  "Me and My Girl",
  "Mean Girls",
  "Memphis",
  "Merrily We Roll Along",
  "Million Dollar Quartet",
  "Miss Saigon",
  "MJ: The Musical",
  "Monty Python's Spamalot",
  "Motown the Musical",
  "Moulin Rouge!",
  "Movin' Out",
  "Mr. Saturday Night",
  "Mrs. Doubtfire",
  "My Fair Lady",
  "My One and Only",
  "Natasha, Pierre & The Great Comet of 1812",
  "New York, New York",
  "Newsies",
  "Next to Normal",
  "Nice Work If You Can Get It",
  "Nine",
  "Oklahoma!",
  "Oliver!",
  "On the Town",
  "On the Twentieth Century",
  "On Your Feet!",
  "Once",
  "Once on This Island",
  "Once Upon a Mattress",
  "Operation Mincemeat",
  "Pacific Overtures",
  "Pal Joey",
  "Parade",
  "Paradise Square",
  "Passing Strange",
  "Passion",
  "Pippin",
  "Pirates! The Penzance Musical",
  "Porgy and Bess",
  "Pretty Woman: The Musical",
  "Priscilla Queen of the Desert",
  "Promises, Promises",
  "Ragtime",
  "Raisin",
  "Real Women Have Curves",
  "Redwood",
  "Rent",
  "Rock of Ages",
  "Rocky",
  "School of Rock",
  "Seussical",
  "She Loves Me",
  "Shenandoah",
  "Show Boat",
  "Shrek the Musical",
  "Shucked",
  "Side Show",
  "Sister Act",
  "Six",
  "Smash",
  "Smokey Joe's Cafe",
  "Some Like It Hot",
  "Something Rotten!",
  "South Pacific",
  "SpongeBob SquarePants: The Broadway Musical",
  "Spring Awakening",
  "Starlight Express",
  "Steel Pier",
  "Suffs",
  "Summer: The Donna Summer Musical",
  "Sunday in the Park with George",
  "Sunset Boulevard",
  "Sweeney Todd",
  "Sweet Charity",
  "Swept Away",
  "Tammy Faye",
  "Tarzan",
  "The 25th Annual Putnam County Spelling Bee",
  "The Addams Family",
  "The Apple Tree",
  "The Band's Visit",
  "The Book of Mormon",
  "The Bridges of Madison County",
  "The Cher Show",
  "The Color Purple",
  "The Drowsy Chaperone",
  "The Full Monty",
  "The Great Gatsby",
  "The Heart of Rock and Roll",
  "The King and I",
  "The Last Ship",
  "The Light in the Piazza",
  "The Lion King",
  "The Little Mermaid",
  "The Most Happy Fella",
  "The Music Man",
  "The Mystery of Edwin Drood",
  "The Notebook",
  "The Outsiders",
  "The Pajama Game",
  "The Phantom of the Opera",
  "The Producers",
  "The Prom",
  "The Scarlet Pimpernel",
  "The Scottsboro Boys",
  "The Secret Garden",
  "The Sound of Music",
  "The Wedding Singer",
  "The Who's Tommy",
  "The Wiz",
  "Thoroughly Modern Millie",
  "Tick, Tick... Boom!",
  "Tina: The Tina Turner Musical",
  "Titanic",
  "Tootsie",
  "Tuck Everlasting",
  "Two Gentlemen of Verona",
  "Urinetown",
  "Victor/Victoria",
  "Waitress",
  "War Paint",
  "Water for Elephants",
  "West Side Story",
  "Wicked",
  "Wonderful Town",
  "Xanadu",
  "Young Frankenstein",
  "Zorba",
];

let allShows = ALL_BROADWAY_SHOWS;
let todayData = null;
let state = loadState();
let activeDropdownIndex = -1;

const STATS_KEY = 'broadway_stats';
const PLAYER_KEY = 'broadway_player';

function storageKey() { return `broadway_${activeDate}`; }
function isArchiveMode() { return activeDate !== TODAY; }

function getPlayer() {
  const raw = localStorage.getItem(PLAYER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setPlayer(data) {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(data));
}

// The id the server counts guesses under. A registered player's uuid, or an id
// made on first visit that registration later adopts, so games played before
// picking a name still reach the leaderboard.
const ANON_ID_KEY = 'broadway_anon_id';
function getPlayerId() {
  const player = getPlayer();
  if (player && player.uuid) return player.uuid;
  let id = localStorage.getItem(ANON_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, id);
  }
  return id;
}

function collectHistory() {
  const history = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith('broadway_')) continue;
    const dateStr = key.replace('broadway_', '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    try {
      const s = JSON.parse(localStorage.getItem(key));
      if (s.solved || s.guessesUsed >= 5) {
        history.push({ date: dateStr, solved: !!s.solved, guesses_used: s.guessesUsed || 0, score: s.score || 0 });
      }
    } catch {}
  }
  return history;
}

async function handleLeaderboard() {
  const player = getPlayer();
  if (!player || !player.uuid) {
    openNamePrompt();
  } else if (!state.scoreSent) {
    state.scoreSent = true;
    saveState();
    try {
      await fetch(`${API_BASE}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: player.uuid, date: activeDate, solved: state.solved, guesses_used: state.guessesUsed, score: state.score || 0 }),
      });
    } catch {}
  }
}

async function registerPlayer(name) {
  const uuid = getPlayerId();
  const history = collectHistory();
  const res = await fetch(`${API_BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, name, history }),
  });
  if (!res.ok) {
    const err = new Error('Registration failed');
    if (res.status === 409) {
      // A taken name is the player's to fix, so the server's wording is shown.
      const detail = await res.json().then(d => d.detail).catch(() => null);
      if (typeof detail === 'string') err.userMessage = detail;
    }
    throw err;
  }
  setPlayer({ uuid, name });
}

function openNamePrompt() {
  document.getElementById('name-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('name-input').focus(), 50);
}

function closeNamePrompt() {
  document.getElementById('name-modal').style.display = 'none';
}

function loadState() {
  const raw = localStorage.getItem(storageKey());
  if (raw) return JSON.parse(raw);
  return { guessesUsed: 0, solved: false, score: 0, guesses: [], answer: null, statsRecorded: false, leaderboardHandled: false, scoreSent: false };
}

function saveState() {
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

function loadStats() {
  const raw = localStorage.getItem(STATS_KEY);
  if (raw) return JSON.parse(raw);
  return { played: 0, won: 0, currentStreak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0] };
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

// localStorage is per-origin, so a player moving from the VM host to
// broadwayguesser.com would otherwise arrive with a reset streak. The old origin
// hands the identity over in the URL fragment, which never reaches the server.
function carryUrl() {
  const player = getPlayer();
  const payload = { s: loadStats() };
  if (player && player.uuid) {
    payload.u = player.uuid;
    payload.n = player.name;
  }
  return `https://${CANONICAL_HOST}/#carry=${encodeURIComponent(JSON.stringify(payload))}`;
}

function adoptCarriedProgress() {
  const match = /(?:^|&)carry=([^&]+)/.exec(window.location.hash.slice(1));
  if (!match) return;
  history.replaceState(null, '', window.location.pathname + window.location.search);

  let payload;
  try { payload = JSON.parse(decodeURIComponent(match[1])); } catch { return; }

  if (payload.u && !getPlayer()) setPlayer({ uuid: payload.u, name: payload.n || 'Player' });
  if (payload.s && loadStats().played === 0) saveStats(payload.s);
}

function showMoveBanner() {
  const host = window.location.hostname;
  if (host === CANONICAL_HOST || host === `www.${CANONICAL_HOST}`) return;
  if (host === 'localhost' || host === '127.0.0.1') return;
  if (loadStats().played === 0 && !getPlayer()) return;

  const bar = document.createElement('div');
  bar.className = 'move-banner';
  const link = document.createElement('a');
  link.href = carryUrl();
  link.textContent = 'Play at broadwayguesser.com →';
  // Rebuilt on click so a game finished since page load is carried too.
  link.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = carryUrl();
  });
  bar.append('We moved. ', link, ' Your streak comes with you.');
  document.getElementById('app').prepend(bar);
}

function recordGameStats(won, guessesUsed) {
  if (state.statsRecorded) return;
  const stats = loadStats();
  stats.played += 1;
  if (won) {
    stats.won += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.distribution[guessesUsed - 1] += 1;
  } else {
    stats.currentStreak = 0;
  }
  saveStats(stats);
  state.statsRecorded = true;
  saveState();
}

function openStats() {
  const stats = loadStats();
  document.getElementById('stat-played').textContent = stats.played;
  document.getElementById('stat-winpct').textContent =
    stats.played ? Math.round((stats.won / stats.played) * 100) : 0;
  document.getElementById('stat-streak').textContent = stats.currentStreak;
  document.getElementById('stat-maxstreak').textContent = stats.maxStreak;

  const dist = document.getElementById('stats-distribution');
  dist.innerHTML = '';
  const max = Math.max(...stats.distribution, 1);
  stats.distribution.forEach((count, i) => {
    const row = document.createElement('div');
    row.className = 'dist-row';
    const pct = Math.max(Math.round((count / max) * 100), count > 0 ? 8 : 0);
    row.innerHTML = `
      <span class="dist-label">${i + 1}</span>
      <div class="dist-bar-wrap">
        <div class="dist-bar${count > 0 ? ' dist-bar-filled' : ''}" style="width:${pct}%">${count}</div>
      </div>`;
    dist.appendChild(row);
  });

  document.getElementById('stats-modal').style.display = 'flex';
}

function closeStats() {
  document.getElementById('stats-modal').style.display = 'none';
}

async function loadGame(date) {
  activeDate = date;
  state = loadState();

  document.getElementById('date-display').textContent = new Date(activeDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('archive-banner').style.display = isArchiveMode() ? 'flex' : 'none';

  const res = await fetch(`${API_BASE}/api/show/${activeDate}`);

  if (!res.ok) {
    document.getElementById('no-show-message').style.display = 'block';
    document.getElementById('game-area').style.display = 'none';
    return;
  }

  document.getElementById('no-show-message').style.display = 'none';
  document.getElementById('game-area').style.display = 'block';
  todayData = await res.json();

  document.getElementById('clues-container').innerHTML = '';
  document.getElementById('end-section').style.display = 'none';
  document.getElementById('feedback-message').textContent = '';
  document.getElementById('feedback-message').className = '';

  render();
}

async function syncHistory() {
  const player = getPlayer();
  if (!player || !player.uuid) return;

  const keys = [];
  for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));

  for (const key of keys) {
    if (!key.startsWith('broadway_')) continue;
    const dateStr = key.replace('broadway_', '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

    let s;
    try { s = JSON.parse(localStorage.getItem(key)); } catch { continue; }

    if (!s.scoreSent && (s.solved || s.guessesUsed >= 5)) {
      try {
        const res = await fetch(`${API_BASE}/api/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uuid: player.uuid, date: dateStr, solved: !!s.solved, guesses_used: s.guessesUsed || 0, score: s.score || 0 }),
        });
        if (res.ok) {
          s.scoreSent = true;
          localStorage.setItem(key, JSON.stringify(s));
        }
      } catch {}
    }
  }
}

async function init() {
  await loadGame(activeDate);
  syncHistory();
}

function render() {
  renderClues();
  updateScoreDisplay();

  const gameOver = state.solved || state.guessesUsed >= 5;
  document.getElementById('input-section').style.display = gameOver ? 'none' : 'block';
  document.getElementById('end-section').style.display = gameOver ? 'block' : 'none';

  if (gameOver) {
    if (!isArchiveMode()) recordGameStats(state.solved, state.guessesUsed);
    renderEndState();
    if (!isArchiveMode()) startCountdown();
    document.getElementById('countdown-timer').style.display = isArchiveMode() ? 'none' : 'block';
    if (!state.leaderboardHandled) {
      state.leaderboardHandled = true;
      saveState();
    }
    handleLeaderboard();
  } else {
    const remaining = 5 - state.guessesUsed;
    document.getElementById('guesses-remaining').textContent =
      `${remaining} guess${remaining === 1 ? '' : 'es'} remaining`;
  }
}

function renderClues() {
  const container = document.getElementById('clues-container');
  const prevCount = container.children.length;
  const count = Math.min(state.guessesUsed + 1, 5);

  if (container.children.length === count) return;
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const clue = todayData.clues[i];
    const card = document.createElement('div');
    card.className = 'clue-card' + (i === count - 1 && count > prevCount ? ' new' : '');
    card.innerHTML = `<div class="clue-label">${clue.category}</div><div class="clue-value">${clue.value}</div>`;
    container.appendChild(card);
  }
}

function updateScoreDisplay() {
  const stars = document.getElementById('score-stars');
  if (!state.solved) { stars.textContent = ''; return; }
  stars.textContent = '★'.repeat(state.score) + '☆'.repeat(5 - state.score);
}

function renderEndState() {
  const msg = document.getElementById('end-message');
  if (state.solved) {
    msg.textContent = `You got it in ${state.guessesUsed} clue${state.guessesUsed === 1 ? '' : 's'} — ${state.score} point${state.score === 1 ? '' : 's'}! 🎭`;
  } else {
    msg.textContent = `The answer was "${state.answer}" — better luck tomorrow!`;
  }

  if (todayData) {
    const container = document.getElementById('clues-container');
    container.innerHTML = '';
    for (const clue of todayData.clues) {
      const card = document.createElement('div');
      card.className = 'clue-card';
      card.innerHTML = `<div class="clue-label">${clue.category}</div><div class="clue-value">${clue.value}</div>`;
      container.appendChild(card);
    }
  }

  document.getElementById('share-btn').addEventListener('click', shareResult);
  loadDayStats();
}

/* ── how everyone did ──────────────────────────────────────────────────────
   A player wrote in asking for this. Only ever loaded once the game is over,
   so it cannot colour how someone plays, and every failure is silent: the
   panel is a bonus and must not take the results screen with it. */

let dayStatsFor = null;

async function loadDayStats() {
  if (dayStatsFor === activeDate) return;
  const date = activeDate;
  dayStatsFor = date;
  // Stale numbers from the previously viewed day must not sit under the new
  // result while this request is in flight.
  document.getElementById('day-stats').style.display = 'none';

  let data;
  try {
    const res = await fetch(`${API_BASE}/api/day-stats/${date}`);
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return;
  }
  // Archive navigation can change the day mid-flight.
  if (dayStatsFor === date && activeDate === date) renderDayStats(data);
}

function statRow(label, count, max, isMine) {
  // A zero bar still needs to be visible as a zero, hence the floor.
  const width = count ? Math.max((count / max) * 100, 8).toFixed(1) : 0;
  return `<div class="ds-row${isMine ? ' is-mine' : ''}">
      <span class="ds-key">${label}</span>
      <span class="ds-track"><span class="ds-bar" style="width:${width}%"></span></span>
      <span class="ds-n">${count}</span>
    </div>`;
}

function renderDayStats(d) {
  const el = document.getElementById('day-stats');
  if (!d.players) return;

  const lost = d.players - d.solved;
  const max = Math.max(...d.distribution, lost, 1);
  // The row to highlight: clues used if they won, the X row if they did not.
  const mine = state.solved ? state.guessesUsed : 0;

  const rows = d.distribution.map((n, i) => statRow(String(i + 1), n, max, mine === i + 1));
  if (lost) rows.push(statRow('✕', lost, max, mine === 0));

  const pct = Math.round((d.solved / d.players) * 100);
  const summary = d.players === 1
    ? `You're the first to finish ${isArchiveMode() ? 'this one' : 'today'}.`
    : `${d.solved} of ${d.players} solved it (${pct}%)`
      + (d.avg_guesses ? ` · ${d.avg_guesses} clues on average` : '');

  el.innerHTML = `
    <div class="ds-title">How everyone did ${isArchiveMode() ? 'that day' : 'today'}</div>
    <div class="ds-sub">${summary}</div>
    <div class="ds-rows">${rows.join('')}</div>`;
  el.style.display = 'block';
}

function shareResult() {
  const filled = state.solved ? state.score : 0;
  const grid = '⭐'.repeat(filled) + '⬛'.repeat(5 - filled);
  const guessLine = state.solved
    ? `Got it in ${state.guessesUsed} guess${state.guessesUsed === 1 ? '' : 'es'}!`
    : `Didn't get it today`;
  const text = `Broadway Guesser ${activeDate}\n${guessLine} ${grid}`;

  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      const confirm = document.getElementById('share-confirm');
      confirm.style.display = 'block';
      setTimeout(() => { confirm.style.display = 'none'; }, 2000);
    });
  }
}

function startCountdown() {
  const el = document.getElementById('countdown-timer');
  function update() {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    const diff = midnight - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `Next show in ${h}h ${m}m ${s}s`;
  }
  update();
  setInterval(update, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  adoptCarriedProgress();
  initTheme();
  showMoveBanner();

  document.getElementById('theme-fab').addEventListener('click', openThemePicker);
  document.getElementById('theme-close').addEventListener('click', closeThemePicker);
  document.getElementById('theme-overlay').addEventListener('click', closeThemePicker);
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => { applyTheme(btn.dataset.theme); closeThemePicker(); });
  });

  document.getElementById('stats-btn').addEventListener('click', openStats);
  document.getElementById('stats-close').addEventListener('click', closeStats);
  document.getElementById('stats-overlay').addEventListener('click', closeStats);

  document.getElementById('back-to-today').addEventListener('click', () => { window.location.href = '/'; });

  const nameInput = document.getElementById('name-input');
  const nameSubmit = document.getElementById('name-submit');
  const nameSkip = document.getElementById('name-skip');
  document.getElementById('name-overlay').addEventListener('click', closeNamePrompt);

  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameSubmit.click(); });

  nameSubmit.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) return;
    nameSubmit.disabled = true;
    nameSubmit.textContent = 'Saving…';
    const errEl = document.getElementById('name-error');
    try {
      await registerPlayer(name);
      closeNamePrompt();
    } catch (e) {
      errEl.textContent = e.userMessage || 'Something went wrong — please try again.';
      errEl.style.display = 'block';
      nameSubmit.disabled = false;
      nameSubmit.textContent = 'Join';
      if (e.userMessage) nameInput.select();
    }
  });

  nameSkip.addEventListener('click', () => {
    closeNamePrompt();
  });

  const input = document.getElementById('guess-input');
  const dropdown = document.getElementById('autocomplete-dropdown');
  const submitBtn = document.getElementById('submit-btn');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { closeDropdown(); return; }
    const matches = allShows.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) { closeDropdown(); return; }
    dropdown.innerHTML = '';
    activeDropdownIndex = -1;
    matches.forEach((title) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = title;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = title;
        closeDropdown();
      });
      dropdown.appendChild(item);
    });
    dropdown.classList.add('open');
  });

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeDropdownIndex = Math.min(activeDropdownIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === activeDropdownIndex));
      if (items[activeDropdownIndex]) input.value = items[activeDropdownIndex].textContent;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeDropdownIndex = Math.max(activeDropdownIndex - 1, -1);
      items.forEach((el, i) => el.classList.toggle('active', i === activeDropdownIndex));
      if (activeDropdownIndex >= 0 && items[activeDropdownIndex]) input.value = items[activeDropdownIndex].textContent;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      closeDropdown();
      submitGuess();
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  input.addEventListener('blur', () => setTimeout(closeDropdown, 150));
  submitBtn.addEventListener('click', submitGuess);

  function closeDropdown() {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    activeDropdownIndex = -1;
  }
});

async function submitGuess() {
  const input = document.getElementById('guess-input');
  const guess = input.value.trim();
  if (!guess) return;

  const feedback = document.getElementById('feedback-message');

  let res, result;
  try {
    res = await fetch(`${API_BASE}/api/guess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: activeDate, guess, guesses_used: state.guessesUsed + 1, uuid: getPlayerId() }),
    });
    result = await res.json();
  } catch {
    feedback.className = 'error';
    feedback.textContent = `Couldn't reach the server. Try again.`;
    return;
  }

  if (res.status === 409 && result.detail) {
    // The server already has a finished game for this date: restore it.
    const done = result.detail;
    state.guessesUsed = done.guesses_used;
    state.solved = done.solved;
    state.score = done.score;
    state.answer = done.answer;
    feedback.className = done.solved ? '' : 'error';
    feedback.textContent = done.message;
    input.value = '';
    saveState();
    render();
    return;
  }
  if (!res.ok) {
    // Not counted (rate limited or rejected), so the guess is not used up.
    feedback.className = 'error';
    feedback.textContent = res.status === 429
      ? 'Too many guesses too fast. Wait a moment and try again.'
      : `That guess couldn't be checked. Try again.`;
    return;
  }

  // The server counts guesses; follow its count if it differs from ours.
  const guessesUsed = Math.max(result.guesses_used || 0, state.guessesUsed + 1);
  state.guessesUsed = guessesUsed;
  state.guesses.push(guess);

  if (result.correct) {
    state.solved = true;
    state.score = result.score;
    state.answer = result.answer;
    feedback.textContent = '';
    saveState();
    render();
  } else {
    if (result.answer) {
      state.answer = result.answer;
    }
    feedback.className = 'error';
    feedback.textContent = guessesUsed < 5
      ? `Not quite — here's your next clue.`
      : `Out of guesses!`;
    input.classList.add('shake');
    input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });
    input.value = '';
    saveState();
    render();
  }
}

init();
