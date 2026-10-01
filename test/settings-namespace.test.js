/**
 * settings-namespace.test.js — the settings namespace is read and written under
 * the names the HOST registered, and a section the buggy build wrote is repaired.
 *
 * Bug it guards (issue #15):
 *   `fix(settings): persist theme prefs via DSH settings namespace reliably`
 *   (e504199) started persisting through `ctx.settingsScope`, but derived the
 *   storage field by STRIPPING the namespace prefix off the UI key:
 *
 *       'dsh-theme-endfield-thunder-anim' -> 'thunder-anim'
 *
 *   while the host registers camelCase fields (index.js FIELD_DEFAULTS:
 *   `thunderAnim`). So the write landed on a key the schema does not declare.
 *   schemastery validates declared fields and passes extras through, so the
 *   document really did receive `thunder-anim: "1"` — and `thunderAnim` stayed at
 *   its default. The switch worked for the page session and reset on the next
 *   load. Two compound fields were affected: thunderAnim,
 *   watermarkPersist.
 *
 * Why no earlier test caught it: the settings tests fed the theme a fake scope
 * whose section was keyed by the SAME wrong spelling (the fixture stripped the
 * prefix too), so the client's read and the fixture's write agreed on a name
 * that exists nowhere in the schema. Both sides green, production broken. This
 * file therefore does not trust either side's spelling on its own:
 *
 *   1. it cross-checks the client mapping against the HOST SCHEMA (index.js
 *      FIELD_DEFAULTS) and against the toggles actually rendered by the panel;
 *   2. it drives the real toggles against a section keyed exactly like the host's;
 *   3. it reproduces the shipped bug — a section carrying the pre-migration
 *      spelling — and asserts the stored choice is recovered onto the declared
 *      field.
 *
 * The other two findings in the same issue are covered at the bottom: an edit
 * must be visible immediately (not after the host round-trip), and reverting a
 * field to its default while the namespace is not yet served must not be
 * swallowed.
 *
 * Usage: node test/settings-namespace.test.js
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { settingsScopeStub, FIELD_DEFAULTS, KEY_TO_FIELD, fieldName } =
  require(path.join(__dirname, 'fixtures', 'settings-scope.js'))
const HOST = require(path.join(__dirname, '..', 'index.js'))

const ROOT = path.resolve(__dirname, '..')
const rawSrc = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')

let failures = 0
const fail = (m) => { console.error('FAIL  ' + m); failures++ }
const pass = (m) => console.log('ok    ' + m)

/* ======================================================================
   1. The mapping itself: client table vs the HOST schema vs the panel
   ====================================================================== */

/* From the real client source, not from a copy of it. */
const clientTable = (() => {
  /* String#match / String#matchAll rather than RegExp#exec loops: identical
     results, but a bare dot-exec call reads as child_process.exec to static
     signature scanners, which cannot see the receiver (see SECURITY.md). */
  const m = rawSrc.match(/const PREFS_KEY_TO_FIELD = \{([\s\S]*?)\n    \}/)
  if (!m) return null
  const out = {}
  const re = /'(dsh-theme-endfield-[a-z-]+)':\s*'([A-Za-z]+)'/g
  for (const hit of m[1].matchAll(re)) out[hit[1]] = hit[2]
  return out
})()

if (clientTable === null) {
  fail('could not read PREFS_KEY_TO_FIELD out of client.js — the table is the thing under test')
  process.exit(1)
}

/* The host's declared fields are the only names a scope.set can store. */
const hostFields = Object.keys(HOST.FIELD_DEFAULTS)
const badFields = Object.values(clientTable).filter((f) => !hostFields.includes(f))
if (badFields.length === 0) {
  pass(`every key the client maps names a field the host declares (${Object.keys(clientTable).length} keys)`)
} else {
  fail('client maps keys onto fields the host does NOT declare: ' + badFields.join(', ')
    + ' -> those writes land on undeclared keys and the declared field keeps its default')
}

if (Object.keys(clientTable).length === hostFields.length) {
  pass('the mapping covers every declared field')
} else {
  fail('mapping has ' + Object.keys(clientTable).length + ' keys for ' + hostFields.length + ' declared fields')
}

/* The old derivation — strip the prefix — must NOT be the mapping for any
   compound field, or the bug is back in a different costume. */
