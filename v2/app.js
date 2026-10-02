// Ticket wallet — no login, tickets stored on-device in IndexedDB.

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');

const state = {
  listTab: 'upcoming',
  liveURLs: [],
};

/* ---------------- helpers ---------------- */

const ICONS = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  ticket: '<svg viewBox="0 0 24 24"><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 20V9m-5 5 5-5 5 5M5 4h14"/></svg>',
  migrate: '<svg viewBox="0 0 24 24"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/></svg>',
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 2200);
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

function imageHTML(ev) {
  if (ev.image) return `<img src="${objectURL(ev.image)}" alt="" loading="lazy" decoding="async">`;
  return `<div class="ph">${ICONS.ticket}</div>`;
}

function parseLocal(dt) {
  // "2026-10-18T19:30" → local Date (no timezone shifting)
  if (!dt) return null;
  const [d, t = '00:00'] = dt.split('T');
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

function fmtCard(ev) {
  const d = parseLocal(ev.startAt);
  if (!d) return ev.dateText || 'Date TBA';
  const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
  const md = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${wd} • ${md} • ${time}`;
}

function isPast(ev) {
  const d = parseLocal(ev.startAt);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function venueLine(ev) {
  return [ev.venue, ev.city].filter(Boolean).join(', ');
}

// "12-15" → [12..15], "A1, A2" → ["A1","A2"], "12" + qty 3 → [12,13,14]
function seatList(ev) {
  const qty = Math.max(1, Math.min(100, parseInt(ev.quantity, 10) || 1));
  const raw = String(ev.seats || '').trim();
  if (!raw) return Array.from({ length: qty }, () => '');
  if (raw.includes(',')) return raw.split(',').map(s => s.trim()).filter(Boolean);
  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const a = +range[1], b = +range[2];
    const lo = Math.min(a, b), hi = Math.min(Math.max(a, b), lo + 99);
    return Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i));
  }
  if (/^\d+$/.test(raw)) return Array.from({ length: qty }, (_, i) => String(+raw + i));
  return [raw];
}

function ticketCount(ev) {
  return seatList(ev).length;
}

function setChrome({ tab = null, tabbarVisible = true } = {}) {
  document.body.classList.toggle('no-tabbar', !tabbarVisible);
  tabbar.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
}

function openSheet(innerHTML, cls = '') {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet ${cls}">${innerHTML}</div>`;
  const close = () => {
    wrap.remove();
    if (wrap._onClose) wrap._onClose();
  };
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
  document.body.appendChild(wrap);
  wrap.close = close;
  return wrap;
}

/* ---------------- router ---------------- */

async function route() {
  releaseURLs();
  document.querySelectorAll('.sheet-wrap').forEach(s => s.close ? s.close() : s.remove());
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  window.scrollTo(0, 0);
  try {
    if (parts[0] === 'event' && parts[1]) return await renderDetail(parts[1]);
    if (parts[0] === 'new') return await renderForm(null);
    if (parts[0] === 'edit' && parts[1]) return await renderForm(parts[1]);
    if (parts[0] === 'account') return await renderAccount();
    if (parts[0] === 'discover') return renderPlaceholder('discover', 'Discover', 'Find events near you.');
    if (parts[0] === 'foryou') return renderPlaceholder('foryou', 'For You', 'Recommendations based on your favorite artists.');
    if (parts[0] === 'sell') return renderPlaceholder('sell', 'Sell', 'Choose an event from My Tickets to list tickets for sale.');
    return await renderList();
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty"><h2>Something went wrong</h2><p>${esc(err.message)}</p><a class="btn" href="#/">Back to My Tickets</a></div>`;
  }
}

window.addEventListener('hashchange', route);

/* ---------------- My Tickets list ---------------- */

async function renderList() {
  setChrome({ tab: 'tickets' });
  const events = await TicketDB.all();
  const upcoming = events.filter(e => !isPast(e)).sort((a, b) => (a.startAt || '9999').localeCompare(b.startAt || '9999'));
  const past = events.filter(isPast).sort((a, b) => (b.startAt || '').localeCompare(a.startAt || ''));
  const shown = state.listTab === 'past' ? past : upcoming;

  view.innerHTML = `
    <header class="page-head">
      <div class="row">
        <h1>My Tickets</h1>
        <a class="add-btn" href="#/new">${ICONS.plus}Add</a>
      </div>
      <div class="tabs">
        <button data-t="upcoming" class="${state.listTab === 'upcoming' ? 'active' : ''}">Upcoming (${upcoming.length})</button>
        <button data-t="past" class="${state.listTab === 'past' ? 'active' : ''}">Past (${past.length})</button>
      </div>
    </header>
    ${shown.length ? `<div class="list">${shown.map(cardHTML).join('')}</div>` : emptyHTML(state.listTab)}
  `;

  view.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    state.listTab = b.dataset.t;
    releaseURLs();
    renderList();
  }));
}

