"""Browser-local reply fixtures. Private HTML must come from an isolated test
Worker via REPLY_QA_TOKEN, never a real guest. All browser mutations intercepted.
"""
import json
import os
from playwright.sync_api import sync_playwright

URL=os.environ.get('GARDEN_QA_URL','http://localhost:5173/').rstrip('/')
TOKEN=os.environ.get('REPLY_QA_TOKEN','')
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
STYLES=['classic','rose','sage','airmail','midnight']
WALL=[{'id':f'wall-{i}','author_name':f'Browser fixture {i}','message':'A public browser fixture, not a personal memory.',
       'style':STYLES[i%5],'font':'clean','drawingUrl':None,'created_at':'2026-10-01T00:00:00Z'} for i in range(24)]
ROOMS=['the-day','details','profiles','archive','useful-bits','gifts','leave-a-mark','beyond']

def setup(browser,width=390,height=844,private=False,saved=None,rsvp=True,marks=True,fail_rsvp=False,fail_mark=False,fail_read=False,delay_state=False):
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=2 if width<1000 else 1,reduced_motion='reduce')
    page=context.new_page()
    calls=[]; own=[]; errors=[]
    config={'fail_rsvp':fail_rsvp,'fail_mark':fail_mark,'fail_read':fail_read}
    page.on('pageerror',lambda error:errors.append(str(error)))
    pending_state=[]
    state={'phase':'pre-wedding','rsvpEnabled':rsvp,'marksEnabled':marks,'giftsEnabled':True}
    page.route('**/api/site-state',lambda route:pending_state.append(route) if delay_state else route.fulfill(json=state))
    page.route('**/api/marks?**',lambda route:route.fulfill(json={'marks':WALL,'nextCursor':None}))
    def rsvp_route(route):
        if route.request.method=='GET':
            if config['fail_read']:
                route.fulfill(status=503,json={'error':'RSVP is unavailable.'});return
            route.fulfill(json={'enabled':rsvp,'rsvp':{'attendance':saved,'party_size':1,'dietary':'PRIVATE LEGACY NEEDS'} if saved else None});return
        calls.append(('rsvp',route.request.post_data_json))
        if config['fail_rsvp']:
            route.fulfill(status=503,json={'error':'Your answer could not be saved. Please try again.'});return
        route.fulfill(json={'ok':True})
    def mark_route(route):
        if route.request.method=='GET':route.fulfill(json={'marks':own});return
        body=route.request.post_data_json
        calls.append(('mark',body))
        if config['fail_mark']:
            route.fulfill(status=503,json={'error':'Your mark could not be saved.'});return
        if route.request.method=='POST':
            own.append({'id':f'own-{len(own)}','author':'Fixture B','message':body['message'],'drawing':None,
                        'style':body['style'],'font':body['font'],'status':'pending','createdAt':'2026-10-01T00:00:00Z'})
        route.fulfill(status=201 if route.request.method=='POST' else 200,json={'ok':True})
    page.route('**/api/invite/*/rsvp',rsvp_route)
    page.route('**/api/invite/*/marks',mark_route)
    page.goto(f'{URL}/invite/{TOKEN}' if private else URL+'/',wait_until='domcontentloaded')
    page.wait_for_function("document.body.classList.contains('wedding-v2-body')")
    page.get_by_role('button',name='Skip opening',exact=True).click()
    page.locator('#rsvp').wait_for()
    # Approach the room before expecting its deferred editor to exist. Keep
    # the delayed-state assertion: proximity must not bypass feature gates.
    page.locator('#rsvp').evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-85,behavior:'instant'})")
    page.locator('.reply-editor-slot.is-ready').wait_for()
    if delay_state:
        page.wait_for_function("!document.querySelector('.reply-submit') || document.querySelector('.reply-submit').disabled")
        assert page.locator('.postcard-canvas canvas').count()==0
        assert pending_state
        pending_state[0].fulfill(json=state)
        page.locator('.postcard-canvas canvas').wait_for()
    if not fail_read:
        page.wait_for_function("!document.querySelector('.reply-loading')")
    page.locator('#rsvp').evaluate("e=>window.scrollTo({top:e.getBoundingClientRect().top+scrollY-85,behavior:'instant'})")
    page.wait_for_timeout(350)
    return context,page,calls,config,errors

