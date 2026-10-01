# dsh-theme-endfield

参考《明日方舟：终末地》官网风格的 DSH Web 主题插件。

奶油纸底、墨黑文字、终末地灰（默认）/谷地黄/武陵青三套强调色、全直角工业编辑风。Client 侧（`client.js`）通过主题令牌和样式覆盖界面；Host 侧（`index.js`）负责设置持久化与可选的音频通知（派生系统播放器子进程），均不修改应用代码。

## 安装

```bash
dsh plugin --profile web add github:ymh0000123/dsh-theme-endfield
```

重启或重新加载 `web` profile 后生效。**更新插件文件时注意**：Client 半（`client.js`）由 Host 按请求从磁盘读取，浏览器刷新即可生效；Host 半（`index.js`）只在 profile 启动时 import 一次，**必须整进程重启 DSH** 才会重新加载（`dsh-hmr` 的 watch 默认忽略 `**/node_modules`，软链安装的仓库文件不在其观察范围内）。只刷新页面时，运行的仍是启动时那份 Host 代码。卸载：

```bash
dsh plugin --profile web rm dsh-theme-endfield
```

## 功能

在 **设置 › 终末地主题设置** 中调整：

- 主题总开关、终末地灰/谷地黄/武陵青三态配色（默认终末地灰：官网灰阶交互语法）、直角/圆角模式；
- 背景水印（官方高清工业徽标：阈值重建的清晰倒三角标）及持续显示；
- 新建会话页品牌标识（联名「终末地标识 3」贴在标题「探索未至之境」正上方，明暗两套均沿用素材原色）；
- 启动加载动画；
- 雷霆大字及入场动画；
- 工业风通知：任务完成回执（6 秒自动消失）、提问/索权常驻卡片（处理完自动消失），音效跟随音频通知开关；
- 可选音频通知：启动音、任务开始/结束音、需要回应时提示，音量与自定义音效目录可调（默认关闭，详见 [docs/cookbook/audio-notifications.md](docs/cookbook/audio-notifications.md)）。

