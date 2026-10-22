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
 const baseline=parsed.lines.map(l=>l.text),draft=[...baseline];let locked=false,blocked=false;const history=[];
 const workspace={manifest,lines:parsed.lines.map(({token,...l})=>l),originalBytes,entryBytes,
  get locked(){return locked;},get blocked(){return blocked;},get changes(){return draft.flatMap((after,index)=>after===baseline[index]?[]:[{index,before:baseline[index],after}]);},
  get texts(){return [...draft];},set(index,value){if(locked||blocked)throw Error('当前事件已锁定');if(!Number.isInteger(index)||!workspace.lines[index]||typeof value!=='string')throw Error('无效对白');if(draft[index]!==value){history.push([...draft]);if(history.length>100)history.shift();draft[index]=value;}},
  get canUndo(){return history.length>0;},undo(){if(locked||blocked)throw Error('当前事件已锁定');const last=history.pop();if(last)draft.splice(0,draft.length,...last);},
  discard(){if(locked||blocked)throw Error('正在应用');draft.splice(0,draft.length,...baseline);history.length=0;},setLocked(value){locked=!!value;},block(){blocked=true;},
  plan(){return patch.plan({originalBytes:workspace.originalBytes,spec:manifest,changes:workspace.changes});},
  saved(bytes){const next=patch.readLinear(bytes,manifest);workspace.originalBytes=new Uint8Array(bytes);workspace.lines=next.lines.map(({token,...l})=>l);baseline.splice(0,baseline.length,...next.lines.map(l=>l.text));draft.splice(0,draft.length,...baseline);history.length=0;}
 };return workspace;
}
async function locate(project,path){let d=project;const p=path.split('/');for(const s of p.slice(0,-1))d=await d.getDirectoryHandle(s,{create:false});return d.getFileHandle(p.at(-1),{create:false});}
async function fromHandle(project){const files={};for(const path of [manifest.sourcePath,manifest.entryPath]){const file=await (await locate(project,path)).getFile();if(file.size>8*1024*1024)throw Error('事件源码过大');files[path]=new Uint8Array(await file.arrayBuffer());}return parse(files);}
async function fromFileList(list){const files={};for(const path of [manifest.sourcePath,manifest.entryPath]){const matches=Array.from(list).filter(f=>f.webkitRelativePath.split('/').slice(1).join('/')===path);if(matches.length!==1||matches[0].size>8*1024*1024)throw Error('缺少或无法读取 '+path);files[path]=new Uint8Array(await matches[0].arrayBuffer());}return parse(files);}
const api={manifest,parse,fromHandle,fromFileList,locate};if(typeof module!=='undefined')module.exports=api;root.GCSEventProject=api;
})(typeof window!=='undefined'?window:globalThis);
