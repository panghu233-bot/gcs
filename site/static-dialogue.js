/* Strict, non-executing reader for literal dialogue builders. Unknown syntax fails closed. */
(function(root){
'use strict';
const p=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const fields=['speaker','text','left','right','mood'],enc=new TextEncoder();
function read(bytes,spec){
 const source=p.decode(bytes);if(!p.equal(enc.encode(source),bytes))throw Error('UTF-8 无法无损往返');
 const all=p.lex(source),owner=spec.className?p.scope(all,'class',spec.className):all;
 if(spec.className&&(owner[0].column!==0||owner[2]?.value!==':'))throw Error('仅支持顶层直接事件类');
 const fn=p.scope(owner,'func',spec.functionName),env=Object.create(null);
 // Constants may only be scalar strings or aliases; no evaluation of GDScript.
 const declarations=owner.filter(t=>t.value==='const'&&t.head&&t.column===fn[0].column);if(new Set(declarations.map(t=>owner[owner.indexOf(t)+1]?.value)).size!==declarations.length)throw Error('同作用域常量重复');
 for(let pass=0;pass<3;pass++)for(let i=0;i<owner.length;i++)if(owner[i].value==='const'&&owner[i].head&&owner[i].column===fn[0].column){
  let j=i+2;while(j<owner.length&&owner[j].line===owner[i].line&&owner[j].value!=='=')j++;
  const v=owner[j+1],next=owner[j+2];if(!v||next?.line===v.line)continue;
  if(v.kind==='string'&&!v.prefix)env[owner[i+1].value]=v.value;else if(v.kind==='id'&&Object.hasOwn(env,v.value))env[owner[i+1].value]=env[v.value];
 }
 const helpers=new Map();
 function parser(ts,bindings=env){
  let pos=0;const take=v=>{if(ts[pos++]?.value!==v)throw Error('未支持的对白结构，预期 '+v);};
  function value(){
   const t=ts[pos++];if(!t)throw Error('表达式未结束');
   if(t.kind==='string'&&!t.prefix)return {value:t.value,token:t};
   if(t.kind==='id'&&Object.hasOwn(bindings,t.value))return {value:bindings[t.value]};
   throw Error('字段包含动态表达式或未知常量：'+t.value);
  }
  function dictionary(){
   take('{');const row=Object.create(null),tokens={};
   while(ts[pos]?.value!=='}'){
    const key=ts[pos++];if(key?.kind!=='string'||key.prefix||!fields.includes(key.value)||Object.hasOwn(row,key.value))throw Error('含分支、跳转、额外或重复演出字段');
    take(':');const v=value();row[key.value]=v.value;tokens[key.value]=v.token;
    if(ts[pos]?.value===',')take(',');else if(ts[pos]?.value!=='}')throw Error('字典含未支持表达式');
   }take('}');if(fields.some(k=>typeof row[k]!=='string'))throw Error('对白必须显式提供文字、说话人、左右立绘和表情');
   return {...row,token:tokens.text,line:tokens.text?.line,form:'dictionary'};
  }
  function expression(){
   if(ts[pos]?.value==='{')return dictionary();
   const name=ts[pos++];if(name?.kind!=='id'||!name.value.startsWith('_'))throw Error('仅支持字面量字典或已验证的纯对白辅助函数');
   const h=helper(name.value),args=[];take('(');while(ts[pos]?.value!==')'){args.push(value());if(ts[pos]?.value===',')take(',');else if(ts[pos]?.value!==')')throw Error('辅助函数参数含动态表达式');}take(')');
   if(args.length>h.params.length||args.length<h.required)throw Error('辅助函数参数数量不符');
   const bound=Object.assign(Object.create(null),env);h.params.forEach((param,i)=>bound[param.name]=args[i]?.value??param.default);
   const r=parser(h.body,bound);r.take('return');const row=r.dictionary();if(!r.done())throw Error('辅助函数包含额外执行逻辑');
   // Text token belongs to the call argument, never to the shared helper body.
   const textArg=h.textParam===null?null:args[h.textParam];if(!textArg?.token)throw Error('对白文字必须是调用处独立字符串');
   return {...row,token:textArg.token,line:textArg.token.line,form:'helper'};
  }
  return {take,value,dictionary,expression,peek:()=>ts[pos],done:()=>pos===ts.length,get pos(){return pos;}};
 }
 function helper(name){
  if(helpers.has(name))return helpers.get(name);
  const ts=p.scope(owner,'func',name),r=parser(ts);r.take('static');r.take('func');r.take(name);r.take('(');const params=[];let required=0;
  while(r.peek()?.value!==')'){
   const n=r.peek();if(n?.kind!=='id')throw Error('辅助函数参数无法确认');r.take(n.value);r.take(':');r.take('String');let def;
   if(r.peek()?.value==='='){r.take('=');def=r.value().value;}else {if(params.some(x=>x.default!==undefined))throw Error('辅助函数默认值顺序不受支持');required++;}
   params.push({name:n.value,default:def});if(r.peek()?.value===',')r.take(',');else if(r.peek()?.value!==')')throw Error('辅助函数签名无法确认');
  }
  [')','-','>','Dictionary',':'].forEach(r.take);const body=ts.slice(r.pos),b=parser(body,Object.assign(Object.create(null),env,Object.fromEntries(params.map(x=>[x.name,'@'+x.name]))));b.take('return');const row=b.dictionary();if(!b.done())throw Error('辅助函数不是纯字面量映射');
  const textParam=params.findIndex(x=>row.text==='@'+x.name);if(textParam<0)throw Error('辅助函数文字映射不明确');
  const h={params,required,body,textParam};h.signature=ts.map(t=>[t.kind,t.value,t.prefix]);helpers.set(name,h);return h;
 }
 const r=parser(fn);['static','func',spec.functionName,'(',')','-','>','Array','[','Dictionary',']',':'].forEach(r.take);const colon=fn[r.pos-1],lines=[];let openingBg=null;
 const independent=()=>{const t=r.peek();if(!t?.head||t.column<=fn[0].column)throw Error('语句缩进或边界不明确');};
 if(r.peek()?.value==='return'){
  independent();r.take('return');r.take('[');while(r.peek()?.value!==']'){lines.push(r.expression());if(r.peek()?.value===',')r.take(',');else if(r.peek()?.value!==']')throw Error('数组含未支持语法');}r.take(']');
 }else{
  independent();['var','out',':','Array','[','Dictionary',']','=','[',']'].forEach(r.take);
  if(r.peek()?.value==='var'){
   independent();['var','first',':','='].forEach(r.take);lines.push(r.expression());
   if(r.peek()?.value==='first'){
    independent();r.take('first');r.take('[');if(r.value().value!=='bg')throw Error('首句含额外属性');[']','='].forEach(r.take);const bg=r.peek();if(bg?.kind!=='id')throw Error('开场背景必须为原有常量');r.take(bg.value);openingBg=bg.value;
   }
   independent();['out','.','append','(','first',')'].forEach(r.take);
  }
  while(r.peek()&&r.peek().value!=='return'){
   const wrapped=r.peek().value==='(';independent();if(wrapped)r.take('(');['out','.','append','('].forEach(r.take);lines.push(r.expression());r.take(')');if(wrapped)r.take(')');
  }
  independent();r.take('return');r.take('out');
 }
 if(!r.done()||!lines.length)throw Error('未知执行逻辑或空对白');
 const bodyStart=source.indexOf('\n',colon.end)+1,last=fn.at(-1),nl=source.indexOf('\n',last.end),bodyEnd=nl<0?source.length:nl-(source[nl-1]==='\r'?1:0);
 if(!bodyStart||fn[r.pos-1].line===colon.line)throw Error('函数体必须独立换行');
 const bodyTokens=fn.filter(t=>t.start>=bodyStart);const first=bodyTokens[0],lineStart=source.lastIndexOf('\n',first.start-1)+1,indent=source.slice(lineStart,first.start);if(!/^[\t ]+$/.test(indent))throw Error('缩进不明确');
 let cursor=bodyStart,hasComments=false;for(const t of bodyTokens){if(source.slice(cursor,t.start).includes('#'))hasComments=true;cursor=t.end;}if(source.slice(cursor,bodyEnd).includes('#'))hasComments=true;
 const next=all.find(t=>t.start>last.end);if(/(?:^|\n)[\t ]+#/.test(source.slice(bodyEnd,next?.start??source.length)))hasComments=true;
 const constants=[];for(let i=0;i<all.length;i++)if(all[i].head&&all[i].value==='const'&&(all[i].column===0||owner.includes(all[i])&&all[i].column===fn[0].column)){let end=i+1;while(end<all.length&&!(all[end].head&&all[end].column<=all[i].column))end++;constants.push(all.slice(i,end).map(t=>[t.kind,t.value,t.prefix]));}
 const helperSignatures=[];for(let i=0;i<owner.length-2;i++)if(owner[i].head&&owner[i].column===fn[0].column&&owner[i].value==='static'&&owner[i+1].value==='func'&&owner[i+2].value.startsWith('_')){let end=i+1;while(end<owner.length&&!(owner[end].head&&owner[end].column<=owner[i].column))end++;helperSignatures.push(owner.slice(i,end).map(t=>[t.kind,t.value,t.prefix]));}
 const dependencies=JSON.stringify({constants,helpers:helperSignatures});
 return {source,lines,openingBg,dependencies,defaultSpeaker:'',body:{start:bodyStart,end:bodyEnd,indent,hasComments},legacyCompatible:false};
}
const api={read};if(typeof module!=='undefined')module.exports=api;root.GCSStaticDialogue=api;
})(typeof window!=='undefined'?window:globalThis);
