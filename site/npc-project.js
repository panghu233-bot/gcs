/* Read-only cultivation NPC adapter. Source files and image bytes remain in the local browser. */
(function(root){
'use strict';
const paths={visuals:'scripts/cultivation/ui/cultivation_scene_visuals.gd',data:'scripts/cultivation/cultivation_data.gd',story:'scripts/cultivation/cultivation_story_events.gd',commission:'scripts/cultivation/teahouse_commission_dialogue.gd',enemies:'data/enemies/basic_enemies.json'};
const han=s=>/[\u3400-\u9fff]/u.test(s)&&s.length>=2&&s.length<=24;
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]/gu,'');
const escapeRegex=s=>s.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
function objectAt(text,start){
 const begin=text.indexOf('{',start);if(begin<0)return '';
 let depth=0,quote='',slash=false,comment=false;
 for(let i=begin;i<text.length;i++){
  const c=text[i];
  if(comment){if(c==='\n')comment=false;continue;}
  if(quote){if(slash)slash=false;else if(c==='\\')slash=true;else if(c===quote)quote='';continue;}
  if(c==='#'){comment=true;continue;}
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='{')depth++;
  if(c==='}'&&!--depth)return text.slice(begin,i+1);
 }
 return '';
}
function indexFromSources(sources){
 const visual=sources.visuals||'',data=sources.data||'';
 if(!visual.trim())throw Error('缺少养成立绘映射：'+paths.visuals);
 const people=new Map();
 function add(name,portrait,source,hero){
  if(!han(name))return;
  const id='cultivation:'+name,existing=people.get(id);
  if(existing){
   if(!existing.portraitRef&&portrait)existing.portraitRef=portrait;
   if(hero){existing.npcKind='hero';existing.role='英雄';}
   if(!existing.sources.includes(source))existing.sources.push(source);
  }else people.set(id,{id,name,role:hero?'英雄':'养成 NPC',npcKind:hero?'hero':'unverified',portraitRef:portrait||'',image:'',sources:[source],events:[],enemy:null});
 }
 // Exact speaker-name keys from the dedicated cultivation visual source only.
 const direct=/["']([^"'\\\r\n]{2,30})["']\s*:\s*(?:["']([^"'\\\r\n]+)["']|(?:preload|load)\(\s*["']([^"'\\\r\n]+)["']\s*\)|\{)/g;
 let m;
 while((m=direct.exec(visual))){
  if(!han(m[1]))continue;
  const literal=m[2]||m[3]||'';
  if(literal&&(han(literal)||/^(?:true|false|null|\d+)$/i.test(literal)))continue;
  const trailing=visual.slice(m.index,m.index+260);
  const embedded=trailing.match(/(?:res:\/\/|assets\/)[^"'\s,)]+\.(?:png|jpe?g|webp)|["']([a-z][\w./-]*\.(?:png|jpe?g|webp))["']/i);
  const ref=literal||embedded?.[0]?.replace(/^["']|["']$/g,'')||'';
  if(ref)add(m[1],ref,paths.visuals,false);
 }
 // Also accept literal Godot match branches.
 const branches=/^\s*["']([^"'\\\r\n]{2,30})["']\s*:\s*(?:return\s+)?(?:preload|load)?\s*\(?\s*["']([^"'\\\r\n]+)["']/gm;
 while((m=branches.exec(visual)))if(han(m[1])&&!han(m[2]))add(m[1],m[2],paths.visuals,false);
 // Hero status needs a source-backed match: never infer it from teahouse encounters.
 const pos=data.search(/\bHERO_AFFINITY_CONFIG\b\s*(?::[^=\n]+)?(?:=|:=)\s*\{/);
 const config=pos<0?'':objectAt(data,pos);
 if(config){
  const entries=/"([^"\r\n]+)"\s*:\s*\{/g;let e;
  while((e=entries.exec(config))){
   const inner=objectAt(config,e.index);
   const explicit=inner.match(/["'](?:name|display_name|npc_name|character_name)["']\s*:\s*["']([\u3400-\u9fff][^"'\\\r\n]{0,20})["']/);
   if(explicit)add(explicit[1],'',paths.data,true);
   else{
    const found=Array.from(people.values()).find(p=>[p.name,p.portraitRef].some(v=>norm(v)===norm(e[1])));
    if(found)add(found.name,'',paths.data,true);
   }
  }
 }
 let enemyJson;try{enemyJson=JSON.parse(sources.enemies||'{"enemies":[]}');}catch{throw Error('敌人 JSON 解析失败：'+paths.enemies);}
 if(!Array.isArray(enemyJson.enemies))throw Error('敌人 JSON 缺少 enemies 数组');
 for(const p of people.values()){
  for(const key of ['data','story','commission']){
   const src=sources[key]||'';
   const expr=new RegExp('(?:["\\x27]?(?:speaker|left|right)["\\x27]?)\\s*:\\s*["\\x27]'+escapeRegex(p.name)+'["\\x27]','g');
   const count=Array.from(src.matchAll(expr)).length;
   if(count)p.events.push({source:paths[key],count});
  }
  const matches=enemyJson.enemies.filter(e=>e&&e.name===p.name&&typeof e.id==='string');
  if(matches.length===1)p.enemy={id:matches[0].id,max_hp:matches[0].max_hp,source:paths.enemies};
 }
 return Array.from(people.values()).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hans-CN'));
}
async function load(read,makeUrl){
 const source={};
 for(const key of ['visuals','data','story','commission','enemies']){
  const f=await read(paths[key]);
  if(!f){if(key==='visuals'||key==='enemies')throw Error('项目中缺少 '+paths[key]);source[key]='';continue;}
  if(f.size>4*1024*1024)throw Error('NPC 来源文件超过 4 MB：'+paths[key]);
  source[key]=await f.text();
 }
 const records=indexFromSources(source);
 if(!records.length)throw Error('没有在养成立绘映射中识别到人物；已停止加载，不使用演示数据代替');
 const urls=[];
 for(const person of records){
  const ref=person.portraitRef;if(!ref)continue;
  const candidates=[];
  if(ref.startsWith('res://'))candidates.push(ref.slice(6));
  else if(ref.startsWith('assets/'))candidates.push(ref);
  else if(/^[\w./-]+$/.test(ref)&&!ref.includes('..')){
   for(const root of ['assets/cultivation/portraits/npc/新版','assets/cultivation/portraits/npc','assets/cultivation/portraits']){
    if(/\.(?:png|jpe?g|webp)$/i.test(ref))candidates.push(root+'/'+ref);
    else candidates.push(root+'/'+ref+'.png',root+'/'+ref+'.webp');
   }
  }
  for(const candidate of new Set(candidates)){
   if(candidate.includes('..')||!/\.(?:png|jpe?g|webp)$/i.test(candidate))continue;
   const f=await read(candidate);
   if(f&&f.size<=8*1024*1024&&makeUrl){
    const url=makeUrl(f);person.image=url;person.portraitPath=candidate;urls.push(url);break;
   }
  }
 }
 return {records,release:()=>{if(typeof URL!=='undefined')for(const u of urls)URL.revokeObjectURL(u);}};
}
function fromHandle(handle){
 return load(async path=>{
  const parts=path.split('/');let dir=handle;
  try{for(const p of parts.slice(0,-1))dir=await dir.getDirectoryHandle(p,{create:false});
   return await (await dir.getFileHandle(parts.at(-1),{create:false})).getFile();
  }catch(e){if(e.name==='NotFoundError')return null;throw e;}
 },f=>URL.createObjectURL(f));
}
function fromFileList(fileList){
 const files=new Map();
 for(const f of fileList){const relative=f.webkitRelativePath.split('/').slice(1).join('/');if(relative)files.set(relative,f);}
 return load(async path=>files.get(path)||null,f=>URL.createObjectURL(f));
}
const api={paths,indexFromSources,fromHandle,fromFileList};
if(typeof module!=='undefined')module.exports=api;
root.GCSNPCProject=api;
})(typeof window!=='undefined'?window:globalThis);
