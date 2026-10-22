/* Conservative lexer + linear dialogue adapter. Never reserialize a source file. */
(function(root){
'use strict';
const enc=new TextEncoder(),equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function decode(bytes){return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}
function unicode(s){for(let i=0;i<s.length;i++){const n=s.charCodeAt(i);if(n>=0xd800&&n<=0xdbff){const next=s.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))throw Error('存在不完整的 Unicode 字符');}else if(n>=0xdc00&&n<=0xdfff)throw Error('存在不完整的 Unicode 字符');}return s;}
function lex(source){
 const tokens=[];let i=source.charCodeAt(0)===0xfeff?1:0,line=1,column=0,first=true;
 const advance=()=>{const c=source[i++];if(c==='\n'){line++;column=0;first=true;}else if(c!=='\r')column++;return c;};
 while(i<source.length){
  const c=source[i];if(/\s/.test(c)){advance();continue;}if(c==='#'){while(i<source.length&&source[i]!=='\n')advance();continue;}
  const start=i,row=line,col=column,head=first;first=false;let kind='symbol',value='',prefix='',quote='';
  if((c==='r'||c==='&'||c==='^')&&/['"]/.test(source[i+1]||''))prefix=advance();
  if(/['"]/.test(source[i]||'')){
   kind='string';const q=advance();quote=q;if(source.slice(i,i+2)===q+q){advance();advance();quote=q.repeat(3);}let closed=false;
   while(i<source.length){
    if(source.slice(i,i+quote.length)===quote){for(let n=0;n<quote.length;n++)advance();closed=true;break;}
    const ch=advance();if(ch==='\r')continue;if(ch==='\n'&&quote.length===1)throw Error('单行字符串中出现原始换行');
    if(ch!=='\\'){value+=ch;continue;}
    if(i>=source.length)throw Error('未结束的转义');const e=advance();
    if(prefix==='r'){value+='\\'+e;continue;}
    const escapes={a:'\x07',b:'\b',f:'\f',n:'\n',r:'\r',t:'\t',v:'\v','\\':'\\','"':'"',"'":"'"};
    if(Object.hasOwn(escapes,e))value+=escapes[e];
    else if(e==='u'||e==='U'){const size=e==='u'?4:6,hex=source.slice(i,i+size);if(!new RegExp('^[0-9a-fA-F]{'+size+'}$').test(hex))throw Error('无效 Unicode 转义');const cp=parseInt(hex,16);if(cp>0x10ffff)throw Error('无效 Unicode 码位');value+=String.fromCodePoint(cp);for(let n=0;n<size;n++)advance();}
    else if(e==='\n'){}else if(e==='\r'&&source[i]==='\n'){advance();}else throw Error('不支持的字符串转义：\\'+e);
   }
   if(!closed)throw Error('字符串没有结束');unicode(value);
  }else if(prefix)throw Error('无效字符串前缀');
  else if(/[\p{L}_]/u.test(c)){kind='id';while(i<source.length&&/[\p{L}\p{N}_]/u.test(source[i]))value+=advance();}
  else if(/[0-9]/.test(c)){kind='number';while(i<source.length&&/[0-9]/.test(source[i]))value+=advance();}
  else value=advance();
  tokens.push({kind,value,prefix,quote,start,end:i,line:row,column:col,head});
 }
 return tokens;
}
const signature=t=>JSON.stringify(t.map(x=>[x.kind,x.value,x.prefix]));
function sameTokens(tokens,source){return signature(tokens)===signature(lex(source));}
function scope(tokens,type,name){
 const candidates=[];
 for(let i=0;i<tokens.length-1;i++)if(tokens[i].value===type&&tokens[i+1].value===name&&(tokens[i].head||(type==='func'&&tokens[i-1]?.head&&tokens[i-1].value==='static'))){
  const start=type==='func'&&tokens[i-1]?.value==='static'?i-1:i,indent=tokens[start].column;
  let end=start+1;while(end<tokens.length&&!(tokens[end].head&&tokens[end].column<=indent))end++;
  candidates.push(tokens.slice(start,end));
 }
 if(candidates.length!==1)throw Error('无法唯一定位 '+type+' '+name);return candidates[0];
}
function encode(value,token){
 if(typeof value!=='string'||value.length>20000)throw Error('对白必须是 20000 字以内的文本');unicode(value);
 if(token.prefix)throw Error('不编辑带前缀的字符串');const q=token.quote[0];let out='';
 for(const c of value){if(c==='\\')out+='\\\\';else if(c===q)out+='\\'+c;else if(c==='\n')out+=token.quote.length===3?'\n':'\\n';else if(c==='\r')out+='\\r';else if(c==='\t')out+='\\t';else if(c.codePointAt(0)<32||/[\u007f\u202a-\u202e\u2066-\u2069\ufeff]/.test(c))out+='\\u'+c.codePointAt(0).toString(16).padStart(4,'0');else out+=c;}
 return token.quote+out+token.quote;
}
function readLinear(bytes,spec){
 const source=decode(bytes);if(!equal(enc.encode(source),bytes))throw Error('UTF-8 无法无损往返');
 const all=lex(source),cls=scope(all,'class',spec.className);if(cls[0].column!==0||cls[2]?.value!==':')throw Error('事件类结构不受支持');
 const constants=cls.filter((t,i)=>t.value==='const'&&cls[i+1]?.value==='PORTRAIT_SPEAKER');if(constants.length!==1)throw Error('说话人常量不唯一');
 const si=cls.indexOf(constants[0]),speaker=cls[si+4];if(cls[si+2]?.value!==':'||cls[si+3]?.value!=='='||speaker?.kind!=='string'||speaker.prefix)throw Error('说话人必须是直接字符串常量');
 const helper=scope(cls,'func','_line');
 if(!sameTokens(helper,'static func _line(text: String, mood: String = "normal") -> Dictionary:\n return {"speaker": PORTRAIT_SPEAKER, "text": text, "left": "", "right": PORTRAIT_SPEAKER, "mood": mood,}'))throw Error('_line 说话人/文字映射已变化');
 const fn=scope(cls,'func',spec.functionName);let pos=0;const lines=[];
 const take=value=>{if(fn[pos++]?.value!==value)throw Error('不支持的线性对白结构：预期 '+value);};
 const seq=values=>values.forEach(take);
 seq(['static','func',spec.functionName,'(',')','-','>','Array','[','Dictionary',']',':','var','out',':','Array','[','Dictionary',']','=', '[',']']);
 function call(){seq(['_line','(']);const text=fn[pos++];if(text?.kind!=='string'||text.prefix)throw Error('只允许 _line 第一个参数为普通字符串字面量');take(',');const mood=fn[pos++];if(mood?.kind!=='string'||mood.prefix)throw Error('表情必须为字面量');take(')');lines.push({text:text.value,speaker:speaker.value,token:text,line:text.line,mood:mood.value});}
 if(fn[pos]?.value==='var'){
  seq(['var','first',':','=']);call();
  if(fn[pos]?.value==='first'){seq(['first','[']);if(fn[pos++]?.value!=='bg')throw Error('不支持的首句属性');seq([']','=']);if(fn[pos++]?.kind!=='id')throw Error('背景必须是常量引用');}
  seq(['out','.','append','(','first',')']);
 }
 while(fn[pos]?.value==='out'){seq(['out','.','append','(']);call();take(')');}
 seq(['return','out']);if(pos!==fn.length||lines.length!==spec.expectedCount)throw Error('对白数量或执行顺序已变化，拒绝猜测');
 return {source,lines};
}
function plan({originalBytes,spec,changes}){
 const before=new Uint8Array(originalBytes),parsed=readLinear(before,spec);if(!Array.isArray(changes)||!changes.length)throw Error('没有对白修改');
 const seen=new Set(),edits=changes.map(c=>{
  if(!Number.isInteger(c.index)||seen.has(c.index)||!parsed.lines[c.index])throw Error('无效或重复对白索引');seen.add(c.index);const line=parsed.lines[c.index];
  if(c.before!==line.text||typeof c.after!=='string'||c.after===c.before)throw Error('原文不匹配或没有修改');
  const token=line.token,start=enc.encode(parsed.source.slice(0,token.start)).length,end=enc.encode(parsed.source.slice(0,token.end)).length;
  return {start,end,bytes:enc.encode(encode(c.after,token)),index:c.index,after:c.after};
 }).sort((a,b)=>a.start-b.start);
 let length=before.length;for(let i=0;i<edits.length;i++){if(i&&edits[i].start<edits[i-1].end)throw Error('补丁重叠');length+=edits[i].bytes.length-(edits[i].end-edits[i].start);}
 const output=new Uint8Array(length);let src=0,dest=0;for(const e of edits){output.set(before.subarray(src,e.start),dest);dest+=e.start-src;output.set(e.bytes,dest);dest+=e.bytes.length;src=e.end;}output.set(before.subarray(src),dest);
 const after=readLinear(output,spec);for(let i=0;i<parsed.lines.length;i++)if(after.lines[i].text!==(edits.find(e=>e.index===i)?.after??parsed.lines[i].text))throw Error('补丁解析回验失败');
 // Preserve every byte outside selected tokens, including BOM and line endings.
 src=0;dest=0;for(const e of edits){const size=e.start-src;if(!equal(before.subarray(src,e.start),output.subarray(dest,dest+size)))throw Error('补丁越界');src=e.end;dest+=size+e.bytes.length;}if(!equal(before.subarray(src),output.subarray(dest)))throw Error('补丁越界');
 return {bytes:output,edits};
}
const api={lex,scope,sameTokens,readLinear,plan,decode,equal};if(typeof module!=='undefined')module.exports=api;root.GCSGDScriptPatch=api;
})(typeof window!=='undefined'?window:globalThis);
