#!/usr/bin/env python3
"""Make mockups/v3/logos/blaze-ovals.png: the blaze figure with its slanted
eyes replaced by two upright warm-white ovals.

Reads mockups/v2/logos/blaze.png (output of mockups/recolor-logos.py) and
leaves it untouched.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "v2" / "logos" / "blaze.png"
OUT = ROOT / "v3" / "logos" / "blaze-ovals.png"

FACE = (0x16, 0x15, 0x13)
EYE = (0xF4, 0xEF, 0xE6)
OVAL_W = 0.07        # of face width
OVAL_RATIO = 2.2     # height / width
OVAL_GAP = 0.38      # center-to-center, of face width
SS = 4               # supersampling factor


def largest_components(mask, keep):
    """Keep the `keep` largest 4-connected regions of a boolean mask."""
    seen = np.zeros_like(mask)
    regions = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        stack, region = [(y, x)], []
        seen[y, x] = True
        while stack:
            cy, cx = stack.pop()
            region.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        regions.append(region)
    regions.sort(key=len, reverse=True)
    out = np.zeros_like(mask)
    for region in regions[:keep]:
        ys, xs = zip(*region)
        out[list(ys), list(xs)] = True
    return out


def main():
    img = Image.open(SRC).convert("RGBA")
    px = np.array(img).astype(int)
    rgb, alpha = px[..., :3], px[..., 3]

    dark = (np.abs(rgb - FACE).sum(-1) < 60) & (alpha > 200)
    # The face is the dark region in the upper part of the figure.
    rows = np.nonzero(dark.any(1))[0]
    ys, xs = np.nonzero(dark)
    top, bottom = ys.min(), ys.max()
    left, right = xs.min(), xs.max()
    face_w = right - left
    face_cx = (left + right) / 2
    face_cy = (top + bottom) / 2

    light = (rgb.sum(-1) > 450) & (alpha > 200)
    light[:top, :] = False
    light[bottom:, :] = False
    light[:, :left] = False
    light[:, right:] = False
    light = largest_components(light, 2)
    ey, ex = np.nonzero(light)
    eye_cy = ey.mean()
    l_eye = ex < face_cx
    old_centers = [(ex[l_eye].mean(), ey[l_eye].mean()), (ex[~l_eye].mean(), ey[~l_eye].mean())]

    # Erase the old eyes, including their anti-aliased rims.
    mask = Image.fromarray((light * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(11))
    erase = np.array(mask) > 0
    px[erase, :3] = FACE
    px[erase, 3] = 255
    base = Image.fromarray(px.astype(np.uint8), "RGBA")

    w = OVAL_W * face_w
    h = w * OVAL_RATIO
    cy = max(eye_cy, face_cy + 0.02 * (bottom - top))
    centers = [face_cx - OVAL_GAP * face_w / 2, face_cx + OVAL_GAP * face_w / 2]

    big = Image.new("L", (base.width * SS, base.height * SS), 0)
    draw = ImageDraw.Draw(big)
    for cx in centers:
        draw.ellipse([(cx - w / 2) * SS, (cy - h / 2) * SS, (cx + w / 2) * SS, (cy + h / 2) * SS], fill=255)
    oval_mask = big.resize(base.size, Image.LANCZOS)

    white = Image.new("RGBA", base.size, EYE + (255,))
    out = Image.composite(white, base, oval_mask)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, optimize=True)

    print(f"face x {left}-{right} y {top}-{bottom} (width {face_w}, middle y {face_cy:.0f})")
    print("old eye centers", [(round(x), round(y)) for x, y in old_centers])
    print(f"ovals {w:.1f} x {h:.1f} px at x {centers[0]:.0f} and {centers[1]:.0f}, y {cy:.0f}")


if __name__ == "__main__":
    main()
