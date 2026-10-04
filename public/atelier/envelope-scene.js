import * as THREE from './vendor/three.module.js';
import {vertex,fragment} from './keepsake-renderer.js?v=7';

const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
export function envelopePose(t=0){
 const hinge=ease((t-.18)/1.05),lift=ease((t-.80)/1.22),settle=ease((t-1.80)/1.05),exit=ease((t-2.60)/.80);
 return {hinge,seal:1-ease(t/.50),pocketY:-3.8*lift,cardY:1.10*lift*(1-settle),cardZ:.075+.10*settle,cardTilt:-.06*Math.sin(lift*Math.PI),sweep:-.7+1.5*ease(t/2.8),bloom:1-ease((t-.4)/1.8),opacity:1-exit};
}
function shape(points){
 const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
 const g=new THREE.ShapeGeometry(s),p=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+1.5)/3,(p.getY(i)+2)/4);
 return g;
}
export class EnvelopeScene{
 constructor(design,{reduced=false}={}){
  this.reduced=reduced;this.maps=[];this.materials=[];this.geometries=[];
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0,0);
  this.canvas=this.renderer.domElement;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(30,1,.1,50);
  this.root=new THREE.Group();this.scene.add(this.root);this.envelope=new THREE.Group();this.root.add(this.envelope);
  this.card=this.mesh(new THREE.PlaneGeometry(2.93,3.91),this.foil(design.front));this.card.position.z=.075;this.root.add(this.card);
  const back=this.mesh(new THREE.PlaneGeometry(3,4),new THREE.MeshBasicMaterial({color:'#273d2c'}));this.envelope.add(back);
  const rim=this.mesh(new THREE.BoxGeometry(3.015,4.015,.032),new THREE.MeshBasicMaterial({color:'#b99758'}));rim.position.z=-.022;this.envelope.add(rim);
  this.pocket=this.mesh(shape([[-1.5,2],[0,1.0],[1.5,2],[1.5,-2],[-1.5,-2]]),this.foil(design.front));this.pocket.position.z=.13;this.envelope.add(this.pocket);
  this.flap=new THREE.Group();this.flap.position.set(0,2,.135);this.envelope.add(this.flap);
  const flap=this.mesh(shape([[-1.5,2],[1.5,2],[0,1.0]]),this.foil(design.front));flap.position.y=-2;this.flap.add(flap);
  const line=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.5,0,.009),new THREE.Vector3(0,-1.0,.009),new THREE.Vector3(1.5,0,.009)]);this.geometries.push(line);
  this.foldMaterial=new THREE.LineBasicMaterial({color:'#e7c276',transparent:true,opacity:.85});this.materials.push(this.foldMaterial);this.flap.add(new THREE.Line(line,this.foldMaterial));
  const seal=document.createElement('canvas');seal.width=256;seal.height=256;const c=seal.getContext('2d');
  c.beginPath();c.arc(128,128,119,0,Math.PI*2);c.clip();
  const gold=c.createRadialGradient(90,70,1,140,130,170);gold.addColorStop(0,'#f5e1a7');gold.addColorStop(.50,'#c6a066');gold.addColorStop(1,'#805e30');c.fillStyle=gold;c.fillRect(0,0,256,256);
  c.strokeStyle='#f2dab0';c.lineWidth=3;c.beginPath();c.arc(128,128,100,0,Math.PI*2);c.stroke();c.globalCompositeOperation='multiply';c.drawImage(design.mark,69,63,118,130);
  this.sealMaterial=new THREE.MeshBasicMaterial({map:this.texture(seal),transparent:true});this.materials.push(this.sealMaterial);
  this.seal=this.mesh(new THREE.PlaneGeometry(.48,.48),this.sealMaterial);this.seal.position.set(0,1.0,.16);this.envelope.add(this.seal);
  this.accents=(design.accents||[]).map((art,i)=>{const m=this.mesh(new THREE.PlaneGeometry(1.52,1.83),new THREE.MeshBasicMaterial({map:this.texture(art),transparent:true,opacity:.70,depthWrite:false}));m.position.set(i?1.12:-1.12,i?-1.78:1.73,-.15);this.scene.add(m);return m;});
  const shadow=document.createElement('canvas');shadow.width=512;shadow.height=512;const sc=shadow.getContext('2d');sc.filter='blur(44px)';sc.fillStyle='#000';sc.fillRect(120,80,280,345);
  this.shadowMaterial=new THREE.MeshBasicMaterial({map:this.texture(shadow),transparent:true,opacity:.08,depthWrite:false});this.materials.push(this.shadowMaterial);
  this.shadow=this.mesh(new THREE.PlaneGeometry(3.65,4.5),this.shadowMaterial);this.shadow.position.set(.05,-.10,-1);this.scene.add(this.shadow);
 }
 texture(canvas){const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;this.maps.push(map);return map;}
 foil(face){const art=this.texture(face.art),fx=new THREE.CanvasTexture(face.fx);this.maps.push(fx);const m=new THREE.ShaderMaterial({uniforms:{uArt:{value:art},uFx:{value:fx},uSweep:{value:.12},uOpacity:{value:1}},vertexShader:vertex,fragmentShader:fragment,transparent:true,side:THREE.DoubleSide});this.materials.push(m);return m;}
 mesh(geometry,material){this.geometries.push(geometry);if(!this.materials.includes(material))this.materials.push(material);return new THREE.Mesh(geometry,material);}
 resize(width,height){this.renderer.setSize(width,height,false);const aspect=width/height,h=Math.max(5.55,3.7/aspect);this.camera.aspect=aspect;this.camera.position.z=h/(2*Math.tan(Math.PI/12));this.camera.updateProjectionMatrix();}
 draw({time=0,opening=false,x=0,y=0}={}){
  const p=opening?envelopePose(time):{hinge:0,seal:1,pocketY:0,cardY:0,cardZ:.075,cardTilt:0,sweep:this.reduced?.14:.14+x*.75,bloom:1,opacity:1};
  this.root.rotation.set(this.reduced?0:-y*.025,this.reduced?0:x*.065,0);
  this.envelope.position.y=p.pocketY;this.flap.rotation.x=-p.hinge*Math.PI*.95;
  this.card.position.set(0,p.cardY,p.cardZ);this.card.rotation.set(p.cardTilt,0,0);
  this.seal.position.z=.16+(1-p.seal)*.4;this.seal.scale.setScalar(.90+.1*p.seal);this.sealMaterial.opacity=p.seal;
  this.materials.forEach(m=>{if(m.uniforms){m.uniforms.uSweep.value=p.sweep;m.uniforms.uOpacity.value=p.opacity;}});
  this.accents.forEach((m,i)=>{m.material.opacity=p.bloom*.60*p.opacity;m.rotation.z=(i?-1:1)*(.04+(1-p.bloom)*.06);});
  this.shadowMaterial.opacity=.08*(opening?1-ease(time/1.5):1);this.foldMaterial.opacity=.85*p.opacity;
  this.renderer.render(this.scene,this.camera);
 }
 dispose(){this.maps.forEach(m=>m.dispose());this.materials.forEach(m=>m.dispose());this.geometries.forEach(g=>g.dispose());this.renderer.dispose();this.canvas.remove();}
}
