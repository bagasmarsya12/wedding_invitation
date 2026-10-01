"""Read-only archive table QA. Featured fixtures are browser-local; no guest writes."""
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get('GARDEN_QA_URL', 'http://localhost:5173/')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
SECTIONS = ['the-day','details','profiles','archive','rsvp','useful-bits','gifts','leave-a-mark','beyond']

def enter(page):
    page.goto(URL, wait_until='domcontentloaded')
    page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
    page.get_by_role('button', name='Skip opening', exact=True).click()
    page.locator('.has-entered').wait_for()
    page.locator('#archive').evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-80,behavior:'instant'})")
    page.wait_for_timeout(1000)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    for name,w,h,dpr in [('desktop',1440,1100,1),('tablet',820,1180,2),('mobile',390,844,3),('small',320,740,3)]:
        context = browser.new_context(viewport={'width':w,'height':h},device_scale_factor=dpr)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e:errors.append(str(e)))
        # An empty collection keeps the honest authored placeholders deterministic.
        page.route('**/api/archive?featured=1',lambda route:route.fulfill(json={'entries':[]}))
        enter(page)
        section = page.locator('#archive')
        field = section.locator('.archive-table-field')
        cards = section.locator('.archive-piece')
        assert [page.locator('#'+s).count() for s in SECTIONS] == [1]*9
        assert cards.count()==3
        assert section.locator('[data-garden-depth]').count()==0
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert cards.locator('.archive-piece-note[inert]').count()==3
        assert section.get_by_role('link',name='Open this story',exact=True).count()==0
        if w<1001:
            assert field.evaluate('e=>e.scrollWidth>e.clientWidth')
            # Native horizontal swipe retains the page's vertical reading position.
            field.evaluate("e=>e.scrollTo({left:e.scrollWidth,behavior:'instant'})")
            page.wait_for_timeout(200)
            assert field.evaluate('e=>e.scrollLeft>0')
            field.evaluate("e=>e.scrollTo({left:0,behavior:'instant'})")
        else:
            assert field.evaluate('e=>e.scrollWidth<=e.clientWidth')
        page.screenshot(path=f'/tmp/archive-{name}-en.png')
        first=cards.nth(0)
        toggle=first.locator('.archive-piece-toggle')
        toggle.click()
        page.wait_for_timeout(800)
        assert toggle.get_attribute('aria-expanded')=='true'
        assert section.locator('.archive-piece.is-open').count()==1
        assert first.locator('.archive-piece-note').get_attribute('inert') is None
        assert first.get_by_role('link',name='Open this story',exact=True).get_attribute('href')=='/archive/the-mark'
        assert first.locator('.archive-note-scroll').bounding_box()['y']>=first.locator('h3').bounding_box()['y']+first.locator('h3').bounding_box()['height']
        first.screenshot(path=f'/tmp/archive-{name}-open.png')
        toggle.focus()
        toggle.press('Escape')
        assert section.locator('.archive-piece.is-open').count()==0
        assert toggle.evaluate('e=>e===document.activeElement')
        toggle.press('ArrowRight')
        page.wait_for_timeout(600)
        second=cards.nth(1).locator('.archive-piece-toggle')
        assert second.evaluate('e=>e===document.activeElement')
        second.press('Enter')
        assert section.locator('.archive-piece.is-open').count()==1
        toggle.click()
        assert section.locator('.archive-piece.is-open').count()==1
        assert second.get_attribute('aria-expanded')=='false'
        # The selected card is stationary on scroll after its lift has settled.
        page.wait_for_timeout(800)
        before=first.evaluate('e=>e.getBoundingClientRect().top+scrollY')
        page.evaluate("window.scrollBy({top:160,behavior:'instant'})")
        page.wait_for_timeout(700)
        assert abs(first.evaluate('e=>e.getBoundingClientRect().top+scrollY')-before)<1
        page.locator('.v2-spine').get_by_role('button',name='Bahasa Indonesia',exact=True).click()
        first.get_by_text('Sedikit cerita',exact=True).wait_for()
        assert 'Sedikit cerita' in first.text_content()
        assert 'tulang rusuk' in first.inner_text()
        assert toggle.get_attribute('aria-label').startswith('Letakkan kembali')
        assert section.get_by_role('link',name='Buka arsip',exact=True).get_attribute('href')=='/archive'
        if w<1001:
            section.locator('.archive-table-footer').scroll_into_view_if_needed()
            before_y=page.evaluate('scrollY')
            section.get_by_role('button',name='Fragmen berikutnya',exact=True).click()
            page.wait_for_timeout(700)
            assert field.evaluate('e=>e.scrollLeft>0')
            assert abs(page.evaluate('scrollY')-before_y)<1
        page.emulate_media(reduced_motion='reduce')
        # The cover becomes a text-reading region while open. Use the visible
        # footer action to close it, rather than clicking through readable text.
        toggle.locator('.archive-piece-action').click()
        toggle.locator('.archive-piece-action').click()
        assert first.locator('.archive-paper').evaluate("e=>getComputedStyle(e).transform")=='none'
        assert first.locator('.archive-paper').evaluate("e=>parseFloat(getComputedStyle(e).transitionDuration)")<=.00001
        page.wait_for_function("document.querySelector('.v2-garden-background canvas')!==null")
        page.locator('.v2-garden-background canvas').evaluate("c=>c.dispatchEvent(new Event('webglcontextlost',{cancelable:true}))")
        assert page.locator('.has-garden-renderer').count()==0
        # Only botanical rasters are resolution-capped; blank paper is code-native.
        # These are lazy static FALLBACK specimens; reveal them before decoding.
        for image in section.locator('.v2-near-field').all():
            image.scroll_into_view_if_needed()
            image.evaluate('e=>e.decode()')
            assert image.evaluate('e=>e.clientWidth*devicePixelRatio<=e.naturalWidth+1')
        assert toggle.is_visible()
        assert not errors,errors
        print(name,'PASS: grounded collection, one selected piece, keyboard/focus, sideways browse, EN/ID, reduced motion, sharp botanicals and fallback',flush=True)
        context.close()

    # A published photo and a long note must replace placeholders, keep real slugs
    # and remain readable. Simulate a failed second image without changing the DB.
    page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
    long_note='A browser-only QA excerpt. '*100
    title='A browser-only published photograph with a longer catalogue title'
    page.route('**/api/archive?featured=1',lambda r:r.fulfill(json={'entries':[
        {'slug':'qa-photo','type':'Photograph','title':title,'excerpt':long_note,'media_url':'/assets/15-paper-fiber-texture.webp'},
        {'slug':'qa-object','type':'Object','title':'QA object','excerpt':'Browser-only fixture, not a memory.','media_url':'/qa-missing-image.webp'}]}))
    page.route('**/qa-missing-image.webp',lambda r:r.fulfill(status=404,body=''))
    enter(page)
    card=page.locator('.archive-piece').nth(1)
    card.get_by_text(title,exact=True).wait_for()
    card.locator('.archive-piece-toggle').click()
    card.locator('.archive-piece-note').wait_for()
    assert card.locator('.archive-note-scroll').text_content()==long_note
    scroll=card.locator('.archive-note-scroll')
    assert scroll.evaluate('e=>e.scrollHeight>e.clientHeight')
    scroll.evaluate('e=>e.scrollTop=e.scrollHeight')
    assert scroll.evaluate('e=>e.scrollTop>0')
    assert card.get_by_role('link',name='Open this story',exact=True).get_attribute('href')=='/archive/qa-photo'
    assert scroll.bounding_box()['y']>=card.locator('h3').bounding_box()['y']+card.locator('h3').bounding_box()['height']
    card.screenshot(path='/tmp/archive-long-note.png')
    broken=page.locator('.archive-piece').nth(2)
    broken.scroll_into_view_if_needed()
    broken.get_by_text('Image unavailable.',exact=True).wait_for()
    assert broken.locator('.archive-piece-visual img').count()==0
    broken.locator('.archive-piece-toggle').click()
    assert broken.get_by_role('link',name='Open this story',exact=True).get_attribute('href')=='/archive/qa-object'
    print('PASS: real featured entries, exact story links, long-note scroll, long-title spacing and missing-image fallback',flush=True)
    browser.close()
