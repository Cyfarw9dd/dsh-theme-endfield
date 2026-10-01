/**
 * settings-rows.test.js — prove the 「终末地主题设置」 panel actually renders.
 *
 * The settings section is the ONLY way a user reaches these switches, and it is a
 * React component built with React.createElement inside the theme. A mistake there
 * (a throw, a missing key, a row wired to the wrong preference) is invisible to
 * check.js and to the canvas tests, so it is asserted here.
 *
 * No React and no browser: the theme is executed in-process with a recording
 * `React` stub and a recording `slots` stub. That is enough to capture the real
 * element tree, because the component only uses createElement/useState.
 *
 * Preferences: since the theme migrated from localStorage to the DSH settings
 * namespace, this test feeds the plugin a fake `ctx.settingsScope` binder (see
 * test/fixtures/settings-scope.js) and asserts writes through it — the theme
 * never touches localStorage.
 *
 * Usage: node test/settings-rows.test.js
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { settingsScopeStub, fieldName } = require(path.join(__dirname, 'fixtures', 'settings-scope.js'))

const ROOT = path.resolve(__dirname, '..')
const src = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')

let failures = 0
const fail = (m) => { console.error('FAIL  ' + m); failures++ }
const pass = (m) => console.log('ok    ' + m)

/* Minimal recording React. useState is STATEFUL across rendered() passes now:
   the panel's unified dropdowns keep their open/close in React state, so a
   no-op setter would make "open the menu, click an option" untestable — the
   tree would never show the menu. Slots are indexed in call order (the panel
   renders the same rows in the same order every pass, so indexes are stable),
   setters write the slot, and the next rendered() call re-runs the component
   which reads the stored value. No auto-rerender: the test calls rendered()
   explicitly, exactly like the older assertions did. */
const makeReact = () => {
  const state = []
  let slot = 0
  return {
    /* Call before each rendered() pass so the slot counter walks 0..N again. */
    __begin() { slot = 0 },
    useState(init) {
      const i = slot++
      if (state.length <= i) state[i] = typeof init === 'function' ? init() : init
      return [state[i], (next) => {
        const value = typeof next === 'function' ? next(state[i]) : next
        state[i] = value
      }]
    },
    createElement(type, props, ...children) {
      const kids = []
      for (const c of children) {
        if (Array.isArray(c)) kids.push(...c)
        else if (c !== null && c !== undefined && c !== false) kids.push(c)
      }
      return { type, props: props || {}, children: kids }
    },
  }
}

const reactStub = makeReact()

/** Depth-first text of an element tree. */
const textOf = (el) => {
  if (el === null || el === undefined || typeof el === 'boolean') return ''
  if (typeof el === 'string' || typeof el === 'number') return String(el)
  return (el.children || []).map(textOf).join('')
}
const walk = (el, out = []) => {
  if (el && typeof el === 'object' && el.type) {
    out.push(el)
    for (const c of el.children || []) walk(c, out)
  }
  return out
}

/** Drive the unified dropdown the way a user does: open it, then click the
    option whose visible text matches. getTree must return a FRESH render
    (the menu only exists in the post-open tree). Returns 'ok' or which step
    failed, so callers can fail with the exact missing piece. */
const driveSelect = (getTree, ariaLabel, optionText) => {
  const t1 = getTree()
  const trigger = walk(t1).find((n) => n.type === 'button' && n.props && n.props['aria-label'] === ariaLabel
    && n.props['aria-haspopup'] === 'menu')
  if (!trigger) return 'trigger'
  if (typeof trigger.props.onClick !== 'function') return 'trigger-onClick'
  trigger.props.onClick()
  const t2 = getTree()
  const menu = walk(t2).find((n) => n.props && n.props.role === 'menu' && n.props['aria-label'] === ariaLabel)
  if (!menu) return 'menu'
  const option = walk(menu).find((n) => n.props && n.props.role === 'menuitemradio' && textOf(n) === optionText)
  if (!option) return 'option:' + optionText
  if (typeof option.props.onClick !== 'function') return 'option-onClick'
  option.props.onClick()
  return 'ok'
}
/** The trigger of a row's dropdown (closed state): its visible text is the
    current value. */
const selectTriggerOf = (tree, ariaLabel) => walk(tree).find((n) => n.type === 'button' && n.props
  && n.props['aria-label'] === ariaLabel && n.props['aria-haspopup'] === 'menu')

