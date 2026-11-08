// The feedback footer and its modal, shared by all three pages. Built here
// rather than in each page's markup so the three HTML files stay in step.
//
// Absolute like the other API callers, so the Pages copy on broadwayguesser.com
// can reach the API on the VM.
const FB_API_BASE = 'https://broadway.dg.darrigozik.com';

// Read the identity game.js keeps, so feedback arrives attributed where
// possible — but never mint an id here. Someone who has not played has no
// identity to send, and writing in should not create one.
function fbPlayerId() {
  try {
    const player = JSON.parse(localStorage.getItem('broadway_player') || 'null');
    if (player && player.uuid) return player.uuid;
    return localStorage.getItem('broadway_anon_id') || null;
  } catch {
    return null;
  }
}

const FB_MARKUP = `
  <div id="fb-overlay"></div>
  <div id="fb-content">
    <button id="fb-close" aria-label="Close">&times;</button>
    <h2>Feedback</h2>
    <p>Found a bug, or a show we should add? Tell us.</p>
    <textarea id="fb-text" maxlength="2000" rows="5"
      placeholder="What's on your mind?" aria-label="Your feedback"></textarea>
    <p id="fb-error" style="display:none"></p>
    <div class="fb-buttons">
      <button id="fb-submit">Send</button>
      <button id="fb-cancel">Cancel</button>
    </div>
  </div>
`;

function buildFeedback() {
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  const link = document.createElement('button');
  link.id = 'fb-link';
  link.textContent = 'Submit Feedback';
  footer.append(link);
  document.getElementById('app').append(footer);

  const modal = document.createElement('div');
  modal.id = 'fb-modal';
  modal.style.display = 'none';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Send feedback');
  modal.innerHTML = FB_MARKUP;
  document.body.append(modal);

  const text = modal.querySelector('#fb-text');
  const submit = modal.querySelector('#fb-submit');
  const error = modal.querySelector('#fb-error');

  function close() { modal.style.display = 'none'; }

  function open() {
    error.style.display = 'none';
    submit.disabled = false;
    submit.textContent = 'Send';
    modal.style.display = 'flex';
    setTimeout(() => text.focus(), 50);
  }

  function fail(message) {
    error.textContent = message;
    error.style.display = 'block';
    submit.disabled = false;
    submit.textContent = 'Send';
  }

  link.addEventListener('click', open);
  modal.querySelector('#fb-close').addEventListener('click', close);
  modal.querySelector('#fb-cancel').addEventListener('click', close);
  modal.querySelector('#fb-overlay').addEventListener('click', close);

  submit.addEventListener('click', async () => {
    const message = text.value.trim();
    if (!message) { fail('Please write a message first.'); return; }

    submit.disabled = true;
    submit.textContent = 'Sending…';
    error.style.display = 'none';

    let res;
    try {
      res = await fetch(`${FB_API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, uuid: fbPlayerId() }),
      });
    } catch {
      fail('Could not reach the server. Please try again.');
      return;
    }

    if (!res.ok) {
      fail(res.status === 429
        ? 'Too many messages just now. Please try again shortly.'
        : 'Something went wrong — please try again.');
      return;
    }

    text.value = '';
    submit.textContent = 'Thanks!';
    setTimeout(close, 1200);
  });
}

document.addEventListener('DOMContentLoaded', buildFeedback);
