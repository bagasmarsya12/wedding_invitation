import os
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

base = os.environ.get("SITE_URL", "http://127.0.0.1:4178")
invite = os.environ.get("INVITE_TEST_URL", base)
output = os.environ.get("SCREENSHOT_PATH", "/tmp/bagas-iga-recon.png")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    page.goto(invite, wait_until="domcontentloaded", timeout=20000)
    try:
        page.wait_for_load_state("networkidle", timeout=5000)
    except PlaywrightTimeout:
        pass
    print("TITLE", page.title())
    print("H1", page.locator("h1").all_text_contents()[:10])
    print("BUTTONS", page.get_by_role("button").all_text_contents()[:20])
    print("BUTTON_MARKUP", page.get_by_role("button").evaluate_all("nodes => nodes.slice(0, 5).map(node => node.outerHTML.slice(0, 500))"))
    print("LINKS", page.get_by_role("link").all_text_contents()[:20])
    print("RSVP", page.locator("#rsvp").count())
    print("DETAILS", page.locator("#details").count())
    print("WIDTH", page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]"))
    page.screenshot(path=output)
    browser.close()
