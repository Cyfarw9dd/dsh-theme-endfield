# 终末地官网动效调研（一手 CSS 证据）

本文回答一件事：**《明日方舟：终末地》官网的动效语法具体是什么**——时长、缓动、
`@keyframes` 结构、hover/active/focus 的写法、以及有没有「工业感」的动效母题，
全部从官方 CSS 原文取数，目标是抽出**可迁移到网页按钮/hover 状态上的写法**。
本文**不**回答配色与静态视觉（那是 [endfield-ui-research.md](../endfield-ui-research.md)
的范围）、**不**回答本主题要怎样改（那是 [design-language.md](../design-language.md)
与工程笔记的范围），也**不**包含任何素材下载或视觉复刻。

> 取数日期：2026-10-01。取数对象：`endfield.hypergryph.com`（鹰角官方域名）与其官方
> CDN `web.hycdn.cn` 上的站点发布产物。全文所有统计数字都可回溯到 §一 的 URL 表。

---

## 一、调研方法、口径与全部访问记录

### 1.1 方法

1. 取官网 HTML（7 个路由），抽出 `<link rel="stylesheet">`，得到 11 个 CSS bundle 的并集；
2. 逐个取回 CSS **正文**（关键：CDN 返回 `Content-Encoding: gzip`，不带解压读取只能拿到二进制，
   第一次尝试得到的 51KB 是错的，本文所有数字均取自解压后的 393,540 字节原文）；
3. 本地解析：按 `{}` 配平拆出 **2,557 条规则**（选择器 + 声明体），再统计 transition /
   animation / keyframes / 状态选择器；
4. 为核对「是否还有按需加载的 CSS」，另取回 HTML 里 25 个 JS chunk（2.48MB 代码文本）；
   其中 **未** 出现 `static/css/*.css` 形式的引用，说明这 11 个 bundle 就是这些路由的完整样式面。

**素材边界（硬约束）**：本次**没有下载、没有内嵌任何图片 / 字体 / 音效**。CSS 原文里出现的
`media/*.png|svg|jpg` 与 11 条 `@font-face` 只记录 URL，未取回文件；下文引用中出现的
`url(...)` 均为**原文引文**，不是素材清单。取回的只有 `.css` 与 `.js`（纯代码文本）。

### 1.2 11 个官方 CSS bundle（编号 C1–C11，后文引用用编号）

全部 `HTTP 200`，均为 `https://web.hycdn.cn/endfield/official-v4/_next/static/css/` 下：

| 编号 | 文件 | 正文字节 | `transition:` | `animation:` | `@keyframes` | `cubic-bezier` | `clip-path` |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| C1 | `2174f0c4d179760f.css` | 5,911 | 1 | 0 | 0 | 0 | 0 |
| C2 | `222bf829ec1ec02b.css` | 34,832 | 3 | 2 | 3 | 0 | 0 |
| C3 | `3519621a91073b60.css` | 99,944 | 66 | 2 | 2 | **1** | 8 |
| C4 | `3a129342b9ac5e73.css` | 19,000 | 6 | 0 | 0 | 0 | 0 |
| C5 | `5f3bf8547312569e.css` | 85,521 | 19 | 0 | 0 | 0 | 18 |
| C6 | `6b6d9a58b4c43339.css` | 340 | 0 | 0 | 0 | 0 | 0 |
| C7 | `846dfe054fffde21.css` | 1,421 | 1 | 1 | 2 | 0 | 0 |
| C8 | `89618c72836110eb.css` | 21,722 | 6 | 1 | 1 | 0 | 0 |
| C9 | `a13bb29dcb00dc9c.css` | 16,740 | 6 | 2 | 2 | 0 | 8 |
| C10 | `e3cec463a5811209.css` | 7,668 | 3 | 0 | 0 | 0 | 0 |
| C11 | `fa87be6b0c162b03.css` | 100,441 | 16 | 3 | 3 | 0 | 2 |
| | **合计** | **393,540** | **127** | **11** | **13** | **1** | **36** |

> 计数口径：`grep -o` 的字面出现次数。`clip-path` 含 `-webkit-clip-path` 前缀形式，
> 因为后者是前者的子串。

### 1.3 访问过的 URL 全表

**页面（均 `HTTP 200`）**：`https://endfield.hypergryph.com/`、`/en`、`/psn`、`/news`、
`/movie`、`/reserve`、`/operator`（`/news` 返回 219,240 字节，其余约 39KB 的 SPA 外壳；
7 个页面的 HTML 内 **没有** 任何内联 `<style>`）。

**CSS（C1–C11，均 `HTTP 200`）**：

- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/2174f0c4d179760f.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/222bf829ec1ec02b.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/3519621a91073b60.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/3a129342b9ac5e73.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/5f3bf8547312569e.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/6b6d9a58b4c43339.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/846dfe054fffde21.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/89618c72836110eb.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/a13bb29dcb00dc9c.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/e3cec463a5811209.css`
- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/fa87be6b0c162b03.css`

