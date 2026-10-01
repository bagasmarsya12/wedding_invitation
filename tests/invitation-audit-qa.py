"""Browser regression checks. Fixture postcards are intercepted in-browser only;
no guest records are created or submitted to the user's database.
"""
import json
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get("GARDEN_QA_URL", "http://localhost:5173/")
CHROME = os.environ.get("CHROME_PATH", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
SECTIONS = ["the-day", "details", "profiles", "archive", "rsvp", "useful-bits", "gifts", "leave-a-mark", "beyond"]
STYLES = ["classic", "rose", "sage", "airmail", "midnight"]
FIXTURES = [{"id": f"mark_visual_{i}", "author_name": f"Visual fixture {i}",
             "message": "A browser-only test postcard. " * 6, "style": STYLES[i % 5],
             "font": "clean", "drawingUrl": None, "created_at": "2026-09-30T00:00:00.000Z"}
            for i in range(54)]


def enter(page):
    page.goto(URL, wait_until="domcontentloaded")
    # Wait for hydration before clicking; server-rendered buttons have no
    # React handler until this body class is set by the mounted experience.
    page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
    page.get_by_role("button", name="Skip opening", exact=True).click()
    page.locator(".has-entered").wait_for()


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    for name, width, height, rows, cols in [("desktop", 1440, 900, 3, 4), ("mobile", 390, 844, 2, 3), ("small", 320, 740, 2, 3)]:
        context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        def intercept(route):
            more = "cursor=" in route.request.url
            route.fulfill(json={"marks": FIXTURES[48:] if more else FIXTURES[:48], "nextCursor": None if more else "next-fixture"})
        page.route("**/api/marks?**", intercept)
        enter(page)
        page.locator("#leave-a-mark").scroll_into_view_if_needed()
        page.wait_for_function("document.querySelectorAll('.postcard-wall-card').length === 48")
        wall = page.locator(".v2-postcard-wall")
        metrics = wall.evaluate("""wall => {
          const box=wall.getBoundingClientRect();
          const cards=[...wall.querySelectorAll('.postcard-wall-card')].map(c=>c.getBoundingClientRect());
          const visible=cards.filter(c=>c.left>=box.left-1&&c.right<=box.right+1);
          return {visible:visible.length,rows:new Set(visible.map(c=>Math.round(c.top))).size,cols:new Set(visible.map(c=>Math.round(c.left))).size};
        }""")
        assert metrics == {"visible": rows * cols, "rows": rows, "cols": cols}, (name, metrics)
        assert page.locator("a[href='/marks']").count() == 0
        page.screenshot(path=f"/tmp/audit-{name}-postcard-wall.png")
        first = page.locator(".postcard-wall-card").first
        first.click()
        page.locator("dialog[open]").wait_for()
        assert page.locator("dialog .postcard-writing").inner_text() == FIXTURES[0]["message"]
        assert page.evaluate("document.body.style.overflow === 'hidden'")
        page.screenshot(path=f"/tmp/audit-{name}-postcard-reader.png")
        page.keyboard.press("Escape")
        page.locator("dialog").wait_for(state="detached")
        assert first.evaluate("e=>e===document.activeElement"), "Reader must restore keyboard focus"
        wall.evaluate("e=>e.scrollLeft=e.scrollWidth")
        page.wait_for_function("document.querySelectorAll('.postcard-wall-card').length === 54")
        assert page.locator(".postcard-wall-card").count() == 54
        assert page.locator(".v2-postcard-wall").evaluate("e=>e.scrollWidth>e.clientWidth")
        page.get_by_role("button", name="Info", exact=True).click()
        assert page.locator("#invitation-info a[href='#leave-a-mark']").is_visible()
        page.locator("#invitation-info a[href='#leave-a-mark']").click()
        assert page.get_by_role("button", name="Info", exact=True).get_attribute("aria-expanded") == "false"
        heights = {}
        for section in SECTIONS:
            node = page.locator(f"#{section}")
            node.evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-64,behavior:'instant'})")
            page.wait_for_timeout(150)
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth"), (name, section)
            heights[section] = round(node.bounding_box()["height"])
        if width < 721:
            shelf = page.locator(".v2-evidence-field")
            assert shelf.evaluate("e=>e.scrollWidth>e.clientWidth"), "Mobile archive must browse sideways"
            for card in page.locator(".v2-artifact").all():
                assert card.bounding_box()["width"] >= width * .7, "Archive cards must not inherit narrow desktop columns"
        print(name, "PASS: wall grid, reader, pagination, focus, section index, overflow", json.dumps(heights))
        assert not errors, errors
        context.close()

    page = browser.new_page(viewport={"width":390,"height":844}, reduced_motion="reduce")
    page.route("**/api/site-state", lambda route: route.fulfill(json={"phase":"pre-wedding","rsvpEnabled":False,"giftsEnabled":False,"marksEnabled":False}))
    enter(page)
    page.locator("#rsvp").scroll_into_view_if_needed()
    assert page.locator("#rsvp input[value='yes']").is_disabled()
    assert page.locator(".reply-submit").is_disabled()
    assert "RSVP is closed" in page.locator("#rsvp").inner_text()
    assert page.locator("#gifts a[href='/gifts']").count() == 0
    assert "will open later" in page.locator("#gifts").inner_text()
    page.locator(".v2-spine").get_by_role("button", name="Bahasa Indonesia", exact=True).click()
    assert "akan dibuka nanti" in page.locator("#gifts").inner_text()
    print("PASS: feature flags disable RSVP and gift CTA; closed-state copy translates")
    browser.close()
