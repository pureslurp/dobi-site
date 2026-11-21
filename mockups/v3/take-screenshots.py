#!/usr/bin/env python3
"""Screenshot mockups/v3/blaze.html with Playwright (system Chrome).

Writes to mockups/v3/screenshots/ and copies to /opt/cursor/artifacts/:
  blaze-desktop-fold.png       1440x900
  blaze-desktop-full.png       1440 wide, full page (plus -partN when tall)
  blaze-mobile-fold.png        390x844 at 2x
  blaze-mobile-full.png        390 wide at 2x, full page (plus -partN when tall)
  blaze-mobile-nav-open.png    390x844 at 2x with the menu open
  blaze-nav-cta-crop.png       close-up of the desktop nav buy button (2x)

Usage: python3 mockups/v3/take-screenshots.py
"""

import shutil
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "v2"))
import importlib.util

spec = importlib.util.spec_from_file_location("v2shots", Path(__file__).resolve().parent.parent / "v2" / "take-screenshots.py")
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)

HERE = Path(__file__).resolve().parent
OUT = HERE / "screenshots"
ARTIFACTS = Path("/opt/cursor/artifacts")


def main():
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("blaze-*.png"):
        old.unlink()
    url = (HERE / "blaze.html").as_uri()
    written = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=v2.CHROME)

        desk = browser.new_page(viewport={"width": 1440, "height": 900})
        desk.goto(url)
        v2.settle(desk)
        desk.screenshot(path=str(OUT / "blaze-desktop-fold.png"))
        written.append(OUT / "blaze-desktop-fold.png")
        files, h = v2.full_page(desk, OUT / "blaze-desktop-full.png", 1)
        written += files
        print(f"desktop {h}px tall")
        desk.close()

        crop = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=2)
        crop.goto(url)
        v2.settle(crop)
        box = crop.locator(".nav .wrap").bounding_box()
        btn = crop.locator(".nav-cta").bounding_box()
        x0 = btn["x"] - 380
        crop.screenshot(path=str(OUT / "blaze-nav-cta-crop.png"),
                        clip={"x": x0, "y": box["y"], "width": btn["x"] + btn["width"] + 24 - x0, "height": box["height"]})
        written.append(OUT / "blaze-nav-cta-crop.png")
        crop.close()

        mob = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                               is_mobile=True, has_touch=True)
        mob.goto(url)
        v2.settle(mob)
        mob.screenshot(path=str(OUT / "blaze-mobile-fold.png"))
        written.append(OUT / "blaze-mobile-fold.png")
        files, h = v2.full_page(mob, OUT / "blaze-mobile-full.png", 2)
        written += files
        print(f"mobile {h}px tall")
        mob.evaluate("window.scrollTo(0, 0)")
        mob.click(".menu-btn")
        mob.wait_for_timeout(200)
        mob.screenshot(path=str(OUT / "blaze-mobile-nav-open.png"))
        written.append(OUT / "blaze-mobile-nav-open.png")
        mob.close()
        browser.close()

    ARTIFACTS.mkdir(exist_ok=True)
    for f in written:
        shutil.copy(f, ARTIFACTS / f.name)
        print(f.relative_to(HERE))


if __name__ == "__main__":
    main()
