import { readFile } from 'node:fs/promises';
import { resolve,sep } from 'node:path';
import type { Plugin } from 'vite';

/** The approved Atelier package contains native browser modules, served unchanged. */
export function atelierPublicModules():Plugin {
  return {name:'atelier-public-modules',apply:'serve',enforce:'pre',configureServer(server){
    const root=resolve(server.config.publicDir);
    server.middlewares.use(async(request,response,next)=>{
      if(request.method!=='GET'&&request.method!=='HEAD')return next();
      let pathname:string;try{pathname=decodeURIComponent(new URL(request.url??'','http://localhost').pathname);}catch{return next();}
      if(!pathname.startsWith('/atelier/')||!pathname.endsWith('.js'))return next();
      const file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep))return next();
      try{const body=await readFile(file);response.statusCode=200;response.setHeader('Content-Type','application/javascript; charset=utf-8');response.setHeader('Cache-Control','no-store');response.end(request.method==='HEAD'?undefined:body);}catch{next();}
    });
  }};
}