function cardHTML(ev) {
  const n = ticketCount(ev);
  return `
    <a class="event-card" href="#/event/${encodeURIComponent(ev.id)}">
      ${imageHTML(ev)}
      <span class="count">${ICONS.ticket}${n} ticket${n === 1 ? '' : 's'}</span>
      <div class="meta">
        <div class="date">${esc(fmtCard(ev))}</div>
        <div class="title">${esc(ev.title || 'Untitled Event')}</div>
        <div class="venue">${esc(venueLine(ev))}</div>
      </div>
    </a>`;
}

function emptyHTML(tab) {
  if (tab === 'past') {
    return `<div class="empty"><div class="art">${ICONS.ticket}</div><h2>No past events</h2><p>Events you've attended will show up here.</p></div>`;
  }
  return `
    <div class="empty">
      <div class="art">${ICONS.ticket}</div>
      <h2>No upcoming events</h2>
      <p>Add an event and its tickets will appear here. Everything is saved on this device — no account needed.</p>
      <a class="btn" href="#/new">${ICONS.plus.replace('<svg', '<svg fill="none" stroke="currentColor" stroke-width="2.4"')}Add Tickets</a>
    </div>`;
}

/* ---------------- Ticket detail ---------------- */

function seatHeadHTML(ev, seat) {
  if (ev.isGA) {
    return `<div class="tkt-seats ga"><div><small>${esc(ev.section ? 'SEC' : 'ADMISSION')}</small><b>${esc(ev.section || 'GENERAL ADMISSION')}</b></div></div>`;
  }
  return `
    <div class="tkt-seats">
      <div><small>SEC</small><b>${esc(ev.section || '—')}</b></div>
      <div><small>ROW</small><b>${esc(ev.row || '—')}</b></div>
      <div><small>SEAT</small><b>${esc(seat || '—')}</b></div>
    </div>`;
}

function ticketCardHTML(ev, seat, i, imgURL) {
  return `
    <article class="tkt" data-i="${i}">
      <div class="tkt-head">
        <div class="tkt-type">${esc(ev.ticketType || 'Standard Admission')}</div>
        ${seatHeadHTML(ev, seat)}
      </div>
      <div class="tkt-img">
        ${imgURL ? `<img src="${imgURL}" alt="">` : `<div class="ph">${ICONS.ticket}</div>`}
        <div class="meta">
          <div class="title">${esc(ev.title || 'Untitled Event')}</div>
          <div class="sub">${esc(fmtLong(ev))}</div>
          <div class="sub">${esc(venueLine(ev))}</div>
        </div>
      </div>
      <div class="tkt-body">
        <button class="btn" data-view="${i}">View Ticket</button>
        <div class="tkt-links">
          <button data-details>Ticket Details</button>
        </div>
        ${ev.entry || ev.level ? `
          <div class="tkt-entry">
            ${ev.entry ? `<span>Entry <b>${esc(ev.entry)}</b></span>` : '<span></span>'}
            ${ev.level ? `<span>Level <b>${esc(ev.level)}</b></span>` : ''}
          </div>` : ''}
      </div>
    </article>`;
}

