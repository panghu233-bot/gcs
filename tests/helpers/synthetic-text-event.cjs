const {fixture,enc}=require('./synthetic-event.cjs'),patch=require('../../site/gdscript-string-patch.js'),catalog=require('../../site/event-catalog.js');
const source=catalog.sourcePaths[0],entry=catalog.entryPaths[0];
function textFixture(){const files=fixture();files[source]=enc(patch.decode(files[source])+`
class ComplexEvent:
 var title: String = ""
 var lines: Array[Dictionary] = []
 var reward: int = 0
 static func create_event(flag: bool) -> ComplexEvent:
  var unused := {"speaker":"旁人","text":"未使用字典"}
  var e := ComplexEvent.new()
  e.title = "合成复杂事件"
  e.reward = 17 # reward must survive byte-for-byte
  e.lines = [
   {"speaker":"甲","text":"相同文字","left":"甲","right":"乙","mood":"normal"},
   {"type":"choice","prompt":"选择提示","options":[
    {"text":"相同选项","next_label":"win","set_success":true},
    {"text":"相同选项","next_label":"lose","set_success":false},
    {"text":dynamic_label,"next_label":"win"},
    {"text":"未知去向", "next_label":dynamic_target}
   ]},
   {"anchor_label":"win","speaker":"甲","text":"相同文字","left":"甲","right":"乙","mood":"normal"},
   {"type":"combat_trigger","combat_id":"synthetic"},
   {"type":"branch_end"},
   {"anchor_label":"lose","speaker":"甲","text":"相同文字","left":"甲","right":"乙","mood":"normal"},
   {"speaker":"乙","text":"条件甲" if flag else "条件乙","left":"甲","right":"乙","mood":"normal"},
   {"type":"branch_end"}
  ]
  return e
 static func create_result(victory: bool) -> Array[Dictionary]:
  if victory:
   return [{"speaker":"甲","text":"重复结果","left":"甲","right":"乙","mood":"normal"}]
  return [{"speaker":"甲","text":"重复结果","left":"甲","right":"乙","mood":"normal"}]
`);files[entry]=enc(`func begin():
 var event = CultivationData.ComplexEvent.create_event(true)
 var result = CultivationData.ComplexEvent.create_result(false)
`);return files;}
const find=(files,name='create_event')=>catalog.discover(files).records.find(r=>r.manifest.className==='ComplexEvent'&&r.manifest.functionName===name);
module.exports={textFixture,find,source,entry};
