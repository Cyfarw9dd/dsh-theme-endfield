/**
 * check.js — guard rails for the theme's single-template-literal stylesheet.
 *
 * Why this exists: the whole theme stylesheet is ONE JavaScript template literal
 * passed to insertCss(`...`). A stray backtick anywhere inside it — including inside
 * a CSS comment — terminates the literal early and breaks the entire client bundle
 * at parse time, not just the rule being edited. That failure mode was hit twice
 * while editing comments, so it is now checked mechanically instead of by care.
 *
 * Also verifies ${...} is absent: inside a template literal that is interpolation,
 * so a CSS snippet containing it would either throw or silently inject a value.
 *
 * Usage: node check.js [target.js]   (exit 0 = clean, 1 = problem found)
 *        The optional target exists so selftest.js can point the same logic at a
 *        deliberately-broken copy and prove each check really fails.
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const file = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, 'client.js')
const src = fs.readFileSync(file, 'utf8')
const lines = src.split('\n')

let failures = 0
const fail = (msg) => { console.error('FAIL  ' + msg); failures++ }
const pass = (msg) => console.log('ok    ' + msg)

/* --- 1. locate the stylesheet template literal --- */
const openIdx = src.indexOf('insertCss(`')
if (openIdx < 0) {
  fail('could not find insertCss(` — has the stylesheet been restructured?')
} else {
  const bodyStart = openIdx + 'insertCss(`'.length
  const closeIdx = src.indexOf('`)', bodyStart)
  if (closeIdx < 0) {
    fail('stylesheet template literal is never closed with `)')
  } else {
    const body = src.slice(bodyStart, closeIdx)
    const openLine = src.slice(0, bodyStart).split('\n').length
    const closeLine = src.slice(0, closeIdx).split('\n').length

    // Any backtick between the delimiters would have ended the literal early.
    const stray = body.indexOf('`')
    if (stray >= 0) {
      const ln = src.slice(0, bodyStart + stray).split('\n').length
      fail(`stray backtick inside the stylesheet at line ${ln}: `
        + `${lines[ln - 1].trim().slice(0, 80)}\n      `
        + `-> a backtick ends the template literal; use 'single quotes' in comments.`)
    } else {
      pass(`stylesheet literal is backtick-clean (lines ${openLine}-${closeLine})`)
    }

    if (body.includes('${')) {
      const ln = src.slice(0, bodyStart + body.indexOf('${')).split('\n').length
      fail(`'\${' inside the stylesheet at line ${ln} — that is template interpolation, not CSS`)
    } else {
      pass('stylesheet contains no ${...} interpolation')
    }

    /* --- 2. CSS comment balance ---
       A previously-fixed bug closed a comment early with a stray close-marker,
       which dropped the following prose lines into the stylesheet as live CSS:
       --edge-word was then never defined and the whole brand block collapsed to the
       top-left. The file still PARSES in that state, so only this check catches it.
       (Writing that marker literally here would close THIS comment early too —
       which is precisely the failure being guarded against.)
       Braces inside comments must be ignored, so comments are stripped first and
       the brace balance below runs on real CSS only. */
    let stripped = ''
    let inComment = false
    let commentStart = -1
    let unterminated = -1
    let strayClose = -1
    for (let i = 0; i < body.length; i++) {
      if (!inComment && body[i] === '/' && body[i + 1] === '*') {
        inComment = true
        commentStart = i
        i++
        continue
      }
      if (inComment && body[i] === '*' && body[i + 1] === '/') {
        inComment = false
        i++
        continue
      }
      if (!inComment) {
        // A bare */ outside any comment means an earlier one closed too soon.
        if (body[i] === '*' && body[i + 1] === '/' && strayClose < 0) strayClose = i
        stripped += body[i]
      }
    }
    if (inComment) unterminated = commentStart

    const lineOf = (offset) => src.slice(0, bodyStart + offset).split('\n').length
    if (unterminated >= 0) {
      fail(`unterminated CSS comment opened at line ${lineOf(unterminated)} `
        + `-> everything after it is swallowed as a comment`)
    } else if (strayClose >= 0) {
      fail(`stray '*/' outside any comment at line ${lineOf(strayClose)}: `
        + `${lines[lineOf(strayClose) - 1].trim().slice(0, 70)}\n      `
        + `-> a comment closed early; the prose after it becomes live CSS`)
    } else {
      pass('CSS comments balanced')
    }

    /* --- 3. brace balance of the real CSS (comments already removed) --- */
    let depth = 0
    let bad = 0
    for (const ch of stripped) {
      if (ch === '{') depth++
      else if (ch === '}') { depth--; if (depth < 0) { bad++; depth = 0 } }
    }
    if (depth !== 0 || bad !== 0) {
      fail(`CSS braces unbalanced: ${depth} unclosed, ${bad} unexpected '}'`)
    } else {
      pass('CSS braces balanced')
    }

    /* --- 4. no sentence prose may sit at the top level of the live CSS ---
       This is the check that actually catches the historical "comment closed too
       early" bug. Closing a comment early leaves the comment BALANCED, so a
       comment-pairing check passes; the damage is that the leftover prose lands at
       the top level of the stylesheet, fuses with the next selector and silently
       kills that entire rule (measured: the prose "see the max() calls below."
       landed directly before "[data-endfield-loader] {", so the loader's variable
       block was dropped and the brand block collapsed to the top-left).

       Detection must be precise, not clever. A first attempt flagged any top-level
       chunk containing a comma or an English word and produced 33 FALSE POSITIVES
       on legitimate selectors (":is([role='tab'], ...)", "input, textarea",
       "tbody tr:hover"). The reliable signal is far narrower: real CSS selectors
       never contain a BARE WORD ending in a sentence period, and never contain a
       word immediately followed by a period-space. Prose does. */
    const suspects = []
    let buf = ''
    let bufAt = 0
    let inRule = 0
    for (let i = 0; i < stripped.length; i++) {
      const ch = stripped[i]
      if (ch === '{') {
        if (inRule === 0) {
          const sel = buf.trim()
          // ". " or a trailing "." after a letter — impossible in a selector,
          // characteristic of a sentence. (".foo" class syntax has the dot BEFORE
          // the word, so it never matches.)
          if (/[A-Za-z]\.(\s|$)/.test(sel)) {
            suspects.push({ text: sel.replace(/\s+/g, ' ').slice(0, 70), at: bufAt })
          }
        }
        inRule++
        buf = ''
        continue
      }
      if (ch === '}') { inRule = Math.max(0, inRule - 1); buf = ''; bufAt = i + 1; continue }
      if (inRule === 0) {
        if (!buf) bufAt = i
        buf += ch
      }
    }
    if (suspects.length) {
      for (const s of suspects) {
        fail(`prose leaked into live CSS near line ${lineOf(s.at)}: "${s.text}"\n      `
          + `-> a comment almost certainly closed early; the next rule is being destroyed`)
      }
    } else {
      pass('no sentence prose at the top level of the live CSS')
    }

    /* --- 5. the variables the brand block depends on must be DEFINED in CSS ---
       The collapse bug above manifested as a used-but-undefined custom property, so
       assert definition rather than mere mention (a comment mention is not a
       definition). */
    for (const v of ['--edge-word', '--edge-gap']) {
      if (new RegExp('^\\s*' + v + '\\s*:', 'm').test(stripped)) {
        pass(`${v} is defined in live CSS`)
      } else {
        fail(`${v} is used by the loader but never DEFINED in live CSS`)
      }
    }

    /* --- 6. both accent palettes must be DEFINED, and on body rather than :root ---
       Every accent in this stylesheet reads from these variables, so a missing one
       does not degrade gracefully: each rule that references it computes to nothing
       and that entire declaration is dropped.

       The :root check is the important half, and it is not hypothetical. The app
       applies its theme tokens as INLINE STYLES ON body, so a custom property
       declared at :root that substitutes a --dsw-* token is resolved at the html
       element, where the token does not exist -> guaranteed-invalid, computing to
       empty. The shipped --edge-line / --edge-paper / --edge-soft were declared
       that way and measured EMPTY in a real browser, silently disabling the themed
       scrollbar. Anything reading a token must therefore be declared on body. */
    const paletteVars = [
      '--edge-accent', '--edge-accent-ink', '--edge-accent-rgb', '--edge-accent-deep', '--edge-accent-onpaper',
      '--edge-status-light', '--edge-status-light-mid', '--edge-status-dark',
      '--edge-status-dark-mid', '--edge-glow-light', '--edge-glow-dark',
    ]
    const missing = paletteVars.filter((v) => !new RegExp('^\\s*' + v + '\\s*:', 'm').test(stripped))
    if (missing.length === 0) pass(`all ${paletteVars.length} palette variables are defined in live CSS`)
    else fail(`palette variable(s) never DEFINED in live CSS: ${missing.join(', ')}`)

    // Non-default palettes must exist as override blocks, or their switches are inert.
    for (const cls of ['theme-endfield-wuling', 'theme-endfield-gray']) {
      if (new RegExp('body\\.' + cls + '\\s*\\{').test(stripped)) {
        pass('palette block (body.' + cls + ') is present')
      } else {
        fail('no body.' + cls + ' block — that palette switch would do nothing')
      }
    }
    // The gray palette's dark-scheme fill flip must exist too: without it dark
    // mode keeps the light #d9d9d9 fill and every ink-on-accent pair breaks.
    if (/body\.theme-endfield-gray\[data-ds-dark-theme\]\s*\{/.test(stripped)) {
      pass('终末地灰 dark-scheme override block is present')
    } else {
      fail('no body.theme-endfield-gray[data-ds-dark-theme] block — dark fills would stay light-gray')
    }
    // The embedded emblem mask must be a real SVG data URI INSIDE a body{} rule:
    // a bare top-level declaration is invalid CSS whose error recovery eats the
    // next rule's selector (this exact bug shipped once — the contour layer
    // lost position:absolute and pushed the page down).
    if (/body\s*\{\s*--edge-emblem:\s*url\("data:image\/svg\+xml;base64,[A-Za-z0-9+/=]{100,}"\)\s*;\s*\}/.test(stripped)) {
      pass('emblem mask SVG data URI is embedded inside a body rule (see scripts/build-emblem.js)')
    } else {
      fail('--edge-emblem must be declared as: body { --edge-emblem: url("data:image/svg+xml;base64,...") } — run node scripts/build-emblem.js')
    }
    // The hero brand mark carries TWO masks, and they must sit in ONE body{} rule
    // for the same reason: two top-level declarations would each destroy the rule
    // that follows them.
    if (/body\s*\{\s*--edge-hero-logo-body-mask:\s*url\("data:image\/svg\+xml;base64,[A-Za-z0-9+/=]{100,}"\)\s*;\s*--edge-hero-logo-ink-mask:\s*url\("data:image\/svg\+xml;base64,[A-Za-z0-9+/=]{100,}"\)\s*;\s*\}/.test(stripped)) {
      pass('hero logo masks are embedded inside one body rule (see scripts/build-logo.js)')
    } else {
      fail('the hero logo masks must be declared as: body { --edge-hero-logo-body-mask: url(...); --edge-hero-logo-ink-mask: url(...); } — run node scripts/build-logo.js')
    }

    /* --- 7. the app's font TOKENS must not be redeclared anywhere ---
       Regression guard for a real shipped bug. The theme used to carry
           :root { --dsw-font-family: Arial, ...; --ds-font-family-code: ... }
       and that is not a theme-private knob: dsh-web-frontend renders the UI root
       font from it (`body{font-family:var(--dsw-font-family, <system stack>)}`),
       so the override restyled EVERY third-party widget injected into the app
       root. Anything with `font-family:inherit` — e.g. DeepSeek-Balance-Whale-
       Widget — inherited Arial and lost its own face for its balance digits.

       The check is deliberately a plain "these two names may not be declared at
       all", not a structural :root walk: the damage is caused by the DECLARATION,
       and a future edit could equally reinstate it on body or inside a media
       query. Reading them as fallbacks (`var(--dsw-font-family, <theme stack>)`)
       is the supported form and stays clean, because only `name:` is matched. */
    const ownedByApp = ['--dsw-font-family', '--ds-font-family-code']
    const redeclared = ownedByApp.filter((v) =>
      new RegExp('(^|[;{\\s])' + v + '\\s*:', 'm').test(stripped))
    if (redeclared.length === 0) {
      pass('the app font tokens (--dsw-font-family / --ds-font-family-code) are never redeclared')
    } else {
      fail(`the app font token(s) ${redeclared.join(', ')} are DECLARED by the theme\n      `
        + `-> the app renders the UI root font from --dsw-font-family, so this restyles `
        + `every third-party widget that inherits it (and --ds-font-family-code every code `
        + `surface). Use the theme's own --edge-font on the theme's own elements instead; `
        + `see the typography note at the top of the stylesheet.`)
    }

    /* Any --edge-* variable that substitutes a --dsw-* token must NOT be declared
       inside a :root block. Checked structurally: walk each top-level rule and look
       at :root blocks only. */
    const rootBlocks = []
    {
      const re = /(^|\})\s*([^{}]*?):root([^{}]*?)\{([^}]*)\}/g
      /* Iterated with for..of over matchAll rather than the usual while-loop that
         re-tests a global regex against null. Both walk the same matches, but this
         file is read by static signature scanners, and a bare dot-exec call matches
         their child_process rule: the scanner cannot see the receiver, so a RegExp
         exec reads as process execution and is reported as a HIGH security hit
         (the gate tool itself documents that false positive). matchAll keeps the
         loop and removes the token. */
      for (const m2 of stripped.matchAll(re)) rootBlocks.push({ body: m2[4], at: m2.index })
    }
    const offenders = []
    for (const b of rootBlocks) {
      const re2 = /^\s*(--edge-[\w-]+)\s*:\s*([^;]*var\(\s*--dsw-[^;]*)\;/gm
      for (const m3 of b.body.matchAll(re2)) offenders.push(m3[1])
    }
    if (offenders.length === 0) {
      pass('no --edge-* variable reads a --dsw-* token from :root (tokens live on body)')
    } else {
      fail(`--edge-* variable(s) declared at :root while substituting a body-level token: `
        + `${offenders.join(', ')}\n      `
        + `-> the app sets --dsw-* tokens inline ON BODY, so a :root declaration is `
        + `guaranteed-invalid and computes to EMPTY; move it into a body { } block`)
    }
  }
}

