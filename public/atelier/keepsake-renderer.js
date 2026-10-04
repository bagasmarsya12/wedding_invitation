import * as THREE from './vendor/three.module.js';
export const vertex=`varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
// Studio reflections and embossing belong to the foil mask, not the printed art.
export const fragment=`
uniform sampler2D uArt;uniform sampler2D uFx;uniform float uSweep;uniform float uOpacity;
varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec4 art=texture2D(uArt,vUv);vec3 fx=texture2D(uFx,vUv).rgb;
 float grain=noise(floor(vUv*vec2(1800.0,2400.0)));
 float dx=texture2D(uFx,vUv+vec2(.0011,0)).b-texture2D(uFx,vUv-vec2(.0011,0)).b;
 float dy=texture2D(uFx,vUv+vec2(0,.00085)).b-texture2D(uFx,vUv-vec2(0,.00085)).b;
 vec3 n=normalize(vNormal),view=normalize(vView);
 vec3 tangent=normalize(cross(vec3(0.0,1.0,0.0),n)),bitangent=normalize(cross(n,tangent));
 float grooves=sin(vUv.y*7200.0+sin(vUv.x*85.0)*2.0)*.012;
 vec3 micro=normalize(n+tangent*(dx*1.8+(grain-.5)*.028)+bitangent*(dy*1.8+grooves));
 vec3 reflection=reflect(-view,micro);
 float axis=reflection.x*.86+reflection.y*.42,moving=axis-uSweep*.66;
 float broad=exp(-pow((moving+.08)*3.5,2.0)),ribbon=exp(-pow(moving*12.0,2.0));
 float rim=exp(-pow((moving-.20)*31.0,2.0)),second=exp(-pow((axis+.46+uSweep*.12)*17.0,2.0));
 float shade=exp(-pow((moving+.30)*7.0,2.0));
 vec3 bronze=vec3(.24,.115,.026),gold=vec3(.78,.46,.12),champagne=vec3(1.0,.89,.59);
 vec3 metal=mix(bronze,gold,.32+broad*.58);
 metal=mix(metal,champagne,clamp(ribbon*.90+second*.36,0.0,1.0));
 metal*=1.0-shade*.40;metal+=vec3(1.0,.96,.79)*(rim*.70+pow(ribbon,6.0)*.18);
 metal*=.94+grain*.12;
 metal+=vec3(1.0,.86,.48)*step(.982,grain)*pow(ribbon,3.0)*.22;
 vec3 color=mix(art.rgb,metal,clamp(fx.r*1.12,0.0,1.0));
 color+=fx.g*vec3(1.0,.91,.73)*pow(max(dot(n,normalize(view+vec3(-.6,.8,2.0))),0.0),80.0)*.025;
 gl_FragColor=vec4(color,art.a*uOpacity);
 #include <colorspace_fragment>
}`;
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const cinematic=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t;
const MESSAGE_START=8;
export function storyPageDurations(design){return design.backs.map(face=>Math.max(7,Math.ceil(face.lines.join(' ').length/22+2)));}
export function storyDuration(design){return MESSAGE_START+storyPageDurations(design).reduce((a,b)=>a+b,0);}
export function openingPose(t){
 const reveal=cinematic(t/3.6),bloom=smooth(t/.65)*(1-smooth((t-1.5)/2.1));
 return {flip:0,page:0,scale:mix(.91,1,reveal),panX:0,panY:mix(-.10,0,reveal),x:mix(.035,0,reveal),y:mix(-.13,0,reveal),z:mix(-.012,0,reveal),opacity:smooth(t/.7),sweep:mix(-.8,.14,smooth(t/3.6)),bloom,floralDrift:reveal,ambience:t};
}
export function storyPose(t,design){
 const turn=cinematic((t-5.4)/2.15),durations=storyPageDurations(design);
 let page=0,start=MESSAGE_START;
 while(page<durations.length-1&&t>=start+durations[page])start+=durations[page++];
 if(t<MESSAGE_START)return {...openingPose(t),flip:turn,x:Math.sin(turn*Math.PI)*.045,z:-Math.sin(turn*Math.PI)*.016,sweep:t<4.2?openingPose(t).sweep:.14-.55*Math.sin(turn*Math.PI)};
 const elapsed=t-start,remaining=start+durations[page]-t;
 return {
  flip:1,page,scale:1.0+Math.sin(clamp(elapsed/durations[page])*Math.PI)*.008,panX:0,panY:0,
  x:.012*Math.sin(elapsed*.32),y:.025*Math.sin(elapsed*.28),z:0,
  sweep:.12+Math.sin(elapsed*.55)*.22,
  opacity:(page>0?smooth(elapsed/.32):1)*(page<durations.length-1?smooth(remaining/.28):1),ambience:t
 };
}
export class CardRenderer{
 constructor(design,{story=false,width=600,height=700}={}){
  this.story=story;this.currentPage=-1;this.design=design;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setPixelRatio(story?1:Math.min(devicePixelRatio,2));this.renderer.setClearColor(0,0);
  this.canvas=this.renderer.domElement;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(30,1,.1,50);
  this.root=new THREE.Group();this.scene.add(this.root);this.materials=[];this.textures=[];
  this.accents=(design.accents||[]).map(art=>{
   const map=new THREE.CanvasTexture(art);map.colorSpace=THREE.SRGBColorSpace;this.textures.push(map);
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.55,1.92),new THREE.MeshBasicMaterial({map,transparent:true,opacity:0,depthWrite:false}));this.scene.add(mesh);return mesh;
  });
  this.front=new THREE.Mesh(new THREE.PlaneGeometry(3,4),this.material(design.front));this.front.position.z=.042;this.root.add(this.front);
  this.back=new THREE.Mesh(new THREE.PlaneGeometry(3,4),this.material(design.backs[0]));this.back.rotation.y=Math.PI;this.back.position.z=-.042;this.root.add(this.back);
  this.edge=new THREE.Mesh(new THREE.BoxGeometry(2.996,3.996,.070),new THREE.MeshStandardMaterial({color:'#d8cba8',roughness:.65,metalness:.12,transparent:true}));this.root.add(this.edge);
  this.trimMaterial=new THREE.MeshStandardMaterial({color:'#d5ad62',roughness:.27,metalness:.88,transparent:true});
  this.trims=[-.037,.037].map(z=>{const m=new THREE.Mesh(new THREE.BoxGeometry(2.999,3.999,.007),this.trimMaterial);m.position.z=z;this.root.add(m);return m;});
  this.scene.add(new THREE.HemisphereLight('#fff1d5','#14251d',2.1));
  const key=new THREE.DirectionalLight('#fff3d8',3.5);key.position.set(-4,6,8);this.scene.add(key);
  const rim=new THREE.DirectionalLight('#dfb96a',1.6);rim.position.set(5,-1,3);this.scene.add(rim);
  const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');ctx.filter='blur(38px)';ctx.fillStyle='#000';ctx.fillRect(100,75,312,362);
  const map=new THREE.CanvasTexture(c);this.textures.push(map);
  this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.5,4.6),new THREE.MeshBasicMaterial({map,transparent:true,opacity:.12,depthWrite:false}));this.shadow.position.set(.04,-.05,-2.05);this.scene.add(this.shadow);
  this.resize(width,height);
 }
 material(face){
  const art=new THREE.CanvasTexture(face.art);art.colorSpace=THREE.SRGBColorSpace;const fx=new THREE.CanvasTexture(face.fx);
  [art,fx].forEach(t=>{t.anisotropy=this.renderer.capabilities.getMaxAnisotropy();this.textures.push(t);});
  const mat=new THREE.ShaderMaterial({uniforms:{uArt:{value:art},uFx:{value:fx},uSweep:{value:0},uOpacity:{value:1}},vertexShader:vertex,fragmentShader:fragment,side:THREE.FrontSide,transparent:true});
  this.materials.push(mat);return mat;
 }
 setPage(page){
  if(page===this.currentPage)return;this.currentPage=page;
  const old=this.back.material;this.back.material=this.material(this.design.backs[page]);old.dispose();
  [old.uniforms.uArt.value,old.uniforms.uFx.value].forEach(t=>{t.dispose();this.textures=this.textures.filter(x=>x!==t);});this.materials=this.materials.filter(m=>m!==old);
 }
 resize(width,height){
  this.renderer.setSize(width,height,false);const aspect=width/height,h=this.story?6.4:Math.max(4.8,3.5/aspect);
  this.camera.aspect=aspect;this.camera.position.z=h/(2*Math.tan(Math.PI/12));this.camera.updateProjectionMatrix();
 }
 draw({flip=0,page=0,x=0,y=0,z=0,sweep=0,scale=1,panX=0,panY=0,opacity=1,bloom=0,floralDrift=0}={}){
  this.setPage(page);this.root.rotation.set(x,flip*Math.PI+y,z);this.root.scale.setScalar(scale);this.root.position.set(panX,panY,0);
  // A face-on shadow must not stay wide and dark when the card is edge-on.
  const projection=Math.abs(Math.cos(flip*Math.PI+y)*Math.cos(x));
  this.shadow.scale.set(scale*projection,scale,1);this.shadow.position.set(panX+.04,panY-.05,-2.05);
  this.shadow.material.opacity=.12*Math.pow(projection,1.5)*opacity;
  this.shadow.visible=projection>.035&&opacity>.001;
  this.edge.material.opacity=opacity;this.trimMaterial.opacity=opacity;
  this.accents.forEach((mesh,i)=>{const side=i?-1:1;mesh.visible=bloom>.001;mesh.material.opacity=bloom*.78;mesh.position.set(-side*(1.17+floralDrift*.12),side*(1.66+floralDrift*.12),-.85);mesh.rotation.z=side*(.07+floralDrift*.05);mesh.scale.setScalar(.95+floralDrift*.09);});
  this.materials.forEach(m=>{m.uniforms.uSweep.value=sweep;m.uniforms.uOpacity.value=opacity;});this.renderer.render(this.scene,this.camera);return this.canvas;
 }
 dispose(){
  this.textures.forEach(t=>t.dispose());this.materials.forEach(m=>m.dispose());this.root.children.forEach(m=>m.geometry?.dispose());
  this.edge.material.dispose();this.trimMaterial.dispose();this.shadow.geometry.dispose();this.shadow.material.dispose();this.renderer.dispose();this.canvas.remove();
  this.accents.forEach(m=>{m.geometry.dispose();m.material.dispose();});
 }
}
export function drawFlat(ctx,design,pose,width,height){
 const face=pose.flip>.5?design.backs[pose.page||0]:design.front,scale=pose.scale??1,w=width*.833*scale,h=w*4/3;
 const compress=Math.max(.012,Math.abs(Math.cos((pose.flip||0)*Math.PI+(pose.y||0))));
 if(pose.bloom)for(let i=0;i<(design.accents||[]).length;i++){
  const side=i?-1:1,drift=pose.floralDrift||0;ctx.save();ctx.globalAlpha=pose.bloom*.78;
  ctx.translate(width/2-side*(1.17+drift*.12)*width/3.6,height/2-side*(1.66+drift*.12)*height/6.4);ctx.rotate(-side*(.07+drift*.05));
  ctx.drawImage(design.accents[i],-width*.215,-height*.15,width*.43,height*.30);ctx.restore();
 }
 ctx.save();ctx.globalAlpha=pose.opacity??1;
 ctx.translate(width/2+(pose.panX||0)*width/3.6,height/2-(pose.panY||0)*height/6.4);
 ctx.rotate(-(pose.z||0));ctx.scale(compress,1);ctx.shadowColor=`rgba(7,16,12,${.08*compress})`;ctx.shadowBlur=8+14*compress;ctx.shadowOffsetY=4*compress;
 ctx.drawImage(face.art,-w/2,-h/2,w,h);ctx.restore();
}
export function storyBackground(ctx,width,height,pose={}){
 const t=pose.ambience||0,x=width*(.45+Math.sin(t*.13)*.035),y=height*.43;
 const gradient=ctx.createRadialGradient(x,y,10,x,y,height*.64);
 gradient.addColorStop(0,'#3b5038');gradient.addColorStop(.50,'#23372a');gradient.addColorStop(1,'#09170f');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
 const glow=ctx.createRadialGradient(width*.18,height*.15,0,width*.18,height*.15,width*.8);
 glow.addColorStop(0,'#b9984720');glow.addColorStop(1,'#b9984700');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
}
