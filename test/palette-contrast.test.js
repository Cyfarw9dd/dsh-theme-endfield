/**
 * palette-contrast.test.js — the accent palette must be MEASURED, not picked.
 *
 * This theme has one rule about colour (see README): every accent role is checked
 * against the surfaces it actually lands on, because two of the three historical
 * colour bugs in this repo were "the text is the same colour as the thing behind
 * it" — invisible chips and a 1.02:1 turn-status label. Adding a second palette
 * (武陵青 / #14d0d0) doubles every one of those surfaces, so the check is
 * mechanical rather than a promise.
 *
 * It reads the REAL values out of client.js (the palette blocks) instead of
 * restating them, so a future edit to the stylesheet is what this test sees.
 * Restating them would only test the copy.
 *
 * Usage: node test/palette-contrast.test.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const src = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')

let failures = 0
const fail = (m) => { console.error('FAIL  ' + m); failures++ }
const pass = (m) => console.log('ok    ' + m)

/* ---------- colour maths (sRGB, WCAG 2.x) ---------- */
const hex = (h) => {
  const s = h.trim().replace('#', '')
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}
const lin = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
const ratio = (a, b) => {
  const la = lum(a), lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
/** Composite `fg` at `alpha` over opaque `bg` (what a translucent wash really shows). */
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha))

/* ---------- surfaces this theme actually paints on ---------- */
const LIGHT_BGS = { 'bg-base': hex('#e8e8e2'), 'bg-layer-1': hex('#f2f2ec') }
const DARK_BGS = { 'bg-base': hex('#101110'), 'bg-layer-1': hex('#181a18') }
const INK = hex('#101110')

/* ---------- pull the palette definitions out of the real stylesheet ---------- */
/** Read one custom property from a specific CSS block in client.js. */
const blockOf = (selector) => {
  const i = src.indexOf(selector + ' {')
  if (i < 0) return null
  const j = src.indexOf('}', i)
  return j < 0 ? null : src.slice(i, j)
}
const varIn = (block, name) => {
  if (block === null) return null
  const m = block.match(new RegExp('\\n\\s*' + name + '\\s*:\\s*([^;]+);'))
  return m ? m[1].trim() : null
}

const YELLOW_VALLEY_SEL = 'body'   // 谷地黄 lives on plain body (the CSS base block)
const CYAN_SEL = 'body.theme-endfield-wuling'
const GRAY_SEL = 'body.theme-endfield-gray'
const GRAY_DARK_SEL = 'body.theme-endfield-gray[data-ds-dark-theme]'

/* The default-palette block is the one that DEFINES --edge-accent (plain `body {`
   appears many times in this stylesheet, so find the right occurrence). */
const defaultBlock = (() => {
  let from = 0
  for (;;) {
    const i = src.indexOf('\n      body {', from)
    if (i < 0) return null
    const j = src.indexOf('}', i)
    const b = src.slice(i, j)
    if (/--edge-accent\s*:/.test(b)) return b
    from = i + 1
  }
})()
const cyanBlock = blockOf('      ' + CYAN_SEL)
const grayBlock = blockOf('      ' + GRAY_SEL)
const grayDarkBlock = blockOf('      ' + GRAY_DARK_SEL)

if (defaultBlock === null) { fail('no body block defines --edge-accent (谷地黄 palette missing)'); }
if (cyanBlock === null) { fail('no ' + CYAN_SEL + ' block found (武陵青 palette missing)'); }
if (grayBlock === null) { fail('no ' + GRAY_SEL + ' block found (终末地灰 palette missing)'); }
if (grayDarkBlock === null) { fail('no ' + GRAY_DARK_SEL + ' block found (终末地灰 dark flip missing)'); }
if (failures) { console.error('\n' + failures + ' palette check(s) failed'); process.exit(1) }

const palettes = {
  '谷地黄': defaultBlock,
  '武陵青': cyanBlock,
}
/* 终末地灰 pairs its fills with --edge-accent-ink rather than fixed ink, and the
   pairing flips per scheme, so it gets its own sections further down. */