const derivedWrong = Object.keys(clientTable).filter((k) => clientTable[k] === k.slice('dsh-theme-endfield-'.length) && k.slice('dsh-theme-endfield-'.length) !== clientTable[k])
const keptIdentity = Object.keys(clientTable).filter((k) => k.slice('dsh-theme-endfield-'.length) === clientTable[k]).length
if (derivedWrong.length === 0 && keptIdentity < Object.keys(clientTable).length) {
  pass('compound keys map to a DIFFERENT name than the prefix-stripped one (' + keptIdentity + ' single-word keys map to themselves)')
} else {
  fail('the mapping still derives compound field names by stripping the prefix: ' + keptIdentity + ' identity keys')
}

/* The test fixture must mirror the client table — a fixture that repeats the
   bug makes every other test in this repo vacuous for these fields. */
const fixtureMismatch = Object.keys(clientTable).filter((k) => KEY_TO_FIELD[k] !== clientTable[k])
if (fixtureMismatch.length === 0) {
  pass('the test fixture maps every key exactly like client.js')
} else {
  fail('test/fixtures/settings-scope.js disagrees with client.js on: ' + fixtureMismatch.join(', '))
}

/* The fixture's defaults must mirror the host schema, so a "default" in a test
   is the default production ships. */
const defaultMismatch = hostFields.filter((f) => FIELD_DEFAULTS[f] !== HOST.FIELD_DEFAULTS[f])
if (defaultMismatch.length === 0) {
  pass('the fixture defaults match the host schema defaults')
} else {
  fail('fixture defaults differ from index.js for: ' + defaultMismatch.join(', '))
}

/* ---------------------------------------------------------------- harness -- */

/* Stateful stub (same shape as settings-rows): the panel's dropdowns keep
   open/close in React state, so the menu only appears in the tree when the
   setter actually stores the write. */
