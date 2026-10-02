// Home (For You / Trending / Last Minute), Search, Watchlist, event pages
// and the home page editor.
//
// Home content comes from content/home.json (edit that file and redeploy to
// update Home for everyone), unless this device has a customised copy saved
// from the in-app editor (Account → Customize Home).

const HOME_URL = 'content/home.json';
const HOME_OVERRIDE_KEY = 'homeOverride';
const HOME_TABS = [['foryou', 'For You'], ['trending', 'Trending'], ['lastminute', 'Last Minute']];

const homeState = {
  tab: 'foryou',
  category: 'All',
  draft: null,
  draftSource: null,
};

const CATEGORY_STYLE = {
  'Concerts': ['#E11D48', 'music'],
  'Sports': ['#16A34A', 'ball'],
  'Arts & Theater': ['#9333EA', 'mask'],
  'Comedy': ['#F59E0B', 'mic'],
  'Family': ['#0891B2', 'family'],
};

async function loadHome() {
  const local = await TicketDB.getSetting(HOME_OVERRIDE_KEY).catch(() => undefined);
  if (local) return { data: local, source: 'device' };
  try {
    const res = await fetch(HOME_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return { data: await res.json(), source: 'published' };
  } catch (_) {
    return { data: { location: '', categories: ['All'], sections: [] }, source: 'offline' };
  }
}

function allHomeItems(data) {
  const seen = new Set();
  return (data.sections || []).flatMap(s => s.items || []).filter(i => !seen.has(i.id) && seen.add(i.id));
}

function userLocation(data) {
  try { return localStorage.getItem('location') || data.location || ''; } catch (_) { return data.location || ''; }
}

function priceFrom(item) {
  return item.priceFrom ? `From ${money(item.priceFrom)}` : '';
}

function exploreHref(item) {
  return `#/explore/${encodeURIComponent(item.id)}`;
}

/* ---------------- Watchlist storage ---------------- */

async function getWatchlist() {
  let list = await TicketDB.getSetting('watchlist').catch(() => null);
  if (!list) {
    // carry over favourites saved by the previous version
    list = (await TicketDB.getSetting('favorites').catch(() => null)) || [];
    if (list.length) await TicketDB.setSetting('watchlist', list);
  }
  return list;
}

async function toggleWatch(id) {
  const list = await getWatchlist();
  const on = !list.includes(id);
  await TicketDB.setSetting('watchlist', on ? [...list, id] : list.filter(x => x !== id));
  toast(on ? 'Added to Watchlist' : 'Removed from Watchlist');
  return on;
}

function watchBtnHTML(item, watched) {
  return `<button class="round-btn save-btn ${watched ? 'on' : ''}" data-watch="${esc(item.id)}" aria-label="Watchlist">${icon('bookmark')}</button>`;
}

// One delegated handler for every watchlist button on the page.
view.addEventListener('click', async e => {
  const b = e.target.closest('[data-watch]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  const on = await toggleWatch(b.dataset.watch);
  document.querySelectorAll(`[data-watch="${CSS.escape(b.dataset.watch)}"]`).forEach(x => x.classList.toggle('on', on));
  if ((location.hash || '').startsWith('#/watchlist') && !on) renderWatchlist();
});

/* ---------------- shared item renderers ---------------- */

function heroHTML(item, watched) {
  return `
    <a class="hero" href="${exploreHref(item)}">
      ${coverHTML(item.image, item.color)}
      ${item.badge ? `<span class="badge">${esc(item.badge)}</span>` : ''}
      ${watchBtnHTML(item, watched)}
      <div class="meta">
        ${item.startAt ? `<div class="kicker">${esc(fmtShort(item))}</div>` : (item.category ? `<div class="kicker">${esc(item.category)}</div>` : '')}
        <div class="t">${esc(item.title)}</div>
        ${venueLine(item) ? `<div class="sub">${esc(venueLine(item))}</div>` : ''}
        <span class="btn white sm cta">${item.url ? 'Find Tickets' : 'See Details'}</span>
      </div>
    </a>`;
}

function cardHTML(item, watched) {
  return `
    <a class="card" href="${exploreHref(item)}">
      <div class="img">${coverHTML(item.image, item.color)}${watchBtnHTML(item, watched)}</div>
      <div class="t">${esc(item.title)}</div>
      ${item.startAt ? `<div class="d">${esc(fmtShort(item))}</div>` : ''}
      ${venueLine(item) ? `<div class="v">${esc(venueLine(item))}</div>` : ''}
      ${priceFrom(item) ? `<div class="p">${esc(priceFrom(item))}</div>` : ''}
    </a>`;
}

function rowHTML(item, { href = exploreHref(item), rank = 0, showRel = false } = {}) {
  const rel = showRel ? relDay(item) : '';
  return `
    <a class="row ${rank ? 'ranked' : ''}" href="${href}">
      ${rank ? `<span class="rank">${rank}</span>` : ''}
      <div class="img">${coverHTML(item.image, item.color)}</div>
      <div class="txt">
        ${item.startAt ? `<div class="k">${esc(fmtShort(item))}</div>` : ''}
        <div class="t">${esc(item.title || 'Untitled Event')}</div>
        ${venueLine(item) ? `<div class="s">${esc(venueLine(item))}</div>` : ''}
        ${rel ? `<div style="margin-top:5px"><span class="pill">${esc(rel)}</span></div>` : ''}
      </div>
      ${icon('chev', 'chev end')}
    </a>`;
}

function matchesCategory(item, cat) {
  return !cat || cat === 'All' || item.category === cat;
}

/* ---------------- Home ---------------- */

async function renderHome() {
  setChrome({ tab: 'home' });
  const [{ data }, watch] = await Promise.all([loadHome(), getWatchlist()]);
  const cats = data.categories && data.categories.length ? data.categories : ['All'];
  if (!cats.includes(homeState.category)) homeState.category = 'All';

  view.innerHTML = `
    <div class="home-top">
      <span class="wordmark">ticketmaster</span>
      <button class="loc-btn" id="locBtn">${icon('pin')}<span>${esc(userLocation(data) || 'Set location')}</span>${icon('down')}</button>
    </div>
    <nav class="home-tabs" id="homeTabs">
      ${HOME_TABS.map(([k, label]) => `<button data-t="${k}" class="${homeState.tab === k ? 'on' : ''}">${label}</button>`).join('')}
    </nav>
    <div class="chips" id="chips">
      ${cats.map(c => `<button class="chip ${c === homeState.category ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div id="homeBody"></div>`;

  const body = document.getElementById('homeBody');
  const draw = () => {
    releaseURLs();
    body.innerHTML = homeTabHTML(data, homeState.tab, homeState.category, watch);
  };
  view.querySelectorAll('#homeTabs button').forEach(b => b.onclick = () => {
    homeState.tab = b.dataset.t;
    view.querySelectorAll('#homeTabs button').forEach(x => x.classList.toggle('on', x === b));
    draw();
  });
  view.querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
    homeState.category = ch.dataset.c;
    view.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === ch));
    draw();
  });
  document.getElementById('locBtn').onclick = () => openLocationSheet(data);
  draw();
}

