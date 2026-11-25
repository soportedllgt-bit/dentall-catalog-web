# AGENTS.md — dentall-catalog-web

## What this is

Static SPA: no backend, no build step, no tests, no linter, no typecheck. Renders PDF catalogs client-side with PDF.js 3.11.174. All libraries load from CDN (Bootstrap 5.3.3, Bootstrap Icons 1.11.3). There is no `package.json`; do not add npm packages or build steps.

## Run and verify

- Serve over HTTP, never `file://` (the PDF.js worker and `fetch('./assets/…')` fail under CORS). Options: `php -S localhost:8000`, `python -m http.server 8000`, `npx serve .`, or XAMPP.
- Manual check: `http://localhost:8000/index.html?pdf=ortodoncia.pdf&page=1`.

## Constraints

- **DOM IDs are contracts** that `js/app.js` binds to: `btn-prev`, `btn-next`, `page-info`, `btn-zoom-in`, `btn-zoom-out`, `btn-download`, `pdf-render`, `error-message`, `error-text`. The scroll container is `#viewer-container` (`.viewer-container`).
- **State is module-scoped** inside the IIFE in `js/app.js` (`pdfDoc`, `pageNum`, `pageIsRendering`, `pageNumPending`, `scale`). Do not move it to `window`.
- **Render queue**: `pageIsRendering` + `pageNumPending` coalesce rapid Prev/Next/zoom clicks into one pending render. Keep new render paths going through `queueRenderPage()`.
- **PDFs live in `./assets/`**. Routing is `index.html?pdf=<file>&page=N`.
- **Redirect**: no `?pdf=` and no `?ref=` redirects to `?pdf=ortodoncia.pdf&page=1`.
- **UUID routing (`?ref=`)**: validates UUID v4 with the anchored `UUID_REGEX`, then `buildUuidMap()` scans every page's text with the unanchored `UUID_SEARCH_REGEX`. Do not use the anchored regex for page scanning; it will never match text that contains surrounding content. Without `?pdf=`, `?ref=` loads `ortodoncia.pdf`. Unknown UUID shows "Este catálogo ha sido actualizado…"; invalid shows "El enlace no es válido…". The PDF must embed UUIDs in its footer text.
- **Download** uses the `?pdf=` value or `ortodoncia.pdf`, so a `?ref=` view downloads the default catalog.
- **Tracking**: `trackScan()` POSTs `{ page_number }` to `${API_BASE}/tracking/scan` with Basic Auth, fire-and-forget, once after the initial render. Errors are swallowed on purpose; the viewer must not depend on the API. `API_BASE` and `API_AUTH` are hardcoded in `js/app.js`. README documents `http://localhost/dentall-catalog-api/…`, but the code uses `https://localhost.com/…`. Treat the code as current, but confirm the host before changing it.
- Zoom scale starts at 1.5, steps by 0.25, and is clamped to [0.5, 5].

## Layout

```
body (flex column, 100vh)
├── header.viewer-header   (sticky top, #004e64)
├── #viewer-container      (flex: 1, overflow: auto) — flex child, not position: absolute
└── footer.viewer-footer   (flex-shrink: 0) — always visible below the scroll area
```

## File roles

- `index.html`: header, viewer, footer, CDN tags, DOM IDs.
- `css/styles.css`: palette variables, flex layout, responsive rules.
- `js/app.js`: PDF loading, render queue, zoom, download, tracking, UUID resolution.
- `assets/`: PDFs, logos, favicons, served statically.
- `README.md`: Spanish user docs. It references `SDD.md`, which is not in the repo.

Palette: `--primary-dark` #004e64, `--primary-teal` #00a7b5, `--footer-light` #EBF8F9.

## Manual verification checklist

- Header is sticky; footer shows 3 country columns and copyright.
- Prev/Next, zoom, and download work; rapid clicks do not freeze rendering.
- Missing params redirect to the default catalog.
- Network tab shows the tracking POST on load.
- `?ref=<valid uuid>` opens the right page; invalid shows the link error; unknown shows "solicite nuevo código QR" messaging.
