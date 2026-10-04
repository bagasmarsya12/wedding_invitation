import { KEEPSAKE_ART, KEEPSAKE_SCENE_CSS, keepsakeMarkup, keepsakeText, escapeHtml, type KeepsakeData } from "./keepsake-design";

const imageData = new Map<string, Promise<string>>();
function embeddedImage(src: string): Promise<string> {
  const existing = imageData.get(src);
  if (existing) return existing;
  const promise = fetch(src, { credentials: "omit" }).then(async response => {
    if (!response.ok) throw new Error("Keepsake artwork unavailable");
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Keepsake artwork unavailable"));
      reader.readAsDataURL(blob);
    });
  }).catch(error => { imageData.delete(src); throw error; });
  imageData.set(src, promise);
  return promise;
}

const OFFLINE_RUNTIME = `
(()=>{
  const root=document.querySelector('.k-scene'),stage=root.querySelector('.k-stage'),button=root.querySelector('.k-flip'),front=root.querySelector('.k-front'),back=root.querySelector('.k-back'),status=root.querySelector('.k-status');
  button.addEventListener('click',()=>{const turned=root.dataset.face!=='back';root.dataset.face=turned?'back':'front';front.setAttribute('aria-hidden',String(turned));back.setAttribute('aria-hidden',String(!turned));button.setAttribute('aria-pressed',String(turned));button.textContent=turned?button.dataset.return:button.dataset.turn;status.textContent=turned?back.getAttribute('aria-label'):front.getAttribute('aria-label')});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),precise=matchMedia('(hover: hover) and (pointer: fine)');let frame=0;
  function reset(){cancelAnimationFrame(frame);root.style.setProperty('--k-tilt-x','0deg');root.style.setProperty('--k-tilt-y','0deg');root.style.setProperty('--k-light-x','25%');root.style.setProperty('--k-light-y','20%')}
  stage.addEventListener('pointermove',event=>{if(event.pointerType!=='mouse'||reduced.matches||!precise.matches)return;const rect=stage.getBoundingClientRect(),x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{root.style.setProperty('--k-tilt-x',((.5-y)*6).toFixed(2)+'deg');root.style.setProperty('--k-tilt-y',((x-.5)*9).toFixed(2)+'deg');root.style.setProperty('--k-light-x',(x*100).toFixed(1)+'%');root.style.setProperty('--k-light-y',(y*100).toFixed(1)+'%')})});
  stage.addEventListener('pointerleave',reset);reduced.addEventListener('change',reset);
  function density(){root.style.setProperty('--botanical-dpr',String(Math.max(1,devicePixelRatio||1)))}density();addEventListener('resize',density);
})();`;

export async function createDigitalKeepsake(data: KeepsakeData): Promise<Blob> {
  const assets = await Promise.all(Object.values(KEEPSAKE_ART).map(async art => [art.src, await embeddedImage(art.src)] as const));
  let markup = keepsakeMarkup(data);
  let css = KEEPSAKE_SCENE_CSS;
  for (const [src, value] of assets) {
    markup = markup.split(src).join(value);
    css = css.split(src).join(value);
  }
  const text = keepsakeText(data);
  const title = data.language === "id" ? `Kenangan ${text.names}` : `${text.names} keepsake`;
  const html = `<!doctype html><html lang="${data.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(title)}</title><style>${css}
  *{box-sizing:border-box}body{margin:0;min-width:280px;background:#12231c}main{width:min(40rem,100%);margin:auto;min-height:100dvh;padding:1.25rem 1rem;display:flex;flex-direction:column;justify-content:center}.k-offline-title{margin:0 0 .5rem;font:400 .8rem/1.5 var(--k-sans);color:#c5cba9;letter-spacing:.05em}.k-stage{padding:1.5rem 2.5rem 2rem}.k-tilt{width:min(26rem,calc((100dvh - 12rem)*.75),100%)}.k-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}@media(max-width:480px){main{padding:1rem .5rem}.k-stage{padding:1rem 1.5rem 1.5rem}}
  </style><noscript><style>.k-back,.k-controls{display:none}</style></noscript></head><body><main class="k-scene" data-face="front"><p class="k-offline-title">${escapeHtml(text.names)} · ${escapeHtml(text.stamp)}</p><div class="k-stage">${markup}</div><div class="k-controls"><button class="k-flip" type="button" aria-pressed="false" data-turn="${escapeHtml(text.turn)}" data-return="${escapeHtml(text.return)}">${escapeHtml(text.turn)}</button></div><p class="k-hint">${escapeHtml(text.hint)}</p><p class="k-status" role="status"></p></main><script>${OFFLINE_RUNTIME}</script></body></html>`;
  return new Blob([html], { type: "text/html;charset=utf-8" });
}