async function renderDetail(id) {
  setChrome({ tab: 'tickets', tabbarVisible: false });
  const ev = await TicketDB.get(id);
  if (!ev) {
    view.innerHTML = `<div class="empty"><h2>Event not found</h2><p>It may have been deleted.</p><a class="btn" href="#/">Back to My Tickets</a></div>`;
    return;
  }
  const seats = seatList(ev);
  const imgURL = objectURL(ev.image);

  view.innerHTML = `
    <div class="detail">
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Back">${ICONS.back}</a>
        <h1>My Tickets</h1>
        <button class="icon-btn" id="moreBtn" aria-label="More">${ICONS.more}</button>
      </header>
      <div class="counter" id="counter">${seats.length} ticket${seats.length === 1 ? '' : 's'}</div>
      <div class="carousel ${seats.length === 1 ? 'single' : ''}" id="carousel">
        ${seats.map((s, i) => ticketCardHTML(ev, s, i, imgURL)).join('')}
      </div>
      ${seats.length > 1 ? `<div class="dots" id="dots">${seats.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      <div class="actions">
        <button class="btn" id="transferBtn">Transfer</button>
        <button class="btn" id="sellBtn">Sell</button>
      </div>
    </div>`;

  const carousel = document.getElementById('carousel');
  const counter = document.getElementById('counter');
  const dots = document.getElementById('dots');
  if (seats.length > 1) {
    counter.textContent = `Ticket 1 of ${seats.length}`;
    carousel.addEventListener('scroll', () => {
      const cards = carousel.querySelectorAll('.tkt');
      const center = carousel.scrollLeft + carousel.clientWidth / 2;
      let best = 0, bestDist = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      counter.textContent = `Ticket ${best + 1} of ${seats.length}`;
      dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === best));
    }, { passive: true });
  }

  carousel.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => openBarcode(ev, seats, +b.dataset.view, imgURL)));
  carousel.querySelectorAll('[data-details]').forEach(b =>
    b.addEventListener('click', () => openDetails(ev, seats)));
  document.getElementById('transferBtn').addEventListener('click', () => toast('Ticket transfer is not available for this event yet.'));
  document.getElementById('sellBtn').addEventListener('click', () => toast('Resale is not available for this event yet.'));
  document.getElementById('moreBtn').addEventListener('click', () => openEventMenu(ev));
}

function openEventMenu(ev) {
  const sheet = openSheet(`
    <div class="grab"></div>
    <div class="sheet-menu">
      <button data-a="edit">${ICONS.edit}Edit event</button>
      <button data-a="dup">${ICONS.copy}Duplicate event</button>
      <button data-a="del" class="danger">${ICONS.trash}Delete event</button>
      <button data-close>${ICONS.close}Cancel</button>
    </div>`);
  sheet.querySelector('[data-a="edit"]').onclick = () => { location.hash = `#/edit/${encodeURIComponent(ev.id)}`; };
  sheet.querySelector('[data-a="dup"]').onclick = async () => {
    const copy = { ...ev, id: uid(), title: `${ev.title || 'Untitled Event'} (copy)`, createdAt: Date.now(), updatedAt: Date.now() };
    await TicketDB.put(copy);
    toast('Event duplicated');
    location.hash = `#/edit/${encodeURIComponent(copy.id)}`;
  };
  sheet.querySelector('[data-a="del"]').onclick = async () => {
    if (!confirm(`Delete "${ev.title || 'this event'}" and all its tickets?`)) return;
    await TicketDB.remove(ev.id);
    sheet.close();
    toast('Event deleted');
    location.hash = '#/';
  };
}

function openDetails(ev, seats) {
  const rows = [
    ['Event', ev.title],
    ['Date', fmtLong(ev)],
    ['Venue', venueLine(ev)],
    ['Ticket type', ev.ticketType || 'Standard Admission'],
    ['Section', ev.isGA ? (ev.section || 'General Admission') : ev.section],
    ['Row', ev.isGA ? '' : ev.row],
    ['Seats', ev.isGA ? '' : seats.filter(Boolean).join(', ')],
    ['Tickets', String(seats.length)],
    ['Entry', ev.entry],
    ['Level', ev.level],
    ['Order #', ev.orderNumber],
    ['Price per ticket', ev.price ? money(ev.price) : ''],
    ['Total', ev.price ? money(ev.price * seats.length) : ''],
    ['Notes', ev.notes],
  ].filter(([, v]) => v);
  openSheet(`
    <div class="sheet-head">
      <span style="width:44px"></span><h3>Ticket Details</h3>
      <button class="icon-btn" data-close aria-label="Close">${ICONS.close}</button>
    </div>
    <div class="info-block" style="margin-top:8px">
      ${rows.map(([k, v]) => `<div class="info-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
    </div>`);
}

function money(n) {
  const v = Number(n);
  return isNaN(v) ? String(n) : v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/* ---------------- Barcode (SafeTix-style rotating) ---------------- */

function seededRandom(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// PDF417-looking stacked barcode drawn as SVG.
function barcodeSVG(seed) {
  const rand = seededRandom(seed);
  const rows = 12, cols = 96, cw = 3, rh = 7;
  const w = cols * cw, h = rows * rh;
  let rects = '';
  const guard = (x, pattern) => {
    let cx = x;
    for (let r = 0; r < rows; r++) {
      cx = x;
      pattern.forEach((len, k) => {
        if (k % 2 === 0) rects += `<rect x="${cx * cw}" y="${r * rh}" width="${len * cw}" height="${rh}"/>`;
        cx += len;
      });
    }
  };
  guard(0, [8, 1, 1, 1, 1, 1, 1, 3]);
  guard(cols - 9, [7, 1, 1, 3, 1, 1, 1, 2, 1]);
  for (let r = 0; r < rows; r++) {
    let x = 18;
    let on = true;
    while (x < cols - 18) {
      const len = 1 + Math.floor(rand() * 4);
      const run = Math.min(len, cols - 18 - x);
      if (on) rects += `<rect x="${x * cw}" y="${r * rh}" width="${run * cw}" height="${rh}"/>`;
      x += run;
      on = !on;
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" fill="#000" shape-rendering="crispEdges">${rects}</svg>`;
}

function openBarcode(ev, seats, index, imgURL) {
  const seat = seats[index];
  const slot = () => Math.floor(Date.now() / 15000);
  const seedFor = () => `${ev.id}|${index}|${seat}|${slot()}`;

  const sheet = openSheet(`
    <div class="sheet-head">
      <span style="width:44px"></span>
      <h3>${seats.length > 1 ? `Ticket ${index + 1} of ${seats.length}` : 'Your Ticket'}</h3>
      <button class="icon-btn" data-close aria-label="Close">${ICONS.close}</button>
    </div>
    <div class="tkt">
      <div class="tkt-head">
        <div class="tkt-type">${esc(ev.ticketType || 'Standard Admission')}</div>
        ${seatHeadHTML(ev, seat)}
      </div>
      <div class="barcode-box">
        <div class="barcode"><div id="bc">${barcodeSVG(seedFor())}</div><div class="sweep"></div></div>
        <div class="safetix">${ICONS.shield}SafeTix™</div>
        <p class="barcode-note"><b>Screenshots won't get you in.</b><br>This barcode refreshes automatically.</p>
      </div>
      <div class="info-block" style="margin:6px 16px 0;padding:0">
        <div class="info-row"><span>Event</span><b>${esc(ev.title || 'Untitled Event')}</b></div>
        <div class="info-row"><span>Date</span><b>${esc(fmtLong(ev))}</b></div>
        ${venueLine(ev) ? `<div class="info-row"><span>Venue</span><b>${esc(venueLine(ev))}</b></div>` : ''}
        ${ev.entry ? `<div class="info-row"><span>Entry</span><b>${esc(ev.entry)}</b></div>` : ''}
      </div>
      <div class="wallet">
        <button class="btn dark block" id="walletBtn">${ICONS.wallet}Add to Wallet</button>
      </div>
    </div>`, 'barcode-sheet');

  let last = slot();
  const timer = setInterval(() => {
    if (slot() !== last) {
      last = slot();
      const bc = sheet.querySelector('#bc');
      if (bc) bc.innerHTML = barcodeSVG(seedFor());
    }
  }, 1000);
  sheet._onClose = () => clearInterval(timer);
  sheet.querySelector('#walletBtn').addEventListener('click', () => toast('Wallet passes are not available for this event.'));
}

/* ---------------- Add / edit form ---------------- */

async function renderForm(id) {
  setChrome({ tabbarVisible: false });
  const existing = id ? await TicketDB.get(id) : null;
  if (id && !existing) {
    view.innerHTML = `<div class="empty"><h2>Event not found</h2><a class="btn" href="#/">Back to My Tickets</a></div>`;
    return;
  }
  const ev = existing || { quantity: 2, ticketType: 'Standard Admission', isGA: false };
  let imageBlob = ev.image || null;
  let previewURL = imageBlob ? objectURL(imageBlob) : '';

  const f = (name, label, opts = {}) => `
    <div class="field">
      <label for="f-${name}">${label}</label>
      <input id="f-${name}" name="${name}" type="${opts.type || 'text'}" value="${esc(ev[name] ?? '')}"
        ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''} ${opts.attrs || ''}>
      ${opts.hint ? `<div class="hint">${opts.hint}</div>` : ''}
    </div>`;

  view.innerHTML = `
    <header class="topbar light">
      <a class="text-btn" href="${existing ? `#/event/${encodeURIComponent(ev.id)}` : '#/'}">Cancel</a>
      <h1>${existing ? 'Edit Event' : 'Add Tickets'}</h1>
      <span style="min-width:64px"></span>
    </header>
    <form class="form" id="evForm" autocomplete="off">
      <h2>Event</h2>
      <div class="field">
        <label>Event image</label>
        <label class="image-pick" id="imgPick">
          ${previewURL ? `<img src="${previewURL}" alt="">` : `<span class="ip-empty">${ICONS.image}Tap to upload an image</span>`}
          <input type="file" accept="image/*" id="f-image">
        </label>
        <div class="image-actions" id="imgActions" ${imageBlob ? '' : 'hidden'}>
          <button type="button" class="rm" id="rmImg">Remove image</button>
        </div>
      </div>
      ${f('title', 'Event name', { placeholder: 'e.g. Taylor Swift | The Eras Tour', attrs: 'required' })}
      ${f('startAt', 'Date & time', { type: 'datetime-local' })}
      <div class="grid-2">
        ${f('venue', 'Venue', { placeholder: 'e.g. SoFi Stadium' })}
        ${f('city', 'City', { placeholder: 'e.g. Inglewood, CA' })}
      </div>

      <h2>Tickets</h2>
      ${f('ticketType', 'Ticket type', { placeholder: 'Standard Admission' })}
      <div class="toggle">
        <span>General admission (no seats)</span>
        <label class="switch"><input type="checkbox" id="f-isGA" ${ev.isGA ? 'checked' : ''}><span></span></label>
      </div>
      <div class="grid-3" id="seatFields">
        ${f('section', 'Section', { placeholder: '112' })}
        ${f('row', 'Row', { placeholder: 'K' })}
        ${f('seats', 'Seat(s)', { placeholder: '14' })}
      </div>
      ${f('quantity', 'Number of tickets', { type: 'number', attrs: 'min="1" max="100" inputmode="numeric"', hint: 'Seat "14" with 3 tickets gives seats 14, 15, 16. You can also type a range like "14-17" or a list like "A1, A2".' })}
      <div class="grid-2">
        ${f('entry', 'Entry / Gate', { placeholder: 'Gate A' })}
        ${f('level', 'Level', { placeholder: 'Lower Level' })}
      </div>

      <h2>Order</h2>
      <div class="grid-2">
        ${f('orderNumber', 'Order number', { placeholder: '12-34567/LAX' })}
        ${f('price', 'Price per ticket ($)', { type: 'number', attrs: 'min="0" step="0.01" inputmode="decimal"' })}
      </div>
      <div class="field">
        <label for="f-notes">Notes</label>
        <textarea id="f-notes" name="notes">${esc(ev.notes || '')}</textarea>
      </div>
    </form>
    <div class="form-footer">
      <div class="inner">
        ${existing ? `<button class="btn danger" id="delBtn" type="button" style="flex:0 0 auto">${ICONS.trash.replace('<svg', '<svg fill="none" stroke="currentColor" stroke-width="1.8"')}</button>` : ''}
        <button class="btn" id="saveBtn" type="button">${existing ? 'Save Changes' : 'Save Tickets'}</button>
      </div>
    </div>`;

  const form = document.getElementById('evForm');
  const pick = document.getElementById('imgPick');
  const fileInput = document.getElementById('f-image');
  const imgActions = document.getElementById('imgActions');
  const gaToggle = document.getElementById('f-isGA');

  const syncGA = () => {
    const ga = gaToggle.checked;
    document.getElementById('f-row').closest('.field').style.display = ga ? 'none' : '';
    document.getElementById('f-seats').closest('.field').style.display = ga ? 'none' : '';
  };
  gaToggle.addEventListener('change', syncGA);
  syncGA();

  const showPreview = blob => {
    pick.querySelector('img, .ip-empty')?.remove();
    if (blob) {
      const img = document.createElement('img');
      img.src = objectURL(blob);
      pick.prepend(img);
      imgActions.hidden = false;
    } else {
      pick.insertAdjacentHTML('afterbegin', `<span class="ip-empty">${ICONS.image}Tap to upload an image</span>`);
      imgActions.hidden = true;
    }
  };

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      imageBlob = await compressImage(file);
      showPreview(imageBlob);
    } catch (e) {
      toast(e.message);
    }
    fileInput.value = '';
  });
  document.getElementById('rmImg').addEventListener('click', () => { imageBlob = null; showPreview(null); });

  const save = async () => {
    const val = n => (form.querySelector(`[name="${n}"]`)?.value ?? '').trim();
    const title = val('title');
    if (!title) {
      toast('Please enter an event name');
      document.getElementById('f-title').focus();
      return;
    }
    const record = {
      ...ev,
      id: ev.id || uid(),
      title,
      startAt: val('startAt'),
      venue: val('venue'),
      city: val('city'),
      ticketType: val('ticketType') || 'Standard Admission',
      isGA: gaToggle.checked,
      section: val('section'),
      row: val('row'),
      seats: val('seats'),
      quantity: Math.max(1, Math.min(100, parseInt(val('quantity'), 10) || 1)),
      entry: val('entry'),
      level: val('level'),
      orderNumber: val('orderNumber'),
      price: val('price') ? Number(val('price')) : '',
      notes: val('notes'),
      image: imageBlob,
      createdAt: ev.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    try {
      await TicketDB.put(record);
      requestPersistentStorage();
      toast(existing ? 'Changes saved' : 'Tickets saved');
      location.hash = `#/event/${encodeURIComponent(record.id)}`;
    } catch (e) {
      console.error(e);
      toast(`Could not save: ${e.message || e.name}`);
    }
  };

  document.getElementById('saveBtn').addEventListener('click', save);
  form.addEventListener('submit', e => { e.preventDefault(); save(); });
  document.getElementById('delBtn')?.addEventListener('click', async () => {
    if (!confirm(`Delete "${ev.title || 'this event'}" and all its tickets?`)) return;
    await TicketDB.remove(ev.id);
    toast('Event deleted');
    location.hash = '#/';
  });
}

