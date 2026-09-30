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
