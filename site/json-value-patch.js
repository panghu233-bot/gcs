/* Value-only JSON patches: parser-located spans; no formatting or whole-document serialization fallback. */
(function(root,factory){
 if(typeof module!=='undefined')module.exports=factory(require('./vendor/jsonc-parser.js'),require('./card-workspace.js'));
 else root.GCSJSONPatch=factory(root.GCSJSONC,root.GCSCardWorkspace);
})(typeof window!=='undefined'?window:globalThis,function(jsonc,workspace){
 'use strict';
 const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),clone=v=>JSON.parse(JSON.stringify(v));
 const identity=field=>JSON.stringify([field.document,...field.path]);
 function get(docs,field){let value=docs[field.document];for(const key of field.path){if(value===null||typeof value!=='object'||!Object.hasOwn(value,key))throw new Error('目标字段不存在，拒绝插入或重建结构');value=value[key];}return value;}
 function set(docs,field,value){let parent=docs[field.document];for(const key of field.path.slice(0,-1))parent=parent[key];Object.defineProperty(parent,field.path.at(-1),{value,writable:true,enumerable:true,configurable:true});}
 function read(input){
  const original=new Uint8Array(input),bom=original.length>=3&&original[0]===239&&original[1]===187&&original[2]===191,body=original.subarray(bom?3:0);
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body);
  if(!equal(new TextEncoder().encode(text),body))throw new Error('原文件不是可无损保留的 UTF-8，拒绝保存');
  const value=workspace.parseJSON(text),errors=[],tree=jsonc.parseTree(text,errors,{disallowComments:true,allowTrailingComma:false,allowEmptyContent:false});
  if(errors.length||!tree)throw new Error('JSON 语法树存在错误，拒绝保存');
  function check(node){if(node.type==='object'){const keys=new Set();for(const property of node.children||[]){const name=property.children[0].value;if(keys.has(name))throw new Error('JSON 存在重复键，无法安全定位：'+name);keys.add(name);}}for(const child of node.children||[])check(child);}
  check(tree);return {original,text,value,tree,bom};
 }
 function verifySegments(before,after,edits){let oldPosition=0,newPosition=0;for(const edit of edits){const untouched=before.slice(oldPosition,edit.offset);if(after.slice(newPosition,newPosition+untouched.length)!==untouched)throw new Error('检测到目标值之外的文本变化，拒绝保存');newPosition+=untouched.length;if(after.slice(newPosition,newPosition+edit.content.length)!==edit.content)throw new Error('补丁内容校验失败');newPosition+=edit.content.length;oldPosition=edit.offset+edit.length;}if(after.slice(newPosition)!==before.slice(oldPosition))throw new Error('检测到文件尾部变化，拒绝保存');}
 function plan({adapter,originalBytes,documents,changes}){
  if(!jsonc?.parseTree||!jsonc?.modify||!jsonc?.applyEdits||!workspace?.parseJSON)throw new Error('局部保存组件不可用，已拒绝写回');
  if(!Array.isArray(changes)||!changes.length)throw new Error('没有需要应用的修改');
  const keys=Object.keys(adapter.projectFiles),sources={},beforeDocs={};
  for(const key of keys){if(!originalBytes[key])throw new Error('缺少原始文件字节');sources[key]=read(originalBytes[key]);beforeDocs[key]=sources[key].value;}
  adapter.validateDocuments(beforeDocs);adapter.validateDocuments(documents);
  const allowed=new Map(adapter.editableFields(beforeDocs).map(field=>[identity(field),field])),seen=new Set(),expected=clone(beforeDocs),edits=Object.fromEntries(keys.map(key=>[key,[]]));
  for(const change of changes){
   if(!change||!Array.isArray(change.path)||!keys.includes(change.document))throw new Error('修改路径无效');
   const id=identity(change),spec=allowed.get(id);if(!spec||seen.has(id))throw new Error('未授权或重复的字段修改，拒绝保存');seen.add(id);
   if(change.cardId!==undefined&&change.cardId!==spec.cardId || change.branchId!==undefined&&change.branchId!==spec.branchId)throw new Error('字段所属卡牌或分支不匹配');
   const before=get(beforeDocs,spec),after=get(documents,spec);
   if(!same(before,change.before)||!same(after,change.after)||same(before,after))throw new Error('原始值、目标值与用户修改不一致');
   if(!['string','number'].includes(typeof after)||typeof before!==typeof after)throw new Error('只允许替换既有文本或数值字段');
   if(!same(adapter.coerce(spec,after),after))throw new Error('字段值未通过验证');
   const source=sources[spec.document],node=jsonc.findNodeAtLocation(source.tree,spec.path);
   if(!node||!['string','number'].includes(node.type)||!same(jsonc.getNodeValue(node),before))throw new Error('无法唯一定位原始字段值');
   // Omitting formattingOptions is deliberate: upstream returns a value-token replacement only.
   const patch=jsonc.modify(source.text,spec.path,after,{}),content=JSON.stringify(after);
   if(patch.length!==1||patch[0].offset!==node.offset||patch[0].length!==node.length||patch[0].content!==content)throw new Error('解析器生成了超出目标值范围的编辑，拒绝保存');
   edits[spec.document].push({...patch[0],path:spec.path,before:source.text.slice(node.offset,node.offset+node.length)});set(expected,spec,after);
  }
  if(!same(expected,documents))throw new Error('发现未经授权的字段、顺序或结构差异，拒绝保存');
  const output={},parsed={},reports={};
  for(const key of keys){const source=sources[key],list=edits[key].sort((a,b)=>a.offset-b.offset);for(let i=1;i<list.length;i++)if(list[i].offset<list[i-1].offset+list[i-1].length)throw new Error('字段文本范围重叠，拒绝保存');
   const text=list.length?jsonc.applyEdits(source.text,list):source.text;verifySegments(source.text,text,list);
   const body=new TextEncoder().encode(text),after=new Uint8Array(body.length+(source.bom?3:0));if(source.bom)after.set([239,187,191]);after.set(body,source.bom?3:0);
   const verified=read(after);if(!same(verified.value,documents[key]))throw new Error('局部修改后的完整 JSON 与工作副本不一致');
   if(!list.length&&!equal(source.original,after))throw new Error('未修改文件出现字节变化，拒绝保存');
   output[key]=after;parsed[key]=verified.value;reports[key]=list;
  }
  adapter.validateDocuments(parsed);if(!same(parsed,expected))throw new Error('字段差异最终验证失败');
  return {output,edits:reports};
 }
 return {plan};
});
