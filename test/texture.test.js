/**
 * texture.test.js — the industrial background (official /operator layers) must be
 * present, switchable, and DECORATIVELY quiet.
 *
 * The theme's rule for decoration is one-sided and already used by the watermark
 * and the hero glow: a decorative layer may never read louder than the thing it
 * replaces, and anything below ~1.06:1 reads as absent. This file applies the
 * same band to the texture, because a backdrop is exactly the kind of thing that
 * can be "obviously fine" in one palette and muddy the text in another.
 *
 * It reads the alpha values out of client.js instead of restating them, and it
 * measures the composite the way the browser paints it (translucent ink over the
 * actual surface), so retuning the texture is what this test sees.
 *
 * Usage: node test/texture.test.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const src = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')

let failures = 0
const fail = (m) => { console.error('FAIL  ' + m); failures++ }
const pass = (m) => console.log('ok    ' + m)

/* ---------- WCAG maths (same helpers as palette-contrast.test.js) ---------- */
const hex = (h) => {
  const s = h.trim().replace('#', '')
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05) }
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha))
const rgbText = (p) => 'rgb(' + p.map((c) => Math.round(c)).join(', ') + ')'

/** Read one custom property from the first block whose header contains `needle`. */
const blockWith = (needle) => {
  const i = src.indexOf(needle)
  if (i < 0) return null
  const open = src.indexOf('{', i)
  const close = src.indexOf('}', open)
  return close < 0 ? null : src.slice(open, close)
}
/** Same, but runs on a whitespace-collapsed copy so indentation is not part of the
    needle. client.js indents its stylesheet by 6 spaces and the generated blocks by
    2, so matching raw text is a trap. */
const blockWithLoose = (needle) => {
  /* Strip comments FIRST, then collapse whitespace: collapsing first leaves the
     prose intact, and prose contains '}', which truncates the block at the wrong
     place. */
  const flat = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
  const i = flat.indexOf(needle.replace(/\s+/g, ' '))
  if (i < 0) return null
  const open = flat.indexOf('{', i)
  const close = flat.indexOf('}', open)
  return close < 0 ? null : flat.slice(open + 1, close)
}
const varIn = (block, name) => {
  if (block === null) return null
  const m = new RegExp(name.replace(/[-]/g, '\\-') + '\\s*:\\s*([^;]+);').exec(block)
  return m ? m[1].trim() : null
}

/* ---------- 1. the switch exists and is wired end to end ---------- */
/* `off` is the ABSENCE of the attribute in the real client (syncTexture removes
   it) — but the CSS must not RELY on that: the first version gated every rule on
   the attribute's PRESENCE, and a stale 'off' value then painted the texture
   anyway (measured). The overlays are therefore gated on explicit values, and
   this assertion pins that: 'subtle' must name the overlay by value. */
if (/body\[data-endfield-texture='subtle'\]:not\(:has\(> \[data-endfield-watermark\]\)\) \[class\$='_centerCol'\] \[class\$='_root'\]\[data-phase\]::before/.test(src)) {
  pass('叠加层按值命中会话根（后代匹配，容忍插槽包装层；水印挂 body 时让位）')
} else {
  fail('叠加层没有按值匹配——属性残留 off 时纹理仍会画（按存在匹配的老写法）')
}
if (/data-endfield-texture='standard'/.test(src)) pass('CSS carries the standard tier')
else fail('no CSS rules for tier standard')
/* Collapse whitespace so the check is about the code, not its line breaks. */
const oneLine = src.replace(/\s+/g, ' ')
if (/setAttribute\?\.\('data-endfield-texture', value\)[\s\S]{0,60}else document\.body\.removeAttribute\?\.\('data-endfield-texture'\)/.test(oneLine)) {
  pass('off 档通过移除属性实现（不留死属性）')
} else {
  fail('syncTexture 没有在 off 时移除 data-endfield-texture')
}
if (/const TEXTURE_OPTIONS = \['off', 'subtle', 'standard'\]/.test(src)) pass('client TEXTURE_OPTIONS matches the three tiers')
else fail('client TEXTURE_OPTIONS is missing or drifted from the CSS tiers')
if (/'dsh-theme-endfield-texture': 'texture'/.test(src)) pass('prefs key maps to the schema field "texture"')
else fail('PREFS_KEY_TO_FIELD has no entry for dsh-theme-endfield-texture — the row would not persist')
const host = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8')
if (/texture: 'standard'/.test(host)) pass('host FIELD_DEFAULTS ships texture=standard')
else fail('index.js FIELD_DEFAULTS has no texture default — the switch would reset every load')

