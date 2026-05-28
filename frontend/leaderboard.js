const PLAYER_KEY = 'broadway_player';

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rankSymbol(i) {
  if (i === 0) return '🥇';
  if (i === 1) return '🥈';
  if (i === 2) return '🥉';
  return String(i + 1);
}

async function loadLeaderboard() {
  let data;
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) throw new Error('fetch failed');
    data = await res.json();
  } catch {
    document.getElementById('lb-empty').textContent = 'Could not load leaderboard.';
    document.getElementById('lb-empty').style.display = 'block';
    return;
  }

  if (!data.length) {
    document.getElementById('lb-empty').style.display = 'block';
    return;
  }

  const player = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null');
  const myUuid = player && player.uuid ? player.uuid : null;

  const tbody = document.getElementById('lb-body');
  data.forEach((row, i) => {
    const tr = document.createElement('tr');
    if (myUuid && row.uuid === myUuid) tr.classList.add('my-row');

    const youBadge = (myUuid && row.uuid === myUuid)
      ? '<span class="you-badge">you</span>'
      : '';

    tr.innerHTML = `
      <td class="rank-cell">${rankSymbol(i)}</td>
      <td class="name-cell">${esc(row.name)}${youBadge}</td>
      <td class="td-hide">${row.played}</td>
      <td>${row.win_pct}%</td>
      <td class="td-hide">${row.avg_guesses != null ? row.avg_guesses : '—'}</td>
      <td>${row.streak}</td>
      <td class="score-cell">${row.total_score}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('lb-table').style.display = 'table';
}

loadLeaderboard();