function sectionsFor(data, tab) {
  return (data.sections || []).filter(s => (s.tab || 'foryou') === tab);
}

function homeTabHTML(data, tab, cat, watch) {
  const w = id => watch.includes(id);
  const emptyMsg = `<div class="empty"><div class="art">${icon('search')}</div><h2>Nothing here yet</h2><p>No ${cat === 'All' ? '' : esc(cat) + ' '}events right now. Check back soon.</p></div>`;

  if (tab === 'trending') {
    const secs = sectionsFor(data, 'trending');
    const list = (secs.length ? secs.flatMap(s => s.items || []) : allHomeItems(data)).filter(i => matchesCategory(i, cat));
    if (!list.length) return emptyMsg;
    return `
      <div class="sec" style="margin-top:18px">
        <div class="sec-head"><h2>${esc(secs[0]?.title || 'Trending Now')}</h2></div>
        <div class="rows">${list.slice(0, 20).map((it, i) => rowHTML(it, { rank: i + 1 })).join('')}</div>
      </div>`;
  }

  if (tab === 'lastminute') {
    const tagged = sectionsFor(data, 'lastminute').flatMap(s => s.items || []);
    const soon = allHomeItems(data).filter(i => { const ms = msUntil(i); return ms > -3 * 3600e3 && ms < 14 * 864e5; });
    const ids = new Set();
    const list = [...tagged, ...soon]
      .filter(i => !ids.has(i.id) && ids.add(i.id))
      .filter(i => matchesCategory(i, cat))
      .sort((a, b) => (a.startAt || '9999').localeCompare(b.startAt || '9999'));
    if (!list.length) return `<div class="empty"><div class="art">${icon('clock')}</div><h2>No last-minute events</h2><p>Events happening in the next two weeks will show up here.</p></div>`;
    return `
      <div class="sec" style="margin-top:18px">
        <div class="sec-head"><h2>Happening Soon</h2></div>
        <div class="rows">${list.map(it => rowHTML(it, { showRel: true })).join('')}</div>
      </div>`;
  }

  const html = sectionsFor(data, 'foryou').map(sec => {
    const items = (sec.items || []).filter(i => matchesCategory(i, cat));
    if (!items.length) return '';
    if (sec.style === 'hero') {
      return `<div class="sec" style="margin-top:16px"><div class="rail">${items.map(i => heroHTML(i, w(i.id))).join('')}</div></div>`;
    }
    const seeAll = items.length > 3 ? `<a href="#/section/${encodeURIComponent(sec.id)}">See All</a>` : '';
    if (sec.style === 'list') {
      return `<div class="sec"><div class="sec-head"><h2>${esc(sec.title)}</h2>${seeAll}</div><div class="rows">${items.slice(0, 5).map(i => rowHTML(i)).join('')}</div></div>`;
    }
    return `<div class="sec"><div class="sec-head"><h2>${esc(sec.title)}</h2>${seeAll}</div><div class="rail">${items.map(i => cardHTML(i, w(i.id))).join('')}</div></div>`;
  }).join('');
  return html || emptyMsg;
}

