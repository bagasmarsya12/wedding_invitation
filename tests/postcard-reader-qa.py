"""Read-only browser fixtures: no postcards are submitted to the database."""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get("GARDEN_QA_URL", "http://localhost:5173/")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ART = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500'%3E%3Cpath d='M100 400 Q400 20 700 400' fill='none' stroke='%23915f67' stroke-width='8'/%3E%3C/svg%3E"
MARKS = [{"id": f"reader-{i}", "author_name": f"Reader fixture {i}",
          "message": (None if i == 4 else "A long message that must remain fully readable. " * 50 if i == 2 else f"Message {i}. Thank you for having us."),
          "style": ["classic", "rose", "sage", "airmail", "midnight"][i % 5],
          "font": "clean", "drawingUrl": ART if i in [2,4] else None,
          "created_at": "2026-09-30T00:00:00.000Z"} for i in range(54)]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    for label, width, height, reduced in [("desktop",1440,900,"no-preference"),("mobile",390,844,"no-preference"),("small",320,740,"reduce")]:
        context = browser.new_context(viewport={"width":width,"height":height}, has_touch=True, reduced_motion=reduced)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/api/marks?**", lambda route: route.fulfill(json={"marks":MARKS[48:] if "cursor=" in route.request.url else MARKS[:48], "nextCursor":None if "cursor=" in route.request.url else "page-two"}))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        assert page.locator(".v2-letter-opening").count() == 0, "Do not reintroduce the envelope redesign"
        page.get_by_role("button", name="Skip opening", exact=True).click()
        page.locator("#leave-a-mark").scroll_into_view_if_needed()
        first = page.get_by_role("button", name="Open postcard from Reader fixture 1", exact=True)
        first.click()
        deck = page.locator(".postcard-reader-deck")
        deck.wait_for()
        def current(index):
            page.wait_for_function("id=>document.querySelector('.postcard-reader-active')?.dataset.cardId===id", arg=f"reader-{index}")
            page.wait_for_timeout(650 if reduced != "reduce" else 50)
        current(1)
        page.get_by_role("button", name="Next card", exact=True).click()
        current(2)
        message = page.locator("dialog .postcard-writing")
        assert message.inner_text() == MARKS[2]["message"]
        assert message.evaluate("e=>e.scrollHeight>e.clientHeight"), "Long messages need internal scrolling"
        assert page.locator("dialog .postcard-ink").evaluate("e=>{const a=e.getBoundingClientRect(),b=document.querySelector('dialog .postcard-writing').getBoundingClientRect();return a.bottom<=b.top+1}"), "Artwork must not overlap the message"
        if width < 500:
            session = context.new_cdp_session(page)
            box = message.bounding_box()
            x, y = box["x"]+box["width"]*.5, box["y"]+box["height"]*.8
            session.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":x,"y":y}]})
            for step in range(1,9):
                session.send("Input.dispatchTouchEvent", {"type":"touchMove","touchPoints":[{"x":x,"y":y-step*12}]})
                page.wait_for_timeout(18)
            session.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
            assert message.evaluate("e=>e.scrollTop>0"), "Vertical touch scrolling must not turn the card"
            current(2)
        page.screenshot(path=f"/tmp/postcard-{label}-art.png")
        page.keyboard.press("ArrowRight")
        current(3)
        assert page.locator("dialog .pc--airmail").count() >= 1
        active = page.locator(".postcard-reader-active")
        box = active.bounding_box()
        page.mouse.move(box["x"]+box["width"]*.65, box["y"]+box["height"]*.5)
        page.mouse.down()
        page.mouse.move(box["x"]+box["width"]*.1, box["y"]+box["height"]*.5, steps=12)
        page.mouse.up()
        current(4)
        assert page.locator("dialog .postcard-ink").bounding_box()["height"] > 100
        assert not page.locator("dialog .postcard-writing").is_visible(), "Drawing-only cards should give the artwork the whole body"
        page.get_by_role("button", name="Previous card", exact=True).click()
        current(3)
        assert page.locator("dialog .postcard-from").evaluate("e=>{const card=e.closest('.postcard').getBoundingClientRect();return e.getBoundingClientRect().bottom<card.bottom-card.height*.075}"), "Airmail border must not cover the signature"
        if width < 500:
            # Real browser touch input, including the inner scrollable message.
            session = context.new_cdp_session(page)
            box = page.locator("dialog .postcard-writing").bounding_box()
            x, y = box["x"]+box["width"]*.75, box["y"]+min(60,box["height"]*.5)
            session.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":x,"y":y}]})
            for step in range(1,9):
                session.send("Input.dispatchTouchEvent", {"type":"touchMove","touchPoints":[{"x":x-step*19,"y":y}]})
                page.wait_for_timeout(18)
            session.send("Input.dispatchTouchEvent", {"type":"touchEnd","touchPoints":[]})
            current(4)
            page.get_by_role("button", name="Previous card", exact=True).click()
            current(3)
            session.send("Input.dispatchTouchEvent", {"type":"touchStart","touchPoints":[{"x":x,"y":y}]})
            session.send("Input.dispatchTouchEvent", {"type":"touchMove","touchPoints":[{"x":x-80,"y":y}]})
            session.send("Input.dispatchTouchEvent", {"type":"touchCancel","touchPoints":[]})
            current(3)
            assert page.locator(".postcard-reader-active").evaluate("e=>getComputedStyle(e).transform==='none'"), "Cancelled touch must settle back"
        assert page.locator("dialog").evaluate("e=>e.scrollWidth<=e.clientWidth"), "No reader horizontal overflow"
        page.screenshot(path=f"/tmp/postcard-{label}-reader.png")
        page.keyboard.press("Escape")
        page.locator("dialog").wait_for(state="detached")
        assert first.evaluate("e=>e===document.activeElement")
        wall = page.locator(".v2-postcard-wall")
        wall.evaluate("e=>e.scrollLeft=e.scrollWidth")
        page.get_by_role("button", name="Open postcard from Reader fixture 47", exact=True).click()
        current(47)
        page.wait_for_function("document.querySelectorAll('.postcard-wall-card').length===54")
        page.get_by_role("button", name="Next card", exact=True).click()
        current(48)
        page.get_by_role("button", name="Close", exact=True).click()
        page.locator("dialog").wait_for(state="detached")
        wall.evaluate("e=>e.scrollLeft=e.scrollWidth")
        page.get_by_role("button", name="Open postcard from Reader fixture 53", exact=True).click()
        current(53)
        assert page.get_by_role("button", name="Next card", exact=True).is_disabled()
        assert not errors, errors
        print(label, "PASS: restored envelope, selected card, swipe, arrows, artwork, long text, focus, pagination")
        context.close()
    if os.environ.get("POSTCARD_REAL_PREVIEW") == "1":
        page = browser.new_page(viewport={"width":390,"height":844}, reduced_motion="reduce")
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        page.get_by_role("button", name="Skip opening", exact=True).click()
        page.locator(".postcard-wall-card").first.click()
        page.locator("dialog[open]").wait_for()
        page.screenshot(path="/tmp/postcard-real-reader.png")
    browser.close()
