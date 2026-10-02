// Discover (home) page, For You, Sell, event info pages and the home page editor.
//
// Home content comes from content/home.json (edit that file and redeploy to
// update the home page for everyone), unless this device has a customised
// copy saved from the in-app editor (My Account → Customize Home Page).

const HOME_URL = 'content/home.json';
const HOME_OVERRIDE_KEY = 'homeOverride';

const homeState = {
  category: 'All',
  query: '',
  draft: null,
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
  return (data.sections || []).flatMap(s => s.items || []);
}

function itemImage(item, cls = '') {
  const src = item.image instanceof Blob ? objectURL(item.image) : item.image;
  if (src) return `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" decoding="async">`;
  const c = /^#[0-9a-f]{3,8}$/i.test(item.color || '') ? item.color : '#024DDF';
  return `<div class="ph ${cls}" style="background:linear-gradient(135deg, ${c} 0%, #1F262D 120%)">${ICONS.ticket}</div>`;
}

function itemDate(item) {
  return item.startAt ? fmtCard(item) : (item.dateText || '');
}

function priceFrom(item) {
  return item.priceFrom ? `From ${money(item.priceFrom)}` : '';
}

/* ---------------- Discover ---------------- */

async function renderDiscover() {
  setChrome({ tab: 'discover' });
  const { data } = await loadHome();
  const cats = data.categories && data.categories.length ? data.categories : ['All'];

  view.innerHTML = `
    <header class="discover-head">
      <div class="row">
        <span class="wordmark">ticketmaster</span>
        ${data.location ? `<span class="loc-chip">${ICONS.pin}${esc(data.location)}</span>` : ''}
      </div>
      <label class="search">
        ${ICONS.search}
        <input id="q" type="search" placeholder="Search for artists, venues and events" value="${esc(homeState.query)}" autocomplete="off" enterkeyhint="search">
      </label>
      <div class="chips" id="chips">
        ${cats.map(c => `<button class="chip ${c === homeState.category ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
    </header>
    <div id="discoverBody"></div>`;

  const body = document.getElementById('discoverBody');
  const draw = async () => {
    releaseURLs();
    body.innerHTML = homeState.query
      ? await searchResultsHTML(data, homeState.query)
      : sectionsHTML(data, homeState.category);
  };

  view.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
    homeState.category = ch.dataset.c;
    view.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === ch));
    draw();
  }));
  const q = document.getElementById('q');
  q.addEventListener('input', () => {
    homeState.query = q.value.trim();
    clearTimeout(q._t);
    q._t = setTimeout(draw, 150);
  });
  await draw();
}

function matchesCategory(item, cat) {
  return !cat || cat === 'All' || item.category === cat;
}

function sectionsHTML(data, cat) {
  const html = (data.sections || []).map(sec => {
    const items = (sec.items || []).filter(i => matchesCategory(i, cat));
    if (!items.length) return '';
    if (sec.style === 'hero') {
      return `
        <section class="rail-section">
          <div class="hero-rail">${items.map(heroHTML).join('')}</div>
        </section>`;
    }
    if (sec.style === 'list') {
      return `
        <section class="rail-section">
          <h2 class="rail-title">${esc(sec.title)}</h2>
          <div class="row-list">${items.map(rowHTML).join('')}</div>
        </section>`;
    }
    return `
      <section class="rail-section">
        <h2 class="rail-title">${esc(sec.title)}</h2>
        <div class="card-rail">${items.map(railCardHTML).join('')}</div>
      </section>`;
  }).join('');
  return html || `<div class="empty"><div class="art">${ICONS.search}</div><h2>Nothing here yet</h2><p>No ${cat === 'All' ? '' : esc(cat) + ' '}events right now. Check back soon.</p></div>`;
}

function exploreHref(item) {
  return `#/explore/${encodeURIComponent(item.id)}`;
}

