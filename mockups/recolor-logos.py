#!/usr/bin/env python3
"""Recolor static/dobi-avatar.png into one logo per v2 mockup direction.

Each source pixel is treated as a blend of three reference colors (navy ink,
green figure, white eyes). The blend weights are solved per pixel and then
re-applied with the direction palette, so anti-aliased edges stay smooth.
The navy area connected to the image border becomes transparent; the face
and any enclosed navy stay solid ink.

Outputs (the original avatar is never modified):
  mockups/v2/logos/<direction>.png       transparent, cropped to the figure
  mockups/v2/logos/<direction>-tile.png  square, on an ink background
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "static" / "dobi-avatar.png"
OUT = ROOT / "mockups" / "v2" / "logos"

PALETTES = {
    "field": {"accent": "#A3471C", "ink": "#2A3022", "eyes": "#FFF8F0"},
    "blaze": {"accent": "#FF6B00", "ink": "#161513", "eyes": "#F4EFE6"},
    "topo": {"accent": "#2C5A3C", "ink": "#1C241C", "eyes": "#F6F1E7"},
    "rescue": {"accent": "#C0272C", "ink": "#1B2430", "eyes": "#FFFFFF"},
}

UPSCALE = 2
EDGE_RING = 3 * UPSCALE
EDGE_LO, EDGE_HI = 0.18, 0.82


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def decompose(rgb):
    """Return per-pixel weights (w_ink, w_fig, w_eye) that sum to 1."""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    ink = np.median(border, axis=0)
    green_mask = (rgb[..., 1] - rgb[..., 0]) > 80
    fig = np.median(rgb[green_mask], axis=0)
    white_mask = rgb.min(axis=2) > 215
    eye = np.median(rgb[white_mask], axis=0)

    basis = np.stack([fig - ink, eye - ink], axis=1)  # 3x2
    pinv = np.linalg.pinv(basis)  # 2x3
    coeffs = (rgb.reshape(-1, 3) - ink) @ pinv.T
    a = np.clip(coeffs[:, 0], 0, 1)
    b = np.clip(coeffs[:, 1], 0, 1)
    total = a + b
    over = total > 1
    a[over] /= total[over]
    b[over] /= total[over]
    # Snap faint grain to flat color without hardening real anti-aliased edges.
    a = np.clip((a - 0.04) / 0.92, 0, 1)
    b = np.clip((b - 0.04) / 0.92, 0, 1)
    total = a + b
    over = total > 1
    a[over] /= total[over]
    b[over] /= total[over]
    w_ink = 1 - a - b
    return w_ink.reshape(h, w), a.reshape(h, w), b.reshape(h, w)


def background_mask(w_ink):
    """Navy pixels connected to the image border."""
    dark = Image.fromarray(((w_ink > 0.5) * 255).astype(np.uint8), "L").copy()
    h, w = w_ink.shape
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if dark.getpixel(seed) == 255:
            ImageDraw.floodfill(dark, seed, 128)
    bg = np.array(dark) == 128
    bg_img = Image.fromarray((bg * 255).astype(np.uint8), "L")
    zone = np.array(bg_img.filter(ImageFilter.MaxFilter(EDGE_RING * 2 + 1))) > 0
    # Background far from any figure edge is pure grain in the source: drop it.
    far = np.array(bg_img.filter(ImageFilter.MinFilter(EDGE_RING * 4 + 1))) > 0
    return zone, far


def render(weights, zones, palette):
    bg_zone, far_bg = zones
    w_ink, w_fig, w_eye = weights
    ink = hex_rgb(palette["ink"])
    fig = hex_rgb(palette["accent"])
    eye = hex_rgb(palette["eyes"])

    solid = (
        w_ink[..., None] * ink + w_fig[..., None] * fig + w_eye[..., None] * eye
    )
    alpha = np.ones_like(w_ink)

    # Near the outer background, the ink share becomes transparency instead.
    cover = w_fig + w_eye
    safe = np.where(cover > 1e-6, cover, 1)
    edge_rgb = (w_fig[..., None] * fig + w_eye[..., None] * eye) / safe[..., None]
    rgb = np.where(bg_zone[..., None], edge_rgb, solid)
    edge_alpha = np.clip((cover - EDGE_LO) / (EDGE_HI - EDGE_LO), 0, 1)
    alpha = np.where(bg_zone, edge_alpha, alpha)
    alpha = np.where(far_bg, 0, alpha)

    out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)])
    return Image.fromarray(out.round().astype(np.uint8), "RGBA")


def crop_figure(img, pad_ratio=0.04):
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    x0, y0, x1, y1 = bbox
    pad = int(max(x1 - x0, y1 - y0) * pad_ratio)
    return img.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))


def tile(fig_img, ink_hex, size=1024):
    canvas = Image.new("RGBA", (size, size), tuple(hex_rgb(ink_hex).astype(int)) + (255,))
    scale = (size * 0.78) / max(fig_img.size)
    resized = fig_img.resize(
        (round(fig_img.width * scale), round(fig_img.height * scale)), Image.LANCZOS
    )
    canvas.alpha_composite(
        resized, ((size - resized.width) // 2, (size - resized.height) // 2)
    )
    return canvas


def main():
    src = Image.open(SRC).convert("RGB")
    src = src.resize((src.width * UPSCALE, src.height * UPSCALE), Image.LANCZOS)
    rgb = np.asarray(src, dtype=np.float64)
    weights = decompose(rgb)
    zones = background_mask(weights[0])

    OUT.mkdir(parents=True, exist_ok=True)
    for name, palette in PALETTES.items():
        figure = crop_figure(render(weights, zones, palette))
        figure.save(OUT / f"{name}.png", optimize=True)
        tile(figure, palette["ink"]).save(OUT / f"{name}-tile.png", optimize=True)
        print(f"wrote {name}.png {figure.size} and {name}-tile.png")


if __name__ == "__main__":
    main()
