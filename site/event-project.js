/* Explicit execution mapping; no discovery by title or proximity. */
(function(root){
'use strict';
const patch=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const manifest=Object.freeze({id:'day12_countdown',title:'指日可待',sourcePath:'scripts/cultivation/cultivation_data.gd',entryPath:'scripts/cultivation/ui/cultivation_calendar_rest_flow.gd',entryFunction:'on_day12_countdown_rest_requested',className:'Day12CountdownEvent',functionName:'create_lines',expectedCount:7});
function parse(files){
 const originalBytes=new Uint8Array(files[manifest.sourcePath]),entryBytes=new Uint8Array(files[manifest.entryPath]);
 const entry=patch.scope(patch.lex(patch.decode(entryBytes)),'func',manifest.entryFunction);
 const parsed=patch.readLinear(originalBytes,manifest),speaker=parsed.lines[0].speaker;
 const expected=`func on_day12_countdown_rest_requested() -> void:\n if not _host.cultivation_manager.is_event_allowed(&"day12_countdown"):\n  return\n var lines := CultivationData.Day12CountdownEvent.create_lines()\n _host.dialogue_player.set_speakers(PackedStringArray([${JSON.stringify(speaker)}]))\n _host._start_dialogue(lines, Callable(self, "on_day12_countdown_finished"))`;
 if(!patch.sameTokens(entry,expected))throw Error('实际执行入口已变化，无法确认事件映射');
 // Full draft rows stay in memory. Stable identity prevents reorders being saved as text edits.
 let serial=0,locked=false,blocked=false,selectedId=null;
 const makeRows=bytes=>patch.readLinear(bytes,manifest).lines.map(({token,...line})=>({...line,id:'source-'+serial++,left:'',right:line.speaker}));
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
 const workspace={manifest,originalBytes,entryBytes,openingBackground:parsed.openingBg,
  get lines(){return copy(draft);},get texts(){return draft.map(l=>l.text);},
  get selectedIndex(){return draft.findIndex(l=>l.id===selectedId);},
  select(index){selectedId=at(index).id;},
  get locked(){return locked;},get blocked(){return blocked;},get hasStructuralChanges(){return structural();},get hasPerformanceChanges(){return performanceChanges().length>0;},get hasUnsupportedChanges(){return structural()||performanceChanges().length>0;},
  get changes(){const texts=draft.flatMap(l=>{const index=baseline.findIndex(b=>b.id===l.id);return index<0||l.text===baseline[index].text?[]:[{index,before:baseline[index].text,after:l.text}];});return [...(structural()?[{kind:'structure'}]:[]),...performanceChanges(),...texts];},
  set(index,value){writable();const row=at(index);if(typeof value!=='string'||value.length>20000)throw Error('对白必须是 20000 字以内的文本');if(row.text!==value){remember();row.text=value;}},
  setPerformance(index,key,value){writable();const row=at(index);if(!performanceKeys.includes(key)||typeof value!=='string'||value.length>200||!value&&key==='mood')throw Error('无效的演出设置');if(row[key]!==value){remember();row[key]=value;}},
  insert(index,after=false){writable();const row=at(index);remember();const next={...row,id:'draft-'+serial++,text:'',line:null};draft.splice(index+(after?1:0),0,next);selectedId=next.id;},
  duplicate(index){writable();const row=at(index);remember();const next={...row,id:'draft-'+serial++,line:null};draft.splice(index+1,0,next);selectedId=next.id;},
  remove(index){writable();at(index);if(draft.length===1)throw Error('至少保留一句对白');remember();draft.splice(index,1);selectedId=draft[Math.min(index,draft.length-1)].id;},
  move(index,direction){writable();const row=at(index);if(![-1,1].includes(direction))throw Error('无效移动方向');const next=index+direction;if(next<0||next>=draft.length)return;remember();[draft[index],draft[next]]=[draft[next],draft[index]];selectedId=row.id;},
  get canUndo(){return history.length>0;},get canRedo(){return future.length>0;},
  undo(){writable();if(history.length){future.push(snapshot());restore(history.pop());}},
  redo(){writable();if(future.length){history.push(snapshot());restore(future.pop());}},
  discard(){writable();draft=copy(baseline);selectedId=draft[0].id;history.length=0;future.length=0;},
  setLocked(value){locked=!!value;},block(){blocked=true;},
  plan(){if(workspace.hasUnsupportedChanges)throw Error('人物演出或结构修改仅保留内存草稿，不支持写回；请撤销这些修改后再保存纯文字');return patch.plan({originalBytes:workspace.originalBytes,spec:manifest,changes:workspace.changes});},
  saved(bytes){baseline=makeRows(bytes);workspace.originalBytes=new Uint8Array(bytes);draft=copy(baseline);selectedId=draft[0].id;history.length=0;future.length=0;}
 };return workspace;
}
async function locate(project,path){let d=project;const p=path.split('/');for(const s of p.slice(0,-1))d=await d.getDirectoryHandle(s,{create:false});return d.getFileHandle(p.at(-1),{create:false});}
function withPerformance(workspace,read){const performance=typeof module!=='undefined'?require('./event-performance.js'):root.GCSEventPerformance;workspace.performance=performance.create({read});workspace.release=()=>workspace.performance.release();return workspace;}
async function fromHandle(project){const files={};for(const path of [manifest.sourcePath,manifest.entryPath]){const file=await (await locate(project,path)).getFile();if(file.size>8*1024*1024)throw Error('事件源码过大');files[path]=new Uint8Array(await file.arrayBuffer());}return withPerformance(parse(files),async path=>{try{return await (await locate(project,path)).getFile();}catch(e){if(e.name==='NotFoundError')return null;throw e;}});}
async function fromFileList(list){const files={};for(const path of [manifest.sourcePath,manifest.entryPath]){const matches=Array.from(list).filter(f=>f.webkitRelativePath.split('/').slice(1).join('/')===path);if(matches.length!==1||matches[0].size>8*1024*1024)throw Error('缺少或无法读取 '+path);files[path]=new Uint8Array(await matches[0].arrayBuffer());}return withPerformance(parse(files),async path=>Array.from(list).find(f=>f.webkitRelativePath.split('/').slice(1).join('/')===path)||null);}
const api={manifest,parse,fromHandle,fromFileList,locate};if(typeof module!=='undefined')module.exports=api;root.GCSEventProject=api;
})(typeof window!=='undefined'?window:globalThis);
