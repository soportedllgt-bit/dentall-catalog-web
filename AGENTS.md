# AGENTS.md — dentall-catalog-web

## What this is

Static SPA (no backend, no build tools). Renders PDF catalogs client-side via PDF.js.
All libraries via CDN. No `package.json`, no bundler, no linter, no tests.

## Must-know constraints

- **Serve via HTTP**, not `file://`. PDF.js worker + `fetch('./assets/…')` fail under `file:` due to CORS. Use `php -S localhost:8000`, XAMPP, or similar.
- **DOM IDs are contracts** — defined in `SDD.md §5`. Must match exactly:
  `btn-prev`, `btn-next`, `page-info`, `btn-zoom-in`, `btn-zoom-out`, `btn-download`, `pdf-render`, `error-message`.
- **State variables are module-scoped** inside an IIFE in `js/app.js`. Not on `window`.
- **PDFs live in `./assets/`**. URL routing: `index.html?pdf=filename.pdf&page=N`.
- **Default PDF**: when no `?pdf=` param, redirects to `ortodoncia.pdf&page=1`.
- **Tracking API**: `POST http://localhost/dentall-catalog-api/api/v1/tracking/scan` with Basic Auth. Fire-and-forget on each page load. Does not block the visor.
- Do not add npm packages or build steps. Everything is CDN-loaded (Bootstrap 5.3.3, Bootstrap Icons 1.11.3, PDF.js 3.11.174).

## Layout architecture

```
body (flex column, 100vh)
├── header.viewer-header  (sticky top, bg #004e64)  — logo + controls
├── .viewer-container     (flex: 1, overflow: auto)  — canvas scroll
│   └── canvas#pdf-render
└── footer.viewer-footer  (flex-shrink: 0)
    ├── .footer-contact   (bg #EBF8F9) — 3 columns: GT, SV, HN
    └── .footer-bottom    (bg #004e64) — copyright
```

Key: `.viewer-container` is NOT `position: absolute` — it's a flex child.
The footer is always visible below the scroll area.

## Color palette (from dentallgt.com)

| Token | Hex | Usage |
|---|---|---|
| `--primary-dark` | `#004e64` | Header, footer-bottom |
| `--primary-teal` | `#00a7b5` | Icons, accents |
| `--footer-light` | `#EBF8F9` | Footer contact bg |

## File roles

| File | Purpose |
|---|---|
| `SDD.md` | Architecture + contracts (read before changing anything) |
| `index.html` | Header, viewer, footer, CDN script/style tags, DOM IDs |
| `css/styles.css` | Variables, layout, responsive, overflow scroll |
| `js/app.js` | PDF loading, render loop, queue system, zoom, download, tracking |
| `assets/` | PDFs, logo, favicons — served statically |

## Verification

No automated tests. Manual check: open via HTTP with `?pdf=ortodoncia.pdf&page=1`. Confirm:
- Header shows logo + controls, sticky on scroll.
- Page renders, pagination works, zoom scales, download triggers file save.
- Clicking Next/Prev rapidly does not freeze (queue system).
- Footer visible with 3 country columns + copyright.
- Missing `?pdf=` redirects to the default catalog.
- Check browser DevTools Network tab: POST to `/api/v1/tracking/scan` fires on page load.
