#!/usr/bin/env python3
"""Screenshot the v2 mockups with Playwright (system Chrome).

For each direction this writes to mockups/v2/screenshots/:
  <name>-desktop-full.png   1440 wide, full page, no height cap
  <name>-mobile-full.png    390 wide (2x), full page, no height cap
  <name>-desktop-fold.png   1440x900 above the fold
  <name>-*-full-partN.png   the full shots split into parts when very tall
  <name>-swaptest-*-fold.png  fold with a placeholder mark in the logo slot

Full pages are captured in clipped chunks and stitched with PIL, which avoids
Chromium's maximum texture height for single tall captures.

Usage: python3 mockups/v2/take-screenshots.py [a-field b-blaze ...]
"""

import shutil
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / "screenshots"
ARTIFACTS = Path("/opt/cursor/artifacts")
CHROME = "/usr/local/bin/google-chrome"
PAGES = ["a-field", "b-blaze", "c-topo", "d-rescue"]
CHUNK_CSS = 3000
PART_MAX_PX = 6000
SWAP_TESTS = ["badge", "wordmark"]


def full_page(page, path, scale):
    height = page.evaluate("document.documentElement.scrollHeight")
    width = page.viewport_size["width"]
    chunks = []
    y = 0
    while y < height:
        h = min(CHUNK_CSS, height - y)
        tmp = path.with_suffix(f".chunk{len(chunks)}.png")
        page.screenshot(path=str(tmp), full_page=True,
                        clip={"x": 0, "y": y, "width": width, "height": h})
        chunks.append(tmp)
        y += h
    images = [Image.open(c) for c in chunks]
    stitched = Image.new("RGB", (images[0].width, sum(i.height for i in images)))
    offset = 0
    for img in images:
        stitched.paste(img, (0, offset))
        offset += img.height
    for c in chunks:
        c.unlink()
    stitched.save(path, optimize=True)

    parts = []
    if stitched.height > PART_MAX_PX:
        count = -(-stitched.height // PART_MAX_PX)
        step = -(-stitched.height // count)
        for i in range(count):
            part = stitched.crop((0, i * step, stitched.width, min((i + 1) * step, stitched.height)))
            part_path = path.with_name(f"{path.stem}-part{i + 1}.png")
            part.save(part_path, optimize=True)
            parts.append(part_path)
    return [path, *parts], height


def settle(page):
    page.evaluate("document.fonts.ready")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(300)


def main():
    names = sys.argv[1:] or PAGES
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.png"):
        if any(old.name.startswith(n) for n in names):
            old.unlink()

    written = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        for name in names:
            url = (HERE / f"{name}.html").as_uri()

            desk = browser.new_page(viewport={"width": 1440, "height": 900})
            desk.goto(url)
            settle(desk)
            fold = OUT / f"{name}-desktop-fold.png"
            desk.screenshot(path=str(fold))
            files, h = full_page(desk, OUT / f"{name}-desktop-full.png", 1)
            written += [fold, *files]
            print(f"{name}: desktop {h}px tall")

            for mark in SWAP_TESTS:
                desk.goto(f"{url}?mark=logos/placeholder-{mark}.svg")
                settle(desk)
                swap = OUT / f"{name}-swaptest-{mark}-fold.png"
                desk.screenshot(path=str(swap))
                written.append(swap)
            desk.close()

            mob = browser.new_page(viewport={"width": 390, "height": 844},
                                   device_scale_factor=2, is_mobile=True, has_touch=True)
            mob.goto(url)
            settle(mob)
            files, h = full_page(mob, OUT / f"{name}-mobile-full.png", 2)
            written += files
            print(f"{name}: mobile {h}px tall")
            mob.close()
        browser.close()

    if ARTIFACTS.parent.exists():
        ARTIFACTS.mkdir(exist_ok=True)
        for f in written:
            shutil.copy(f, ARTIFACTS / f.name)
    for f in written:
        print(f.relative_to(HERE))


if __name__ == "__main__":
    main()