function heroHTML(item) {
  return `
    <a class="hero-card" href="${exploreHref(item)}">
      ${itemImage(item)}
      ${item.badge ? `<span class="badge">${esc(item.badge)}</span>` : ''}
      <div class="meta">
        ${itemDate(item) ? `<div class="date">${esc(itemDate(item))}</div>` : ''}
        <div class="title">${esc(item.title)}</div>
        ${venueLine(item) ? `<div class="venue">${esc(venueLine(item))}</div>` : ''}
      </div>
    </a>`;
}

function railCardHTML(item) {
  return `
    <a class="rail-card" href="${exploreHref(item)}">
      <div class="thumb">${itemImage(item)}</div>
      <div class="rc-title">${esc(item.title)}</div>
      ${itemDate(item) ? `<div class="rc-date">${esc(itemDate(item))}</div>` : ''}
      ${venueLine(item) ? `<div class="rc-sub">${esc(venueLine(item))}</div>` : ''}
      ${priceFrom(item) ? `<div class="rc-price">${esc(priceFrom(item))}</div>` : ''}
    </a>`;
}

function rowHTML(item) {
  return `
    <a class="row-item" href="${exploreHref(item)}">
      <div class="thumb">${itemImage(item)}</div>
      <div class="ri-text">
        ${itemDate(item) ? `<div class="ri-date">${esc(itemDate(item))}</div>` : ''}
        <div class="ri-title">${esc(item.title)}</div>
        ${venueLine(item) ? `<div class="ri-sub">${esc(venueLine(item))}</div>` : ''}
      </div>
      <svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
    </a>`;
}

async function searchResultsHTML(data, query) {
  const q = query.toLowerCase();
  const hit = x => [x.title, x.venue, x.city, x.category].some(v => String(v || '').toLowerCase().includes(q));
  const items = allHomeItems(data).filter(hit);
  const mine = (await TicketDB.all()).filter(hit);
  if (!items.length && !mine.length) {
    return `<div class="empty"><div class="art">${ICONS.search}</div><h2>No results</h2><p>Nothing matches “${esc(query)}”.</p></div>`;
  }
  return `
    ${mine.length ? `<section class="rail-section"><h2 class="rail-title">In My Tickets</h2><div class="row-list">${mine.map(ev => rowHTML(ev).replace(exploreHref(ev), `#/event/${encodeURIComponent(ev.id)}`)).join('')}</div></section>` : ''}
    ${items.length ? `<section class="rail-section"><h2 class="rail-title">Events</h2><div class="row-list">${items.map(rowHTML).join('')}</div></section>` : ''}`;
}

/* ---------------- Event info page ---------------- */

async function getFavorites() {
  return (await TicketDB.getSetting('favorites').catch(() => null)) || [];
}

async function renderExplore(id) {
  setChrome({ tab: 'discover', tabbarVisible: false });
  const { data } = await loadHome();
  const item = allHomeItems(data).find(i => String(i.id) === id);
  if (!item) {
    view.innerHTML = `<div class="empty"><h2>Event not found</h2><p>It may have been removed from the home page.</p><a class="btn" href="#/">Back to Discover</a></div>`;
    return;
  }
  const favs = await getFavorites();
  const fav = favs.includes(item.id);

  view.innerHTML = `
    <div class="explore">
      <div class="ex-hero">
        ${itemImage(item)}
        <a class="float-btn left" href="#/" aria-label="Back">${ICONS.back}</a>
        <button class="float-btn right ${fav ? 'fav' : ''}" id="favBtn" aria-label="Favorite">${ICONS.heart}</button>
      </div>
      <div class="ex-body">
        ${item.category ? `<div class="ex-cat">${esc(item.category)}</div>` : ''}
        <h1>${esc(item.title)}</h1>
        ${item.startAt || item.dateText ? `<div class="ex-line">${ICONS.calendar}<span>${esc(fmtLong(item))}</span></div>` : ''}
        ${venueLine(item) ? `<div class="ex-line">${ICONS.pin}<span>${esc(venueLine(item))}</span></div>` : ''}
        ${priceFrom(item) ? `<div class="ex-line">${ICONS.ticket}<span>Tickets ${esc(priceFrom(item).toLowerCase())}</span></div>` : ''}
        <div class="ex-actions">
          ${item.url ? `<a class="btn block" href="${esc(item.url)}" target="_blank" rel="noopener">Find Tickets</a>` : ''}
          <button class="btn block ${item.url ? 'outline' : ''}" id="addMine">Add to My Tickets</button>
        </div>
        ${item.about ? `<h2 class="ex-h">About</h2><p class="ex-about">${esc(item.about)}</p>` : ''}
        ${item.venue || item.city ? `<h2 class="ex-h">Venue</h2>${venueMapBlockHTML(item)}` : ''}
      </div>
    </div>`;

  document.getElementById('favBtn').addEventListener('click', async e => {
    const btn = e.currentTarget;
    const list = await getFavorites();
    const on = !list.includes(item.id);
    const next = on ? [...list, item.id] : list.filter(x => x !== item.id);
    await TicketDB.setSetting('favorites', next);
    btn.classList.toggle('fav', on);
    toast(on ? 'Added to favorites' : 'Removed from favorites');
  });
  document.getElementById('addMine').addEventListener('click', () => {
    state.prefill = {
      title: item.title, startAt: item.startAt || '', venue: item.venue || '', city: item.city || '',
      address: item.address || '', image: item.image || null, lat: item.lat, lng: item.lng,
    };
    location.hash = '#/new';
  });
  mountVenueMap(item, null);
}

