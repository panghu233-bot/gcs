/* Explicit execution mapping; no discovery by title or proximity. */
(function(root){
'use strict';
const patch=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const manifest=Object.freeze({id:'day12_countdown',title:'指日可待',sourcePath:'scripts/cultivation/cultivation_data.gd',entryPath:'scripts/cultivation/ui/cultivation_calendar_rest_flow.gd',entryFunction:'on_day12_countdown_rest_requested',className:'Day12CountdownEvent',functionName:'create_lines',expectedCount:7});
function parse(files,spec=manifest){
 const manifest=spec;
 if(!['static','literal'].includes(spec.adapter)&&Object.keys(api.manifest).some(k=>spec[k]!==api.manifest[k]))throw Error('未确认的事件写入范围');
 if(['static','literal'].includes(spec.adapter)){const catalog=typeof module!=='undefined'?require('./event-catalog.js'):root.GCSEventCatalog;const resolved=catalog.resolve(files,spec.id);if(JSON.stringify(resolved)!==JSON.stringify(spec))throw Error('事件映射与当前源码不符');}
 const originalBytes=new Uint8Array(files[manifest.sourcePath]),entryBytes=new Uint8Array(files[manifest.entryPath]);
 const entry=['static','literal'].includes(manifest.adapter)?null:patch.scope(patch.lex(patch.decode(entryBytes)),'func',manifest.entryFunction);
 const parsed=patch.readLinear(originalBytes,manifest),speaker=parsed.defaultSpeaker;
 const expected=`func on_day12_countdown_rest_requested() -> void:\n if not _host.cultivation_manager.is_event_allowed(&"day12_countdown"):\n  return\n var lines := CultivationData.Day12CountdownEvent.create_lines()\n _host.dialogue_player.set_speakers(PackedStringArray([${JSON.stringify(speaker)}]))\n _host._start_dialogue(lines, Callable(self, "on_day12_countdown_finished"))`;
 if(entry&&!patch.sameTokens(entry,expected))throw Error('实际执行入口已变化，无法确认事件映射');
 // Full draft rows stay in memory. Stable identity prevents reorders being saved as text edits.
 let serial=0,locked=false,blocked=false,selectedId=null;
 const makeRows=bytes=>{const next=patch.readLinear(bytes,manifest);return next.lines.map(({token,...line})=>({...line,id:'source-'+serial++}));};
 let baseline=makeRows(originalBytes),draft=baseline.map(l=>({...l}));selectedId=draft[0].id;
 const history=[],future=[],copy=rows=>rows.map(l=>({...l}));
 const snapshot=()=>({rows:copy(draft),selectedId});
 const writable=()=>{if(locked||blocked)throw Error('当前事件已锁定');};
 const at=index=>{if(!Number.isInteger(index)||!draft[index])throw Error('无效对白');return draft[index];};
 function remember(){history.push(snapshot());if(history.length>100)history.shift();future.length=0;}
 function restore(s){draft=copy(s.rows);selectedId=s.selectedId;}
 const structural=()=>draft.length!==baseline.length||draft.some((l,i)=>l.id!==baseline[i].id);
 const performanceKeys=['speaker','left','right','mood'];
 const performanceChanges=()=>draft.flatMap((row,index)=>{const original=baseline.find(b=>b.id===row.id);return original?performanceKeys.filter(key=>row[key]!==original[key]).map(key=>({kind:'performance',index,key,before:original[key],after:row[key]})):[];});
 const textOnly=manifest.adapter==='literal',fullOnly=()=>{writable();if(textOnly)throw Error('此来源仅允许修改已确认文字，结构和演出保持锁定');};
 const workspace={manifest,originalBytes,entryBytes,openingBackground:parsed.openingBg,textOnly,capability:textOnly?'text':'full',
  get lines(){return copy(draft);},get texts(){return draft.map(l=>l.text);},
  get selectedIndex(){return draft.findIndex(l=>l.id===selectedId);},
  select(index){selectedId=at(index).id;},
  get locked(){return locked;},get blocked(){return blocked;},get hasStructuralChanges(){return structural();},get hasPerformanceChanges(){return performanceChanges().length>0;},get hasUnsupportedChanges(){try{workspace.plan();return false;}catch{return true;}},
  get changes(){return diffRows(baseline,draft).map(c=>textOnly?{...c,slotId:baseline[c.index].slotId,context:baseline[c.index].context,textKind:baseline[c.index].kind}:c);},
  set(index,value){writable();const row=at(index);if(textOnly&&!row.editable)throw Error(row.reason||'当前文字无法安全定位');if(typeof value!=='string'||value.length>20000)throw Error('对白必须是 20000 字以内的文本');if(row.text!==value){remember();row.text=value;}},
  setPerformance(index,key,value){fullOnly();const row=at(index);if(!performanceKeys.includes(key)||typeof value!=='string'||value.length>200||!value&&key==='mood')throw Error('无效的演出设置');if(row[key]!==value){const side=key==='speaker'&&row.speaker?['left','right'].find(side=>row[side]===row.speaker&&!row[side==='left'?'right':'left']):null;remember();row[key]=value;if(side)row[side]=value;}},
  insert(index,after=false){fullOnly();const row=at(index);remember();const next={...row,id:'draft-'+serial++,text:'',line:null};draft.splice(index+(after?1:0),0,next);selectedId=next.id;},
  duplicate(index){fullOnly();const row=at(index);remember();const next={...row,id:'draft-'+serial++,line:null};draft.splice(index+1,0,next);selectedId=next.id;},
  remove(index){fullOnly();at(index);if(draft.length===1)throw Error('至少保留一句对白');remember();draft.splice(index,1);selectedId=draft[Math.min(index,draft.length-1)].id;},
  move(index,direction){fullOnly();const row=at(index);if(![-1,1].includes(direction))throw Error('无效移动方向');const next=index+direction;if(next<0||next>=draft.length)return;remember();[draft[index],draft[next]]=[draft[next],draft[index]];selectedId=row.id;},
  get canUndo(){return history.length>0;},get canRedo(){return future.length>0;},
  undo(){writable();if(history.length){future.push(snapshot());restore(history.pop());}},
  redo(){writable();if(future.length){history.push(snapshot());restore(future.pop());}},
  discard(){writable();draft=copy(baseline);selectedId=draft[0].id;history.length=0;future.length=0;},
  setLocked(value){locked=!!value;},block(){blocked=true;},
  planDraft(){return patch.planLines({originalBytes:workspace.originalBytes,spec:manifest,lines:draft,structureChanged:structural()});},
  plan(){return workspace.planDraft();},
  saved(bytes){baseline=makeRows(bytes);workspace.originalBytes=new Uint8Array(bytes);draft=copy(baseline);selectedId=draft[0].id;history.length=0;future.length=0;}
 };return workspace;
}
async function locate(project,path){let d=project;const p=path.split('/');for(const s of p.slice(0,-1))d=await d.getDirectoryHandle(s,{create:false});return d.getFileHandle(p.at(-1),{create:false});}
function withPerformance(workspace,read){const performance=typeof module!=='undefined'?require('./event-performance.js'):root.GCSEventPerformance;workspace.performance=performance.create({read});workspace.release=()=>workspace.performance.release();return workspace;}
// The active workspace keeps the existing public API; the catalog supplies reusable scopes.
async function loadCatalog(read,timelinePaths=[],inputErrors=[]){
 const catalog=typeof module!=='undefined'?require('./event-catalog.js'):root.GCSEventCatalog,files={};
 for(const path of catalog.paths)try{const file=await read(path);if(!file)continue;if(file.size>8*1024*1024)throw Error('事件源码过大');files[path]=new Uint8Array(await file.arrayBuffer());}catch(e){inputErrors.push(path+'：'+e.message);}
 const {records,errors}=catalog.discover(files);errors.push(...inputErrors);
 let total=0;for(const path of timelinePaths){try{const f=await read(path);if(!f||f.size>1024*1024|| (total+=f.size)>8*1024*1024)throw Error('时间轴超过读取大小限制');const rawSource=await f.text();records.push({manifest:Object.freeze({id:path,title:path.slice(9).replace(/\.dtl$/,''),sourcePath:path,functionName:'Dialogic 时间轴',entryPath:null}),editable:false,capability:'readonly',reason:'Dialogic 指令、跳转与角色资源使用独立格式，当前仅提供原始时间轴只读审阅，未核实运行入口',lines:[],rawSource});}catch(e){errors.push(path+'：'+e.message);}}
 if(!records.length)throw Error(errors.join('；')||'未发现已知格式的真实事件');
 const performance=typeof module!=='undefined'?require('./event-performance.js'):root.GCSEventPerformance,preview=performance.create({read});
 let current=null;
 const activate=id=>{const record=records.find(r=>r.manifest.id===id);if(!record)throw Error('事件已不存在');
  if(current?.locked||current?.blocked)throw Error('当前事件已锁定');
  const fresh=record;
  current=fresh.editable?parse(files,fresh.manifest):{manifest:fresh.manifest,readOnly:true,capability:'readonly',reason:fresh.reason,rawSource:fresh.rawSource,lines:fresh.lines.map((r,i)=>({...r,id:'read-'+i})),get texts(){return this.lines.map(r=>r.text);},changes:[],selectedIndex:0,select(i){if(!this.lines[i])throw Error('无效对白');this.selectedIndex=i;},locked:false,blocked:false,setLocked(v){this.locked=!!v;}};
  current.reason=fresh.reason;current.rawSource=fresh.rawSource;current.performance=preview;current.eventRecords=records;current.discoveryErrors=errors;current.selectEvent=activate;current.release=()=>preview.release();
  if(!current.readOnly){const active=current,saved=active.saved;active.saved=bytes=>{saved(bytes);files[active.manifest.sourcePath]=new Uint8Array(bytes);record.lines=patch.readLinear(bytes,active.manifest).lines;const source=patch.decode(bytes),all=patch.lex(source),owner=active.manifest.className?patch.scope(all,'class',active.manifest.className):all,fn=patch.scope(owner,'func',active.manifest.functionName);record.rawSource=source.slice(fn[0].start,fn.at(-1).end);active.rawSource=record.rawSource;};}
  return current;
 };
 return activate(records.find(r=>r.manifest.id==='day12_countdown'&&r.editable)?.manifest.id||records.find(r=>r.editable)?.manifest.id||records[0].manifest.id);
}
async function fromHandle(project,spec=null){
 const read=async path=>{try{return await (await locate(project,path)).getFile();}catch(e){if(e.name==='NotFoundError')return null;throw e;}};
 if(!spec){
  const paths=[],errors=[];let visited=0;async function walk(dir,prefix,depth){if(depth>4)throw Error('时间轴目录过深');if(typeof dir.values!=='function')return;for await(const h of dir.values()){if(++visited>256)throw Error('时间轴目录超过 256 项');if(h.kind==='directory')await walk(h,prefix+h.name+'/',depth+1);else if(h.kind==='file'&&h.name.endsWith('.dtl'))paths.push(prefix+h.name);}}
  try{await walk(await project.getDirectoryHandle('timeline',{create:false}),'timeline/',0);}catch(e){if(e.name!=='NotFoundError')errors.push('timeline/：'+e.message);}
  return loadCatalog(read,paths.sort(),errors);
 }
 const catalog=typeof module!=='undefined'?require('./event-catalog.js'):root.GCSEventCatalog,files={};for(const path of catalog.paths){const f=await read(path);if(f){if(f.size>8*1024*1024)throw Error('事件源码过大');files[path]=new Uint8Array(await f.arrayBuffer());}}
 return withPerformance(parse(files,spec),read);
}
async function fromFileList(list){const files=Array.from(list),map=new Map();for(const f of files){const path=f.webkitRelativePath.split('/').slice(1).join('/');if(map.has(path))throw Error('项目文件路径重复');map.set(path,f);}const timelines=[...map.keys()].filter(path=>path.startsWith('timeline/')&&path.endsWith('.dtl'));return loadCatalog(async path=>map.get(path)||null,timelines.sort().slice(0,256),timelines.length>256?['时间轴超过 256 项，仅展示前 256 项']:[]);}
// IDs are stable within a draft. For a backup, pair exact rows first, then remaining rows.
function diffRows(before,after){
 const keys=['speaker','text','left','right','mood'];before=before.map((r,i)=>({...r,id:r.id??'base-'+i}));after=after.map(r=>({...r}));
 if(after.some(r=>!r.id)){
  const unused=new Set(before.map(r=>r.id));
  for(const r of after){const match=before.find(b=>unused.has(b.id)&&keys.every(k=>r[k]===b[k]));if(match){r.id=match.id;unused.delete(match.id);}}
  for(const r of after.filter(r=>!r.id)){const match=before.find(b=>unused.has(b.id));r.id=match?.id??'added-'+after.indexOf(r);if(match)unused.delete(match.id);}
 }

 if(before.length===after.length&&before.every((r,i)=>keys.every(k=>r[k]===after[i][k])))return [];
 const changes=[],beforeOrder=before.filter(r=>after.some(a=>a.id===r.id)).map(r=>r.id),afterOrder=after.filter(r=>before.some(b=>b.id===r.id)).map(r=>r.id);
 before.forEach((r,index)=>{if(!after.some(a=>a.id===r.id))changes.push({kind:'delete',index,before:r.text,after:'（已删除）'});});
 after.forEach((r,index)=>{const old=before.findIndex(b=>b.id===r.id);if(old<0){changes.push({kind:'insert',index,before:'（新增对白）',after:r.text});return;}
  if(beforeOrder.indexOf(r.id)!==afterOrder.indexOf(r.id))changes.push({kind:'move',index,before:'原第 '+(old+1)+' 句：'+before[old].text,after:'现第 '+(index+1)+' 句：'+r.text});
  for(const key of keys)if(r[key]!==before[old][key])changes.push(key==='text'?{index,before:before[old][key],after:r[key]}:{kind:'performance',key,index,before:before[old][key],after:r[key]});
 });return changes;
}
const api={manifest,parse,fromHandle,fromFileList,locate,diffRows};if(typeof module!=='undefined')module.exports=api;root.GCSEventProject=api;
})(typeof window!=='undefined'?window:globalThis);