function openLocationSheet(data) {
  const current = userLocation(data);
  const sheet = openSheet(`
    ${sheetHead('Location', { left: '<button class="nav-btn" data-close>Cancel</button>', right: '<button class="nav-btn bold" id="locSave">Done</button>' })}
    <div class="group" style="margin-top:6px">
      <div class="fcell"><label for="locInput">City</label><input id="locInput" value="${esc(current)}" placeholder="e.g. Los Angeles, CA" autocomplete="off"></div>
    </div>
    ${data.location ? `<div class="group-title">Suggested</div><div class="group">${cellHTML({ ic: 'pin', label: data.location, id: 'locDefault', chevron: false })}</div>` : ''}`);
  const save = v => {
    try { if (v) localStorage.setItem('location', v); else localStorage.removeItem('location'); } catch (_) {}
    sheet.close();
    renderHome();
  };
  sheet.querySelector('#locSave').onclick = () => save(sheet.querySelector('#locInput').value.trim());
  sheet.querySelector('#locDefault')?.addEventListener('click', () => save(''));
  setTimeout(() => sheet.querySelector('#locInput').focus(), 300);
}

async function renderSectionPage(id) {
  setChrome({ tab: 'home', tabbarVisible: true });
  const { data } = await loadHome();
  const sec = (data.sections || []).find(s => String(s.id) === id);
  view.innerHTML = `
    ${navbarHTML({ back: '#/', backLabel: 'Home', title: sec ? sec.title : '' })}
    ${sec ? `<div class="rows" style="margin-top:6px">${(sec.items || []).map(i => rowHTML(i)).join('')}</div>`
      : '<div class="empty"><h2>Section not found</h2></div>'}`;
}

