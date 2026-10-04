import {normalizeContent,format} from './keepsake-content.js?v=7';
import {loadDesignAssets,composeKeepsake} from './keepsake-design.js?v=7';
import {CardRenderer,openingPose} from './keepsake-renderer.js?v=7';
import {exportImage,exportVideo} from './story-export.js?v=7';
export function mountKeepsake(root,initialContent){
const lifecycle=new AbortController();
const listen=(target,type,handler,options={})=>target.addEventListener(type,handler,{...options,signal:lifecycle.signal});
const $=s=>root.querySelector(s),stage=$('#stage'),fallback=$('#fallback');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let content=normalizeContent(initialContent),disposed=false,assets,design,live,ready=false,face='front',page=0,flip=0,target=0,raf=0,last=0,idle=0,intro=0,opening=true,exporting=false,exportAbort,videoBlob,videoUrl='',imageUrls=[],resizeObserver;
const pointer={x:0,y:0,down:null};
const status=text=>$('#status').textContent=text;
const copy=(key,params)=>format(content.ui[key],params);
function ui(){
 const hint=face==='front'?copy('hintFront'):page<design.pageCount-1?copy('hintNext'):copy('hintBack');
 $('#card-hint').textContent=hint;stage.setAttribute('aria-pressed',String(face==='back'));
 stage.setAttribute('aria-label',copy(face==='front'?'frontAria':'backAria',{name:design.data.name||design.data.card.genericRecipient,message:design.backs[page].lines.join(' '),hint}));
 $('#save-back').textContent=design.pageCount>1?copy('downloadBackPage',{page:page+1,pages:design.pageCount}):copy('downloadBack');
 if(!live){fallback.hidden=false;fallback.src=face==='front'?design.front.preview:design.backs[page].preview;fallback.alt=stage.getAttribute('aria-label');}
}
function wake(){idle=0;if(ready&&!raf&&!document.hidden)raf=requestAnimationFrame(render);}
function render(time){
 raf=0;const dt=last?Math.min(.05,(time-last)/1000):1/60;last=time;intro+=dt;
 if(opening&&!reduced.matches&&intro<4.2)live?.draw(openingPose(intro));
 else{
  opening=false;flip=reduced.matches?target:flip+(target-flip)*(1-Math.exp(-5*dt));
  if(Math.abs(flip-target)<.0001)flip=target;
  live?.draw({flip,page,x:reduced.matches?0:-pointer.y*.095,y:reduced.matches?0:pointer.x*.20,z:reduced.matches?0:-pointer.x*.014,sweep:reduced.matches?.14:pointer.x*.85+.14});
 }
 if(opening||flip!==target||idle++<3)raf=requestAnimationFrame(render);else last=0;
}
function show(nextFace,nextPage=page){
 if(!ready)return;opening=false;page=Math.max(0,Math.min(design.pageCount-1,nextPage));face=nextFace;target=face==='back'?1:0;pointer.x=pointer.y=0;ui();wake();
}
function next(){if(face==='front')show('back',0);else if(page<design.pageCount-1)show('back',page+1);else show('front',0);}
function previous(){if(face==='back'&&page>0)show('back',page-1);else show('front',0);}
function resize(){if(live){const r=stage.getBoundingClientRect();live.resize(r.width,r.height);wake();}}
function busy(value){exporting=value;$('#export-progress').hidden=!value;['save-video','save-front','save-back'].forEach(id=>$('#'+id).disabled=value);}
function slug(){return (design.data.name||'untukmu').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,50)||'untukmu';}
function download(blob,filename){
 const url=URL.createObjectURL(blob);imageUrls.push(url);const a=document.createElement('a');a.href=url;a.download=filename;a.click();
 setTimeout(()=>{URL.revokeObjectURL(url);imageUrls=imageUrls.filter(x=>x!==url);},60000);
}
function clearVideo(){if(videoUrl)URL.revokeObjectURL(videoUrl);videoUrl='';videoBlob=null;$('#download-video').hidden=true;$('#download-video').removeAttribute('href');$('#save-video').hidden=false;}
async function saveImage(back){
 if(!ready||exporting)return;busy(true);status(copy('preparingImage'));
 try{const image=await exportImage(design,back,page);download(image,`iga-bagas-${slug()}-${back?'belakang-'+(page+1):'depan'}.png`);status(copy('imageReady'));}
 catch{status(copy('imageFailed'));}finally{busy(false);}
}
async function saveVideo(){
 if(!ready||exporting)return;busy(true);clearVideo();exportAbort=new AbortController();$('#progress').value=0;status(copy('preparingVideo',{progress:0}));
 try{
  videoBlob=await exportVideo(design,{signal:exportAbort.signal,onProgress:p=>{$('#progress').value=p;status(copy('preparingVideo',{progress:p}));}});
  videoUrl=URL.createObjectURL(videoBlob);$('#download-video').href=videoUrl;$('#download-video').download=`iga-bagas-${slug()}-story.mp4`;$('#download-video').hidden=false;$('#save-video').hidden=true;
  status(copy('videoReady'));
 }catch(error){status(copy(error.name==='AbortError'?'videoCancelled':'videoFailed'));}finally{busy(false);exportAbort=null;}
}
listen($('#save-front'),'click',()=>saveImage(false));listen($('#save-back'),'click',()=>saveImage(true));listen($('#save-video'),'click',saveVideo);listen($('#cancel-export'),'click',()=>exportAbort?.abort());
listen(stage,'pointermove',e=>{const r=stage.getBoundingClientRect();pointer.x=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));pointer.y=Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));wake();if(pointer.down)pointer.down.distance=Math.max(pointer.down.distance,Math.hypot(e.clientX-pointer.down.x,e.clientY-pointer.down.y));});
listen(stage,'pointerdown',e=>{if(e.button===0)pointer.down={x:e.clientX,y:e.clientY,distance:0};});
listen(stage,'pointerup',e=>{if(!pointer.down)return;const d=pointer.down;pointer.down=null;if(d.distance<9)next();else if(Math.abs(e.clientX-d.x)>70&&Math.abs(e.clientY-d.y)<40)e.clientX<d.x?next():previous();});
listen(stage,'pointercancel',()=>pointer.down=null);listen(stage,'pointerleave',()=>{pointer.x=pointer.y=0;pointer.down=null;wake();});
listen(stage,'keydown',e=>{if(['Enter',' ','ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();e.key==='ArrowLeft'?previous():next();}});
listen(document,'keydown',e=>{if(e.key==='Escape')show('front',0);});
listen(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;exportAbort?.abort();}else wake();});
listen(reduced,'change',()=>{opening=false;pointer.x=pointer.y=0;wake();});
async function init(){
 try{
  assets=await loadDesignAssets();if(disposed)return;
  document.documentElement.lang=content.language;document.title=content.ui.pageTitle;
  $('#save-front').textContent=copy('downloadFront');$('#save-video span').textContent=copy('downloadVideo');$('#download-video').textContent=copy('downloadVideoReady');$('#cancel-export').textContent=copy('cancel');
  $('#loading').textContent=copy('loading');design=composeKeepsake(assets,{content});
  $('.downloads').setAttribute('aria-label',copy('downloadsAria'));$('#progress').setAttribute('aria-label',copy('progressAria'));
  try{live=new CardRenderer(design);stage.appendChild(live.canvas);live.canvas.setAttribute('aria-hidden','true');live.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();live?.dispose();live=null;ui();status(copy('graphicsFailed'));});}catch{live=null;}
  ready=true;opening=!reduced.matches;$('#loading').hidden=true;['save-video','save-front','save-back'].forEach(id=>$('#'+id).disabled=false);
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);resize();ui();wake();
 }catch{ $('#loading').textContent=copy('loadFailed'); }
}
listen(window,'pagehide',()=>{cancelAnimationFrame(raf);exportAbort?.abort();live?.dispose();if(videoUrl)URL.revokeObjectURL(videoUrl);imageUrls.forEach(url=>URL.revokeObjectURL(url));},{once:true});
init();
return()=>{disposed=true;lifecycle.abort();resizeObserver?.disconnect();cancelAnimationFrame(raf);exportAbort?.abort();live?.dispose();if(videoUrl)URL.revokeObjectURL(videoUrl);imageUrls.forEach(url=>URL.revokeObjectURL(url));};
}
