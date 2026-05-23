const TODAY = new Date().toISOString().slice(0, 10);
const STORAGE_KEY = `broadway_${TODAY}`;

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

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return { guessesUsed: 0, solved: false, score: 0, guesses: [], answer: null };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function init() {
  document.getElementById('date-display').textContent = new Date(TODAY + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const todayRes = await fetch('/api/today');

  if (!todayRes.ok) {
    document.getElementById('no-show-message').style.display = 'block';
    document.getElementById('game-area').style.display = 'none';
    return;
  }

  todayData = await todayRes.json();
  render();
}

function render() {
  renderClues();
  updateScoreDisplay();

  const gameOver = state.solved || state.guessesUsed >= 5;
  document.getElementById('input-section').style.display = gameOver ? 'none' : 'block';
  document.getElementById('end-section').style.display = gameOver ? 'block' : 'none';

  if (gameOver) {
    renderEndState();
    startCountdown();
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
  }

  document.getElementById('share-btn').addEventListener('click', shareResult);
}

function shareResult() {
  const filled = state.solved ? state.score : 0;
  const grid = '⭐'.repeat(filled) + '⬛'.repeat(5 - filled);
  const guessLine = state.solved
    ? `Got it in ${state.guessesUsed} guess${state.guessesUsed === 1 ? '' : 'es'}!`
    : `Didn't get it today`;
  const text = `Broadway Guesser ${TODAY}\n${guessLine} ${grid}`;

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
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
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
    body: JSON.stringify({ date: TODAY, guess, guesses_used: guessesUsed }),
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
