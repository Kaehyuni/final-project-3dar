/** Reassemble the reviewed release in Netlify, preserving the published AR assets. */
import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(await readFile(join(here,'cloud-release-manifest.json'),'utf8'));
const baseline='https://6af7eec8b34e464cd710189f--khn-3dar-rlc.netlify.app';
const reviewedHandouts='https://6afd177a9c3d20fb75801a83--khn-3dar-rlc.netlify.app';
const publicOrigin='https://khn-3dar-rlc.com';
const localRoot=process.argv[2]==='--verify-local'?resolve(process.argv[3]):null;
const output=resolve('dist-biobridge');
const update=JSON.parse(await readFile(join(here,'android-ar-update.json'),'utf8'));
assert(update.version==='2026-11-19'&&update.files.length===14,'Incomplete Android update');
assert(new Set(update.files.map(x=>x.path)).size===update.files.length,'Duplicate update paths');
for(const file of update.files){
  assert(/^(?:cr8zar\/[a-z0-9/.-]+\.(?:js|html|json)|js\/cell\.js|cell\.html)$/.test(file.path),'Unexpected update path');
  assert(!file.path.split('/').includes('..'),'Unsafe update path');
  assert(typeof file.content==='string'&&file.content.length>0,'Empty source update');
  assert(createHash('sha1').update(file.content).digest('hex')===file.sha1,'Update digest mismatch: '+file.path);
}

const sha1=data=>createHash('sha1').update(data).digest('hex');
assert(manifest.length===860,'The complete release must contain 860 files');
assert(new Set(manifest.map(x=>x.path)).size===manifest.length,'Duplicate release paths');
assert(manifest.filter(x=>x.path.startsWith('handouts/topics/')&&x.path.endsWith('.pdf')).length===163,'All 163 handouts must be included');
assert(manifest.filter(x=>x.source==='handouts').length===171,'Incomplete handout overlay');
for(const file of manifest){
  assert(!file.path.startsWith('/')&&!file.path.split('/').includes('..'),'Unsafe release path');
  assert(['baseline','handouts'].includes(file.source),'Unexpected asset source');
  assert(/^[a-f0-9]{40}$/.test(file.sha1),'Invalid source digest');
}
if(!localRoot){
  assert(new URL(reviewedHandouts).hostname.endsWith('--khn-3dar-rlc.netlify.app'),'Use the verified project preview');
  assert(output===join(process.cwd(),'dist-biobridge'),'Unexpected output directory');
  await rm(output,{recursive:true,force:true});
  await mkdir(output,{recursive:true});
}
function validateSignature(file,data,type=''){
  assert(data.length>0,'Empty asset '+file.path);
  if(file.path.endsWith('.pdf'))assert(data.subarray(0,5).toString()==='%PDF-','Invalid PDF '+file.path);
  if(file.path.endsWith('.glb'))assert(data.subarray(0,4).toString()==='glTF','Invalid GLB '+file.path);
  if(file.path.endsWith('.usdz'))assert(data[0]===0x50&&data[1]===0x4b,'Invalid USDZ '+file.path);
  if(!/\.html?$/.test(file.path)&&!file.path.endsWith('.toml')&&file.path!=='_headers')assert(!type.includes('text/html'),'HTML returned for asset '+file.path);
}
async function getAsset(file){
  if(localRoot)return {data:await readFile(join(localRoot,file.path)),origin:'local'};
  // Netlify rewrites HTML links after upload. Use the reviewed source from Git.
  if(file.source==='handouts'&&file.path.endsWith('.html'))return {data:await readFile(join(here,file.path)),origin:'Git source'};
  if(Object.hasOwn(file,'text'))return {data:Buffer.from(file.text,'utf8'),origin:'reviewed configuration'};
  const origin=file.source==='handouts'?reviewedHandouts:baseline;
  const route=file.path.replace(/index\.html$/,'').split('/').map(encodeURIComponent).join('/');
  let lastError;
  for(const host of [origin,publicOrigin]){
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(host+'/'+route,{signal:AbortSignal.timeout(180000)});
        assert(response.ok,'HTTP '+response.status+' for '+file.path);
        const data=Buffer.from(await response.arrayBuffer());
        validateSignature(file,data,response.headers.get('content-type')||'');
        // The immutable production deployment is authoritative for pre-existing assets.
        // Reviewed handouts and any live-domain fallback must match their saved digest.
        if(file.source==='handouts'||host===publicOrigin)assert(sha1(data)===file.sha1,'Digest mismatch for '+file.path);
        return {data,origin:host};
      }catch(error){lastError=error;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
    }
  }
  throw lastError;
}
let next=0,completed=0,totalBytes=0;
const evidence=[];
await Promise.all(Array.from({length:4},async()=>{
  while(next<manifest.length){
    const file=manifest[next++];
    const {data,origin}=await getAsset(file);
    validateSignature(file,data);
    if(localRoot||file.source==='handouts')assert(sha1(data)===file.sha1,'Reviewed bytes differ: '+file.path);
    if(!localRoot){
      const target=join(output,file.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,data);
    }
    totalBytes+=data.length;completed++;
    evidence.push({path:file.path,sha1:sha1(data),bytes:data.length,origin});
    if(completed%100===0)console.log('Verified and assembled',completed,'of',manifest.length,'files');
  }
}));
assert(evidence.length===860,'Incomplete assembled release');
// Apply the reviewed text source only after the complete asset release verifies.
// Existing PDFs, GLBs, USDZs, and their checksums remain part of the base release.
for(const file of update.files){
  const data=Buffer.from(file.content,'utf8');
  const previous=evidence.findIndex(entry=>entry.path===file.path);
  if(!localRoot){
    const target=join(output,file.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,data);
  }
  const entry={path:file.path,sha1:sha1(data),bytes:data.length,origin:'Reviewed Android source in Git'};
  if(previous<0){evidence.push(entry);totalBytes+=data.length;}
  else{totalBytes+=data.length-evidence[previous].bytes;evidence[previous]=entry;}
}
assert(evidence.length===863,'The updated complete release must contain 863 files');
completed=evidence.length;

const library=JSON.parse(await readFile(join(localRoot||output,'data/handout-library.json'),'utf8'));
assert(library.items.length===163,'Expected all 163 printable entries');
const paths=new Set(evidence.map(x=>x.path));
for(const item of library.items)assert(paths.has(item.guideUrl.replace(/^\//,'')),'Missing handout: '+item.title);
console.log('Complete BioBridge release:',completed,'files;',totalBytes,'bytes; 163 printable handouts.');
if(!localRoot)await writeFile('biobridge-build-evidence.json',JSON.stringify(evidence,null,2));
