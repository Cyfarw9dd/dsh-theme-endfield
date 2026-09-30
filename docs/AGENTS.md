# 文档治理（AGENTS）

> 参照 DeepSeek Harness 的文档分层，按小项目规模裁剪。改动文档前先读这一篇。

## 分层规则

| 层 | 位置 | 收什么 | 对应 DSH |
| --- | --- | --- | --- |
| **治理** | `AGENTS.md`（本篇） | 文档怎么组织、贡献怎么走 | `docs/AGENTS.md` |
| **主题文档** | `docs/*.md` 根级 | 一主题一文件，回答「是什么/为什么」：架构、术语、设计语言、调研依据、功能参考、测试参考、工程深水笔记 | `architecture.md` / `glossary.md` / `defensive-patterns.md` … |
| **操作手册** | `docs/cookbook/` | 回答「怎么做」：单一功能的配置与实现专题 | `cookbook/` |
| **一次性记录** | `docs/notes/` | 有存档价值但不维护的产物（如 PR 说明） | `postmortem/` |

**中英 i18n（DSH 的 `.zh.md` + `.i18n.yaml` 机制）本项目不采用**：受众以中文为主，保持单语。

## 准入判断

- 新文档先问层数：讲「为什么」→ 根级；讲「怎么配置/实现某个功能」→ `cookbook/`；写完就不再更新的记录 → `notes/`
- 超过一屏仍没有目录结构的根级文档，考虑拆分或下沉
- 每篇根级文档第一段必须写清「本文回答什么、不回答什么」（见 `engineering-notes.md` 的开头示范），并链接相邻层

## 链接与命名

- 文件名一律 kebab-case；标题用中文
- 站内链接用相对路径；移动文件时 `grep -r '<旧名>'` 清点全部引用再动手
- README 的文档表是唯一入口索引，新文档必须登记

## 贡献前置（对所有改动，不只文档）

1. `node check.js` 必须绿；样式/行为改动加跑 `CHROME_PATH=<chrome> npm test`
2. 生成物（音效、徽标掩码）只改源与脚本，`--check` 防漂移
3. 素材来源政策：只从官方渠道下载；第三方来源需显式批准并在
   `scripts/build-*.js` 头注与 README「素材归属」双重登记
4. 完整逻辑变更过验证后即可提交（**不主动 push**）；提交遵循 Conventional Commits，
   细则见 [git.md](git.md)；作者身份用仓库本地 git config