/* ---------------- For You ---------------- */

async function renderForYou() {
  setChrome({ tab: 'foryou' });
  const [{ data }, events, favs] = await Promise.all([loadHome(), TicketDB.all(), getFavorites()]);
  const items = allHomeItems(data);
  const favItems = items.filter(i => favs.includes(i.id));
  const upcoming = events.filter(e => !isPast(e)).sort((a, b) => (a.startAt || '9999').localeCompare(b.startAt || '9999'));
  const likedCats = new Set([...favItems.map(i => i.category)].filter(Boolean));
  const recommended = items.filter(i => !favs.includes(i.id) && (!likedCats.size || likedCats.has(i.category)));

  view.innerHTML = `
    <header class="page-head" style="padding-bottom:18px"><div class="row"><h1>For You</h1></div></header>
    ${upcoming.length ? `
      <section class="rail-section">
        <h2 class="rail-title">Your Upcoming Events</h2>
        <div class="card-rail">${upcoming.slice(0, 12).map(ev => railCardHTML(ev).replace(exploreHref(ev), `#/event/${encodeURIComponent(ev.id)}`)).join('')}</div>
      </section>` : ''}
    ${favItems.length ? `
      <section class="rail-section">
        <h2 class="rail-title">Your Favorites</h2>
        <div class="card-rail">${favItems.map(railCardHTML).join('')}</div>
      </section>` : ''}
    ${recommended.length ? `
      <section class="rail-section">
        <h2 class="rail-title">Recommended For You</h2>
        <div class="row-list">${recommended.map(rowHTML).join('')}</div>
      </section>` : ''}
    ${!upcoming.length && !favItems.length && !recommended.length ? `<div class="empty"><div class="art">${ICONS.heart}</div><h2>Nothing yet</h2><p>Tap the heart on events you like and they'll show up here.</p><a class="btn" href="#/">Discover Events</a></div>` : ''}`;
}

/* ---------------- Sell ---------------- */

async function renderSell() {
  setChrome({ tab: 'sell' });
  const events = (await TicketDB.all()).filter(e => !isPast(e))
    .sort((a, b) => (a.startAt || '9999').localeCompare(b.startAt || '9999'));
  view.innerHTML = `
    <header class="page-head" style="padding-bottom:18px"><div class="row"><h1>Sell</h1></div></header>
    ${events.length ? `
      <p class="lead">Select the event you'd like to sell tickets for.</p>
      <div class="row-list">${events.map(ev => `
        <a class="row-item" href="#/event/${encodeURIComponent(ev.id)}">
          <div class="thumb">${itemImage(ev)}</div>
          <div class="ri-text">
            <div class="ri-date">${esc(fmtCard(ev))}</div>
            <div class="ri-title">${esc(ev.title || 'Untitled Event')}</div>
            <div class="ri-sub">${ticketCount(ev)} ticket${ticketCount(ev) === 1 ? '' : 's'} · ${esc(venueLine(ev))}</div>
          </div>
          <svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
        </a>`).join('')}
      </div>` : `
      <div class="empty"><div class="art">${ICONS.tag}</div><h2>No tickets to sell</h2><p>Tickets for upcoming events will appear here.</p><a class="btn" href="#/tickets">Go to My Tickets</a></div>`}`;
}

