// My Events list, the ticket screen (barcode, event-day info, venue map)
// and the add/edit form.

/* ---------------- seats ---------------- */

// "12-15" → [12..15], "A1, A2" → ["A1","A2"], "12" + qty 3 → [12,13,14]
function seatList(ev) {
  const qty = Math.max(1, Math.min(100, parseInt(ev.quantity, 10) || 1));
  const raw = String(ev.seats || '').trim();
  if (!raw || ev.isGA) return Array.from({ length: qty }, () => '');
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

/* ---------------- countdown ---------------- */

const TEN_DAYS = 10 * 864e5;

function countdownParts(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}

function countdownHTML(ev) {
  const p = countdownParts(msUntil(ev));
  return `
    <div class="countdown" data-countdown="${esc(ev.startAt)}">
      <div><b data-u="d">${p.d}</b><small>Days</small></div>
      <div><b data-u="h">${p.h}</b><small>Hrs</small></div>
      <div><b data-u="m">${p.m}</b><small>Min</small></div>
      <div><b data-u="s">${p.s}</b><small>Sec</small></div>
    </div>`;
}

function startCountdowns() {
  const tick = () => {
    document.querySelectorAll('[data-countdown]').forEach(el => {
      const d = parseLocal(el.dataset.countdown);
      if (!d) return;
      const p = countdownParts(d - Date.now());
      for (const u of ['d', 'h', 'm', 's']) {
        const b = el.querySelector(`[data-u="${u}"]`);
        if (b && b.textContent !== String(p[u])) b.textContent = p[u];
      }
    });
  };
  addTimer(setInterval(tick, 1000));
}

/* ---------------- My Events ---------------- */

async function renderMyEvents() {
  setChrome({ tab: 'tickets' });
  const events = await TicketDB.all();
  const upcoming = events.filter(e => !isPast(e)).sort((a, b) => (a.startAt || '9999').localeCompare(b.startAt || '9999'));
  const past = events.filter(isPast).sort((a, b) => (b.startAt || '').localeCompare(a.startAt || ''));
  const tab = state.listTab;

  let body;
  if (tab === 'past') {
    body = past.length
      ? `<div class="ev-list" style="margin-top:12px">${past.map(e => evCardHTML(e, true)).join('')}</div>`
      : emptyEventsHTML('past');
  } else if (!upcoming.length) {
    body = emptyEventsHTML('upcoming');
  } else {
    const [next, ...rest] = upcoming;
    body = `
      ${nextEventHTML(next)}
      ${rest.length ? `
        <div class="sec">
          <div class="sec-head"><h2>More Events</h2></div>
          <div class="ev-list">${rest.map(e => evCardHTML(e)).join('')}</div>
        </div>` : ''}`;
  }

  view.innerHTML = `
    <div class="large-head">
      <h1>My Events</h1>
      <div class="head-actions"><a class="circle-btn" href="#/new" aria-label="Add tickets">${icon('plus')}</a></div>
    </div>
    <div class="segmented" id="seg">
      <button data-t="upcoming" class="${tab === 'upcoming' ? 'on' : ''}">Upcoming${upcoming.length ? ` (${upcoming.length})` : ''}</button>
      <button data-t="past" class="${tab === 'past' ? 'on' : ''}">Past${past.length ? ` (${past.length})` : ''}</button>
    </div>
    ${body}`;

  view.querySelectorAll('#seg button').forEach(b => b.onclick = () => {
    state.listTab = b.dataset.t;
    releaseURLs();
    clearTimers();
    view.classList.add('tab-switch');
    renderMyEvents();
  });
  startCountdowns();
}

function nextEventHTML(ev) {
  const n = ticketCount(ev);
  const soon = msUntil(ev) > 0 && msUntil(ev) <= TEN_DAYS;
  return `
    <a class="next-card" href="#/event/${encodeURIComponent(ev.id)}">
      ${coverHTML(ev.image)}
      <div class="top">
        <span class="tag solid">Next Event</span>
        <span class="tag">${icon('ticket')}${plural(n, 'ticket')}</span>
      </div>
      <div class="meta">
        <div class="d">${esc(['Today', 'Tonight', 'Tomorrow'].includes(relDay(ev)) ? `${relDay(ev)} • ` : '')}${esc(fmtShort(ev))}</div>
        <div class="t">${esc(ev.title || 'Untitled Event')}</div>
        ${venueLine(ev) ? `<div class="v">${esc(venueLine(ev))}</div>` : ''}
        ${soon ? countdownHTML(ev) : ''}
        <span class="btn white block">View Tickets</span>
      </div>
    </a>`;
}

function evCardHTML(ev, past = false) {
  const n = ticketCount(ev);
  return `
    <a class="ev-card ${past ? 'past' : ''}" href="#/event/${encodeURIComponent(ev.id)}">
      <div class="img">${coverHTML(ev.image)}</div>
      <div class="txt">
        <div class="k">${esc(fmtShort(ev))}</div>
        <div class="t">${esc(ev.title || 'Untitled Event')}</div>
        ${venueLine(ev) ? `<div class="s">${esc(venueLine(ev))}</div>` : ''}
        <div class="n">${icon('ticket')}${plural(n, 'ticket')}</div>
      </div>
    </a>`;
}

function emptyEventsHTML(tab) {
  if (tab === 'past') {
    return `<div class="empty"><div class="art">${icon('clock')}</div><h2>No past events</h2><p>Events you've been to will show up here.</p></div>`;
  }
  return `
    <div class="empty">
      <div class="art">${icon('ticket')}</div>
      <h2>No upcoming events</h2>
      <p>Tickets you add will show up here. They're saved on this device, so there's no account to sign in to.</p>
      <a class="btn" href="#/new">${icon('plus')}Add Tickets</a>
    </div>`;
}

/* ---------------- Ticket screen ---------------- */

function seatsHTML(ev, seat) {
  if (ev.isGA) {
    return `<div class="t-seats ga"><div><small>${ev.section ? 'SECTION' : 'ADMISSION'}</small><b>${esc(ev.section || 'GENERAL ADMISSION')}</b></div></div>`;
  }
  return `
    <div class="t-seats">
      <div><small>SEC</small><b>${esc(ev.section || '—')}</b></div>
      <div><small>ROW</small><b>${esc(ev.row || '—')}</b></div>
      <div><small>SEAT</small><b>${esc(seat || '—')}</b></div>
    </div>`;
}

function ticketHTML(ev, seat, i) {
  return `
    <article class="ticket" data-i="${i}">
      <div class="t-type">
        <span>${esc(ev.ticketType || 'Standard Admission')}</span>
        ${ev.price ? `<span class="fv">Face Value ${esc(money(ev.price))}</span>` : ''}
      </div>
      ${seatsHTML(ev, seat)}
      <div class="t-code">
        <div class="barcode" data-bc="${i}"><div class="bc-svg">${barcodeSVG(barcodeSeed(ev, i, seat))}</div><div class="light"></div></div>
        <div class="safetix">${icon('shield')}SafeTix™</div>
        <p class="note">Screenshots won't get you in.</p>
        ${'DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission === 'function'
          ? '<div class="tilt-hint" data-tilt>Tap the barcode, then tilt your phone</div>' : ''}
      </div>
      ${ev.entry || ev.level ? `
        <div class="t-foot">
          ${ev.entry ? `<div>Entry<b>${esc(ev.entry)}</b></div>` : '<div></div>'}
          ${ev.level ? `<div style="text-align:right">Level<b>${esc(ev.level)}</b></div>` : ''}
        </div>` : ''}
      <div class="t-wallet"><button class="btn wallet" data-wallet>${icon('wallet')}Add to Apple Wallet</button></div>
    </article>`;
}

async function renderTicket(id) {
  setChrome({ tab: 'tickets', tabbarVisible: false, grouped: true });
  const ev = await TicketDB.get(id);
  if (!ev) {
    view.innerHTML = `${navbarHTML({ back: '#/tickets', backLabel: 'My Events' })}<div class="empty"><h2>Event not found</h2><p>It may have been deleted.</p></div>`;
    return;
  }
  const seats = seatList(ev);
  const soon = msUntil(ev) > 0 && msUntil(ev) <= TEN_DAYS;
  const total = ev.price ? ev.price * seats.length : 0;

  view.innerHTML = `
    <div class="tix">
      <div class="tix-backdrop">${coverHTML(ev.image)}</div>
      ${navbarHTML({ clear: true, back: '#/tickets', backLabel: 'My Events', title: '', right: `<button class="nav-btn" id="moreBtn" aria-label="More">${icon('more')}</button>` })}
      <div class="tix-head">
        <h1>${esc(ev.title || 'Untitled Event')}</h1>
        <p>${esc(fmtLong(ev))}</p>
        ${venueLine(ev) ? `<p>${esc(venueLine(ev))}</p>` : ''}
        ${soon ? `<span class="tag">${icon('clock')}<span data-starts>${esc(startsIn(ev))}</span></span>` : ''}
      </div>

      <div class="tix-rail ${seats.length === 1 ? 'single' : ''}" id="rail">
        ${seats.map((s, i) => ticketHTML(ev, s, i)).join('')}
      </div>
      ${seats.length > 1 ? `<div class="dots" id="dots">${seats.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}

      <div class="tix-actions">
        <button class="btn" id="transferBtn">${icon('transfer')}Transfer</button>
        <button class="btn" id="sellBtn">${icon('tag')}Sell</button>
      </div>

      ${ev.venue || ev.city || ev.address ? `
        <div class="group-title">Getting There</div>
        ${venueMapBlockHTML(ev)}` : ''}

      <div class="group-title">Event Info</div>
      <div class="group">
        ${ev.policies ? cellHTML({ ic: 'bag', color: '#FF9500', label: 'Venue Policies', sub: 'Bag policy, prohibited items', id: 'polBtn' }) : ''}
        ${ev.accessibility ? cellHTML({ ic: 'access', color: '#007AFF', label: 'Accessibility', id: 'accBtn' }) : ''}
        ${cellHTML({ ic: 'receipt', color: '#34C759', label: 'Order Details', value: ev.orderNumber || '', id: 'orderBtn' })}
        ${cellHTML({ ic: 'info', color: '#8E8E93', label: 'Ticket Details', value: plural(seats.length, 'ticket'), id: 'detailsBtn' })}
      </div>
      ${total ? `<div class="group-foot">Total paid ${esc(money(total))} for ${plural(seats.length, 'ticket')}.</div>` : ''}
    </div>`;

  // carousel position
  const rail = document.getElementById('rail');
  const dots = document.getElementById('dots');
  if (dots) {
    rail.addEventListener('scroll', () => {
      const center = rail.scrollLeft + rail.clientWidth / 2;
      let best = 0, bestDist = Infinity;
      rail.querySelectorAll('.ticket').forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === best));
    }, { passive: true });
  }

  // rotating barcodes (new code every 15 seconds)
  let slot = Math.floor(Date.now() / 15000);
  addTimer(setInterval(() => {
    const now = Math.floor(Date.now() / 15000);
    if (now !== slot) {
      slot = now;
      rail.querySelectorAll('[data-bc]').forEach(el => {
        const i = +el.dataset.bc;
        el.querySelector('.bc-svg').innerHTML = barcodeSVG(barcodeSeed(ev, i, seats[i]));
      });
    }
    const starts = view.querySelector('[data-starts]');
    if (starts) starts.textContent = startsIn(ev);
  }, 1000));

  rail.querySelectorAll('.barcode, [data-tilt]').forEach(el => el.addEventListener('click', enableTilt));
  if (state.tiltOn) attachTilt();
  rail.querySelectorAll('[data-wallet]').forEach(b => b.onclick = () => toast('Apple Wallet passes aren\'t available for this event.'));
  document.getElementById('transferBtn').onclick = () => toast('Ticket transfer isn\'t available for this event yet.');
  document.getElementById('sellBtn').onclick = () => toast('Resale isn\'t available for this event yet.');
  document.getElementById('moreBtn').onclick = () => openEventMenu(ev);
  document.getElementById('polBtn')?.addEventListener('click', () => textSheet('Venue Policies', ev.policies));
  document.getElementById('accBtn')?.addEventListener('click', () => textSheet('Accessibility', ev.accessibility));
  document.getElementById('orderBtn').onclick = () => openOrder(ev, seats);
  document.getElementById('detailsBtn').onclick = () => openDetails(ev, seats);

  mountVenueMap(ev, async pos => {
    // Remember coordinates so the map shows instantly (and offline) next time.
    if (pos && typeof ev.lat !== 'number') {
      const fresh = await TicketDB.get(ev.id);
      if (fresh) TicketDB.put({ ...fresh, lat: pos.lat, lng: pos.lng, geoLabel: pos.label || '' });
    }
  });
}

function startsIn(ev) {
  const p = countdownParts(msUntil(ev));
  if (p.d > 0) return `Starts in ${p.d}d ${p.h}h ${p.m}m`;
  if (p.h > 0) return `Starts in ${p.h}h ${p.m}m`;
  return `Starts in ${p.m}m ${p.s}s`;
}

/* Tilt: the light on the barcode follows the phone's tilt, like the real
   ticket. iOS needs permission, which must be asked for from a tap. */
async function enableTilt() {
  if (state.tiltOn) return;
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') return;
    }
    state.tiltOn = true;
    attachTilt();
  } catch (_) {}
}

function attachTilt() {
  if (window._tiltHandler) window.removeEventListener('deviceorientation', window._tiltHandler);
  window._tiltHandler = e => {
    if (e.gamma == null) return;
    const x = Math.max(-25, Math.min(25, e.gamma));      // -25°..25° left/right
    const pct = ((x + 25) / 50) * 128 - 25;               // -25%..103%
    document.querySelectorAll('.barcode').forEach(b => {
      b.classList.add('tilt');
      b.style.setProperty('--light-x', `${pct.toFixed(1)}%`);
    });
    document.querySelectorAll('[data-tilt]').forEach(h => h.remove());
  };
  window.addEventListener('deviceorientation', window._tiltHandler);
}

function textSheet(title, text) {
  openSheet(`${sheetHead(title)}<div class="sheet-text">${esc(text)}</div>`);
}

function infoGroup(rows) {
  return `<div class="group">${rows.filter(([, v]) => v).map(([k, v]) => `
    <div class="cell noicon"><span class="lbl">${esc(k)}</span><span class="val">${esc(v)}</span></div>`).join('')}</div>`;
}

function openOrder(ev, seats) {
  const n = seats.length;
  openSheet(`
    ${sheetHead('Order Details')}
    ${infoGroup([
      ['Order number', ev.orderNumber || '—'],
      ['Tickets', String(n)],
      ['Price per ticket', ev.price ? money(ev.price) : ''],
      ['Total', ev.price ? money(ev.price * n) : ''],
    ])}
    ${ev.notes ? `<div class="group-title">Notes</div><div class="sheet-text">${esc(ev.notes)}</div>` : ''}`);
}

function openDetails(ev, seats) {
  openSheet(`
    ${sheetHead('Ticket Details')}
    ${infoGroup([
      ['Event', ev.title],
      ['Date', fmtLong(ev)],
      ['Venue', venueLine(ev)],
      ['Ticket type', ev.ticketType || 'Standard Admission'],
      ['Section', ev.isGA ? (ev.section || 'General Admission') : ev.section],
      ['Row', ev.isGA ? '' : ev.row],
      ['Seats', ev.isGA ? '' : seats.filter(Boolean).join(', ')],
      ['Entry', ev.entry],
      ['Level', ev.level],
    ])}`);
}

function openEventMenu(ev) {
  actionSheet(ev.title || '', [
    { label: 'Edit Event', run: () => { location.hash = `#/edit/${encodeURIComponent(ev.id)}`; } },
    { label: 'Duplicate Event', run: async () => {
      const copy = { ...ev, id: uid(), title: `${ev.title || 'Untitled Event'} (copy)`, createdAt: Date.now(), updatedAt: Date.now() };
      await TicketDB.put(copy);
      toast('Event duplicated');
      location.hash = `#/edit/${encodeURIComponent(copy.id)}`;
    } },
    { label: 'Delete Event', danger: true, run: () => confirmDelete(ev) },
  ]);
}

