/* Read-only event portrait transport. No project files or images leave the browser. */
(function(root){
'use strict';
const patch=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const paths={visuals:'scripts/cultivation/ui/cultivation_scene_visuals.gd',player:'scripts/cultivation/ui/cultivation_dialogue_player.gd'};
const ordinary=new Set(['normal','shy','sigh','proud','haggard']);
function constant(tokens,name){
 const hits=tokens.flatMap((t,i)=>t.value==='const'&&tokens[i+1]?.value===name?[i]:[]);if(hits.length!==1)throw Error('立绘常量无法唯一识别：'+name);
 let i=hits[0]+2;while(i<tokens.length&&tokens[i].value!=='='&&tokens[i].line===tokens[hits[0]].line)i++;i++;
 const token=tokens[i];if(token?.kind==='string'&&!token.prefix)return token.value;
 if(token?.value!=='{')throw Error('立绘常量不是直接字面量：'+name);
 const out=Object.create(null);i++;
 while(tokens[i]?.value!=='}'){
  const k=tokens[i++];if(k?.kind!=='string'||k.prefix||tokens[i++]?.value!==':')throw Error('人物映射不受支持');
  const v=tokens[i++];if(v?.kind!=='string'||v.prefix||Object.hasOwn(out,k.value))throw Error('人物映射不受支持');out[k.value]=v.value;
  if(tokens[i]?.value===',')i++;else if(tokens[i]?.value!=='}')throw Error('人物映射不受支持');
 }return out;
}
function functionBody(tokens,name){
 const starts=tokens.flatMap((t,i)=>t.value==='func'&&tokens[i+1]?.value===name?[i]:[]);if(starts.length!==1)throw Error('无法唯一定位立绘函数：'+name);
 const start=starts[0],indent=tokens[start].column;let i=start+2,depth=0;
 for(;i<tokens.length;i++){if(tokens[i].value==='(')depth++;if(tokens[i].value===')'&&(--depth)===0){i++;break;}}
 while(i<tokens.length&&tokens[i].value!==':')i++;if(i===tokens.length)throw Error('立绘函数签名不受支持');
 let end=i+1;while(end<tokens.length&&!(tokens[end].head&&tokens[end].column<=indent))end++;return tokens.slice(i+1,end);
}
function rules(visualSource,playerSource){
 const ts=patch.lex(visualSource),player=functionBody(patch.lex(playerSource),'_apply_portrait_override');
 for(const side of ['left','right']){
  const expected=side+'_mood = "normal" if '+side+'_override != "顾清寒" else mood',needle=patch.lex(expected);
  if(!player.some((_,i)=>patch.sameTokens(player.slice(i,i+needle.length),expected)))throw Error('播放器表情规则已变化，预览已停止');
 }
 const loader=functionBody(ts,'load_portrait_for_speaker');
 if(!loader.some((_,i)=>patch.sameTokens(loader.slice(i,i+3),'filename = mood')))throw Error('立绘加载规则已变化，预览已停止');
 return {base:constant(ts,'PORTRAIT_BASE_PATH'),folders:constant(ts,'SPEAKER_PORTRAIT_MAP'),files:constant(ts,'SPEAKER_FILENAME_MAP')};
}
function safePath(ref){const p=String(ref).replace(/^res:\/\//,'');if(!p.startsWith('assets/')||/[\\:\x00-\x1f]/.test(p)||p.split('/').some(s=>!s||s==='.'||s==='..')||!p.endsWith('.png'))throw Error('立绘路径不安全');return p;}
function create({read,makeUrl=f=>URL.createObjectURL(f),revokeUrl=u=>URL.revokeObjectURL(u)}){
 let disposed=false,rulePromise,catalogPromise;const cache=new Map(),urls=new Set();
 const active=()=>{if(disposed)throw Error('项目连接已释放');};
 async function source(path){active();const f=await read(path);active();if(!f||f.size>4*1024*1024)throw Error('缺少或无法读取立绘规则：'+path);return f.text();}
 function getRules(){active();return rulePromise??=Promise.all([source(paths.visuals),source(paths.player)]).then(([v,p])=>{active();return rules(v,p);});}
 async function image(path){
  active();if(!cache.has(path))cache.set(path,(async()=>{
   const f=await read(path);active();if(!f)return null;if(!f.size||f.size>8*1024*1024)throw Error('立绘文件大小无效：'+path);
   const bytes=new Uint8Array(await f.arrayBuffer());active();if(![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error('立绘不是有效 PNG：'+path);
   const image=makeUrl(f);urls.add(image);return image;
  })());return cache.get(path);
 }
 async function catalog(){
  active();return catalogPromise??=(async()=>{
   const r=await getRules();active();const names=[...new Set([...Object.keys(r.folders),...Object.keys(r.files)])].sort((a,b)=>a.localeCompare(b,'zh-Hans-CN')),moods=[];
   if(names.includes('顾清寒')&&!r.files['顾清寒'])for(const mood of ordinary){
    const path=safePath(r.base+(r.folders['顾清寒']||'npc')+'/'+mood+'.png'),f=await read(path);active();
    if(!f||!f.size||f.size>8*1024*1024)continue;
    const bytes=new Uint8Array(await f.arrayBuffer());active();if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))moods.push(mood);
   }
   return {names,moods};
  })();
 }
 async function portrait(name,mood){
  if(!name)return {name:'',image:'',mood:'',empty:true};
  const r=await getRules();active();if(!Object.hasOwn(r.folders,name)&&!Object.hasOwn(r.files,name))return {name,image:'',mood:'normal',error:'未识别的人物立绘映射'};
  const effective=name==='顾清寒'?mood:'normal';
  if(name==='顾清寒'&&!ordinary.has(effective))return {name,image:'',mood:effective,error:'动作或未知表情不纳入普通表情预览'};
  const filename=r.files[name]||effective,folder=r.folders[name]||'npc',path=safePath(r.base+folder+'/'+filename+'.png');
  let url=await image(path);active();if(url)return {name,image:url,path,mood:effective,fixed:!!r.files[name]||name!=='顾清寒'};
  const fallback=safePath(r.base+folder+'/normal.png');
  if(fallback!==path){url=await image(fallback);active();if(url)return {name,image:url,path:fallback,mood:'normal',warning:'所需立绘缺失，显示 normal 回退图'};}
  return {name,image:'',path,mood:effective,error:'本地立绘文件缺失'};
 }
 return {async choices(line){const c=await catalog();active();const expressive=line.left==='顾清寒'||line.right==='顾清寒';return {names:[...c.names],moods:expressive?[...c.moods]:['normal'],moodEnabled:expressive&&c.moods.length>0};},async load(line){active();const mood=line.mood||'normal';const [left,right]=await Promise.all([portrait(line.left||'',mood),portrait(line.right||'',mood)]);active();return {left,right};},release(){if(disposed)return;disposed=true;for(const url of urls)revokeUrl(url);urls.clear();cache.clear();}};
}
const api={create,rules,safePath,paths};if(typeof module!=='undefined')module.exports=api;root.GCSEventPerformance=api;
})(typeof window!=='undefined'?window:globalThis);
