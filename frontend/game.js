const TODAY = new Date().toISOString().slice(0, 10);
const urlDate = new URLSearchParams(window.location.search).get('date');
let activeDate = (urlDate && urlDate <= TODAY) ? urlDate : TODAY;

const ALL_BROADWAY_SHOWS = [
  "1776",
  "9 to 5: The Musical",
  "42nd Street",
  "A Chorus Line",
  "A Funny Thing Happened on the Way to the Forum",
  "A Gentleman's Guide to Love and Murder",
  "A Little Night Music",
  "Aida",
  "American Idiot",
  "Anastasia",
  "Annie",
  "Annie Get Your Gun",
  "Anything Goes",
  "Assassins",
  "Avenue Q",
  "Bandstand",
  "Barnum",
  "Beautiful: The Carole King Musical",
  "Beauty and the Beast",
  "Beetlejuice",
  "Big River",
  "Bloody Bloody Andrew Jackson",
  "Bonnie & Clyde",
  "Brigadoon",
  "Bring It On: The Musical",
  "Bye Bye Birdie",
  "Cabaret",
  "Caroline, or Change",
  "Carousel",
  "Cats",
  "Chicago",
  "City of Angels",
  "Come From Away",
  "Company",
  "Damn Yankees",
  "Dear Evan Hansen",
  "Dirty Rotten Scoundrels",
  "Dreamgirls",
  "Evita",
  "Fiddler on the Roof",
  "Follies",
  "Footloose",
  "Frozen",
  "Fun Home",
  "Funny Girl",
  "Godspell",
  "Grease",
  "Grey Gardens",
  "Groundhog Day",
  "Guys and Dolls",
  "Gypsy",
  "Hadestown",
  "Hair",
  "Hairspray",
  "Hamilton",
  "Hello, Dolly!",
  "How to Succeed in Business Without Really Trying",
  "In the Heights",
  "Into the Woods",
  "Jagged Little Pill",
  "Jersey Boys",
  "Jesus Christ Superstar",
  "Joseph and the Amazing Technicolor Dreamcoat",
  "Kinky Boots",
  "Kiss Me, Kate",
  "Kiss of the Spider Woman",
  "Les Misérables",
  "Little Shop of Horrors",
  "Little Women",
  "Mamma Mia!",
  "Man of La Mancha",
  "Matilda the Musical",
  "Mean Girls",
  "Merrily We Roll Along",
  "Million Dollar Quartet",
  "Miss Saigon",
  "MJ: The Musical",
  "Monty Python's Spamalot",
  "Moulin Rouge!",
  "Movin' Out",
  "My Fair Lady",
  "Natasha, Pierre & The Great Comet of 1812",
  "Newsies",
  "Next to Normal",
  "Nine",
  "Oklahoma!",
  "Once",
  "Pacific Overtures",
  "Pal Joey",
  "Parade",
  "Passion",
  "Pippin",
  "Ragtime",
  "Rent",
  "Rock of Ages",
  "Shrek the Musical",
  "Side Show",
  "Six",
  "Something Rotten!",
  "South Pacific",
  "SpongeBob SquarePants: The Broadway Musical",
  "Spring Awakening",
  "Starlight Express",
  "Sunday in the Park with George",
  "Sunset Boulevard",
  "Sweeney Todd",
  "Tarzan",
  "The Band's Visit",
  "The Book of Mormon",
  "The Color Purple",
  "The Full Monty",
  "The King and I",
  "The Light in the Piazza",
  "The Lion King",
  "The Music Man",
  "The Mystery of Edwin Drood",
  "The Phantom of the Opera",
  "The Scottsboro Boys",
  "The Secret Garden",
  "The Sound of Music",
  "The Wiz",
  "Thoroughly Modern Millie",
  "Titanic",
  "Tootsie",
  "Urinetown",
  "Victor/Victoria",
  "Waitress",
  "War Paint",
  "West Side Story",
  "Wicked",
  "Young Frankenstein",
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
  if (player === null && !isArchiveMode()) {
    openNamePrompt();
  } else if (player && player.uuid) {
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: player.uuid, date: activeDate, solved: state.solved, guesses_used: state.guessesUsed, score: state.score || 0 }),
      });
    } catch {}
  }
}

async function registerPlayer(name) {
  const uuid = crypto.randomUUID();
  const history = collectHistory();
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, name, history }),
  });
  if (!res.ok) throw new Error('Registration failed');
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
  return { guessesUsed: 0, solved: false, score: 0, guesses: [], answer: null, statsRecorded: false, leaderboardHandled: false };
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

  const res = await fetch(`/api/show/${activeDate}`);

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

async function init() {
  await loadGame(activeDate);
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
      handleLeaderboard();
    }
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
    } catch {
      errEl.textContent = 'Something went wrong — please try again.';
      errEl.style.display = 'block';
      nameSubmit.disabled = false;
      nameSubmit.textContent = 'Join';
    }
  });

  nameSkip.addEventListener('click', () => {
    setPlayer({ uuid: null, skipped: true });
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

  const guessesUsed = state.guessesUsed + 1;
  const feedback = document.getElementById('feedback-message');

  const res = await fetch('/api/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: activeDate, guess, guesses_used: guessesUsed }),
  });

  const result = await res.json();
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
