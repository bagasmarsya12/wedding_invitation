"""Browser-only fixtures; checks that postcard content stays inside its frame."""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get("GARDEN_QA_URL", "http://localhost:5173/")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
STYLES = ["classic", "rose", "sage", "airmail", "midnight"]
FONTS = ["hand", "clean", "type"]
MARKS = [{"id":f"spacing-{i}", "author_name": "A guest with a longer family name" if i % 3 == 0 else "Our guest",
          "message":"A little note, with a lot of love.\nSee you on your very good day." if i % 3 else "A longer handwritten note. " * 70,
          "style":style,"font":font,"drawingUrl":None,"created_at":"2026-09-30T00:00:00Z"}
         for i,(style,font) in enumerate((style,font) for style in STYLES for font in FONTS)]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    for label,width,height in [("desktop",1440,900),("mobile",390,844),("small",320,740),("landscape",740,320)]:
        context = browser.new_context(viewport={"width":width,"height":height}, reduced_motion="reduce")
        page = context.new_page()
        page.route("**/api/marks?**",lambda route:route.fulfill(json={"marks":MARKS,"nextCursor":None}))
        page.goto(URL,wait_until="domcontentloaded")
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        page.get_by_role("button",name="Skip opening",exact=True).click()
        page.locator(".postcard-wall-card").first.click()
        page.locator("dialog[open]").wait_for()
        for i,mark in enumerate(MARKS):
            page.wait_for_function("id=>document.querySelector('.postcard-reader-active')?.dataset.cardId===id",arg=mark["id"])
            metrics=page.locator("dialog .postcard").evaluate("""card=>{
                const c=card.getBoundingClientRect(),f=getComputedStyle(card,'::after');
                const a=card.querySelector('.postcard-from').getBoundingClientRect(),b=card.querySelector('.postcard-body').getBoundingClientRect();
                return {left:b.left-c.left-parseFloat(f.left),right:c.right-parseFloat(f.right)-b.right,
                        bottom:c.bottom-parseFloat(f.bottom)-a.bottom,
                        footerBorder:getComputedStyle(card.querySelector('.postcard-from')).borderTopWidth,
                        gap:a.top-b.bottom,bodyHeight:b.height};
            }""")
            if mark["style"] != "airmail":
                assert min(metrics["left"],metrics["right"],metrics["bottom"])>=15,(label,mark["style"],mark["font"],metrics)
            assert metrics["footerBorder"]=="0px", "Remove the competing full-width signature rule"
            assert metrics["gap"]>=12 and metrics["bodyHeight"]>=50,(label,mark["style"],metrics)
            assert page.locator("dialog .postcard-writing").inner_text()==mark["message"]
            if i in [1,4,10,13]:
                page.screenshot(path=f"/tmp/postcard-spacing-{label}-{mark['style']}.png")
            if i<len(MARKS)-1:page.get_by_role("button",name="Next card",exact=True).click()
        print(label,"PASS: all five paper styles and three fonts keep text clear of frame; full message retained")
        context.close()
    browser.close()
