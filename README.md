# Flagoji

Turn flag artwork into emoji-style previews for every major platform. Drop in an
SVG, PNG, JPG, or WebP, tune it with live sliders, and export crisp PNGs — plus
optional motion and animated GIF export.

**[Live demo →](https://flag-emoji-generator.vercel.app)**

## Features

- **Multi-platform previews** — Apple, Twitter, Samsung, Google, Huawei,
  WhatsApp, plus circle, rounded-square, and physics-wave variants, all rendered
  side by side.
- **Live tuning** — per-platform sliders for framing, scale, and shape.
- **Flexible export** — download PNGs at 0.5×, 1×, 2×, or 3× resolution.
- **Motion & GIF** — toggle an animated preview and export it as a GIF at
  adjustable speeds.
- **Options** — canvas smoothing, fit-to-frame, and transparent vs. shadowed
  backgrounds.
- **Zero framework** — plain HTML, CSS, and JavaScript (ES modules). Fast,
  static, and dependency-light.

## Run locally

ES modules don't load from `file://`, so serve the folder over HTTP:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Build (optional)

With Node.js installed, produce a minified `dist/` bundle:

```bash
node scripts/build-dist.mjs
```

There is no `package.json` or `npm install` step for the app itself — the build
scripts run on Node's standard library.

## Deploy

The repo ships a `vercel.json`, so the simplest path is [Vercel](https://vercel.com/new):
import the repository and it runs `node scripts/build-dist.mjs` and serves the
`dist/` output. It also works on any static host — upload the built files (or the
source directly) next to `index.html`. An `.htaccess` with sensible caching and
compression headers is included for Apache-based hosts.

## Tech notes

- GIF encoding uses [`gifenc`](https://github.com/mattdesl/gifenc).
- The physics-wave preview is rendered with WebGL.
- GIF frames are processed off the main thread via a Web Worker.

## License

[MIT](LICENSE) — © 2026 Armanic.

Made with care by **Armanic**.
