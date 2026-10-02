# Ticketmaster PWA (v2)

A login-free ticket wallet styled after the Ticketmaster iOS app. Install it to
the home screen as a Progressive Web App. Tickets are stored on the device in
IndexedDB, so you can save as many as the phone has room for.

Open it at `https://<your-site>/v2/`.

## Installing on a phone

- **iPhone:** open the site in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open the site in Chrome and tap **Install** in the banner, or
  use the menu → **Install app**.

The app also shows an install banner and step-by-step help (My Account → Install App).

## Updating the home page (Discover)

The Discover page is built from [`content/home.json`](content/home.json).

### Option 1: update it for everyone

1. Edit `v2/content/home.json`. Each section has a `title`, a `style` (`hero`
   for big banners, `cards` for a sideways row, `list` for rows) and `items`.
2. Put any new images in `v2/content/img/` and point `"image"` at them
   (e.g. `"content/img/my-show.jpg"`), or use a full `https://` image URL.
3. Commit and push. Once the site redeploys, every installed app shows the new
   home page the next time it opens, with no reinstall needed.

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
| `priceFrom` | `49`                             | Shows "From $49.00" |
| `badge`     | `"On Sale Now"`                  | Label on big banners |
| `url`       | `"https://…"`                    | Optional "Find Tickets" link |
| `about`     | `"Text…"`                        | About section on the event page |

### Option 2: edit it in the app (no code)

My Account → **Customize Home Page** lets you add, edit, reorder and delete
sections and events, including uploading pictures from the phone.

- **Save** applies the changes on that device only.
- **Export home.json** downloads the file. Replace `v2/content/home.json` with
  it and push to publish the same home page for everyone.
- **Reset to published home page** discards the device's custom version.

## Maps

Venue maps use free services with no API key:

- [Leaflet](https://leafletjs.com/) for the map
- [CARTO](https://carto.com/basemaps/) basemap tiles built on OpenStreetMap data
- [OpenStreetMap Nominatim](https://nominatim.org/) to look up a venue's location
  from its name/address (results are saved on the device)

Venue locations are looked up once and saved, and map tiles you've viewed are
cached, so maps keep working offline.

## Releasing app updates

Files are fetched network-first, so changes show up on the next launch. When you
change `sw.js` or want installed apps to show the **"A new version is
available — Refresh"** banner, bump `VERSION` in `sw.js` (and `APP_VERSION` in
`app.js`).
