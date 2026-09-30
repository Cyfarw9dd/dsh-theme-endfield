# AGENTS — 本仓库协作契约

DSH Web 主题插件（《明日方舟：终末地》工业编辑风）。改任何东西前先过这一篇；细节按分层文档深入。

## 结构速览

- **双半架构**：`index.js`（Host/Node，启动加载）+ `client.js`（浏览器，按请求读盘、**刷新生效**）。安装用 link 方式：`dsh plugin --profile web add <本仓库>`
- 样式表是 client.js 里的**一个 JS 模板字符串**——反引号/`${`/注释配平都会「解析不报错但全坏」，`check.js` 守这些
- 生成物两件套（音效 `sounds/`、徽标掩码 EMBLEM_MASK 区）：**只改源与脚本，不手改产物**，`--check` 防漂移

## 硬规则

1. **素材来源**：只从官方渠道下载。第三方来源必须用户显式批准，并在 `scripts/build-*.js` 头注 + README「素材归属」双重登记（先例：矢量徽标来自 Yue-plus/endfield_icons）
2. **提交**：完整逻辑变更过验证后即可提交，不主动 push；Conventional Commits，作者用仓库本地 git config，信息经 `-F` 文件写入——细则见 [docs/git.md](docs/git.md)
3. **颜色是量出来的**：新色值必须对实际底面算对比度并写进 `test/palette-contrast.test.js`；选中/光标是**不随调色板的固定灰**（官网语法，依据见 docs/endfield-ui-research.md）
4. **测试从真实文件读值，不复述数值**；每条断言做过变异验证（selftest.js 方法论）
5. **`--edge-*` 变量声明在 `body`，绝不在 `:root`**（应用令牌是 body 行内样式，:root 解析为空）

## 验证门槛

```bash
node check.js        # 秒级，任何改动前先跑
CHROME_PATH=<chrome> npm test   # 样式/行为改动必须全绿（757+ 项）
```

## 文档

改动前读 [docs/AGENTS.md](docs/AGENTS.md)（分层规则）；入口索引在 README「文档」表。一句话判断：讲为什么 → docs 根级；讲怎么做 → docs/cookbook/；一次性记录 → docs/notes/。