function confirmDelete(ev) {
  actionSheet(`Delete "${ev.title || 'this event'}" and all its tickets?`, [
    { label: 'Delete Event', danger: true, run: async () => {
      await TicketDB.remove(ev.id);
      toast('Event deleted');
      location.hash = '#/tickets';
    } },
  ]);
}

/* ---------------- Barcode (PDF417-style, rotating) ---------------- */

function barcodeSeed(ev, i, seat) {
  return `${ev.id}|${i}|${seat}|${Math.floor(Date.now() / 15000)}`;
}

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

function barcodeSVG(seed) {
  const rand = seededRandom(seed);
  const rows = 12, cols = 96, cw = 3, rh = 7;
  const w = cols * cw, h = rows * rh;
  let rects = '';
  const guard = (x, pattern) => {
    for (let r = 0; r < rows; r++) {
      let cx = x;
      pattern.forEach((len, k) => {
        if (k % 2 === 0) rects += `<rect x="${cx * cw}" y="${r * rh}" width="${len * cw}" height="${rh}"/>`;
        cx += len;
      });
    }
  };
  guard(0, [8, 1, 1, 1, 1, 1, 1, 3]);
  guard(cols - 9, [7, 1, 1, 3, 1, 1, 1, 2, 1]);
  for (let r = 0; r < rows; r++) {
    let x = 18, on = true;
    while (x < cols - 18) {
      const run = Math.min(1 + Math.floor(rand() * 4), cols - 18 - x);
      if (on) rects += `<rect x="${x * cw}" y="${r * rh}" width="${run * cw}" height="${rh}"/>`;
      x += run;
      on = !on;
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" fill="#000" shape-rendering="crispEdges">${rects}</svg>`;
}

/* ---------------- Venue map ---------------- */

function venueMapBlockHTML(ev) {
  return `
    <div class="map-wrap">
      <div class="venue-map" id="venueMap"><div class="map-msg">Loading map…</div></div>
      <div class="venue-row">
        <div class="txt">
          <b>${esc(ev.venue || ev.city || 'Venue')}</b>
          <span>${esc([ev.address, ev.venue ? ev.city : ''].filter(Boolean).join(', '))}</span>
        </div>
        <a class="btn sm tinted" id="dirBtn" href="${esc(VenueMap.directionsURL(ev, null))}" target="_blank" rel="noopener">${icon('nav', 'sm')}Directions</a>
      </div>
    </div>`;
}

async function mountVenueMap(ev, onLocated) {
  const el = document.getElementById('venueMap');
  if (!el) return;
  const msg = text => { el.innerHTML = `<div class="map-msg">${text}</div>`; };
  if (!navigator.onLine && typeof ev.lat !== 'number') return msg('Map unavailable offline');
  try {
    const pos = await VenueMap.locate(ev);
    if (!document.body.contains(el)) return;
    if (!pos) return msg('Location not found. Add the venue address when editing this event.');
    el.innerHTML = '';
    await VenueMap.render(el, pos.lat, pos.lng);
    const dir = document.getElementById('dirBtn');
    if (dir) dir.href = VenueMap.directionsURL(ev, pos);
    el.onclick = () => openFullMap(ev, pos);
    if (onLocated) onLocated(pos);
  } catch (e) {
    console.warn(e);
    if (document.body.contains(el)) msg('Map unavailable right now');
  }
}

function openFullMap(ev, pos) {
  const sheet = openSheet(`
    ${sheetHead(ev.venue || 'Venue')}
    <div class="full-map" id="fullMap"></div>
    <div style="padding:14px 16px 0">
      <a class="btn block" href="${esc(VenueMap.directionsURL(ev, pos))}" target="_blank" rel="noopener">${icon('nav')}Get Directions</a>
    </div>`);
  VenueMap.render(sheet.querySelector('#fullMap'), pos.lat, pos.lng, { interactive: true, zoom: 16 });
}

/* ---------------- Add / edit form ---------------- */

async function renderForm(id) {
  setChrome({ tabbarVisible: false, grouped: true });
  const existing = id ? await TicketDB.get(id) : null;
  if (id && !existing) {
    view.innerHTML = `${navbarHTML({ back: '#/tickets', backLabel: 'My Events' })}<div class="empty"><h2>Event not found</h2></div>`;
    return;
  }
  const prefill = !existing && state.prefill ? state.prefill : null;
  state.prefill = null;
  const ev = existing || { quantity: 2, ticketType: 'Standard Admission', isGA: false, ...(prefill || {}) };
  if (typeof ev.image === 'string') {
    try { ev.image = await (await fetch(ev.image)).blob(); } catch (_) { ev.image = null; }
  }
  let imageBlob = ev.image || null;

  const f = (name, label, opts = {}) => `
    <div class="fcell">
      <label for="f-${name}">${label}</label>
      <input id="f-${name}" name="${name}" type="${opts.type || 'text'}" value="${esc(ev[name] ?? '')}"
        ${opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : ''} ${opts.attrs || ''}>
    </div>`;
  const ta = (name, label, placeholder) => `
    <div class="fcell"><label for="f-${name}">${label}</label>
      <textarea id="f-${name}" name="${name}" placeholder="${esc(placeholder)}">${esc(ev[name] || '')}</textarea>
    </div>`;
  const cancelHref = existing ? `#/event/${encodeURIComponent(ev.id)}` : '#/tickets';

  view.innerHTML = `
    <header class="navbar">
      <div class="left"><a class="nav-btn" href="${cancelHref}">Cancel</a></div>
      <div class="title">${existing ? 'Edit Event' : 'Add Tickets'}</div>
      <div class="right"><button class="nav-btn bold" id="saveBtn">Save</button></div>
    </header>
    <form class="form" id="evForm" autocomplete="off">
      <div class="group-title">Event Image</div>
      <label class="image-pick" id="imgPick">
        ${imageBlob ? `<img src="${objectURL(imageBlob)}" alt="">` : `<span class="ip-empty">${icon('image')}Add Photo</span>`}
        <input type="file" accept="image/*" id="f-image">
      </label>
      <div class="group-foot" id="imgActions" ${imageBlob ? '' : 'hidden'}><button type="button" id="rmImg" style="color:var(--danger)">Remove photo</button></div>

      <div class="group-title">Event</div>
      <div class="group">
        ${f('title', 'Event name', { placeholder: 'Taylor Swift | The Eras Tour' })}
        ${f('startAt', 'Date & time', { type: 'datetime-local' })}
        <div class="frow">
          ${f('venue', 'Venue', { placeholder: 'SoFi Stadium' })}
          ${f('city', 'City', { placeholder: 'Inglewood, CA' })}
        </div>
        ${f('address', 'Venue address (for the map)', { placeholder: 'Optional — 1001 Stadium Dr' })}
      </div>

      <div class="group-title">Tickets</div>
      <div class="group">
        ${f('ticketType', 'Ticket type', { placeholder: 'Standard Admission' })}
        <div class="cell noicon"><span class="lbl">General admission</span><label class="switch"><input type="checkbox" id="f-isGA" ${ev.isGA ? 'checked' : ''}><span></span></label></div>
        <div class="frow three" id="seatRow">
          ${f('section', 'Section', { placeholder: '112' })}
          ${f('row', 'Row', { placeholder: 'K' })}
          ${f('seats', 'Seat(s)', { placeholder: '14' })}
        </div>
        ${f('quantity', 'Number of tickets', { type: 'number', attrs: 'min="1" max="100" inputmode="numeric"' })}
        <div class="frow">
          ${f('entry', 'Entry / Gate', { placeholder: 'Gate A' })}
          ${f('level', 'Level', { placeholder: 'Lower Level' })}
        </div>
      </div>
      <div class="group-foot">Seat "14" with 3 tickets gives seats 14, 15, 16. You can also type a range like "14-17" or a list like "A1, A2".</div>

      <div class="group-title">Order</div>
      <div class="group">
        <div class="frow">
          ${f('orderNumber', 'Order number', { placeholder: '12-34567/LAX' })}
          ${f('price', 'Price per ticket ($)', { type: 'number', attrs: 'min="0" step="0.01" inputmode="decimal"' })}
        </div>
        ${ta('notes', 'Notes', 'Optional')}
      </div>
      <div class="group-foot">The price shows on each ticket as its face value.</div>

      <div class="group-title">Event-Day Info</div>
      <div class="group">
        ${ta('policies', 'Venue policies', 'e.g. Bag policy, prohibited items')}
        ${ta('accessibility', 'Accessibility', 'e.g. Accessible entrances, elevators, services')}
      </div>
      <div class="group-foot">Shown on the ticket screen. Leave blank to hide.</div>

      ${existing ? `<div class="group-title"></div><div class="group"><button type="button" class="cell noicon danger center" id="delBtn">Delete Event</button></div>` : ''}
    </form>`;

  const form = document.getElementById('evForm');
  const pick = document.getElementById('imgPick');
  const fileInput = document.getElementById('f-image');
  const imgActions = document.getElementById('imgActions');
  const gaToggle = document.getElementById('f-isGA');

  const syncGA = () => {
    const ga = gaToggle.checked;
    document.getElementById('f-row').closest('.fcell').style.display = ga ? 'none' : '';
    document.getElementById('f-seats').closest('.fcell').style.display = ga ? 'none' : '';
    document.getElementById('seatRow').classList.toggle('three', !ga);
  };
  gaToggle.addEventListener('change', syncGA);
  syncGA();

  const showPreview = blob => {
    pick.querySelector('img, .ip-empty')?.remove();
    if (blob) {
      const img = document.createElement('img');
      img.src = objectURL(blob);
      pick.prepend(img);
    } else {
      pick.insertAdjacentHTML('afterbegin', `<span class="ip-empty">${icon('image')}Add Photo</span>`);
    }
    imgActions.hidden = !blob;
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
      address: val('address'),
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
      policies: val('policies'),
      accessibility: val('accessibility'),
      image: imageBlob,
      createdAt: ev.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    // Look the venue up again on the map if its location changed.
    if ([record.venue, record.city, record.address].join('|') !== [ev.venue, ev.city, ev.address].join('|')) {
      delete record.lat; delete record.lng; delete record.geoLabel;
    }
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
  document.getElementById('delBtn')?.addEventListener('click', () => confirmDelete(ev));
}