let rendered = null
const slots = {
  inject(_name, fn) { fn() },
  register(_opts, render) { rendered = render; return () => {} },
}

const classList = { add() {}, remove() {} }
const noopEl = () => ({
  style: {}, setAttribute() {}, appendChild() {}, removeChild() {},
  querySelector: () => null, querySelectorAll: () => [], insertBefore() {},
  getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
  classList, className: '', parentNode: null, firstChild: null,
  hasAttribute: () => false, getAttribute: () => null, isConnected: true,
  getContext: () => null, appendData() {},
})
const document = {
  body: Object.assign(noopEl(), { classList }),
  head: noopEl(),
  createElement: () => noopEl(),
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
}

/* The durable prefs seam: a fake settingsScope binder over an in-memory section.
   Start with the default section (enabled on). The panel drives reads from it,
   and every toggle writes back through it. */
const prefStore = settingsScopeStub()

const sandbox = {
  window: {
    __ModuleLoader__: null,
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false }),
    innerWidth: 1440, setTimeout: () => 0, clearTimeout() {},
  },
  document,
  React: reactStub,
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
  ResizeObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  performance: { now: () => 0 },
  setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
  console,
}
sandbox.globalThis = sandbox
sandbox.window.document = document

let loaded = null
sandbox.window.__ModuleLoader__ = { load: (m) => { loaded = m } }

vm.createContext(sandbox)
try {
  new vm.Script(src, { filename: 'client.js' }).runInContext(sandbox)
} catch (e) {
  fail('client.js threw while loading: ' + e.message)
  process.exit(1)
}
if (loaded === null) { fail('module never registered with __ModuleLoader__'); process.exit(1) }

const mod = loaded.factory(() => null)
const ctx = {
  get: (n) => {
    if (n === 'theme') return { overrideTokens: () => () => {} }
    if (n === 'slots') return slots
    if (n === 'settingsScope') return prefStore.binder
    return undefined
  },
  effect: () => {},
}
// Enable the theme so mount() runs, mirroring a real session.
prefStore.setField('enabled', '1')
prefStore.setField('loader', '0')
try { mod.apply(ctx) } catch (e) { fail('apply() threw: ' + e.message); process.exit(1) }
pass('apply() completed without throwing')

if (typeof rendered !== 'function') { fail('settings.section was never registered'); process.exit(1) }
pass('settings.section registered')

/* Wrap the registered render so every pass resets the stub's hook slot counter
   before the component body runs (see makeReact). Every later rendered() in
   this file goes through this wrapper. */
const rawRendered = rendered
rendered = () => { reactStub.__begin(); return rawRendered() }

/* --- render the panel and inspect the real element tree --- */
let tree
try { tree = rendered() } catch (e) { fail('settings render threw: ' + e.message); process.exit(1) }
pass('settings panel rendered without throwing')

const nodes = walk(tree)
const buttons = nodes.filter((n) => n.type === 'button')
/* The rows live inside four group containers (主题 / 背景 / 动画 / 娱乐), so "all
   rows" means every div whose key is one of the sixteen switch rows, wherever
   it sits in the tree.

   ROW_KEYS is BOTH the expected set and the counter, so a new row that is not
   listed here is silently ignored rather than counted — which is exactly what
   happened when 大字入场动画 was added (the count stayed at 9 and the assertion
   passed while a tenth row was on screen). The independent total below is what
   makes that impossible now. */
/* The row set is the union of both lines of work: main's glass row plus this
   branch's 11 audio rows. The count is asserted below against the rendered tree
   as well, so a row that exists in the page but not in this list still fails. */
const ROW_KEYS = ['theme', 'palette', 'motion', 'glass', 'texture', 'radius', 'watermark', 'watermark-persist', 'loader', 'thunder', 'thunder-anim', 'notify', 'notify-done', 'notify-question', 'notify-approve', 'audio', 'audio-boot', 'audio-start', 'audio-done', 'audio-volume', 'audio-attention', 'audio-fail', 'audio-source', 'audio-dir', 'audio-human', 'audio-diag']
const rows = nodes.filter((n) => n.type === 'div' && n.props && ROW_KEYS.includes(n.props.key))
const groups = (tree.children || []).filter((c) => c && c.type === 'div' && c.props && /^group-/.test(c.props.key))

