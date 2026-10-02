// Venue maps using free services, no API key needed:
//  - Leaflet (map library) from cdnjs
//  - Esri's free World Street Map tiles (no key, labels in English
//    everywhere); if they fail to load, OpenStreetMap's own tiles are used
//  - OpenStreetMap Nominatim for turning a venue name/address into coordinates

const VenueMap = (() => {
  const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  // Keyless tile providers, tried in order.
  // Esri first: its labels are in English worldwide, while OpenStreetMap's
  // tiles use each country's local language (e.g. Arabic script).
  const PROVIDERS = [
    {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
      maxZoom: 19,
    },
    {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
  ];
  let providerIndex = 0;

  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }
  const GEOCODER = 'https://nominatim.openstreetmap.org/search';

  let leafletPromise = null;
  let lastGeocode = 0;

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = LEAFLET_JS;
      js.onload = () => resolve(window.L);
      js.onerror = () => { leafletPromise = null; reject(new Error('Map could not load')); };
      document.head.appendChild(js);
    });
    return leafletPromise;
  }

  function queryFor(ev) {
    return [ev.address || ev.venue, ev.city].filter(Boolean).join(', ').trim();
  }

  // Nominatim allows ~1 request/second; results are cached on-device.
  async function geocode(query) {
    if (!query) return null;
    const key = `geo:${query.toLowerCase()}`;
    const cached = await TicketDB.getSetting(key).catch(() => undefined);
    if (cached !== undefined) return cached;
    const wait = 1100 - (Date.now() - lastGeocode);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastGeocode = Date.now();
    const url = `${GEOCODER}?format=jsonv2&limit=1&addressdetails=0&accept-language=en&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error(`Location lookup failed (${res.status})`);
    const [hit] = await res.json();
    const result = hit ? { lat: +hit.lat, lng: +hit.lon, label: hit.display_name } : null;
    await TicketDB.setSetting(key, result).catch(() => {});
    return result;
  }

  // Ensure an event record has coordinates; returns {lat,lng,label} or null.
  async function locate(ev) {
    if (typeof ev.lat === 'number' && typeof ev.lng === 'number') {
      return { lat: ev.lat, lng: ev.lng, label: ev.geoLabel || '' };
    }
    const q = queryFor(ev);
    let hit = await geocode(q);
    // Fall back to just the venue name if "venue, city" found nothing.
    if (!hit && ev.venue && q !== ev.venue) hit = await geocode(ev.venue);
    return hit;
  }

  async function render(el, lat, lng, { interactive = false, zoom = 15 } = {}) {
    const L = await loadLeaflet();
    if (el._map) el._map.remove();
    const map = L.map(el, {
      center: [lat, lng],
      zoom,
      zoomControl: interactive,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: false,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: false,
      keyboard: false,
      tap: false,
    });
    // Dark mode: invert the light map (except on the ticket page, which uses a light map like Ticketmaster).
    el.classList.toggle('map-dark', isDark() && !document.body.classList.contains('tm-page'));
    const addTiles = () => {
      const p = PROVIDERS[providerIndex];
      const layer = L.tileLayer(p.url, { attribution: p.attribution, maxZoom: p.maxZoom });
      let errors = 0, loaded = 0;
      layer.on('tileload', () => { loaded++; });
      layer.on('tileerror', () => {
        errors++;
        // A provider that keeps failing (blocked, rate-limited, key required…): switch to the next one.
        if (errors >= 3 && loaded === 0 && providerIndex < PROVIDERS.length - 1) {
          providerIndex++;
          map.removeLayer(layer);
          addTiles();
        }
      });
      layer.addTo(map);
    };
    addTiles();
    const pin = L.divIcon({
      className: 'tm-pin',
      html: '<span></span>',
      iconSize: [30, 40],
      iconAnchor: [15, 38],
    });
    L.marker([lat, lng], { icon: pin, keyboard: false }).addTo(map);
    el._map = map;
    setTimeout(() => map.invalidateSize(), 50);
    return map;
  }

  function directionsURL(ev, pos) {
    const isApple = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
    const name = [ev.venue, ev.address, ev.city].filter(Boolean).join(', ');
    if (isApple) {
      return pos
        ? `https://maps.apple.com/?daddr=${pos.lat},${pos.lng}&q=${encodeURIComponent(ev.venue || name)}`
        : `https://maps.apple.com/?q=${encodeURIComponent(name)}`;
    }
    return pos
      ? `https://www.google.com/maps/dir/?api=1&destination=${pos.lat},${pos.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  }

  return { loadLeaflet, geocode, locate, render, directionsURL, queryFor };
})();
