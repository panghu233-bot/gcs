const {test}=require('node:test');const assert=require('node:assert/strict');
const {createProject}=require('../site/game-project.js');
const adapter={projectFiles:{cards:'data/cards/catalog.json',branches:'data/cards/branches.json'},readRecords:j=>j.records,readBranches:j=>j.groups};
const file=json=>({size:100,text:async()=>JSON.stringify(json)});
function handle(name='sample'){
 const log=[],files={'catalog.json':file({records:[{id:'example',value:{name:'Example'}}]}),'branches.json':file({groups:{example:[]}})};
 const h={name,permission:'granted',log,queryPermission:async o=>{log.push(['query',o]);return h.permission;},requestPermission:async o=>{log.push(['request',o]);return h.nextPermission || h.permission;},getDirectoryHandle:async(n,o)=>{log.push(['directory',n,o]);return h;},getFileHandle:async(n,o)=>{log.push(['file',n,o]);if(!files[n])throw Object.assign(new Error('missing'),{name:'NotFoundError'});return {getFile:async()=>files[n]};}};
 return h;
}
function setup(saved=null){let item=saved;const store={load:async()=>item,save:async h=>{item=h;}};return {project:createProject({adapter,store}),store,stored:()=>item};}
test('one root selection loads both declared paths and persists only the read handle',async()=>{
 const x=setup(),h=handle();let pickerOptions;await x.project.open(async o=>{pickerOptions=o;return h;});assert.equal(pickerOptions.mode,'read');assert(x.project.getState().connected);assert.equal(x.stored(),h);assert.equal(h.log.filter(x=>x[0]==='file').length,2);assert(h.log.filter(x=>['directory','file'].includes(x[0])).every(x=>x[2].create===false));
 const second=createProject({adapter,store:x.store});await second.restore();assert(second.getState().connected);assert(!h.log.some(x=>x[0]==='request'));
 await second.disconnect();assert.equal(x.stored(),null);assert(!second.getState().connected);
});
test('restoration never prompts; one user action requests read permission; denial is recoverable',async()=>{
 const h=handle();h.permission='prompt';const {project}=setup(h);await project.restore();assert.equal(project.getState().status,'permission');assert.equal(h.log.filter(x=>x[0]==='file').length,0);assert(!h.log.some(x=>x[0]==='request'));
 h.nextPermission='denied';await project.authorize();assert.equal(project.getState().status,'permission');assert(!project.getState().connected);
 h.nextPermission='granted';await project.authorize();assert(project.getState().connected);assert(h.log.filter(x=>x[0]==='request').every(x=>x[1].mode==='read'));
 h.permission='denied';await project.refresh();assert(!project.getState().connected);assert.equal(project.getState().status,'permission');
});
test('cancelled or malformed replacement leaves prior project and remembered handle intact',async()=>{
 const x=setup(),good=handle();await x.project.open(async()=>good);
 await x.project.open(async()=>{throw Object.assign(new Error(),{name:'AbortError'});});assert(x.project.getState().connected);
 const bad=handle('invalid');bad.getFileHandle=async()=>{throw Object.assign(new Error(),{name:'NotFoundError'});};await x.project.open(async()=>bad);assert.equal(x.stored(),good);assert.equal(x.project.getState().name,good.name);assert.match(x.project.getState().message,/缺少/);
});
test('slow restore or load cannot reconnect a disconnected project',async()=>{
 let finish;const h=handle();const store={load:()=>new Promise(r=>finish=r),save:async()=>{}};
 const p=createProject({adapter,store});const restoring=p.restore();await p.disconnect();finish(h);await restoring;assert(!p.getState().connected);
 let read;const f=handle();f.getFileHandle=()=>new Promise(r=>read=()=>r({getFile:async()=>file({records:[],groups:{}})}));
 const operation=p.open(async()=>f);await new Promise(r=>setImmediate(r));await p.disconnect();read();await new Promise(r=>setImmediate(r));read();await operation;assert(!p.getState().connected);
});
test('folder fallback auto locates exact relative paths, never reads unrelated content',async()=>{
 const {project}=setup();let extraRead=false;
 const files=[{...file({records:[{id:'example'}]}),webkitRelativePath:'sample/data/cards/catalog.json'},{...file({groups:{example:[]}}),webkitRelativePath:'sample/data/cards/branches.json'},{webkitRelativePath:'sample/secret.txt',text:async()=>{extraRead=true;throw Error('must not read');}}];
 await project.openFiles(files);assert(project.getState().connected);assert(!extraRead);assert.equal(project.getState().handle,null);assert.match(project.getState().message,/下次/);
});
test('unavailable browser storage does not prevent in-memory connection',async()=>{
 const p=createProject({adapter,store:{save:async()=>{throw Error('quota');},load:async()=>null}});await p.open(async()=>handle());assert(p.getState().connected);assert.match(p.getState().message,/无法记住/);
});
test('cancelled re-selection keeps the saved-folder authorization action available',async()=>{
 const h=handle();h.permission='prompt';const {project}=setup(h);await project.restore();await project.open(async()=>{throw Object.assign(new Error(),{name:'AbortError'});});assert.equal(project.getState().status,'permission');assert.equal(project.getState().handle,h);
});
test('refresh reads the files again instead of relying on cached JSON',async()=>{
 const {project}=setup(),h=handle();await project.open(async()=>h);
 h.getFileHandle=async name=>({getFile:async()=>name==='catalog.json'?file({records:[{id:'fresh',value:{cost:7}}]}):file({groups:{fresh:[]}})});
 await project.refresh();assert.equal(project.getState().records[0].id,'fresh');assert.equal(project.getState().records[0].value.cost,7);
});
