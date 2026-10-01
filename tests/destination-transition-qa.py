"""Read-only checks for the floor/paper transition. Never submits guest data."""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get("GARDEN_QA_URL", "http://localhost:5173/")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    for name, width, height in [("desktop",1440,1000),("mobile",390,844),("small",320,740)]:
        context = browser.new_context(viewport={"width":width,"height":height},reduced_motion="no-preference")
        page = context.new_page()
        errors = []
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.goto(URL,wait_until="domcontentloaded")
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        page.get_by_role("button",name="Skip opening",exact=True).click()
        page.locator(".has-garden-renderer").wait_for()
        page.get_by_role("button",name="Info",exact=True).click()
        page.locator("#invitation-info a[href='#details']").click()
        page.wait_for_timeout(1500)
        asset = page.request.get(URL.split("#")[0].rstrip("/")+"/assets/authored/destination-canopy-shadow.svg")
        assert asset.status == 200 and "<svg" in asset.text(), "The local scalable shadow must load"
        def measure():
            return page.evaluate("""() => {
              const nodes=['.v2-destination-page','.v2-destination-head','.v2-destination-card','.v2-destination-map-shell'];
              return nodes.map(selector=>{
                const node=document.querySelector(selector), box=node.getBoundingClientRect(),css=getComputedStyle(node);
                return {selector,x:box.x,y:box.y+scrollY,width:box.width,height:box.height,transform:css.transform};
              });
            }""")
        before = measure()
        initial = page.locator("#details").evaluate("e=>getComputedStyle(e).getPropertyValue('--destination-light-shift')")
        start = page.evaluate("scrollY")
        for offset in [100,250,350,100,0]:
            page.evaluate("y=>window.scrollTo({top:y,behavior:'instant'})",start+offset)
            page.wait_for_timeout(550)
            after = measure()
            for first,second in zip(before,after):
                for key in ["x","y","width","height"]:
                    assert abs(first[key]-second[key])<1,(name,first["selector"],key)
                assert second["transform"] == "none", "Paper, text and map must not float"
            shift = float(page.locator("#details").evaluate("e=>getComputedStyle(e).getPropertyValue('--destination-light-shift')").removesuffix("px"))
            assert abs(shift)<=(8 if width<721 else 16)
            if offset==350:
                assert page.locator("#details").evaluate("e=>getComputedStyle(e).getPropertyValue('--destination-light-shift')")!=initial
        shadow = page.locator(".v2-destination-page").evaluate("e=>{const s=getComputedStyle(e,'::after');return {pointerEvents:s.pointerEvents,background:s.backgroundImage,translate:s.translate}}")
        assert shadow["pointerEvents"] == "none" and "destination-canopy-shadow.svg" in shadow["background"]
        controls=page.locator(".v2-destination-map-controls")
        button=controls.get_by_role("button",name="Zoom in",exact=True)
        assert button.evaluate("e=>{const b=e.getBoundingClientRect();return e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))}"), "Decorative light must not intercept map controls"
        button.click()
        controls.get_by_role("button",name="Reset map",exact=True).click()
        page.locator("#details a[href*='maps.app.goo.gl']").scroll_into_view_if_needed()
        assert page.locator("#details a[href*='maps.app.goo.gl']").is_visible()
        page.emulate_media(reduced_motion="reduce")
        # Check rendered behavior, not deletion of an inert CSS-variable cache.
        # CSS suppresses the projection immediately even if a media-query event is delayed.
        page.wait_for_function("getComputedStyle(document.querySelector('.v2-destination-page'),'::after').translate === 'none'",timeout=3000)
        assert page.locator(".v2-destination-page").evaluate("e=>getComputedStyle(e,'::after').translate")=="none"
        page.evaluate("y=>window.scrollTo({top:y,behavior:'instant'})",start+200)
        page.wait_for_timeout(550)
        assert page.locator(".v2-destination-page").evaluate("e=>getComputedStyle(e,'::after').translate")=="none"
        assert page.locator("#details .v2-destination-light").evaluate("e=>getComputedStyle(e).translate")=="none"
        paused_shift=page.locator("#details").evaluate("e=>e.style.getPropertyValue('--destination-light-shift')")
        for first,second in zip(before,measure()):
            for key in ["x","y","width"]:
                assert abs(first[key]-second[key])<1,(name,'reduced',first['selector'],key)
        page.emulate_media(reduced_motion="no-preference")
        page.evaluate("y=>window.scrollTo({top:y,behavior:'instant'})",start+250)
        page.wait_for_function("previous=>{const value=document.querySelector('#details').style.getPropertyValue('--destination-light-shift');return value!=='' && value!==previous}",arg=paused_shift,timeout=3000)
        page.wait_for_function("getComputedStyle(document.querySelector('.v2-destination-page'),'::after').translate !== 'none'",timeout=3000)
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        assert not errors,errors
        print(name,"PASS: scalable asset, bounded light, stable paper/text/map, usable map controls, directions, reduced motion")
        context.close()
    browser.close()
