# Game Content Studio (GCS) 0.3

独立的静态游戏内容工作台，保留 NPC、剧情、演示卡牌编辑、关联、试读、JSON 导入导出和浏览器暂存。

网站：https://panghu233-bot.github.io/gcs/

## 本地真实卡牌浏览

点击「查看游戏卡牌（只读）」，分别选择本机 `basic_cards.json` 和 `special_upgrade_branches.json`。支持按名称、ID、类型、标签搜索，以及基础 / 分支 / 普通升级 +1 的属性对比。

基础值、数值增量、布尔替换和升级后属性分别展示。有特殊分支时各分支独立从基础计算。战斗状态相关的伤害不作为固定最终伤害推算；未解释字段、原始升级配置及完整 JSON 始终可查。

真实数据只在本页内存读取：不上传、不存入演示项目或 localStorage、不写回游戏。刷新或清除即释放；再次使用需重新选择文件。图片路径只显示为文本。

## 源码与发布

- `site/`：可审查的网站源码和原有公开演示资源。
- `site/ninggu-adapter.js`：独立的只读结构适配器，不依赖演示数据模型或游戏引擎源码。
- `site/native-cards.js`：本地文件选择与浏览界面。
- `tests/adapter.test.cjs`：不含真实项目数据的适配器测试，`node --test tests/adapter.test.cjs`。
- `site.zip`：与 `site/` 一致的发布包，推送 main 后沿用现有 Pages 工作流部署。

真实文件回归测试由本地另行提供文件路径，游戏数据、测试截图、私人路径及本地测试脚本不提交。本仓库不含游戏真实卡牌、源码或美术。
