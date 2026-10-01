"""Read-only Archive checks. Additional records exist only in the isolated Worker harness."""
import os
from playwright.sync_api import sync_playwright, TimeoutError

URL=os.environ.get('GARDEN_QA_URL','http://localhost:5173').rstrip('/')
FIXTURE=os.environ.get('ARCHIVE_FIXTURE')=='1'
KEY='bagas-iga:archive-position:v1'

def settle(page):
    try:page.wait_for_load_state('networkidle',timeout=4000)
    except TimeoutError:pass
    page.wait_for_function("document.documentElement.lang==='en'||document.documentElement.lang==='id'")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    for name,w,h in [('desktop',1440,1000),('tablet',820,1180),('mobile',390,844),('small',320,740)]:
        context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=3 if w<1000 else 1)
        page=context.new_page();errors=[];writes=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:writes.append(request.url) if request.method not in ['GET','HEAD'] and '/api/' in request.url else None)
        page.route('**/archive-fixture-missing.webp',lambda route:route.fulfill(status=404,body='Missing fixture'))
        page.goto(URL+'/archive',wait_until='domcontentloaded');settle(page)
        assert page.locator('.product-header').evaluate("e=>getComputedStyle(e).color")=='rgb(43, 41, 37)','Ivory header requires charcoal text, not inherited white'
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        if FIXTURE:
            assert page.locator('.collection-piece').count()==6
            assert 'SECRET ARCHIVE FIXTURE' not in page.locator('main').inner_text()
            assert set(page.locator('.collection-piece').evaluate_all("nodes=>nodes.map(e=>e.className.split(' ').find(c=>c.startsWith('material-')))") )=={'material-mark','material-photo','material-object','material-paper','material-audio'}
        mark=page.locator('.collection-piece[data-slug="the-mark"]')
        opener=mark.locator('.collection-open');region=mark.locator('.collection-context')
        assert opener.get_attribute('aria-expanded')=='false'
        assert region.get_attribute('inert') is not None and region.bounding_box()['height']<1
        opener.click();page.wait_for_timeout(110)
        interim=region.bounding_box()['height'];page.wait_for_timeout(650)
        final=region.bounding_box()['height']
        assert 0<interim<final-1,(name,interim,final)
        assert opener.get_attribute('aria-expanded')=='true' and region.get_attribute('inert') is None
        page.keyboard.press('Escape');page.wait_for_timeout(700)
        assert opener.evaluate('e=>e===document.activeElement') and opener.get_attribute('aria-expanded')=='false'
        page.get_by_role('button',name='mark',exact=True).click();opener.click();page.wait_for_timeout(700)
        photo=mark.locator('.collection-image');photo.evaluate('e=>e.decode()')
        density=photo.evaluate("e=>({width:e.getBoundingClientRect().width,dpr:devicePixelRatio,native:e.naturalWidth,cap:e.style.getPropertyValue('--archive-native-width'),max:getComputedStyle(e).maxWidth})")
        assert density['width']*density['dpr']<=density['native']+1,density
        mark.locator('.collection-story-link').click()
        page.wait_for_url('**/archive/the-mark');settle(page)
        assert page.locator('.collection-prose p').count()==3
        assert page.locator('.collection-prose').inner_text().startswith('One of our first conversations')
        assert page.locator('.collection-process').count()==1
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.get_by_role('button',name='Bahasa Indonesia',exact=True).click()
        page.get_by_role('heading',name='Simbol Kami',exact=True).wait_for()
        assert 'Salah satu percakapan pertama' in page.locator('.collection-prose').inner_text()
        page.screenshot(path=f'/tmp/archive-story-after-{name}.png',full_page=True)
        saved=page.evaluate('key=>JSON.parse(sessionStorage.getItem(key))',KEY)
        page.get_by_role('link',name='Kembali ke koleksi',exact=True).click()
        page.wait_for_url('**/archive');settle(page)
        page.wait_for_function("document.querySelector('.collection-open')?.getAttribute('aria-expanded')==='true'")
        assert abs(page.evaluate('scrollY')-saved['scroll'])<3,(name,saved,page.evaluate('scrollY'))
        assert page.get_by_role('button',name='simbol',exact=True).get_attribute('aria-pressed')=='true'
        assert page.locator('.collection-open').evaluate('e=>e===document.activeElement')
        page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(100)
        assert page.locator('.collection-sheet').first.evaluate("e=>getComputedStyle(e).transitionDuration")=='0s'
        assert page.locator('.collection-sheet').first.evaluate("e=>getComputedStyle(e).transform")=='none'
        page.get_by_role('button',name='semua',exact=True).click()
        assert page.locator('.collection-open[aria-expanded=true]').count()==0
        page.locator('#collection').scroll_into_view_if_needed()
        page.screenshot(path=f'/tmp/archive-collection-after-{name}.png',full_page=True)
        assert not errors and not writes,(errors,writes)
        print(name,'PASS: native filtering, smooth open/close, Escape, original mark, bilingual story, return position/focus, density cap, reduced motion and no overflow',flush=True)
        if FIXTURE:
            # Lazy media is intentionally not requested until its mount approaches the viewport.
            page.locator('.collection-piece[data-slug="fixture-conversation"]').scroll_into_view_if_needed()
            page.get_by_text('Gambar belum tersedia.',exact=True).wait_for()
            fixture_photo=page.locator('.collection-piece[data-slug="fixture-photo"] .collection-image')
            fixture_photo.scroll_into_view_if_needed();fixture_photo.evaluate('e=>e.decode()')
            assert fixture_photo.evaluate('e=>e.getBoundingClientRect().width*devicePixelRatio<=e.naturalWidth+1')
            audio=page.locator('audio')
            assert audio.count()==1 and audio.get_attribute('preload')=='none' and audio.get_attribute('autoplay') is None
            assert audio.evaluate('e=>e.paused')
            page.get_by_role('button',name='catatan',exact=True).click()
            note=page.locator('.collection-piece[data-slug="fixture-note"]')
            note.locator('.collection-open').click()
            note.locator('.collection-context').wait_for();page.wait_for_timeout(100)
            excerpt=note.locator('.collection-excerpt')
            assert excerpt.evaluate('e=>e.scrollHeight>e.clientHeight')
            note.locator('.collection-story-link').click();page.wait_for_url('**/archive/fixture-note');settle(page)
            assert page.locator('.collection-story-header h1').inner_text().startswith('Browser fixture')
            assert page.locator('.collection-prose p').count()==18
            assert 'Original fixture paragraph' in page.locator('.collection-prose').inner_text()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not errors and not writes,(errors,writes)
        context.close()
    # Storage denial must not block navigation or opening; direct story links work.
    context=browser.new_context(viewport={'width':390,'height':844})
    context.add_init_script("Object.defineProperty(window,'sessionStorage',{get(){throw new Error('Fixture denied')}})")
    page=context.new_page();page.goto(URL+'/archive');settle(page)
    page.locator('.collection-piece[data-slug="the-mark"] .collection-open').click()
    page.locator('.collection-piece[data-slug="the-mark"] .collection-story-link').click()
    page.wait_for_url('**/archive/the-mark');settle(page)
    assert page.locator('.collection-prose p').count()==3
    context.close()
    context=browser.new_context(viewport={'width':320,'height':740},java_script_enabled=False)
    page=context.new_page();page.goto(URL+'/archive',wait_until='load')
    page.locator('.collection-no-script').get_by_role('link',name='The Mark',exact=True).click()
    page.wait_for_url('**/archive/the-mark')
    assert page.locator('.collection-prose p').count()==3
    context.close();browser.close()
    print('PASS: storage denial and JavaScript-disabled story navigation; no real guest or archive writes',flush=True)