/* ---------- 1. accent used as a SOLID FILL under ink text ----------
   Rows, badges, the new-session button, approval chips and ::selection all paint
   the accent as a background with #101110 / #000 on top. That pairing is the most
   reused one in the theme, so it must clear AA on its own. */
for (const [name, block] of Object.entries(palettes)) {
  const accent = varIn(block, '--edge-accent')
  if (accent === null) { fail(name + ': --edge-accent is not defined'); continue }
  const r = ratio(INK, hex(accent))
  if (r >= 4.5) pass(name + ' 实心强调色底 + 墨色字：' + r.toFixed(2) + ':1 (AA)')
  else fail(name + ' ink-on-accent is only ' + r.toFixed(2) + ':1 — chips/rows become illegible')

  // The hover variant carries the same text, so it needs the same guarantee.
  const deep = varIn(block, '--edge-accent-deep')
  if (deep === null) { fail(name + ': --edge-accent-deep is not defined'); continue }
  const rd = ratio(INK, hex(deep))
  if (rd >= 4.5) pass(name + ' 悬停加深底 + 墨色字：' + rd.toFixed(2) + ':1 (AA)')
  else fail(name + ' ink-on-accent-deep is only ' + rd.toFixed(2) + ':1')
}

/* ---------- 2. turn-status gradient text ("Deep diving...") ----------
   Gradient text: EVERY stop paints glyphs, and under prefers-reduced-motion the
   mid stop is pinned inside the letters permanently, so both stops must clear AA
   against both backgrounds of their mode. This is the exact bug that made the
   label 1.02:1 with signal yellow. */
const gradientRoles = [
  ['--edge-status-light', LIGHT_BGS, '亮色主色'],
  ['--edge-status-light-mid', LIGHT_BGS, '亮色亮带'],
  ['--edge-status-dark', DARK_BGS, '暗色主色'],
  ['--edge-status-dark-mid', DARK_BGS, '暗色亮带'],
]
for (const [name, block] of Object.entries(palettes)) {
  for (const [v, bgs, label] of gradientRoles) {
    const val = varIn(block, v)
    if (val === null) { fail(name + ': ' + v + ' is not defined'); continue }
    let worst = Infinity
    let worstBg = ''
    for (const [bgName, bg] of Object.entries(bgs)) {
      const r = ratio(hex(val), bg)
      if (r < worst) { worst = r; worstBg = bgName }
    }
    if (worst >= 4.5) pass(name + ' 回合状态 ' + label + ' ' + val + '：最差 ' + worst.toFixed(2) + ':1 vs ' + worstBg + ' (AA)')
    else fail(name + ' turn-status ' + label + ' ' + val + ' is ' + worst.toFixed(2) + ':1 vs ' + worstBg + ' — fails AA (gradient text paints glyphs with every stop)')
  }
}

/* ---------- 3. accent as ICON/TEXT ink in dark mode ----------
   Dark mode paints the accent as foreground on icon buttons and links, so it is
   real text contrast, not decoration. 3:1 is the floor for large glyph/icon ink. */
for (const [name, block] of Object.entries(palettes)) {
  const accent = varIn(block, '--edge-accent')
  if (accent === null) continue
  let worst = Infinity
  for (const bg of Object.values(DARK_BGS)) worst = Math.min(worst, ratio(hex(accent), bg))
  if (worst >= 3) pass(name + ' 暗色图标/链接强调色：' + worst.toFixed(2) + ':1 (>=3 非文本/大字号下限)')
  else fail(name + ' accent-as-ink in dark mode is only ' + worst.toFixed(2) + ':1')
}

/* ---------- 5. hero glow depth ----------
   The glow replaces the app's own #6187D8 at 8%. The README's rule is that the
   replacement must not make the hero read LOUDER than the glow it replaces,
   measured as the luminance shift of the composited ellipse core against the page.

   The bound is deliberately ONE-SIDED, and getting this wrong is instructive: a
   symmetric "within N of the blue" bar fails the SHIPPED yellow light value, which
   sits at ΔY -0.17 against the blue's -7.90. That is not a defect — on cream,
   yellow is almost luminance-neutral and shifts chroma instead (blue channel -18),
   which the README records as "a warm breath on the paper rather than the blue's
   grey-blue darkening — gentler than what it replaces, not louder". Quieter than
   the original is always acceptable; louder is the regression worth catching. */
