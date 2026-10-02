# Ticketmaster PWA

A Progressive Web App styled after the Ticketmaster iOS app (2025–26 design),
with no login. Tickets are stored on the device in IndexedDB, so you can save
as many as the phone has room for.

- **Home**: For You / Trending / Last Minute tabs, category filters and a location switcher
- **Search**: recent searches, category browsing, and results that include your own tickets
- **Watchlist**: events saved with the bookmark button
- **My Tickets**: a large *Next Event* card with a live countdown in the last 10 days, then the rest of your events
- **Ticket screen** (matches the Ticketmaster app's order page): event photo with the date, title, venue and ticket count card, **View Tickets**, Tickets / Extras tabs, the order number and a block per ticket (SECTION / ROW / SEAT, or GENERAL ADMISSION), an optional "Listed for sale at" line, a More Options venue map, and the floating Upgrade / Transfer / Sell bar. The header shrinks to the title, venue and a barcode button as you scroll.
- **View Tickets**: full-screen, swipeable barcodes that refresh every 15 seconds, with a moving light (it follows the phone's tilt on iPhone after you tap the barcode)
- **Photos**: every event photo is shown at 3:2. After picking a photo you can drag and zoom it, or tap **Fit** to keep the whole photo (blurred edges fill the gaps). **Adjust photo** re-frames it later.
- **Account**: Light / Dark / System appearance, home page editor, backup and restore

## Files

| File | What it is |
|------|------------|
| `index.html` | App shell and tab bar |
| `app.css` | All styling (light and dark mode) |
| `app.js` | Routing, sheets, Account, backup, install and update prompts |
| `tickets.js` | My Tickets, the ticket screen, barcode and the add/edit form |
| `home.js` | Home, Search, Watchlist, event pages and the home page editor |
| `map.js` | Venue maps and address lookup |
| `db.js` | On-device storage |
| `sw.js` | Offline support and updates |
| `content/home.json` | What appears on Home |
| `vercel.json` | Redirects old page links (e.g. `home.html`) to the new app |

## Installing on a phone

- **iPhone:** open the site in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open the site in Chrome and tap **Install** in the banner, or use the menu → **Install app**.

Tickets saved by the previous version of the app are moved over automatically
the first time the new app opens on that phone.

## Updating the home page

### Option 1: update it for everyone

1. Edit `content/home.json`. Each section has:
   - `title`
   - `tab`: `foryou` (default), `trending` or `lastminute`
   - `style`: `hero` (big banners), `cards` (a sideways row) or `list` (rows)
   - `items`: the events
2. Put new images in `content/img/` and point `"image"` at them
   (e.g. `"content/img/my-show.jpg"`), or use a full `https://` image URL.
3. Commit and push. After the site redeploys, every installed app shows the new
   Home the next time it opens.

**Trending** lists all events in order unless you add a section with
`"tab": "trending"`. **Last Minute** automatically shows events in the next two
weeks, plus any section with `"tab": "lastminute"`.

Event item fields:

| Field       | Example                          | Notes |
|-------------|----------------------------------|-------|
| `id`        | `"my-show"`                      | Unique, no spaces |
| `title`     | `"My Show Live"`                 | Required |
| `category`  | `"Concerts"`                     | Must match one of `categories` to filter by chip |
| `startAt`   | `"2026-12-31T21:00"`             | Local date & time |
| `venue`     | `"The Forum"`                    | |
| `city`      | `"Inglewood, CA"`                | |
| `address`   | `"3900 W Manchester Blvd"`       | Optional, makes the map more precise |
| `image`     | `"content/img/my-show.jpg"`      | Optional; without it `color` is used |
| `color`     | `"#552583"`                      | Card colour when there's no image |
| `priceFrom` | `49`                             | Shows "Tickets from $49.00" |
| `badge`     | `"On Sale Now"`                  | Label on big banners |
| `url`       | `"https://…"`                    | Optional "Find Tickets" link |
| `about`     | `"Text…"`                        | About section on the event page |

### Option 2: edit it in the app (no code)

Account → **Customize Home** lets you add, edit, reorder and delete sections
and events, including uploading pictures from the phone.

- **Save** applies the changes on that phone only.
- **Export home.json** downloads the file. Replace `content/home.json` with it
  and push to publish the same Home for everyone.
- **Reset to Published Home** discards the phone's custom version.

## Maps

Venue maps use free services with no API key:

- [Leaflet](https://leafletjs.com/) for the map
- [CARTO](https://carto.com/basemaps/) basemap tiles built on OpenStreetMap
  data, with a dark map in dark mode
- [OpenStreetMap Nominatim](https://nominatim.org/) to look up a venue's location
  from its name/address (results are saved on the device)

## Releasing app updates

Files are fetched network-first, so changes show up on the next launch. To make
installed apps show the **"A new version is available — Refresh"** banner, bump
`VERSION` in `sw.js` (and `APP_VERSION` in `app.js`).