/* ---------------- Search ---------------- */

function getRecent() {
  try { return JSON.parse(localStorage.getItem('recentSearches') || '[]'); } catch (_) { return []; }
}

function addRecent(q) {
  if (!q) return;
  const list = [q, ...getRecent().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  try { localStorage.setItem('recentSearches', JSON.stringify(list)); } catch (_) {}
}

async function renderSearch(initial = '') {
  setChrome({ tab: 'search' });
  const { data } = await loadHome();
  const mine = await TicketDB.all();
  const cats = (data.categories || []).filter(c => c !== 'All');

  view.innerHTML = `
    <div class="large-head"><h1>Search</h1></div>
    <div class="searchbar">
      <label class="search-field">${icon('search')}<input id="q" type="search" placeholder="Artists, events, venues" value="${esc(initial)}" autocomplete="off" enterkeyhint="search"></label>
      <button class="cancel" id="qCancel" ${initial ? '' : 'hidden'}>Cancel</button>
    </div>
    <div id="searchBody"></div>`;

  const q = document.getElementById('q');
  const cancel = document.getElementById('qCancel');
  const body = document.getElementById('searchBody');

  const browse = () => {
    const recent = getRecent();
    body.innerHTML = `
      ${recent.length ? `
        <div class="sec" style="margin-top:12px">
          <div class="sec-head"><h2>Recent Searches</h2><button id="clearRecent">Clear</button></div>
          <div class="recent">${recent.map(r => `<button data-r="${esc(r)}">${icon('clock', 'sm')}${esc(r)}</button>`).join('')}</div>
        </div>` : ''}
      ${cats.length ? `
        <div class="sec" style="margin-top:${recent.length ? 26 : 12}px">
          <div class="sec-head"><h2>Browse Categories</h2></div>
          <div class="cat-grid">${cats.map(c => {
            const [color, ic] = CATEGORY_STYLE[c] || ['#024DDF', 'sparkle'];
            return `<button class="cat-tile" data-cat="${esc(c)}" style="background:${color}">${esc(c)}${icon(ic)}</button>`;
          }).join('')}</div>
        </div>` : ''}`;
    body.querySelector('#clearRecent')?.addEventListener('click', () => { try { localStorage.removeItem('recentSearches'); } catch (_) {} browse(); });
    body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { q.value = b.dataset.r; run(true); });
    body.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { q.value = b.dataset.cat; run(true); });
  };

  const run = remember => {
    releaseURLs();
    const text = q.value.trim();
    cancel.hidden = !text;
    if (!text) return browse();
    if (remember) addRecent(text);
    const t = text.toLowerCase();
    const hit = x => [x.title, x.venue, x.city, x.category].some(v => String(v || '').toLowerCase().includes(t));
    const events = allHomeItems(data).filter(hit);
    const yours = mine.filter(hit);
    body.innerHTML = !events.length && !yours.length
      ? `<div class="empty"><div class="art">${icon('search')}</div><h2>No results for "${esc(text)}"</h2><p>Check the spelling or try another search.</p></div>`
      : `
        ${yours.length ? `<div class="sec" style="margin-top:10px"><div class="sec-head"><h2>Your Tickets</h2></div><div class="rows">${yours.map(e => rowHTML(e, { href: `#/event/${encodeURIComponent(e.id)}` })).join('')}</div></div>` : ''}
        ${events.length ? `<div class="sec" style="margin-top:10px"><div class="sec-head"><h2>Events</h2></div><div class="rows">${events.map(i => rowHTML(i)).join('')}</div></div>` : ''}`;
  };

  q.addEventListener('input', () => { clearTimeout(q._t); q._t = setTimeout(() => run(false), 150); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { q.blur(); run(true); } });
  cancel.onclick = () => { q.value = ''; q.blur(); run(false); };
  run(!!initial);
}