/* ---------- 1b. the texture must be CONTENT-ANCHORED, never window-tiled ----------
   The first implementation painted 'position:fixed; inset:0' overlays on the
   frame, the center column AND the sidebar, plus full-element repeating hatch
   layers — i.e. tiled across the whole window. The official page anchors every
   layer to a content region instead (grid clipped to the content column and
   fading downward, hatch as a bottom band fading upward, wave pinned top-right).
   These two tripwires stop exactly that regression from coming back. */
{
  const section = src.slice(src.indexOf('背景纹理：官网'), src.indexOf('The watermark is the Endfield Industries LOGO'))
  if (!/\[class\$='_frame'\]/.test(section) && !/\[class\$='_sidebarCol'\]/.test(section)) {
    pass('纹理不挂外框/侧栏（不整窗平铺，只锚定主内容列）')
  } else {
    fail('纹理又挂到了 _frame/_sidebarCol 上——那是整窗平铺；官方做法是按内容区域锚定')
  }
  const overlayRule = section.slice(section.indexOf('::before'), section.indexOf('::before') + 700)
  if (/z-index:\s*-1/.test(overlayRule)) {
    pass('叠加层在内容之下（z-index:-1 + isolation）——装饰不盖文字')
  } else {
    fail('网格叠加层不在内容之下：需要 z-index:-1，否则纹理画在正文上面')
  }
}

