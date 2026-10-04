import * as THREE from './vendor/three.module.js';
import {vertex,fragment} from './keepsake-renderer.js?v=7';

const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
export const ENVELOPE_DURATION=3.6;
export function envelopePose(t=0){
 const hinge=ease((t-.22)/1.0),pull=ease((t-1.15)/1.45),exit=ease((t-2.78)/.82);
 return {hinge,flapZ:.155-.38*ease((hinge-.76)/.24),seal:1-ease(t/.42),envelopeY:-.40*pull,cardY:2.45*pull,cardZ:.065,cardTilt:.025*Math.sin(pull*Math.PI),sweep:-.45+.65*ease(t/2.75),opacity:1-exit};
}
const FONT='Newsreader, Baskerville, Georgia, serif';
function surface(){const c=document.createElement('canvas');c.width=1500;c.height=940;return c;}
function lines(ctx,value,width){
 const result=[];let line='';
 for(const word of String(value).split(/\s+/).filter(Boolean)){
  const next=line?line+' '+word:word;
  if(ctx.measureText(next).width<=width){line=next;continue;}
  if(line)result.push(line);line='';
  for(const letter of word){if(line&&ctx.measureText(line+letter).width>width){result.push(line);line=letter;}else line+=letter;}
 }
 if(line)result.push(line);return result;
}
export function composeEnvelope(assets,copy){
 function face(letter=false){
  const art=surface(),fx=surface(),c=art.getContext('2d'),m=fx.getContext('2d');
  c.fillStyle=letter?'#fbf5e8':'#f1e7d3';c.fillRect(0,0,1500,940);m.fillStyle='#000';m.fillRect(0,0,1500,940);
  c.save();c.globalAlpha=.38;c.fillStyle=c.createPattern(assets.paper,'repeat');c.fillRect(0,0,1500,940);c.restore();
  const wash=c.createLinearGradient(0,0,0,940);wash.addColorStop(0,'#fffdf61c');wash.addColorStop(1,'#b0986920');c.fillStyle=wash;c.fillRect(0,0,1500,940);
  const inset=letter?30:20;c.strokeStyle='#c6a66c';c.lineWidth=2.4;c.strokeRect(inset,inset,1500-inset*2,940-inset*2);m.strokeStyle='#d20000';m.lineWidth=2.4;m.strokeRect(inset,inset,1500-inset*2,940-inset*2);
  c.strokeStyle='#62734c45';c.lineWidth=1;c.strokeRect(inset+12,inset+12,1500-inset*2-24,940-inset*2-24);
  const flowerLayer=surface(),f=flowerLayer.getContext('2d');
  f.drawImage(assets.flowers,0,0,540,630,-15,-15,285,333);
  f.drawImage(assets.flowers,440,810,646,638,1228,675,295,291);
  c.drawImage(flowerLayer,0,0);
  const text=(value,y,size,italic=false)=>{c.textAlign='center';c.textBaseline='alphabetic';c.fillStyle='#364231';c.font=`${italic?'italic ':''}400 ${size}px ${FONT}`;c.fillText(value,750,y);};
  const name=copy.recipient||copy.genericRecipient;
  let size=letter?86:78;c.font=`400 ${size}px ${FONT}`;let nameLines=lines(c,name,940);
  while(nameLines.length>2&&size>32){size-=2;c.font=`400 ${size}px ${FONT}`;nameLines=lines(c,name,940);}
  if(letter){
   c.drawImage(assets.mark,690,122,120,120);text(copy.forLabel,310,30,true);
   nameLines.forEach((line,i)=>text(line,415+i*size*1.12-(nameLines.length-1)*size*.56,size));
   c.font=`400 38px ${FONT}`;const noteLines=lines(c,copy.frontNote,850);noteLines.slice(0,3).forEach((line,i)=>text(line,565+i*49,38));
   text(copy.signature,765,30,true);text(copy.names,822,44,true);
  }else{
   text(copy.forLabel,615,34,true);
   nameLines.forEach((line,i)=>text(line,718+i*size*1.12-(nameLines.length-1)*size*.56,size));
   text(copy.names,844,34,true);
  }
  const pixels=f.getImageData(0,0,1500,940),mask=m.getImageData(0,0,1500,940);
  for(let p=0;p<pixels.data.length;p+=4){const r=pixels.data[p],g=pixels.data[p+1],b=pixels.data[p+2],a=pixels.data[p+3]/255;const gold=r>110&&g>75&&r>g*1.06&&g>b*1.24&&r-g<110;mask.data[p]=Math.max(mask.data[p],gold?Math.round(210*a):0);mask.data[p+1]=Math.round(a*24);mask.data[p+2]=mask.data[p];mask.data[p+3]=255;}
  m.putImageData(mask,0,0);return {art,fx,preview:art.toDataURL('image/webp',.9)};
 }
 return {front:face(),letter:face(true),mark:assets.mark};
}
const W=5.6,H=3.51,TOP=H/2,TIP=.02;
function shape(points){
 const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
 const g=new THREE.ShapeGeometry(s),p=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+W/2)/W,(p.getY(i)+H/2)/H);
 return g;
}
export class EnvelopeScene{
 constructor(design,{reduced=false}={}){
  this.reduced=reduced;this.maps=[];this.materials=[];this.geometries=[];
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0,0);
  this.canvas=this.renderer.domElement;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(30,1,.1,50);
  this.root=new THREE.Group();this.root.position.y=-.40;this.scene.add(this.root);this.envelope=new THREE.Group();this.root.add(this.envelope);
  const lining=this.mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({color:'#314633',transparent:true}));this.envelope.add(lining);
  this.card=this.mesh(new THREE.PlaneGeometry(5.33,3.34),this.foil(design.letter));this.card.position.z=.065;this.root.add(this.card);
  const rim=this.mesh(new THREE.BoxGeometry(W+.025,H+.025,.026),new THREE.MeshBasicMaterial({color:'#bfa574',transparent:true}));rim.position.z=-.023;this.envelope.add(rim);
  this.pocket=this.mesh(shape([[-W/2,TOP],[0,TIP],[W/2,TOP],[W/2,-TOP],[-W/2,-TOP]]),this.foil(design.front));this.pocket.position.z=.14;this.envelope.add(this.pocket);
  this.flap=new THREE.Group();this.flap.position.set(0,TOP,.155);this.envelope.add(this.flap);
  const flap=this.mesh(shape([[-W/2,TOP],[W/2,TOP],[0,TIP]]),this.foil(design.front));flap.position.y=-TOP;this.flap.add(flap);
  const flapBack=this.mesh(shape([[-W/2,TOP],[W/2,TOP],[0,TIP]]),new THREE.MeshBasicMaterial({color:'#ded2b4',side:THREE.BackSide,transparent:true}));flapBack.position.set(0,-TOP,-.005);this.flap.add(flapBack);
  const fold=this.mesh(shape([[-W/2,-TOP],[0,-.45],[W/2,-TOP]]),new THREE.MeshBasicMaterial({color:'#fff8e5',transparent:true,opacity:.14,depthWrite:false}));fold.position.z=.143;this.envelope.add(fold);
  const line=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-W/2,0,.009),new THREE.Vector3(0,TIP-TOP,.009),new THREE.Vector3(W/2,0,.009)]);this.geometries.push(line);
  this.foldMaterial=new THREE.LineBasicMaterial({color:'#c9aa70',transparent:true,opacity:.7});this.foldMaterial.userData.baseOpacity=.7;this.materials.push(this.foldMaterial);this.flap.add(new THREE.Line(line,this.foldMaterial));
  const seal=document.createElement('canvas');seal.width=256;seal.height=256;const c=seal.getContext('2d');c.beginPath();c.arc(128,128,119,0,Math.PI*2);c.clip();
  const gold=c.createRadialGradient(80,60,1,140,130,170);gold.addColorStop(0,'#f4dfa4');gold.addColorStop(.5,'#c6a066');gold.addColorStop(1,'#805e30');c.fillStyle=gold;c.fillRect(0,0,256,256);c.strokeStyle='#f2dab0';c.lineWidth=3;c.beginPath();c.arc(128,128,100,0,Math.PI*2);c.stroke();c.globalCompositeOperation='multiply';c.drawImage(design.mark,69,63,118,130);
  this.sealMaterial=new THREE.MeshBasicMaterial({map:this.texture(seal),transparent:true});this.materials.push(this.sealMaterial);
  this.seal=this.mesh(new THREE.PlaneGeometry(.63,.63),this.sealMaterial);this.seal.position.set(0,TIP,.19);this.envelope.add(this.seal);
 }
 texture(canvas){const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;this.maps.push(map);return map;}
 foil(face){const art=this.texture(face.art),fx=new THREE.CanvasTexture(face.fx);this.maps.push(fx);const m=new THREE.ShaderMaterial({uniforms:{uArt:{value:art},uFx:{value:fx},uSweep:{value:.1},uOpacity:{value:1}},vertexShader:vertex,fragmentShader:fragment,transparent:true,side:THREE.FrontSide});this.materials.push(m);return m;}
 mesh(geometry,material){this.geometries.push(geometry);material.userData.baseOpacity=material.opacity;if(!this.materials.includes(material))this.materials.push(material);return new THREE.Mesh(geometry,material);}
 resize(width,height){this.renderer.setSize(width,height,false);const aspect=width/height,h=Math.max(6.6,6.7/aspect);this.camera.aspect=aspect;this.camera.position.set(0,.35,h/(2*Math.tan(Math.PI/12)));this.camera.updateProjectionMatrix();}
 draw({time=0,opening=false,x=0,y=0}={}){
  const p=opening?envelopePose(time):{hinge:0,flapZ:.155,seal:1,envelopeY:0,cardY:0,cardZ:.065,cardTilt:0,sweep:this.reduced?.1:.1+x*.25,opacity:1};
  this.root.rotation.set(this.reduced||opening?0:-y*.012,this.reduced||opening?0:x*.025,0);
  this.envelope.position.y=p.envelopeY;this.flap.rotation.x=-p.hinge*Math.PI;this.flap.position.z=p.flapZ;
  this.card.position.set(0,p.cardY,p.cardZ);this.card.rotation.set(p.cardTilt,0,0);
  this.seal.position.z=.19+(1-p.seal)*.14;this.sealMaterial.opacity=p.seal*p.opacity;
  this.materials.forEach(m=>{if(m.uniforms){m.uniforms.uSweep.value=p.sweep;m.uniforms.uOpacity.value=p.opacity;}else if(m!==this.sealMaterial)m.opacity=(m.userData.baseOpacity??1)*p.opacity;});
  this.renderer.render(this.scene,this.camera);
 }
 dispose(){this.maps.forEach(m=>m.dispose());this.materials.forEach(m=>m.dispose());this.geometries.forEach(g=>g.dispose());this.renderer.dispose();this.canvas.remove();}
}
