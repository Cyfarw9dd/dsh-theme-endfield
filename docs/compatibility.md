# 向后兼容与稳定性

> 回答「DSH 还在开发阶段，这个主题怎么做到长期稳定」。架构见 [architecture.md](architecture.md)，触发器细节见 [engineering-notes.md](engineering-notes.md)。

## 一、DSH 插件体系的实际结构

从运行时 289 个包的实测看，DSH 的插件体系是 Cordis（据点框架）的薄封装：

- **Host 半**（Node）：`index.js` 导出 `apply(ctx)` + 可选 `Config`（schemastery volatile schema）；通过 `ctx.get('...')` 消费命名服务
- **Client 半**（浏览器）：`exports["./client"] -> client.js`；通过 `ctx.get('...')` / `ctx.xxx`（注入属性）消费客户端服务
- **安装面**：`dsh plugin --profile <p> add <spec>` = pnpm 安装 + `cordis.patch.yml` 的 `dsh.bundle.patch` 声明追加到 profile 的 bundle 栈
- **兼容性门槛**：`evaluatePluginCompatibility()` 检查 `peerDependencies` 中所有 `@deepseek-ai/dsh*` 条目是否满足当前运行时版本（semver, 含 prerelease）；不满足时警告或需要 `allow-version` 豁免

## 二、本主题的六类上游依赖与风险等级

### 1. ctx.get() 命名服务（低风险，接口粒度）

| 服务 | 用途 | 稳定性策略 |
| --- | --- | --- |
| `theme` | overrideTokens（令牌覆盖） | Cordis 核心 API，跨版本稳定 |
| `slots` | 面板挂载（设置页） | 同上 |
| `settingsScope` | 0.1.5-rc.2 时代的设置 seam | **已降级为回退路径**，主路径走 `configForms` |
| `configForms` | 0.1.7-rc.1+ 的设置域 | 当前主路径；**若再改名**，回退链自动落到 settingsScope 或内存默认 |
| `sessions` | ConversationSnapshot.running（回合边缘） | 运行时核心；**防御式 try-catch + 重试预算**，缺服务 = 功能静默关闭 |

**策略**：每个 `ctx.get()` 都有 `try-catch` + `undefined` 回退 + 功能降级。没有 inject 声明（不依赖加载顺序），apply 时缺什么就跳过什么。

### 2. CSS Module 后缀匹配（中风险，选择器粒度）

这是**最大的脆弱面**。主题用 86 处语义后缀匹配（`[class$='_centerCol']` 等），而不是哈希类名。

**已做的防御**：
- 0.1.2-rc.1 全面 rehash 时，语义后缀全部存活（证明了这个策略的正确性）
- `test/selector-guard.test.js` 逐条断言每个选择器仍能匹配（不匹配 = 构建失败，而不是静默失效）
- 只有数据属性匹配用于**关键功能**（审批 `[data-approval-key]`、提问 `[data-question-key]`）——数据属性是 React props 的稳定投影，不受 CSS module hash 影响

**如果 upstream 改名后缀**：
- 非关键面（悬停色、选中行色）静默退化——功能还在，只是不上色
- 关键面（审批按钮、提问检测）会**被测试抓住**（selector-guard / attention-watch）

### 3. `--dsw-*` 设计令牌（中风险，令牌粒度）

主题**只消费**不重声明：`--dsw-alias-bg-base` 等做背景，`--dsw-alias-label-primary` 等做前景。如果 upstream 改令牌名或值：

- **令牌名改** → 变量解析为空 → 上游自带值兜底（`var(--edge-line, var(--dsw-alias-border-l1, #ccc))`）
- **令牌值改** → 主题自动跟随（这正是设计——颜色跟着上游走）
- 新令牌 → 主题不知道，不消费，零影响

### 4. ConversationSnapshot.running（低风险，数据粒度）

雷霆/通知的回合边缘依赖 `ConversationSnapshot.running` 布尔位。这是应用的**权威状态**——turn-status 标签和 stop 按钮都读同一个字段。只要 DSH 还有「回合」这个概念，这个字段就存在。

如果未来换成别的形式（比如流式状态枚举）：`thunderReadRunning()` 是唯一需要改的函数（一处），且没有降级会导致崩溃——只是不触发。

### 5. `window.__ModuleLoader__` 加载约定（低风险）