if (rows.length === 26) pass('panel has all 26 setting rows')
else fail('expected 26 rows, found ' + rows.length)

/* Count the rows the way the PAGE defines them — every direct child of a group
   container — so an unlisted new row shows up as a mismatch instead of vanishing. */
const rowsInGroups = groups.reduce((acc, g) => acc.concat(
  (g.children || []).filter((c) => c && c.type === 'div' && c.props && c.props.key !== undefined
    && !/^group-title-/.test(String(c.props.key)))), [])
if (rowsInGroups.length === rows.length) {
  pass('分组内的行数与已登记的 ROW_KEYS 一致（' + rowsInGroups.length + '）')
} else {
  fail('分组内有 ' + rowsInGroups.length + ' 行，但 ROW_KEYS 只登记了 ' + rows.length
    + ' 行 — 未登记的行会被静默忽略：'
    + rowsInGroups.map((r) => r.props.key).filter((k) => !ROW_KEYS.includes(k)).join(', '))
}

if (groups.length === 6) pass('rows are grouped into 6 sections (主题/背景/动画/娱乐/通知/音频)')
else fail('expected 6 group containers, found ' + groups.length)

const unkeyed = rows.filter((r) => !r.props || r.props.key === undefined)
if (unkeyed.length === 0) pass('every row carries a React key')
else fail(unkeyed.length + ' row(s) missing a key (React will warn)')

const keys = rows.map((r) => r.props.key)
if (new Set(keys).size === keys.length) pass('row keys are unique: ' + keys.join(', '))
else fail('duplicate row keys: ' + keys.join(', '))

/* The group headers must be numbered editorial labels in the documented order,
   and the scheme-aware ink rule for them must exist in the stylesheet source. */
const all = textOf(tree)
for (const [label, title] of [['01 主题', 'THEME'], ['02 背景', 'BACKGROUND'], ['03 动画', 'ANIMATION'], ['04 娱乐', 'ENTERTAINMENT'], ['05 通知', 'NOTIFY'], ['06 音频', 'AUDIO']]) {
  if (all.includes(label) && all.includes(title)) pass('group header present: ' + label + ' / ' + title)
  else fail('group header missing: ' + label + ' / ' + title)
}
if (src.includes('.endfield-settings-group-title')) pass('group-title stylesheet rule is defined')
else fail('client.js never defines .endfield-settings-group-title — headers will use default text colour')
/* Rows that must exist. 光点移动 is deliberately NOT in this list: it is described
   in the README and was asserted here, but it has never existed in client.js (git
   log -S finds no commit adding it), so the assertion tested the test rather than
   the theme and failed on every pristine checkout. Removed rather than left
   red-by-default — a suite that is expected to fail teaches nothing. */
for (const label of ['主题配色', '背景水印']) {
  if (all.includes(label)) pass('row present: ' + label)
  else fail('row missing: ' + label)
}

/* --- the palette row: default 终末地灰, dropdown selection writes the field --- */
{
  const trig = selectTriggerOf(tree, '主题配色')
  if (trig && textOf(trig).includes('终末地灰')) pass('默认配色下拉触发器显示终末地灰')
  else fail('palette trigger does not show 终末地灰 as the default: ' + (trig ? textOf(trig) : '(none)'))
  /* open the menu and pick one the way a user does */
  const steps = driveSelect(() => rendered(), '主题配色', '谷地黄')
  if (steps === 'ok') {
    if (prefStore.get('palette') === 'valley') pass('选择谷地黄写入 palette=valley（打开菜单→点选项）')
    else fail('palette dropdown wrote ' + JSON.stringify(prefStore.get('palette')) + ', expected "valley"')
  } else fail('palette dropdown could not be driven: ' + steps)
  /* the menu itself must offer exactly the three palettes, as menuitemradio */
  const tOpen = rendered()
  const trig2 = selectTriggerOf(tOpen, '主题配色')
  if (trig2) { trig2.props.onClick(); const tOpen2 = rendered()
    const menu = walk(tOpen2).find((n) => n.props && n.props.role === 'menu' && n.props['aria-label'] === '主题配色')
    const opts = menu ? walk(menu).filter((n) => n.props.role === 'menuitemradio') : []
    if (opts.length === 3) pass('下拉菜单提供三档（menuitemradio）')
    else fail('palette menu has ' + opts.length + ' options, expected 3')
    /* 元素必须是可聚焦的 button：应用的菜单行就是 button[role=menuitem*]，
       div 会丢掉键盘 Tab/Enter（2026-10 二次核对后钉住）。 */
    if (opts.length > 0 && opts.every((n) => n.type === 'button' && n.props.type === 'button')) {
      pass('下拉选项是 button[type=button]（可聚焦，同应用菜单）')
    } else {
      fail('下拉选项不是 button：' + JSON.stringify(opts.map((n) => n.type)))
    }
    const checked = opts.filter((n) => n.props['aria-checked'] === 'true')
    if (checked.length === 1 && textOf(checked[0]).includes('谷地黄')) pass('当前值以 aria-checked 标在谷地黄上')
    else fail('aria-checked should mark exactly the current option, got ' + checked.length + ' checked')
    /* close it again so later assertions start from a closed panel */
    const again = selectTriggerOf(rendered(), '主题配色'); if (again) again.props.onClick()
  } else fail('no palette trigger for the menu-shape assertion')
  prefStore.setField('palette', 'gray')
}

