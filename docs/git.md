# Git 提交策略

> 回答「什么时候提交、提交怎么写」。工作流上下文见 [development.md](development.md)，文档分层见 [AGENTS.md](AGENTS.md)。

## 提交节奏

- **完成一个完整的逻辑变更并通过验证后即可提交**，不必等用户明示
- **不主动 push**——推送必须用户明示
- 提交范围有歧义时（如混入无关文件）先问一句
- 提交前跑 `node check.js`（样式/行为改动加跑 `npm test`），红了先修再提交

## Conventional Commits

格式：

```
<type>(<scope>?): <subject>          ← 必填；subject ≤72 字符，祈使句，不加句号

<body>                               ← 可选；解释「为什么」，可带测量数据

<footer>                             ← 可选；破坏性变更、来源批准等
```

### 类型表（本仓库实际用到的优先）

| type | 用途 | 本仓库示例 |
| --- | --- | --- |
| `feat` | 新功能 | `feat: add Endfield gray palette as default and vector emblem watermark` |
| `fix` | 缺陷修复 | `fix(client): scope the composer add hook so the settings add button stays readable` |
| `docs` | 文档 | `docs: restructure into DSH-style layers` |
| `test` | 测试补强 | `test: extend palette-contrast coverage to the gray palette` |
| `chore` | 构建/杂务 | `chore: bump version to 1.2.0` |
| `refactor` / `style` / `perf` / `revert` | 备用 | —— |

scope 可省（本仓库体量小，仅在有明确半区时用：`client` / `host` / `docs`）。

### body 与 footer 约定

- body 写**动机与证据**，不复述 diff；有测量数据就放数据（对比度、字节数、像素数）
- 破坏性变更：footer 加 `BREAKING CHANGE: <说明>`
- 采用第三方来源素材：footer 注明批准事实，并与 `scripts/build-*.js` 头注、README 素材归属三处一致

## 操作细节

- **作者身份**用仓库本地 git config（`git config user.name/user.email`），不借用历史提交身份，不改全局配置
- **提交信息经文件写入**：`git commit -F <file>`，避免 shell 引号转义吞字符（本仓库踩过）
- **未推送**的提交可用 `--amend` 折叠后续修复（保持一个逻辑变更一个提交）；**已推送禁 amend**，需要改历史必须用户明示
- 提交后 `git status` 必须干净；不把临时探针、截图产物（`.kagent/` 已 ignore）带进提交
