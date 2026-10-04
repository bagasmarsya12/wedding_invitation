import {DEFAULT_CONTENT,normalizeContent} from './keepsake-content.js?v=7';
export const SIZE={width:900,height:1200};
export const DEFAULT_MESSAGE=DEFAULT_CONTENT.card.message;
export const FONT='Baskerville, Newsreader, Georgia, serif';
export const SANS='Instrument, Arial, sans-serif';
const canvas=()=>{const c=document.createElement('canvas');c.width=900;c.height=1200;return c;};
const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Ilustrasi kartu belum tersedia. Coba muat ulang.'));i.src=new URL(src,import.meta.url).href;});
export const normalizeName=value=>Array.from(String(value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()).slice(0,120).join('');
export const normalizeMessage=value=>Array.from(String(value).normalize('NFC').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').trim()).slice(0,600).join('')||DEFAULT_MESSAGE;
export async function loadDesignAssets(){
 await Promise.all([document.fonts.load('400 48px Newsreader'),document.fonts.load('400 24px Instrument')]);
 const [flowers,paper,mark]=await Promise.all(['./assets/keepsake-florals.png','./assets/keepsake-paper.webp','./assets/keepsake-mark.webp'].map(load));
 return {flowers,paper,mark};
}
// Word wrapping and pagination share the same layout for preview and exports.
function wrap(ctx,value,width){
 const lines=[];
 for(const paragraph of value.split('\n')){
  let line='';
  for(const word of paragraph.split(/\s+/).filter(Boolean)){
   const next=line?line+' '+word:word;
   if(ctx.measureText(next).width<=width){line=next;continue;}
   if(line){lines.push(line);line='';}
   for(const ch of Array.from(word)){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line=ch;}else line+=ch;}
  }
  lines.push(line);
 }
 return lines;
}
function arch(ctx,inset=0){
 const left=63+inset,right=837-inset,top=60+inset,bottom=1152-inset;
 ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(left,405);ctx.bezierCurveTo(left,215,237,top,450,top);ctx.bezierCurveTo(663,top,right,215,right,405);ctx.lineTo(right,bottom);ctx.closePath();
}
export function composeKeepsake(assets,input){
 const content=normalizeContent(input.content);
 const data={name:normalizeName(input.name??content.recipient),message:normalizeMessage(input.message??content.card.message),card:content.card},name=data.name||data.card.genericRecipient;
 const measuring=canvas().getContext('2d');measuring.font=`400 44px ${FONT}`;
 const messageLines=wrap(measuring,data.message,480),pages=[];
 for(let i=0;i<messageLines.length;i+=7)pages.push(messageLines.slice(i,i+7));
 function face(back=false,page=0){
  const art=canvas(),fx=canvas(),ctx=art.getContext('2d'),mask=fx.getContext('2d');
  ctx.fillStyle=back?'#122b20':'#21382c';ctx.fillRect(0,0,900,1200);mask.fillStyle='#000';mask.fillRect(0,0,900,1200);
  const text=(value,y,size,color='#292721',italic=false)=>{ctx.fillStyle=color;ctx.font=`${italic?'italic ':''}400 ${size}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillText(value,450,y);};
  const recipient=(centerY,maxSize,color)=>{
   let size=maxSize;ctx.font=`400 ${size}px ${FONT}`;let lines=wrap(ctx,name,480);
   while(lines.length>3&&size>23){size-=2;ctx.font=`400 ${size}px ${FONT}`;lines=wrap(ctx,name,480);}
   const leading=size*1.15,first=centerY-(lines.length-1)*leading/2;
   lines.forEach((line,i)=>text(line,first+i*leading,size,color));
  };
  const block=(value,centerY,maxSize,maxHeight,color,italic=false)=>{
   let size=maxSize,lines=[];
   do{ctx.font=`${italic?'italic ':''}400 ${size}px ${FONT}`;lines=wrap(ctx,value,480);if(lines.length*size*1.32<=maxHeight||size<=18)break;size-=1;}while(true);
   const leading=size*1.32,first=centerY-(lines.length-1)*leading/2;
   lines.forEach((line,i)=>text(line,first+i*leading,size,color,italic));
  };
  if(!back){
   arch(ctx,-13);ctx.fillStyle='#55674b';ctx.fill();arch(ctx);ctx.fillStyle='#f6f0e3';ctx.fill();
   const pattern=ctx.createPattern(assets.paper,'repeat');if(pattern){ctx.save();ctx.clip();ctx.globalAlpha=.5;ctx.fillStyle=pattern;ctx.fillRect(0,0,900,1200);ctx.restore();}
   arch(ctx);ctx.lineWidth=3;ctx.strokeStyle='#c6a66c';ctx.stroke();arch(ctx,18);ctx.lineWidth=1.3;ctx.strokeStyle='#62734c66';ctx.stroke();
   arch(mask);mask.strokeStyle='#ed0000';mask.lineWidth=3;mask.stroke();
   ctx.drawImage(assets.mark,390,235,120,120);
   text(data.card.forLabel,435,28,'#63724f',true);
   block(name,560,82,230,'#292721');
   block(data.card.frontNote,777,36,165,'#49533d');
   block(data.card.signatureGreeting,889,27,40,'#49533d',true);
   block(data.card.signatureNames,942,36,70,'#49533d',true);
  }else{
   const pattern=ctx.createPattern(assets.paper,'repeat');if(pattern){ctx.save();ctx.globalAlpha=.06;ctx.fillStyle=pattern;ctx.fillRect(0,0,900,1200);ctx.restore();}
   ctx.strokeStyle='#c7a66c';ctx.lineWidth=2;ctx.strokeRect(45,60,810,1080);ctx.strokeStyle='#aab49655';ctx.lineWidth=1;ctx.strokeRect(61,82,778,1036);
   mask.strokeStyle='#ac0000';mask.lineWidth=2;mask.strokeRect(45,60,810,1080);
   text(data.card.forLabel,245,30,'#c5cba9',true);recipient(342,63,'#f6f0e3');
   ctx.strokeStyle='#c7a66c';ctx.beginPath();ctx.moveTo(412,430);ctx.lineTo(488,430);ctx.stroke();mask.strokeStyle='#dd0000';mask.beginPath();mask.moveTo(412,430);mask.lineTo(488,430);mask.stroke();
   const lines=pages[page],first=510+(7-lines.length)*27;
   lines.forEach((line,i)=>text(line,first+i*54,44,'#f6f0e3'));
   block(data.card.signatureGreeting,955,27,55,'#c5cba9',true);block(data.card.signatureNames,1019,36,70,'#f6f0e3');
   if(pages.length>1){ctx.font=`400 20px ${SANS}`;ctx.fillStyle='#c5cba9';ctx.fillText(`${page+1} / ${pages.length}`,450,1070);}
  }
  // The generated art is preserved; layout scaling belongs to the card scene.
  const layer=canvas(),lc=layer.getContext('2d');
  lc.drawImage(assets.flowers,back?-200:-65,back?-180:-50,back?1300:1030,back?1560:1300);
  ctx.drawImage(layer,0,0);
  const pixels=lc.getImageData(0,0,900,1200),foil=mask.getImageData(0,0,900,1200);
  for(let p=0;p<pixels.data.length;p+=4){
   const r=pixels.data[p],g=pixels.data[p+1],b=pixels.data[p+2],a=pixels.data[p+3]/255;
   // Warm gold ink becomes metallic; pink and ivory petals remain printed.
   const isGold=r>110&&g>75&&r>g*1.06&&g>b*1.24&&r-g<110;
   foil.data[p]=Math.max(foil.data[p],isGold?Math.round(220*a):0);
   foil.data[p+1]=Math.round(a*24);foil.data[p+2]=Math.round(a*95);foil.data[p+3]=255;
  }
  mask.putImageData(foil,0,0);
  // A softly rolled height map gives fine gold contours real surface relief.
  const relief=canvas(),rc=relief.getContext('2d');rc.filter='blur(1.8px)';rc.drawImage(fx,0,0);
  const heights=rc.getImageData(0,0,900,1200);
  for(let p=0;p<foil.data.length;p+=4)foil.data[p+2]=heights.data[p];
  mask.putImageData(foil,0,0);
  return {art,fx,preview:art.toDataURL('image/webp',.9),lines:back?pages[page]:null};
 }
 const front=face(),backs=pages.map((_,i)=>face(true,i));
 // The opening's floral layers are crops of the same approved illustration.
 const accents=[false,true].map(bottom=>{
  const c=document.createElement('canvas');c.width=400;c.height=480;const context=c.getContext('2d'),w=assets.flowers.naturalWidth,h=assets.flowers.naturalHeight;
  context.drawImage(assets.flowers,bottom?w*.52:0,bottom?h*.62:0,w*(bottom?.48:.47),h*(bottom?.38:.40),0,0,400,480);
  const image=context.getImageData(0,0,400,480);
  for(let y=0;y<480;y++)for(let x=0;x<400;x++){const edge=Math.max(0,Math.min(1,Math.min(x,399-x,y,479-y)/28));image.data[(y*400+x)*4+3]*=edge;}
  context.putImageData(image,0,0);return c;
 });
 return {data,front,backs,accents,pageCount:pages.length,messageLines};
}
