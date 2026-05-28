const TODAY = new Date().toISOString().slice(0, 10);
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

let showDates = new Set();
let earliestMonth = null; // { year, month }
let currentMonth = null;  // { year, month }

async function init() {
  const res = await fetch('/api/archive');
  const pastDates = await res.json();

  pastDates.forEach(d => showDates.add(d));
  showDates.add(TODAY);

  // Determine earliest month from show dates
  const allDates = [...showDates].sort();
  if (allDates.length) {
    const [y, m] = allDates[0].split('-').map(Number);
    earliestMonth = { year: y, month: m - 1 };
  }

  const now = new Date();
  currentMonth = { year: now.getFullYear(), month: now.getMonth() };

  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth = prevMonth(currentMonth);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth = nextMonth(currentMonth);
    renderCalendar();
  });

  renderCalendar();
}

function prevMonth({ year, month }) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

function nextMonth({ year, month }) {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

function monthKey({ year, month }) {
  return year * 100 + month;
}

function renderCalendar() {
  const { year, month } = currentMonth;
  const now = new Date();
  const todayMonth = { year: now.getFullYear(), month: now.getMonth() };

  const monthName = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('month-label').textContent = monthName;

  const prevBtn = document.getElementById('prev-month');
  const nextBtn = document.getElementById('next-month');
  prevBtn.disabled = earliestMonth ? monthKey(currentMonth) <= monthKey(earliestMonth) : true;
  nextBtn.disabled = monthKey(currentMonth) >= monthKey(todayMonth);

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  DAY_HEADERS.forEach(d => {
    const cell = document.createElement('div');
    cell.className = 'cal-header';
    cell.textContent = d;
    grid.appendChild(cell);
  });

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    grid.appendChild(cell);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.textContent = day;

    const isToday = dateStr === TODAY;
    const isFuture = dateStr > TODAY;
    const hasShow = showDates.has(dateStr);

    if (hasShow && !isFuture) {
      const saved = localStorage.getItem(`broadway_${dateStr}`);
      if (saved) {
        const s = JSON.parse(saved);
        if (s.solved) {
          cell.className = 'cal-cell played-won';
          cell.title = `Won in ${s.guessesUsed} clue${s.guessesUsed === 1 ? '' : 's'} — ${s.score} pts`;
        } else if (s.guessesUsed >= 5) {
          cell.className = 'cal-cell played-lost';
          cell.title = `Lost — the answer was "${s.answer}"`;
        } else {
          cell.className = 'cal-cell in-progress';
          cell.title = 'In progress';
        }
      } else {
        cell.className = 'cal-cell has-show';
        cell.title = isToday ? 'Play today' : 'Play this puzzle';
      }

      if (isToday) cell.classList.add('today');

      cell.addEventListener('click', () => {
        window.location.href = isToday ? '/' : `/?date=${dateStr}`;
      });
    } else {
      cell.className = `cal-cell ${isFuture || !hasShow ? 'no-show' : ''}`;
      if (isToday) cell.classList.add('today');
    }

    grid.appendChild(cell);
  }
}

init();
