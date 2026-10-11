const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t;
export const MESSAGE_START=4.4;
export const STORY_DURATION=10;
// Keep the whole film within ten seconds, including every message page.
const pageDurations=design=>design.backs.map(()=> (STORY_DURATION-MESSAGE_START)/design.backs.length);
export function grandeDuration(){return STORY_DURATION;}

/** One unwarped 3:4 card: flowers open, front holds, one turn, then a calm read. */
export function grandePose(t,design){
 const reveal=ease(t/1.85),turn=ease((t-3.1)/1.3),durations=pageDurations(design);
 let page=0,start=MESSAGE_START;
 while(page<durations.length-1&&t>=start+durations[page])start+=durations[page++];
 const elapsed=Math.max(0,t-start),read=clamp(elapsed/durations[page]);
 return {
  flip:turn,page,scale:t<MESSAGE_START?mix(.76,1,reveal):1+Math.sin(read*Math.PI)*.012,
  panX:0,panY:mix(-.30,0,reveal),
  x:t<MESSAGE_START?mix(.18,0,reveal)+Math.sin(turn*Math.PI)*.09+.025*Math.sin(t*.72)*reveal*(1-turn):.014*Math.sin(elapsed*.32),
  y:t<MESSAGE_START?mix(-.24,0,reveal)+Math.sin(turn*Math.PI)*.07+.065*Math.sin(t*.65)*reveal*(1-turn):.032*Math.sin(elapsed*.29),
  z:t<MESSAGE_START?mix(-.035,0,reveal)-Math.sin(turn*Math.PI)*.035:0,
  opacity:ease(t/.65)*(page>0?ease(elapsed/Math.min(.2,durations[page]*.15)):1),
  sweep:t<MESSAGE_START?-1.0+1.9*ease((t-.2)/1.5)-1.55*ease((t-1.95)/1.15):.30+Math.sin(elapsed*.78)*.66,
  ambience:t,gardenReveal:reveal,floralDrift:0,bloom:0
 };
}

function flower(ctx,art,x,y,width,angle,opacity){
 if(!art)return;
 ctx.save();ctx.globalAlpha=opacity;ctx.translate(x,y);ctx.rotate(angle);
 ctx.drawImage(art,-width/2,-width*art.height/art.width/2,width,width*art.height/art.width);ctx.restore();
}
function star(ctx,x,y,r,alpha){
 ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#fbe5aa';
 const glow=ctx.createRadialGradient(x,y,0,x,y,r*4);glow.addColorStop(0,'#ffe6ac88');glow.addColorStop(1,'#ffe6ac00');ctx.fillStyle=glow;ctx.fillRect(x-r*4,y-r*4,r*8,r*8);
 ctx.fillStyle='#fff1c6';ctx.beginPath();ctx.moveTo(x,y-r*1.7);ctx.quadraticCurveTo(x+r*.18,y-r*.18,x+r,y);ctx.quadraticCurveTo(x+r*.18,y+r*.18,x,y+r*1.7);ctx.quadraticCurveTo(x-r*.18,y+r*.18,x-r,y);ctx.quadraticCurveTo(x-r*.18,y-r*.18,x,y-r*1.7);ctx.fill();ctx.restore();
}
export function drawGardenBackdrop(ctx,design,pose,width,height){
 const t=pose.ambience||0,reveal=pose.gardenReveal??1,open=ease(t/1.2),breath=Math.sin(t*.28);
 ctx.save();
 // Long gold arches make a ceremonial stage behind the rectangular card.
 ctx.globalAlpha=.32*open;ctx.strokeStyle='#d9b76c';ctx.lineWidth=1.6;
 for(const inset of [0,20]){
  const left=width*.052+inset,right=width*.948-inset,top=height*.075+inset,bottom=height*.914-inset;
  ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(left,top+width*.46);
  ctx.bezierCurveTo(left,top+width*.12,width*.25,top,width*.5,top);
  ctx.bezierCurveTo(width*.75,top,right,top+width*.12,right,top+width*.46);ctx.lineTo(right,bottom);ctx.stroke();
 }
 ctx.globalCompositeOperation='screen';
 const glow=ctx.createRadialGradient(width*.5,height*.26,5,width*.5,height*.26,width*.64);
 glow.addColorStop(0,`rgba(211,170,78,${(.13+.06*Math.sin(t*.6))*open})`);glow.addColorStop(1,'#d3aa4e00');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
 // Three broad studio ribbons move slowly; the narrow reflections are on foil.
 for(let i=0;i<3;i++){
  ctx.save();ctx.translate(width*(.13+i*.37),height*.20);ctx.rotate(-.30+Math.sin(t*.17+i)*.10);
  const beam=ctx.createLinearGradient(-width*.2,0,width*.2,0);beam.addColorStop(0,'#fbe8b400');beam.addColorStop(.48,'#fbe8b407');beam.addColorStop(.51,'#fff5d619');beam.addColorStop(1,'#fbe8b400');
  ctx.globalAlpha=open*(1-reveal*.55);ctx.fillStyle=beam;ctx.fillRect(-width*.2,-height*.35,width*.4,height*1.7);ctx.restore();
 }
 ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
 // A larger distant garden remains visible above and below the card.
 flower(ctx,design.accents[0],width*.15,height*.13,width*(1.12-reveal*.30),-.11+breath*.022,.78*open);
 flower(ctx,design.accents[1],width*.85,height*.88,width*(1.18-reveal*.32),.08-breath*.022,.88*open);
 flower(ctx,design.accents[1],-width*.13,height*.79,width*.72,.50,.34*open);
 flower(ctx,design.accents[0],width*1.12,height*.22,width*.67,-.53,.34*open);
 ctx.restore();
}
export function drawGardenHighlights(ctx,design,pose,width,height){
 const t=pose.ambience||0,reveal=pose.gardenReveal??1,open=ease(t/.9);
 // Foreground blooms retreat into the cropped corners, keeping text unobstructed.
 flower(ctx,design.accents[0],width*(.18-reveal*.30),height*(.22-reveal*.22),width*(1.35-reveal*.63),-.28,.90*open);
 flower(ctx,design.accents[1],width*(.83+reveal*.31),height*(.76+reveal*.25),width*(1.50-reveal*.74),.27,.94*open);
 for(let i=0;i<54;i++){
  const seed=(i*0.61803398875)%1,x=(i%2?width*(.83+seed*.15):width*(.02+seed*.15));
  const y=height*((((i*.173+t*.007*(.7+seed))%1)+1)%1),pulse=Math.pow(Math.max(0,Math.sin(t*(.6+seed)+i*2.2)),4);
  if(i%7===0)star(ctx,x,y,2.5+seed*2.3,pulse*.54*open);
  else {ctx.save();ctx.globalAlpha=(.12+pulse*.35)*open;ctx.fillStyle='#efd396';ctx.beginPath();ctx.arc(x,y,.7+seed*1.2,0,Math.PI*2);ctx.fill();ctx.restore();}
 }
 // Quiet gold filigree finishes the Story; the hashtag belongs on the card.
 ctx.save();ctx.globalAlpha=.56*open;ctx.strokeStyle='#d8bc7a';ctx.lineWidth=1.4;
 const y=height*.93;ctx.beginPath();ctx.moveTo(width*.37,y);ctx.quadraticCurveTo(width*.46,y-height*.012,width*.50,y);ctx.quadraticCurveTo(width*.54,y-height*.012,width*.63,y);ctx.stroke();
 star(ctx,width*.5,y,4,.8);ctx.restore();
}