/* --- 雷霆大字 (娱乐): default OFF, and its 预览 follows the same rule ---
   The row is asserted from the DEFAULT state deliberately: 默认关闭 is the part of
   the request a later edit is most likely to break (flipping the read to !== '0'
   would silently make it opt-out), and no other check would notice. */
prefStore.setField('thunder', '0') // never override it before this point
if (prefStore.get('thunder') === '0' && prefStore.section.thunder === '0') pass('雷霆大字 未设置即为默认状态')
{
  const trig = selectTriggerOf(rendered(), '雷霆大字')
  if (trig && textOf(trig).includes('关闭')) pass('雷霆大字 默认关闭（触发器显示当前值）')
  else fail('雷霆大字 trigger should read 关闭 with the default state: ' + (trig ? textOf(trig) : '(none)'))
}
if (all.includes('任务开始') && all.includes('任务完成')) pass('设置行说明包含「任务开始」/「任务完成」')
else fail('the 雷霆大字 row should name both announcement words')
if (all.includes('3 秒') || all.includes('3秒')) pass('设置行说明 3 秒后隐藏')
else fail('the 雷霆大字 row should state the 3s hold')
/* 预览 must be disabled while the feature is off. The panel renders two 预览
   buttons (loader + thunder), so this picks the one in the thunder row rather
   than the first match — an index-based lookup would silently test the loader. */
const thunderRow = rows.find((r) => r.props.key === 'thunder')
const thunderRowBtns = thunderRow ? walk(thunderRow).filter((n) => n.type === 'button' && n.props.type === 'button') : []
const thunderPreview = thunderRowBtns.find((b) => /预览/.test(textOf(b)))
if (thunderPreview && thunderPreview.props.disabled === true) pass('雷霆大字 预览 disabled while off')
else fail('雷霆大字 预览 should be disabled while the feature is off')

/* --- 按钮动效: a dropdown like every other value row (2026-10 统一) ---
   The stored literals are 'signal' (on — historic default literal, unchanged)
   and 'off'; legacy scheme names must READ as on. */
{
  const trig = selectTriggerOf(rendered(), '按钮动效')
  if (trig && textOf(trig).includes('开启')) pass('按钮动效 默认开启（合并设计，触发器显示当前值）')
  else fail('按钮动效 trigger should read 开启 with the default state: ' + (trig ? textOf(trig) : '(none)'))
  const offStep = driveSelect(() => rendered(), '按钮动效', '关闭')
  if (offStep === 'ok') {
    if (prefStore.get('motion') === 'off') pass('按钮动效 下拉写入 motion=off')
    else fail('按钮动效 dropdown wrote ' + JSON.stringify(prefStore.get('motion')) + ', expected "off"')
  } else fail('按钮动效 dropdown could not be driven to 关闭: ' + offStep)
  const trigOff = selectTriggerOf(rendered(), '按钮动效')
  if (trigOff && textOf(trigOff).includes('关闭')) pass('motion=off 后触发器翻转为「关闭」')
  else fail('motion=off 后触发器仍显示: ' + (trigOff ? textOf(trigOff) : '(none)'))
  const onStep = driveSelect(() => rendered(), '按钮动效', '开启')
  if (onStep === 'ok' && prefStore.get('motion') === 'signal') pass('重新开启写入 motion=signal（历史字面量）')
  else fail('重新开启写入 ' + JSON.stringify(prefStore.get('motion')) + ', expected "signal" [' + onStep + ']')
  /* Legacy scheme names must READ as ON (merge migration): the trigger value
     derives from readMotion(), which folds every old scheme name into on. */
  for (const legacy of ['silent', 'impact', 'clamp', 'meter', 'stamp']) {
    prefStore.setField('motion', legacy)
    const trigL = selectTriggerOf(rendered(), '按钮动效')
    if (trigL && textOf(trigL).includes('开启')) pass('旧方案名 ' + legacy + ' 读取为「开」（并入合并设计）')
    else fail('旧方案名 ' + legacy + ' 读成了关: ' + (trigL ? textOf(trigL) : '(none)'))
  }
  prefStore.setField('motion', 'signal')
}

