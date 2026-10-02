// Ticketmaster-style PWA — core: helpers, router, sheets, appearance,
// account/backup and install/update handling. No login: everything is
// stored on the device (see db.js).

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');

const APP_VERSION = '3.4.0';

const state = {
  listTab: 'upcoming',
  liveURLs: [],
  timers: [],
  prefill: null,
  installPrompt: null,
  lastTab: null,
};

/* ---------------- icons ---------------- */

const PATHS = {
  back: '<path d="M15 4 7 12l8 8"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  ticket: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4z"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9m-5 5 5-5 5 5M5 4h14"/>',
  migrate: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  nav: '<path d="M3 11 21 3l-8 18-2-8z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  bookmark: '<path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.5-9.3A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.5 5.2c-2 4.7-9.5 9.3-9.5 9.3z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  access: '<circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5h14M12 8.5v5m0 0-3.5 7m3.5-7 3.5 7"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  transfer: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
  tag: '<path d="M20 12 12 20l-8-8V4h8z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  home: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9.5c5 1 12 1 17 0M3.5 14.5c5-1 12-1 17 0M12 3c-3 5-3 13 0 18M12 3c3 5 3 13 0 18"/>',
  mask: '<path d="M4 5c5 2 11 2 16 0v6a8 8 0 0 1-16 0z"/><path d="M8.5 10h1M14.5 10h1M9 14.5c2 1.5 4 1.5 6 0"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  family: '<circle cx="8" cy="7" r="2.5"/><circle cx="16.5" cy="8.5" r="2"/><path d="M3.5 20v-3a4.5 4.5 0 0 1 9 0v3M13 20v-2.5a3.5 3.5 0 0 1 7 0V20"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h2"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
};

function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24">${PATHS[name] || ''}</svg>`;
}

/* ---------------- helpers ---------------- */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 2300);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function objectURL(blob) {
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  state.liveURLs.push(url);
  return url;
}

function releaseURLs() {
  state.liveURLs.forEach(u => URL.revokeObjectURL(u));
  state.liveURLs = [];
}

function addTimer(id) { state.timers.push(id); return id; }
function clearTimers() { state.timers.forEach(clearInterval); state.timers = []; }

// <img> for a Blob or URL, or a coloured placeholder.
function coverHTML(src, color) {
  const url = src instanceof Blob ? objectURL(src) : src;
  if (url) return `<img class="cover" src="${esc(url)}" alt="" loading="lazy" decoding="async">`;
  const c = /^#[0-9a-f]{3,8}$/i.test(color || '') ? color : '#024DDF';
  return `<div class="cover ph" style="background:linear-gradient(140deg, ${c} 0%, #0B1220 115%)">${icon('ticket')}</div>`;
}

function parseLocal(dt) {
  // "2026-10-18T19:30" → local Date (no timezone shifting)
  if (!dt) return null;
  const [d, t = '00:00'] = String(dt).split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const date = new Date(y, m - 1, day, hh || 0, mm || 0);
  return isNaN(date) ? null : date;
}

function fmtLong(ev) {
  const d = parseLocal(ev.startAt);
  if (!d) return ev.dateText || 'Date TBA';
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} • ${time}`;
}

function fmtShort(ev) {
  const d = parseLocal(ev.startAt);
  if (!d) return ev.dateText || 'Date TBA';
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${wd}, ${md} • ${time}`;
}

// "Tonight", "Tomorrow", "Sat" … for events in the next week.
function relDay(ev) {
  const d = parseLocal(ev.startAt);
  if (!d) return '';
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const days = Math.floor((new Date(d).setHours(0, 0, 0, 0) - start) / 864e5);
  if (days < 0) return '';
  if (days === 0) return d.getHours() >= 17 ? 'Tonight' : 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return '';
}