/* ---------------- Account / storage ---------------- */

function fmtBytes(n) {
  if (!n && n !== 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`;
}

async function renderAccount() {
  setChrome({ tab: 'account' });
  const events = await TicketDB.all();
  const tickets = events.reduce((s, e) => s + ticketCount(e), 0);
  const est = await storageEstimate();
  const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
  const pct = est && est.quota ? Math.max(0.5, Math.min(100, (est.usage / est.quota) * 100)) : 0;
  const hasLegacy = !!localStorage.getItem('tickets');

  view.innerHTML = `
    <header class="page-head" style="padding-bottom:18px">
      <div class="row"><h1>My Account</h1></div>
    </header>

    <div class="section">
      <div class="section-title">Saved on this device</div>
      <div class="stat"><b>${events.length}</b> event${events.length === 1 ? '' : 's'} · <b>${tickets}</b> ticket${tickets === 1 ? '' : 's'}</div>
      ${est ? `
        <div class="stat" style="margin-top:10px;font-size:13px;color:var(--muted)">Using ${fmtBytes(est.usage)} of ${fmtBytes(est.quota)} available</div>
        <div class="meter"><i style="width:${pct}%"></i></div>` : '<div style="height:14px"></div>'}
      <div class="stat" style="padding-bottom:14px;font-size:13px;color:var(--muted)">
        ${persisted ? 'Storage is protected from automatic clean-up.' : 'Tip: install this app to your home screen so your tickets are never cleared.'}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Backup</div>
      <button class="item" id="exportBtn">${ICONS.download}<span class="grow">Export backup<small>Download all events and images as a file</small></span></button>
      <label class="item" style="cursor:pointer">${ICONS.upload}<span class="grow">Import backup<small>Restore events from a backup file</small></span>
        <input type="file" accept="application/json,.json" id="importInput" hidden>
      </label>
      ${hasLegacy ? `<button class="item" id="legacyBtn">${ICONS.migrate}<span class="grow">Import from old app<small>Copy tickets saved by the previous version</small></span></button>` : ''}
    </div>

    <div class="section">
      <button class="item danger" id="wipeBtn">${ICONS.trash}<span class="grow">Delete all tickets</span></button>
    </div>
  `;

  document.getElementById('exportBtn').addEventListener('click', exportBackup);
  document.getElementById('importInput').addEventListener('change', e => importBackup(e.target.files[0]));
  document.getElementById('legacyBtn')?.addEventListener('click', importLegacy);
  document.getElementById('wipeBtn').addEventListener('click', async () => {
    if (!events.length) return toast('Nothing to delete');
    if (!confirm(`Delete all ${events.length} events? This cannot be undone. Export a backup first if you want to keep them.`)) return;
    await TicketDB.clear();
    toast('All tickets deleted');
    renderAccount();
  });
}

async function exportBackup() {
  const events = await TicketDB.all();
  if (!events.length) return toast('No tickets to export');
  toast('Preparing backup…');
  const out = [];
  for (const e of events) {
    out.push({ ...e, image: e.image ? await blobToDataURL(e.image) : null });
  }
  const blob = new Blob([JSON.stringify({ app: 'tm-wallet', version: 1, exportedAt: new Date().toISOString(), events: out })], { type: 'application/json' });
  const name = `tickets-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: 'Tickets backup' }); return; } catch (_) { /* fall back to download */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`Exported ${events.length} event${events.length === 1 ? '' : 's'}`);
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
    toast(`Imported ${records.length} event${records.length === 1 ? '' : 's'}`);
    renderAccount();
  } catch (e) {
    toast(`Import failed: ${e.message}`);
  }
}

