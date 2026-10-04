"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./language";

type Scene = { canvas: HTMLCanvasElement; resize: (w:number,h:number)=>void; draw: (p:{time:number;opening:boolean;x:number;y:number})=>void; dispose:()=>void };

export function EnvelopeArt({ recipient, opening, reduced }: { recipient:string; opening:boolean; reduced:boolean }) {
  const { tField, t } = useLanguage();
  const host = useRef<HTMLSpanElement>(null);
  const motion = useRef({ opening, reduced, started:null as number|null });
  const [foil, setFoil] = useState(false);
  const [preview, setPreview] = useState({front:"",letter:""});
  const label=tField("keepsake.forLabel"),generic=tField("keepsake.genericRecipient");
  const frontNote=t("We’re getting married.");
  const signature=tField("keepsake.love"),names=tField("keepsake.signatureNames");

  useEffect(()=>{motion.current={opening,reduced,started:opening?(motion.current.started??performance.now()):null};},[opening,reduced]);
  useEffect(()=>{
    const el=host.current;if(!el)return;
    let stopped=false,scene:Scene|undefined,frame=0,last=0,time=0;
    const pointer={x:0,y:0};
    const render=(now:number)=>{
      frame=0;if(stopped||document.hidden)return;
      const current=motion.current;
      time=current.started===null?0:(now-current.started)/1000;
      scene?.draw({time,opening:current.opening,x:pointer.x,y:pointer.y});last=now;
      if(current.opening&&time<3.65)frame=requestAnimationFrame(render);
    };
    const wake=()=>{if(!frame&&!stopped)frame=requestAnimationFrame(render);};
    const move=(event:PointerEvent)=>{if(motion.current.reduced)return;const r=el.getBoundingClientRect();pointer.x=(event.clientX-r.left)/r.width*2-1;pointer.y=(event.clientY-r.top)/r.height*2-1;wake();};
    const leave=()=>{pointer.x=pointer.y=0;wake();};
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{if(motion.current.started!==null&&last)motion.current.started+=performance.now()-last;wake();}};
    const observe=new ResizeObserver(()=>{const r=el.getBoundingClientRect();scene?.resize(r.width,r.height);wake();});observe.observe(el);
    const phaseObserver=new MutationObserver(wake);phaseObserver.observe(el.closest('.v2-opening')!,{attributes:true,attributeFilter:['class']});
    el.addEventListener('pointermove',move);el.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);
    const prepare=async()=>{
      try{
        const designPath='/atelier/keepsake-design.js?v=7',scenePath='/atelier/envelope-scene.js?v=8';
        const [composition,renderer]=await Promise.all([import(/* @vite-ignore */ designPath),import(/* @vite-ignore */ scenePath)]);
        const assets=await composition.loadDesignAssets();if(stopped)return;
        const design=renderer.composeEnvelope(assets,{recipient,forLabel:label,genericRecipient:generic,frontNote,signature,names});
        setPreview({front:design.front.preview,letter:design.letter.preview});
        try{
          scene=new renderer.EnvelopeScene(design,{reduced:motion.current.reduced});
          scene!.canvas.setAttribute('aria-hidden','true');el.appendChild(scene!.canvas);
          scene!.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();scene?.dispose();scene=undefined;setFoil(false);});
          const r=el.getBoundingClientRect();scene!.resize(r.width,r.height);setFoil(true);wake();
        }catch{setFoil(false);}
      }catch{/* The HTML envelope remains usable if graphics/assets cannot load. */}
    };
    void prepare();
    return()=>{stopped=true;cancelAnimationFrame(frame);observe.disconnect();phaseObserver.disconnect();el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);scene?.dispose();};
  },[recipient,label,generic,frontNote,signature,names]);

  return <span ref={host} className={`atelier-envelope-art ${foil?'has-foil':''}`} aria-hidden="true">
    <span className="atelier-envelope-fallback">
      <span className="atelier-letter">{preview.letter ? <img src={preview.letter} alt="" /> : <><img className="atelier-print" src="/atelier/assets/keepsake-florals.png" alt="" /><span className="atelier-fallback-name">{recipient||generic}</span></>}</span>
      <span className="atelier-pocket">{preview.front ? <img src={preview.front} alt="" /> : <img className="atelier-print" src="/atelier/assets/keepsake-florals.png" alt="" />}</span>
      <span className="atelier-flap">{preview.front ? <img src={preview.front} alt="" /> : <img className="atelier-print" src="/atelier/assets/keepsake-florals.png" alt="" />}</span>
      <span className="atelier-seal"><img src="/atelier/assets/keepsake-mark.webp" alt="" /></span>
    </span>
  </span>;
}
