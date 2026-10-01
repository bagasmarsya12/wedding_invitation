"""Read-only visual smoke: public invitation, no guest records or form submissions.

GARDEN_QA_URL defaults to a local preview. Screenshots go to /tmp.
Requires Playwright and a local Google Chrome installation.
"""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get("GARDEN_QA_URL", "http://127.0.0.1:4184/")
CHROME = os.environ.get("CHROME_PATH", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
SECTIONS = ["the-day", "details", "profiles", "archive", "rsvp", "useful-bits", "gifts", "leave-a-mark", "beyond"]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    for name, width, height, reduced in [("desktop", 1440, 1000, "no-preference"), ("mobile", 390, 844, "reduce"), ("small", 320, 740, "reduce")]:
        context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2 if width < 500 else 1, reduced_motion=reduced)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        page.get_by_role("button", name="Open the invitation", exact=True).click()
        page.locator(".has-entered").wait_for(timeout=15000)
        page.locator(".has-garden-renderer").wait_for(timeout=15000)
        page.wait_for_timeout(1900)
        assert page.locator(".v2-garden-background canvas").count() == 1
        assert page.locator("#the-day").inner_text().find("01 November 2026") >= 0
        assert page.locator("#the-day a[href='#rsvp']").count() == 0
        assert page.get_by_role("button", name="Info", exact=True).is_visible()
        page.screenshot(path=f"/tmp/garden-{name}-hero.png")
        if reduced == "no-preference":
            before = page.locator(".v2-grand-portal").evaluate("e => getComputedStyle(e).translate")
            frame_report = page.evaluate("""async () => {
                const frames = []; let start, last;
                await new Promise(resolve => {
                    function tick(now) {
                        start ??= now; last ??= now;
                        frames.push(now - last); last = now;
                        window.scrollTo({top: Math.min(600, (now - start) * .4), behavior: 'instant'});
                        if (now - start < 1500) requestAnimationFrame(tick); else resolve();
                    }
                    requestAnimationFrame(tick);
                });
                const sorted = frames.slice(1).sort((a,b) => a-b);
                return {frames: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * .95)]};
            }""")
            page.wait_for_timeout(900)
            after = page.locator(".v2-grand-portal").evaluate("e => getComputedStyle(e).translate")
            assert before == after == "none", "The hero paper must not independently follow or scale with scroll"
            print(name, "headless scroll frame sample", frame_report)
        for section in SECTIONS:
            page.locator(f"#{section}").evaluate("e => window.scrollTo({top:e.getBoundingClientRect().top + scrollY - 64,behavior:'instant'})")
            page.wait_for_timeout(450)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"{name}/{section}: horizontal overflow"
            if name != "small":
                page.screenshot(path=f"/tmp/garden-{name}-{section}.png")
        page.locator(".v2-artifact button").first.click()
        assert page.locator(".v2-artifact.is-open").count() == 1
        page.locator("#rsvp input[value='yes']").check()
        page.locator(".v2-spine").get_by_role("button", name="Bahasa Indonesia", exact=True).click()
        page.wait_for_timeout(500)
        assert page.locator("html").get_attribute("lang") == "id"
        assert page.locator("#rsvp input[value='yes']").is_checked()
        assert page.locator("#details").inner_text().find("Pandiga") >= 0
        page.locator(".v2-spine").get_by_role("button", name="English", exact=True).click()
        page.emulate_media(reduced_motion="reduce")
        page.wait_for_timeout(300)
        assert page.locator(".v2-grand-portal").evaluate("e => getComputedStyle(e).translate") == "none"
        assert not errors, f"{name}: {errors}"
        print(name, "PASS: opening, eight rooms and RSVP anchor, canvas, width, archive, EN/ID, form state, reduced motion")
        context.close()

    # Context loss must reveal the static fallback while leaving real controls intact.
    page = browser.new_page(viewport={"width":390,"height":844}, reduced_motion="reduce")
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
    page.get_by_role("button", name="Open the invitation", exact=True).click()
    page.locator(".has-garden-renderer").wait_for(timeout=15000)
    page.locator(".v2-garden-background canvas").evaluate("c => c.dispatchEvent(new Event('webglcontextlost', {cancelable:true}))")
    assert page.locator(".has-garden-renderer").count() == 0
    assert page.locator("#the-day h1").is_visible()
    assert page.get_by_role("button", name="Info", exact=True).is_visible()
    assert page.locator("#details a[href*='maps.app.goo.gl']").count() >= 1
    page.screenshot(path="/tmp/garden-fallback.png")
    print("PASS: WebGL loss fallback; invitation and directions remain available")
    browser.close()
