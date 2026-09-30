# 终末地 UI 设计语言调研

> 本文档是 2026-09-30 对《明日方舟：终末地》官方 UI 的完整调研记录，也是本主题
> 灰阶配色、交互灰与徽标水印的决策依据。工程落地见
> [design-language.md](design-language.md)。

## 一、调研方法与来源

**一手来源（实测，非转述）**：

- 官方站点 [endfield.hypergryph.com](https://endfield.hypergryph.com/)（鹰角网络官方域名）
- 其官方 CDN `web.hycdn.cn` 上该站点的发布产物：解压后的 9 个 CSS bundle
  （共 368KB）与 28 个 JS chunk（4MB），从中提取全部颜色字面量、交互规则
  原文与素材清单

**二手来源（交叉印证）**：

- [明日方舟终末地美术风格解析（biubiu）](https://www.biubiu001.com/news/162917.html)
  ——「柠檬黄与灰调背景的结构性并置」的总结与本调研的实测一致

## 二、官网色彩体系（368KB CSS 全量字面量统计）

| 色值 | 出现次数 | 角色 |
| --- | --- | --- |
| `#191919` | **85** | 主工业灰：暗面板、页脚底、图标墨色 |
| `#fff` | 76 | 暗底主文字 |
| `#fffa00` | 57 | **信号黄**：装饰条、选中标记、主 CTA 悬停（稀有，不大面积用） |
| `#d9d9d9` | 22 | 亮灰：悬停面、边线 |
| `#999` | 19 | 次要文字灰 |
| `#35373c` | 15 | 面板灰（微冷） |
| `#e5e5e5` / `#f2f2f2` / `#ccc` / `#666` / `#424242` | 各 9–13 | 灰阶梯队 |
| `#00ffa2` | 9 | 次强调绿（特殊标记） |
| `#f0f0f0` / `#b3b3b3` / `#888` / `#626262` 等 | 3–8 | 交互灰补充档 |

**结论：灰阶占绝对主导（200+ 处），黄只是稀有信号。**

## 三、交互语法（官网 CSS 规则原文证据）

悬停/选中面全部走灰阶，与配色无关：

```css
.Button_button:hover              { color:#fff; background-color:#484848 }  /* 暗色按钮 */
.Button_light:hover               { color:#000; background-color:#f0f0f0 }  /* 亮色按钮 */
.Operator_listButton:hover        { background-color:#626262 }
.ReserveModal_switch:hover        { background-color:#d9d9d9 }
.Header_shareItem:hover           { color:#191919 }
.__02-Operator_button:hover       { background-color:#fffa00 }             /* 唯一黄色悬停：主 CTA */
.ReserveModal_selected::before    { background-color:#fffa00 }             /* 选中标记 */
```

**规则总结**：

1. **悬停 / 选中 = 灰阶**（暗 `#484848`/`#626262`，亮 `#f0f0f0`/`#d9d9d9`）
2. **黄只出现在**：主 CTA 悬停、选中标记、装饰块——「需要被看见的那一处」
3. 文字层级用灰阶梯队（`#fff` → `#d9d9d9` → `#999` → `#666`）

这正是本主题「选中/光标不随调色板、永远官网灰」的依据。

## 四、官方徽标素材盘点（官网 bundle 的 media 目录，共 312 项）

| 素材 | 尺寸 | 判定 |
| --- | --- | --- |
| `blurred_logo.png` | 755×656 | **官网自己的背景水印图**：条码字标 + 倒三角，均匀 `#404040` + 软 alpha（峰值 102/255）；发布时已预模糊，无高清版 |
| `home_title.{zh,en,ja,ko,...}.png` ×8 | 1719×224 | 分语言标题锁定图（含中文），近黑字压透明底；语言相关，不宜做语言中立水印 |
| `home_title_psn.*` / `mobile_title.*` / `checker_title.*` / `obt-title.*` | 各 4–15 张 | 平台/活动变体，多为全出血主视觉或含文字，非徽标 |
| `title.*.png` ×14 | 1920×414 | 全出血横幅主视觉（无 alpha），非徽标 |
| `android-icon.png` | 68×78 | 白色 app 图标字形（dome+条带+倒 V），非品牌徽标 |
| JS bundle 内 SVG | — | 仅特性检测用例，**无**徽标 SVG |

**结论**：官方发布渠道不存在清晰的独立徽标矢量；高清矢量只能来自社区重制
>（本主题最终采用 [Yue-plus/endfield_icons](https://github.com/Yue-plus/endfield_icons)
> 的 `endfield-industries.svg`，采用流程与审计记录见
> [scripts/build-emblem.js](../scripts/build-emblem.js) 头注）。

## 五、设计语法总结（本主题的执行准则）

1. **纸墨灰是基底，强调色是信号。** 灰阶承担界面 95% 的面积与全部高频交互
   （悬停/选中/光标）；强调色只出现在真正的信号位（焦点环、进度轨、主操作）。
2. **悬停/选中永远灰阶**，且亮暗两套：亮 `#d9d9d9` 系、暗 `#484848`/`#626262` 系。
3. **全直角。** 圆角推向「柔和产品」，直角推向「技术文档/工程图纸」；只有形状
   本身是圆的（状态点、头像、加载圈）保留圆形。
4. **数字等宽**（`tnum`），表格与耗时跳动不抖。
5. **灰阶要量着用**：每个灰值对其实际底面验算对比度；近黑底上没有任何一个
   灰能同时满足「底上白字 AA」与「灰作文字 AA」（亮度区间不相交），所以填充
   与文字角色必须分离（`--edge-accent-ink` / `--edge-status-dark`）。

## 六、本主题的落地映射

| 官网事实 | 主题落地 |
| --- | --- |
| `#191919`/灰阶主导 | 终末地灰为默认调色板（亮 `#d9d9d9` / 暗 `#6a6a6a` 填充） |
| 悬停/选中灰阶 | `::selection` 与光标为**不随调色板**的固定灰（亮 `#d9d9d9`+墨字 / 暗 `#6a6a6a`+白字；光标 `#666666`/`#d9d9d9`） |
| 黄为稀有信号 | 谷地黄/武陵青仍可选；黄只上信号位 |
| 背景水印徽标（灰、低透明度） | 矢量徽标 mask + `currentColor` + 装饰区间对比度（1.06–1.32:1） |

对比度全套实测值与断言见 [test/palette-contrast.test.js](../test/palette-contrast.test.js)。
