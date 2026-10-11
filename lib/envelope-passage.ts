export const OPENING_DURATION_MS = 3000;
export const OPENING_HANDOFF_SECONDS = 1.4;
export const OPENING_FAILSAFE_MS = 3300;

export type PaperRect = { left:number; top:number; width:number; height:number };
export type LiftedLetter = { rect:PaperRect; preview:string; elapsed:number };

/** Matches the resting letter's perspective if WebGL is unavailable. */
export function fallbackLetterRect(stage:PaperRect):PaperRect {
  const viewHeight=Math.max(6.6,6.7/(stage.width/stage.height));
  const distance=viewHeight/(2*Math.tan(Math.PI/12));
  const pixels=stage.height/viewHeight*distance/(distance-.2);
  const width=5.33*pixels,height=3.34*pixels;
  return {left:stage.left+(stage.width-width)/2,top:stage.top+stage.height/2-(1.68-.4-.35)*pixels-height/2,width,height};
}

export function frameWindow(rect:PaperRect,x:number,y:number,width:number,height:number):PaperRect {
  return {left:rect.left+x/1500*rect.width,top:rect.top+y/940*rect.height,width:width/1500*rect.width,height:height/940*rect.height};
}

export function paperTransform(from:PaperRect,to:PaperRect):string {
  return `translate(${to.left-from.left}px, ${to.top-from.top}px) scale(${to.width/from.width}, ${to.height/from.height})`;
}