function isPast(ev) {
  const d = parseLocal(ev.startAt);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function msUntil(ev) {
  const d = parseLocal(ev.startAt);
  return d ? d - Date.now() : Infinity;
}

function venueLine(ev) {
  return [ev.venue, ev.city].filter(Boolean).join(', ');
}

function money(n) {
  const v = Number(n);
  return isNaN(v) ? String(n) : v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/* ---------------- chrome, sheets, action sheets ---------------- */

function setChrome({ tab = null, tabbarVisible = true, grouped = false } = {}) {
  document.body.classList.toggle('no-tabbar', !tabbarVisible);
  document.body.classList.toggle('grouped', grouped);
  tabbar.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
}

function navbarHTML({ title = '', back = null, backLabel = 'Back', right = '', clear = false } = {}) {
  return `
    <header class="navbar ${clear ? 'clear' : ''}">
      <div class="left">${back ? `<a class="nav-btn" href="${back}">${icon('back', 'chev')}${esc(backLabel)}</a>` : ''}</div>
      <div class="title">${esc(title)}</div>
      <div class="right">${right}</div>
    </header>`;
}

function openSheet(innerHTML, cls = '') {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet ${cls}">${innerHTML}</div>`;
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.remove();
    if (wrap._onClose) wrap._onClose();
  };
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  document.body.appendChild(wrap);
  wrap.close = close;
  return wrap;
}

function sheetHead(title, { left = '', right = null } = {}) {
  return `
    <div class="grab"></div>
    <div class="sheet-head">
      <div>${left}</div>
      <h3>${esc(title)}</h3>
      <div class="right">${right ?? `<button class="nav-btn bold" data-close>Done</button>`}</div>
    </div>`;
}

// iOS-style action sheet. actions: [{label, danger, run}]
function actionSheet(title, actions) {
  const wrap = document.createElement('div');
  wrap.className = 'action-wrap sheet-wrap';
  wrap.innerHTML = `
    <div class="action-group">
      ${title ? `<div class="title">${esc(title)}</div>` : ''}
      ${actions.map((a, i) => `<button data-i="${i}" class="${a.danger ? 'danger' : ''}">${esc(a.label)}</button>`).join('')}
    </div>
    <div class="action-group cancel"><button data-cancel>Cancel</button></div>`;
  const close = () => wrap.remove();
  wrap.close = close;
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  wrap.querySelector('[data-cancel]').onclick = close;
  wrap.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { close(); actions[+b.dataset.i].run(); });
  document.body.appendChild(wrap);
}

/* ---------------- appearance (light / dark) ---------------- */

function getAppearance() {
  try { return localStorage.getItem('appearance') || 'system'; } catch (_) { return 'system'; }
}

function setThemeColor(color) {
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', color));
}

function applyAppearance(mode) {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
  else root.removeAttribute('data-theme');
  try { localStorage.setItem('appearance', mode); } catch (_) {}
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    if (mode === 'system') m.setAttribute('content', m.media.includes('dark') ? '#000000' : '#FFFFFF');
    else m.setAttribute('content', dark ? '#000000' : '#FFFFFF');
  });
}

/* ---------------- router ---------------- */

async function route() {
  releaseURLs();
  clearTimers();
  if (state.cleanup) { state.cleanup(); state.cleanup = null; }
  document.body.classList.remove('tm-page');
  applyAppearance(getAppearance());
  document.querySelectorAll('.sheet-wrap').forEach(s => (s.close ? s.close() : s.remove()));
  document.querySelector('.buybar')?.remove();
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== 'home-editor') homeState.draft = null;

  // No slide animation when switching between tabs.
  const tabRoots = ['', 'search', 'watchlist', 'tickets', 'account'];
  view.classList.toggle('tab-switch', tabRoots.includes(parts[0] || '') && parts.length <= 1);
  window.scrollTo(0, 0);

  try {
    switch (parts[0]) {
      case 'event': return await renderTicket(parts[1]);
      case 'new': return await renderForm(null);
      case 'edit': return await renderForm(parts[1]);
      case 'tickets': return await renderMyEvents();
      case 'account': return await renderAccount();
      case 'search': return await renderSearch(parts[1]);
      case 'watchlist': return await renderWatchlist();
      case 'explore': return await renderExplore(parts[1]);
      case 'section': return await renderSectionPage(parts[1]);
      case 'home-editor': return await renderHomeEditor();
      default: return await renderHome();
    }
  } catch (err) {
    console.error(err);
    setChrome({ tab: null });
    view.innerHTML = `<div class="empty"><h2>Something went wrong</h2><p>${esc(err.message)}</p><a class="btn" href="#/tickets">Go to My Tickets</a></div>`;
  }
}