所有设置由 DSH 自己的设置服务持久化，与页面 origin/端口无关：在 **DSH 0.1.7-rc.1** 上，Host `index.js` 导出一份字段全部 `.volatile()` 的 schemastery `Config`（命名空间 = 本插件 profile entry id `theme-endfield`），浏览器 `client.js` 通过 `ctx.configForms` 读写并订阅，值随 `<profile>/cordis.patch.yml` 落盘；在**旧版 DSH** 上则回落到 `ctx.settings.register('dsh-theme-endfield', schema)` + `ctx.settingsScope`（`<dshHome>/settings.yaml`）。两代都与页面 origin 无关，因此 DSH web 与 DSH Desktop 都能正确保存并在重启/换端口后恢复，不再使用会被 Desktop 随机端口清空的 `localStorage`。详见 [docs/features.md](docs/features.md) 与 [docs/engineering-notes.md](docs/engineering-notes.md)；0.1.7 升级后旧设置需要在设置页重设一次（`settings.yaml` 已被 DSH 废弃，见 [engineering-notes.md § DSH 0.1.7-rc.1 换掉了整套 settings API](docs/engineering-notes.md#dsh-017-rc1-换掉了整套-settings-api-v110-已跟进)）。设置文案支持中英文；大字入场动画尊重系统「减少动态效果」。

**如果开关总是「刷新后复位」**：先看 Host 侧有没有这份 `Config`（`Config.listConfigs` 对该 entry 报 `absent` 就是没有）。没有 Config 时 DSH 不投影任何表单，Host `apply()` 会打一行 warn 并在 profile 目录留下报告文件 `theme-endfield-diagnostic.json`（`Config` 构建成功时会自动删除它；报告里的 `schemaMode` / `loaded` / `loadError` 会写明走了哪条解析路径、以及某个副本是否「解析得到却加载失败」）——排查与判据见 [docs/testing.md](docs/testing.md#设置页)。另外注意：**改 Host 半（`index.js`）必须整进程重启 DSH**，刷新页面只重载 `client.js`。

## 文档

| 文档 | 层 | 内容 |
| --- | --- | --- |
| [docs/AGENTS.md](docs/AGENTS.md) | 治理 | 文档分层规则与贡献流程 |
| [docs/design-principles.md](docs/design-principles.md) | 治理 | 设计原则：装饰只做必要的一处、不进入核心工作区、动效必须付得起 |
| [docs/architecture.md](docs/architecture.md) | 主题 | 双半结构、样式表组织、验证链 |
| [docs/compatibility.md](docs/compatibility.md) | 主题 | 向后兼容与稳定性：上游依赖风险分级、版本适配清单 |
| [docs/glossary.md](docs/glossary.md) | 主题 | 术语与令牌速查 |
| [docs/design-language.md](docs/design-language.md) | 主题 | 色板、令牌映射与对比度规则 |
| [docs/endfield-ui-research.md](docs/endfield-ui-research.md) | 主题 | 官网 UI 设计语言调研：色彩频次、交互语法证据、徽标素材盘点 |
| [docs/features.md](docs/features.md) | 主题 | 功能行为、默认值、存储键与边界情况 |
| [docs/testing.md](docs/testing.md) | 主题 | 校验脚本与测试套件说明 |
| [docs/engineering-notes.md](docs/engineering-notes.md) | 主题 | 工程深水笔记：实现决策与实测数据 |
| [docs/development.md](docs/development.md) | 主题 | 开发与发布工作流 |
| [docs/git.md](docs/git.md) | 主题 | Git 提交策略与 Conventional Commits 规范 |
| [docs/cookbook/](docs/cookbook/) | 手册 | 功能专题：[音频通知](docs/cookbook/audio-notifications.md) · [磨砂玻璃](docs/cookbook/glass.md) |
| [docs/notes/](docs/notes/) | 记录 | 一次性存档（[PR 说明](docs/notes/PR-description.md)、[官网动效调研](docs/notes/endfield-motion-research.md)） |

## 开发与验证

```bash
node check.js
node selftest.js
npm test
```

`npm test` 覆盖样式不变量、配色、设置页、真实浏览器渲染、动画可访问性与性能预算。部分浏览器测试需要本机安装 Chrome 或 Edge。跑测试请用 Node 22+（浏览器 fixture 依赖全局 `WebSocket`/`fetch`，版本不足会在测试处明确报错；插件本身的运行没有这个要求）。

## 项目结构

```text
client.js          Client 侧主题实现
index.js           Host 侧：导出 volatile Config，声明设置命名空间
lib/               音频通知：槽位定义、WAV 合成与播放运行时
sounds/            生成的通知音（npm run sound:build 重新生成）
assets/            素材源：水印徽标矢量源（endfield-industries.svg）、新建会话页标识（hero-logo-3-summer.png 官方原图 + 两个 alpha 掩码 SVG）
scripts/           构建脚本：音效合成、徽标矢量嵌入、新建会话页标识掩码嵌入
cordis.patch.yml   Bundle 注入配置
check.js           样式表静态校验
selftest.js        校验器自检
test/              渲染、设置、配色与性能测试
docs/              设计、功能、工程与测试文档
```

## 素材归属

本插件是**非官方同人作品**，与鹰角网络（Hypergryph）不存在任何隶属、赞助或背书关系。

- 《明日方舟：终末地》（Arknights: Endfield）的游戏名称、标识、商标、官网视觉与设计语言及相关美术素材，版权归**鹰角网络（上海鹰角网络科技有限公司，Hypergryph Network Technology）**所有。
- 背景纹理直接沿用官方站点自身的发布产物：`endfield-block-bg.svg`（工程网格）、`endfield-wave-bg.png`（右上波纹）、`endfield-tape-wave-bg.png`（中央波纹带），三者取自官方 CDN `web.hycdn.cn/endfield/official-v4/_next/static/media/` 的 `/operator` 路由发布文件，**以原始字节内嵌**（不做再压缩）。来源 URL、sha256 与构建方式见 [scripts/build-texture.js](scripts/build-texture.js) 头注；采用已获本仓库所有者明确指示（「沿用官方」）。
- 新建会话页的品牌标识（`assets/hero-logo-body.svg` / `assets/hero-logo-ink.svg`）取自《明日方舟：终末地》× 优衣库 UTme! 联名活动页的「终末地标识 3」（定格今夏系列）贴图，**来源为活动页自身的官方承载域名** `www.bilibiliytoy.com`（页面 https://www.bilibili.com/toy/skland-uniqlo-2026/index.html 内嵌的 `assets/stickers/summer/logo-03.png`）；原始 1024×458 PNG 以原始字节保留在 `assets/hero-logo-3-summer.png`（sha256 `ee4fcfbd547e50202550d12bdd27934c608f3c8455d1242020b3e431c70dc966`），两个 SVG 是**在本地由该 PNG 分层描摹得到的形状掩码**（颜色由主题给出）。采用已获本仓库所有者明确指示（「把这个放到新会话的主界面」）；来源 URL、描摹步骤与斜纹几何测量见 [scripts/build-logo.js](scripts/build-logo.js) 头注。
- 本仓库中的**部分素材**（如 `assets/` 下的界面截图，水印徽标矢量源 [endfield-industries.svg](assets/endfield-industries.svg)（[Yue-plus/endfield_icons](https://github.com/Yue-plus/endfield_icons) 对官方标识的矢量重制，采用已经本仓库所有者批准），以及主题中还原的 `ENDFIELD` 字标、信号黄配色与工业编辑风版式）源自或参考上述作品及其官网，仅用于**学习、展示与非商业用途**；其权利仍归鹰角网络所有，**不在本项目的 MIT 许可证覆盖范围内**。
- 本项目的原创代码（`client.js`、`index.js`、`scripts/`、`test/` 等）以 MIT 许可证发布。
- 若权利方认为本仓库中的任何素材使用不当，请通过 Issue 联系，我们会立即删除或替换相关内容。

## 许可证

MIT，仅覆盖本项目的原创代码；第三方素材的归属见[素材归属](#素材归属)。

## Star History

<a href="https://www.star-history.com/?repos=ymh0000123%2Fdsh-theme-endfield&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=ymh0000123/dsh-theme-endfield&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=ymh0000123/dsh-theme-endfield&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=ymh0000123/dsh-theme-endfield&type=date&legend=top-left" />
 </picture>
</a>
