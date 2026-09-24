"""Local visual/function smoke. Set INVITE_TEST_URL to an isolated fixture invitation."""
import os
import re
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

invite = os.environ["INVITE_TEST_URL"]
screenshots = os.environ.get("SCREENSHOT_DIR", "/tmp")
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=chrome)
    for label, width, height in [("mobile", 390, 844), ("desktop", 1440, 900)]:
        context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2 if label == "mobile" else 1, reduced_motion="reduce")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(invite, wait_until="domcontentloaded", timeout=20000)
        try:
            page.wait_for_load_state("networkidle", timeout=5000)
        except PlaywrightTimeout:
            pass
        assert page.get_by_role("button", name=re.compile("Open the invitation", re.I)).count() == 1
        page.get_by_role("button", name=re.compile("Open the invitation", re.I)).click()
        page.locator(".v2-world.has-entered").wait_for(timeout=10000)
        assert page.locator("#details").count() == 1
        assert page.locator("#rsvp").count() == 1
        assert page.locator("a[href*='maps.app.goo.gl']").count() >= 1
        assert "Pandiga" in page.locator("#details").inner_text()
        assert "14:00" in page.locator("#details").inner_text()
        assert "18:00" in page.locator("#details").inner_text()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.locator("#rsvp input[value='yes']").check()
        page.locator("#rsvp select").select_option("1")
        page.get_by_role("button", name="Save my answer").click()
        page.wait_for_function("document.querySelector('#rsvp [role=status]')?.textContent?.includes('LIST')", timeout=10000)
        page.screenshot(path=f"{screenshots}/{label}-invitation.png")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("document.querySelector('#rsvp input[value=yes]')?.checked === true", timeout=10000)
        assert not errors, f"{label} browser errors: {errors[:3]}"
        print(f"{label} opening, details, RSVP, refresh, width: OK")
        context.close()

    # External map tiles may fail on mobile data; the DOM directions remain usable.
    context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
    context.route("https://tiles.openfreemap.org/**", lambda route: route.abort())
    page = context.new_page()
    page.goto(invite, wait_until="domcontentloaded", timeout=20000)
    page.get_by_role("button", name=re.compile("Open the invitation", re.I)).click()
    page.locator(".v2-world.has-entered").wait_for(timeout=10000)
    page.locator("#details").scroll_into_view_if_needed()
    assert page.locator("a[href*='maps.app.goo.gl']").count() >= 1
    assert "Pandiga" in page.locator("#details").inner_text()
    print("map failure fallback: OK")
    context.close()
    browser.close()