/* ---------------- Watchlist ---------------- */

async function renderWatchlist() {
  setChrome({ tab: 'watchlist' });
  const [{ data }, watch] = await Promise.all([loadHome(), getWatchlist()]);
  const items = allHomeItems(data).filter(i => watch.includes(i.id))
    .sort((a, b) => (a.startAt || '9999').localeCompare(b.startAt || '9999'));
  view.innerHTML = `
    <div class="large-head"><h1>Watchlist</h1></div>
    ${items.length ? `
      <div class="rows" style="margin-top:8px">${items.map(i => `
        <div style="position:relative">${rowHTML(i, { showRel: true }).replace(icon('chev', 'chev end'), '')}
          <button class="round-btn on" data-watch="${esc(i.id)}" style="position:absolute;right:0;top:50%;transform:translateY(-50%);background:var(--fill);color:var(--link)" aria-label="Remove">${icon('bookmark')}</button>
        </div>`).join('')}
      </div>` : `
      <div class="empty">
        <div class="art">${icon('bookmark')}</div>
        <h2>Your Watchlist is empty</h2>
        <p>Tap the bookmark on any event to keep track of on-sales, presales and reminders.</p>
        <a class="btn" href="#/">Explore Events</a>
      </div>`}`;
}

/* ---------------- Event page ---------------- */

async function renderExplore(id) {
  setChrome({ tab: 'home', tabbarVisible: false });
  const [{ data }, watch] = await Promise.all([loadHome(), getWatchlist()]);
  const item = allHomeItems(data).find(i => String(i.id) === id);
  if (!item) {
    view.innerHTML = `${navbarHTML({ back: '#/', backLabel: 'Home' })}<div class="empty"><h2>Event not found</h2><p>It may have been removed from Home.</p></div>`;
    return;
  }

  view.innerHTML = `
    <div class="ex">
      <div class="ex-hero">
        ${coverHTML(item.image, item.color)}
        <div class="bar">
          <button class="round-btn" id="backBtn" aria-label="Back">${icon('back')}</button>
          <div>
            <button class="round-btn" id="shareBtn" aria-label="Share">${icon('share')}</button>
            <button class="round-btn ${watch.includes(item.id) ? 'on' : ''}" data-watch="${esc(item.id)}" aria-label="Watchlist">${icon('bookmark')}</button>
          </div>
        </div>
      </div>
      <div class="ex-body">
        ${item.category ? `<div class="k">${esc(item.category)}</div>` : ''}
        <h1>${esc(item.title)}</h1>
        ${item.startAt || item.dateText ? `<div class="ex-line">${icon('calendar')}<span>${esc(fmtLong(item))}</span></div>` : ''}
        ${venueLine(item) ? `<div class="ex-line">${icon('pin')}<span>${esc(venueLine(item))}</span></div>` : ''}
        ${item.about ? `<h2>About</h2><p class="about">${esc(item.about)}</p>` : ''}
        ${item.venue || item.city ? `<h2>Venue</h2>${venueMapBlockHTML(item)}` : ''}
      </div>
    </div>`;

  const bar = document.createElement('div');
  bar.className = 'buybar';
  bar.innerHTML = `
    ${item.priceFrom ? `<div class="price"><small>Tickets from</small><b>${esc(money(item.priceFrom))}</b></div>` : ''}
    <div class="btns">
      ${item.url ? `<a class="btn" href="${esc(item.url)}" target="_blank" rel="noopener">Find Tickets</a>` : ''}
      <button class="btn ${item.url ? 'gray' : ''}" id="addMine">Add to My Tickets</button>
    </div>`;
  document.body.appendChild(bar);

  document.getElementById('backBtn').onclick = () => {
    if (history.length > 1) history.back(); else location.hash = '#/';
  };
  bar.querySelector('#addMine').onclick = () => {
    state.prefill = {
      title: item.title, startAt: item.startAt || '', venue: item.venue || '', city: item.city || '',
      address: item.address || '', image: item.image || null, lat: item.lat, lng: item.lng,
    };
    location.hash = '#/new';
  };
  document.getElementById('shareBtn').onclick = async () => {
    const shareData = { title: item.title, text: [item.title, fmtLong(item), venueLine(item)].filter(Boolean).join(' · '), url: location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
    } catch (_) {}
  };
  mountVenueMap(item, null);
}