**JS chunk（25 个，仅读取代码文本，用于确认没有 JS 侧加载的 CSS）**，前缀同上
`.../official-v4/_next/static/chunks/`：`1434-11a107e8f8cacac2.js`、`1862-f64a25e5790c1ef5.js`、
`18b16e15-9cd90f703163305b.js`、`2060-91b255e722bb1c24.js`、`226-49b5d7d60514384e.js`、
`3269-ebe4833ea03bce18.js`、`3407-e4feb5a0fbb99c17.js`、`3696-e51114e2cc6a1175.js`、
`3877-c91cc7d94c938183.js`、`4231-53da7c4de7468a06.js`、`44ba29dc-c3eeac94473a606d.js`、
`491-d00f740e9c6ed637.js`、`4948-890bad21fbaecbef.js`、`5578-060085c254278034.js`、
`8498-2c5f8f0351c886c2.js`、`8544-0e2dc3d9c44e521e.js`、`86478c97-2730e7cdddbaa41b.js`、
`8963-bee332f627c3a785.js`、`89e1c093-3fe0f7dcc646fb37.js`、`9625-ffdcb691eef55ba2.js`、
`a8f12803-a59e3d6978d239b3.js`、`app/global-error-0b005263e0e74557.js`、
`main-app-aa0c052c2919e7bc.js`、`polyfills-42372ed130431b0a.js`、`webpack-9efdd6c8a8fa9948.js`。

### 1.4 与既有静态调研的口径差异（如实记录）

[endfield-ui-research.md](../endfield-ui-research.md) 记录的是「9 个 CSS bundle / 368KB」，
本次从 7 个路由并集出 **11 个 bundle / 393,540 字节**。差异来自**取数路由集合与解压口径**，
不是来源不同：两处引用的规则原文一致（例如旧文档的
`.Button_button:hover { color:#fff; background-color:#484848 }` 在现行 C3 中仍逐字存在，
只是多了一条 `border-radius:6px`）。涉及具体数字时，以本文 §一 表为准。

### 1.5 二手交叉印证（非官方，单独列出）

本节是唯一涉及非官方渠道的部分，**且本次未从其中下载任何文件**：