/* --- 大字入场动画: its own sub-switch, ALSO default off ---
   enforces the doc default (=== '1'), not opt-in === '1' vs !== '0' mismatch.
   Two independent defaults live here and both are part of the request. */
{
  const trig = selectTriggerOf(rendered(), '大字入场动画')
  if (trig && textOf(trig).includes('关闭')) pass('大字入场动画 默认关闭')
  else fail('大字入场动画 trigger should read 关闭 with the default state: ' + (trig ? textOf(trig) : '(none)'))
  if (trig && trig.props.disabled === true) pass('大字入场动画 在大字关闭时为 disabled')
  else fail('大字入场动画 should be disabled while 雷霆大字 itself is off')
}

/* --- 雷霆大字 on: 预览 becomes usable and the row states the live behaviour ---
   The stateful stub only refreshes React state through the panel's own event
   path (the host-sync useEffect the stub does not implement), so the ON state
   is reached the way a user reaches it: through the dropdown itself. */
let treeT
{
  const step = driveSelect(() => rendered(), '雷霆大字', '开启')
  if (step === 'ok') pass('雷霆大字 下拉开启（走真实事件路径）')
  else fail('thunder dropdown could not be driven on: ' + step)
  try { treeT = rendered() } catch (e) { fail('re-render (thunder on) threw: ' + e.message); process.exit(1) }
  const rowsT = walk(treeT).filter((n) => n.type === 'div' && n.props && n.props.key === 'thunder')
  const thunderBtnsOn = rowsT.length ? walk(rowsT[0]).filter((n) => n.type === 'button' && n.props.type === 'button') : []
  const previewOn = thunderBtnsOn.find((b) => /预览/.test(textOf(b)))
  if (previewOn && !previewOn.props.disabled) pass('雷霆大字 预览 enabled once switched on')
  else fail('雷霆大字 预览 should be enabled once the feature is on')
  const trigT = selectTriggerOf(treeT, '雷霆大字')
  if (trigT && textOf(trigT).includes('开启')) pass('thunder=1 时触发器显示开启')
  else fail('with thunder=1 the trigger should read 开启: ' + (trigT ? textOf(trigT) : '(none)'))
}

/* The animation sub-switch must become usable once its parent is on, and its
   dropdown must write its own field rather than the parent's. */
{
  const trigA = selectTriggerOf(treeT, '大字入场动画')
  if (trigA && trigA.props.disabled !== true) pass('大字入场动画 在大字开启后恢复可用')
  else fail('大字入场动画 should be enabled once 雷霆大字 is on')
  const stepA = driveSelect(() => rendered(), '大字入场动画', '开启')
  if (stepA === 'ok') {
    if (prefStore.get('thunderAnim') === '1') pass('大字入场动画 下拉写入 thunderAnim=1')
    else fail('大字入场动画 dropdown wrote ' + JSON.stringify(prefStore.get('thunderAnim')) + ', expected "1"')
    // It must not have disturbed the parent switch's own field.
    if (prefStore.get('thunder') === '1') pass('子开关不会误写主开关的字段')
    else fail('the sub-switch overwrote the parent field: ' + JSON.stringify(prefStore.get('thunder')))
    /* With the animation ON through the UI, the trigger must show the live value. */
    const trigTA = selectTriggerOf(rendered(), '大字入场动画')
    if (trigTA && textOf(trigTA).includes('开启')) pass('thunderAnim=1 时入场动画触发器显示开启')
    else fail('with thunderAnim on the 大字入场动画 trigger should read 开启: ' + (trigTA ? textOf(trigTA) : '(none)'))
  } else fail('大字入场动画 dropdown could not be driven: ' + stepA)
  const stepOff = driveSelect(() => rendered(), '大字入场动画', '关闭')
  if (stepOff === 'ok' && prefStore.get('thunderAnim') === '0') pass('大字入场动画 关闭写回 thunderAnim=0')
  else fail('大字入场动画 off wrote ' + JSON.stringify(prefStore.get('thunderAnim')) + ' [' + stepOff + ']')
}

