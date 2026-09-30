# 术语表

> 速查本仓库的高频术语与令牌。首次出现的文档负责定义，这里只做索引。

## 调色板

| 术语 | 含义 |
| --- | --- |
| **终末地灰**（gray） | 默认调色板：官网灰阶交互语法（亮 `#d9d9d9` / 暗 `#6a6a6a` 填充） |
| **谷地黄**（valley） | 官网信号黄 `#fff500`，CSS 基础块即它的定义（无 class 态） |
| **武陵青**（wuling） | 青碧 `#14d0d0`，`body.theme-endfield-wuling` |
| **交互灰** | 不随调色板的固定灰：选中/光标专属（见 [endfield-ui-research.md](endfield-ui-research.md)） |

## 核心令牌（声明在 `body`，绝不在 `:root`）

| 令牌 | 用途 |
| --- | --- |
| `--edge-accent` / `-deep` / `-onpaper` | 强调色填充三档（悬停加深 / 压纸深档） |
| `--edge-accent-ink` | 强调底上的**文字**配对色（灰暗色=白，其余=墨） |
| `--edge-accent-rgb` | 逗号通道表，供 ~30 处 `rgba()` 半透明色块 |
| `--edge-status-light/-mid`、`--edge-status-dark/-mid` | 「强调作文字」角色（回合状态渐变两档） |
| `--edge-select-fill/-ink`、`--edge-caret` | 交互灰三件套（不随调色板） |
| `--edge-emblem` | 徽标矢量掩码 data URI（生成物，见 `scripts/build-emblem.js`） |
| `--edge-wm-alpha` / `--edge-wm-emblem-alpha` | 水印强度 / 徽标补偿档 |
| `--edge-font` | 主题自有字体栈（只上主题自己的元素，不碰应用令牌） |

## 机制词

| 术语 | 含义 |
| --- | --- |
| **hero / persist 模式** | 水印两种挂载：跟随标题（body，逐帧对中）或常驻会话列（列内 `z-index:-1`） |
| **EMBLEM_MASK 区** | client.js 里 `EMBLEM_MASK_BEGIN/END` 标记的生成区，手工编辑会被 `--check` 判漂移 |
| **装饰区间** | 装饰层对比度目标带 1.06–1.6:1（水印/等高线），与正文 AA 4.5:1 分离 |
| **变异验证** | 故意改坏被测行为、断言校验真的失败；selftest.js 的方法论 |
| **合成对比度** | 半透明色按「叠底后」量对比度，相同 α ≠ 相同存在感 |
| **双半** | Host 半（index.js，启动加载）与 Client 半（client.js，按请求读盘、刷新生效） |
