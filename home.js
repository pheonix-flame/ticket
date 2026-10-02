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
  published: null,
};

const CATEGORY_STYLE = {
  'Concerts': ['#E11D48', 'music'],
  'Sports': ['#16A34A', 'ball'],
  'Arts & Theater': ['#9333EA', 'mask'],
  'Comedy': ['#F59E0B', 'mic'],
  'Family': ['#0891B2', 'family'],
};

// Home = the default content (content/home.json) + this device's changes.
// Default events can be hidden but never deleted; the user's own events and
// sections are stored separately in 'homeCustom':
//   { hidden: [defaultItemId], added: { [defaultSectionId]: [items] }, sections: [own sections] }
const HOME_CUSTOM_KEY = 'homeCustom';

async function loadPublishedHome() {
  try {
    const res = await fetch(HOME_URL, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (_) {
    return { location: '', categories: ['All'], sections: [] };
  }
}

function emptyCustom() {
  return { hidden: [], added: {}, sections: [] };
}

async function getHomeCustom(published) {
  let custom = await TicketDB.getSetting(HOME_CUSTOM_KEY).catch(() => undefined);
  if (custom) return { ...emptyCustom(), ...custom };
  custom = emptyCustom();
  // Convert a home page saved by the previous editor (a full copy) into changes.
  const old = await TicketDB.getSetting(HOME_OVERRIDE_KEY).catch(() => undefined);
  if (old && published) {
    const pubSecs = new Map((published.sections || []).map(s => [s.id, s]));
    const pubIds = new Set(allHomeItems(published).map(i => i.id));
    const keptIds = new Set();
    for (const sec of old.sections || []) {
      const mine = (sec.items || []).filter(i => !pubIds.has(i.id));
      (sec.items || []).forEach(i => keptIds.add(i.id));
      if (!mine.length) continue;
      if (pubSecs.has(sec.id)) custom.added[sec.id] = mine;
      else custom.sections.push({ ...sec, items: mine });
    }
    custom.hidden = [...pubIds].filter(id => !keptIds.has(id));
    await TicketDB.setSetting(HOME_CUSTOM_KEY, custom);
    await TicketDB.removeSetting(HOME_OVERRIDE_KEY);
  }
  return custom;
}

function mergeHome(published, custom) {
  const hidden = new Set(custom.hidden || []);
  const added = custom.added || {};
  return {
    ...published,
    sections: [
      // the user's own sections first, so their events are easy to find
      ...(custom.sections || []).map(s => ({ ...s, own: true })),
      ...(published.sections || []).map(s => ({
        ...s,
        items: [...(s.items || []).filter(i => !hidden.has(i.id)), ...(added[s.id] || [])],
      })),
    ],
  };
}

async function loadHome() {
  const published = await loadPublishedHome();
  const custom = await getHomeCustom(published);
  return { data: mergeHome(published, custom), published, custom };
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

/* ---------------- Home page editor ----------------
   Default events (from content/home.json) can be hidden or shown again but
   not edited or deleted. Users add their own events to any section, or
   create their own sections. */

function cloneData(data) {
  // structuredClone keeps Blobs intact; fall back for older browsers.
  if (window.structuredClone) return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
}

function editorItemHTML(it, { key, hidden = false, mine = false, canMove = false }) {
  return `
    <div class="ed-item ${hidden ? 'is-hidden' : ''}">
      <div class="img">${coverHTML(it.image, it.color)}</div>
      ${mine
        ? `<button class="ed-item-title" data-edit="${key}">${esc(it.title || 'Untitled')}<small>${esc(['Added by you', it.startAt ? fmtShort(it) : ''].filter(Boolean).join(' · '))}</small></button>`
        : `<div class="ed-item-title">${esc(it.title || 'Untitled')}<small>${hidden ? 'Hidden' : 'Default'}${it.startAt ? ` · ${esc(fmtShort(it))}` : ''}</small></div>`}
      ${mine && canMove ? `<button class="mini" data-move="${key}:-1" aria-label="Move up">↑</button><button class="mini" data-move="${key}:1" aria-label="Move down">↓</button>` : ''}
      ${mine ? `<button class="mini" data-edit="${key}" aria-label="Edit">${icon('edit', 'sm')}</button>` : `<button class="eye ${hidden ? 'off' : ''}" data-toggle="${esc(it.id)}">${hidden ? 'Show' : 'Hide'}</button>`}
    </div>`;
}

async function renderHomeEditor() {
  setChrome({ tabbarVisible: false, grouped: true });
  if (!homeState.draft) {
    const { published, custom } = await loadHome();
    homeState.published = published;
    homeState.draft = cloneData(custom);
  }
  const pub = homeState.published;
  const d = homeState.draft;
  d.sections = d.sections || [];
  d.added = d.added || {};
  d.hidden = d.hidden || [];
  const hidden = new Set(d.hidden);
  const tabName = k => (HOME_TABS.find(([x]) => x === k) || HOME_TABS[0])[1];
  const styleName = s => ({ hero: 'Banners', list: 'List' }[s] || 'Cards');

  view.innerHTML = `
    <header class="navbar">
      <div class="left"><button class="nav-btn" id="edCancel">Cancel</button></div>
      <div class="title">Customize Home</div>
      <div class="right"><button class="nav-btn bold" id="edSave">Save</button></div>
    </header>
    <div class="form">
      <div class="hint-box">The default events come with the app. You can <b>hide</b> them, but not delete them. Events and sections you add are saved on this phone.</div>

      <div class="group-title">Your Sections</div>
      ${d.sections.length ? '' : '<div class="group-foot" style="margin-top:0">You haven\'t added any sections yet.</div>'}
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
          ${(s.items || []).map((it, ii) => editorItemHTML(it, { key: `own:${si}:${ii}`, mine: true, canMove: true })).join('')}
          <div class="ed-actions">
            <button data-add="own:${si}">+ Add Event</button>
            <button data-sec-move="${si}:-1">Move Up</button>
            <button data-sec-move="${si}:1">Move Down</button>
            <button class="rm" data-sec-del="${si}">Delete</button>
          </div>
        </div>`).join('')}
      <div class="group" style="margin-top:12px">
        <button class="cell noicon link" id="addSection"><span class="lbl">Add Section</span></button>
      </div>

      <div class="group-title">Default Sections</div>
      ${(pub.sections || []).map(s => `
        <div class="ed-sec">
          <div class="ed-sec-head ro">
            <b>${esc(s.title || (s.style === 'hero' ? 'Featured banners' : 'Section'))}</b>
            <span>${tabName(s.tab || 'foryou')} · ${styleName(s.style)}</span>
          </div>
          ${(s.items || []).map(it => editorItemHTML(it, { hidden: hidden.has(it.id) })).join('')}
          ${(d.added[s.id] || []).map((it, ii) => editorItemHTML(it, { key: `add:${s.id}:${ii}`, mine: true, canMove: true })).join('')}
          <div class="ed-actions"><button data-add="add:${esc(s.id)}">+ Add Event Here</button></div>
        </div>`).join('')}

      <div class="group-title"></div>
      <div class="group">
        <button class="cell noicon link" id="showAll"><span class="lbl">Show All Default Events</span></button>
        <button class="cell noicon link" id="exportHome"><span class="lbl">Export home.json</span></button>
      </div>
      <div class="group-foot">Export saves the Home page as you see it, so you can publish it for everyone by replacing <code>content/home.json</code>.</div>
      <div class="group-title"></div>
      <div class="group"><button class="cell noicon danger center" id="resetHome">Remove All My Changes</button></div>
    </div>`;

  // key → { list, index } for the user's own items
  const resolve = key => {
    const [kind, a, b] = key.split(':');
    if (kind === 'own') return { list: (d.sections[+a].items = d.sections[+a].items || []), index: b === undefined ? -1 : +b };
    const secId = a;
    d.added[secId] = d.added[secId] || [];
    return { list: d.added[secId], index: b === undefined ? -1 : +b, secId };
  };
  const syncFields = () => {
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
  const cats = (pub.categories || []).filter(c => c !== 'All');

  document.getElementById('edCancel').onclick = () => { homeState.draft = null; location.hash = '#/account'; };
  document.getElementById('edSave').onclick = async () => {
    syncFields();
    for (const k of Object.keys(d.added)) if (!d.added[k].length) delete d.added[k];
    await TicketDB.setSetting(HOME_CUSTOM_KEY, d);
    homeState.draft = null;
    toast('Home saved');
    location.hash = '#/';
  };
  document.getElementById('addSection').onclick = () => {
    syncFields();
    d.sections.push({ id: uid(), title: 'My Events', tab: 'foryou', style: 'cards', items: [] });
    rerender();
  };
  view.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
    syncFields();
    const id = b.dataset.toggle;
    d.hidden = d.hidden.includes(id) ? d.hidden.filter(x => x !== id) : [...d.hidden, id];
    rerender();
  });
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
    const parts = b.dataset.move.split(':');
    const dir = +parts.pop();
    syncFields();
    const { list, index } = resolve(parts.join(':'));
    swap(list, index, dir);
    rerender();
  });
  view.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    syncFields();
    const { list } = resolve(b.dataset.add);
    openItemEditor(list, -1, cats, rerender);
  });
  view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    syncFields();
    const { list, index } = resolve(b.dataset.edit);
    openItemEditor(list, index, cats, rerender);
  });
  document.getElementById('showAll').onclick = () => { syncFields(); d.hidden = []; rerender(); };
  document.getElementById('exportHome').onclick = async () => { syncFields(); await exportHomeJSON(mergeHome(pub, d)); };
  document.getElementById('resetHome').onclick = () => {
    actionSheet('Remove your events and sections, and show every default event again?', [
      { label: 'Remove All My Changes', danger: true, run: async () => {
        await TicketDB.removeSetting(HOME_CUSTOM_KEY);
        homeState.draft = null;
        toast('Home reset');
        location.hash = '#/';
      } },
    ]);
  };
}

function openItemEditor(list, index, cats, done) {
  const isNew = index < 0;
  const it = isNew ? { id: uid(), color: '#024DDF' } : { ...list[index] };
  if (!it.color) it.color = '#024DDF';
  let image = it.image || null;

  const field = (name, label, type = 'text', extra = '') => `
    <div class="fcell"><label for="it-${name}">${label}</label>
    <input id="it-${name}" type="${type}" value="${esc(it[name] ?? '')}" ${extra}></div>`;

  const sheet = openSheet(`
    ${sheetHead(isNew ? 'Add Event' : 'Edit Event', { left: '<button class="nav-btn" data-close>Cancel</button>', right: '<button class="nav-btn bold" id="itSave">Done</button>' })}
    <label class="image-pick" id="itPick" style="margin-top:4px">
      ${image ? coverHTML(image) : `<span class="ip-empty">${icon('image')}Add Photo</span>`}
      <input type="file" accept="image/*" id="itFile">
    </label>
    <div class="group-foot img-actions"><button type="button" id="itAdj">Adjust photo</button><button type="button" id="itRmImg" class="rm">Remove photo</button></div>
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
    ${isNew ? '' : '<div class="group-title"></div><div class="group"><button class="cell noicon danger center" id="itDel" type="button">Delete Event</button></div>'}`);

  const pick = sheet.querySelector('#itPick');
  const setPreview = () => {
    pick.querySelector('img, .ph, .ip-empty')?.remove();
    pick.insertAdjacentHTML('afterbegin', image ? coverHTML(image) : `<span class="ip-empty">${icon('image')}Add Photo</span>`);
  };
  sheet.querySelector('#itFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    e.target.value = '';
    const cropped = await openCropper(f);
    if (cropped) { image = cropped; setPreview(); }
  });
  sheet.querySelector('#itRmImg').onclick = () => { image = null; setPreview(); };
  sheet.querySelector('#itAdj').onclick = async () => {
    if (!image) return toast('Add a photo first');
    let src = image instanceof Blob ? image : null;
    if (!src) { try { src = await (await fetch(image)).blob(); } catch (_) {} }
    if (!src) return toast('Could not load that photo');
    const cropped = await openCropper(src);
    if (cropped) { image = cropped; setPreview(); }
  };
  sheet.querySelector('#itDel')?.addEventListener('click', () => {
    list.splice(index, 1);
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
    if (isNew) list.push(it); else list[index] = it;
    sheet.close();
    done();
  };
}

async function exportHomeJSON(data) {
  const out = cloneData(data);
  for (const sec of out.sections || []) {
    delete sec.own;
    for (const it of sec.items || []) {
      if (it.image instanceof Blob) it.image = await blobToDataURL(it.image);
    }
  }
  downloadBlob(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }), 'home.json');
  toast('home.json downloaded');
}