def save(page):
    button=page.locator('.reply-submit')
    button.click()
    page.wait_for_function("!document.querySelector('.reply-submit')?.disabled")

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=CHROME)
    # Public preview: exercise real editor gestures, without any private identity.
    for name,w,h,rows,cols in [('desktop',1440,1100,3,4),('tablet',820,1180,2,3),('mobile',390,844,2,3),('small',320,740,2,3)]:
        context,page,calls,config,errors=setup(browser,w,h,delay_state=name=='small')
        assert [page.locator('#'+room).count() for room in ROOMS]==[1]*8
        assert page.locator('[data-light].v2-scene').count()==8
        assert page.locator('#rsvp').count()==1 and page.locator('.v2-rsvp-form').count()==0
        assert page.locator('#rsvp select').count()==0
        assert page.get_by_role('textbox').count()==1
        # The editor mounts after site-state arrives; size the bitmap to its
        # actual paper, not the canvas element's default 300 x 150 backing store.
        canvas_metrics=page.locator('.postcard-canvas canvas').evaluate("""e=>{
          const b=e.getBoundingClientRect();const ratio=Math.min(devicePixelRatio||1,2,2048/Math.max(1,b.width),2048/Math.max(1,b.height));
          return {width:e.width,height:e.height,expectedWidth:Math.round(b.width*ratio),expectedHeight:Math.round(b.height*ratio)};
        }""")
        assert canvas_metrics['width']==canvas_metrics['expectedWidth'] and canvas_metrics['height']==canvas_metrics['expectedHeight'],(name,canvas_metrics)
        assert len(page.locator('.postcard-canvas .postcard-postmark').inner_text())==8
        assert page.locator('.reply-submit').is_disabled()
        assert page.locator('.reply-received').count()==0
        page.locator('#rsvp input[value=yes]').check()
        assert page.locator('.reply-submit').is_enabled()
        page.screenshot(path=f'/tmp/reply-{name}-en.png')
        save(page)
        page.get_by_text('Preview only — no answer or postcard was saved.',exact=True).wait_for()
        assert calls==[] and page.locator('.reply-received').count()==0
        page.get_by_role('textbox',name='Your message',exact=True).fill('A browser-only note.')
        page.locator('#rsvp input[value=no]').check()
        save(page)
        assert calls==[]
        assert page.get_by_role('textbox',name='Your message',exact=True).input_value()=='A browser-only note.'
        for style in ['Airmail','Midnight','Sage']:
            page.get_by_role('button',name=style,exact=True).click()
            metrics=page.locator('.postcard-canvas').evaluate("""e=>{
              const t=e.querySelector('textarea').getBoundingClientRect(),s=e.querySelector('.postcard-stamp').getBoundingClientRect(),f=e.querySelector('.postcard-from').getBoundingClientRect();
              return {top:t.top-s.bottom,bottom:f.top-t.bottom,width:t.width};}
            """)
            assert metrics['top']>=10 and metrics['bottom']>=10 and metrics['width']>150,(name,style,metrics)
        page.locator('.v2-spine').get_by_role('button',name='Bahasa Indonesia',exact=True).click()
        page.get_by_role('button',name='Coba balasanku',exact=True).wait_for()
        assert page.get_by_role('radio',name='Aku belum bisa hadir.',exact=True).is_checked()
        assert page.get_by_role('textbox',name='Pesanmu',exact=True).input_value()=='A browser-only note.'
        assert 'PRIVATE LEGACY NEEDS' not in page.locator('body').inner_text()
        page.screenshot(path=f'/tmp/reply-{name}-id.png')
        wall=page.locator('.v2-postcard-wall')
        metrics=wall.evaluate("""e=>{
          const b=e.getBoundingClientRect(),cards=[...e.querySelectorAll('.postcard-wall-card')].map(n=>n.getBoundingClientRect());
          const visible=cards.filter(c=>c.left>=b.left-1&&c.right<=b.right+1);
          return {visible:visible.length,rows:new Set(visible.map(c=>Math.round(c.top))).size,cols:new Set(visible.map(c=>Math.round(c.left))).size};}""")
        assert metrics=={'visible':rows*cols,'rows':rows,'cols':cols},(name,metrics)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        print(name,'PASS: single reply room, two choices, optional card, inert preview, EN/ID, writing gutters, wall grid and no overflow',flush=True)
        context.close()

    if TOKEN:
        # RSVP only, empty or cleared paper must not create a postcard.
        context,page,calls,config,errors=setup(browser,private=True)
        page.locator('#rsvp input[value=yes]').check()
        save(page)
        page.get_by_text('Your answer is saved. See you there.',exact=True).wait_for()
        assert calls==[('rsvp',{'attendance':'yes'})]
        assert page.locator('.reply-received[data-attendance=yes]').count()==1
        page.get_by_role('tab',name='Draw',exact=True).click()
        canvas=page.locator('.postcard-canvas canvas')
        canvas.scroll_into_view_if_needed()
        box=canvas.bounding_box()
        page.mouse.move(box['x']+30,box['y']+100);page.mouse.down();page.mouse.move(box['x']+90,box['y']+150,steps=8);page.mouse.up()
        page.get_by_role('button',name='Clear',exact=True).click()
        save(page)
        assert len(calls)==1,'Clearing a drawing leaves an empty OPTIONAL postcard'
        page.get_by_role('tab',name='Write',exact=True).click()
        page.locator('#rsvp input[value=no]').check()
        page.get_by_role('textbox',name='Your message',exact=True).fill('Not attending, but leaving a browser-only postcard.')
        save(page)
        page.get_by_text('Kept.',exact=True).wait_for()
        assert [kind for kind,body in calls]==['rsvp','rsvp','mark']
        assert calls[-2][1]=={'attendance':'no'}
        assert set(calls[-1][1])=={'message','drawing','style','font'}
        assert 'attendance' not in json.dumps(calls[-1][1])
        assert page.locator('.reply-received[data-attendance=no]').count()==1
        assert page.locator('.postcard-wall-card').count()==24,'Pending cards do not appear publicly'
        # Editing a kept card must not save a draft attendance change.
        page.locator('.strip-card').first.click()
        page.locator('#rsvp input[value=yes]').check()
        page.get_by_role('textbox',name='Your message',exact=True).fill('Edited browser-only postcard.')
        save(page)
        assert calls[-1][0]=='mark' and len([c for c in calls if c[0]=='rsvp'])==2
        page.get_by_text('Your changed answer has not been saved yet.',exact=True).wait_for()
        assert not errors,errors
        print('PASS: RSVP-only, cleared drawing, declined reply plus card, private payloads, pending wall and independent card editing',flush=True)
        context.close()

        # A mark failure cannot roll back RSVP; retry sends only the mark, keeping its draft.
        context,page,calls,config,errors=setup(browser,private=True,fail_mark=True)
        page.locator('#rsvp input[value=yes]').check()
        page.get_by_role('textbox',name='Your message',exact=True).fill('Retry this browser-only draft.')
        save(page)
        page.get_by_text('Your mark could not be saved.',exact=True).wait_for()
        assert page.locator('.reply-received[data-attendance=yes]').count()==1
        assert page.get_by_role('textbox',name='Your message',exact=True).input_value()=='Retry this browser-only draft.'
        config['fail_mark']=False
        save(page)
        page.get_by_text('Kept.',exact=True).wait_for()
        assert [k for k,b in calls]==['rsvp','mark','mark']
        assert not errors,errors
        print('PASS: partial-success confirmation, retained postcard draft and mark-only retry',flush=True)
        context.close()

        context,page,calls,config,errors=setup(browser,private=True,fail_rsvp=True)
        page.locator('#rsvp input[value=yes]').check()
        page.get_by_role('textbox',name='Your message',exact=True).fill('Do not post until the answer saves.')
        save(page)
        page.get_by_text('Your answer could not be saved. Please try again.',exact=True).wait_for()
        assert [k for k,b in calls]==['rsvp'] and page.locator('.reply-received').count()==0
        assert page.get_by_role('textbox',name='Your message',exact=True).input_value()=='Do not post until the answer saves.'
        assert not errors,errors
        context.close()

        # Draw-only postcard and rapid double click: one RSVP + one PNG, no duplicates.
        context,page,calls,config,errors=setup(browser,private=True)
        page.locator('#rsvp input[value=no]').check()
        page.get_by_role('tab',name='Draw',exact=True).click()
        canvas=page.locator('.postcard-canvas canvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
        page.mouse.move(box['x']+45,box['y']+100);page.mouse.down();page.mouse.move(box['x']+120,box['y']+180,steps=10);page.mouse.up()
        page.locator('.reply-submit').evaluate('e=>{e.click();e.click();}')
        page.get_by_text('Kept.',exact=True).wait_for()
        assert [k for k,b in calls]==['rsvp','mark']
        assert calls[1][1]['message']=='' and calls[1][1]['drawing'].startswith('data:image/png;base64,')
        assert not errors,errors
        print('PASS: RSVP failure preserves drafts; draw-only card and double-click guard',flush=True)
        context.close()

        # Feature flags remain independent; both closed still retain the public wall.
        for rsvp,marks in [(False,True),(True,False),(False,False)]:
            context,page,calls,config,errors=setup(browser,private=True,rsvp=rsvp,marks=marks)
            assert page.locator('#rsvp input[value=yes]').is_enabled()==rsvp
            if rsvp:
                page.locator('#rsvp input[value=yes]').check();save(page)
                assert calls==[('rsvp',{'attendance':'yes'})]
                assert page.get_by_role('textbox').count()==0
            elif marks:
                save(page);page.get_by_text('Write or draw something first.',exact=True).wait_for()
                assert calls==[]
                page.get_by_role('textbox',name='Your message',exact=True).fill('A postcard after RSVP closes.')
                save(page);page.get_by_text('Kept.',exact=True).wait_for()
                assert [k for k,b in calls]==['mark']
            else:
                assert page.locator('.reply-submit').is_disabled()
            assert page.locator('.postcard-wall-card').count()==24 and not errors
            context.close()
        # A closed RSVP endpoint's failed read must not disable open postcards.
        context,page,calls,config,errors=setup(browser,private=True,rsvp=False,marks=True,fail_read=True)
        page.get_by_role('button',name='Try loading my answer again',exact=True).wait_for()
        assert page.locator('.reply-submit').is_enabled()
        page.get_by_role('textbox',name='Your message',exact=True).fill('A card independent of the closed RSVP service.')
        save(page);page.get_by_text('Kept.',exact=True).wait_for()
        assert [k for k,b in calls]==['mark'] and not errors
        context.close()
        # Existing declined answer loads as saved; no private notes ever populate the card.
        context,page,calls,config,errors=setup(browser,private=True,saved='no')
        assert page.locator('#rsvp input[value=no]').is_checked()
        assert page.locator('.reply-received[data-attendance=no]').count()==1
        assert page.get_by_role('textbox',name='Your message',exact=True).input_value()==''
        save(page);assert calls==[]
        context.close()
        context,page,calls,config,errors=setup(browser,private=True,fail_read=True)
        page.get_by_role('button',name='Try loading my answer again',exact=True).wait_for()
        assert page.locator('.reply-submit').is_disabled()
        config['fail_read']=False
        page.get_by_role('button',name='Try loading my answer again',exact=True).click()
        page.wait_for_function("!document.querySelector('.reply-loading')")
        page.locator('#rsvp input[value=yes]').check();save(page)
        page.get_by_text('Your answer is saved. See you there.',exact=True).wait_for()
        assert calls==[('rsvp',{'attendance':'yes'})] and not errors
        context.close()
        print('PASS: independent feature flags, persisted decline, RSVP read retry and no leaked legacy notes',flush=True)
    browser.close()
