# Game Content Studio (GCS)

独立、跨引擎游戏内容编辑器的早期网页原型。

## 在线部署

本仓库使用 GitHub Actions 自动部署 GitHub Pages。首次发布需上传 `site.zip` 到仓库根目录，并在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

然后打开 **Actions → Deploy GCS website**，确认最近一次部署成功。网站地址预计为：

https://panghu233-bot.github.io/gcs/

后续更新网站：由 Codex 更新站点文件和 `site.zip` 并推送到 `main`，网站会自动部署；访问者刷新网页即可。

## 当前功能与安全边界

- NPC、剧情、卡牌演示内容的编辑与关联；演示内容 JSON 导入、导出。
- 本地选择《凝顾》卡牌 JSON 进行只读查看，不写回实际游戏。
- 浏览器内演示数据暂存于本机，**不会跨设备同步**；建议主动导出 JSON。
- 网站代码与演示数据是公开的；**不要提交《凝顾》真实游戏文件、未公开美术或隐私资料**。
- 本项目仍是原型，不具备正式的游戏引擎数据回写功能。
