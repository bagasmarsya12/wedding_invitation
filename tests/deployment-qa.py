"""Read-only deployed UI smoke: never accepts guest URLs or submits guest data."""
import os
from playwright.sync_api import sync_playwright, TimeoutError

URL = os.environ["SITE_URL"].rstrip("/")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    for name, width, height in [("desktop",1440,1000),("mobile",390,844),("small",320,740)]:
        context = browser.new_context(viewport={"width":width,"height":height}, reduced_motion="reduce")
        page = context.new_page()
        errors, mutations = [], []
        page.on("pageerror", lambda error:errors.append(str(error)))
        def read_only(route):
            if route.request.method not in ["GET","HEAD","OPTIONS"]:
                mutations.append(route.request.method)
                route.abort()
            else:
                route.continue_()
        page.route("**/*", read_only)
        for path in ["/.DS_Store","/assets/.DS_Store"]:
            response = context.request.get(URL+path)
            # Cloudflare can answer ignored dotfiles with an empty 200 instead
            # of an application 404. Check that no metadata bytes are served.
            assert response.status in [403,404] or response.body() == b"", "Finder metadata must not be public"
        response = page.goto(URL+"/", wait_until="domcontentloaded")
        assert response.status == 200
        try:
            page.wait_for_load_state("networkidle", timeout=4000)
        except TimeoutError:
            pass  # External map fonts/tiles are not a prerequisite for navigation.
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        assert page.locator(".v2-opening").is_visible()
        page.get_by_role("button", name="Skip opening", exact=True).click()
        page.locator(".has-garden-renderer").wait_for()
        assert page.locator("#the-day time").inner_text().endswith("01 November 2026")
        page.get_by_role("button", name="Info", exact=True).click()
        page.locator("#invitation-info a[href='#details']").click()
        assert page.locator("#details a[href*='maps.app.goo.gl']").count() == 1
        page.get_by_role("button", name="Info", exact=True).click()
        page.locator("#invitation-info a[href='#rsvp']").click()
        page.locator("#rsvp input[value='yes']").wait_for()
        page.locator("#rsvp input[value='no']").wait_for()
        assert page.locator(".v2-postcard-wall").count() <= 1
        page.locator(".v2-closing").scroll_into_view_if_needed()
        page.locator("#closing-title").wait_for()
        assert page.locator(".v2-closing-paper").is_visible()
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        page.get_by_role("button", name="Bahasa Indonesia", exact=True).click()
        assert page.locator("#closing-title").inner_text() in ["Sampai ketemu di Cimahi.","Terima kasih sudah menjadi bagian dari hari kami."]
        page.get_by_role("button", name="English", exact=True).click()
        page.get_by_role("button", name="View the envelope again", exact=True).click()
        page.locator(".v2-opening").wait_for()
        assert not mutations, "Production smoke must remain read-only"
        assert not errors, errors
        print(name, "PASS: deployed opening, garden, practical navigation, deferred reply, bilingual closing and reopen; no guest writes")
        context.close()
    browser.close()