- 旧调研引用的 [明日方舟终末地美术风格解析（biubiu）](https://www.biubiu001.com/news/162917.html)
  谈的是静态美术风格（灰调与柠檬黄的结构性并置），**不涉及动效**，因此对本文结论
  **没有提供交叉印证**。
- 结论：本文的全部动效结论**均为一手实测**，无需也无法由第三方补足。凡本文未取得的，
  见 §七 局限，**不以第三方猜测填充**。

---

## 二、时长与缓动（实测分布）

### 2.1 声明级计数（11 个 bundle 全量）

| 声明 | 次数 |
| --- | ---: |
| `transition:`（简写） | **127** |
| `transition-property` / `transition-timing-function` | 3 / 1 |
| `transition-duration` / `transition-delay`（单独声明） | **0** / **0** |
| `animation:`（简写） | **11** |
| `animation-name` / `-timing-function` / `-iteration-count` / `-direction` | 各 1 |
| `animation-duration` / `-delay` / `-fill-mode`（单独声明） | **0** / **0** / **0** |

→ 官网**只写简写**：时长、缓动、延迟全部塞在 `transition:` / `animation:` 一行里，
从不拆成长属性。两组合计 148 条动效声明，去重后 **82 条**。

### 2.2 时长取值分布（148 条声明内的 198 个时间值）

| 时长 | 次数 | | 时长 | 次数 |
| --- | ---: | --- | --- | ---: |
| **`.3s`** | **94** | | `.6s` | 4 |
| **`.2s`** | **71** | | `.5s` | 4 |
| `.4s` | 7 | | `1.6s` | 3 |
| `1s` | 6 | | `1.5s` / `1.4s` / `.05s` / `2s` | 各 1 |
| `.15s` | 5 | | | |

**`.2s` + `.3s` = 165 / 198 = 83.3%**。单位一律用 `s`（含 `.2s` 这种省略前导 0 的写法），
**未出现 `ms`**。

### 2.3 缓动分布（105 个缓动 token）

| 缓动 | 次数 | 占比 |
| --- | ---: | ---: |
| `ease` | **72** | 68.6% |
| `ease-in-out` | 16 | 15.2% |
| `ease-out` | 10 | 9.5% |
| `linear` | 6 | 5.7% |
| `cubic-bezier(1,0,.7,1)` | **1** | 1.0% |
| `ease-in` | **0** | — |
| `steps(...)` | **0** | — |
| 关键字缺省（如 `transition:opacity .3s`，浏览器默认 `ease`） | — | 另有 12 条声明未写缓动 |

**全站只有一个自定义贝塞尔曲线，且没有任何 y > 1 的参数 → 官方动效零回弹（no overshoot）。**

原文证据（C3）：

```css
/* C3 3519621a91073b60.css */
transition:color .2s ease,background-color .2s ease,border-radius .2s ease;
animation:__00-Loading_fadeIn__CDcQn .6s cubic-bezier(1,0,.7,1) .5s forwards;
transition:opacity .3s ease-in-out;
```

其它代表性声明（去重后取自 11 个 bundle，括号内为所属编号）：

```css
/* C1 */ transition:opacity .2s ease;
/* C3 */ transition:clip-path .2s ease,transform .2s ease;
/* C3 */ transition:transform .3s ease .4s,opacity .3s ease .4s;      /* 错峰延迟 */
/* C3 */ transition:opacity 1s 1.4s;                                   /* 长延迟 */
/* C3 */ transition:height .3s ease .3s,width .3s ease .3s,opacity .3s linear,transform .05s linear;
/* C11 */ transition:transform .3s,background-color .3s,box-shadow .3s;
```

「**38 条** transition 声明里出现了 ≥ 2 个时间值」——即**多属性并行 + 延迟错峰是官网的常规手法**，
但延迟全部落在 `.3s`–`.6s` 量级（唯二例外是 `1.4s` 与 `.5s` 的载入序列）。

### 2.4 推断（非实测）

- **推断**：`.2s` 面向「指针反馈」（颜色、背景、圆角），`.3s` 面向「面块出现/位移」。
  两档足以覆盖官网全部交互，说明官方刻意克制档位数量。
- **推断**：`ease` 占绝对多数 + 无 `ease-in` + 无 overshoot，构成「**起步快、收尾稳**」的基调；
  唯一自定义曲线的 `x1 = 1` 进一步强化「快起慢收」。

---

## 三、`@keyframes` 结构（全站仅 13 个）

### 3.1 清单（名称 / 关键帧 / 用途，按 bundle 归属）

| # | 名称 | 关键帧 | 归属 | 用途 |
| --- | --- | --- | --- | --- |
| KF1 | `swiper-preloader-spin` | `0%{rotate(0)} to{rotate(1turn)}` | C2 | 加载转圈 |
| KF2 | `ScrollViewer_scrollTipMove__4X_XG` | `0%{translateY(0);opacity:0} 60%{opacity:1} 80%{translateY(1.5rem);opacity:0} to{…}` | C7 | 下滑提示 |
| KF3 | `ScrollViewer_scrollBreathing__ijjPq` | `0%{scale(1)} 50%{scale(1.2)} to{scale(1)}` | C7 | 呼吸 |
| KF4 | `OrigQuery_rotate__o1MMK` | `0%{translate3d(-50%,-50%,0) rotate(0)} to{…rotate(1turn)}` | C3 | 加载转圈 |
| KF5 | `__00-Loading_fadeIn__CDcQn` | `0%{scaleX(0)} to{scaleX(1)}` | C3 | **黄色横条揭示**（见 §五） |
| KF6/KF7 | `h5-cn_scrollTipMove__uvZzG` / `h5-oversea_scrollTipMove__ObqWD` | 同 KF2 | C8 / C2 | 移动端下滑提示 |
| KF8/KF9/KF12/KF13 | `__05-Gameplay_flashing__W8_Z1` / `__08-AIC_flashing__pEebW` / `__03-gameplay_flashing__wp7NK` / `__04-finalpage_flashing__w5gJk` | `0%{opacity:0} 10%{.5} 11%{0} 20%{.5} 21%{0} 40%{.5} 41%{0} to{1}` | C2 / C2 / C2 / C2 | **多段闪烁**（四个页面各复制一份） |
| KF10 | `__09-Calendar_downloadBgBreath__9_Ko0` | `0%,to{rgba(0,0,0,.42)} 50%{rgba(0,0,0,.62)}` | C2 | 遮罩呼吸 |
| KF11 | `RollingContent_carousel__Yi3KP` | `0%{translateX(0)} 80%{translateX(-50%)} to{translateX(-50%)}` | C11 | 走马灯 |

### 3.2 关键帧属性与 transform 函数分布

| 关键帧里出现的属性 | 次数（按 keyframes 块计） |
| --- | ---: |
| `transform` | 8 |
| `opacity` | 7 |
| `background-color` | 1 |

`transform` 里的函数出现次数：**`translate*` 21、`scale*` 5、`rotate*` 4、`translate3d` 2、`skew` 0**。

> 对照：整份 CSS 里 `translate3d` 出现 **81** 次，但其中只有 2 次在关键帧里——**官网用
> `translate3d(-50%,-50%,0)` 做的是静态居中，不是动画**。不要把「元素里有 translate3d」
> 误读成「性能优化过的位移动画」。

关键帧选择器分布：`to` 13（每个动画都有）、`0%` 12、`10%/11%/20%/21%/40%/41%` 各 4（即闪烁家族）、
`80%` 4、`60%` 3、`50%` 2。→ **官网偏好「首尾两帧 + 少量中间帧」，不写密集关键帧**。

### 3.3 结论与推断

- **实测**：`@keyframes` 只做 4 件事——旋转（无限循环）、透明度闪烁、尺寸呼吸、
  **`scaleX` 横向揭示**。没有任何一个关键帧做「回弹 / 过冲 / 二次归位」。
- **推断**：官方风格是**位移（translate）与显隐（opacity）为主，比例变形（scale）为辅，
  零透视、零 3D 旋转**（无 `rotateX/Y`，无 `perspective`）。
- **实测**：13 个 `@keyframes` 里有 4 个是**逐页复制的同一段闪烁**（KF8/9/12/13）——
  说明官网的 CSS 是按路由模块各自打包的，没有共享的关键帧库。

---

## 四、hover / active / focus 的状态语法

### 4.1 数量（2,557 条规则全量）

| 选择器含 | 规则数 |
| --- | ---: |
| `:hover` | **78** |
| `:active` | **15** |
| `:focus-visible` | **1** |
| `:focus`（不含 focus-visible） | **0** |

### 4.2 最关键的一条结构事实：transition 从不挂在状态规则上

- 有 `transition` 声明的选择器：**124 个**；
- 其中选择器含 `:hover` / `:active` / `:focus` 的：**0 个**。

即：**官网把 `transition` 写在基础选择器上，状态规则里只写「目标值」。** 原文（C3）：

```css
/* C3 3519621a91073b60.css —— 基础态带 transition */
.Button_button__njqVS{position:relative;width:20rem;height:4.5rem;box-sizing:border-box;
  border:none;border-radius:2px;padding:0;cursor:pointer;background-color:#383838;
  background-blend-mode:soft-light;display:flex;align-items:center;justify-content:center;
  font-size:1.75rem;line-height:1;font-family:SansMedium;color:#eee;
  transition:color .2s ease,background-color .2s ease,border-radius .2s ease;
  filter:drop-shadow(0 0 .25rem rgba(0,0,0,.25))}

/* 状态态只写目标值，且被 any-hover 守卫 */
@media(any-hover:hover){
  .Button_button__njqVS:hover{color:#fff;background-color:#484848;border-radius:6px}
  .Button_button__njqVS:hover:before{border-radius:6px}
  .Button_button__njqVS:hover:after{
    -webkit-clip-path:polygon(0 20%,100% 50%,0 80%,0 80%);
    clip-path:polygon(0 20%,100% 50%,0 80%,0 80%);
    transform:translateX(.875rem)}
}
```

注意其中 **`border-radius` 是被动画的属性之一**：直角 `2px` → 悬停 `6px`。
（`@media(orientation:portrait)` 下基础态另有 `border-radius:.25rem`。）

### 4.3 hover 实际改动的属性分布（78 条规则）

| 属性 | 次数 | | 属性 | 次数 |
| --- | ---: | --- | --- | ---: |
| `background-color` | **34** | | `border-radius` | 4 |
| `opacity` | **16** | | `clip-path` / `-webkit-clip-path` | 各 4 |
| `transform` | **15** | | `pointer-events` | 2 |
| `color` | **15** | | `width` | 2 |
| `border-color` | 7 | | | |

→ **悬停的主力是「换底色」，其次是「显隐 / 位移 / 换字色」**；变形类（scale / rotate）
在 78 条 hover 里只有零星几处。

其它代表性状态规则（原文）：

```css
/* C9 a13bb29dcb00dc9c.css —— 左侧矩形揭示 */
.pc-cn_cloudGameButton__iFD48:after{
  background-image:url(https://web.hycdn.cn/endfield/official-v4/_next/static/media/cloud-game-active.6c5cfe38.png);
  -webkit-clip-path:polygon(0 0,0 0,0 100%,0 100%);
  clip-path:polygon(0 0,0 0,0 100%,0 100%);
  transition:clip-path .3s ease;transition:clip-path .3s ease,-webkit-clip-path .3s ease}
.pc-cn_cloudGameButton__iFD48:hover:after{
  -webkit-clip-path:polygon(0 0,100% 0,100% 100%,0 100%);
  clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}
```

```css
/* C3 —— 图标旋转 90° */
.Media_mediaModal__4NhcG .Media_closeBtn__PlFHw .Media_closeIcon__4PSl6{
  width:3rem;height:3rem;color:#191919;transition:transform .3s}
.Media_mediaModal__4NhcG .Media_closeBtn__PlFHw:hover .Media_closeIcon__4PSl6{transform:rotate(90deg)}
```

```css
/* C8 89618c72836110eb.css —— hover 只改底色 / 只缩放角标 */
…__04-Information_playBtn__pFvtR:hover{background-color:#fafafa}
…__04-Information_playBtn__pFvtR:hover:after{transform:scale(1.25)}
```

```css
/* C3 —— 类切换（非 hover）驱动的不透明度过渡 */
.Media_mediaModal__4NhcG{position:fixed;…;opacity:0;pointer-events:none;transition:opacity .3s ease-in-out}
.Media_mediaModal__4NhcG.Media_active__t0_Nv{opacity:1;pointer-events:auto}
```

### 4.4 `@media(any-hover:hover)` 守卫

全站有 **28 条** hover 规则被包在 `@media(any-hover:hover){…}` 里——**触屏设备上不给 hover 反馈**。
其它 50 条 hover 未加守卫（多数在移动端页面的 CSS 里）。`prefers-reduced-motion` 出现 **0 次**：
**官网完全不做减弱动效降级。**

### 4.5 推断（非实测）

- **推断**：官网的 hover 语法可归纳为一条公式——
  「基础态声明 `transition` + 状态态只改值 + 用 `any-hover` 守卫」。
  这条公式是本主题可以直接照搬的部分。
- **实测 + 提示**：官网 **`:focus` 规则为 0**，`:focus-visible` 仅 1 条。
  本主题 [design-language.md](../design-language.md) 里的焦点环
  （`outline: 2px solid var(--edge-accent)`）因此是**主题自加的无障碍要求，不是官网语法**，
  引用时不应说成「官网做法」。

---

## 五、「工业感」动效母题：有证据的与没有证据的

### 5.1 有证据的母题

**(a) `clip-path` 矩形揭示（wipe reveal）——有证据。**
`clip-path` 全站出现 36 次；其中**被动画驱动的**是「零宽矩形 → 满宽矩形」这一对，
配 `transition:clip-path .3s ease`（原文见 §4.3 C9）。
`clip-path` 的另一大用途是**静态布局遮罩**（`polygon(0 0,100% 0,100% 100%,0 100%)` 满矩形，
出现在 C5 的 18 处与 C3），与动效无关，不要混为一谈。

**(b) `scaleX` 横向揭示 + 唯一自定义贝塞尔——有证据（最「工业」的一段）。**
C3 的加载层：一个**整屏 `#fffa00` 黄条**从左缘拉开。

```css
/* C3 3519621a91073b60.css */
.__00-Loading_container__aBijT.__00-Loading_leaving__IKIPd{transition:opacity 1s 1.4s;opacity:0}
.__00-Loading_container__aBijT.__00-Loading_leaving__IKIPd:after{
  content:"";position:absolute;top:0;left:0;width:100%;height:100%;background-color:#fffa00;
  transform-origin:left;transform:scaleX(0);
  animation:__00-Loading_fadeIn__CDcQn .6s cubic-bezier(1,0,.7,1) .5s forwards}
@keyframes __00-Loading_fadeIn__CDcQn{0%{transform:scaleX(0)}to{transform:scaleX(1)}}
```

要点：`transform-origin:left`（从左展开）、`scaleX` 而非 `width`（不触发重排）、
`.6s` + `.5s` 延迟 + `forwards`、曲线 `cubic-bezier(1,0,.7,1)`（x1=1 → 快起慢收）。

**(c) 阶梯式信号闪烁（用百分比关键帧，不是 `steps()`）——有证据。**
KF8/9/12/13 一族：在 10%、20%、40% 各插一个 1% 宽的半亮脉冲，再落到常亮。

```css
/* C2 222bf829ec1ec02b.css */
@keyframes __05-Gameplay_flashing__W8_Z1{0%{opacity:0}10%{opacity:.5}11%{opacity:0}
  20%{opacity:.5}21%{opacity:0}40%{opacity:.5}41%{opacity:0}to{opacity:1}}
.__05-Gameplay_sectionContainer__LN64O .__05-Gameplay_decoLeft__u4hlT.__05-Gameplay_active__Ers8s{
  animation:__05-Gameplay_flashing__W8_Z1 1s ease-out forwards}
```

这是**「仪表通电 / 信号灯闪烁」的观感**：不是平滑淡入，而是「跳三次再亮」。

**(d) 错峰延迟（stagger）——有证据。** 38 条 transition 声明含 ≥2 个时间值，
典型如 `transition:transform .3s ease .4s,opacity .3s ease .4s`（C3），
同一元素的多属性按 `.4s`/`.5s`/`.6s` 依次入场。

**(e) 进度/尺寸条——有证据但克制。** 去重后的 82 条动效声明中，有 **7 条**显式过渡
`width` / `height`（如 `transition:width .3s`、`transition:transform .3s,height .3s,width .3s`，
均在 11 个 bundle 内）。即官网**确实会动宽高**（展开/收起），但主角仍是 `transform`。

### 5.2 未找到证据的母题（明确记录「未找到」）

| 母题 | 全站出现次数 | 结论 |
| --- | ---: | --- |
| `steps(...)` 步进缓动 | **0** | 未找到证据 |
| 光标闪烁（`blink` / `caret` / `animation` 驱动的光标） | **0** / **0** | 未找到证据 |
| `::selection` 文本选中动效 | **0** | 未找到证据 |
| `prefers-reduced-motion` 降级 | **0** | 未找到证据 |
| 回弹 / 过冲（`cubic-bezier` 的 y > 1） | **0** | 未找到证据 |
| `conic-gradient`（雷达/仪表盘式） | **0** | 未找到证据 |
| `stroke-dashoffset`（描边绘制式） | **0** | 未找到证据 |
| `will-change` | 1 | 几乎不用 |

### 5.3 工业母题的「静态」部分（有视觉、无动效）

以下是有工业观感、但**官网没有给它们做任何动画**的写法，必须区分清楚：

```css
/* C11 fa87be6b0c162b03.css —— 刻度尺状排线（:before/:after 双份，含竖屏变体） */
.__03-Lore_container__ZiS0O .__03-Lore_lattice__whvWQ:after,
.__03-Lore_container__ZiS0O .__03-Lore_lattice__whvWQ:before{
  content:"";display:block;height:.5rem;margin-bottom:.25rem;
  background-image:repeating-linear-gradient(90deg,#b2b2b2 0,#b2b2b2 .5rem,transparent 0,transparent .75rem)}
```

```css
/* C11 —— 45° 危险斜纹，仅用于激活项 */
…__03-Lore_navigator__ZI3wY .__03-Lore_activeName__BNCet{
  …;background-image:repeating-linear-gradient(-45deg,#1f1f22,#1f1f22 3px,transparent 0,transparent 6px)}
```

- `repeating-linear-gradient` 全站 **4 处**：2 处刻度尺排线、2 处 45° 斜纹。**均无 `animation` / `transition`。**
- 角标/方括号：表格表头用位图角标（`th-deco-rt.svg`、`th-deco-lt.png`、`th-deco-lb.png`，
  URL 见 C3 原文）与 `#fffa00` 底边；同样是**静态**装饰。
- **推断**：官网的「工业感」主要靠**静态几何**（直角、排线、角标、等宽数字）建立，
  动效只负责**反馈**（.2s/.3s 换色）与**少数仪式性揭示**（黄条 wipe、信号闪烁）。
  给扫描线/排线加流动动画属于**超出官方的自创**，若在主题里使用必须标注为非官网语法。

---

## 六、可直接落地成 CSS 的结论（每条带证据）

1. **两条时长档 + 一条缓动**：交互反馈用 `.2s ease`，面块/结构变化用 `.3s ease`。
   依据：198 个时长值中 `.2s`(71) + `.3s`(94) 占 83.3%，105 个缓动 token 中 `ease` 占 68.6%（§2.2/2.3，11 个 bundle 全量）。
2. **`transition` 只写在基础选择器，状态规则只写目标值**。
   依据：124 个带 `transition` 的选择器中，含 `:hover`/`:active`/`:focus` 的为 **0**（§4.2）。
3. **按钮 hover 的官方配方 = 换字色 + 换底色 + 改圆角，`.2s ease`**：
   依据（C3）：`transition:color .2s ease,background-color .2s ease,border-radius .2s ease`，
   `:hover{color:#fff;background-color:#484848;border-radius:6px}`（§4.2 原文）。
4. **矩形揭示用 `clip-path`，`.3s ease`**：从 `polygon(0 0,0 0,0 100%,0 100%)` 到
   `polygon(0 0,100% 0,100% 100%,0 100%)`。依据（C9）：`transition:clip-path .3s ease`（§4.3 原文）。
5. **横向 wipe 用 `transform-origin:left` + `scaleX(0→1)`，不要动 `width`**；
   若要贴近官方曲线，用 `cubic-bezier(1,0,.7,1)`（全站唯一自定义贝塞尔，y ≤ 1，**不回弹**）。
   依据（C3）：`__00-Loading_fadeIn` 关键帧 + `animation:… .6s cubic-bezier(1,0,.7,1) .5s forwards`（§5.1b 原文）。
6. **阶梯/闪烁感用百分比关键帧实现，不要用 `steps()`**：官方写法是
   `0%{opacity:0}10%{.5}11%{0}20%{.5}21%{0}40%{.5}41%{0}to{1}`，`1s ease-out forwards`；
   依据（C2，4 个同族关键帧），且全站 `steps(` 出现 **0** 次（§5.1c/§5.2）。
7. **hover 反馈要包 `@media(any-hover:hover)`**（官网 28 处这么做），
   并可把「悬停改 `background-color`」当作默认手法——它是 78 条 hover 规则里改动最多的属性（34 次，§4.3/4.4）。
8. **不要照抄的三件事**：官网**无** `:focus` 语法、**无** `prefers-reduced-motion` 降级、
   **无**回弹曲线。主题里的焦点环与减弱动效降级是**主动超出官网**的无障碍补强（§4.5/§5.2）。

---

## 七、局限与未取得项（如实记录）

1. **11 个 bundle 中有一个被引用但未定义的动画**：
   C11 里 `animation:__00-landing_activityShake__gr1Yi 2s ease-in-out infinite` 有引用，
   但 11 个 bundle 内**找不到对应的 `@keyframes`**（`__00-landing_activityShake` 仅在 C11 出现 1 次）。
   该定义可能在**未被这 7 个路由静态链接**的按需 CSS chunk 中，也可能是其构建缺陷。
   本次**未能取得**，原因是 25 个 JS chunk 中不含任何 `static/css/*.css` 引用，无法枚举出遗漏的 chunk 名。
2. **`RollingContent_carousel__Yi3KP` 的 duration 未知**：C11 只写了
   `animation-name` / `-timing-function:linear` / `-iteration-count:infinite`，
   **没有 `animation-duration` 声明**（全站 `animation-duration` 为 0 次），时长应由 JS 内联设置。
   故本文**不给出**该动画的时长数字。
3. **官网未做焦点态与减效降级**，因此「官网的 focus 动效语法」这一项**不存在可测对象**，
   本文不给任何数值，也不以第三方内容补位。
4. 页面路由仅覆盖 `/`、`/en`、`/psn`、`/news`、`/movie`、`/reserve`、`/operator`；
   更深的子路由（如单条公告详情）如另有独立 bundle，本次未枚举到。

---

## 附：本文未重复的相邻内容

- 静态视觉、配色统计、素材盘点：[endfield-ui-research.md](../endfield-ui-research.md)
- 本主题已落地的动效与色彩决策：[design-language.md](../design-language.md)
- 文档分层与准入规则：[AGENTS.md](AGENTS.md)

---

# 附录 B：`/operator` 路由解构（配色 / 动效 / 背景）

> 本节是对**单个路由**的解构记录，不改变正文（全站动效调研）的任何结论。
> 取数日期 2026-10-01，方法同正文 §1.1。

**取数对象**：`https://endfield.hypergryph.com/operator`（HTML 215,162 字节，其中无内联 `<style>`，
静态链接 10 个 CSS）。该路由的界面样式**全部集中在一个 bundle**：

- `https://web.hycdn.cn/endfield/official-v4/_next/static/css/5f3bf8547312569e.css`
  （**85,521 字节，412 条规则**，`__02-Operator` 前缀类名出现 **1,211** 次）

本节全部数字均出自该 bundle。**未下载任何图片/字体**：bundle 内 85 个 `url(...)` 只做登记。

## B1. 配色

### hex 字面量频次（前 18，共 24 个不同值）

| 色值 | 次数 | 角色 |
| --- | ---: | --- |
| `#fff` | 17 | 亮字/亮面、`decoTape` 底色、圆形按钮描边 |
| `#fffa00` | 13 | **信号黄**：装饰条中段、`decoFlag`/`cv` 底色、CTA hover、选中边框 |
| `#191919` | 12 | 墨色：`label` 底色、正文 |
| `#999` / `#f2f2f2` / `#bfbfbf` | 各 5 | 次要文字灰 / 浅面板灰 / `decoLineIcon` 灰 |
| `#424242` | 4 | 斜纹纹样色 |
| **`#ff00f0`** / **`#00ffa2`** | 各 3 | 三色装饰条的**品红端 / 荧光绿端** |
| `#333` | 3 | 深灰 |
| `#d9d9d9` / `#ccc` / `#e6e6e6` / `#e5e5e5` / `#3d3d3d` | 各 2 | 灰阶梯队 |
| `#383838` / `#626262` / `#282828` | 各 1 | **`listButton` 的常态 / hover / active** |
| 其余 6 个 | 各 1 | 未进入前 18 |

规则级补充（不在上表前 18，但原文可见）：`#fafafa`（圆形切换按钮常态底）、`#eeea00`（该按钮 active 底）。

### 交互灰阶的三段式（原文）

```css
/* 5f3bf8547312569e.css */
.__02-Operator_listButton__jKExN{…;background-color:#383838;…;transition:background-color .2s ease;…}
.__02-Operator_listButton__jKExN:hover{background-color:#626262}
.__02-Operator_listButton__jKExN:active{background-color:#282828}
```

→ **常态 `#383838` → 悬停 `#626262`（变亮）→ 按下 `#282828`（比常态更暗）**，
按下比常态更暗，与「悬停提亮」方向相反——这是本节最可直接迁移的一条灰阶语法。

### 强调黄的使用位置（全部 8 处性质）

`sectionDivider:before` 底色、`decoFlag` 底色、`cv`（"3D" 标签）底色、`border` 边框色、
`button:hover` 底色、`linear-gradient` 装饰条中段、`decoLineTri` 中段、`deco` 中段。
→ **黄只做「信号 / 标记 / 主操作」，不做大面积底**，与正文 §五 结论一致。

### 关于 `rgba`

`rgba(0,0,0,0)` × 40、`rgb(0,0,0)` × 34 是高频项，但**它们大多不是可见颜色**：
`rgb(0,0,0)` / `black` 出现在 `mask-image` 里表示「不透明端」（见 B3），
`rgba(0,0,0,0)` 是「透明端」或占位。真正作为配色的深色遮罩是
`rgba(0,0,0,.7)`（×3，选中态底）、`rgba(0,0,0,.5)`（×2）、`rgba(2,2,2,.3)`（×2，按钮投影）。
**统计这份 bundle 的配色时必须把 mask 的黑排除，否则深色占比会被严重高估。**

## B2. 动效

| 声明 | 次数 |
| --- | ---: |
| `transition:` | **19**（去重 16 条） |
| `animation:` | **0** |
| `@keyframes` | **0** |
| `steps(...)` | **0** |
| `prefers-reduced-motion` | **0** |

**该路由没有任何关键帧动画、没有任何循环动画**——全部动效都是「状态切换 + transition」。
（对照正文：全站 11 条 `animation` 与 13 个 `@keyframes` 一个都不在 `/operator` 页。）

### 三个动效族

**(1) 阶梯延迟入场（该页的签名手法）**——分割线上的四个元素按 `.2s → .4s → .5s → .6s` 依次进入：

```css
.__02-Operator_sectionDivider__PbN7_:before{…;transition:transform .4s ease .2s}
.__02-Operator_sectionDivider__PbN7_:after {…;transition:transform .3s ease .4s,opacity .3s ease .4s}
.__02-Operator_dividerSubtitle__bTAer   {…;transition:transform .3s ease .5s,opacity .3s ease .5s}
.__02-Operator_dividerTitle__yHdrt      {…;transition:transform .3s ease .6s,opacity .3s ease .6s}
```

**(2) `clip-path` 揭示（抽屉开合）**：

```css
.__02-Operator_drawerWrapper__gYsbO{…;
  -webkit-clip-path:polygon(0 0,100% 0,100% 100%,0 100%);
  clip-path:polygon(0 0,100% 0,100% 100%,0 100%);z-index:1;
  transition:clip-path .3s ease;-webkit-clip-path .3s ease}
/* 选中态把遮罩向下多放 3rem，露出下面的内容 */
.__02-Operator_active__5YfL8{clip-path:polygon(0 0,100% 0,100% calc(100% + 3rem),0 calc(100% + 3rem))}
```

**(3) 灰阶 / 不透明度反馈**：`background-color .2s ease`、`background-color .2s ease-in-out`、
`border-color .3s ease-in-out`、`transform .2s ease-in-out`，以及
`activeBg{opacity:0;transition:opacity .3s ease-in-out}` + `active{opacity:1}` 的选中态淡入。

位移型状态切换还有：`contentContainer{transform:translateY(-18.5rem)}`、
`active:before{content:"3D";transform:translateX(4.4375rem)}` / `:after{transform:translateX(0);opacity:1}`、
`arrow{transform:translateY(-50%) rotate(90deg)}` 与 `{transform:translateY(-50%)}`。

→ 时长与缓动**完全落在正文 §二 的两档内**（`.2s` / `.3s`，唯一例外是 `.4s ease .2s` 的首个分割元素），
缓动也只用 `ease` / `ease-in-out`。

## B3. 背景（四层结构）

**(1) 纹理位图层（素材只登记 URL，未下载）**

| 素材 | 引用它的选择器 |
| --- | --- |
| `media/wave-bg.8955885a.png` | `backgroundDeco:before`、`decoTape:before`、`header:before` |
| `media/tape-wave-bg.2bce9fc0.png` | `decoTape:before`、`header:before` |
| `media/block-bg.f05eda37.svg` | `shallowBg`、`shallowBg:before`、`decoFlag:before` |
| `media/pag-button-texture.e4e732ad.png` | `inner`、`button:before` |
| `media/endfield.bcc6fe39.png` | `loadingContainer` |
| `media/section_divider_icon_lore.6968c414.png` | `sectionDivider:after` |
| `media/operator.875a6fbd.png` | `listButton:before` |
| `media/star.c078a0a7.png` | `star` |

另有 23 个角色立绘 PNG **各两套**（同文件名不同 hash，如 `laevatain.20075757.png` 与
`laevatain.d0ca2837.png`）、5 张元素图标 `ele-*.jpg`、6 张职业图标 `prof-*.jpg`——均为
`background-image` 引用，**本次全部未取回**。

**(2) 45° 斜纹：用百分比精度的一次性 `linear-gradient`（不是 `repeating-*`）**

```css
/* listButton 的纹样 */
background-image:linear-gradient(-45deg,transparent,transparent 16.1610023423%,#424242 0,#424242 33.8389976577%,transparent 0,transparent 66.1610023423%,#424242 0,#424242 83.8389976577%,transparent 0,transparent)
/* shallowBg / whiteCover:after 的同一公式，颜色换成 black */
background-image:linear-gradient(-45deg,transparent,transparent 13.9512529279%,black 0,black 36.0487470721%,transparent 0,transparent 63.9512529279%,black 0,black 86.0487470721%,transparent 0,transparent)
```

→ 该 bundle `repeating-linear-gradient` 为 **0** 次：`/operator` 的斜纹是「算好百分比的循环渐变」，
与正文 §5.3 里 `/lore` 用 `repeating-linear-gradient` 的刻度尺排线**不是同一套写法**。

**(3) 边缘渐隐全部靠 `mask-image`（22 处）**，而不是叠加色块：

```css
.__02-Operator_shallowBg__E2XaH {mask-image:linear-gradient(0deg,rgb(0,0,0) 0,rgb(0,0,0) 50%,rgba(0,0,0,0))}
.__02-Operator_decoFlag__xm7_G  {mask-image:linear-gradient(180deg,rgb(0,0,0) 0,rgb(0,0,0) 50%,rgba(0,0,0,0))}
.__02-Operator_decoTape__9rSYk  {mask-image:linear-gradient(90deg,rgba(0,0,0,0) 0,rgb(0,0,0) calc(50% - 59.5rem + 3.75rem),rgb(0,0,0))}
.__02-Operator_operatorSwitcher__mVB3Y:before{mask-image:linear-gradient(180deg,rgba(0,0,0,0) 0,rgb(0,0,0) 20%,rgb(0,0,0) 80%,rgba(0,0,0,0))}
.__02-Operator_itemContainer__1m60G{mask-image:linear-gradient(180deg,rgba(0,0,0,0) 0,rgb(0,0,0) .625rem,rgb(0,0,0) calc(100% - .625rem),rgba(0,0,0,0))}
```

**(4) 三色装饰条与实心色块**

```css
/* 品红 → 信号黄 → 荧光绿 的元素/属性色标；decoLineTri 与 deco 用同一串 */
.__02-Operator_decoLine___SBw8{…;height:.25rem;
  background-image:linear-gradient(90deg,#ff00f0 11.25rem,#fffa00 0,#fffa00 22.5625rem,#00ffa2 0)}
/* 灰版分隔线 */
background-image:linear-gradient(90deg,#bfbfbf 6.25rem,transparent 0,transparent 26.5625rem,#bfbfbf 0)
```

实心色块：`decoFlag` 底 `#fffa00`、`decoTape` 底 `#fff`、`cv`（"3D" 标签）底 `#fffa00`、
`label` 底 `#191919`、`nameContainer` 底 `#d9d9d9`、`value` 底 `#f2f2f2`。

## B4. 与正文（全站）结论的关系

| 结论 | 关系 |
| --- | --- |
| 两档时长 `.2s` / `.3s`、`ease` 为主 | ✅ 在 `/operator` 同样成立（B2） |
| 状态规则不写 `transition` | ✅ 成立：`listButton:hover/:active`、`button:hover/:active` 均只有目标值 |
| 阶梯延迟是官网常规手法 | ✅ 该页最集中（`.2/.4/.5/.6s`，4 个宿主） |
| `clip-path` 矩形揭示 | ✅ 该页用于抽屉（`.3s ease`），与正文 §5.1a 的按钮揭示同源 |
| 工业母题多为静态 | ✅ 斜纹、三色条、纹理层均**无动画**；该页 `@keyframes` = 0 |
| `:focus` / 减效降级缺位 | ✅ 该 bundle 同样为 0（`prefers-reduced-motion` 0 次） |