const glowAlpha = (block, name) => {
  const v = varIn(block, name)
  return v === null ? null : Number(v)
}
const yShift = (fg, bg, a) => {
  const c = over(fg, bg, a)
  const Y = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
  return Y(c) - Y(bg)
}
const BLUE = hex('#6187D8')
for (const [name, block] of Object.entries(palettes)) {
  const accent = varIn(block, '--edge-accent')
  if (accent === null) continue
  for (const [mode, bg] of [['light', LIGHT_BGS['bg-base']], ['dark', DARK_BGS['bg-base']]]) {
    const a = glowAlpha(block, '--edge-glow-' + mode)
    if (a === null) { fail(name + ': --edge-glow-' + mode + ' is not defined'); continue }
    const mine = Math.abs(yShift(hex(accent), bg, a))
    const blue = Math.abs(yShift(BLUE, bg, 0.08))
    // 2 Y of headroom over the original: below the ~3 Y level where a change in
    // hero depth becomes noticeable side by side.
    const budget = blue + 2
    if (mine <= budget) {
      pass(name + ' hero 光晕 ' + mode + ' α=' + a + '：|ΔY| ' + mine.toFixed(2)
        + ' <= ' + budget.toFixed(2) + '（原品牌蓝 ' + blue.toFixed(2) + '）')
    } else {
      fail(name + ' hero glow ' + mode + ' |ΔY| ' + mine.toFixed(2)
        + ' exceeds the ' + budget.toFixed(2) + ' budget set by the blue it replaces ('
        + blue.toFixed(2) + ') — the hero reads louder than stock')
    }
  }
}

/* ---------- 6. the two palettes must actually differ ---------- */
const ay = varIn(palettes['谷地黄'], '--edge-accent')
const ac = varIn(palettes['武陵青'], '--edge-accent')
if (ay !== null && ac !== null) {
  if (ay.toLowerCase() !== ac.toLowerCase()) pass('两套配色的强调色不同：' + ay + ' / ' + ac)
  else fail('both palettes define the same --edge-accent — the switch would do nothing')
}
/* Every accent value in this package is written as HEX, so assert the notation as
   well as the colour. The first version carried the accent in two notations (hex in
   CSS, rgb() in the settings row and the canvas strokes), which is exactly how two
   spellings of one colour drift apart. */
