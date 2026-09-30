# 开发指南

> 回答「怎么在这个仓库上开发与发布」。架构见 [architecture.md](architecture.md)，各测试守什么见 [testing.md](testing.md)。

## 环境

- Node 22+；浏览器测试需要本机 Chrome/Chromium（`CHROME_PATH` 指定路径）
- 安装到 profile 用 link 方式（改仓库文件即生效）：
  `dsh plugin --profile web add <本仓库路径>`

## 验证三层

```bash
node check.js                          # 秒级：样式表静态不变量
node selftest.js                       # 变异验证 check 真能抓 bug
CHROME_PATH=/usr/bin/chromium-browser npm test   # 全量（含真实渲染）
``npm run shots && node test/verify-shots.js` 生成并校验调色板截图（人工复核用）。

## 生成物契约

| 脚本 | 源 | 产物 | 防漂移 |
| --- | --- | --- | --- |
| `scripts/build-sounds.js` | `lib/slots.js` + `lib/tone.js` | `sounds/*.wav` | `--check`（在 npm test 链内） |
| `scripts/build-contour-worker.js` | `src/contour-worker.js` | worker 内嵌源 | `--check`（在 npm test 链内） |
| `scripts/build-emblem.js` | `assets/endfield-industries.svg` | client.js 内 EMBLEM_MASK 区 | `--check`（在 npm test 链内） |

规则：**永远改源与脚本，不手改产物**；提交前跑对应 `--check`。

## 常见任务

**加一档调色板**：
1. `client.js` 调色板区加 class 块（含暗色翻转与 `--edge-accent-ink`）
2. `PALETTE_CLASSES` / `readPalette` / 设置面板三态循环与中英文案
3. `contourStroke()` 加描边档并调 α 至合成对比度对齐（脚本见 testing.md）
4. `palette-contrast.test.js` 加断言列；`shoot.js`/`verify-shots.js` 扩矩阵

**加功能开关**：Host `FIELD_DEFAULTS`（index.js + client.js 各一份）→ 设置面板行 → 文档登记 features.md。

## 提交与发布

- 完整逻辑变更过验证即可提交；Conventional Commits 规范与操作细则见 [git.md](git.md)
- 版本号在 package.json；语义：特性 +0.1.0，修复 +0.0.1
- 未推送的提交可用 `--amend` 折叠后续修复；已推送禁用
