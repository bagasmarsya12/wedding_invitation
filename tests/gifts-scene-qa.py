"""Read-only public scene checks; optional private HTML comes only from an
isolated integration Worker. All browser gift mutations are intercepted.
"""
import os
import copy
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

URL=os.environ.get('GARDEN_QA_URL','http://localhost:5173/').rstrip('/')
BASELINE=os.environ.get('GIFT_BASELINE')=='1'
TOKEN=os.environ.get('GIFT_QA_TOKEN','')
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

def enter(page):
    page.goto(URL+'/',wait_until='domcontentloaded')
    try: page.wait_for_load_state('networkidle',timeout=4000)
    except PlaywrightTimeout: pass # External map tiles can keep networking alive.
    page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
    page.get_by_role('button',name='Skip opening',exact=True).click()
    page.locator('#gifts').evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-80,behavior:'instant'})")
    page.wait_for_timeout(750)

def paper_bounds(page):
    return page.locator('#gifts .v2-gifts-heading, #gifts .gift-niche').evaluate_all("""nodes=>nodes.map(e=>{
      const r=e.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height};})""")

def private_setup(browser,w=390,h=844,enabled=True,fail_read=False,fail_action=False,delay=False):
    context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=3 if w<1000 else 1,reduced_motion='reduce')
    page=context.new_page(); calls=[]; errors=[]; pending=[]
    config={'fail_read':fail_read,'fail_action':fail_action}
    catalogue=[
      {'id':'browser-home','title':'Browser fixture — a long object title to check wrapping, not a real wishlist entry','description':'Browser fixture only. No personal story or product recommendation.','category':'home','imageUrl':'/assets/botanicals/melastoma/branch-short.webp','priceLabel':'Fixture price label','status':'available','reservedByYou':False,'purchaseUrl':None,'shippingRequired':True},
      {'id':'browser-held','title':'Held browser fixture','description':None,'category':'home','imageUrl':'/gifts-qa-missing-photo.webp','priceLabel':None,'status':'reserved','reservedByYou':False,'purchaseUrl':None,'shippingRequired':False},
      {'id':'browser-bagas','title':'Bagas browser fixture','description':'A category fixture.','category':'bagas','imageUrl':None,'priceLabel':None,'status':'available','reservedByYou':False,'purchaseUrl':None,'shippingRequired':False},
    ]
    page.route('**/gifts-qa-missing-photo.webp',lambda route:route.fulfill(status=404,body='Missing browser fixture'))
    def result():
        shipping='PRIVATE BROWSER FIXTURE ADDRESS' if any(g['shippingRequired'] and g['reservedByYou'] and g['status'] in ['reserved','purchased'] for g in catalogue) else None
        return {'gifts':copy.deepcopy(catalogue),'enabled':enabled,'shippingInstructions':shipping,'cashGiftDetails':'PRIVATE BROWSER FIXTURE CASH DETAILS'}
    def route_gifts(route):
        if route.request.method=='GET':
            if delay and not pending: pending.append(route);return
            if config['fail_read']:route.fulfill(status=503,json={'error':'Gifts are temporarily unavailable. Please try again.'});return
            route.fulfill(json=result());return
        body=route.request.post_data_json;calls.append(body)
        if config['fail_action']:
            route.fulfill(status=409,json={'error':'This gift changed while you were viewing it. Please refresh and try again.'});return
        gift=next(g for g in catalogue if g['id']==body['giftId'])
        action=body['action']
        if action=='reserve':gift.update(status='reserved',reservedByYou=True,purchaseUrl='https://example.com/browser-fixture-only')
        elif action=='release':gift.update(status='available',reservedByYou=False,purchaseUrl=None)
        elif action=='purchased':gift.update(status='purchased')
        route.fulfill(json=result())
    page.route('**/api/invite/*/gifts',route_gifts)
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(f'{URL}/invite/{TOKEN}/gifts?collection=home',wait_until='domcontentloaded')
    if delay:
        for _ in range(200):
            if pending:break
            page.wait_for_timeout(25)
        assert pending,'The actual client must request its private catalogue'
        assert page.locator('.gift-loading').is_visible() and page.locator('.empty-catalogue').count()==0
        pending[0].fulfill(json=result())
    if fail_read:page.get_by_role('button',name='Try again',exact=True).wait_for()
    else:page.locator('.gift-card').first.wait_for()
    return context,page,calls,config,errors

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=CHROME)
    for name,w,h in [('desktop',1440,1000),('tablet',820,1180),('mobile',390,844),('small',320,740)]:
        context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if w<1000 else 1)
        page=context.new_page()
        errors=[]; private_requests=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:private_requests.append(request.url) if '/api/invite/' in request.url and '/gifts' in request.url else None)
        enter(page)
        page.screenshot(path=f'/tmp/gifts-{"before" if BASELINE else "after"}-{name}.png')
        if BASELINE:
            print(name,'BEFORE:',page.locator('#gifts').inner_text(),flush=True)
        else:
            assert page.locator('.v2-scene[data-light]').count()==8
            assert page.locator('#rsvp').count()==1
            shelf=page.locator('.gift-collection-shelf')
            assert shelf.locator('article').count()==3 and shelf.locator('img').count()==0
            assert [link.get_attribute('href') for link in shelf.locator('a').all()]==['/gifts?collection=bagas','/gifts?collection=iga','/gifts?collection=home']
            assert shelf.locator('h3').all_text_contents()==['For Bagas','For Iga','For Our Home']
            before=paper_bounds(page);start=page.evaluate('scrollY')
            initial=page.locator('#gifts').evaluate("e=>e.style.getPropertyValue('--gift-light-shift')")
            for offset in [120,240,0]:
                page.evaluate("y=>window.scrollTo({top:y,behavior:'instant'})",start+offset);page.wait_for_timeout(650)
                for a,b in zip(before,paper_bounds(page)):
                    assert all(abs(a[key]-b[key])<1 for key in a),(name,a,b)
                light=page.locator('#gifts').evaluate("e=>e.style.getPropertyValue('--gift-light-shift')")
                assert light and abs(float(light.removesuffix('px'))) <= (8 if w<721 else 16)
                if offset==240:assert light!=initial,'Light should move, not the display or words'
            if w<721:
                assert shelf.evaluate('e=>e.scrollWidth>e.clientWidth')
                scroll=page.evaluate('scrollY')
                shelf.evaluate("e=>e.scrollTo({left:e.scrollWidth,behavior:'instant'})")
                page.wait_for_timeout(250)
                assert abs(page.evaluate('scrollY')-scroll)<1
                link=shelf.locator('a').last.bounding_box();box=shelf.bounding_box()
                assert link['x']>=box['x']-1 and link['x']+link['width']<=box['x']+box['width']+1
            else:
                boxes=shelf.locator('article').all()
                assert boxes[0].bounding_box()['x']<boxes[1].bounding_box()['x']<boxes[2].bounding_box()['x']
            page.locator('.v2-spine').get_by_role('button',name='Bahasa Indonesia',exact=True).click()
            assert shelf.locator('h3').all_text_contents()==['Untuk Bagas','Untuk Iga','Untuk Rumah Kami']
            assert shelf.locator('.gift-niche-ticket').first.inner_text()=='Masih memilih.'
            page.screenshot(path=f'/tmp/gifts-after-{name}-id.png')
            page.emulate_media(reduced_motion='reduce');page.wait_for_timeout(200)
            assert page.locator('.gift-niche-shadow').first.evaluate("e=>getComputedStyle(e).translate")=='none'
            assert page.locator('.gift-niche-ticket').first.evaluate("e=>getComputedStyle(e).transitionDuration")=='0s'
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            assert not private_requests and not errors,(private_requests,errors)
            print(name,'PASS: three honest collection mounts, native browse, grounded displays, bounded light, EN/ID, reduced motion, no private requests or overflow',flush=True)
        context.close()

    if not BASELINE:
        # Public gate stays useful and does not request private catalogue data.
        page=browser.new_page(viewport={'width':320,'height':740})
        requests=[]
        page.on('request',lambda request:requests.append(request.url) if '/api/invite/' in request.url else None)
        page.goto(URL+'/gifts?collection=home',wait_until='domcontentloaded')
        try:page.wait_for_load_state('networkidle',timeout=4000)
        except PlaywrightTimeout:pass
        page.get_by_role('heading',name='Open this from your personal invitation.',exact=True).wait_for()
        header=page.locator('.product-header').bounding_box()
        brand=page.locator('.gate-brand').bounding_box();language=page.locator('.language-switch').bounding_box()
        assert header['width']==320 and brand['x']+brand['width']<=language['x'],'The public gate header must not collapse around its language switch'
        page.get_by_role('button',name='Bahasa Indonesia',exact=True).click()
        page.get_by_role('heading',name='Buka dari undangan pribadimu, ya.',exact=True).wait_for()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth') and not requests
        page.screenshot(path='/tmp/gifts-gate-small.png');page.close()

    if TOKEN and not BASELINE:
        for name,w,h in [('desktop',1440,1000),('tablet',820,1180),('mobile',390,844),('small',320,740)]:
            context,page,calls,config,errors=private_setup(browser,w,h,delay=name=='small')
            assert page.get_by_role('tab',name='For Our Home',exact=True).get_attribute('aria-selected')=='true'
            assert page.locator('[role=tabpanel]').get_attribute('aria-labelledby')=='gift-tab-home'
            assert page.locator('.gift-card').count()==2
            assert page.locator('.private-note').count()==0
            assert page.get_by_role('link',name='Open purchase link',exact=True).count()==0
            photo=page.locator('.gift-image img').first
            photo.scroll_into_view_if_needed();photo.evaluate('e=>e.decode()')
            page.wait_for_timeout(100)
            assert photo.evaluate('e=>e.getBoundingClientRect().width*devicePixelRatio<=e.naturalWidth+1'),'Photos cannot exceed native density'
            assert photo.evaluate("e=>Math.abs(e.getBoundingClientRect().bottom-e.parentElement.querySelector('.gift-display-plinth').getBoundingClientRect().top)<=4"),'Objects rest on the display, never float in its centre'
            page.get_by_text('Image unavailable.',exact=True).wait_for()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.get_by_role('tab',name='For Our Home',exact=True).focus()
            page.keyboard.press('ArrowLeft')
            page.get_by_role('heading',name='A little space, for now.',exact=True).wait_for()
            assert page.get_by_role('tab',name='For Iga',exact=True).get_attribute('aria-selected')=='true'
            assert page.locator('.gift-card').count()==0
            page.keyboard.press('Home')
            assert page.get_by_role('tab',name='For Bagas',exact=True).get_attribute('aria-selected')=='true'
            page.keyboard.press('End')
            page.locator('.gift-card').first.wait_for()
            page.locator('.product-header').get_by_role('button',name='Bahasa Indonesia',exact=True).click()
            page.get_by_role('tab',name='Untuk Rumah Kami',exact=True).wait_for()
            page.get_by_role('button',name='Pilih hadiah ini',exact=True).wait_for()
            assert page.get_by_text('Gambar belum tersedia.',exact=True).is_visible()
            assert page.locator('.gift-card h2').first.inner_text().startswith('Browser fixture')
            assert page.locator('.gift-card-caption').first.bounding_box()['width']>=w*.65 if w<721 else True
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.locator('#gift-catalogue').scroll_into_view_if_needed();page.screenshot(path=f'/tmp/gifts-catalogue-{name}.png')
            assert not calls and not errors,(calls,errors)
            print(name,'PASS: category deep link, keyboard tabs, honest empty/error images, source-density cap, private catalogue and bilingual responsive layout',flush=True)
            context.close()

        # Existing API contract, private delivery information, and duplicate-click guard.
        context,page,calls,config,errors=private_setup(browser)
        page.get_by_role('button',name='Reserve quietly',exact=True).evaluate('e=>{e.click();e.click();}')
        page.get_by_text('Reserved for you.',exact=True).wait_for()
        assert calls==[{'giftId':'browser-home','action':'reserve','surprise':True}]
        assert page.locator('.private-note').inner_text().find('PRIVATE BROWSER FIXTURE ADDRESS')>=0
        assert page.get_by_role('link',name='Open purchase link',exact=True).get_attribute('href')=='https://example.com/browser-fixture-only'
        assert page.get_by_text('Held for you',exact=True).is_visible()
        page.get_by_role('button',name='Release',exact=True).click()
        page.get_by_text('Reservation released.',exact=True).wait_for()
        assert page.locator('.private-note').count()==0
        page.get_by_role('button',name='Reserve quietly',exact=True).click()
        page.get_by_role('button',name='I’ve bought it',exact=True).click()
        page.get_by_text('Marked as purchased.',exact=True).wait_for()
        assert page.get_by_text('Purchased by you',exact=True).is_visible()
        assert [body['action'] for body in calls]==['reserve','release','reserve','purchased']
        assert page.get_by_role('button',name='Release',exact=True).count()==0
        page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Fixture denial')}}})")
        page.get_by_role('button',name='Copy details',exact=True).click()
        page.get_by_text('Copy unavailable. Select the details above to copy them.',exact=True).wait_for()
        assert not errors,errors
        context.close()

        context,page,calls,config,errors=private_setup(browser,enabled=False)
        assert page.get_by_role('button',name='Reserve quietly',exact=True).is_disabled()
        assert not calls and not errors
        context.close()
        context,page,calls,config,errors=private_setup(browser,fail_read=True)
        assert page.locator('.empty-catalogue').count()==0
        config['fail_read']=False
        page.get_by_role('button',name='Try again',exact=True).click()
        page.locator('.gift-card').first.wait_for()
        config['fail_action']=True
        page.get_by_role('button',name='Reserve quietly',exact=True).click()
        page.get_by_text('This gift changed while you were viewing it. Please refresh and try again.',exact=True).wait_for()
        assert page.locator('.private-note').count()==0
        page.get_by_role('button',name='Refresh the collection',exact=True).click()
        page.locator('.gift-card').first.wait_for()
        config['fail_action']=False
        page.get_by_role('button',name='Reserve quietly',exact=True).click()
        page.get_by_text('Reserved for you.',exact=True).wait_for()
        assert len(calls)==2 and not errors
        context.close()
        print('PASS: unchanged reservation payload, release/purchase, owner-only delivery, double-click guard, closed state, failed-load retry, conflict refresh and clipboard fallback; all browser writes intercepted',flush=True)
    browser.close()
