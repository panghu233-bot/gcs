/* Folder transport is independent of the game schema. Only adapter-declared files are read. */
(function(root){
 'use strict';
 function createProject({adapter,store,notify=()=>{}}){
  let revision=0,queue=Promise.resolve(),state={status:'disconnected',name:'',records:[],branches:null,handle:null,message:'未连接游戏项目 · 当前展示演示数据'};
  const connected=()=>state.branches!==null;
  const emit=()=>notify({...state,connected:connected()});
  const update=patch=>{state={...state,...patch};emit();};
  const save=(handle,ticket)=>{const task=queue.then(()=>ticket===revision ? store.save(handle) : undefined);queue=task.catch(()=>{});return task;};
  async function parse(files){
   const json={};
   for(const [key,file] of Object.entries(files)) {if(file.size>8*1024*1024)throw new Error('项目数据文件超过 8MB');json[key]=JSON.parse(await file.text());}
   const records=adapter.readRecords(json.cards),branches=adapter.readBranches(json.branches);
   if(!records.length)throw new Error('项目卡牌列表为空');
   for(const id of Object.keys(branches))if(!records.some(r=>r.id===id))throw new Error('升级分支引用了不存在的卡牌：'+id);
   return {records,branches};
  }
  async function fromHandle(handle){
   const files={};
   for(const [key,path] of Object.entries(adapter.projectFiles)) {
    let directory=handle;const segments=path.split('/');
    try {for(const segment of segments.slice(0,-1))directory=await directory.getDirectoryHandle(segment,{create:false});files[key]=await (await directory.getFileHandle(segments.at(-1),{create:false})).getFile();}
    catch(e){if(e.name==='NotFoundError')throw new Error('所选项目缺少 '+path+'，请选择游戏根文件夹');throw e;}
   }
   return parse(files);
  }
  function fail(error){update({status:connected()?'connected':state.handle?'permission':'error',message:'连接失败：'+error.message+(connected()?'；保留上次已加载数据':'；当前展示演示数据')});}
  async function accept(handle,ticket){
   const snapshot=await fromHandle(handle);if(ticket!==revision)return;
   update({...snapshot,handle,name:handle.name,status:'connected',message:'已连接 · 本地只读'});
   try{await save(handle,ticket);}catch {if(ticket===revision)update({message:'已连接 · 浏览器无法记住文件夹，下次需重新选择'});}
  }
  async function open(pick){
   const ticket=++revision;
   try {const pending=pick({id:'gcs-game-project',mode:'read'});update({status:'loading',message:'等待选择游戏根文件夹…'});const handle=await pending;if(ticket!==revision)return;update({message:'正在读取卡牌与升级分支…'});await accept(handle,ticket);}
   catch(e){if(ticket!==revision)return;if(e.name==='AbortError')update({status:connected()?'connected':state.handle?'permission':'disconnected',message:connected()?'已取消选择 · 保留当前项目':state.handle?'已取消选择 · 可重新授权已记住的文件夹':'已取消选择 · 当前展示演示数据'});else fail(e);}
  }
  async function restore(){
   const ticket=revision;update({status:'restoring',message:'正在恢复本地项目连接…'});
   try{const handle=await store.load();if(ticket!==revision)return;if(!handle){update({status:'disconnected',message:'未连接游戏项目 · 当前展示演示数据'});return;}
    update({handle,name:handle.name});const permission=await handle.queryPermission({mode:'read'});if(ticket!==revision)return;
    if(permission==='granted')await accept(handle,ticket);else update({status:'permission',message:'已记住文件夹 · 请一键重新授权只读访问'});
   }catch(e){if(ticket===revision)fail(e);}
  }
  async function authorize(){
   if(!state.handle)return;const ticket=++revision;
   try{const permission=state.handle.requestPermission({mode:'read'});update({status:'loading',message:'等待浏览器只读授权…'});if(await permission!=='granted'){if(ticket===revision)update({status:'permission',message:'尚未授权 · 点击重新授权，或另选项目'});return;}if(ticket===revision)await accept(state.handle,ticket);}
   catch(e){if(ticket===revision)update({status:'permission',message:'授权未完成：'+e.message});}
  }
  async function refresh(){
   if(!state.handle){update({message:'请重新选择文件夹以读取最新内容'});return;}
   const ticket=++revision,handle=state.handle;update({status:'loading',message:'正在重新读取项目…'});
   try{const permission=await handle.queryPermission({mode:'read'});if(ticket!==revision)return;if(permission!=='granted'){update({records:[],branches:null,status:'permission',message:'文件夹权限已失效 · 请一键重新授权'});return;}await accept(handle,ticket);}catch(e){if(ticket===revision)fail(e);}
  }
  async function openFiles(fileList){
   const ticket=++revision;update({status:'loading',message:'正在识别所选项目文件夹…'});
   try{const files={},list=Array.from(fileList);for(const [key,path] of Object.entries(adapter.projectFiles)){
    const found=list.filter(f=>f.webkitRelativePath.split('/').slice(1).join('/')===path);if(found.length!==1)throw new Error('所选根文件夹缺少 '+path);files[key]=found[0];
   }const snapshot=await parse(files);if(ticket!==revision)return;
   update({...snapshot,handle:null,name:list[0]?.webkitRelativePath.split('/')[0] || '本地项目',status:'connected',message:'已连接 · 当前浏览器需在下次打开时重新选择文件夹'});
   try{await save(null,ticket);}catch { /* in-memory connection still works */ }
   }catch(e){if(ticket===revision)fail(e);}
  }
  async function disconnect(){const ticket=++revision;update({status:'disconnected',name:'',records:[],branches:null,handle:null,message:'已断开游戏项目 · 当前展示演示数据'});try{await save(null,ticket);}catch{if(ticket===revision)update({message:'已断开；浏览器未能清除记忆，请在网站设置中清除本地存储'});}}
  return {getState:()=>({...state,connected:connected()}),open,openFiles,restore,authorize,refresh,disconnect};
 }
 function browserStore(){
  async function run(action,value){return new Promise((resolve,reject)=>{
   const request=indexedDB.open('gcs-local-project',1);request.onupgradeneeded=()=>request.result.createObjectStore('handles');request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('本地连接存储被其他标签页占用'));
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();let result;
    try {
    const tx=db.transaction('handles',action==='get'?'readonly':'readwrite'),bucket=tx.objectStore('handles');
    const op=action==='get'?bucket.get('project'):value===null?bucket.delete('project'):bucket.put(value,'project');
    op.onsuccess=()=>{result=op.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error || new Error('本地连接存储失败'));};
    }catch(error){db.close();reject(error);}
   };
  });}
  return {load:()=>run('get'),save:handle=>run('save',handle)};
 }
 const api={createProject,browserStore};if(typeof module!=='undefined')module.exports=api;
 if(typeof window!=='undefined'){
  const project=createProject({adapter:root.GCSNingguAdapter,store:browserStore(),notify:()=>window.dispatchEvent(new Event('gcs-project-change'))});root.GCSProject=project;
  const $=id=>document.getElementById(id);
  function controls(){const s=project.getState(),busy=['loading','restoring'].includes(s.status);$('project-status').textContent=(s.name?s.name+' · ':'')+s.message;$('project-open').disabled=busy;$('project-authorize').hidden=s.status!=='permission';$('project-refresh').hidden=!s.connected || !s.handle;$('project-refresh').disabled=busy;$('project-disconnect').hidden=!s.handle&&!s.connected;$('project-open').textContent=s.connected?'切换游戏项目':'打开游戏项目';}
  window.addEventListener('gcs-project-change',controls);
  $('project-open').onclick=()=>{if(typeof window.showDirectoryPicker==='function')project.open(options=>window.showDirectoryPicker(options));else{$('project-folder').value='';$('project-folder').click();}};
  $('project-folder').onchange=e=>{if(e.target.files.length)project.openFiles(e.target.files);};$('project-authorize').onclick=()=>project.authorize();$('project-refresh').onclick=()=>project.refresh();$('project-disconnect').onclick=()=>project.disconnect();
  controls();project.restore();
 }
})(typeof window!=='undefined'?window:globalThis);
