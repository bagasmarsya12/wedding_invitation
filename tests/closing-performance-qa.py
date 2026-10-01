"""Read-only closing checks and cold production loading samples; no guest writes."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("GARDEN_QA_URL", "http://localhost:5173/")
LABEL = os.environ.get("PERF_LABEL", "after")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SAMPLES = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    for name, width, height in [("desktop", 1440, 1000), ("mobile", 390, 844), ("small", 320, 740)]:
        context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=2 if width < 721 else 1)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.add_init_script("""
            window.qaLongTasks=[];window.qaShifts=[];
            new PerformanceObserver(list=>list.getEntries().forEach(e=>qaLongTasks.push({start:e.startTime,duration:e.duration}))).observe({type:'longtask',buffered:true});
            new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(!e.hadRecentInput)qaShifts.push(e.value)})).observe({type:'layout-shift',buffered:true});
        """)
        cdp = context.new_cdp_session(page)
        cdp.send("Performance.enable")

        def sample(stage):
            value = page.evaluate("""()=>({
                js:performance.getEntriesByType('resource').filter(e=>new URL(e.name).origin===location.origin&&new URL(e.name).pathname.endsWith('.js')).map(e=>({file:new URL(e.name).pathname,bytes:e.decodedBodySize})),
                longTasks:qaLongTasks.length,longTaskMs:Math.round(qaLongTasks.reduce((a,e)=>a+e.duration,0)),
                layoutShift:qaShifts.reduce((a,e)=>a+e,0),
                garden:document.querySelector('.v2-garden-background canvas')?.dataset.gardenChapters||null
            })""")
            metrics = {e["name"]: e["value"] for e in cdp.send("Performance.getMetrics")["metrics"]}
            value["heapMB"] = round(metrics.get("JSHeapUsedSize", 0) / 1048576, 2)
            value["jsBytes"] = sum(item["bytes"] for item in value["js"])
            value["stage"] = stage
            return value

        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        page.wait_for_timeout(1500)
        stages = [sample("envelope")]
        page.get_by_role("button", name="Skip opening", exact=True).click()
        page.locator(".has-garden-renderer").wait_for()
        page.wait_for_timeout(5000)
        stages.append(sample("hero-idle-5s"))
        if LABEL != "before":
            assert page.locator(".reply-studio").count() == 0, "Far-away editor should not mount during the hero"
            assert not any("mark-editor-" in item["file"] for item in stages[-1]["js"])
            assert int(stages[-1]["garden"]) < 8, "Do not construct every offscreen garden"
        page.locator("#rsvp").evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-100,behavior:'instant'})")
        page.locator("#rsvp input[value='yes']").wait_for()
        page.wait_for_timeout(800)
        stages.append(sample("reply"))
        page.locator("#rsvp textarea").fill("Unsaved browser-only draft")
        page.locator(".v2-footer").evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-100,behavior:'instant'})")
        page.wait_for_timeout(900)
        page.screenshot(path=f"/tmp/closing-{LABEL}-{name}.png", full_page=False)
        if LABEL != "before":
            assert page.get_by_role("heading", name="See you in Cimahi.", exact=True).is_visible()
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
            light = page.locator(".v2-footer").evaluate("e=>parseFloat(getComputedStyle(e).getPropertyValue('--closing-light-shift'))")
            assert abs(light) <= 16
            for image in page.locator(".v2-closing-botanical").all():
                assert image.evaluate("e=>e.getBoundingClientRect().width*devicePixelRatio<=e.naturalWidth+1"), "Never enlarge a cutout beyond its native pixels"
            page.get_by_role("button", name="Bahasa Indonesia", exact=True).click()
            assert page.get_by_role("heading", name="Sampai ketemu di Cimahi.", exact=True).is_visible()
            page.get_by_role("button", name="English", exact=True).click()
            page.emulate_media(reduced_motion="reduce")
            page.wait_for_timeout(120)
            assert page.locator(".v2-footer").evaluate("e=>getComputedStyle(e).getPropertyValue('--closing-light-shift').trim()") in ["", "0px"]
            assert page.locator(".v2-closing-light").evaluate("e=>getComputedStyle(e).transitionDuration") == "0s"
        page.locator("#rsvp").scroll_into_view_if_needed()
        assert page.locator("#rsvp textarea").input_value() == "Unsaved browser-only draft", "Do not unmount the editor on exit"
        page.get_by_role("button", name="View the envelope again", exact=True).click()
        page.locator(".v2-opening").wait_for()
        page.get_by_role("button", name="Skip opening", exact=True).click()
        page.locator(".has-garden-renderer").wait_for()
        assert not errors, errors
        SAMPLES.append({"viewport": name, "stages": stages})
        print(name, LABEL, [(s["stage"], s["jsBytes"], s["longTaskMs"], s["heapMB"]) for s in stages], "PASS")
        context.close()
    if LABEL != "before":
        context = browser.new_context(viewport={"width":390,"height":844}, reduced_motion="reduce")
        page = context.new_page()
        page.route("**/mark-editor-*.js", lambda route: route.abort())
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        page.get_by_role("button", name="Skip opening", exact=True).click()
        page.locator("#rsvp").scroll_into_view_if_needed()
        page.get_by_text("The reply paper could not be loaded.", exact=True).wait_for()
        page.unroute("**/mark-editor-*.js")
        with page.expect_navigation(wait_until="domcontentloaded"):
            page.get_by_role("button", name="Reload the invitation", exact=True).click()
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        page.get_by_role("button", name="Skip opening", exact=True).click()
        page.locator("#rsvp").scroll_into_view_if_needed()
        page.locator(".reply-editor-slot.is-ready").wait_for(timeout=10000)
        print("PASS: reply module failure is recoverable without guest writes")
        context.close()
        context = browser.new_context(viewport={"width":390,"height":844}, reduced_motion="reduce")
        page = context.new_page()
        page.route("**/api/site-state", lambda route:route.fulfill(json={"phase":"post-wedding","rsvpEnabled":False,"marksEnabled":True,"giftsEnabled":True}))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        page.get_by_role("button", name="Skip opening", exact=True).click()
        page.get_by_role("heading", name="Thank you for being part of our day.", exact=True).wait_for()
        page.locator(".v2-footer").scroll_into_view_if_needed()
        page.get_by_role("button", name="Bahasa Indonesia", exact=True).click()
        assert page.get_by_role("heading", name="Terima kasih sudah menjadi bagian dari hari kami.", exact=True).is_visible()
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        print("PASS: bilingual post-wedding closing and reduced-motion layout")
        context.close()
    browser.close()

Path(f"/tmp/closing-performance-{LABEL}.json").write_text(json.dumps(SAMPLES, indent=2))