window.addEventListener('hashchange', route);

/* ---------------- Account ---------------- */

function fmtBytes(n) {
  if (!n && n !== 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`;
}

function cellHTML({ ic, color, label, sub, value, href, id, danger, chevron = true, tag = 'button' }) {
  const el = href ? 'a' : tag;
  return `
    <${el} class="cell ${danger ? 'danger' : ''} ${ic ? '' : 'noicon'}" ${href ? `href="${href}"` : ''} ${id ? `id="${id}"` : ''}>
      ${ic ? `<span class="ic" style="background:${color || 'var(--brand)'}">${icon(ic)}</span>` : ''}
      <span class="lbl">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>
      ${value ? `<span class="val">${esc(value)}</span>` : ''}
      ${chevron ? icon('chev', 'chev') : ''}
    </${el}>`;
}

async function renderAccount() {
  setChrome({ tab: 'account', grouped: true });
  const events = await TicketDB.all();
  const tickets = events.reduce((s, e) => s + ticketCount(e), 0);
  const est = await storageEstimate();
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const hasLegacy = (() => { try { return !!localStorage.getItem('tickets'); } catch (_) { return false; } })();
  const mode = getAppearance();

  view.innerHTML = `
    <div class="large-head"><h1>Account</h1></div>

    <div class="group-title">Appearance</div>
    <div class="segmented" id="appearance" style="margin-top:0">
      ${['system', 'light', 'dark'].map(m => `<button data-m="${m}" class="${mode === m ? 'on' : ''}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}
    </div>

    <div class="group-title">My Tickets</div>
    <div class="group">
      ${cellHTML({ ic: 'ticket', label: 'Saved Tickets', value: `${plural(events.length, 'event')} · ${plural(tickets, 'ticket')}`, href: '#/tickets' })}
      ${cellHTML({ ic: 'plus', color: '#34C759', label: 'Add Tickets', href: '#/new' })}
    </div>
    <div class="group-foot">${est ? `Using ${fmtBytes(est.usage)} of ${fmtBytes(est.quota)} available. ` : ''}${persisted ? 'Storage is protected from automatic clean-up.' : 'Install the app to your Home Screen so your tickets are never cleared.'}</div>

    <div class="group-title">App</div>
    <div class="group">
      ${cellHTML({ ic: 'home', color: '#FF9500', label: 'Customize Home', sub: 'Banners, sections and events on Home', href: '#/home-editor' })}
      ${isStandalone() ? '' : cellHTML({ ic: 'phone', color: '#5856D6', label: 'Install App', sub: 'Add to your Home Screen', id: 'installBtn' })}
      ${cellHTML({ ic: 'refresh', color: '#34C759', label: 'Check for Updates', value: `v${APP_VERSION}`, id: 'updateBtn' })}
    </div>

    <div class="group-title">Backup</div>
    <div class="group">
      ${cellHTML({ ic: 'download', color: '#007AFF', label: 'Export Backup', id: 'exportBtn' })}
      <label class="cell" style="cursor:pointer">
        <span class="ic" style="background:#007AFF">${icon('upload')}</span>
        <span class="lbl">Import Backup</span>${icon('chev', 'chev')}
        <input type="file" accept="application/json,.json" id="importInput" hidden>
      </label>
      ${hasLegacy ? cellHTML({ ic: 'migrate', color: '#8E8E93', label: 'Import From Old App', id: 'legacyBtn' }) : ''}
    </div>

    <div class="group-title"></div>
    <div class="group">
      ${cellHTML({ label: 'Delete All Tickets', id: 'wipeBtn', danger: true, chevron: false })}
    </div>
    <div class="group-foot" style="text-align:center;margin-top:24px">Ticketmaster PWA · Version ${APP_VERSION}</div>
  `;

  view.querySelectorAll('#appearance button').forEach(b => b.onclick = () => {
    applyAppearance(b.dataset.m);
    view.querySelectorAll('#appearance button').forEach(x => x.classList.toggle('on', x === b));
  });
  document.getElementById('installBtn')?.addEventListener('click', showInstallHelp);
  document.getElementById('updateBtn').addEventListener('click', checkForUpdate);
  document.getElementById('exportBtn').addEventListener('click', exportBackup);
  document.getElementById('importInput').addEventListener('change', e => importBackup(e.target.files[0]));
  document.getElementById('legacyBtn')?.addEventListener('click', () => importLegacy(false));
  document.getElementById('wipeBtn').addEventListener('click', () => {
    if (!events.length) return toast('Nothing to delete');
    actionSheet(`Delete all ${plural(events.length, 'event')}? This can't be undone.`, [
      { label: 'Delete All Tickets', danger: true, run: async () => { await TicketDB.clear(); toast('All tickets deleted'); renderAccount(); } },
    ]);
  });
}

/* ---------------- backup ---------------- */

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function exportBackup() {
  const events = await TicketDB.all();
  if (!events.length) return toast('No tickets to export');
  toast('Preparing backup…');
  const out = [];
  for (const e of events) out.push({ ...e, image: e.image ? await blobToDataURL(e.image) : null });
  const blob = new Blob([JSON.stringify({ app: 'tm-wallet', version: 1, exportedAt: new Date().toISOString(), events: out })], { type: 'application/json' });
  const name = `tickets-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: 'Tickets backup' }); return; } catch (_) { /* fall back to download */ }
  }
  downloadBlob(blob, name);
  toast(`Exported ${plural(events.length, 'event')}`);
}

async function importBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.events;
    if (!Array.isArray(list)) throw new Error('Not a valid backup file');
    const records = [];
    for (const e of list) {
      if (!e || !e.id) continue;
      records.push({ ...e, image: typeof e.image === 'string' && e.image.startsWith('data:') ? await dataURLToBlob(e.image) : null });
    }
    await TicketDB.putMany(records);
    toast(`Imported ${plural(records.length, 'event')}`);
    renderAccount();
  } catch (e) {
    toast(`Import failed: ${e.message}`);
  }
}

// Convert tickets saved by the previous (localStorage) version of the app.
// Runs once automatically on first launch, and from Account on demand.
async function importLegacy(auto) {
  let old;
  try { old = JSON.parse(localStorage.getItem('tickets') || '[]'); } catch (_) { old = []; }
  if (!Array.isArray(old) || !old.length) { if (!auto) toast('No old tickets found'); return 0; }
  const records = [];
  for (const t of old) {
    let image = null;
    try {
      if (t.bannerImage && t.bannerImage.startsWith('data:')) image = await dataURLToBlob(t.bannerImage);
    } catch (_) {}
    records.push({
      id: `legacy-${t.id || uid()}`,
      title: t.title || 'Untitled Event',
      startAt: t.eventDate || (t.parseableDate ? `${t.parseableDate}T19:00` : ''),
      dateText: t.date || '',
      venue: t.venue || '',
      city: t.venueLocation || '',
      ticketType: (t.ticketType === 'Custom' ? t.customTicketType : t.ticketType) || 'Standard Admission',
      isGA: !t.seatType || t.seatType === 'General Admission',
      section: t.section || '',
      row: t.row || '',
      seats: t.seat || '',
      quantity: parseInt(t.ticketCount, 10) || 1,
      level: t.entryLevel || '',
      price: t.ticketPrice ? Number(t.ticketPrice) || '' : '',
      image,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  await TicketDB.putMany(records);
  if (!auto) {
    toast(`Imported ${plural(records.length, 'event')} from the old app`);
    renderAccount();
  }
  return records.length;
}

async function autoImportLegacyOnce() {
  try {
    if (await TicketDB.getSetting('legacyImported')) return;
    const n = await importLegacy(true);
    await TicketDB.setSetting('legacyImported', true);
    if (n) {
      toast(`Moved ${plural(n, 'event')} from the old app`);
      if ((location.hash || '#/').startsWith('#/tickets')) route();
    }
  } catch (e) {
    console.warn('Legacy import failed', e);
  }
}

/* ---------------- PWA: install + updates ---------------- */

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  state.installPrompt = e;
  maybeShowInstallBanner();
});

window.addEventListener('appinstalled', () => {
  state.installPrompt = null;
  document.getElementById('installBanner')?.remove();
  toast('App installed');
});

async function showInstallHelp() {
  if (state.installPrompt) {
    state.installPrompt.prompt();
    await state.installPrompt.userChoice.catch(() => {});
    state.installPrompt = null;
    return;
  }
  const ios = isIOS();
  openSheet(`
    ${sheetHead('Install the App')}
    <div class="install-steps">
      <img src="icons/icon-192.png" alt="" class="install-icon">
      <p>Add Ticketmaster to your ${ios ? 'iPhone' : 'phone'} for full-screen tickets that work offline.</p>
      ${ios ? `
        <ol>
          <li>Open this page in <b>Safari</b>.</li>
          <li>Tap <b>Share</b> <span class="kbd">${icon('share')}</span> in the toolbar.</li>
          <li>Choose <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>.</li>
        </ol>` : `
        <ol>
          <li>Open the browser menu <b>⋮</b>.</li>
          <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
          <li>Confirm with <b>Install</b>.</li>
        </ol>`}
    </div>`);
}

function maybeShowInstallBanner() {
  if (isStandalone() || document.getElementById('installBanner')) return;
  let dismissed = 0;
  try { dismissed = +localStorage.getItem('installDismissed') || 0; } catch (_) {}
  if (Date.now() - dismissed < 7 * 864e5) return;
  if (!state.installPrompt && !isIOS()) return;
  const bar = document.createElement('div');
  bar.id = 'installBanner';
  bar.className = 'install-banner';
  bar.innerHTML = `
    <img src="icons/icon-192.png" alt="">
    <div class="ib-text"><b>Ticketmaster</b><span>Get the app for faster entry</span></div>
    <button class="btn sm">${state.installPrompt ? 'Install' : 'Get'}</button>
    <button class="ib-x" aria-label="Dismiss">${icon('close', 'sm')}</button>`;
  bar.querySelector('.btn').onclick = () => { bar.remove(); showInstallHelp(); };
  bar.querySelector('.ib-x').onclick = () => {
    bar.remove();
    try { localStorage.setItem('installDismissed', String(Date.now())); } catch (_) {}
  };
  document.body.appendChild(bar);
}

function showUpdateReady(worker) {
  if (document.getElementById('updateBanner')) return;
  const bar = document.createElement('div');
  bar.id = 'updateBanner';
  bar.className = 'update-banner';
  bar.innerHTML = `<span>A new version is available.</span><button class="btn sm">Refresh</button>`;
  bar.querySelector('button').onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
  document.body.appendChild(bar);
}

async function checkForUpdate() {
  if (!('serviceWorker' in navigator)) return toast('Updates are automatic in this browser');
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return toast('You have the latest version');
  await reg.update().catch(() => {});
  if (reg.waiting) showUpdateReady(reg.waiting);
  else if (reg.installing) toast('Downloading update…');
  else toast('You have the latest version');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const hadController = !!navigator.serviceWorker.controller;
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      if (reg.waiting && hadController) showUpdateReady(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateReady(nw);
        });
      });
      // Look for a new version whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    } catch (err) {
      console.warn('SW registration failed', err);
    }
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Only reload when an update replaced a running version, not on first install.
      if (reloading || !hadController) return;
      reloading = true;
      location.reload();
    });
  });
}

window.addEventListener('load', () => setTimeout(maybeShowInstallBanner, 3000));

// tickets.js and home.js load after this file, so wait until every script has run.
window.addEventListener('DOMContentLoaded', () => {
  route();
  autoImportLegacyOnce();
});

/* ---------------- Image cropper ----------------
   Every event image in the app is shown at 3:2, so uploads are framed here:
   - drag to move, pinch or use the Zoom slider to zoom
   - the Width slider stretches the photo sideways (e.g. to make a tall photo
     fill the frame); "Stretch to Fit" stretches it to fill the frame exactly
   - "Fit" shows the whole photo (blurred edges fill any gaps); "Fill" covers
     the frame without stretching. */

const IMAGE_ASPECT = 3 / 2;

function openCropper(source, { aspect = IMAGE_ASPECT, outWidth = 1500 } = {}) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image'); resolve(null); };
    img.onload = () => {
      const wrap = document.createElement('div');
      wrap.className = 'crop-view sheet-wrap';
      wrap.innerHTML = `
        <header class="crop-head">
          <button class="nav-btn" data-cancel>Cancel</button>
          <div class="title">Move and Scale</div>
          <button class="nav-btn bold" data-done>Choose</button>
        </header>
        <div class="crop-stage">
          <div class="crop-frame">
            <img class="crop-bg" src="${url}" alt="">
            <img class="crop-img" src="${url}" alt="" draggable="false">
            <div class="crop-grid"></div>
          </div>
        </div>
        <div class="crop-tools">
          <label class="crop-row"><span>Zoom</span><input type="range" class="crop-zoom" min="0" max="1000" value="0" aria-label="Zoom"></label>
          <label class="crop-row"><span>Width</span><input type="range" class="crop-width" min="50" max="300" value="100" aria-label="Stretch width"><b class="crop-pct">100%</b></label>
          <div class="crop-btns">
            <button data-fit>Fit</button>
            <button data-fill>Fill</button>
            <button data-stretch>Stretch to Fit</button>
            <button data-reset>Reset</button>
          </div>
          <p>Drag to move · Pinch or slide to zoom · Width stretches the photo</p>
        </div>`;
      document.body.appendChild(wrap);

      const frame = wrap.querySelector('.crop-frame');
      const pic = wrap.querySelector('.crop-img');
      const zoom = wrap.querySelector('.crop-zoom');
      const width = wrap.querySelector('.crop-width');
      const pct = wrap.querySelector('.crop-pct');
      const W = img.naturalWidth, H = img.naturalHeight;
      // s = vertical scale, k = extra horizontal stretch (1 = natural shape)
      let fw, fh, s, k = 1, x, y;

      const minS = () => Math.min(fw / (W * k), fh / H);
      const coverS = () => Math.max(fw / (W * k), fh / H);
      const maxS = () => coverS() * 4;

      const layout = () => {
        const maxW = Math.min(window.innerWidth - 32, 620);
        const maxH = window.innerHeight * 0.45;
        fw = Math.min(maxW, maxH * aspect);
        fh = fw / aspect;
        frame.style.width = `${fw}px`;
        frame.style.height = `${fh}px`;
      };
      const clamp = () => {
        s = Math.min(maxS(), Math.max(minS(), s));
        const iw = W * s * k, ih = H * s;
        x = iw >= fw - 0.5 ? Math.min(0, Math.max(fw - iw, x)) : (fw - iw) / 2;
        y = ih >= fh - 0.5 ? Math.min(0, Math.max(fh - ih, y)) : (fh - ih) / 2;
      };
      const paint = () => {
        clamp();
        pic.style.width = `${W * s * k}px`;
        pic.style.height = `${H * s}px`;
        pic.style.transform = `translate(${x}px, ${y}px)`;
        zoom.value = String(Math.round(((s - minS()) / Math.max(1e-6, maxS() - minS())) * 1000));
        width.value = String(Math.round(k * 100));
        pct.textContent = `${Math.round(k * 100)}%`;
      };
      // keep the point under (cx, cy) fixed while scaling
      const scaleAround = (ns, nk, cx = fw / 2, cy = fh / 2) => {
        const ix = (cx - x) / (s * k), iy = (cy - y) / s;   // image coords under the point
        s = ns; k = nk;
        x = cx - ix * s * k;
        y = cy - iy * s;
        paint();
      };
      const zoomTo = (ns, cx, cy) => scaleAround(ns, k, cx, cy);

      layout();
      s = coverS(); x = (fw - W * s) / 2; y = (fh - H * s) / 2;
      paint();

      // drag + pinch
      const pts = new Map();
      let last = null;
      frame.addEventListener('pointerdown', e => { frame.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); last = null; });
      frame.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return;
        const prev = pts.get(e.pointerId);
        pts.set(e.pointerId, e);
        if (pts.size === 1) {
          x += e.clientX - prev.clientX;
          y += e.clientY - prev.clientY;
          paint();
        } else if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const r = frame.getBoundingClientRect();
          const cx = (a.clientX + b.clientX) / 2 - r.left, cy = (a.clientY + b.clientY) / 2 - r.top;
          if (last) zoomTo(s * (dist / last), cx, cy);
          last = dist;
        }
      });
      const up = e => { pts.delete(e.pointerId); last = null; };
      frame.addEventListener('pointerup', up);
      frame.addEventListener('pointercancel', up);
      frame.addEventListener('wheel', e => { e.preventDefault(); zoomTo(s * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
      zoom.addEventListener('input', () => zoomTo(minS() + (maxS() - minS()) * (zoom.value / 1000)));
      width.addEventListener('input', () => scaleAround(s, width.value / 100));
      wrap.querySelector('[data-fit]').onclick = () => zoomTo(minS());
      wrap.querySelector('[data-fill]').onclick = () => zoomTo(coverS());
      wrap.querySelector('[data-stretch]').onclick = () => {
        // stretch both ways so the whole photo exactly fills the frame
        s = fh / H; k = (fw / W) / s; x = 0; y = 0;
        paint();
      };
      wrap.querySelector('[data-reset]').onclick = () => {
        k = 1; s = coverS(); x = (fw - W * s) / 2; y = (fh - H * s) / 2;
        paint();
      };

      const finish = blob => { URL.revokeObjectURL(url); wrap.remove(); resolve(blob); };
      wrap.querySelector('[data-cancel]').onclick = () => finish(null);
      wrap.querySelector('[data-done]').onclick = () => {
        const outW = outWidth, outH = Math.round(outWidth / aspect), f = outW / fw;
        const c = document.createElement('canvas');
        c.width = outW; c.height = outH;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, outW, outH);
        if (W * s * k < fw - 1 || H * s < fh - 1) {
          // fill the gaps with a blurred, darkened copy of the photo
          const bs = Math.max(outW / W, outH / H);
          if ('filter' in ctx) ctx.filter = 'blur(40px) brightness(0.6)';
          ctx.drawImage(img, (outW - W * bs) / 2, (outH - H * bs) / 2, W * bs, H * bs);
          ctx.filter = 'none';
          if (!('filter' in ctx)) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, outW, outH); }
        }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, x * f, y * f, W * s * k * f, H * s * f);
        c.toBlob(b => finish(b), 'image/jpeg', 0.88);
      };
    };
    img.src = url;
  });
}