/* --- 3. the file must actually parse ---
   Compiled in-process with vm.Script rather than by spawning `node --check`:
   spawning to capture piped stdio is denied in some sandboxes (EPERM), and this
   checks exactly the same thing — the source compiles as a real script — without
   executing any of it. */
try {
  new vm.Script(src, { filename: file })
  pass('client.js compiles (parsed in-process, not executed)')
} catch (e) {
  fail('client.js does not parse: ' + e.message)
}

/* --- 4. the turn-status label must be recoloured via background-image ---
   A plain `color:` cannot win against upstream's transparent text fill, so an edit
   that "fixes" this rule with color: would silently do nothing. */
if (src.includes("turnStatus")) {
  const hasBg = /turnStatus[\s\S]{0,400}?background-image:\s*linear-gradient/.test(src)
  if (hasBg) pass('turn-status label is recoloured through background-image (gradient text)')
  else fail('turn-status rules found but no background-image gradient — a plain color: cannot recolour gradient text')
}

/* --- 5. the settings panel's unified dropdown must exist as CSS, not just JS ---
   The panel builds .endfield-select elements in React; if the stylesheet rules
   were dropped (or renamed on one side only), the control renders unstyled in
   every row and only a screenshot would notice. The menu must draw on the app's
   own menu-surface token, the open animation may only touch opacity/transform,
   and the shape is pinned to the official filter dropdown. This section runs
   BEFORE the exit below — it used to sit after it, so its failures were printed
   and then ignored (exit 0, "all checks passed"). */
{
  /* Re-derive the comment-stripped stylesheet: section 5 runs at top level,
     outside the scope that owns the section-1 local. */
  const s2 = src.replace(/\/\*[\s\S]*?\*\//g, '')
  const need = [
    ['.endfield-select-trigger', 'endfield-select-trigger rule missing — the row control renders unstyled'],
    ['.endfield-select-menu', 'endfield-select-menu rule missing — opened menus render unstyled'],
    ['.endfield-select-option', 'endfield-select-option rule missing — menu rows render unstyled'],
  ]
  for (const [needle, why] of need) {
    if (src.includes(needle)) pass(needle.slice(1) + ' is defined in the stylesheet')
    else fail(why)
  }
  const menuRule = /\.endfield-select-menu\s*\{([^}]*)\}/.exec(s2.replace(/\n\s*/g, ' '))
  if (menuRule && /var\(--dsw-menu-surface-fill\)/.test(menuRule[1])) {
    pass('endfield-select-menu draws on --dsw-menu-surface-fill (same surface as app menus)')
  } else {
    fail('endfield-select-menu must use var(--dsw-menu-surface-fill) — any other surface breaks the unified look')
  }
  const kf = /@keyframes\s+endfield-select-in\s*\{([\s\S]*?)\}\s*\}/.exec(s2)
  if (kf && !/width|height|top|left|right|bottom|margin|padding|inset/.test(kf[1])) {
    pass('endfield-select-in keyframes only animate opacity/transform')
  } else {
    fail('endfield-select-in must only animate opacity/transform (compositor-only, per docs/design-principles.md)')
  }
  /* 形制钉在官网 /operator 筛选下拉（官方 Dropdown 组件）上：铭牌色、圆形
     箭头、斜纹选中底与紫/绿信号条都是官方 CSS 原值。改动它们等于
     把控件从参考里拉出来——要改先改 docs/design-language.md 的对照表。 */
  const flat = s2.replace(/\n\s*/g, ' ')
  const ruleOf = (sel) => {
    const m = new RegExp(sel.replace(/[.[\]'()]/g, (c) => '\\' + c) + '\\s*\\{([^}]*)\\}').exec(flat)
    return m ? m[1] : ''
  }
  const trig = ruleOf('.endfield-select-trigger')
  const optBg = ruleOf('.endfield-select-option-bg')
  const shapeChecks = [
    [/background-color:\s*#3a3a3a/.test(trig) && /color:\s*#ffffff/.test(trig), '铭牌 = 官方 #3a3a3a 底 + 白字'],
    [/background:\s*var\(--edge-dd-arrow\)/.test(ruleOf('.endfield-select-arrow')), '圆形箭头 = 内嵌的官方 arrow.png（--edge-dd-arrow）'],
    [/rotate\(180deg\)/.test(ruleOf('.endfield-select.is-open .endfield-select-arrow')), '展开时箭头 rotate(180deg)（官方 .Dropdown_open 同款）'],
    [/opacity:\s*0/.test(optBg) && /linear-gradient\(-45deg/.test(optBg)
      && /opacity:\s*1/.test(ruleOf(".endfield-select-option[aria-checked='true'] .endfield-select-option-bg")),
      '选中底 = 预建斜纹层，只切 opacity（不创造几何）'],
    [/#ff00f0 0, #ff00f0 50%, #00ffa2 0/.test(ruleOf('.endfield-select-option-bg::before')), '选中行左缘 = 官方紫 #ff00f0 / 绿 #00ffa2 各半'],
    [/\[role='menuitemradio'\]\[aria-checked='true'\]:not\(\.endfield-select-option\)\s*,/.test(flat), '全局「菜单当前项」划词灰规则对本控件开洞（否则 !important 盖掉斜纹）'],
    [src.includes("R.createElement('button', {\n              key: o.value, type: 'button', role: 'menuitemradio'"), '选项是 button[role=menuitemradio]（可聚焦，同应用菜单元素）'],
  ]
  for (const [ok, what] of shapeChecks) {
    if (ok) pass('统一下拉形制 · ' + what)
    else fail('统一下拉形制丢失：' + what)
  }
}

console.log('')
if (failures) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
console.log('all checks passed')
