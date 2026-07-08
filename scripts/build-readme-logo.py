#!/usr/bin/env python3
"""Compose the README logo lockup (symbol + wordmark) as two theme SVGs.

Reads assets/symbol.svg and assets/images/typo.svg, strips their per-path
fills, and lays out the symbol (40px tall) with the wordmark composed to its
right. Emits a light and a dark variant for a <picture> in the README.

Run: python3 scripts/build-readme-logo.py
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORANGE = "#D97757"       # brand symbol, both themes
INK    = "#141414"       # wordmark on light bg
CREAM  = "#F4F1EA"       # wordmark on dark bg

def paths_without_fill(svg_text):
    """Return path elements with their fill attribute stripped (keep d, fill-rule…)."""
    tags = re.findall(r"<path\b[^>]*/>", svg_text)
    return [re.sub(r'\s*fill="[^"]*"', "", t) for t in tags]

sym_paths  = paths_without_fill((ROOT / "assets/symbol.svg").read_text())
word_paths = paths_without_fill((ROOT / "assets/images/typo.svg").read_text())

# symbol native 130x133 -> 40px tall ; wordmark native 441x167 -> 34px tall
SYM_H = 40
s1 = SYM_H / 133
sym_w = 130 * s1                       # ~39.1
gap = 14
word_h = 34
s2 = word_h / 167
word_w = 441 * s2                      # ~89.8
word_x = sym_w + gap
word_y = (SYM_H - word_h) / 2
vb_w = word_x + word_w

def lockup(word_color):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{vb_w:.0f}" height="{SYM_H}" '
        f'viewBox="0 0 {vb_w:.2f} {SYM_H}" fill="none">'
        f'<g transform="scale({s1:.6f})" fill="{ORANGE}">' + "".join(sym_paths) + "</g>"
        f'<g transform="translate({word_x:.3f},{word_y:.3f}) scale({s2:.6f})" fill="{word_color}">'
        + "".join(word_paths) + "</g></svg>"
    )

(ROOT / "assets/brand").mkdir(parents=True, exist_ok=True)
(ROOT / "assets/brand/logo-lockup-light.svg").write_text(lockup(INK))
(ROOT / "assets/brand/logo-lockup-dark.svg").write_text(lockup(CREAM))
print(f"wrote lockups  viewBox 0 0 {vb_w:.0f} {SYM_H}  (symbol {sym_w:.0f}px + gap {gap} + word {word_w:.0f}px)")
