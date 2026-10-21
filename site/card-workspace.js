/* Editable memory copy. Only adapter-approved existing fields may change. */
(function(root){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const get=(docs,field)=>field.path.reduce((o,k)=>o[k],docs[field.document]);
 function put(docs,field,value){let o=docs[field.document];for(const key of field.path.slice(0,-1))o=o[key];o[field.path.at(-1)]=value;}
 const token=field=>JSON.stringify([field.document,...field.path]);
 function assertJSON(value){
  if(typeof value==='number' && (!Number.isFinite(value) || Number.isInteger(value)&&!Number.isSafeInteger(value)))throw new Error('文件含无法安全保留的数值，已停止编辑，原文件未改');
  if(value&&typeof value==='object')for(const child of Object.values(value))assertJSON(child);
 }
 function parseJSON(text){
  const value=JSON.parse(text),tokens=text.replace(/"(?:\\.|[^"\\])*"/g,'""').match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)||[];
  function decimal(token){const m=token.match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/),fraction=m[3]||'',digits=(m[2]+fraction).replace(/^0+/,''),tail=digits.match(/0*$/)[0].length;if(!digits)return '0';return m[1]+digits.slice(0,digits.length-tail)+'e'+(BigInt(m[4]||'0')-BigInt(fraction.length)+BigInt(tail));}
  for(const token of tokens){const number=Number(token);if(token.length>512||!Number.isFinite(number)||decimal(token)!==decimal(JSON.stringify(number)))throw new Error('JSON 含无法无损保留的数值；未载入编辑，不会舍入未知字段');}
  assertJSON(value);return value;
 }
 function createWorkspace({adapter,documents,notify=()=>{}}){
  assertJSON(documents);
  let baseline=clone(documents),draft=clone(documents),history=[],invalid=new Map(),locked=false;
  const specs=adapter.editableFields(baseline),find=(cardId,key,branchId=null)=>specs.find(s=>s.cardId===cardId && s.key===key && s.branchId===branchId);
  const changes=()=>specs.filter(s=>!same(get(baseline,s),get(draft,s))).map(s=>({...s,before:get(baseline,s),after:get(draft,s)}));
  function validate(){if(invalid.size){const field=specs.find(s=>invalid.has(token(s)));throw new Error('还有 '+invalid.size+' 个输入需要修正：'+field.cardId+(field.branchId?' / '+field.branchId:'')+' / '+field.label+'：'+invalid.get(token(field)).message);}const result=adapter.validateDocuments(draft);
   const expected=clone(baseline);for(const field of specs)put(expected,field,get(draft,field));
   if(!same(expected,draft))throw new Error('发现未获准字段或结构变化，禁止保存');return result;
  }
  function edit(cardId,key,value,branchId=null){if(locked)throw new Error('正在应用修改，请稍后');const spec=find(cardId,key,branchId);if(!spec)throw new Error('该字段不允许编辑');const id=token(spec);
   try {const next=adapter.coerce(spec,value),before=get(draft,spec);invalid.delete(id);if(!same(next,before)){history.push({spec,before,next});put(draft,spec,next);}}
   catch(e){invalid.set(id,{message:e.message,input:value});}notify();
  }
  function revertField(cardId,key,branchId=null){if(locked)return;const field=find(cardId,key,branchId);if(!field)return;invalid.delete(token(field));const before=get(draft,field),next=get(baseline,field);if(!same(before,next)){history.push({spec:field,before,next});put(draft,field,next);}notify();}
  function undo(){if(locked)return;if(invalid.size){invalid.clear();notify();return;}const step=history.pop();if(step)put(draft,step.spec,step.before);notify();}
  function reset(cardId=null){if(locked)return;for(const field of specs)if(cardId===null || field.cardId===cardId){invalid.delete(token(field));put(draft,field,get(baseline,field));}history=history.filter(step=>cardId!==null && step.spec.cardId!==cardId);notify();}
  function markSaved(){baseline=clone(draft);history=[];invalid.clear();notify();}
  return {edit,revertField,undo,reset,validate,markSaved,setLocked:value=>{locked=value;notify();},get locked(){return locked;},get documents(){return clone(draft);},get originalDocuments(){return clone(baseline);},get fields(){return specs.map(s=>({...s}));},get records(){return adapter.readRecords(draft.cards);},get branches(){return adapter.readBranches(draft.branches);},get changes(){return changes();},get invalid(){return specs.filter(s=>invalid.has(token(s))).map(s=>({...s,...invalid.get(token(s))}));},error:field=>invalid.get(token(field))?.message,inputValue:field=>invalid.has(token(field))?invalid.get(token(field)).input:get(draft,field),value:field=>get(draft,field),original:field=>get(baseline,field),get canUndo(){return !!history.length || !!invalid.size;}};
 }
 const api={createWorkspace,parseJSON};root.GCSCardWorkspace=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