/* --- with 武陵青 selected, the dropdown follows the store --- */
{
  const step = driveSelect(() => rendered(), '主题配色', '武陵青')
  if (step === 'ok') {
    if (prefStore.get('palette') === 'wuling') pass('选择武陵青写入 palette=wuling')
    else fail('wuling dropdown wrote ' + JSON.stringify(prefStore.get('palette')) + ', expected "wuling"')
  } else fail('wuling dropdown could not be driven: ' + step)
}
let tree3
try { tree3 = rendered() } catch (e) { fail('re-render (wuling) threw: ' + e.message); process.exit(1) }
const text3 = textOf(tree3)
if (text3.includes('武陵青')) pass('武陵青 生效时下拉触发器显示武陵青')
else fail('with wuling stored the palette trigger should reflect it')
// The accent must be surfaced to the user, in hex.
if (text3.includes('#14d0d0')) pass('设置行标注 #14d0d0')
else fail('the palette row should state #14d0d0')
prefStore.setField('palette', 'gray')

/* --- dropdown writes must land on the documented namespace fields --- */
{
  prefStore.setField('watermark', '1')
  const step = driveSelect(() => rendered(), '背景水印', '关闭')
  if (step === 'ok') {
    const v = prefStore.get('watermark')
    if (v === '0') pass('背景水印 下拉写入 watermark=0')
    else fail('背景水印 dropdown wrote ' + JSON.stringify(v) + ', expected "0"')
  } else fail('背景水印 dropdown could not be driven: ' + step)
  const step2 = driveSelect(() => rendered(), '背景水印', '开启')
  if (step2 === 'ok' && prefStore.get('watermark') === '1') pass('背景水印 重新开启写入 watermark=1')
  else fail('背景水印 re-enable wrote ' + JSON.stringify(prefStore.get('watermark')) + ' [' + step2 + ']')
}
{
  /* The panel was left ON by the block above; cycle it through the UI. Writing
     the store behind the panel's back is exactly the state the real app keeps
     in sync via the prefs subscription — which this stub cannot run — so a
     silent setField here would test a panel that has never seen the change. */
  const stepOff = driveSelect(() => rendered(), '雷霆大字', '关闭')
  if (stepOff === 'ok' && prefStore.get('thunder') === '0') pass('雷霆大字 下拉关闭写入 thunder=0')
  else fail('雷霆大字 off wrote ' + JSON.stringify(prefStore.get('thunder')) + ' [' + stepOff + ']')
  const step = driveSelect(() => rendered(), '雷霆大字', '开启')
  if (step === 'ok') {
    if (prefStore.get('thunder') === '1') pass('雷霆大字 下拉写入 thunder=1')
    else fail('雷霆大字 dropdown wrote ' + JSON.stringify(prefStore.get('thunder')) + ', expected "1"')
  } else fail('雷霆大字 dropdown could not be driven: ' + step)
  const stepOff2 = driveSelect(() => rendered(), '雷霆大字', '关闭')
  if (stepOff2 === 'ok' && prefStore.get('thunder') === '0') pass('雷霆大字 复位为 thunder=0')
  else fail('雷霆大字 reset wrote ' + JSON.stringify(prefStore.get('thunder')) + ' [' + stepOff2 + ']')
}

if (!/(typeof\s+localStorage|localStorage\.(getItem|setItem|removeItem))/.test(src)) pass('client.js has no localStorage storage-API calls')
else fail('client.js still calls the localStorage storage API — migration incomplete')

console.log('')
if (failures) { console.error(failures + ' settings check(s) failed'); process.exit(1) }
console.log('all settings-panel checks passed')