/* ---------- 2. the official assets are embedded, and only as data URIs ---------- */
for (const prop of ['--edge-tex-grid-mask', '--edge-tex-wave', '--edge-tex-tape']) {
  const re = new RegExp('body\\s*\\{\\s*' + prop + ':\\s*url\\("data:image\\/(svg\\+xml|png);base64,[A-Za-z0-9+/=]{100,}"\\)\\s*;\\s*\\}')
  if (re.test(src)) pass(prop + ' is embedded inside a body rule')
  else fail(prop + ' is not embedded as a body-scoped data URI — run: node scripts/build-texture.js')
}
/* No external asset may sneak into the texture: everything ships in the bundle. */
{
  const textureSection = src.slice(src.indexOf('背景纹理：官网'), src.indexOf('The watermark is the Endfield Industries LOGO'))
  /* Only the embedded data URIs count: scan the section minus its comments, so a
     comment that explains the assets cannot trip this. */
  const external = [...textureSection.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/url\((?!")[^)]*\)/g)].map((m) => m[0])
  if (external.length === 0) pass('纹理段不含任何外链资源（全部内嵌）')
  else fail('纹理段出现外链资源：' + external.slice(0, 2).join(', '))
}

/* ---------- 3. decoration band, measured per scheme ---------- */
{
  /* The texture paints translucent ink over the surface. Read the ink and the
     alphas from the stylesheet, composite onto the real surface, and check the
     result stays inside the decorative band. */
  const LIGHT_SURFACES = { 'bg-base': '#e8e8e2', 'bg-layer-1': '#f2f2ec' }
  const DARK_SURFACES = { 'bg-base': '#101110', 'bg-layer-1': '#181a18' }
  /* Anchor on the whole first declaration line: '#181818' also appears in the
     documented fallbacks, so a bare colour search finds the wrong block. */
  const lightBlock = blockWithLoose('body { --edge-tex-ink: #181818;')
  const darkBlock = blockWithLoose('body[data-ds-dark-theme] { --edge-tex-ink: #e9e9e3;')
  const LIGHT_INK = varIn(lightBlock, '--edge-tex-ink')
  const DARK_INK = varIn(darkBlock, '--edge-tex-ink')
  /* The tokens hold PERCENTAGES ('5%'), and colour maths needs a fraction — the
     first version passed '5%' straight into the compositor, which produced a
     nonsense ratio (0.000 light / 1190 dark). */
  const pct = (v) => parseFloat(v) / 100
  const LIGHT_GRID = pct(varIn(lightBlock, '--edge-tex-grid-a'))
  const LIGHT_HATCH = pct(varIn(lightBlock, '--edge-tex-hatch-a'))
  const DARK_GRID = pct(varIn(darkBlock, '--edge-tex-grid-a'))
  const DARK_HATCH = pct(varIn(darkBlock, '--edge-tex-hatch-a'))
  if (!LIGHT_INK || !DARK_INK || Number.isNaN(LIGHT_GRID) || Number.isNaN(DARK_HATCH)) {
    fail('could not read the texture tokens out of client.js')
  } else {
    const check = (label, ink, alpha, surfaces) => {
      let worst = 0
      for (const [name, bg] of Object.entries(surfaces)) {
        const r = ratio(over(hex(ink), hex(bg), alpha), hex(bg))
        worst = Math.max(worst, r)
        if (r > 1.6) fail(`${label} on ${name} reads ${r.toFixed(3)}:1 — louder than the 1.6 decorative ceiling`)
      }
      if (worst <= 1.6) pass(`${label} 装饰强度 ${worst.toFixed(3)}:1 (≤1.6)`)
      if (worst < 1.06) fail(`${label} reads ${worst.toFixed(3)}:1 — below the 1.06 floor, i.e. absent`)
    }
    for (const [label, ink, a, surf] of [
      ['亮色 网格', LIGHT_INK, LIGHT_GRID, LIGHT_SURFACES],
      ['亮色 斜纹', LIGHT_INK, LIGHT_HATCH, LIGHT_SURFACES],
      ['暗色 网格', DARK_INK, DARK_GRID, DARK_SURFACES],
      ['暗色 斜纹', DARK_INK, DARK_HATCH, DARK_SURFACES],
    ]) check(label, ink, a, surf)
  }
}

/* ---------- 4. static: no motion, no layer promotion ---------- */
{
  const section = src.slice(src.indexOf('背景纹理：官网'), src.indexOf('The watermark is the Endfield Industries LOGO'))
  if (!/transition\s*:/.test(section) && !/@keyframes/.test(section)) {
    pass('纹理段是静态的（无 transition、无 @keyframes）——官网的底纹也是静态的')
  } else {
    fail('纹理段出现了过渡或关键帧：官网的网格/斜纹是静态的，动起来即超出语法')
  }
  if (!/will-change/.test(section)) pass('纹理段没有 will-change（不为装饰预建合成层）')
  else fail('纹理段用了 will-change')
  /* The SURFACE rules must carry the texture through background-* alone. The
     tri-colour signal rule is a real element with a real 2px height, so it is
     excluded from this check rather than pretending it is a background layer. */
  const surfaceRules = section.slice(0, section.indexOf('.endfield-settings .endfield-settings-group-title'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
  /* `position: relative` on the host and `position: fixed` on the overlay ARE the
     texture's carrying mechanism (the grid needs its own layer), so they are
     expected; what must not appear is a size/spacing property. */
  if (!/(^|[;{\s])(width|height|padding|margin)\s*:/.test(surfaceRules)) {
    pass('承载面只用背景属性，不改任何布局属性')
  } else {
    fail('承载面出现了布局属性——纹理必须只走 background-*')
  }
}

/* ---------- 5. degradation is declared ---------- */
if (/prefers-reduced-transparency: reduce/.test(src) && /prefers-contrast: more/.test(src)) {
  const i = src.indexOf('@media (prefers-reduced-transparency: reduce)')
  const block = src.slice(i, i + 400)
  if (/background-image:\s*none/.test(block)) pass('减少透明/更高对比偏好下纹理整段关闭')
  else fail('降级媒体查询存在，但没有把 background-image 关掉')
} else {
  fail('缺少 prefers-reduced-transparency / prefers-contrast 降级')
}

/* ---------- 6. the tri-colour rule carries the OFFICIAL stops ---------- */
{
  const official = '#ff00f0 11.25rem,#fffa00 0,#fffa00 22.5625rem,#00ffa2 0'
  const compact = official.replace(/\s+/g, '')
  const found = src.replace(/\s+/g, '').includes(compact)
  if (found) pass('三色信号线沿用官方 decoLine 原文停靠值')
  else fail('三色信号线的停靠值与官方 decoLine 不一致（应为 ' + official + '）')
}

console.log('')
if (failures) { console.error(failures + ' texture check(s) failed'); process.exit(1) }
console.log('all texture checks passed')