浏览器侧的插件发现机制。0.1.7-rc.2 仍然用 `load` + `factory` + `apply`。如果改成别的：整个插件生态都坏（不只本主题），DSH 团队必须提供迁移。

### 6. 皮肤/布局 DOM 结构（中高风险，结构粒度）

主题假设一定的 DOM 层级（frame > centerCol > root，composer 在 centerCol 内，sidebar 在 frame 内）。upstream 重构布局组件（比如把 sidebar 移出 frame）时：

- 水印的挂载点探测（`mountPointFor()`）已有三个回退（conversation root → app frame → body）
- 等高线已删除，不再有 DOM 依赖
- 通知栈挂在 `document.body`（最高层，不受布局变化影响）

## 三、版本兼容实践

### 当前状态

```json
"peerDependencies": {
  "@deepseek-ai/cordis": "^4.0.1"
}
```

**只有 Cordis 的 peer，没有 DSH 的**——意味着 DSH 任何版本都会装（没有版本门槛），但也没有版本保护。这是有意为之：主题的全部上游面都是防御式消费，不需要硬锁 DSH 版本。

### 建议（按优先级）

1. **给 package.json 加 `@deepseek-ai/dsh` 的宽松 peer**：
   ```json
   "peerDependencies": {
     "@deepseek-ai/cordis": "^4.0.1",
     "@deepseek-ai/dsh": ">=0.1.0"
   }
   ```
   这告诉 `evaluatePluginCompatibility()` 本主题的目标范围。`>=0.1.0` 很宽，不会挡任何版本，但在 DSH 做出破坏性改名（比如 0.3.0 重命名 `configForms`）时用户会看到警告而不是静默坏掉。

2. **在每个 upstream 依赖点写版本注释**：
   ```js
   // Upstream surface: configForms (0.1.7-rc.1+)
   // Fallback: settingsScope (≤0.1.5-rc.2), then in-memory defaults
   ```
   这让未来的维护者能快速定位哪些接口需要在新版本上验证。

3. **维持 selector-guard 测试**：每当 upstream 发布新版本，跑一遍 `npm test`——如果 CSS module 后缀改了，选择器守卫是第一个报警的。

4. **当 DSH 稳定到 1.0**：考虑给 peer 范围加上限（`>=0.1.0 <2.0.0`），并在破坏性变更时发布新版本。

## 四、已经踩过的坑（及解决方式）

| 坑 | DSH 版本 | 症状 | 解法 | 防复发 |
| --- | --- | --- | --- | --- |
| CSS module 全面 rehash | 0.1.2-rc.1 | 33 个哈希选择器全部失活 | 改用语义后缀匹配 | selector-guard |
| localStorage 跨 origin 失效 | Desktop | 设置在重启后丢失 | 迁移到 settingsScope → configForms | 双路径 + 回退链 |
| `:root` 变量解析为空 | — | `--edge-line` 计算 auto | 声明移到 `body`（上游令牌是 body 行内样式） | check.js 结构检查 |
| `--dsw-font-family` 是公共接口 | — | 第三方挂件字体被覆盖 | 停止重声明；用 `--edge-font` 仅上主题自己的元素 | check.js 禁令 |
| 模板字符串里的反引号 | — | 整个 client bundle 解析失败 | 逐字符检查 + check.js 反引号守卫 | check.js + selftest |
| 顶层裸 CSS 声明 | — | 解析器吞掉下一条选择器 | `--edge-emblem` 包在 `body {}` 内 | check.js 结构检查 |

## 五、长期维护清单

当 DSH 发布新版本时：

1. `dsh plugin --profile web update dsh-theme-endfield`（或直接 link 开发）
2. `CHROME_PATH=<chrome> npm test` —— 全套跑完看绿
3. 如果 selector-guard 失败 → upstream 改了 CSS module 后缀 → 对照新 bundle 更新后缀匹配
4. 如果 attention-watch 失败 → upstream 改了数据属性标记 → 更新 `ATTENTION_MARKERS`
5. 如果 palette-switch 失败 → 令牌名变了 → 检查 `overrideTokens` 的映射
6. 如果 font-scope 失败 → 字体令牌行为变了 → 检查 `--edge-font` 的声明位置

**核心信念**：上游的每个面都是防御式消费——缺什么就降级什么，永远不崩溃。主题的 635+ 测试不是为了证明功能正常，而是为了**在 upstream 改变时第一时间报警**。
