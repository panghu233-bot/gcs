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
const fields=['speaker','text','left','right','mood'];
const sameLine=(a,b)=>fields.every(key=>a[key]===b[key]);
function readLinear(bytes,spec){
 const source=decode(bytes);if(!equal(enc.encode(source),bytes))throw Error('UTF-8 无法无损往返');
 const all=lex(source),cls=scope(all,'class',spec.className);if(cls[0].column!==0||cls[2]?.value!==':')throw Error('事件类结构不受支持');
 const constants=cls.filter((t,i)=>t.value==='const'&&cls[i+1]?.value==='PORTRAIT_SPEAKER');if(constants.length!==1)throw Error('说话人常量不唯一');
 const si=cls.indexOf(constants[0]),speaker=cls[si+4];if(cls[si+2]?.value!==':'||cls[si+3]?.value!=='='||speaker?.kind!=='string'||speaker.prefix||cls[si+5]?.line===speaker.line)throw Error('说话人必须是独立的直接字符串常量');
 const helper=scope(cls,'func','_line');
 if(!sameTokens(helper,'static func _line(text: String, mood: String = "normal") -> Dictionary:\n return {"speaker": PORTRAIT_SPEAKER, "text": text, "left": "", "right": PORTRAIT_SPEAKER, "mood": mood,}'))throw Error('_line 说话人/文字映射已变化');
 const fn=scope(cls,'func',spec.functionName);let pos=0,openingBg=null,indent=null;const lines=[];
 const take=value=>{if(fn[pos++]?.value!==value)throw Error('不支持的线性对白结构：预期 '+value);};
 const seq=values=>values.forEach(take);
 const string=()=>{const t=fn[pos++];if(t?.kind!=='string'||t.prefix)throw Error('对白字段必须是普通字符串字面量');return t;};
 seq(['static','func',spec.functionName,'(',')','-','>','Array','[','Dictionary',']',':']);const colon=fn[pos-1];
 const lineStart=i=>source.lastIndexOf('\n',i-1)+1;
 const statement=read=>{
  const first=fn[pos];if(!first?.head||first.column<=fn[0].column)throw Error('对白语句必须独立且缩进明确');
  const prefix=source.slice(lineStart(first.start),first.start);if(!/^[\t ]+$/.test(prefix)||indent!==null&&prefix!==indent)throw Error('对白语句缩进不一致');indent=prefix;
  read();if(fn[pos]&&fn[pos].line<=fn[pos-1].line)throw Error('不支持同一行上的多条语句');
 };
 function expression(){
  let row,token,form;
  if(fn[pos]?.value==='_line'){
   seq(['_line','(']);token=string();let mood='normal';if(fn[pos]?.value===','){take(',');mood=string().value;}take(')');
   row={speaker:speaker.value,text:token.value,left:'',right:speaker.value,mood};form='helper';
  }else if(fn[pos]?.value==='{'){
   take('{');row=Object.create(null);const seen=new Set();
   while(fn[pos]?.value!=='}'){
    const key=string().value;if(!fields.includes(key)||seen.has(key))throw Error('未知或重复的对白字典字段');seen.add(key);take(':');const value=string();row[key]=value.value;if(key==='text')token=value;
    if(fn[pos]?.value===',')take(',');else if(fn[pos]?.value!=='}')throw Error('不支持字典中的表达式');
   }
   take('}');if(seen.size!==fields.length)throw Error('显式对白字典必须完整提供五个字段');form='dictionary';
  }else throw Error('仅支持 _line() 或完整显式对白字典');
  lines.push({...row,token,line:token.line,form});
 }
 statement(()=>seq(['var','out',':','Array','[','Dictionary',']','=', '[',']']));
 if(fn[pos]?.value==='var'){
  statement(()=>{seq(['var','first',':','=']);expression();});
  if(fn[pos]?.value==='first')statement(()=>{
   seq(['first','[']);if(string().value!=='bg')throw Error('不支持的首句属性');seq([']','=']);const bg=fn[pos++];if(bg?.kind!=='id')throw Error('背景必须是常量引用');openingBg=bg.value;
  });
  statement(()=>seq(['out','.','append','(','first',')']));
 }
 while(fn[pos]?.value==='out')statement(()=>{seq(['out','.','append','(']);expression();take(')');});
 statement(()=>seq(['return','out']));if(pos!==fn.length||!lines.length)throw Error('未知对白语句或空对白事件');
 const bodyStart=source.indexOf('\n',colon.end)+1;if(!bodyStart||fn.find(t=>t.value==='var').line<=colon.line)throw Error('函数体必须独立换行');
 const last=fn.at(-1),newline=source.indexOf('\n',last.end),bodyEnd=newline<0?source.length:(source[newline-1]==='\r'?newline-1:newline);
 let cursor=bodyStart,hasComments=false;
 for(const t of fn.filter(t=>t.start>=bodyStart)){if(source.slice(cursor,t.start).includes('#'))hasComments=true;cursor=t.end;}
 if(source.slice(cursor,bodyEnd).includes('#'))hasComments=true;
 const next=all.find(t=>t.start>last.end);if(/(?:^|\n)[\t ]+#/.test(source.slice(bodyEnd,next?.start??source.length)))hasComments=true;
 return {source,lines,openingBg,defaultSpeaker:speaker.value,body:{start:bodyStart,end:bodyEnd,indent,hasComments},legacyCompatible:lines.length===spec.expectedCount&&lines.every(l=>l.form==='helper')};
}
function plan({originalBytes,spec,changes}){
 const before=new Uint8Array(originalBytes),parsed=readLinear(before,spec);if(!Array.isArray(changes)||!changes.length)throw Error('没有对白修改');
 const seen=new Set(),edits=changes.map(c=>{
  if(Object.keys(c).some(k=>!['index','before','after'].includes(k))||!Number.isInteger(c.index)||seen.has(c.index)||!parsed.lines[c.index])throw Error('无效或重复对白索引');seen.add(c.index);const line=parsed.lines[c.index];
  if(c.before!==line.text||typeof c.after!=='string'||c.after===c.before)throw Error('原文不匹配或没有修改');
  const token=line.token,start=enc.encode(parsed.source.slice(0,token.start)).length,end=enc.encode(parsed.source.slice(0,token.end)).length;
  return {start,end,bytes:enc.encode(encode(c.after,token)),index:c.index,after:c.after};
 }).sort((a,b)=>a.start-b.start);
 let length=before.length;for(let i=0;i<edits.length;i++){if(i&&edits[i].start<edits[i-1].end)throw Error('补丁重叠');length+=edits[i].bytes.length-(edits[i].end-edits[i].start);}
 const output=new Uint8Array(length);let src=0,dest=0;for(const e of edits){output.set(before.subarray(src,e.start),dest);dest+=e.start-src;output.set(e.bytes,dest);dest+=e.bytes.length;src=e.end;}output.set(before.subarray(src),dest);
 const after=readLinear(output,spec);for(let i=0;i<parsed.lines.length;i++)if(!sameLine(after.lines[i],{...parsed.lines[i],text:edits.find(e=>e.index===i)?.after??parsed.lines[i].text}))throw Error('补丁完整字段回验失败');
 // Preserve every byte outside selected tokens, including BOM and line endings.
 src=0;dest=0;for(const e of edits){const size=e.start-src;if(!equal(before.subarray(src,e.start),output.subarray(dest,dest+size)))throw Error('补丁越界');src=e.end;dest+=size+e.bytes.length;}if(!equal(before.subarray(src),output.subarray(dest)))throw Error('补丁越界');
 return {bytes:output,edits};
}

// Bounded planner: no filesystem operations.
function planLines({originalBytes,spec,lines,structureChanged=false}){
 if(spec.className!=='Day12CountdownEvent'||spec.functionName!=='create_lines')throw Error('仅支持《指日可待》的目标函数');
 const before=new Uint8Array(originalBytes),parsed=readLinear(before,spec);
 if(!Array.isArray(lines)||!lines.length)throw Error('至少保留一句对白');
 const target=lines.map(line=>{if(!line||Object.keys(line).some(key=>![...fields,'id','line','form','token'].includes(key)))throw Error('草稿含未知字段，不能静默丢弃');const row={};for(const key of fields){const value=line?.[key];if(typeof value!=='string'||value.length>(key==='text'?20000:200))throw Error('无效的完整对白字段：'+key);unicode(value);row[key]=value;}if(!row.mood)throw Error('表情不得为空');return row;});
 if(target.length===parsed.lines.length&&target.every((row,i)=>sameLine(row,parsed.lines[i])))return {kind:'unchanged',bytes:before,edits:[]};
 for(const row of target){
  if(!row.speaker&&!row.left&&!row.right)throw Error('旁白且双侧无人时，当前播放器无法可靠清空立绘，禁止生成补丁');
  if([row.left,row.right,row.mood].includes('<inherit>'))throw Error('仅支持完整显式演出状态，不生成运行时继承');
 }
 if(!structureChanged&&target.length===parsed.lines.length&&target.every((row,i)=>fields.filter(k=>k!=='text').every(k=>row[k]===parsed.lines[i][k]))){
  const changes=target.flatMap((row,index)=>row.text===parsed.lines[index].text?[]:[{index,before:parsed.lines[index].text,after:row.text}]);
  return {...plan({originalBytes:before,spec,changes}),kind:'text'};
 }
 if(parsed.body.hasComments)throw Error('目标函数含注释，无法证明其对白归属，停止结构或演出补丁生成');
 if(!parsed.openingBg)throw Error('缺少已确认的开场背景，不能猜测结构补丁');
 const oldBody=parsed.source.slice(parsed.body.start,parsed.body.end),breaks=oldBody.match(/\r?\n/g)||[],eol=breaks[0]||(parsed.source.includes('\r\n')?'\r\n':'\n');
 if(breaks.some(b=>b!==eol))throw Error('目标函数换行混用，停止结构补丁生成');
 const quote={prefix:'',quote:'"'},literal=value=>encode(value,quote);
 const expression=row=>row.speaker===parsed.defaultSpeaker&&row.left===''&&row.right===parsed.defaultSpeaker?'_line('+literal(row.text)+', '+literal(row.mood)+')':'{'+fields.map(key=>literal(key)+': '+literal(row[key])).join(', ')+'}';
 const statements=['var out: Array[Dictionary] = []','var first := '+expression(target[0]),'first["bg"] = '+parsed.openingBg,'out.append(first)',...target.slice(1).map(row=>'out.append('+expression(row)+')'),'return out'];
 const body=statements.map(line=>parsed.body.indent+line).join(eol),start=enc.encode(parsed.source.slice(0,parsed.body.start)).length,end=enc.encode(parsed.source.slice(0,parsed.body.end)).length,replacement=enc.encode(body);
 const output=new Uint8Array(before.length-(end-start)+replacement.length);output.set(before.subarray(0,start));output.set(replacement,start);output.set(before.subarray(end),start+replacement.length);
 if(!equal(before.subarray(0,start),output.subarray(0,start))||!equal(before.subarray(end),output.subarray(start+replacement.length)))throw Error('目标函数体外字节变化，补丁被拒绝');
 const after=readLinear(output,spec);if(after.openingBg!==parsed.openingBg||after.lines.length!==target.length||!target.every((row,i)=>sameLine(row,after.lines[i])))throw Error('结构补丁完整字段或开场背景回验失败');
 return {kind:'function-body',bytes:output,edits:[{start,end,bytes:replacement}]};
}
function planRestore({originalBytes,backupBytes,spec}){
 const current=readLinear(originalBytes,spec),backup=readLinear(backupBytes,spec);
 const protectedClass=p=>{const c=scope(lex(p.source),'class',spec.className);return p.source.slice(c[0].start,p.body.start)+'<BODY>'+p.source.slice(p.body.end,c.at(-1).end);};
 if(current.defaultSpeaker!==backup.defaultSpeaker||current.openingBg!==backup.openingBg||protectedClass(current)!==protectedClass(backup))throw Error('事件辅助函数、背景或受保护的类配置已变化，不能自动恢复');
 // Validate that the snapshot remains expressible by the unchanged player.
 for(const row of backup.lines){
  if(!row.speaker&&!row.left&&!row.right)throw Error('备份含播放器无法可靠清空立绘的旁白，停止恢复');
  if(!row.mood||[row.left,row.right,row.mood].includes('<inherit>'))throw Error('备份含未支持的演出继承或空表情，停止恢复');
 }
 if(current.lines.length===backup.lines.length&&current.lines.every((r,i)=>fields.filter(k=>k!=='text').every(k=>r[k]===backup.lines[i][k]))){
  const changes=current.lines.flatMap((r,index)=>r.text===backup.lines[index].text?[]:[{index,before:r.text,after:backup.lines[index].text}]);
  if(!changes.length)throw Error('当前事件与备份一致，无需恢复');
  return {...plan({originalBytes,spec,changes}),kind:'text'};
 }
 if(!current.openingBg||!backup.openingBg)throw Error('无法确认开场背景，停止结构恢复');
 if(current.body.hasComments||backup.body.hasComments)throw Error('目标函数含注释，无法确认归属，不能恢复结构');
 const start=enc.encode(current.source.slice(0,current.body.start)).length,end=enc.encode(current.source.slice(0,current.body.end)).length,replacement=enc.encode(backup.source.slice(backup.body.start,backup.body.end));
 const bytes=new Uint8Array(originalBytes.length-end+start+replacement.length);bytes.set(originalBytes.subarray(0,start));bytes.set(replacement,start);bytes.set(originalBytes.subarray(end),start+replacement.length);
 const parsed=readLinear(bytes,spec);if(parsed.openingBg!==current.openingBg||parsed.lines.length!==backup.lines.length||!parsed.lines.every((r,i)=>sameLine(r,backup.lines[i]))||!equal(bytes.subarray(0,start),originalBytes.subarray(0,start))||!equal(bytes.subarray(start+replacement.length),originalBytes.subarray(end)))throw Error('恢复范围或完整字段验证失败');
 return {kind:'function-body',bytes,edits:[{start,end,bytes:replacement}]};
}
const api={lex,scope,sameTokens,readLinear,plan,planLines,planRestore,decode,equal};if(typeof module!=='undefined')module.exports=api;root.GCSGDScriptPatch=api;
})(typeof window!=='undefined'?window:globalThis);