/* ---------------- Home page editor ---------------- */

function cloneHome(data) {
  // structuredClone keeps Blobs intact; fall back for older browsers.
  if (window.structuredClone) return structuredClone(data);
  return { ...data, sections: (data.sections || []).map(s => ({ ...s, items: (s.items || []).map(i => ({ ...i })) })) };
}

async function renderHomeEditor() {
  setChrome({ tabbarVisible: false, grouped: true });
  if (!homeState.draft) {
    const { data, source } = await loadHome();
    homeState.draft = cloneHome(data);
    homeState.draftSource = source;
  }
  const d = homeState.draft;
  d.sections = d.sections || [];

  view.innerHTML = `
    <header class="navbar">
      <div class="left"><button class="nav-btn" id="edCancel">Cancel</button></div>
      <div class="title">Customize Home</div>
      <div class="right"><button class="nav-btn bold" id="edSave">Save</button></div>
    </header>
    <div class="form">
      <div class="hint-box">${homeState.draftSource === 'device'
        ? 'You\'re editing the Home page saved on <b>this device</b>.'
        : 'Saving applies to <b>this device</b>. To update Home for everyone, tap <b>Export home.json</b> and replace <code>content/home.json</code> on your site.'}</div>

      <div class="group-title">General</div>
      <div class="group">
        <div class="fcell"><label for="ed-loc">Default location</label><input id="ed-loc" value="${esc(d.location || '')}" placeholder="Los Angeles, CA"></div>
        <div class="fcell"><label for="ed-cats">Categories (comma separated)</label><input id="ed-cats" value="${esc((d.categories || []).join(', '))}" placeholder="All, Concerts, Sports"></div>
      </div>

      <div class="group-title">Sections</div>
      ${d.sections.map((s, si) => `
        <div class="ed-sec">
          <div class="ed-sec-head">
            <input class="ed-sec-title" data-si="${si}" value="${esc(s.title || '')}" placeholder="Section title">
            <select class="ed-sec-tab" data-si="${si}">
              ${HOME_TABS.map(([k, label]) => `<option value="${k}" ${(s.tab || 'foryou') === k ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
            <select class="ed-sec-style" data-si="${si}">
              <option value="hero" ${s.style === 'hero' ? 'selected' : ''}>Banners</option>
              <option value="cards" ${s.style === 'cards' || !s.style ? 'selected' : ''}>Cards</option>
              <option value="list" ${s.style === 'list' ? 'selected' : ''}>List</option>
            </select>
          </div>
          ${(s.items || []).map((it, ii) => `
            <div class="ed-item">
              <div class="img">${coverHTML(it.image, it.color)}</div>
              <button class="ed-item-title" data-edit="${si}:${ii}">${esc(it.title || 'Untitled')}<small>${esc([it.category, it.startAt ? fmtShort(it) : ''].filter(Boolean).join(' · '))}</small></button>
              <button class="mini" data-move="${si}:${ii}:-1" aria-label="Move up">↑</button>
              <button class="mini" data-move="${si}:${ii}:1" aria-label="Move down">↓</button>
            </div>`).join('')}
          <div class="ed-actions">
            <button data-add-item="${si}">+ Add Event</button>
            <button data-sec-move="${si}:-1">Move Up</button>
            <button data-sec-move="${si}:1">Move Down</button>
            <button class="rm" data-sec-del="${si}">Delete</button>
          </div>
        </div>`).join('')}

      <div class="group-title"></div>
      <div class="group">
        <button class="cell noicon link" id="addSection"><span class="lbl">Add Section</span></button>
        <button class="cell noicon link" id="exportHome"><span class="lbl">Export home.json</span></button>
      </div>
      <div class="group-title"></div>
      <div class="group"><button class="cell noicon danger center" id="resetHome">Reset to Published Home</button></div>
    </div>`;

  const syncFields = () => {
    d.location = document.getElementById('ed-loc').value.trim();
    const cats = document.getElementById('ed-cats').value.split(',').map(s => s.trim()).filter(Boolean);
    d.categories = cats.length ? (cats.includes('All') ? cats : ['All', ...cats]) : ['All'];
    view.querySelectorAll('.ed-sec-title').forEach(i => { d.sections[+i.dataset.si].title = i.value.trim(); });
    view.querySelectorAll('.ed-sec-style').forEach(i => { d.sections[+i.dataset.si].style = i.value; });
    view.querySelectorAll('.ed-sec-tab').forEach(i => { d.sections[+i.dataset.si].tab = i.value; });
  };
  const rerender = () => { syncFields(); releaseURLs(); renderHomeEditor(); };
  const swap = (arr, i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  };

  document.getElementById('edCancel').onclick = () => { homeState.draft = null; location.hash = '#/account'; };
  document.getElementById('edSave').onclick = async () => {
    syncFields();
    d.updated = new Date().toISOString().slice(0, 10);
    await TicketDB.setSetting(HOME_OVERRIDE_KEY, d);
    homeState.draft = null;
    toast('Home saved');
    location.hash = '#/';
  };
  document.getElementById('addSection').onclick = () => {
    syncFields();
    d.sections.push({ id: uid(), title: 'New Section', tab: 'foryou', style: 'cards', items: [] });
    rerender();
  };
  view.querySelectorAll('[data-sec-del]').forEach(b => b.onclick = () => {
    const si = +b.dataset.secDel;
    syncFields();
    actionSheet(`Delete "${d.sections[si].title || 'Untitled'}" and its events?`, [
      { label: 'Delete Section', danger: true, run: () => { d.sections.splice(si, 1); rerender(); } },
    ]);
  });
  view.querySelectorAll('[data-sec-move]').forEach(b => b.onclick = () => {
    const [si, dir] = b.dataset.secMove.split(':').map(Number);
    syncFields();
    swap(d.sections, si, dir);
    rerender();
  });
  view.querySelectorAll('[data-move]').forEach(b => b.onclick = () => {
    const [si, ii, dir] = b.dataset.move.split(':').map(Number);
    syncFields();
    swap(d.sections[si].items, ii, dir);
    rerender();
  });
  view.querySelectorAll('[data-add-item]').forEach(b => b.onclick = () => {
    syncFields();
    openItemEditor(d, +b.dataset.addItem, -1, rerender);
  });
  view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const [si, ii] = b.dataset.edit.split(':').map(Number);
    syncFields();
    openItemEditor(d, si, ii, rerender);
  });
  document.getElementById('exportHome').onclick = async () => { syncFields(); await exportHomeJSON(d); };
  document.getElementById('resetHome').onclick = () => {
    actionSheet('Discard this device\'s custom Home and show the published one?', [
      { label: 'Reset Home', danger: true, run: async () => {
        await TicketDB.removeSetting(HOME_OVERRIDE_KEY);
        homeState.draft = null;
        toast('Home reset');
        location.hash = '#/';
      } },
    ]);
  };
}

function openItemEditor(d, si, ii, done) {
  const sec = d.sections[si];
  sec.items = sec.items || [];
  const isNew = ii < 0;
  const it = isNew ? { id: uid() } : { ...sec.items[ii] };
  let image = it.image || null;
  const cats = (d.categories || []).filter(c => c !== 'All');

  const field = (name, label, type = 'text', extra = '') => `
    <div class="fcell"><label for="it-${name}">${label}</label>
    <input id="it-${name}" type="${type}" value="${esc(it[name] ?? '')}" ${extra}></div>`;

  const sheet = openSheet(`
    ${sheetHead(isNew ? 'Add Event' : 'Edit Event', { left: '<button class="nav-btn" data-close>Cancel</button>', right: '<button class="nav-btn bold" id="itSave">Done</button>' })}
    <label class="image-pick" id="itPick" style="margin-top:4px">
      ${image ? coverHTML(image) : `<span class="ip-empty">${icon('image')}Add Photo</span>`}
      <input type="file" accept="image/*" id="itFile">
    </label>
    <div class="group-foot"><button type="button" id="itRmImg" style="color:var(--danger)">Remove photo</button></div>
    <div class="group-title">Event</div>
    <div class="group">
      ${field('title', 'Title')}
      <div class="fcell"><label for="it-category">Category</label>
        <select id="it-category"><option value="">None</option>${cats.map(c => `<option ${c === it.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </div>
      ${field('startAt', 'Date & time', 'datetime-local')}
      <div class="frow">${field('venue', 'Venue')}${field('city', 'City')}</div>
      ${field('address', 'Venue address (for the map)')}
    </div>
    <div class="group-title">Display</div>
    <div class="group">
      <div class="frow">${field('priceFrom', 'Price from ($)', 'number', 'min="0" step="0.01"')}${field('badge', 'Badge', 'text', 'placeholder="On Sale Now"')}</div>
      ${field('url', 'Find Tickets link (optional)', 'url', 'placeholder="https://"')}
      <div class="fcell"><label for="it-about">About</label><textarea id="it-about">${esc(it.about || '')}</textarea></div>
      ${field('color', 'Colour when there is no photo', 'color')}
    </div>
    ${isNew ? '' : '<div class="group-title"></div><div class="group"><button class="cell noicon danger center" id="itDel" type="button">Remove From Home</button></div>'}`);

  const pick = sheet.querySelector('#itPick');
  const setPreview = () => {
    pick.querySelector('img, .ph, .ip-empty')?.remove();
    pick.insertAdjacentHTML('afterbegin', image ? coverHTML(image) : `<span class="ip-empty">${icon('image')}Add Photo</span>`);
  };
  sheet.querySelector('#itFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    image = await compressImage(f, 1600);
    setPreview();
  });
  sheet.querySelector('#itRmImg').onclick = () => { image = null; setPreview(); };
  sheet.querySelector('#itDel')?.addEventListener('click', () => {
    sec.items.splice(ii, 1);
    sheet.close();
    done();
  });
  sheet.querySelector('#itSave').onclick = () => {
    const v = n => sheet.querySelector(`#it-${n}`).value.trim();
    if (!v('title')) return toast('Please enter a title');
    const prevPlace = [it.venue, it.city, it.address].join('|');
    Object.assign(it, {
      title: v('title'), category: v('category'), startAt: v('startAt'), venue: v('venue'), city: v('city'),
      address: v('address'), priceFrom: v('priceFrom') ? Number(v('priceFrom')) : '', badge: v('badge'),
      url: v('url'), about: v('about'), color: v('color'), image,
    });
    if ([it.venue, it.city, it.address].join('|') !== prevPlace) { delete it.lat; delete it.lng; }
    if (isNew) sec.items.push(it); else sec.items[ii] = it;
    sheet.close();
    done();
  };
}

async function exportHomeJSON(d) {
  const out = cloneHome(d);
  for (const sec of out.sections || []) {
    for (const it of sec.items || []) {
      if (it.image instanceof Blob) it.image = await blobToDataURL(it.image);
    }
  }
  downloadBlob(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), 'home.json');
  toast('home.json downloaded');
}
