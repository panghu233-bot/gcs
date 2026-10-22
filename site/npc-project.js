/* Read-only cultivation NPC adapter. Private sources and image bytes stay in the browser. */
(function(root){
'use strict';
const paths={visuals:'scripts/cultivation/ui/cultivation_scene_visuals.gd',data:'scripts/cultivation/cultivation_data.gd',manager:'scripts/cultivation/cultivation_manager.gd',story:'scripts/cultivation/cultivation_story_events.gd',commission:'scripts/cultivation/teahouse_commission_dialogue.gd',player:'scripts/cultivation/ui/cultivation_dialogue_player.gd',guqin:'scripts/cultivation/ui/cultivation_guqin_portrait.gd',enemies:'data/enemies/basic_enemies.json'};
const isName=s=>typeof s==='string'&&/[\u3400-\u9fff]/u.test(s)&&s.length<=24&&s.trim()===s;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
// Small literal reader, never eval: comments, StringNames, nested dictionaries and arrays.
function tokens(text){
 const out=[],re=/#[^\r\n]*|&?("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|-?\d+(?:\.\d+)?|[A-Za-z_][\w]*|[^\s]/g;let m;
 while((m=re.exec(text))){if(m[0][0]==='#')continue;const raw=m[0];let value=raw,type='symbol';
  if(m[1]){type='string';value=m[1].slice(1,-1).replace(/\\([nrt\\"'])/g,(_,c)=>({n:'\n',r:'\r',t:'\t'}[c]??c));}
  else if(/^-?\d/.test(raw)){type='number';value=Number(raw);}
  out.push({raw,value,type,pos:m.index});
 }return out;
}
function valueAt(ts,start,env={}){
 const t=ts[start];if(!t)return {end:start,value:undefined};
 if(own(env,t.raw))return {end:start+1,value:env[t.raw]};
 if(t.type==='string'||t.type==='number')return {end:start+1,value:t.value};
 if(['true','false','null'].includes(t.raw))return {end:start+1,value:{true:true,false:false,null:null}[t.raw]};
 if(t.raw!=='{'&&t.raw!=='[')return {end:start+1,value:undefined};
 const object=t.raw==='{',close=object?'}':']',value=object?Object.create(null):[];let i=start+1;
 while(i<ts.length&&ts[i].raw!==close){
  if(ts[i].raw===','){i++;continue;}
  let key;
  if(object){key=ts[i++];if(ts[i]?.raw!==':')return {end:i,value:undefined};i++;}
  const item=valueAt(ts,i,env);i=item.end;
  // Expressions are not literal values. Skip to the next same-level separator.
  let literal=true,depth=0;
  while(i<ts.length&&(depth||![',',close].includes(ts[i].raw))){literal=false;const r=ts[i++].raw;if(['{','[','('].includes(r))depth++;if(['}',']',')'].includes(r))depth--;}
  if(literal&&item.value!==undefined){if(object&&key.type==='string'&&key.value!=='__proto__')value[key.value]=item.value;else if(!object)value.push(item.value);}
 }
 return {end:i+1,value:i<ts.length?value:undefined};
}
function literalConstants(text){
 const ts=tokens(text),out=Object.create(null);
 for(let i=0;i<ts.length;i++)if(ts[i].raw==='const'&&/^\w+$/.test(ts[i+1]?.raw||'')){
  const name=ts[i+1].raw;let j=i+2;while(j<ts.length&&ts[j].raw!=='='&&ts[j].raw!=='const'&&ts[j].raw!=='func')j++;
  if(ts[j]?.raw==='='){const parsed=valueAt(ts,j+1);if(parsed.value!==undefined)out[name]=parsed.value;}
 }return out;
}
function functionBlocks(text){
 const lines=text.split('\n'),out=[];let offset=0,classes=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i],indent=line.match(/^\s*/)[0].length,cl=line.match(/^\s*class\s+(\w+)/),fn=line.match(/^\s*(?:static\s+)?func\s+(\w+)\s*\(/);
  if(cl){classes=classes.filter(c=>c.indent<indent);classes.push({indent,name:cl[1],pos:offset});}
  if(fn){let end=i,depth=0;do{for(const t of tokens(lines[end])){if(t.raw==='(')depth++;if(t.raw===')')depth--;}end++;}while(end<lines.length&&depth>0);while(end<lines.length){const l=lines[end];if(l.trim()&&!/^\s*#/.test(l)&&l.match(/^\s*/)[0].length<=indent)break;end++;}
   const owner=classes.filter(c=>c.indent<indent).map(c=>c.name).join('.');
   out.push({name:fn[1],qualified:owner?owner+'.'+fn[1]:fn[1],line:i+1,pos:offset,scopePos:classes.filter(c=>c.indent<indent).at(-1)?.pos||0,code:lines.slice(i,end).join('\n').trimEnd()});
  }offset+=line.length+1;
 }return out;
}
function dictionaries(text){const ts=tokens(text),out=[];for(let i=0;i<ts.length;i++)if(ts[i].raw==='{'){const p=valueAt(ts,i);if(p.value&&!Array.isArray(p.value))out.push({value:p.value,pos:ts[i].pos});}return out;}
function assignment(code,field){const ts=tokens(code);for(let i=0;i<ts.length-3;i++)if(ts[i].raw==='.'&&ts[i+1].raw===field&&ts[i+2].raw==='=')return valueAt(ts,i+3).value;return undefined;}
function dialogueBranches(fn){
 if(fn?.name!=='get_dialogue_lines')return [];
 const lines=fn.code.split('\n'),out=[];let matchIndent=-1,offset=0;
 for(let i=0;i<lines.length;i++){
  const l=lines[i],indent=l.match(/^\s*/)[0].length;
  if(/^\s*match\s+\w+\s*:/.test(l))matchIndent=indent;
  const m=l.match(/^\s*(\w+)\s*:\s*$/);
  if(matchIndent>=0&&indent>matchIndent&&m&&(!out.length||indent===out[0].indent))out.push({label:m[1],pos:offset,line:fn.line+i,indent});
  offset+=l.length+1;
 }
 return out;
}
// Resolve only literal calls to a same-scope dictionary helper. No source is executed.
function dialogueEntries(text,blocks){
 const entries=[],templates=new Map();
 const scope=fn=>fn.qualified.slice(0,-fn.name.length);
 const constants=fn=>literalConstants(text.slice(fn.scopePos,fn.pos));
 for(const fn of blocks){
  const ts=tokens(fn.code),ret=ts.findIndex(t=>t.raw==='return');
  if(!fn.name.startsWith('_')||ret<0||ts[ret+1]?.raw!=='{'||ts.filter(t=>t.raw==='return').length!==1)continue;
  const params=[];let i=ts.findIndex(t=>t.raw==='(')+1;
  while(i<ts.length&&ts[i].raw!==')'){
   const name=ts[i++].raw;while(i<ts.length&&!['=',',',')'].includes(ts[i].raw))i++;
   let fallback;if(ts[i]?.raw==='='){const p=valueAt(ts,i+1,constants(fn));fallback=p.value;i=p.end;}
   params.push({name,fallback});if(ts[i]?.raw===',')i++;else if(ts[i]?.raw!==')')break;
  }
  templates.set(fn.qualified,{fn,params,ts:ts.slice(ret+1)});
 }
 for(const fn of blocks){
  if(templates.has(fn.qualified))continue;
  const ts=tokens(fn.code),env=constants(fn);
  for(let i=0;i<ts.length;i++){
   if(ts[i].raw==='{'){const p=valueAt(ts,i,env);if(p.value)entries.push({value:p.value,pos:fn.pos+ts[i].pos});}
   const helper=templates.get(scope(fn)+ts[i].raw);
   if(!helper||ts[i+1]?.raw!=='('||ts[i-1]?.raw==='.'||ts[i-1]?.raw==='func')continue;
   const args=[];let j=i+2,valid=true;
   while(j<ts.length&&ts[j].raw!==')'){
    const p=valueAt(ts,j,env);args.push(p.value);j=p.end;
    if(ts[j]?.raw===',')j++;else if(ts[j]?.raw!==')'){valid=false;break;}
   }
   if(!valid||args.length>helper.params.length)continue;
   const bound={...constants(helper.fn)};helper.params.forEach((p,k)=>{const v=k<args.length?args[k]:p.fallback;if(v!==undefined)bound[p.name]=v;});
   const d=valueAt(helper.ts,0,bound).value;if(d)entries.push({value:d,pos:fn.pos+ts[i].pos});
  }
 }
 for(const entry of dictionaries(text))if(!blocks.some(f=>entry.pos>=f.pos&&entry.pos<f.pos+f.code.length))entries.push(entry);
 return entries.sort((a,b)=>a.pos-b.pos);
}
function dialogueEvents(text,source){
 const blocks=functionBlocks(text),groups=new Map();
 for(const entry of dialogueEntries(text,blocks)){
  const d=entry.value,participants=['speaker','left','right'].map(k=>d[k]).filter(isName);
  const control=d.type==='choice'||typeof d.next_label==='string'||typeof d.anchor_label==='string'||d.type==='branch_end';
  if(!participants.length&&!(typeof d.text==='string'&&['speaker','left','right'].some(k=>own(d,k)))&&!control)continue;
  const fn=blocks.find(f=>entry.pos>=f.pos&&entry.pos<f.pos+f.code.length);
  const branch=dialogueBranches(fn).filter(b=>entry.pos>=fn.pos+b.pos).at(-1);
  const id=(fn?.qualified||'literal_dialogue')+(branch?' ['+branch.label+']':'');let event=groups.get(id);
  if(!event){event={source,function:id,line:branch?.line||fn?.line||1,eventId:fn?assignment(fn.code,'event_id')||'':'',title:fn?assignment(fn.code,'title')||'':'',dialogues:[],branches:[],references:[],sections:[]};event.sections.push({function:id,source,line:event.line,code:fn?.code||'',dialogues:event.dialogues,branches:event.branches});groups.set(id,event);}
  event.references.push(...participants);
  if(typeof d.text==='string'&&['speaker','left','right'].some(k=>own(d,k)))event.dialogues.push(Object.fromEntries(['speaker','text','left','right','mood','anchor_label'].filter(k=>typeof d[k]==='string').map(k=>[k,d[k]])));
  if(control)event.branches.push(Object.fromEntries(['type','prompt','text','next_label','anchor_label'].filter(k=>typeof d[k]==='string').map(k=>[k,d[k]])));
 }
 // A private helper belongs to its sole direct caller in the same scope. Shared
 // helpers, match arms, unrelated functions and conflicting event IDs stay apart.
 for(const fn of blocks.filter(f=>f.name.startsWith('_'))){
  const child=groups.get(fn.qualified);if(!child)continue;
  const owner=fn.qualified.slice(0,-fn.name.length);
  const callers=blocks.filter(f=>f!==fn&&f.qualified.slice(0,-f.name.length)===owner&&tokens(f.code).some((t,i,ts)=>t.raw===fn.name&&ts[i+1]?.raw==='('&&ts[i-1]?.raw!=='.'));
  if(callers.length!==1)continue;
  const parent=groups.get(callers[0].qualified);if(!parent||parent===child||child.eventId&&parent.eventId!==child.eventId||child.title&&parent.title!==child.title)continue;
  parent.dialogues=parent.dialogues.concat(child.dialogues);parent.branches=parent.branches.concat(child.branches);parent.references.push(...child.references);parent.sections.push(...child.sections);groups.delete(fn.qualified);
 }
 return Array.from(groups.values()).filter(e=>e.references.length);
}
function playerCharacterNames(sources){
 // The scene controller binds its player portrait to the player-stats mood.
 // Read executable call tokens, so comments and NPC emotion/action routes
 // cannot identify a protagonist or suppress an independent NPC record.
 const names=new Set(),blocks=functionBlocks(sources.visuals||'');
 for(const fnName of ['refresh_character_portrait','apply_editor_char_sprite_preview']){
  const fn=blocks.find(f=>f.name===fnName);if(!fn)continue;
  const ts=tokens(fn.code);
  for(let i=0;i<ts.length;i++)if(ts[i].raw==='load_portrait_for_speaker'&&ts[i+1]?.raw==='('&&ts[i+2]?.type==='string'&&ts[i+3]?.raw===','&&ts[i+4]?.raw==='_stats_portrait_mood_key'&&ts[i+5]?.raw==='('&&ts[i+6]?.raw===')'&&ts[i+7]?.raw===')')names.add(ts[i+2].value);
 }
 return names;
}
function safeResource(ref){
 const path=String(ref||'').replace(/^res:\/\//,'');
 return path.startsWith('assets/')&&!/[\\\x00-\x1f:]/.test(path)&&!path.split('/').some(p=>!p||p==='.'||p==='..')&&/\.(png|jpe?g|webp)$/i.test(path)?path:'';
}
// Recognize only literal expressions used by the cultivation manager. Unknown shapes stay blank.
function heroRuntime(id,config,constants,rules){
 const gift=rules.find(f=>f.name==='give_gift'),pool=rules.find(f=>f.name==='_build_teahouse_npc_encounter_pool');
 const out={};
 if(gift){
  const ts=tokens(gift.code);
  for(let i=0;i<ts.length-4;i++)if(ts[i].raw==='get'&&ts[i+1].raw==='('&&ts[i+2].value==='affection_from_gift'&&ts[i+3].raw===','&&ts[i+4].type==='number')out.giftFallback=ts[i+4].value;
  out.giftGain=typeof config.affection_from_gift==='number'?config.affection_from_gift:out.giftFallback;
  out.preferredGiftRead=ts.some(t=>t.type==='string'&&t.value==='preferred_gift');
  const cost=gift.code.match(/consume_item\(gift_id,\s*(\d+)\)/);if(cost)out.giftCost=Number(cost[1]);
 }
 if(pool){
  const range=pool.code.match(/if\s+day\s*<\s*(\d+)\s+or\s+day\s*>\s*(\d+)\s*:\s*return\s*\[\]/);
  if(range){out.dayStart=Number(range[1]);out.dayEnd=Number(range[2]);}
  const lines=pool.code.split('\n');let condition=[],indent=-1;
  for(const line of lines){
   if(/^\s*if\s/.test(line)){condition=[line.trim()];indent=line.match(/^\s*/)[0].length;}
   else if(condition.length&&!condition.at(-1).endsWith(':'))condition.push(line.trim());
   const append=line.match(/pool\.append\(CultivationData\.TeahouseNpcEncounter\.(\w+)\)/);
   if(append&&constants[append[1]]===id&&line.match(/^\s*/)[0].length>indent)out.encounterCondition=condition.join(' ');
  }
 }
 return out;
}
function indexFromSources(sources){
 const visual=sources.visuals||'',data=sources.data||'',manager=sources.manager||'';
 if(!visual.trim())throw Error('缺少养成立绘映射：'+paths.visuals);
 const vc=literalConstants(visual),dc=literalConstants(data),mc=literalConstants(manager),people=new Map();
 function add(name,ref,source){
  if(!isName(name))return null;let p=people.get(name);
  if(!p){p={id:'cultivation:'+name,name,role:'立绘映射键 · 出场未核实',npcKind:'unverified',portraitRef:'',image:'',sources:[],events:[],enemies:[],enemy:null,hero:null};people.set(name,p);}
  if(ref&&!p.portraitRef)p.portraitRef=ref;if(!p.sources.includes(source))p.sources.push(source);return p;
 }
 const folders=vc.SPEAKER_PORTRAIT_MAP,filenames=vc.SPEAKER_FILENAME_MAP,base=vc.PORTRAIT_BASE_PATH;
 if(folders||filenames){
  for(const name of new Set([...Object.keys(folders||{}),...Object.keys(filenames||{})])){
   const folder=folders?.[name]||'npc',file=filenames?.[name]||'normal';
   add(name,typeof base==='string'&&typeof folder==='string'&&typeof file==='string'?base+folder+'/'+file+'.png':'',paths.visuals);
  }
 }else{
  // Legacy adapters with complete, explicit resource maps remain supported.
  for(const d of dictionaries(visual))for(const [name,ref] of Object.entries(d.value))if(typeof ref==='string'&&safeResource(ref))add(name,ref,paths.visuals);
 }
 const events=[];
 for(const key of ['data','story','commission'])for(const ev of dialogueEvents(sources[key]||'',paths[key])){
  events.push(ev);for(const name of new Set(ev.references))add(name,'',paths[key]);
 }
 // Hero IDs join only through explicit configuration or literal display-name branches.
 const display=new Map(),blocks=functionBlocks(data);
 for(const fn of blocks.filter(f=>f.name==='get_display_name')){
  const ts=tokens(fn.code);for(let i=0;i<ts.length-3;i++)if(ts[i+1].raw===':'&&ts[i+2].raw==='return'&&ts[i+3].type==='string'){
   const id=dc[ts[i].raw]??(ts[i].type==='string'?ts[i].value:undefined);if(typeof id==='string')display.set(id,ts[i+3].value);
  }
 }
 const managerFunctions=functionBlocks(manager);
 for(const [id,config] of Object.entries(dc.HERO_AFFINITY_CONFIG||{})){
  if(!config||typeof config!=='object'||Array.isArray(config))continue;
  const explicit=['name','display_name','npc_name','character_name'].map(k=>config[k]).find(isName)||display.get(id);
  const p=explicit?add(explicit,'',paths.data):isName(id)?add(id,'',paths.data):null;if(!p)continue;
  const rules=managerFunctions.filter(f=>['give_gift','_build_teahouse_npc_encounter_pool','try_teahouse_npc_encounter_on_entry','complete_teahouse_npc_encounter','_try_trigger_affection_blessing','sync_blessings_to_deck'].includes(f.name));
  p.npcKind='hero';p.role='英雄 · HERO_AFFINITY_CONFIG';p.hero={id,config,constants:Object.fromEntries(Object.entries(mc).filter(([k,v])=>k.startsWith('TEAHOUSE_AFFECTION_')&&typeof v==='number')),encounterChance:dc.TEAHOUSE_NPC_ENCOUNTER_CHANCE,runtime:heroRuntime(id,config,dc,rules),rules:rules.map(f=>({...f,source:paths.manager}))};
  if(rules.length)p.sources.push(paths.manager);
 }
 let enemyJson;try{enemyJson=JSON.parse(sources.enemies||'{"enemies":[]}');}catch{throw Error('敌人 JSON 解析失败：'+paths.enemies);}
 if(!Array.isArray(enemyJson.enemies))throw Error('敌人 JSON 缺少 enemies 数组');
 for(const p of people.values()){
  for(const ev of events){const count=ev.references.filter(name=>name===p.name).length;if(count)p.events.push({...ev,count});}
  if(p.npcKind!=='hero'&&p.events.length){p.npcKind='normal';p.role='养成对白参与者';}
  p.enemies=enemyJson.enemies.filter(e=>e&&e.name===p.name&&typeof e.id==='string').map(e=>({id:e.id,name:e.name,max_hp:e.max_hp,source:paths.enemies}));p.enemy=p.enemies[0]||null;
  if(p.enemies.length&&!p.sources.includes(paths.enemies))p.sources.push(paths.enemies);
 }
 const playerNames=playerCharacterNames(sources);
 const records=Array.from(people.values()).filter(p=>!playerNames.has(p.name));
 portraitCandidates(records,sources,events);
 return records.sort((a,b)=>a.name.localeCompare(b.name,'zh-Hans-CN'));
}
function portraitCandidates(records,sources,events){
 const visual=sources.visuals||'',vc=literalConstants(visual),folders=vc.SPEAKER_PORTRAIT_MAP||{},files=vc.SPEAKER_FILENAME_MAP||{},base=vc.PORTRAIT_BASE_PATH;
 const add=(p,ref,label,source,line)=>{if(!safeResource(ref))return;let v=p.portraits.find(x=>x.ref===ref);if(!v){v={ref,label,image:'',sources:[]};p.portraits.push(v);}if(!v.sources.some(s=>s.source===source&&s.line===line))v.sources.push({source,line});};
 for(const p of records){p.portraits=[];if(p.portraitRef)add(p,p.portraitRef,'主立绘',paths.visuals,1);}
 const loader=functionBlocks(visual).find(f=>f.name==='load_portrait_for_speaker');
 const moodPaths=loader&&/filename\s*=\s*mood\b/.test(loader.code)&&/PORTRAIT_BASE_PATH\s*\+\s*folder\s*\+\s*"\/"\s*\+\s*filename/.test(loader.code);
 const targets=new Set();
 for(const m of (sources.player||'').matchAll(/(?:left|right)_speaker\s*!=\s*"([^"\r\n]+)"\s+else\s+current_mood/g))targets.add(m[1]);
 const addMood=(name,mood,source,line)=>{const p=records.find(p=>p.name===name);if(!p||!moodPaths||files[name]||typeof base!=='string'||typeof folders[name]!=='string'||!/^\w+$/.test(mood))return;add(p,base+folders[name]+'/'+mood+'.png',mood,source,line);};
 for(const e of events)for(const section of e.sections||[])for(const d of section.dialogues){
  if(!d.mood)continue;
  const sides=[d.left,d.right].filter(isName);
  if(!sides.length&&isName(d.speaker))addMood(d.speaker,d.mood,e.source,section.line);
  for(const name of sides)if(targets.has(name))addMood(name,d.mood,e.source,section.line);
 }
 const detect=functionBlocks(visual).find(f=>f.name==='detect_mood_from_text');
 const guard=detect?.code.match(/if\s+speaker\s*!=\s*"([^"\r\n]+)"\s*:\s*return\s+"normal"/);
 if(guard)for(const m of detect.code.matchAll(/return\s+"(\w+)"/g))addMood(guard[1],m[1],paths.visuals,detect.line);
 // The action-specific renderer explicitly binds the named speaker and texture.
 const gc=literalConstants(sources.guqin||''),apply=functionBlocks(sources.guqin||'').find(f=>f.name==='apply');
 const binding=apply?.code.match(/if\s+speaker\s*!=\s*"([^"\r\n]+)"\s+or\s+mood\s*!=\s*"(\w+)"\s*:\s*[^]*?return\s+false/);
 if(binding&&safeResource(gc.TEXTURE_PATH)){const p=records.find(p=>p.name===binding[1]);if(p)add(p,gc.TEXTURE_PATH,binding[2],paths.guqin,apply.line);}
}
async function load(read,makeUrl){
 const source={};for(const [key,path] of Object.entries(paths)){
  const f=await read(path);if(!f){if(key==='visuals'||key==='enemies')throw Error('项目中缺少 '+path);source[key]='';continue;}
  if(f.size>4*1024*1024)throw Error('NPC 来源文件超过 4 MB：'+path);source[key]=await f.text();
 }
 const records=indexFromSources(source);if(!records.length)throw Error('没有识别到可验证的养成人物；不使用演示数据代替');
 const urls=new Set();
 const release=()=>{for(const url of urls)URL.revokeObjectURL(url);urls.clear();};
 const loaded=new Map();
 try{for(const p of records)for(const portrait of p.portraits){const path=safeResource(portrait.ref);if(!path)continue;
  if(!loaded.has(path)){const f=await read(path);let image='',originalBytes=null;if(f&&f.size<=8*1024*1024&&makeUrl){originalBytes=f.arrayBuffer?new Uint8Array(await f.arrayBuffer()):null;image=makeUrl(f);urls.add(image);}loaded.set(path,{image,originalBytes});}
  Object.assign(portrait,loaded.get(path));if(portrait.image)portrait.path=path;
  if(portrait.ref===p.portraitRef){p.image=portrait.image;if(p.image)p.portraitPath=path;}
 }return {records,release,updatePortrait(path,bytes){
  const previous=loaded.get(path);if(!previous?.image)throw Error('立绘来源已失效');
  const originalBytes=new Uint8Array(bytes),image=makeUrl(new Blob([originalBytes],{type:'image/png'}));urls.add(image);
  loaded.set(path,{image,originalBytes});
  for(const n of records)for(const p of n.portraits)if(p.path===path){Object.assign(p,{image,originalBytes});if(p.ref===n.portraitRef)n.image=image;}
  URL.revokeObjectURL(previous.image);urls.delete(previous.image);
 }};}catch(e){release();throw e;}
}
function fromHandle(handle){return load(async path=>{
 const parts=path.split('/');let dir=handle;
 try{for(const p of parts.slice(0,-1))dir=await dir.getDirectoryHandle(p,{create:false});return await (await dir.getFileHandle(parts.at(-1),{create:false})).getFile();}
 catch(e){if(e.name==='NotFoundError')return null;throw e;}
},f=>URL.createObjectURL(f));}
function fromFileList(fileList){const files=new Map();for(const f of fileList){const relative=f.webkitRelativePath.split('/').slice(1).join('/');if(relative)files.set(relative,f);}return load(async path=>files.get(path)||null,f=>URL.createObjectURL(f));}
const api={paths,indexFromSources,fromHandle,fromFileList};if(typeof module!=='undefined')module.exports=api;root.GCSNPCProject=api;
})(typeof window!=='undefined'?window:globalThis);