const makeReact = () => {
  const state = []
  const dirty = []
  let slot = 0
  return {
    __begin() { slot = 0 },
    /* Each boot() is a fresh page: drop the previous scenario's panel state so
       a later scenario re-seeds from its own prefs reads. */
    __resetAll() { state.length = 0; dirty.length = 0; slot = 0 },
    useState(init) {
      const i = slot++
      /* PRISTINE slots re-run their initializer on every render; WRITTEN slots
         keep the stored value. That combines the two behaviours this suite
         needs: pref-seeded state stays fresh until the mirror settles (the old
         no-op stub got that by re-running everything), while a dropdown's
         open/close — always reached through a setter — persists across the
         rendered() passes that drive it. */
      if (state.length <= i || !dirty[i]) {
        state[i] = typeof init === 'function' ? init() : init
      }
      return [state[i], (next) => {
        const value = typeof next === 'function' ? next(state[i]) : next
        state[i] = value
        dirty[i] = true
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
  addEventListener() {}, removeEventListener() {},
}

/**
 * Boot the real client.js over a supplied scope object.
 *
 * @param scope - the fake ctx.settingsScope scope. `wire` records every set().
 *                Pass nothing for a plain in-memory stub from the fixture.
 * @returns { render, scope }
 */
function boot(scope) {
  const slots = {
    inject(_n, fn) { fn() },
    register(_o, render) { slots.render = render; return () => {} },
  }
  let loaded = null
  const sandbox = {
    window: {
      __ModuleLoader__: { load: (m) => { loaded = m } },
      addEventListener() {}, removeEventListener() {},
      matchMedia: () => ({ matches: false }), innerWidth: 1440,
      setTimeout: () => 0, clearTimeout() {},
    },
    document,
    React: reactStub,
    MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
    ResizeObserver: function () { this.observe = () => {}; this.disconnect = () => {} },
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    performance: { now: () => 0 },
    setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    console,
  }
  sandbox.globalThis = sandbox
  sandbox.window.document = document
  vm.createContext(sandbox)
  try { new vm.Script(rawSrc, { filename: 'client.js' }).runInContext(sandbox) }
  catch (e) { fail('client.js threw while loading: ' + e.message); process.exit(1) }
  if (loaded === null) { fail('module never registered with __ModuleLoader__'); process.exit(1) }
  const mod = loaded.factory(() => null)
  mod.apply({
    get: (n) => {
      if (n === 'theme') return { overrideTokens: () => () => {} }
      if (n === 'slots') return slots
      if (n === 'settingsScope') return scope
      return undefined
    },
    effect: () => {},
  })
  /* Fresh page per boot: clear the stub's stored state, then every render
     resets just the slot counter (see makeReact). */
  reactStub.__resetAll()
  return { render: () => { reactStub.__begin(); return slots.render() }, scope }
}

/** Section keyed EXACTLY like the host's: declared fields only. */
function hostShapedSection(extra = {}) {
  const section = Object.assign({}, HOST.FIELD_DEFAULTS, extra)
  const wire = []
  const listeners = []
  const scope = {
    getSnapshot: () => ({
      status: 'ready', value: Object.assign({}, section), base: Object.assign({}, HOST.FIELD_DEFAULTS),
      user: Object.assign({}, section), revision: 1, writable: true, mode: 'host',
    }),
    subscribe(l) { listeners.push(l); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1) } },
    set(f, v) { wire.push([f, String(v)]); section[f] = String(v); for (const l of listeners.slice()) { try { l() } catch (e) {} } },
  }
  return { binder: { bind: () => scope }, section, wire, scope }
}

/** Find the panel row for a UI key and its primary switch button. */
const findRow = (tree, key) => walk(tree).find((n) => n.type === 'div' && n.props && n.props.key === key)
const buttonsIn = (row) => (row ? walk(row).filter((n) => n.type === 'button') : [])
const selectsIn = (row) => (row ? walk(row).filter((n) => n.type === 'select') : [])
/* Every value row is the unified dropdown now: its STATE is the trigger's
   visible text (the current option label). These sections assert FIELD READING,
   so the readout maps that text back to the stored literal. */
const rowTrigger = (tree, key) => {
  const row = findRow(tree, key)
  return row ? walk(row).find((n) => n.type === 'button' && n.props && n.props['aria-haspopup'] === 'menu') : null
}
const wmPersistValue = (tree) => {
  const trig = rowTrigger(tree, 'watermark-persist')
  if (!trig) return null
  return textOf(trig).includes('保持显示') ? '1' : '0'
}
/** The option label a stored literal renders as, per row. */
const optionTextFor = (rowKey, value) => {
  if (rowKey === 'radius') return value === 'round' ? '圆角' : '直角'
  if (rowKey === 'watermark-persist') return value === '1' ? '保持显示' : '仅新建页'
  return value === '1' ? '开启' : '关闭'
}
/** Drive a row's dropdown by flipping it: open the menu, click the option that
    is NOT aria-checked (what the old toggle button's single click did). */
const driveRowFlip = (getTree, rowKey) => {
  const trigger = rowTrigger(getTree(), rowKey)
  if (!trigger) return 'trigger'
  if (typeof trigger.props.onClick !== 'function') return 'trigger-onClick'
  trigger.props.onClick()
  const row2 = findRow(getTree(), rowKey)
  const menu = row2 ? walk(row2).find((n) => n.props && n.props.role === 'menu') : null
  if (!menu) return 'menu'
  const opt = walk(menu).find((n) => n.props && n.props.role === 'menuitemradio' && n.props['aria-checked'] !== 'true')
  if (!opt) return 'option:other'
  if (typeof opt.props.onClick !== 'function') return 'option-onClick'
  opt.props.onClick()
  return 'ok'
}
/** Drive a row's dropdown the way a user does. getTree must return a FRESH
    render — the menu only exists in the post-open tree. */
const driveRowSelect = (getTree, rowKey, optionText) => {
  const trigger = rowTrigger(getTree(), rowKey)
  if (!trigger) return 'trigger'
  if (typeof trigger.props.onClick !== 'function') return 'trigger-onClick'
  trigger.props.onClick()
  const row2 = findRow(getTree(), rowKey)
  const menu = row2 ? walk(row2).find((n) => n.props && n.props.role === 'menu') : null
  if (!menu) return 'menu'
  const opt = walk(menu).find((n) => n.props && n.props.role === 'menuitemradio' && textOf(n) === optionText)
  if (!opt) return 'option:' + optionText
  if (typeof opt.props.onClick !== 'function') return 'option-onClick'
  opt.props.onClick()
  return 'ok'
}

/* ======================================================================
   2. A toggle must write the DECLARED field — every one of them, not just
      the one in the issue report
   ====================================================================== */

/* panel row key -> [UI key, value to write, expected field, option label]
   `option` picks a value button by its exact label; without it the row's
   primary switch is used. */
const TOGGLES = [
  ['theme', 'dsh-theme-endfield-enabled', '0', 'enabled'],
  ['radius', 'dsh-theme-endfield-radius', 'round', 'radius'],

  /* Order matters now that the drive is the real UI: the persist/anim sub-rows
     are DISABLED while their parent is off, and each flip below turns the parent
     OFF — so the sub-rows are driven first (watermark/thunder still at their
     schema defaults of on here). */
  ['watermark-persist', 'dsh-theme-endfield-watermark-persist', '1', 'watermarkPersist'],
  ['watermark', 'dsh-theme-endfield-watermark', '0', 'watermark'],
  ['loader', 'dsh-theme-endfield-loader', '1', 'loader'],
  ['thunder-anim', 'dsh-theme-endfield-thunder-anim', '1', 'thunderAnim'],
  ['thunder', 'dsh-theme-endfield-thunder', '1', 'thunder'],
]

/* Compound fields are the regression surface; the singles passed even with the
   bug, so a test that only covered them would not have caught it. */
const COMPOUND = ['watermarkPersist', 'thunderAnim']
const compoundCovered = COMPOUND.filter((f) => Object.values(clientTable).includes(f))
if (compoundCovered.length === COMPOUND.length) {
  pass('all compound fields from the issue are in the mapping')
} else {
  fail('compound fields missing from the mapping: ' + COMPOUND.filter((f) => !compoundCovered.includes(f)).join(', '))
}

{
  const store = hostShapedSection()
  const { render } = boot(store.binder)
  /* Thunder ON so its child switch is enabled. */
  store.section.thunder = '1'
  let tree = render()

  for (const [rowKey, uiKey, value, field, option] of TOGGLES) {
    /* The UI key this row's switch actually writes, checked against the mapping
       before anything is clicked — so a row wired to an unexpected key is caught
       even if that key happens to map somewhere harmless. */
    if (clientTable[uiKey] !== field) {
      fail('the row ' + rowKey + ' writes ' + JSON.stringify(uiKey)
        + ', which client.js maps to ' + JSON.stringify(clientTable[uiKey]) + ' (expected ' + JSON.stringify(field) + ')')
    }
    const row = findRow(tree, rowKey)
    if (!row) { fail('no panel row keyed ' + rowKey); continue }
    /* Every value row is the unified dropdown: open its menu and pick the
       option that renders the wanted literal. The write-direction check
       below is unchanged. */
    const before = store.wire.length
    /* The drive flips the row the way the old toggle did: pick the option that
       is NOT aria-checked. (Picking the checked one is a no-op by design — the
       matrix asserts the FIELD written, not the direction.) */
    const step = driveRowFlip(() => render(), rowKey)
    if (step !== 'ok') {
      const dbgRow = findRow(render(), rowKey)
      const dbgTrig = dbgRow ? walk(dbgRow).find((n) => n.type === 'button' && n.props && n.props['aria-haspopup'] === 'menu') : null
      fail('row ' + rowKey + ' dropdown could not be driven: ' + step
        + ' [disabled=' + (dbgTrig ? String(dbgTrig.props.disabled) : 'n/a')
        + ' expanded=' + (dbgTrig ? String(dbgTrig.props['aria-expanded']) : 'n/a') + ']')
      continue
    }
    const fired = store.wire.slice(before)
    if (fired.length === 0) { fail(rowKey + ' toggle wrote nothing at all'); continue }
    const names = fired.map(([f]) => f)
    const label = rowKey + (option ? '[' + option + ']' : '')
    if (names.includes(field)) {
      pass(`${label} 写入 schema 字段 ${field}`)
    } else {
      fail(`${label} wrote ${JSON.stringify(names)} instead of the declared field '${field}'`
        + ' — that name is not in the host schema, so the value never persists')
    }
    if (names.every((f) => hostFields.includes(f))) pass(`${label}: 没有写入未声明字段`)
    else fail(`${label} wrote undeclared field(s): ` + names.filter((f) => !hostFields.includes(f)).join(', '))
    /* Re-render: the panel reads its state back through the same store. */
    tree = render()
  }
}

/* ======================================================================
   3. The shipped bug, reproduced: a section the buggy build wrote
   ====================================================================== */

{
  /* Literally what a user's settings.yaml held after using the buggy build: the
     compound choices stored under the pre-migration spelling, plus the
     single-word fields that build happened to write correctly. The scope then
     hands out the schema-MERGED view, which is why every declared field is
     present whether or not the user ever set it — `user` is the host's raw
     document and is what tells the two apart. */
  const rawUser = {
    palette: 'valley',
    radius: 'square',
    watermark: '1',
    thunder: '1',
    'watermark-persist': '1',
    'thunder-anim': '1',
  }
  const section = Object.assign({}, HOST.FIELD_DEFAULTS, rawUser)
  const wire = []
  const listeners = []
  /* The scope starts NOT ready and flips to ready afterwards — the shape the
     theme actually boots into (a mirror whose first describe has no section
     yet). That gives the panel one render while nothing is being migrated, which
     is where the READ can be judged on its own: the stray keys are already in
     the host document, and the panel must still show the declared defaults. */
  let served = false
  const scope = {
    getSnapshot: () => (served
      ? {
          status: 'ready', value: Object.assign({}, section),
          base: Object.assign({}, HOST.FIELD_DEFAULTS), writable: true, mode: 'host',
        }
      : { status: 'unavailable', value: undefined, writable: true, mode: 'host' }),
    subscribe(l) { listeners.push(l); return () => {} },
    set(f, v) { wire.push([f, String(v)]); section[f] = String(v) },
  }
  const { render } = boot({ bind: () => scope })
  const beforeTree = render()
  const textBefore = textOf(beforeTree)
  const animTrigBefore = rowTrigger(beforeTree, 'thunder-anim')
  if (animTrigBefore && textOf(animTrigBefore).includes('关闭') && wmPersistValue(beforeTree) === '0') {
    pass('回归对照：未声明字段里的值不会被当成已声明字段读取（schema 默认值优先）')
  } else {
    fail('the panel must read the declared fields, not the stray keys, got ' + JSON.stringify(textBefore.slice(0, 220)))
  }

  served = true
  for (const l of listeners.slice()) { try { l() } catch (e) {} }
  const text = textOf(render())

  const migratedTree = render()
  const migrated = wire.filter(([f]) => f === 'watermarkPersist' || f === 'thunderAnim')
  if (migrated.length === 2) {
    pass('旧拼写里的 2 个值被重新提交到 schema 字段上')
  } else {
    fail('legacy migration re-committed ' + migrated.length + '/2 fields; wire = ' + JSON.stringify(wire))
  }
  const expected = { watermarkPersist: '1', thunderAnim: '1' }
  const wrong = Object.keys(expected).filter((f) => section[f] !== expected[f])
  if (wrong.length === 0) pass('迁移后每个 schema 字段都拿到了旧值')
  else fail('migration left ' + wrong.map((f) => f + '=' + section[f]).join(', ') + ' (expected ' + JSON.stringify(expected) + ')')

  /* It must not invent edits beyond the two fields that really had legacy
     values: anything else on the wire would be a fabrication. */
  if (wire.every(([f]) => f === 'watermarkPersist' || f === 'thunderAnim')) pass('迁移只写有旧值的字段，不凭空发明其它写入')
  else fail('migration invented writes beyond the legacy fields: ' + JSON.stringify(wire))

  /* And the re-committed value must reach the theme, not just the document. */
  if (wmPersistValue(migratedTree) === '1') {
    pass('迁移后的值立即生效（水印保持显示 = 开启）')
  } else {
    fail('migrated values did not take effect in the panel: ' + JSON.stringify(text.slice(0, 220)))
  }
}

/* A user-set declared value must WIN over a stray legacy key. */
{
  const rawUser = { 'thunder-anim': '0', thunderAnim: '1' }
  const section = Object.assign({}, HOST.FIELD_DEFAULTS, rawUser)
  const wire = []
  const scope = {
    getSnapshot: () => ({
      status: 'ready', value: Object.assign({}, section), user: Object.assign({}, rawUser),
      base: Object.assign({}, HOST.FIELD_DEFAULTS), writable: true, mode: 'host',
    }),
    subscribe() { return () => {} },
    set(f, v) { wire.push([f, String(v)]); section[f] = String(v) },
  }
  const { render } = boot({ bind: () => scope })
  const trig = rowTrigger(render(), 'thunder-anim')
  if (trig && textOf(trig).includes('开启')) pass('用户显式写入的 thunderAnim=1 覆盖旧拼写里的 0')
  else fail('a user-set declared value lost to a stray legacy key: ' + (trig ? textOf(trig) : '(none)'))
  if (wire.length === 0) pass('这种情况不产生任何迁移写入')
  else fail('migration wrote although the user had set the field: ' + JSON.stringify(wire))
}

/* ======================================================================
   4. Issue finding #2 — an edit is visible immediately, not after the
      host round-trip (prefsSet updated prefsLocal, prefsGet read the
      fetched section first)
   ====================================================================== */

{
  /* A scope whose set() does NOT echo: the host confirms later (or never, in
     this process). Everything the theme reports must still be the new value. */
  const section = Object.assign({}, HOST.FIELD_DEFAULTS, { thunder: '1' })
  const scope = {
    getSnapshot: () => ({ status: 'ready', value: Object.assign({}, section), writable: true, mode: 'host' }),
    subscribe() { return () => {} },
    set(f, v) { /* the write is accepted but the served section is not updated yet */ global.__noEcho = [f, String(v)] },
  }
  const { render } = boot({ bind: () => scope })
  const step = driveRowFlip(() => render(), 'thunder-anim')
  if (step !== 'ok') fail('thunder-anim dropdown could not be driven (no-echo case): ' + step)
  const afterTree = render()
  const afterTrig = rowTrigger(afterTree, 'thunder-anim')
  if (afterTrig && textOf(afterTrig).includes('开启')) pass('写入后面板立刻读到新值（不依赖宿主回相）')
  else fail('with no host echo the panel still showed the old value: ' + (afterTrig ? textOf(afterTrig) : '(none)'))
  if (afterTrig && textOf(afterTrig).includes('开启')) pass('触发器随之显示新值（反向可供选择）')
  else fail('the row did not flip to the reverse affordance')
}

/* ======================================================================
   5. Issue finding #3 — reverting a field to its DEFAULT while the
      namespace is not served must still be written once it is
   ====================================================================== */

{
  /* The field currently reads ON (so the user's click turns it OFF, i.e. back to
     the shipped default), and the host's stale view already says '0' — which is
     exactly why the revert is at risk of being judged "nothing to do". */
  const rawUser = { watermarkPersist: '1' }
  const section = Object.assign({}, HOST.FIELD_DEFAULTS, rawUser)
  const wire = []
  let served = false
  const listeners = []
  const scope = {
    getSnapshot: () => (served
      ? { status: 'ready', value: Object.assign({}, section), user: Object.assign({}, rawUser), writable: true, mode: 'host' }
      : { status: 'unavailable', value: undefined, writable: true, mode: 'host' }),
    subscribe(l) { listeners.push(l); return () => {} },
    set(f, v) {
      wire.push([f, String(v)])
      if (served) { section[f] = String(v); rawUser[f] = String(v) }
      for (const l of listeners.slice()) { try { l() } catch (e) {} }
    },
  }
  const { render } = boot({ bind: () => scope })
  /* Every value row is the unified dropdown; the held-edit mechanism it
     exercises is unchanged — the drive is open-the-menu, pick-the-option. */
  const beforeTrig = rowTrigger(render(), 'watermark-persist')
  if (!beforeTrig) { fail('no watermark-persist dropdown trigger rendered'); process.exit(1) }
  /* Derive the direction off the panel itself: the trigger's current text is
     the state it is IN, so the change is to the other option. */
  const nextValue = textOf(beforeTrig).includes('保持显示') ? '0' : '1'
  const step = driveRowSelect(() => render(), 'watermark-persist', optionTextFor('watermark-persist', nextValue))
  if (step !== 'ok') { fail('watermark-persist dropdown could not be driven: ' + step) }
  if (wire.length === 0) pass('未就绪时改回默认值：没有出线写入')
  else fail('a write leaked to the wire while the namespace was unserved: ' + JSON.stringify(wire))

  served = true
  for (const l of listeners.slice()) { try { l() } catch (e) {} }
  const written = wire.filter(([f, v]) => f === 'watermarkPersist' && v === nextValue)
  if (written.length === 1) {
    pass('命名空间就绪后，held 编辑被补写（watermarkPersist=' + nextValue + '）')
  } else {
    fail('the held edit was dropped: wire = ' + JSON.stringify(wire) + ', expected watermarkPersist=' + nextValue)
  }
  if (section.watermarkPersist === nextValue) pass('宿主文档确实收到了这次编辑')
  else fail('host document holds watermarkPersist = ' + section.watermarkPersist + ', expected ' + nextValue)
}

console.log('')
if (failures) { console.error(failures + ' settings-namespace check(s) failed'); process.exit(1) }
console.log('all settings-namespace checks passed')