// Convert tickets saved by the previous (localStorage) version of the app.
async function importLegacy() {
  let old;
  try { old = JSON.parse(localStorage.getItem('tickets') || '[]'); } catch (_) { old = []; }
  if (!old.length) return toast('No old tickets found');
  const records = [];
  for (const t of old) {
    let image = null;
    try {
      if (t.bannerImage && t.bannerImage.startsWith('data:')) image = await dataURLToBlob(t.bannerImage);
      else if (t.bannerImage) image = await (await fetch(new URL(t.bannerImage, location.origin + '/'))).blob();
    } catch (_) {}
    const isGA = !t.seatType || t.seatType === 'General Admission';
    records.push({
      id: `legacy-${t.id || uid()}`,
      title: t.title || 'Untitled Event',
      startAt: t.eventDate || (t.parseableDate ? `${t.parseableDate}T19:00` : ''),
      dateText: t.date || '',
      venue: t.venue || '',
      city: t.venueLocation || '',
      ticketType: (t.ticketType === 'Custom' ? t.customTicketType : t.ticketType) || 'Standard Admission',
      isGA,
      section: t.section || '',
      row: t.row || '',
      seats: t.seat || '',
      quantity: parseInt(t.ticketCount, 10) || 1,
      entry: '',
      level: t.entryLevel || '',
      orderNumber: '',
      price: t.ticketPrice ? Number(t.ticketPrice) || '' : '',
      notes: '',
      image,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  await TicketDB.putMany(records);
  toast(`Imported ${records.length} event${records.length === 1 ? '' : 's'} from the old app`);
  renderAccount();
}

/* ---------------- Placeholder tabs ---------------- */

function renderPlaceholder(tab, title, text) {
  setChrome({ tab });
  view.innerHTML = `
    <header class="page-head" style="padding-bottom:18px"><div class="row"><h1>${esc(title)}</h1></div></header>
    <div class="empty">
      <div class="art">${ICONS.ticket}</div>
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <a class="btn" href="#/">Go to My Tickets</a>
    </div>`;
}

/* ---------------- boot ---------------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
  });
}

route();
