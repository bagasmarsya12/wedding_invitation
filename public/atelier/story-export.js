import {CardRenderer,storyPose,storyDuration,storyBackground,drawFlat} from './keepsake-renderer.js?v=7';
export const STORY_SIZE={width:1080,height:1920};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
export function makeStoryScene(design){
 const canvas=document.createElement('canvas');Object.assign(canvas,STORY_SIZE);const ctx=canvas.getContext('2d');let renderer;
 try{renderer=new CardRenderer(design,{story:true,...STORY_SIZE});}catch{renderer=null;}
 return {canvas,draw(pose){storyBackground(ctx,canvas.width,canvas.height,pose);if(renderer)ctx.drawImage(renderer.draw(pose),0,0);else drawFlat(ctx,design,pose,canvas.width,canvas.height);return canvas;},dispose(){renderer?.dispose();}};
}
export async function exportImage(design,back=false,page=0){
 const scene=makeStoryScene(design);scene.draw({flip:back?1:0,page,x:0,y:back?.015:-.045,sweep:back?.24:.14});
 try{return await new Promise((resolve,reject)=>scene.canvas.toBlob(b=>b?resolve(b):reject(new Error('Gambar belum bisa disimpan. Coba lagi.')),'image/png'));}finally{scene.dispose();}
}
export async function exportVideo(design,{signal,onProgress=()=>{}}={}){
 const scene=makeStoryScene(design),duration=storyDuration(design);let output,source;
 const abort=()=>{if(signal?.aborted)throw new DOMException('Dibatalkan','AbortError');};
 try{
  abort();const {Output,Mp4OutputFormat,BufferTarget,CanvasSource}=await import('./vendor/mediabunny.mjs');
  output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target:new BufferTarget()});
  source=new CanvasSource(scene.canvas,{codec:'avc',bitrate:6_000_000,keyFrameInterval:2});output.addVideoTrack(source,{frameRate:30});await output.start();
  const total=Math.ceil(duration*30);
  for(let i=0;i<total;i++){abort();scene.draw(storyPose(i/30,design));await source.add(i/30,1/30);if(i%6===0){onProgress(Math.round(i/total*98));await tick();}}
  abort();source.close();await output.finalize();onProgress(100);return new Blob([output.target.buffer],{type:'video/mp4'});
 }catch(error){
  if(output)await output.cancel().catch(()=>{});if(error.name==='AbortError')throw error;
  if(typeof MediaRecorder==='undefined'||!MediaRecorder.isTypeSupported('video/mp4'))throw new Error('Video belum didukung di browser ini. Buka dengan Safari atau Chrome terbaru; gambar Story tetap bisa disimpan.');
  // Native MP4 recording is a compatibility fallback when WebCodecs is absent.
  return await recordMp4(scene,design,{signal,onProgress,duration});
 }finally{scene.dispose();}
}
function recordMp4(scene,design,{signal,onProgress,duration}){
 return new Promise((resolve,reject)=>{
  const stream=scene.canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/mp4',videoBitsPerSecond:6_000_000}),chunks=[];let frame=0,start=0,finished=false;
  const cleanup=()=>{cancelAnimationFrame(frame);stream.getTracks().forEach(t=>t.stop());signal?.removeEventListener('abort',cancel);};
  const cancel=()=>{if(finished)return;finished=true;if(recorder.state!=='inactive')recorder.stop();cleanup();reject(new DOMException('Dibatalkan','AbortError'));};
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted){cancel();return;}
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=()=>{finished=true;cleanup();reject(new Error('Video belum bisa disimpan. Coba lagi.'));};
  recorder.onstop=()=>{if(finished)return;finished=true;cleanup();onProgress(100);resolve(new Blob(chunks,{type:'video/mp4'}));};
  scene.draw(storyPose(0,design));recorder.start();
  const draw=time=>{if(!start)start=time;const t=(time-start)/1000;scene.draw(storyPose(t,design));onProgress(Math.min(98,Math.round(t/duration*98)));if(t>=duration)recorder.stop();else frame=requestAnimationFrame(draw);};frame=requestAnimationFrame(draw);
 });
}
