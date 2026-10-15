// Add derived previews only. Never writes original objects, settings, or guest tables.
import { readFile, writeFile, mkdtemp, rm, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archivePreviewKey, validPreviewBytes } from '../lib/archive-media.ts';
import { isCmsPhotoKey } from '../lib/cms-photo-upload.ts';

const root = fileURLToPath(new URL('..', import.meta.url)), args = process.argv.slice(2);
const manifestArg = args[args.indexOf('--manifest') + 1];
if (!args.includes('--manifest') || !manifestArg) throw new Error('Pass --manifest with the verified asset manifest. Add --upload to write derivatives.');
const manifestPath = await realpath(resolve(manifestArg)), directory = dirname(manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const ids = JSON.parse(await readFile(new URL('../deploy/cloudflare.json', import.meta.url), 'utf8'));
const temporary = await mkdtemp(resolve(tmpdir(), 'archive-preview-backfill-'));
const config = resolve(temporary, 'wrangler.json');
const local = args.includes('--local'), persist = args.includes('--persist-to') ? args[args.indexOf('--persist-to') + 1] : resolve(root, '.wrangler/state');
const run = promisify(execFile), hash = bytes => createHash('sha256').update(bytes).digest('hex');
await writeFile(config, JSON.stringify({name:ids.worker_name,account_id:ids.account_id,compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:ids.database_name,database_id:ids.database_id}],r2_buckets:[{binding:'BUCKET',bucket_name:ids.bucket_name}]}));
const scope = local ? ['--local','--persist-to',persist] : ['--remote'];
async function wrangler(arguments_) {
  return run(process.execPath, [resolve(root,'node_modules/wrangler/bin/wrangler.js'), ...arguments_, '--config', config, ...scope], {cwd:root,maxBuffer:4*1024*1024,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
}
async function workers(items, count, fn) {
  const queue = [...items]; await Promise.all(Array.from({length:count}, async()=>{while(queue.length) await fn(queue.shift());}));
}
async function safeFile(path) {
  const file = await realpath(resolve(path)); if (!file.startsWith(directory + sep)) throw new Error('Manifest files must stay beside the manifest.');
  return file;
}
try {
  const sql = "SELECT key,value,updated_at FROM settings WHERE key LIKE 'media.gallery-%' ORDER BY key";
  const result = JSON.parse((await wrangler(['d1','execute','DB','--command',sql,'--json'])).stdout);
  const rows = result.flatMap(result=>result.results??[]), sources = new Map(rows.map(row=>[row.key,row.value]));
  const settingsHash = hash(JSON.stringify(rows));
  const uploads = [];
  console.log(`Verifying ${manifest.entries.length} original gallery objects before any preview upload.`);
  await workers(manifest.entries, 3, async entry=>{
    const slot = entry.key, originalKey = sources.get('media.'+slot);
    if (!originalKey || !isCmsPhotoKey(slot,originalKey)) throw new Error(`No valid published original for ${slot}.`);
    const originalPath = await safeFile(entry.original.path);
    if(hash(await readFile(originalPath))!==entry.original.sha256) throw new Error(`Local original changed: ${slot}.`);
    const remoteOriginal = resolve(temporary,slot+'.original');
    await wrangler(['r2','object','get',`${ids.bucket_name}/${originalKey}`,'--file',remoteOriginal]);
    if(hash(await readFile(remoteOriginal))!==entry.original.sha256) throw new Error(`Published original changed: ${slot}. Regenerate its previews first.`);
    await rm(remoteOriginal);
    for(const [variant,output] of Object.entries(entry.outputs)) {
      if(!['card','large','motion'].includes(variant)) continue;
      const file=await safeFile(output.path), bytes=await readFile(file), type=variant==='motion'?'video/mp4':'image/webp';
      if(hash(bytes)!==output.sha256 || !validPreviewBytes(variant,type,bytes)) throw new Error(`Invalid verified preview: ${slot}/${variant}.`);
      const key=await archivePreviewKey(originalKey,variant);
      if(!/^content\/previews\/archive-v1\/[a-f0-9]{64}\/(card\.webp|large\.webp|motion\.mp4)$/.test(key)) throw new Error('Refusing to write outside preview namespace.');
      uploads.push({slot,variant,key,file,type,bytes:bytes.length,sha256:output.sha256});
    }
    console.log(`Verified ${slot}.`);
  });
  const report={mode:args.includes('--upload')?'upload':'verify-only',count:uploads.length,bytes:uploads.reduce((n,u)=>n+u.bytes,0),settingsHashBefore:settingsHash,objects:uploads.map(({slot,variant,key,bytes,sha256})=>({slot,variant,key,bytes,sha256}))};
  if(args.includes('--upload')) {
    console.log(`Uploading ${uploads.length} verified derivatives; original media and DB mappings remain intact.`);
    await workers(uploads,3,async upload=>{
      await wrangler(['r2','object','put',`${ids.bucket_name}/${upload.key}`,'--file',upload.file,'--content-type',upload.type,'--cache-control','public, max-age=31536000, immutable']);
      console.log(`Uploaded ${upload.slot}/${upload.variant}.`);
    });
  }
  const after = JSON.parse((await wrangler(['d1','execute','DB','--command',sql,'--json'])).stdout).flatMap(result=>result.results??[]);
  report.settingsHashAfter=hash(JSON.stringify(after));
  if(report.settingsHashAfter!==settingsHash) throw new Error('Published media changed during the backfill. Review the current mapping before release.');
  await writeFile(resolve(directory,'backfill-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({mode:report.mode,objects:report.count,bytes:report.bytes,publishedMappingsUnchanged:true}));
} finally { await rm(temporary,{recursive:true,force:true}); }
