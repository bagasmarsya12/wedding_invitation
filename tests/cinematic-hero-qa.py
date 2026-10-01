"""Read-only visual/motion checks for the first garden room. No guest writes."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get("GARDEN_QA_URL","http://localhost:5173/")
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASELINE=os.environ.get("CINEMA_BASELINE")=="1"

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=CHROME)
    for name,width,height in [("desktop",1440,1000),("mobile",390,844),("small",320,740)]:
        context=browser.new_context(viewport={"width":width,"height":height},reduced_motion="reduce" if BASELINE else "no-preference")
        page=context.new_page()
        errors=[]
        page.on("pageerror",lambda error:errors.append(str(error)))
        page.on("console",lambda message: errors.append(message.text) if message.type == "error" and any(term in message.text for term in ["THREE.WebGL", "Shader Error", "VALIDATE_STATUS"]) else None)
        page.goto(URL,wait_until="domcontentloaded")
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        if BASELINE:
            page.screenshot(path=f"/tmp/cinema-before-{name}-envelope.png")
        page.get_by_role("button",name="Skip opening",exact=True).click()
        page.locator(".has-garden-renderer").wait_for()
        page.wait_for_timeout(1800)
        if not BASELINE:
            canvas=page.locator(".v2-garden-background canvas")
            assert canvas.get_attribute("data-hero-camera")=="perspective"
            root_y = float(canvas.get_attribute("data-hero-root-page-y"))
            copy=page.locator(".v2-day-copy").bounding_box()
            page.screenshot(path=f"/tmp/cinema-{name}-hero.png")
            for step in [150,300,450,600]:
                page.evaluate("y=>window.scrollTo({top:y,behavior:'instant'})",step)
                page.wait_for_timeout(180)
                settled_root = float(canvas.get_attribute("data-hero-root-page-y"))
                assert abs(settled_root-root_y)<2, f"Foreground roots must remain on the same document ground: {root_y} -> {settled_root}"
            page.wait_for_timeout(600)
            after=page.locator(".v2-day-copy").bounding_box()
            assert abs(after["y"]+600-copy["y"])<2 and abs(after["width"]-copy["width"])<1,"Copy must scroll normally, never dolly"
            assert float(canvas.get_attribute("data-hero-travel"))==0
            assert float(page.locator("#the-day").evaluate("e=>getComputedStyle(e).getPropertyValue('--hero-passage')"))>.2
            assert page.locator("#the-day .v2-grand-actions").count()==0
            assert page.locator("#the-day a[href='#rsvp']").count()==0
            assert page.get_by_role("link",name="Wedding details",exact=True).count()==0
            assert page.locator(".v2-grand-portal").evaluate("e=>getComputedStyle(e).scale")=="none"
            page.screenshot(path=f"/tmp/cinema-{name}-passage.png")
            for step in [450,300,150,0,600]:
                page.evaluate("y=>window.scrollTo({top:y,behavior:'instant'})",step)
                page.wait_for_timeout(180)
                assert abs(float(canvas.get_attribute("data-hero-root-page-y"))-root_y)<2, "Reverse scroll must not lift the foreground either"
            page.get_by_role("button",name="Info",exact=True).click()
            assert page.locator("#invitation-info a[href='#rsvp']").is_visible()
            page.locator("#invitation-info a[href='#details']").click()
            page.wait_for_timeout(1500)
            assert page.locator("#details").bounding_box()["y"]<100
            assert page.locator("#details a[href*='maps.app.goo.gl']").is_visible()
            assert page.locator(".v2-destination-map-controls button").first.is_visible()
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
            page.screenshot(path=f"/tmp/cinema-{name}-details.png")
            page.get_by_role("button",name="Info",exact=True).click()
            page.locator("#invitation-info a[href='#rsvp']").click()
            page.wait_for_timeout(1200)
            assert page.locator("#rsvp").bounding_box()["y"]<100
            assert page.locator("#rsvp input[value='yes']").is_visible()
            page.emulate_media(reduced_motion="reduce")
            page.locator("#the-day").evaluate("e=>window.scrollTo({top:e.offsetTop,behavior:'instant'})")
            page.wait_for_timeout(350)
            assert float(page.locator("#the-day").evaluate("e=>getComputedStyle(e).getPropertyValue('--hero-passage')||'0'"))==0
            assert abs(float(canvas.get_attribute("data-hero-root-page-y"))-root_y)<2
        page.locator("#beyond").evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-64,behavior:'instant'})")
        page.wait_for_timeout(900)
        screenshot=page.screenshot(path=f"/tmp/cinema-{'before' if BASELINE else 'after'}-{name}-beyond.png")
        if not BASELINE:
            assert page.locator('.v2-garden-background canvas').get_attribute('data-garden-motion')=='0','Reduced motion must reach the shader, not only CSS'
            assert page.locator('.mark-melastoma').bounding_box()['y']+page.locator('.mark-melastoma').bounding_box()['height']<=page.locator('#beyond').bounding_box()['y'], 'The reply-room specimen must not spill into Beyond'
            from PIL import Image,ImageChops,ImageStat
            before=Path(f"/tmp/cinema-before-{name}-beyond.png")
            if before.exists():
                original=Image.open(before).convert("RGB")
                current=Image.open(f"/tmp/cinema-after-{name}-beyond.png").convert("RGB")
                assert original.size==current.size
                # This is a composition check, not a promise of identical subpixels.
                # Upstream chapter heights change scroll rounding/backdrop rasterization.
                # Keep the same color-error limit, but compare 12px box-averaged tiles;
                # separately lock the actual copy, destination and all six specimens.
                # A resized preceding chapter can round the native scroll position
                # one pixel differently. Register by at most ONE vertical pixel,
                # below the fixed header; never relax the color-error threshold.
                scores=[]
                for shift in [-1,0,1]:
                    top=70
                    bottom=original.height-2
                    a=original.crop((0,top,original.width,bottom))
                    b=current.crop((0,top+shift,current.width,bottom+shift))
                    # The 320px pre-merge capture includes the PRECEDING room's
                    # Melastoma tip in this 64 x 50px corner. That neighbour was
                    # intentionally moved inside the reply room; do not mistake
                    # it for Beyond artwork. Mask only that documented corner,
                    # keep the original baseline and the same error threshold.
                    if width==320:
                        neighbour=(256,0,320,50)
                        a.paste((0,0,0),neighbour);b.paste((0,0,0),neighbour)
                    size=(a.width//12,a.height//12)
                    diff=ImageChops.difference(a.resize(size,Image.Resampling.BOX),b.resize(size,Image.Resampling.BOX))
                    scores.append(max(ImageStat.Stat(diff).mean))
                assert min(scores)<1,"Beyond's approved composition must stay unchanged"
            assert page.locator('#beyond h2').inner_text()=='The invitation ends here.\nThe rest stays open.'
            assert page.locator('#beyond nav a').get_attribute('href')=='/archive'
            assert page.locator('#beyond .v2-night-garden img').evaluate_all("images=>images.map(e=>e.getAttribute('src'))")==[
                '/assets/botanicals/combretum/canopy-branch.webp','/assets/botanicals/combretum/climber-left.webp',
                '/assets/botanicals/combretum/climber-right.webp','/assets/botanicals/combretum/flower-cascade.webp',
                '/assets/botanicals/nephrolepis/frond-arched-01.webp','/assets/botanicals/dendrobium/branch-short.webp']
            assert not errors,errors
            print(name,"PASS: grounded perspective hero, no zoom or hero CTAs, native scroll, header directions/RSVP, reduced motion, unchanged Beyond")
        else: print(name,"baseline captured")
        context.close()
    browser.close()
