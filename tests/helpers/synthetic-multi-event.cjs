const {fixture,enc}=require('./synthetic-event.cjs'),patch=require('../../site/gdscript-string-patch.js'),catalog=require('../../site/event-catalog.js');
const source=catalog.sourcePaths[0],story=catalog.sourcePaths[1],entry=catalog.entryPaths[0];
function multi(){const f=fixture();f[source]=enc(patch.decode(f[source])+`
class SharedEvent:
 const PORTRAIT := "顾清寒"
 static func _duo(speaker: String, text: String, mood: String = "normal") -> Dictionary:
  return {"speaker": speaker, "text": text, "left": "顾飞雪", "right": PORTRAIT, "mood": mood}
 static func create_day_lines() -> Array[Dictionary]:
  var out: Array[Dictionary] = []
  out.append(_duo("顾清寒", "合成白天", "shy"))
  (
   out
   . append(_duo("顾飞雪", "合成第二句",))
  )
  return out
 static func create_night_lines() -> Array[Dictionary]:
  return [{"speaker":"顾清寒","text":"合成夜晚","left":"顾清寒","right":"","mood":"normal"}]
 static func create_branch_lines() -> Array[Dictionary]:
  return [{"type":"choice","prompt":"合成选择","options":[{"text":"A","next":1}]}]
`);f[story]=enc(`class_name CultivationStoryEvents
extends RefCounted
static func get_result_lines() -> Array[Dictionary]:
 return [{"speaker":"顾飞雪","text":"合成结果","left":"顾飞雪","right":"顾清寒","mood":"normal"}]
`);f[entry]=enc(`func start():
 var a = CultivationData.SharedEvent.create_day_lines()
 var b = CultivationData.SharedEvent.create_night_lines()
 var c = CultivationData.SharedEvent.create_branch_lines()
 var d = CultivationStoryEvents.get_result_lines()
`);return f;}
const find=(files,name)=>catalog.discover(files).records.find(r=>r.manifest.functionName===name);
module.exports={multi,find,source,story,entry};
