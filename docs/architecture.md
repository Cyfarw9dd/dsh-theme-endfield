# 架构

> 回答「这个主题由哪几块组成、它们怎么接起来」。取值依据见
> [design-language.md](design-language.md)，实现细节见 [engineering-notes.md](engineering-notes.md)。

## 双半结构

```
┌─ Host 半（Node）──────────────┐   ┌─ Client 半（浏览器）────────────┐
│ index.js                      │   │ client.js（单文件 IIFE 模块）     │
│  · volatile Config（设置 schema）│ → │  · 样式表：一个 JS 模板字符串      │
│  · lib/audio.js 播放运行时     │   │  · 令牌覆盖（theme.overrideTokens）│
│  · lib/slots.js、lib/tone.js   │   │  · 功能面：水印/等高线/加载屏/大字  │
└──────────────┬───────────────┘   │  · React 迷你实现（设置面板）       │
               │                   └───────────────┬─────────────────┘
   cordis.patch.yml（bundle 注入声明）                │ settingsScope/configForms
   「./client」导出 → Host 按请求读盘 ← 浏览器刷新即生效 │
```

- **Host 半**只在 profile 启动时加载一次；**Client 半**按请求从磁盘读取，刷新生效
- 两半通过 DSH 设置命名空间（`theme-endfield`）同步偏好；浏览器 localStorage 已弃用（见工程笔记）

## 样式表组织

- 全部 CSS 在 client.js 的**一个模板字符串**里，由 `insertCss()` 注入——
  因此 `check.js` 守护反引号/插值/括号配平这类「解析不报错但全坏」的改动
- 强调色按**调色板 class**（`theme-endfield-gray` / `-wuling`）切换：一个 class
  翻转全量重绘，无 JS 重绘；例外是等高线画布（MutationObserver 触发重画）
- 选中/光标是**不随调色板**的固定交互灰（官网语法，见调研文档）
- 生成物（徽标矢量掩码）嵌在标记区 `EMBLEM_MASK_BEGIN/END` 内，
  由 `scripts/build-emblem.js` 生成，`--check` 防漂移

## 验证链

```
node check.js → 静态不变量（样式表结构、调色板块、掩码包装）
node selftest.js → 变异验证：把每个真实 bug 注入副本，证明 check 真能抓住
npm test → 上述 + 配色对比度 / 设置页 / 真实浏览器渲染 / 性能预算
```

详见 [testing.md](testing.md)；开发工作流见 [development.md](development.md)。
