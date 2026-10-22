const {manifest:m}=require('../../site/event-project.js');
const enc=s=>new TextEncoder().encode(s);
function fixture({bom=true,eol='\r\n',quote='"'}={}){
 const source=`# 合成夹具，不含游戏原文\nconst UNRELATED = "keep\\u4e2d" # 不改\nclass Day12CountdownEvent:\n\tconst PORTRAIT_SPEAKER := "测试人物"\n\tconst BG = "res://test.png"\n\tstatic func _line(text: String, mood: String = "normal") -> Dictionary:\n\t\treturn {"speaker": PORTRAIT_SPEAKER, "text": text, "left": "", "right": PORTRAIT_SPEAKER, "mood": mood,}\n\tstatic func create_lines() -> Array[Dictionary]:\n\t\tvar out: Array[Dictionary] = []\n\t\tvar first := _line(${quote}合成第1句${quote}, "normal")\n\t\tfirst["bg"] = BG\n\t\tout.append(first)\n${Array.from({length:6},(_,i)=>`\t\tout.append(_line(${quote}合成第${i+2}句${quote}, "normal"))`).join('\n')}\n\t\treturn out\n\nclass Other:\n\tconst TEXT = "保留所有字节"\n`;
 const entry='func on_day12_countdown_rest_requested() -> void:\n\tif not _host.cultivation_manager.is_event_allowed(&"day12_countdown"):\n\t\treturn\n\tvar lines := CultivationData.Day12CountdownEvent.create_lines()\n\t_host.dialogue_player.set_speakers(PackedStringArray(["测试人物"]))\n\t_host._start_dialogue(lines, Callable(self, "on_day12_countdown_finished"))\n';
 return {[m.sourcePath]:enc((bom?'\ufeff':'')+source.replaceAll('\n',eol)),[m.entryPath]:enc(entry)};
}
function memoryFS(files={}){
 const data=new Map(Object.entries(files).map(([p,b])=>[p,new Uint8Array(b)])),nodes=new Map(),writes=[];let hook=null;
 function file(path){if(nodes.has(path))return nodes.get(path);const h={name:path.split('/').at(-1),path,async getFile(){if(!data.has(path))throw Error('missing');const b=new Uint8Array(data.get(path));return {size:b.length,arrayBuffer:async()=>b.buffer};},async createWritable(){writes.push(path);let pending,aborted=false;return {async write(b){pending=new Uint8Array(b);await hook?.('write',path);},async close(){if(aborted)throw Error('aborted');await hook?.('before',path);data.set(path,pending);await hook?.('after',path);},async abort(){aborted=true;}};}};nodes.set(path,h);return h;}
 const dirs=new Set(['/project','/backups']);for(const path of data.keys()){const parts=path.split('/');for(let i=2;i<parts.length;i++)dirs.add(parts.slice(0,i).join('/'));}
 function dir(path){return {name:path.split('/').at(-1),path,async resolve(other){return other.path===path?[]:other.path.startsWith(path+'/')?other.path.slice(path.length+1).split('/'):null;},async getDirectoryHandle(n,{create=false}={}){const p=path+'/'+n;if(!dirs.has(p)){if(!create)throw Object.assign(Error('missing'),{name:'NotFoundError'});dirs.add(p);}return dir(p);},async getFileHandle(n,{create=false}={}){const p=path+'/'+n;if(!data.has(p)){if(!create)throw Object.assign(Error('missing'),{name:'NotFoundError'});data.set(p,new Uint8Array());}return file(p);}};}
 return {project:dir('/project'),backup:dir('/backups'),data,writes,setHook:f=>hook=f,file};
}
module.exports={fixture,memoryFS,enc};