if (ac !== null && /^#[0-9a-f]{6}$/i.test(ac)) pass('武陵青 强调色为 6 位十六进制：' + ac)
else fail('武陵青 --edge-accent should be a 6-digit hex value, got ' + ac)

/* ---------- 7. 武陵青 must be BRIGHT enough to partner the signal yellow ----------
   The reported defect was that the first cyan read as too dark beside the yellow it
   alternates with. That is measurable rather than a matter of taste: relative
   luminance was 31.7% against the yellow's 86.6%, so the chip carried about a third
   of the presence on a near-black page.
   The floor is set at 45% — comfortably above the 31.7% that was rejected, and
   below the ~56% where the light-mode chip stops separating from cream. */
const relLum = (h) => lum(hex(h)) * 100
if (ac !== null) {
  const yl = relLum(ay), cl = relLum(ac)
  if (cl >= 45) pass('武陵青 相对亮度 ' + cl.toFixed(1) + '%（下限 45%，谷地黄 ' + yl.toFixed(1) + '%）')
  else fail('武陵青 relative luminance is only ' + cl.toFixed(1) + '% — reads dark next to 谷地黄 ' + yl.toFixed(1) + '%')
  /* Upper guard: past ~56% the chip stops separating from cream in light mode, and
     the hue desaturates toward white — it stops looking like 武陵青 at all. */
  if (cl <= 56) pass('武陵青 未过亮（上限 56%，亮色模式仍与纸底可分辨）')
  else fail('武陵青 relative luminance ' + cl.toFixed(1) + '% is too pale — the light-mode chip vanishes into cream')
  // Hue integrity: this must remain a teal, not drift to grey-cyan or white.
  const [r, g, b] = hex(ac)
  if (g === b && r < g * 0.5) pass('武陵青 仍在青碧色轴上（R 低、G=B）：' + [r, g, b].join(', '))
  else fail('武陵青 ' + ac + ' has drifted off the teal axis (expect low R, G == B)')
}

/* ---------- 8. 终末地灰: fills pair with --edge-accent-ink per scheme ----------
   The bright palettes carry ink text on their accents, so section 1 tests them
   with fixed INK. The gray palette's dark fill needs WHITE, which is why the
   pairing travels as --edge-accent-ink; both schemes' pairings must clear AA. */
{
  for (const [label, block] of [['终末地灰·亮', grayBlock], ['终末地灰·暗', grayDarkBlock]]) {
    const ink = varIn(block, '--edge-accent-ink')
    const accent = varIn(block, '--edge-accent')
    const deep = varIn(block, '--edge-accent-deep')
    if (ink === null || accent === null || deep === null) {
      fail(label + ': accent/accent-ink/deep must all be defined'); continue
    }
    const r = ratio(hex(ink), hex(accent))
    if (r >= 4.5) pass(label + ' 实心强调底 + accent-ink 字：' + r.toFixed(2) + ':1 (AA)')
    else fail(label + ' accent-ink on accent is only ' + r.toFixed(2) + ':1')
    const rd = ratio(hex(ink), hex(deep))
    if (rd >= 4.5) pass(label + ' 悬停加深底 + accent-ink 字：' + rd.toFixed(2) + ':1 (AA)')
    else fail(label + ' accent-ink on accent-deep is only ' + rd.toFixed(2) + ':1')
  }
  /* The gradient stops are declared once on the gray base block; still AA. */
  for (const [v, bgs, label] of gradientRoles) {
    const val = varIn(grayBlock, v)
    if (val === null) { fail('终末地灰: ' + v + ' is not defined'); continue }
    let worst = Infinity, worstBg = ''
    for (const [bgName, bg] of Object.entries(bgs)) {
      const r = ratio(hex(val), bg)
      if (r < worst) { worst = r; worstBg = bgName }
    }
    if (worst >= 4.5) pass('终末地灰 回合状态 ' + label + ' ' + val + '：最差 ' + worst.toFixed(2) + ':1 vs ' + worstBg + ' (AA)')
    else fail('终末地灰 turn-status ' + label + ' is ' + worst.toFixed(2) + ':1 vs ' + worstBg)
  }
  /* Icon floor: the dark accent is the caret / focus-ring / scrollbar ink. */
  const gAccent = varIn(grayDarkBlock, '--edge-accent')
  if (gAccent !== null) {
    let worst = Infinity
    for (const bg of Object.values(DARK_BGS)) worst = Math.min(worst, ratio(hex(gAccent), bg))
    if (worst >= 3) pass('终末地灰 暗色图标/焦点环强调色：' + worst.toFixed(2) + ':1 (>=3 非文本下限)')
    else fail('终末地灰 accent-as-ink in dark mode is only ' + worst.toFixed(2) + ':1')
  }
}

/* ---------- 10. 终末地灰 hero glow: the one-sided budget, per-scheme accent ---------- */
{
  /* The glow alphas live on the gray BASE block: the dark override only flips
     the fill roles, and the cascade still resolves glow from the base. */
  for (const [mode, accent] of [['light', varIn(grayBlock, '--edge-accent')], ['dark', varIn(grayDarkBlock, '--edge-accent')]]) {
    if (accent === null) { fail('终末地灰: no accent for the ' + mode + ' glow check'); continue }
    const a = glowAlpha(grayBlock, '--edge-glow-' + mode)
    if (a === null) { fail('终末地灰: --edge-glow-' + mode + ' is not defined'); continue }
    const bg = mode === 'light' ? LIGHT_BGS['bg-base'] : DARK_BGS['bg-base']
    const mine = Math.abs(yShift(hex(accent), bg, a))
    const blue = Math.abs(yShift(BLUE, bg, 0.08))
    if (mine <= blue + 2) pass('终末地灰 hero 光晕 ' + mode + ' α=' + a + '：|ΔY| ' + mine.toFixed(2) + ' <= ' + (blue + 2).toFixed(2))
    else fail('终末地灰 hero glow ' + mode + ' |ΔY| ' + mine.toFixed(2) + ' exceeds the blue budget')
  }
}

/* ---------- 12. the signal arrow vs the FILL it is drawn on ----------
   The merged motion design slides an accent-ink arrow into the new-session CTA,
   whose own fill IS --edge-accent (hover --edge-accent-deep). The arrow is
   therefore a graphic ON a solid accent surface, and it must be checked THERE.
   (This section originally guarded the meter readout bar — same surface, same
   token, and the same two invisible versions shipped first: --edge-accent at
   1.00:1, then --edge-accent-onpaper, which EQUALS the accent in both bright
   palettes (1.00-1.51:1). The lesson carries over verbatim.)
   Its first version used --edge-accent (1.00:1 at rest — literally invisible) and
   the second used --edge-accent-onpaper, which is EQUAL to the accent in both
   bright palettes (1.00-1.51:1). The role that actually pairs with an accent fill
   everywhere in this theme is --edge-accent-ink, so that is what the CSS uses and
   what this section checks. Non-text UI graphics need 3:1 (WCAG 1.4.11).
   Nothing here covered either candidate token before, which is exactly why two
   invisible-bar versions could ship. */
for (const [name, block] of Object.entries(palettes)) {
  const ink = varIn(block, '--edge-accent-ink')
  const accent = varIn(block, '--edge-accent')
  const deep = varIn(block, '--edge-accent-deep')
  if (ink === null) { fail(name + ': --edge-accent-ink is not defined'); continue }
  for (const [label, fill] of [['强调实心底', accent], ['悬停加深底', deep]]) {
    if (fill === null) { fail(name + ': ' + label + ' 未定义'); continue }
    const r = ratio(hex(ink), hex(fill))
    if (r >= 3) pass(name + ' 信号箭头(accent-ink) / ' + label + '：' + r.toFixed(2) + ':1 (>=3 非文本下限)')
    else fail(name + ' signal arrow on ' + label + ' is only ' + r.toFixed(2) + ':1 — the bar disappears')
  }
}
/* 终末地灰 owns both schemes: its ink flips (dark on the light fill, white on the
   dark one), so the pairing is checked against each scheme's own block. */
{
  const darkGray = grayDarkBlock || grayBlock
  const pairs = [
    [varIn(grayBlock, '--edge-accent-ink'), varIn(grayBlock, '--edge-accent'), '亮色'],
    [varIn(grayBlock, '--edge-accent-ink'), varIn(grayBlock, '--edge-accent-deep'), '亮色加深'],
    [varIn(darkGray, '--edge-accent-ink'), varIn(darkGray, '--edge-accent'), '暗色'],
    [varIn(darkGray, '--edge-accent-ink'), varIn(darkGray, '--edge-accent-deep'), '暗色加深'],
  ]
  let worst = Infinity
  for (const [ink, fill, label] of pairs) {
    if (ink === null || fill === null) { fail('终末地灰 ' + label + ' 的 accent-ink / 填充未定义'); continue }
    const r = ratio(hex(ink), hex(fill))
    worst = Math.min(worst, r)
  }
  if (worst >= 3) pass('终末地灰 信号箭头(accent-ink) / 两模式强调底：最差 ' + worst.toFixed(2) + ':1 (>=3)')
  else fail('终末地灰 signal arrow contrast is only ' + worst.toFixed(2) + ':1')
}

/* ---------- 13. the 划词灰 pair and its three 2026-10 applications ----------
   The model-menu / permission current rows and the composer + hover paint with
   the ::selection pair (--edge-select-fill / --edge-select-ink). The VALUES are
   the scheme-gray declared on the plain body blocks (this test reads them from
   client.js, never restating a hex); what this section adds is (a) the pair's
   contrast in both schemes, and (b) the guarantee that all three applications
   actually reference those tokens — a hardcoded #d9d9d9 would pass (a) and still
   break the dark scheme, which is exactly the class of drift (a) alone cannot
   see. */
{
  /* The pair is SCHEME-only (declared on plain body / body[data-ds-dark-theme],
     never per palette — see the ::selection block in client.js), so read the two
     scheme blocks the same way defaultBlock is found. */
  const schemeBlock = (dark) => {
    const needle = dark ? '\n      body[data-ds-dark-theme] {' : '\n      body {'
    let from = 0
    for (;;) {
      const i = src.indexOf(needle, from)
      if (i < 0) return null
      const b = src.slice(i, src.indexOf('}', i))
      if (b.includes('--edge-select-fill')) return b
      from = i + 1
    }
  }
  for (const [blk, label] of [[schemeBlock(false), '亮色'], [schemeBlock(true), '暗色']]) {
    if (blk === null) { fail('划词灰 ' + label + '：选择令牌块未找到'); continue }
    const fill = varIn(blk, '--edge-select-fill')
    const ink = varIn(blk, '--edge-select-ink')
    if (fill === null || ink === null) { fail('划词灰 ' + label + '：fill/ink 未定义'); continue }
    const r = ratio(hex(ink), hex(fill))
    if (r >= 4.5) pass('划词灰 ' + label + ' 选择底 + 选择墨：' + r.toFixed(2) + ':1 (AA)')
    else fail('划词灰 ' + label + ' pair is only ' + r.toFixed(2) + ':1')
  }
  const hooks = [
    ["[role='menuitemradio'][aria-checked='true']", '模型菜单当前项'],
    ["[role='menuitem'][class*='_selected']:has([class$='_optionLabel'])", '权限弹层当前项'],
  ]
  for (const [needle, name] of hooks) {
    /* The explanatory COMMENT names these selectors verbatim, so indexOf alone
       would read the comment. Walk every occurrence and take the one that is a
       RULE: followed by a declaration block within 600 chars (the model-menu
       selector list carries the settings-dropdown :not() carve-out). */
    let i = -1, body = ''
    for (let at = src.indexOf(needle); at >= 0; at = src.indexOf(needle, at + 1)) {
      const candidate = src.slice(at, at + 600)
      if (candidate.includes('background-color')) { i = at; body = candidate; break }
    }
    if (i < 0) { fail('划词灰 · ' + name + ' 的规则不在样式表里'); continue }
    if (body.includes('var(--edge-select-fill') && body.includes('var(--edge-select-ink')) {
      pass('划词灰 · ' + name + ' 引用的是 --edge-select-* 令牌（非硬编码）')
    } else {
      fail('划词灰 · ' + name + ' 未引用选择令牌  [' + body.slice(0, 80) + ']')
    }
  }
  const addIdx = src.indexOf("[class*='_add']:hover:not(:disabled)")
  if (addIdx >= 0) {
    const addBody = src.slice(addIdx, addIdx + 400)
    if (addBody.includes('var(--edge-select-fill') && addBody.includes('var(--edge-select-ink')) {
      pass('划词灰 · 添加按钮悬停引用的是 --edge-select-* 令牌（非硬编码）')
    } else {
      fail('划词灰 · 添加按钮悬停未引用选择令牌  [' + addBody.slice(0, 80) + ']')
    }
  } else {
    fail('划词灰 · 添加按钮悬停规则缺失')
  }
  /* the dark full-inversion rule must carve BOTH surfaces out, or it would
     repaint them solid accent in dark with !important and win the cascade. */
  const darkRule = src.indexOf("[class*='selected' i]:not([class*='unselected' i])")
  if (darkRule >= 0 && src.slice(darkRule, darkRule + 300).includes(":not([role='menuitemradio']):not([role='menuitem']:has([class$='_optionLabel']))")) {
    pass('划词灰 · 暗色「选中行反转」规则已为两处菜单面开洞（不会盖回强调黄）')
  } else {
    fail('划词灰 · 暗色反转规则未开洞，暗色下两处菜单仍会被涂成强调黄')
  }
}

/* ---------- 10b. settings dropdown: the official filter-dropdown plate ----------
   The control copies the official /operator Dropdown: a FIXED dark plate with
   white text, and a hatched gray selected row with white text — the same in
   both schemes and every palette. The official selected gray #8f8f8f only gives
   white text ~3.2:1, so the row was lowered to this theme's dark selection gray;
   these lines prove every text/fill pair the control paints clears AA, reading
   the values out of the real rules. */
{
  const flat = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*/g, ' ')
  const ruleOf = (sel) => {
    const m = new RegExp(sel.replace(/[.[\]'()]/g, (c) => '\\' + c) + '\\s*\\{([^}]*)\\}').exec(flat)
    return m ? m[1] : null
  }
  const decl = (body, prop) => {
    if (body === null) return null
    const m = new RegExp('(?:^|;)\\s*' + prop + ':\\s*(#[0-9a-f]{6})\\s*(?:;|$)', 'i').exec(body)
    return m ? m[1] : null
  }
  const trig = ruleOf('.endfield-select-trigger')
  const hover = ruleOf('.endfield-select-trigger:hover:not(:disabled)')
  const optBg = ruleOf('.endfield-select-option-bg')
  const selected = ruleOf(".endfield-select-option[aria-checked='true']")
  /* the hatch stripe colour: the stop written as "<c> 0, <c> <pos>%" */
  const stripe = optBg === null ? null : ((/(#[0-9a-f]{6}) 0, \1 [\d.]+%/i.exec(optBg) || [])[1] || null)
  const pairs = [
    ['铭牌白字 / 铭牌底', decl(trig, 'color'), decl(trig, 'background-color')],
    ['铭牌白字 / 悬停底', decl(trig, 'color'), decl(hover, 'background-color')],
    ['选中行白字 / 斜纹底色', decl(selected, 'color'), decl(optBg, 'background-color')],
    ['选中行白字 / 斜纹线色', decl(selected, 'color'), stripe],
  ]
  for (const [name, fg, bg] of pairs) {
    if (fg === null || bg === null) { fail('设置下拉 · ' + name + '：规则里读不到色值'); continue }
    const r = ratio(hex(fg), hex(bg))
    if (r >= 4.5) pass('设置下拉 · ' + name + '：' + fg + ' on ' + bg + ' = ' + r.toFixed(2) + ':1 (AA)')
    else fail('设置下拉 · ' + name + ' is only ' + r.toFixed(2) + ':1 (' + fg + ' on ' + bg + ')')
  }
  /* The plate is the control's boundary, so on paper it must clear the 3:1
     non-text floor against both surfaces it sits on. On near-black the plate is
     the LIGHTER shape and the white value text carries the affordance; it only
     has to read as a distinct plate there (>= 1.5:1). */
  const plate = decl(trig, 'background-color')
  if (plate === null) fail('设置下拉 · 铭牌底色读不到')
  else {
    for (const [scheme, bgs, floor] of [['亮色', LIGHT_BGS, 3], ['暗色', DARK_BGS, 1.5]]) {
      for (const [bgName, bg] of Object.entries(bgs)) {
        const r = ratio(hex(plate), bg)
        if (r >= floor) pass('设置下拉 · 铭牌对' + scheme + ' ' + bgName + '：' + r.toFixed(2) + ':1 (>= ' + floor + ')')
        else fail('设置下拉 · 铭牌在' + scheme + ' ' + bgName + ' 上读不出来：' + r.toFixed(2) + ':1')
      }
    }
  }
}

/* ---------- 11. three palettes must actually differ ---------- */
{
  const accents = [varIn(palettes['谷地黄'], '--edge-accent'), varIn(palettes['武陵青'], '--edge-accent'), varIn(grayBlock, '--edge-accent')]
  if (new Set(accents.map((v) => v && v.toLowerCase())).size === 3) pass('三套配色的强调色各不相同：' + accents.join(' / '))
  else fail('palette accents collide: ' + accents.join(' / '))
  for (const v of accents) {
    if (v !== null && !/^#[0-9a-f]{6}$/i.test(v)) fail('accent should be a 6-digit hex value, got ' + v)
  }
}

console.log('')
if (failures) { console.error(failures + ' palette check(s) failed'); process.exit(1) }
console.log('all palette-contrast checks passed')
