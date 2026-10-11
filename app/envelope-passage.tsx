"use client";
/* eslint-disable @next/next/no-img-element -- The print is a composed, local canvas data URL. */

import { useEffect, useRef, type CSSProperties } from 'react';
import { AtelierFloralAccent } from './atelier-flowers';
import { OPENING_DURATION_MS, frameWindow, paperTransform, type LiftedLetter, type PaperRect } from '@/lib/envelope-passage';

const position=(rect:PaperRect):CSSProperties=>({left:rect.left,top:rect.top,width:rect.width,height:rect.height});

/** Two printed blooms travel to the existing hero, using its actual geometry. */
export function EnvelopePassage({letter,onComplete}:{letter:LiftedLetter;onComplete:()=>void}) {
  const paper=useRef<HTMLDivElement>(null),print=useRef<HTMLImageElement>(null);
  const top=useRef<HTMLDivElement>(null),bottom=useRef<HTMLDivElement>(null),sheen=useRef<HTMLSpanElement>(null);
  const complete=useRef(onComplete);
  const topRect=frameWindow(letter.rect,-15,-15,285,333);
  const bottomRect=frameWindow(letter.rect,1228,675,295,291);

  useEffect(()=>{complete.current=onComplete;},[onComplete]);
  useEffect(()=>{
    const portal=document.querySelector<HTMLElement>('#the-day .v2-grand-portal');
    const topTarget=document.querySelector<SVGElement>('#the-day .day-combretum');
    const bottomTarget=document.querySelector<SVGElement>('#the-day .day-melastoma');
    if(!portal||!topTarget||!bottomTarget||!paper.current){complete.current();return;}
    const animations:Animation[]=[];
    const topStart=frameWindow(letter.rect,-15,-15,285,333),bottomStart=frameWindow(letter.rect,1228,675,295,291);
    const remaining=Math.max(100,OPENING_DURATION_MS-letter.elapsed*1000);
    const target=portal.getBoundingClientRect(),radius=getComputedStyle(portal).borderRadius;
    const options:KeyframeAnimationOptions={duration:remaining,easing:'cubic-bezier(.32,0,.15,1)',fill:'both'};
    const end=paperTransform(letter.rect,target);
    const surface=paper.current.animate([
      {transform:'translate(0px,0px) scale(1,1)',borderRadius:'2px',opacity:1},
      {offset:.72,opacity:1},
      {transform:end,borderRadius:radius,opacity:0},
    ],options);
    animations.push(surface);
    if(print.current)animations.push(print.current.animate([{opacity:1},{opacity:0}],{duration:240,fill:'both'}));
    for(const [element,from,to] of [[top.current,topStart,topTarget],[bottom.current,bottomStart,bottomTarget]] as const){
      if(!element)continue;
      animations.push(element.animate([
        {transform:'translate(0px,0px) scale(1,1)',opacity:1},
        {transform:paperTransform(from,to.getBoundingClientRect()),opacity:Number(getComputedStyle(to).opacity)},
      ],options));
    }
    if(sheen.current)animations.push(sheen.current.animate([
      {transform:'translateX(-130%)',opacity:0},
      {offset:.3,opacity:.32},
      {offset:.65,opacity:.14},
      {transform:'translateX(140%)',opacity:0},
    ],{duration:remaining,fill:'both',easing:'ease-in-out'}));
    surface.onfinish=()=>complete.current();
    // A rotation/resize during the short passage should release the invitation.
    const resized=()=>complete.current();
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    const motionChanged=()=>{if(preference.matches)complete.current();};
    addEventListener('resize',resized,{once:true});preference.addEventListener('change',motionChanged);
    return()=>{surface.onfinish=null;animations.forEach(animation=>animation.cancel());removeEventListener('resize',resized);preference.removeEventListener('change',motionChanged);};
  },[letter]);

  return <div className="envelope-passage" aria-hidden="true">
    <div ref={paper} className="envelope-passage-paper" style={position(letter.rect)}>
      {letter.preview && <img ref={print} className="envelope-passage-print" src={letter.preview} alt="" />}
      <span ref={sheen} className="envelope-passage-sheen" />
    </div>
    <div ref={top} className="envelope-passage-bloom" style={position(topRect)}><AtelierFloralAccent corner="top-left" /></div>
    <div ref={bottom} className="envelope-passage-bloom" style={position(bottomRect)}><AtelierFloralAccent corner="bottom-right" /></div>
  </div>;
}