/* ---------------- Home page editor ---------------- */

function cloneHome(data) {
  // structuredClone keeps Blobs intact; fall back for older browsers.
  if (window.structuredClone) return structuredClone(data);
  return { ...data, sections: (data.sections || []).map(s => ({ ...s, items: (s.items || []).map(i => ({ ...i })) })) };
}

async function renderHomeEditor() {
  setChrome({ tabbarVisible: false });
  if (!homeState.draft) {
    const { data, source } = await loadHome();
    homeState.draft = cloneHome(data);
    homeState.draftSource = source;
  }
  const d = homeState.draft;
  d.sections = d.sections || [];

  view.innerHTML = `
    <header class="topbar light">
      <button class="text-btn" id="edCancel">Cancel</button>
      <h1>Edit Home Page</h1>
      <button class="text-btn" id="edSave" style="color:var(--blue)">Save</button>
    </header>
    <div class="form">
      <p class="hint-box">${homeState.draftSource === 'device'
        ? 'You are editing the home page saved on <b>this device</b>.'
        : 'Changes you save here apply to <b>this device</b>. To update the home page for everyone, use <b>Export home.json</b> and replace <code>v2/content/home.json</code> in your site.'}</p>
      <div class="field"><label for="ed-loc">Location label</label><input id="ed-loc" value="${esc(d.location || '')}" placeholder="Los Angeles, CA"></div>
      <div class="field"><label for="ed-cats">Category chips (comma separated)</label><input id="ed-cats" value="${esc((d.categories || []).join(', '))}" placeholder="All, Concerts, Sports"></div>
      <div id="edSections">
        ${d.sections.map((s, si) => `
          <div class="ed-section">
            <div class="ed-sec-head">
              <input class="ed-sec-title" data-si="${si}" value="${esc(s.title || '')}" placeholder="Section title">
              <select class="ed-sec-style" data-si="${si}">
                <option value="hero" ${s.style === 'hero' ? 'selected' : ''}>Big banners</option>
                <option value="cards" ${s.style === 'cards' || !s.style ? 'selected' : ''}>Card row</option>
                <option value="list" ${s.style === 'list' ? 'selected' : ''}>List</option>
              </select>
            </div>
            <div class="ed-items">
              ${(s.items || []).map((it, ii) => `
                <div class="ed-item">
                  <div class="thumb">${itemImage(it)}</div>
                  <button class="ed-item-title" data-edit="${si}:${ii}">${esc(it.title || 'Untitled')}<small>${esc([it.category, itemDate(it)].filter(Boolean).join(' · '))}</small></button>
                  <button class="mini" data-move="${si}:${ii}:-1" aria-label="Move up">↑</button>
                  <button class="mini" data-move="${si}:${ii}:1" aria-label="Move down">↓</button>
                </div>`).join('')}
            </div>
            <div class="ed-sec-actions">
              <button data-add-item="${si}">+ Add event</button>
              <button data-sec-move="${si}:-1">Move up</button>
              <button data-sec-move="${si}:1">Move down</button>
              <button class="rm" data-sec-del="${si}">Delete section</button>
            </div>
          </div>`).join('')}
      </div>
      <button class="btn outline block" id="addSection" style="margin-top:6px">+ Add section</button>
      <h2>Publish &amp; reset</h2>
      <button class="btn ghost block" id="exportHome">${ICONS.download.replace('<svg', '<svg fill="none" stroke="currentColor" stroke-width="1.8"')}Export home.json</button>
      <button class="btn danger block" id="resetHome" style="margin-top:10px">Reset to published home page</button>
    </div>`;

  const syncFields = () => {
    d.location = document.getElementById('ed-loc').value.trim();
    const cats = document.getElementById('ed-cats').value.split(',').map(s => s.trim()).filter(Boolean);
    d.categories = cats.length ? (cats.includes('All') ? cats : ['All', ...cats]) : ['All'];
    view.querySelectorAll('.ed-sec-title').forEach(i => { d.sections[+i.dataset.si].title = i.value.trim(); });
    view.querySelectorAll('.ed-sec-style').forEach(i => { d.sections[+i.dataset.si].style = i.value; });
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
    toast('Home page saved');
    location.hash = '#/';
  };
  document.getElementById('addSection').onclick = () => {
    syncFields();
    d.sections.push({ id: uid(), title: 'New Section', style: 'cards', items: [] });
    rerender();
  };
  view.querySelectorAll('[data-sec-del]').forEach(b => b.onclick = () => {
    const si = +b.dataset.secDel;
    if (!confirm(`Delete section "${d.sections[si].title || 'Untitled'}" and its events?`)) return;
    syncFields();
    d.sections.splice(si, 1);
    rerender();
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
  document.getElementById('exportHome').onclick = async () => {
    syncFields();
    await exportHomeJSON(d);
  };
  document.getElementById('resetHome').onclick = async () => {
    if (!confirm('Discard this device\'s custom home page and show the published one?')) return;
    await TicketDB.removeSetting(HOME_OVERRIDE_KEY);
    homeState.draft = null;
    toast('Home page reset');
    location.hash = '#/';
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
    <div class="field"><label for="it-${name}">${label}</label>
    <input id="it-${name}" type="${type}" value="${esc(it[name] ?? '')}" ${extra}></div>`;

  const sheet = openSheet(`
    <div class="sheet-head">
      <button class="text-btn" data-close>Cancel</button>
      <h3>${isNew ? 'Add Event' : 'Edit Event'}</h3>
      <button class="text-btn" id="itSave" style="color:var(--blue)">Done</button>
    </div>
    <div class="form">
      <div class="field">
        <label>Image</label>
        <label class="image-pick" id="itPick">
          ${image ? itemImage({ image }) : `<span class="ip-empty">${ICONS.image}Tap to upload an image</span>`}
          <input type="file" accept="image/*" id="itFile">
        </label>
        <div class="image-actions"><button type="button" class="rm" id="itRmImg">Remove image</button></div>
      </div>
      ${field('title', 'Title')}
      <div class="field"><label for="it-category">Category</label>
        <select id="it-category"><option value="">None</option>${cats.map(c => `<option ${c === it.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </div>
      ${field('startAt', 'Date & time', 'datetime-local')}
      <div class="grid-2">${field('venue', 'Venue')}${field('city', 'City')}</div>
      ${field('address', 'Venue address (for the map)')}
      <div class="grid-2">${field('priceFrom', 'Price from ($)', 'number', 'min="0" step="0.01"')}${field('badge', 'Badge', 'text', 'placeholder="On Sale Now"')}</div>
      ${field('url', 'Find Tickets link (optional)', 'url', 'placeholder="https://"')}
      <div class="field"><label for="it-about">About</label><textarea id="it-about">${esc(it.about || '')}</textarea></div>
      ${field('color', 'Card colour when there is no image', 'color')}
      ${isNew ? '' : '<button class="btn danger block" id="itDel" type="button">Remove from home page</button>'}
    </div>`);

  const pick = sheet.querySelector('#itPick');
  sheet.querySelector('#itFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    image = await compressImage(f, 1600);
    pick.querySelector('img, .ph, .ip-empty')?.remove();
    pick.insertAdjacentHTML('afterbegin', itemImage({ image }));
  });
  sheet.querySelector('#itRmImg').onclick = () => {
    image = null;
    pick.querySelector('img, .ph, .ip-empty')?.remove();
    pick.insertAdjacentHTML('afterbegin', `<span class="ip-empty">${ICONS.image}Tap to upload an image</span>`);
  };
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
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'home.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('home.json downloaded');
}
