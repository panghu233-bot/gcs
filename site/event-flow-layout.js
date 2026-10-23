/* Playback layout starts at one proved entry. Source fragments are never extra starts. */
(function(root){
'use strict';
function layout(graph,{verified=true}={}){
 const all=new Map(graph.nodes.map(n=>[n.id,n])),edges=graph.edges.filter(e=>all.has(e.from)&&all.has(e.to)),positions=new Map();
 const result={main:[],detached:graph.nodes.map(n=>n.id),positions,edges:[],backEdges:[],width:530,height:0};
 if(!verified||!graph.entryConfirmed||!all.has(graph.entryId))return result;
 const outgoing=new Map(graph.nodes.map(n=>[n.id,[]]));for(const e of edges)outgoing.get(e.from).push(e);
 const order=new Map(),queue=[graph.entryId];while(queue.length){const id=queue.shift();if(order.has(id))continue;order.set(id,order.size);for(const e of outgoing.get(id))queue.push(e.to);}
 result.main=[...order.keys()];result.detached=graph.nodes.filter(n=>!order.has(n.id)).map(n=>n.id);result.edges=edges.filter(e=>order.has(e.from)&&order.has(e.to));
 // Condense cycles before ranking so a back edge cannot push the real opening to the bottom.
 const index=new Map(),low=new Map(),stack=[],active=new Set(),components=[],owner=new Map();let serial=0;
 function visit(id){index.set(id,serial);low.set(id,serial++);stack.push(id);active.add(id);for(const e of outgoing.get(id)){if(!index.has(e.to)){visit(e.to);low.set(id,Math.min(low.get(id),low.get(e.to)));}else if(active.has(e.to))low.set(id,Math.min(low.get(id),index.get(e.to)));}if(low.get(id)===index.get(id)){const members=[];let next;do{next=stack.pop();active.delete(next);owner.set(next,components.length);members.push(next);}while(next!==id);members.sort((a,b)=>order.get(a)-order.get(b));components.push(members);}}
 visit(graph.entryId);
 const incoming=components.map(()=>0),links=components.map(()=>new Set()),level=components.map(()=>0);
 for(const e of result.edges){const a=owner.get(e.from),b=owner.get(e.to);if(a!==b&&!links[a].has(b)){links[a].add(b);incoming[b]++;}}
 const ready=components.map((_,i)=>i).filter(i=>incoming[i]===0);while(ready.length){const a=ready.shift();for(const b of links[a]){level[b]=Math.max(level[b],level[a]+components[a].length);if(--incoming[b]===0)ready.push(b);}}
 const ranks=new Map();for(const id of result.main){const c=owner.get(id),rank=level[c]+components[c].indexOf(id);if(!ranks.has(rank))ranks.set(rank,[]);ranks.get(rank).push(id);}
 const lanes=Math.max(1,...[...ranks.values()].map(ids=>ids.length),...result.main.map(id=>all.get(id).options?.length||0));result.width=Math.max(530,lanes*254+40);result.height=(Math.max(...ranks.keys())+1)*166+40;
 for(const [rank,ids] of ranks)ids.forEach((id,i)=>positions.set(id,{x:(result.width-(ids.length*254-32))/2+i*254,y:20+rank*166,level:rank}));
 result.backEdges=result.edges.filter(e=>positions.get(e.to).level<=positions.get(e.from).level);
 return result;
}
const api={layout};if(typeof module!=='undefined')module.exports=api;root.GCSEventFlowLayout=api;
})(typeof window!=='undefined'?window:globalThis);
