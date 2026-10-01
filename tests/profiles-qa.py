"""Read-only profile folio checks; no submissions or guest records."""
import os
from playwright.sync_api import sync_playwright

URL=os.environ.get('GARDEN_QA_URL','http://localhost:5173/')
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
SECTIONS=['the-day','details','profiles','archive','rsvp','useful-bits','gifts','leave-a-mark','beyond']

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=CHROME)
    for name,width,height,dpr in [('desktop',1440,1000,1),('tablet',820,1180,2),('mobile',390,844,3),('small',320,740,3)]:
        context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,reduced_motion='no-preference')
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' and 'THREE.WebGLProgram' in msg.text else None)
        page.goto(URL,wait_until='domcontentloaded')
        page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
        page.get_by_role('button',name='Skip opening',exact=True).click()
        page.locator('.has-garden-renderer').wait_for()
        assert [page.locator('#'+section).count() for section in SECTIONS]==[1]*9
        section=page.locator('#profiles')
        section.evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-64,behavior:'instant'})")
        page.wait_for_timeout(700)
        assert section.locator('[data-garden-depth]').count()==0,'Portraits must not independently float'
        for person in ['bagas','iga']:
            article=section.locator('.v2-person-'+person)
            figure=article.locator('figure')
            copy=article.locator('.v2-profile-copy')
            box=figure.bounding_box()
            text_box=copy.bounding_box()
            if width>900:
                assert (box['x']<text_box['x']) if person=='bagas' else (box['x']>text_box['x'])
            else:
                assert box['y']+box['height']<=text_box['y'],'Mobile portraits precede their text'
            window=article.locator('.v2-profile-window').bounding_box()
            printed=article.locator('.v2-profile-print').bounding_box()
            assert window['width']>=printed['width']*.88,(name,person,'portrait window shrunk',window,printed)
            assert abs(window['width']/window['height']-.8)<.01
            assert article.locator('dt').count()==article.locator('dd').count()==3
            assert 'to be added' in figure.inner_text()
            assert article.get_attribute('aria-labelledby')==f'profile-{person}-title'
            botanical=figure.locator('img')
            botanical.wait_for()
            botanical.evaluate('e=>e.decode()')
            assert botanical.evaluate("e=>parseFloat(getComputedStyle(e).width)*devicePixelRatio<=e.naturalWidth+1"),'Raster must not exceed its native resolution'
            assert botanical.evaluate("e=>getComputedStyle(e).pointerEvents")=='none'
            if person=='iga':
                label=article.locator('.v2-portrait-placeholder').bounding_box()
                plant=botanical.bounding_box()
                assert label['y']+label['height']<plant['y'],'The tall pink stem must not cover the placeholder text'
            def measure():
                return article.evaluate("""e=>[e.querySelector('figure'),e.querySelector('.v2-profile-copy')].map(n=>{
                  const r=n.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height};})""")
            article.evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-140,behavior:'instant'})")
            page.wait_for_timeout(700)
            before=measure()
            start=page.evaluate('scrollY')
            initial=article.evaluate("e=>e.style.getPropertyValue('--profile-light-shift')")
            for offset in [140,260,100,0]:
                page.evaluate("y=>window.scrollTo({top:y,behavior:'instant'})",start+offset)
                page.wait_for_timeout(650)
                after=measure()
                for first,second in zip(before,after):
                    for key in first:
                        assert abs(first[key]-second[key])<1,(name,person,key)
                light=article.evaluate("e=>e.style.getPropertyValue('--profile-light-shift')")
                assert light and abs(float(light.removesuffix('px'))) <= (6 if width<721 else 12)
                if offset==260:
                    assert light!=initial,'Light must respond without moving the portrait'
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            if person=='bagas':
                page.screenshot(path=f'/tmp/profiles-{name}-en.png')
        page.locator('.v2-spine').get_by_role('button',name='Bahasa Indonesia',exact=True).click()
        assert section.locator('.v2-person-bagas .v2-profile-copy > p').inner_text()=='Di mata Iga'
        assert section.locator('.v2-person-iga .v2-profile-copy > p').inner_text()=='Di mata Bagas'
        assert 'Menyusul di sini.' in section.inner_text()
        assert 'Bagas Marsya Pratama Nugraha' in section.inner_text()
        assert 'Iga Noviyanti Rohman' in section.inner_text()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        section.locator('.v2-person-iga').scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        page.screenshot(path=f'/tmp/profiles-{name}-id.png')
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_function("getComputedStyle(document.querySelector('.v2-portrait-light')).translate==='none'")
        page.evaluate("window.scrollBy({top:100,behavior:'instant'})")
        page.wait_for_timeout(250)
        assert section.locator('.v2-profile-window').first.evaluate("e=>getComputedStyle(e,'::after').translate")=='none'
        page.locator('.v2-garden-background canvas').evaluate("c=>c.dispatchEvent(new Event('webglcontextlost',{cancelable:true}))")
        assert section.locator('h2').is_visible()
        assert section.locator('.v2-profile-print').count()==2
        assert not errors,errors
        print(name,'PASS: paired layout, full portrait window, grounded scroll, bounded light, sharp botanicals, EN/ID, reduced motion and fallback',flush=True)
        context.close()
    browser.close()
