#!/usr/bin/env python3
"""Generate the Flagoji favicon / app-icon set from assets/symbol.svg.

Reproducible: reads the traced mark, composes two icon masters
(rounded tile for the browser favicon, full-bleed square for Apple/Android
per their platform guidance), rasterises every PNG size with headless
Chrome, and assembles a multi-resolution favicon.ico.

Run:  python3 scripts/build-icons.py
Deps: headless Google Chrome + Pillow (PIL).
"""
import re, subprocess, tempfile, pathlib, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRAND = "#D97757"          # Flagoji brand — Claude orange
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# --- read the traced mark -------------------------------------------------
sym = (ROOT / "assets/symbol.svg").read_text()
paths = re.findall(r'\sd="([^"]+)"', sym)
assert paths, "no paths in symbol.svg"

# mark is authored in a 130 x 133 viewBox; place it centred on a 512 tile
# at ~60% height so it survives Android's maskable safe-zone crop.
TILE = 512
mh = TILE * 0.60
scale = mh / 133
mw = 130 * scale
tx = (TILE - mw) / 2
ty = (TILE - mh) / 2
mark = (f'<g transform="translate({tx:.2f},{ty:.2f}) scale({scale:.4f})" fill="#ffffff">'
        + "".join(f'<path d="{d}"/>' for d in paths) + "</g>")

def svg(tile):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {TILE} {TILE}">'
            f'{tile}{mark}</svg>')

ROUNDED = svg(f'<rect width="{TILE}" height="{TILE}" rx="115" fill="{BRAND}"/>')  # transparent corners
SQUARE  = svg(f'<rect width="{TILE}" height="{TILE}" fill="{BRAND}"/>')            # full-bleed, opaque

(ROOT / "assets/brand").mkdir(parents=True, exist_ok=True)
(ROOT / "favicon.svg").write_text(ROUNDED)
(ROOT / "assets/brand/icon-rounded.svg").write_text(ROUNDED)
(ROOT / "assets/brand/icon-square.svg").write_text(SQUARE)

# --- rasterise via headless Chrome ---------------------------------------
# Headless Chrome clamps very small window sizes, so we render each master once
# at 512 and downsample the smaller variants with Pillow (crisp + consistent).
RENDER_AT = 512

def render_master(svg_text, transparent):
    html = ("<!doctype html><meta charset=utf-8>"
            "<style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>"
            + svg_text)
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(html); src = f.name
    out = ROOT / "_render_tmp.png"
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
           "--force-device-scale-factor=1", f"--screenshot={out}",
           f"--window-size={RENDER_AT},{RENDER_AT}"]
    if transparent:
        cmd.append("--default-background-color=00000000")
    cmd.append(f"file://{src}")  # page to render (last positional arg)
    subprocess.run(cmd, check=True, capture_output=True)
    pathlib.Path(src).unlink(missing_ok=True)
    im = Image.open(out).convert("RGBA")
    out.unlink(missing_ok=True)
    if im.size != (RENDER_AT, RENDER_AT):
        im = im.resize((RENDER_AT, RENDER_AT), Image.LANCZOS)
    return im

def png(master, size, out):
    (master if size == RENDER_AT else master.resize((size, size), Image.LANCZOS)).save(out)

square = render_master(SQUARE, transparent=False)
rounded = render_master(ROUNDED, transparent=True)

# opaque, full-bleed PNGs for Apple / Android (per platform guidance)
png(square, 180, ROOT / "apple-touch-icon.png")
png(square, 192, ROOT / "icon-192.png")
png(square, 512, ROOT / "icon-512.png")

# favicon.ico: multi-size 16/32/48 from the rounded master (transparent corners)
rounded.save(ROOT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

print("wrote:", ", ".join([
    "favicon.svg", "favicon.ico", "apple-touch-icon.png",
    "icon-192.png", "icon-512.png",
    "assets/brand/icon-rounded.svg", "assets/brand/icon-square.svg"]))
