# 测试与校验

```bash
node check.js      # 样式表静态不变量
node selftest.js   # 反向验证 check.js 真能抓到那些问题
npm test           # 上面两项 + 配色 / 设置页 / 渲染 / 覆盖率 / 性能全部验证
```

本仓库的测试有一条贯穿原则：**从真实 `client.js` 里读值，不复述数值。** 复述只能测到副本——一次样式表编辑后，测试仍会对着旧数字通过。

第二条原则：**每条断言都做过反向对照（变异验证）。** 故意把被测行为改坏，确认该断言真的会失败。一个从未被观察到失败过的校验，不能算证据。

> **运行环境。** 带「真实浏览器」字样的脚本会 spawn 本机 Chrome 做无头渲染，需要本机安装 Chrome。以下脚本是**纯进程内**的，任何环境都能跑：`check.js`、`selftest.js`、`palette-contrast`、`settings-rows`、`settings-locale`、`thunder-edges`。

---

## check.js — 样式表静态不变量

主题样式表是**一整个 JavaScript 模板字符串**，有几类改动会在「文件仍能解析」的情况下悄悄破坏效果。检查项：

| 检查 | 守的是什么 |
| --- | --- |
| 模板字符串内无反引号 | 写在 CSS 注释里也会提前闭合，整个 client bundle 解析失败 |
| 无 `${...}` | 在模板字符串里那是插值，不是 CSS |
| CSS 注释成对、花括号配平 | 花括号在剥离注释后再统计 |
| 顶层没有漏进散文 | 抓「注释提前闭合」——注释本身仍是配平的，真正的破坏是残留文字落到顶层、与下一条选择器黏在一起 |
| `--edge-word` / `--edge-gap` 在**实际生效的 CSS** 里有定义 | 注释里提到不算 |
| 10 个调色板变量全部有定义 | 缺任一变量都不会优雅降级：读它的每条声明都会被丢弃 |
| `body.theme-endfield-wuling` 块存在 | 缺这个块则切换按钮点了没反应 |
| 没有任何 `--edge-*` 变量在 `:root` 里引用 `--dsw-*` 令牌 | 结构化检查，守 [:root 陷阱](engineering-notes.md#变量必须声明在-body-而不是-root) |
| 样式表里没有 `--dsw-font-family:` / `--ds-font-family-code:` 声明 | 这两个令牌是**应用的公共接口**（应用用它渲染 UI 根字体），主题声明它就会连第三方挂件的字体一起改掉，见[字体令牌](engineering-notes.md#字体令牌是应用的公共接口不是主题的开关) |
| `client.js` 能编译 | 用 `vm.Script` 在进程内解析、不执行 |
| 回合状态标签仍通过 `background-image` 改色 | 写成 `color:` 对渐变文字无效，属于「改了但没生效」的静默失败 |

## selftest.js — 校验器自检

把上述每个真实问题注入 `client.js` 的**副本**并断言 `check.js` 确实失败，同时断言注入本身生效（避免空跑）。

---

## 选择器与主题化落点

```bash
node test/selector-guard.test.js   # 静态：禁止哈希选择器，且哈希无关的钩子必须还在
node test/preset-chip.test.js      # 真实浏览器：头部预设徽章必须真的被主题化
```

**`selector-guard.test.js`** 是 issue #17 的守卫，分两部分：剥离注释后 bundle 里**不得**再出现 `<hash>_` 形式的类名（哈希 = 6 位混合大小写 + 下划线）；以及 JS 探测器和样式表依赖的**每个哈希无关钩子**都必须存在——少一个钩子，对应功能就会在真实页面上静默失效。

**`preset-chip.test.js`** 守的是这类字符串守卫**看不见**的那一半：钩子在源码里，不代表选择器真的匹配得到元素。它按**在运行中的 GUI 上量出来的**骨架搭夹具——包括那一层**没有 class 的插槽条目包裹层**：

```
_centerCol > _header > _titleRow > _titleCluster > _headerActions
  > div（无 class） > span._label > svg._icon
```

加载真实 `client.js`，然后断言**结果**而不是选择器文本：徽章被强调色填充、字为黑色；**并且尺寸仍是上游的**——180px 上限保留、实测宽度在合理范围（夹具里 90px）、包裹层保持 `display:block`、`_headerActions` 保持 `flex:none`。

最后那两条不是凑数：**主题在这里只负责配色，几何归上游**。曾经为了让徽章"撑满动作行"而压平包裹层 + 增长容器，真实页面上直接变成一条横贯会话列的黄色长条（976px 的行里占 923px）。这类断言要同时守住两侧：既不能没上色，也不能被拉成长条。

另配三条反向断言：插槽里没有徽章时容器必须保持上游的 `flex:none`（否则每个没有 preset 的会话都会被撑开）；同一插槽里 jobs 式条目的 `_label`（藏在下拉菜单深处、只有文字）必须保持原样；容器**之外**一个仅仅以 `_label` 结尾的标签也必须保持原样——后两条正是这条选择器必须靠"徽章自己带图标"来锁定、而不能裸匹配后代的原因。

夹具用语义假名（`probe_headerActions` 等）而不是真哈希，所以上游重新哈希不会让这条测试说谎；它能稳稳抓住「后缀写对了、层数写错了」这一类回归。**注意：这条测试的夹具本身就是它的核心资产**——它曾经漏掉那层无 class 包裹层，于是选择器在夹具上命中、测试全绿，而真实页面一个元素都没匹配到。改动夹具结构时，务必对着真实 DOM 核，别为了让选择器通过而搭。

> 变异验证 5 类：把选择器换回"漏掉包裹层"的那版 → 2 条断言红（含线上看到的灰底）；把图标判据换成裸后代 → jobs 标签与容器外 `_label` 两条反向断言红；重新加回"压平包裹层 + 增长容器" → 两条"变成长条"断言红。

---

## 配色

```bash
node test/palette-contrast.test.js   # 两套配色每个角色的对比度（从真实 CSS 里读值）
node test/palette-switch.test.js     # 真实浏览器里切换配色，22 项断言
node test/settings-buttons.test.js   # 强调色底上的按钮文字对比度（32 项，含回归守卫）
node test/hover-check.js             # 用 CDP 真的移动鼠标，验证真实 :hover 规则（3 个面，24 项）
node test/verify-shots.js            # 解码四张截图统计强调色像素
```

**`palette-contrast.test.js`** 从 `client.js` 的实际样式表里把变量读出来再验算。覆盖约 20 项：实心底 + 墨色字达 AA、悬停底同样达标、渐变文字四个色标对**两种**可能底色都达 AA、暗色强调色作图标墨色 ≥3、hero 光晕不比原品牌蓝更响、两配色确实不同、强调色写成 6 位十六进制，以及**武陵青的亮度必须落在 45%–56% 区间且留在青碧色轴上**。

**`palette-switch.test.js`** 在真实浏览器里跑真实 `client.js`，并**按应用的真实方式把令牌写成 `<body>` 行内样式**——用样式表 `:root` 假装会让测试通过而线上坏掉，这种不对称正是它存在的理由。断言：默认是谷地黄且不带 class；11 个变量全部**非空**；`--dsw-alias-brand-primary` 在切换后**自动**变成青色（令牌层没有重新注册）；`rgba(var(--rgb), α)` 型半透明色块随之切换；渐变文字换色；**画布被重绘且新描边偏青**（B 通道高于 R）；关闭主题后不残留 class。

**`settings-buttons.test.js`** 读计算样式，用同特异度的 `.HOVERPROBE` 类替代 `:hover`。这是合理的层叠等价，但反向对照暴露了它的边界（见[验证方法论](engineering-notes.md#计算样式触发不了-hover)），因此有了下一个脚本。

**`hover-check.js`** 通过 DevTools 协议**真的移动鼠标**到按钮上，再截图量字形与填充的对比度。夹具用的是**当前安装态 bundle 里逐字抄下来的上游 CSS**，覆盖三个面：设置 › 模型的 `编辑`（`_secondaryButton`，强调底落在按钮自己身上）、`添加模型提供商`（`_addButton` **及其外层 `_addActions` 包裹层**——这一条就是模型设置页那次反馈）、输入区 `+`（`_add` 钩子的真实目标，收敛作用域后必须仍在反色）。每个面在两种配色 × 两种模式下各测字形对比度；添加按钮额外断言**外层容器不得被实心强调色填充**，输入区 `+` 额外断言悬停底色**仍是实心强调色**、常态墨色在暗色下仍是强调色、亮色下**不被暗色规则上色**。反向对照：把 `client.js` 换回修复前那版，模型页两条断言在暗色下报 1.06:1 / 1.75:1 红，与反馈截图吻合。

**`verify-shots.js`** 只用 `zlib` 解码 PNG（不引依赖），按色相家族统计像素，用「黄 5.47% → 0.39%、青 0.42% → 5.40%、中性约 93% 不变」这样的数字代替「看起来像换了」。

---

## 背景纹理

```bash
node scripts/build-texture.js --check   # 内嵌块与 assets/ 的字节一致（sha256 已固化）
node test/texture.test.js               # 三档开关 + 装饰强度 + 静态性 + 降级（19 项）
```

**`build-texture.js`** 与徽标那条管线同形：三张官方素材（网格 SVG、两级波纹 PNG）以**原始字节**内嵌为 data URI，内嵌块夹在 `EDGE_TEX_BEGIN/END` 之间，**不手改产物**。头注固化官方 URL 与 sha256；上游若换图，`--check` 在构建期就红，而不是运行时静默失效。PNG 不做再压缩。

**`texture.test.js`** 守四件事：

1. **开关接线**：CSS 有三档、`TEXTURE_OPTIONS` 与之一致、`PREFS_KEY_TO_FIELD` 有映射、Host schema 有默认值、`off` 通过**移除属性**实现（与 motion 的运行时行为一致）。
2. **装饰强度**（核心）：从 stylesheet 读出 `--edge-tex-ink` 与两个 alpha，按 WCAG 公式合成到真实底面上，断言落在**装饰区间 1.06–1.60:1**——与水印、hero 光晕同一条产品规则。数值不复述，改 alpha 就是改断言输入。
3. **静态性**：纹理段没有 `transition`/`@keyframes`/`will-change`，且承载面只走 `background-*`（不改宽高/内外边距）。
4. **降级与来源**：`prefers-reduced-transparency`/`prefers-contrast` 会关掉纹理（含两个叠加层的 `display:none`）；三色信号线逐字沿用官方 `decoLine` 停靠值。
5. **内容锚定绊线**：纹理段不得出现 `[class$='_frame']` / `[class$='_sidebarCol']`（第一版挂了三个面 + `position:fixed` 叠加层 = 整窗平铺，官方做法是每层锚定内容区域）；叠加层必须 `z-index:-1`（否则画在正文上面）。另：三档按**值**匹配，属性残留 `'off'` 不会画。

反向对照：把网格 alpha 从 5% 提到 25% → 断言必须变红（实测亮色 1.69:1、1.71:1，超出 1.6 上限）。

---

## 按钮动效

```bash
node test/motion-check.js            # 真实浏览器 + 真实指针，验证 D/E/F 三套动效（24 项）
node test/perf-motion.test.js        # 量「流畅」：静态守卫 + layout/帧间隔/主线程 + 停留不做事
```

**`motion-check.js`** 把 `client.js` 里那一整条 `insertCss()` 模板字符串抽出来注入一张夹具页，再用 DevTools 协议的 `Input.dispatchMouseEvent` **真的把鼠标移到按钮上并按下**，然后读计算样式、必要时**解码截图数像素**。它守的是「选择器写了但没生效」这一类静默失败：

- 属性钩子：`data-endfield-motion` 是 `<body>` 上的一个值，写错值等于整套规则不存在；
- 层叠：应用自己有 `button { transition: none !important }`，主题的过渡必须赢过它；
- 伪元素生成：宿主元素不是 `position: relative` 时 `::after` 根本不生成——`clamp` 的四角角标就栽在这里，而且**遮罩图会按自身宽高比缩放**：把 24×24 的图设成 `mask-size:100% 100%`，形状会保持 1:1 居中，角标跑到按钮中间去。这条只有数像素能抓到，所以左上角 14×14 区域必须找到 ≥12 个 onpaper 色像素；
- 反面对照：`off` 后主题**什么都不剩**——运行时在 off 时是**移除 `data-endfield-motion` 属性**（不是写 `'off'`），所以连共通的 `:active` 暗一档也一起消失，测试按真实行为断言；`prefers-reduced-motion: reduce` 必须关掉位移/动画/揭示而**保留颜色反馈**——读数条钉在 6% 刻度（`transform: scaleX(.06)`），角标两个都不生成（含像素验证）。

夹具里那一条对上游的假设（目标按钮带 `position: relative`）写在文件顶部注释里；上游若改掉，测试会红，而不是假装通过。

**`perf-motion.test.js`** 回答另一个问题：这些动效**花掉多少**。它的方法是**同一次运行里的 A/B**——指针按同样的坐标、同样的节奏扫过 300 行 + 120 个按钮，唯一变量是 `<body>` 上的 `data-endfield-motion`，所以 `silent` 是同一轮里测得的地板。断言分四层：

1. **静态守卫**（无需浏览器，秒级）：动效段里**每一条 `transition` 与每个 `@keyframes`** 的属性只许是 `transform`、`opacity`、颜色，外加方案 A 的 `border-radius`（官网也动画它）。还断言没有常态 `will-change`。**它抓不到「悬停时才生成几何」这一类**（没有 transition、没有关键帧的 `position`/`border`/伪元素创建）——那一类由 layout 预算兜住，这一点写在脚本注释里，不假装守卫比它实际更宽。
2. **layout 预算**：`LayoutDuration ≤ 6ms/s`。实测五套方案 **0.00**、`meter` 2.5–4.3（准星伪元素的存在本身，逐条 bisect 过；数值随机器负载浮动，所以预算留了宽余量）。真正昂贵的写法（悬停才生成几何 = 16–29ms/s）仍然会立刻顶红。
3. **帧间隔**：页面内 `requestAnimationFrame` 采样的 p95 ≤40ms、>32ms 帧占比 ≤5%。这才是「看起来顺不顺」的判据。
4. **task 预算**：主线程 ≤350ms/s（≈每帧 ≤5.8ms，不到半帧）。**刻意用绝对值而不是「静默基线的 N 倍」**：silent 几乎什么都不做，一个每帧只花 0.15ms 的方案会被读成「基线的 6 倍」，比例在这里是误导。
5. **停留不做事**：指针停在按钮上 1.6s，layout 必须 ≤2ms/s——代价只许发生在指针**移动**时。
6. **覆盖门**：扫掠必须真的命中 row / CTA / 图标 / 普通按钮四个家族（`elementFromPoint` 采样）。这条门是补出来的——第一版夹具用 `float` 把 CTA 推到 y=8720、图标推到 y=9056，而视口只有 720px，于是六方案的 0.00ms/s **只在行与普通按钮上量过**；夹具修好后 meter 立刻量出 2.99ms/s 的真实回归（准星在悬停时才生成），修掉才回到 0.00。

脚本会把整张测量表打印出来（layout / recalc / task / 帧 p50·p95·max / >32ms 占比），并在结尾跑第二次 `silent` 检查基线漂移：只有**一个数量级**的变化才算「本轮数字不可用于评分」——`silent` 的 task 本身很小，30–50ms/s 的调度抖动就能翻倍它，用 50% 当门会假红（实测踩过）。

---

## 设置页

```bash
node test/settings-rows.test.js     # 设置面板真实渲染 + 开关联动
node test/settings-durable-hold.test.js  # 命名空间未就绪时的写入 gate + 补写（旧世代 settingsScope）
node test/settings-config-forms.test.js  # 0.1.7 的 configForms transport（entry id / volatile / 拒写补写 / 退订）
node test/settings-config-fallback.test.js # Host Config 字段契约与选择顺序（不依赖本机 schemastery）
node test/settings-namespace.test.js # 存储字段名对齐 schema + 旧拼写迁移 + 三条读/写边界
node test/settings-off.test.js      # 关闭主题后设置页仍可读
node test/settings-locale.test.js   # 跟随语言设置（zh/en 词典对齐 + 切换生效）
```

**`settings-rows.test.js`** 不用浏览器也不用 React：以**记录型 `React` / `slots` + 假的设置 transport**（`test/fixtures/settings-scope.js`）在进程内跑一次真实 `apply()`，抓下设置面板真正的元素树。设置页是用户唯一能碰到这些开关的入口，而那里的错误（抛异常、漏 key、开关写错了 DSH 设置的字段）check.js 与画布测试都看不见。

> 说明：这个插件从 **`localStorage` 迁移到了 DSH 的持久化设置服务**（见 features.md / engineering-notes.md）。因此设置类测试不再往浏览器存储里塞值，而是驱动假的 transport：除 `settings-config-forms.test.js` 之外的用例走旧世代 `ctx.settingsScope`（fixture 的 `settingsScopeStub`，在内存里扮演 `<settings.yaml>` 的命名字段节），新世代由 `configFormsStub` 扮演 `ctx.configForms`（命名空间 = profile entry id）。断言 27 行齐全且归入 5 个分组容器、key 唯一、分组标题（01 主题 / 02 背景 / 03 动画 / 04 娱乐 / 05 音频）与配色样式规则都在、配色行默认显示谷地黄且按钮提供「切换武陵青」、点击把 `palette` 写成 `wuling`、存了 `wuling` 时反向提供「切换谷地黄」并标注 `#14d0d0`、图层关闭时子开关为 disabled、开启后恢复可用，雷霆大字与大字入场动画均默认为关、说明文字包含「任务开始」/「任务完成」与 3 秒、**子开关只写自己的字段而不误写主开关的**，以及点击确实写入文档里那个 DSH 设置字段。

**`settings-durable-hold.test.js`**（旧世代 `settingsScope` 路径；0.1.7 上同一份写入 gate / 补写契约由 `settings-config-forms.test.js` 覆盖）用**两阶段假 `ctx.settingsScope`** 复现那条历史告警：宿主半部 `ctx.settings.register(...)` 尚未跑、命名空间还没进 Host 的 served 列表前，scope 快照是 `{ status:'unavailable', writable:true, mode:'host' }`——单看 `writable` 会照写不误却落不到盘。它先在未就绪态切「圆角 / 武陵青」，断言**没有任何 `scope.set` 出线**（旧 bug 会打 `commit … status= unavailable` 并静默丢脏）；随后模拟文档 committed、命名空间进入 served 列表、快照翻为 `status:'ready'`，断言订阅路径把两份 held 编辑**自动补写**进文档，且不会重复写两遍（replay 有 re-entrancy 护栏）。

**`settings-config-forms.test.js`** 守的是 0.1.7-rc.1 换掉整套 settings API 之后最容易「看起来正常、其实没保存」的几处：它用假 `configForms` 服务（fixture 的 `configFormsStub`，只有被 `serve()` 过的命名空间才报 `status:'ready'`）驱动真实 client，断言

- **两半的 entry id 一致**：`client.js` 的 `PREFS_ENTRY` == `index.js` 的 `SETTINGS_ENTRY` == `cordis.patch.yml` 里那一行的 `id`（命名空间是 entry id，任一处对不上就全程读不到）；
- **Host `Config` 真的可编辑**：27 个字段齐全、无多余字段、**每个字段都带 `.volatile()`** 且默认值等于 `FIELD_DEFAULTS`——漏一个 volatile 就是 0.1.7 版的「设置保存不了」（该断言在拿不到 schemastery 的环境里自动跳过，CI 无 DSH 时不会误报——**也正因为会跳过，它没能在唯一要紧的环境里发现问题**：本机 web profile 恰好就是「拿不到可用的 schemastery」这台机器，于是这一整段断言空跑，`Config` 缺失一路绿灯。字段契约与选择顺序现由 `settings-config-fallback.test.js` 无条件断言）；
- **被 served 的表单会被绑定并采纳**（存档里的 `palette: wuling` 直接落到 `<body>` 的 class）；
- **entry id 是探测出来的**：只 served `include:theme-endfield` 时写入也落在那个拼写上；
- **拒写与未就绪都算 held**：`set()` 解析为 `false`、或命名空间尚未 served 时，编辑不改变文档、也不假装保存；一旦拒写解除（下一次快照）或命名空间进入 served，held 编辑被自动补写；
- **memory 模式（非 loopback 页面）永不下盘**：一次写都不发生；
- **静默 ready**：命名空间开始被服务但镜像**完全不通知**任何表单时，有界 settle watch（20 × 500ms）会自己重新读取、采纳、切到被 served 的拼写并补写——这是旧世代 250 ms binder 轮询的等价安全网；
- **退订**：run 拆除时调用 `form.subscribe()` 返回的 disposer（`ConfigForm` 是 provider 拥有、跨插件共享的实例，漏掉就是给下一次 run 泄漏监听器）。

> 覆盖面说明：0.1.7 transport 由上面这个用例在**进程内**验证。三个 headless 浏览器用例（`settings-off` / `settings-buttons` / `loader-late-prefs`）注入的仍是旧世代 `settingsScope` 缝（`test/fixtures/settings-scope.browser.js`），因为它们验证的是渲染、对比度与启动动画，与 transport 是哪一代无关。

> **「设置刷新后复位」的排查顺序。** 这条症状有两个完全不同的成因，先分清再动手：
>
> 1. **Host 半没导出 `Config`** —— 用 `cordis_inspect` 的 host `Config.listConfigs`（或 `dsh` 的插件面板）看该 entry 的状态：`absent` 就是没有 Config，`schema` 才是正常。此时 DSH 根本不投影表单，client 只能停在 session-local。成因见[工程笔记](engineering-notes.md#加载期解析-schemasterydev-link-安装必须显式去找v111-起加固v112-加自检报告)：dev-link 安装下 `require('@deepseek-ai/schemastery')` 必然失败，要靠 `resolutionRoots()` 显式找回。**注意「找不到」有两种，修法不同**：候选根全都解析不到（报告里是 `error: MODULE_NOT_FOUND`），与「解析得到、require 却抛错」（报告里是 `loadError`，v1.1.5 起才有这个字段）——后者本机就是如此：唯一带 `.volatile()` 的 3.18.4 解析得到但加载失败，而能加载的两个副本都没有 `.volatile()`。自 v1.1.5 起，只要还有一个能设 `meta.volatile` 的 builder（哪怕没有 `.volatile()`，靠 `.extra('volatile', true)` 合成）就照样投影表单，见[找不到 .volatile() 也必须能存](engineering-notes.md#找不到-volatile-也必须能存v115)。
> 2. **Host 侧代码太旧**（进程里跑的还是上一次启动时 import 的模块）。**浏览器刷新只重载 `client.js`**；`index.js` 的改动必须**整进程重启 DSH** 才生效，`dsh-hmr` 不观察 `**/node_modules`。
>
> 一个能直接分辨两者的判据：构建不出 `Config` 时，`index.js` 会往 profile 目录写 `theme-endfield-diagnostic.json`（成功则自动删除）。**该文件存在**说明进程里的代码已经是新的、且**连一个能设 volatile 标记的 builder 都没拿到**（文件里有每个候选根的 `require.resolve` / `require` 结果、`schemaMode` 与 `loaderStartedAt`）；**该文件不存在而状态仍是 `absent`** 说明进程里跑的还是旧模块——重启，而不是改代码。
>
> 另有一条纯命令行的等价验证（在仓库根目录跑）：`node test/settings-config-forms.test.js` —— 它 `require` 的正是真实 `index.js`，路径解析与 Host 进程完全一致，因此它能直接回答「这台机器上 `Config` 到底能不能构建出来」（拿不到 schemastery 时该断言自动跳过并打印原因）；`node test/settings-config-fallback.test.js` 进一步**不依赖本机 schemastery**，无条件断言字段契约与选择顺序。

**`settings-namespace.test.js`** 守的是 issue #15：**存进命名空间的字段名必须与 Host schema 一致**。它不信任任何一侧的字面量，而是三份交叉验证——从 `client.js` 源码里读出的 `PREFS_KEY_TO_FIELD`、Host `index.js` 的 `FIELD_DEFAULTS`、以及设置面板**真实渲染出来的**每个开关（点击后断言出线的字段名是声明字段，且没有任何未声明字段的写入）。六条复合字段（`contourAnim` / `contourFps` / `contourSpeed` / `contourScrollPause` / `watermarkPersist` / `thunderAnim`）逐条覆盖——**只测单字段的用例抓不到这个 bug**，因为它们新旧写法恰好同名。

随后用它复现线上存档的形状（声明字段在默认值旁多出一行旧拼写键），断言这些值被搬回声明字段、且**不会**凭空给没记录过的字段写值；再断言反过来的一条：用户真的在声明字段上设过非默认值时，旧拼写的键**不得**覆盖它。

最后两条是同 issue 里的另两个发现：写入后面板必须**立刻**读到新值（不依赖宿主回相），以及命名空间未就绪时「改回默认值」的编辑不能因为「本地值等于默认」就被丢掉。

> 变异验证 7 类，全部必须报错：把 `prefsFieldOf` 改回按前缀推导（原始 bug）、表里某条映射到相邻的错字段、删掉迁移、让迁移覆盖用户设过的值、`prefsSet` 不再叠加本地值（旧读序）、脏标记在「等于宿主值」时直接清、脏标记在「等于默认值」时直接清。

**`settings-off.test.js`** 守的是设置页自己最脆弱的时刻：**开关按钮的强调色底来自主题样式表，而样式表随主题关闭被移除**。它在真实浏览器里加载真实 `client.js`，以应用**自己的默认令牌**（亮 / 暗两套）把主题关掉，用 `slots` 桩抓出真实元素树并物化成 DOM，然后断言每个按钮的合成对比度 ≥ 4.5。

> 这个测试抓到过真 bug：修复前暗色模式下「切换武陵青」与「切为静态」两个常亮按钮是 `#000` 落在透明底上、对深色面板仅约 1.1:1，修复后全部 ≥ 11.5:1。

**`settings-locale.test.js`** 配一个按运行时契约造形的假 `locale` 服务（`register(ns, dicts)` / `bind(ns)`，含 `active → en → 键名` 的查找链，并**复现真实服务对重复 `(ns, locale)` 的抛错**）。覆盖：注册了自己的命名空间；**en 与 zh 键集完全一致**、无空译文、且两种语言实质不同（防止「翻译」其实是复制）；注册声明了 `locale:`、`label` 是 thunk 且随语言变化；zh 渲染为中文而 **en 渲染无任何残留中文与中日韩标点**；未知语言回退到 en 而不漏键名；词典只注册一次、可随 `ctx.effect` 注销并重新注册；以及**完全没有 locale 服务时页面照常渲染为中文、且不声明 `locale:`**。

---

## 启动加载屏

```bash
node test/loader-performance.test.js   # 启动窗口内的开销与几何
node test/loader-late-prefs.test.js    # 设置节晚于 apply() 到达时，动画还播不播
```

**`loader-late-prefs.test.js`** 守的是「开关明明写着开，启动动画却再也不出现」。加载屏在 `apply()` 里**同步读一次** `loader` 就决定播不播，而真实页面上设置节是**走线上拉的**：`settingsScope` 快照此刻还是 `{ status:'loading', value: undefined }`（见 `dsh-client-ui-settings` 的 `SettingsScopeSnapshot` 契约），于是这次读落到 schema 默认值 `'0'`——默认关——加载屏永远不播；而 `reconcileFromPrefs` 又**刻意不重放**启动屏（它是「每次页面加载只播一次」的片子），所以它再没有第二次机会。

这正是它比别的开关更脆的地方：其余每个由偏好驱动的表面都会在稍后的 ready 转变里重新推导（`mount` / `syncContour` / `syncThunder` / 圆角 / 配色…），**只有加载屏那次读取无从恢复**。修复由存储层的**首次权威节**（`prefsMarkSettled` → `onPrefsSettled`）回调启动屏，并仍然只播一次。

测试给 `__endfieldSettingsScope(initial, { readyDelayMs })` 传延迟，让假 scope 先答 `loading` 再翻 `ready`，三个场景各起一页真实浏览器（真实 `apply()` + 真实 DOM，轮询整个片子生命周期）：

- **A** 存 `loader:"1"`、节迟到 250ms —— 片子必须真的播出来（**这就是原 bug**）；
- **B** 存 `"0"` —— 不得播；
- **C** 首个节是 `"0"`、之后运行期改成 `"1"` —— 不得重放（每次页面加载只播一次的契约）。

> 变异验证 2 类，都必须报错：删掉订阅里的首次节回调（回到原 bug，A 立刻红）、去掉 `prefsSettledOnce` 一次性护栏（运行期改动会重放，C 立刻红）。

---

## 雷霆大字

```bash
node test/thunder-edges.test.js     # 边沿/生命周期/样式契约
node test/thunder-shot.js           # 真实渲染截图 + 像素对比度断言
node test/thunder-dismiss.test.js   # 点击关闭：真实指针事件 + 命中测试 + 监听器核账
```

**`thunder-edges.test.js`** 在进程内跑真实 `client.js`，配一个按运行时契约造形的假 `sessions` 服务和一个**可控时钟**，因此 3 秒窗口是被断言的而不是被等待的。覆盖：关闭时**不订阅**（零开销）；`false→true` 播「任务开始」、`true→false` 播「任务完成」；**同值连续推送 25 次不重复播报**；2999ms 仍在、3000ms 已隐藏；入场动画默认关闭时大字带静态标记、开启后不带，且两种状态下 3 秒时长都不变；系统「减少动态效果」压过已开启的动画开关；切进已在运行的会话不误报、但其结束仍播报；离开的会话被退订；关闭主题会移除大字并退订、重新开启会恢复；**服务迟到后仍能自动接上**；`ctx.effect` 拆除时释放全部订阅与节点。

另有 14 条**样式契约**断言（固定定位、居中、`pointer-events: none`、`font-weight: 900`、`clamp()` 字号、白色字面量、层级低于加载屏、`prefers-reduced-motion`、静态分支取消动画并强制 `opacity: 1`）——这些是本机无布局引擎时看不见、却最容易被后续重构悄悄改掉的视觉事实。

> 变异验证共 19 类：默认改成 opt-out、边沿退化成电平、去掉基线、时长改成 5s、两个词对调、不自动隐藏、去掉 `aria-hidden`、切换会话不退订、拆除不退订、白色换成令牌、粗体改成 400、层级盖过加载屏、服务缓存不重试、动画默认改成 opt-out、静态标记永不打 / 永远打、系统偏好不再覆盖、子开关误写主开关的键、子开关未禁用、静态分支丢掉 `opacity: 1`。

**`thunder-shot.js`** 补的是结构断言看不见的那一半：**像素**。它在真实浏览器里跑真实 `client.js`，通过主题自己的订阅路径触发播报，输出亮 / 暗 × 开始 / 完成共四张截图，然后解码 PNG 并断言：中央带的近白像素占比（字形确实出现）、压暗底确实压暗（亮色）或仍为近黑（暗色）、以及白字对压暗后表面的**合成对比度 ≥ 3**。

**`thunder-dismiss.test.js`** 守「点击任意处立即关闭」——这条只能在真实浏览器里验，因为它本质是个**命中测试**问题。18 条断言覆盖：大字在屏幕上时空白处与被覆盖按钮的顶层元素**仍是页面自己的元素**；点空白处大字立即消失且**这一次点击照常抵达**；点真实按钮则**既关掉大字又触发按钮**；控件调 `stopPropagation` 时仍能关闭（捕获阶段）而该控件自己的处理器照常收到事件；关闭后再点不报错、大字不复活；提前关闭会取消 3 秒定时器；以及**监听器收支平衡**——显示中恰好持有 1 个，关闭后归零。

> 变异验证 6 种写错的实现：不挂监听、**挂在遮罩上（点击黑洞）**、不摘监听、不取消定时器、用冒泡阶段、用 `click` 代替 `pointerdown`。

---


## 字体作用域

```bash
node test/font-scope.test.js   # 第三方挂件字体 + 主题自有表面字体，同一页一次跑完
```

主题曾经在自己的样式表里声明应用的 UI 根字体令牌（`--dsw-font-family`），连带把 `font-feature-settings` / `font-variant-ligatures` 挂在 `body` 上。三项都会**继承**进注入到应用根节点的第三方挂件——挂件写着 `font-family:inherit`，于是它的余额数字被换成主题的 Arial。详见[字体令牌是应用的公共接口](engineering-notes.md#字体令牌是应用的公共接口不是主题的开关)。

这个脚本把**三类节点放在同一页**：应用自己的 `:root` 字体令牌声明（照抄安装态 bundle）、一个注入应用根节点的 `font-family:inherit` 挂件、以及主题的全部自有表面（启动加载屏、水印字标；设置面板根由源码断言其带 `.endfield-settings` 类并有对应规则）。断言：

- 根令牌与 `body` 解析值**与应用声明逐字相同**（`--dsw-font-family` / `--ds-font-family-code` 都没被改写）；
- 挂件与其数字拿回**应用字体栈**，且 `font-feature-settings` / `font-variant-ligatures` 为 `normal`；
- 加载屏与水印**仍在主题字体**（Arial）上，并各自带着 `tnum` + `ss01`（这两条属性已从 `body` 下移到元素自身，必须跟进）。

> 变异验证：把旧的 `:root { --dsw-font-family: Arial… }` 注回去，本脚本报「挂件字体被主题偷走」（4 条红），`check.js` 同时报「令牌被主题声明」，`selftest.js` 也有一条对应注入用例。

---

## 水印层叠

```bash
node test/watermark-stacking.test.js
```

四条结论都做了反向对照（故意改坏必须报错）：改回 `z-index:1` → 报 9945 px 越界；深色 alpha 调回 `0.16` → 报 1.558:1 过强；alpha 降到 `0.004` → 同时报「不可见」与「低于感知下限」。

这个测试的两个方法论坑（不能用命中测试判断 `pointer-events:none` 的层叠、两版渲染必须只差 alpha）见[验证方法论](engineering-notes.md#命中测试判断不了-pointer-events-none-的层叠)。

---

## 新建会话页标识

```bash
node test/hero-logo.test.js
```

跑两个世代的应用骨架（0.2.0-rc.2 的 `*_headline` 行与 0.1.x 的 `*_headlineText`）× 亮暗两套方案，共五张真实渲染截图 + 一组断言：

- **几何**：标识矩形必须**在标题行上方**（用真实 rect 量间距，不是只看 DOM 顺序）、水平居中、保持 1024:458 比例，且两个掩码层**正好填满**元素盒子（`contain` 一旦被拉伸或letterbox，这里就会红）；
- **锚点**：节点必须是标题元素的前一个兄弟——两代骨架各跑一遍，因为只对一代有效的选择器在另一代上会静默什么都不做；
- **配色**：脚本自己解码 `assets/hero-logo-3-summer.png`（纯 `zlib`，无依赖），取出它的三色，再和**真实启动的页面**上的计算值逐一比对——亮暗两套都必须画的就是素材原色。这是**品牌保真**断言而不是对比度门槛：logotype 豁免 WCAG 对比度，亮色的低比值（1.07 / 1.17 / 1.22:1）只打印备查；它抓的是「颜色悄悄漂成了某个自造值」或「某个方案偷偷留了覆盖」；
- **不该出现的页面**：对话页（`data-phase=active`）不得注入。

> 变异验证：给亮色块加回一个覆盖（`--edge-hero-logo-ink: #101110`）→ 亮色两条「画的是素材原色」断言红；把注入锚点改成 `*_headlineText` 单一选择器 → 0.2.0-rc.2 那条夹具红（找不到锚点、不注入）。

---

## 截图辅助

```bash
npm run shots          # 输出亮/暗 × 两配色共四张截图
npm run shots:verify   # 上面 + 解码统计强调色像素
```

这两个不是断言，是给肉眼复核用的。数值化的那一半在 `verify-shots.js` 里。

> **夹具必须照抄真实骨架，不能照抄选择器。** 头部夹具曾经把预设徽章直接挂在 `.wSkVaW_header` 下——那恰好就是主题当时选择器假设的形状，于是截图看着一切正常，而真实 0.1.5-rc.2 早已把徽章放到三层之下（`_titleRow > _titleCluster > _headerActions`），主题那条选择器在真实页面上一个元素都没匹配到。**当夹具是为了让选择器通过而搭出来的，它就从验证退化成了同义反复。** 改动头部 / 侧栏等夹具结构时，请对着 `@deepseek-ai/dsh-client-ui-*` 的真实渲染代码核一遍。
