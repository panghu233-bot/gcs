const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createProject}=require('../site/game-project.js');
test('event loading, isolation, refresh permission loss and disconnect clear event snapshot without touching card drafts',async()=>{
 const adapter={projectFiles:{cards:'data/catalog.json',branches:'data/branches.json'},readRecords:j=>j.records,readBranches:j=>j.groups};
 const handle={name:'synthetic',queryPermission:async()=> 'granted',getDirectoryHandle:async()=>handle,getFileHandle:async n=>({getFile:async()=>({size:100,text:async()=>JSON.stringify(n==='catalog.json'?{records:[{id:'one'}]}:{groups:{one:[]}})})})};
 let fail=false;const w={changes:[],locked:false};const p=createProject({adapter,store:{load:async()=>null,save:async()=>{}},eventReader:{fromHandle:async()=>{if(fail)throw Error('event unavailable');return w;}}});
 await p.open(async()=>handle);assert.equal(p.getState().eventWorkspace,w);w.locked=true;await p.disconnect();assert(p.getState().connected);w.locked=false;fail=true;await p.refresh();assert(p.getState().connected);assert.equal(p.getState().eventWorkspace,null);assert.equal(p.getState().eventError,'event unavailable');fail=false;await p.refresh();handle.queryPermission=async()=> 'denied';await p.refresh();assert.equal(p.getState().eventWorkspace,null);assert(!p.getState().connected);await p.disconnect();assert.equal(p.getState().eventError,'');
});
test('browser entry loads dependencies before consumers and real events route independently from demo data',()=>{
 const html=fs.readFileSync('site/index.html','utf8'),scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
 for(const [a,b] of [['gdscript-string-patch.js','event-project.js'],['event-project.js','game-project.js'],['event-project.js','event-writer.js'],['event-writer.js','event-studio.js'],['event-studio.js','app.js']])assert(scripts.indexOf(a)>=0&&scripts.indexOf(a)<scripts.indexOf(b));
 const app=fs.readFileSync('site/app.js','utf8');assert(app.includes('if(realEvents()){renderList();window.GCSEventStudio.render('));assert(app.includes('if(realEvents()){window.GCSEventStudio.renderList(query);return;}'));assert(app.includes('if(realEvents())return;'));
});


test('event portrait resources release on refresh, permission loss and disconnect; dependencies load in order',async()=>{
 const made=[],adapter={projectFiles:{cards:'data/catalog.json',branches:'data/branches.json'},readRecords:j=>j.records,readBranches:j=>j.groups};
 let allowed=true;
 const handle={name:'test',queryPermission:async()=>allowed?'granted':'denied',getDirectoryHandle:async()=>handle,getFileHandle:async n=>({getFile:async()=>({size:100,text:async()=>JSON.stringify(n==='catalog.json'?{records:[{id:'one'}]}:{groups:{one:[]}})})})};
 const p=createProject({adapter,store:{load:async()=>null,save:async()=>{}},eventReader:{fromHandle:async()=>{const w={changes:[],release(){this.released=true;}};made.push(w);return w;}}});
 await p.open(async()=>handle);await p.refresh();assert(made[0].released);assert(!made[1].released);allowed=false;await p.refresh();assert(made[1].released);allowed=true;await p.open(async()=>handle);await p.disconnect();assert(made[2].released);
 const html=fs.readFileSync('site/index.html','utf8');assert(html.indexOf('src="gdscript-string-patch.js"')<html.indexOf('src="event-performance.js"'));assert(html.indexOf('src="event-performance.js"')<html.indexOf('src="event-project.js"'));
});
