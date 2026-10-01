/**
 * hero-logo.test.js — the new-session brand mark: where it lands, which anchor it
 * accepts, and the two colours it is allowed to paint with.
 *
 * WHAT THIS PROVES, AND WHY EACH PART EXISTS
 *   1. GEOMETRY. The mark is injected into the app's own centred column and must
 *      sit ABOVE the headline ('探索未至之境'), centred on it. "Above" is measured
 *      from real rects, not from DOM order alone: a mark that lands beside the
 *      headline is in the right parent and still wrong.
 *   2. BOTH ANCHOR GENERATIONS. 0.2.0-rc.2 renders the headline ROW as
 *      '*_headline' (fish + title group); 0.1.x rendered the text node as
 *      '*_headlineText'. The theme accepts either, and this runs the fixture twice
 *      because the selector that works for one silently does nothing for the other.
 *   3. COLOUR, FROM THE SOURCE FILE. The mark is painted through alpha masks, so
 *      the stylesheet decides every colour it shows. What it must show is the
 *      artwork's own palette — in BOTH schemes, by the owner's decision — so this
 *      decodes assets/hero-logo-3-summer.png and compares the browser's computed
 *      values against it. That is a brand-fidelity invariant, not a contrast bar:
 *      the logotype is exempt from WCAG's minimums, and the light scheme's low
 *      ratios (1.25 / 1.12 / 1.22:1 on cream) are printed as the recorded
 *      consequence. The failure it catches is a colour drifting into an invented
 *      value, or a scheme quietly keeping an override nobody asked for.
 *   4. THE PAGE IT MUST NOT APPEAR ON. An active conversation gets no mark.
 *
 * Usage: node test/hero-logo.test.js     (needs CHROME_PATH; see docs/testing.md)
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')
const { BROWSER_SETTINGS_SCOPE_SNIPPET } = require(path.join(__dirname, 'fixtures', 'settings-scope.browser.js'))

const ROOT = path.resolve(__dirname, '..')
const OUT = process.env.ENDFIELD_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'endfield-herologo-'))
const chrome = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean).find((p) => fs.existsSync(p))
if (!chrome) { console.error('FAIL  no Chrome/Edge found (set CHROME_PATH)'); process.exit(1) }

let failures = 0
const fail = (m) => { console.error('FAIL  ' + m); failures++ }
const pass = (m) => console.log('ok    ' + m)

/* ---------- colour maths (sRGB, WCAG 2.x) — same functions as palette-contrast ---------- */
const parse = (c) => {
  const s = String(c).trim()
  const rgb = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  const h = s.replace('#', '')
  const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05) }

/* ---------- the artwork's own palette, decoded from the real source file ----------
   The mark is painted through alpha masks, so the only thing that decides its
   colour is the stylesheet. That colour is the artwork's own, on both schemes
   (owner's call — see the note in client.js), so the test does not restate the hex
   values: it decodes them out of assets/hero-logo-3-summer.png and compares what
   the browser PAINTS against them. Restating them here would only test the copy.
   Flat art makes the extraction unambiguous: one neutral (the wordmark) plus two
   yellows, the more frequent of which is the body and the rarer the hatching. */
const zlib = require('zlib')
const decodeRgba = (file) => {
  const buf = fs.readFileSync(file)
  let i = 8
  let w = 0; let h = 0; let depth = 0; let colourType = 0
  const idat = []
  while (i < buf.length) {
    const len = buf.readUInt32BE(i)
    const type = buf.toString('ascii', i + 4, i + 8)
    const data = buf.subarray(i + 8, i + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; colourType = data[9] } else if (type === 'IDAT') idat.push(data)
    i += 12 + len
  }
  if (depth !== 8 || colourType !== 6) throw new Error('assets/hero-logo-3-summer.png must stay 8-bit RGBA')
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * 4
  const out = Buffer.alloc(stride * h)
  let prev = Buffer.alloc(stride)
  for (let y = 0, p = 0; y < h; y++) {
    const filter = raw[p++]
    const line = Buffer.from(raw.subarray(p, p + stride)); p += stride
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? line[x - 4] : 0
      const b = prev[x]
      const c = x >= 4 ? prev[x - 4] : 0
      if (filter === 1) line[x] = (line[x] + a) & 255
      else if (filter === 2) line[x] = (line[x] + b) & 255
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a); const pb = Math.abs(pp - b); const pc = Math.abs(pp - c)
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
      }
    }
    line.copy(out, y * stride)
    prev = line
  }
  return { w, h, data: out }
}
const artworkColours = () => {
  const { w, h, data } = decodeRgba(path.join(ROOT, 'assets', 'hero-logo-3-summer.png'))
  const counts = new Map()
  for (let p = 0; p < w * h; p++) {
    if (data[p * 4 + 3] < 128) continue
    const hex = '#' + [0, 1, 2].map((k) => data[p * 4 + k].toString(16).padStart(2, '0')).join('')
    counts.set(hex, (counts.get(hex) || 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([hex, n]) => ({ hex, n, rgb: parse(hex) }))
  const neutral = top.filter((c) => Math.max(...c.rgb) - Math.min(...c.rgb) <= 8)
  const yellows = top.filter((c) => c.rgb[0] > 200 && c.rgb[1] > 170 && c.rgb[2] < 120)
  if (neutral.length < 1 || yellows.length < 2) {
    throw new Error('the artwork no longer carries one neutral + two flat yellows — inspect the source before trusting this test')
  }
  return { ink: neutral[0].hex, body: yellows[0].hex, hatch: yellows[1].hex }
}

/* ---------- the two real hero shapes ----------
   Every class name and every token below is copied from the installed bundles, so
   the fixture fails the same way the app would if the theme's selectors drifted.
   The 0.2.0-rc.2 shape is the LIVE one; the 0.1.x shape is kept because the
   theme still supports it (a hash-free suffix is the only thing that survives a
   DSH upgrade, and the previous release proves the rename happens). */
const HERO_02 = `<div class="pXSMma_root"><div class="pXSMma_stack">
      <div class="pXSMma_headline"><span class="pXSMma_fishHitbox"></span><span class="pXSMma_titleGroup"><span>探索未至之境</span></span></div>
      <div class="pXSMma_body"><div class="composer">Message DeepSeek Harness…</div></div>
    </div></div>`
const HERO_01 = `<div class="wSkVaW_composerStack wSkVaW_composerHero">
      <div class="AvZvRG_headlineText">探索未至之境</div>
      <div class="composer">Message DeepSeek Harness…</div>
    </div>`

const page = (dark, generation, hero) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body,#root{height:100%;margin:0}
  :root{
    --dsw-alias-bg-base:${dark ? '#101110' : '#e8e8e2'};
    --dsw-alias-bg-layer-1:${dark ? '#181a18' : '#f2f2ec'};
    --dsw-alias-bg-layer-3:${dark ? '#2c2e2a' : '#dcddd6'};
    --dsw-alias-label-primary:${dark ? '#f5f5f0' : '#101110'};
    --dsw-alias-label-secondary:${dark ? '#898d89' : '#4a4c48'};
    --dsw-alias-border-l1:${dark ? '#343633' : '#d8d9d5'};
    --dsw-font-family:Arial,sans-serif;
    --dsh-composer-card-max-width:780px; --dsh-composer-side-clearance:16px;
  }
  body{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:Arial,sans-serif}
  .pI_x6G_frame{height:100%;display:grid;grid-template-columns:248px 1fr}
  .pI_x6G_sidebarCol{background:var(--dsw-alias-bg-base);border-right:1px solid var(--dsw-alias-border-l1)}
  .pI_x6G_centerCol{display:flex;flex-direction:column;min-width:0;overflow:hidden}
  .wSkVaW_root{background:var(--dsw-alias-bg-base);display:flex;flex-direction:column;height:100%;min-width:0}
  .wSkVaW_scrollBody{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0}
  .wSkVaW_viewArea{flex:1 0 auto;display:flex;flex-direction:column;justify-content:center}
  .wSkVaW_composerStack{display:flex;flex-direction:column;gap:6px}
  .wSkVaW_composerHero{width:100%;z-index:1;align-self:center;position:relative;padding-bottom:32px}
  /* The live 0.2.0-rc.2 hero shell. */
  .pXSMma_root{justify-content:center;align-items:center;min-width:0;height:100%;padding:0 24px;display:flex}
  .pXSMma_stack{width:100%;max-width:var(--dsh-composer-card-max-width);flex-direction:column;align-items:stretch;gap:12px;display:flex}
  .pXSMma_headline{color:var(--dsw-alias-label-primary);flex-wrap:wrap;justify-content:center;align-items:center;gap:12px 10px;font-size:26px;font-weight:500;line-height:32px;display:flex}
  .pXSMma_titleGroup{flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 7px;min-width:0;display:flex}
  .pXSMma_body{flex-direction:column;gap:12px;min-width:0;display:flex;position:relative}
  /* The 0.1.x headline export, for the legacy run. */
  .AvZvRG_headlineText{color:var(--dsw-alias-label-primary);display:grid;grid-template-columns:auto;justify-content:center;font-size:26px;font-weight:500;line-height:32px}
  .composer{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);padding:14px;font-size:14px;color:var(--dsw-alias-label-secondary);margin-top:24px}
</style></head><body><div id="root">
  <div class="pI_x6G_frame">
    <div class="pI_x6G_sidebarCol"></div>
    <div class="pI_x6G_centerCol">
      <div class="wSkVaW_root" data-phase="${hero ? 'hero' : 'active'}">
        <div class="wSkVaW_scrollBody"><div class="wSkVaW_viewArea">
          ${generation === '02' ? HERO_02 : HERO_01}
        </div></div>
      </div>
    </div>
  </div></div>
<script>window.__ModuleLoader__={load:(m)=>{window.__MOD__=m}}</script>
<script src="./client.js"></script>
<script>
  ${dark ? "document.body.setAttribute('data-ds-dark-theme','')" : ''}
  ${BROWSER_SETTINGS_SCOPE_SNIPPET}
  var __prefs=__endfieldSettingsScope({ enabled:'1', loader:'0', watermark:'0' })
  var mod=window.__MOD__.factory(()=>null)
  mod.apply({get:(n)=>n==='theme'?{overrideTokens:()=>()=>{}}:(n==='settingsScope'?__prefs.binder:undefined),effect:(f)=>f()})
  document.body.appendChild(document.createElement('span'))
  setTimeout(()=>{
    var el=document.querySelector('[data-endfield-hero-logo]')
    var head=document.querySelector('[class$="_headline"]')||document.querySelector('[class$="_headlineText"]')
    var out={phase:document.querySelector('[class$="_root"]').getAttribute('data-phase'),present:!!el}
    if(el&&head){
      var r=el.getBoundingClientRect(), hr=head.getBoundingClientRect()
      var cs=getComputedStyle(el), b=getComputedStyle(el,'::before'), a=getComputedStyle(el,'::after')
      out.box=[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]
      out.gapAbove=Math.round(hr.top-r.bottom)
      out.offset=Math.round((r.left+r.width/2)-(hr.left+hr.width/2))
      out.aspect=+(r.width/r.height).toFixed(3)
      out.nextIsHeadline=el.nextElementSibling===head
      out.pointerEvents=cs.pointerEvents
      out.elPos=cs.position
      out.bPos=b.position
      out.bBox=[Math.round(parseFloat(b.width)),Math.round(parseFloat(b.height))]
      out.aBox=[Math.round(parseFloat(a.width)),Math.round(parseFloat(a.height))]
      out.maskBefore=String(b.maskImage||b.webkitMaskImage||'')
      out.maskAfter=String(a.maskImage||a.webkitMaskImage||'')
      out.gradient=String(b.backgroundImage||'')
      out.ink=cs.getPropertyValue('--edge-hero-logo-ink').trim()
      out.body=cs.getPropertyValue('--edge-hero-logo-body').trim()
      out.hatch=cs.getPropertyValue('--edge-hero-logo-hatch').trim()
      out.paper=getComputedStyle(document.body).backgroundColor
    }
    document.title='HEROLOGO '+JSON.stringify(out)
  },500)
</script></body></html>`

fs.copyFileSync(path.join(ROOT, 'client.js'), path.join(OUT, 'client.js'))

const run = (name, dark, generation, hero) => {
  const file = path.join(OUT, name + '.html')
  fs.writeFileSync(file, page(dark, generation, hero))
  const shot = path.join(OUT, name + '.png')
  const dom = execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--user-data-dir=' + path.join(OUT, 'profile-' + name),
    '--window-size=1440,900', '--virtual-time-budget=3000',
    '--screenshot=' + shot, '--dump-dom', 'file:///' + file.replace(/\\\\/g, '/'),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const m = dom.match(/<title>HEROLOGO ([^<]*)<\/title>/)
  if (!m) throw new Error('the fixture never reported — chrome output had no HEROLOGO title')
  const out = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
  out.shot = shot
  return out
}

const scenarios = [
  ['dark-live', true, '02', true],
  ['light-live', false, '02', true],
  ['dark-legacy', true, '01', true],
  ['light-legacy', false, '01', true],
]
const results = {}
for (const [name, dark, gen, hero] of scenarios) results[name] = run(name, dark, gen, hero)

/* ---------- 1. it is there, above the headline, centred on it ---------- */
for (const [name, , gen] of scenarios) {
  const r = results[name]
  const where = name
  if (!r.present) { fail(where + ': the hero mark was never injected'); continue }
  pass(where + ': hero mark present (' + r.box[2] + 'x' + r.box[3] + ' at ' + r.box[0] + ',' + r.box[1] + ')')
  if (r.gapAbove >= 0 && r.gapAbove <= 40) pass(where + ': sits ' + r.gapAbove + 'px above the headline row')
  else fail(where + ': gap above the headline is ' + r.gapAbove + 'px — it must sit just above it, not beside or on top of it')
  if (Math.abs(r.offset) <= 2) pass(where + ': centred on the headline (offset ' + r.offset + 'px)')
  else fail(where + ': off-centre by ' + r.offset + 'px')
  if (Math.abs(r.aspect - 1024 / 458) <= 0.02) pass(where + ': keeps the artwork aspect (' + r.aspect + ')')
  else fail(where + ': aspect ' + r.aspect + ' does not match the 1024:458 source — the masks would be stretched')
  if (r.nextIsHeadline) pass(where + ': is the headline\'s previous sibling (anchor = ' + (gen === '02' ? '*_headline' : '*_headlineText') + ')')
  else fail(where + ': not the previous sibling of the headline — the anchor lookup picked the wrong node')
  if (r.pointerEvents === 'none') pass(where + ': pointer-events none (cannot eat a composer click)')
  else fail(where + ': pointer-events is ' + r.pointerEvents)
  if (r.maskBefore.includes('data:image/svg+xml') && r.maskAfter.includes('data:image/svg+xml')) pass(where + ': both layers paint through an embedded alpha mask')
  else fail(where + ': a mask layer is missing (before: ' + r.maskBefore.slice(0, 40) + ' / after: ' + r.maskAfter.slice(0, 40) + ')')
  /* Both layers must FILL the element box: the masks are 'contain'-sized, so a
     layer that is not the element's own size means the artwork is letterboxed or
     cropped instead of registered on the same box. */
  const box = [r.box[2], r.box[3]]
  if (r.bPos === 'absolute' && r.bBox[0] === box[0] && r.bBox[1] === box[1] && r.aBox[0] === box[0] && r.aBox[1] === box[1]) {
    pass(where + ': both mask layers fill the ' + box[0] + 'x' + box[1] + ' box exactly')
  } else {
    fail(where + ': mask layers are ' + r.bBox.join('x') + ' / ' + r.aBox.join('x') + ' inside a ' + box.join('x') + ' box (' + r.bPos + ')')
  }
  if (r.gradient.includes('repeating-linear-gradient') && r.gradient.includes('150deg')) pass(where + ': hatching is the measured 150deg repeating gradient')
  else fail(where + ': hatching gradient missing — got ' + r.gradient.slice(0, 80))
}

/* ---------- 2. colour: what is painted must BE the artwork's own palette ----------
   Not a contrast bar. The logotype is exempt from WCAG's minimums and the owner
   asked for brand fidelity in both schemes, so the correct invariant is "the
   painted colours equal the source file's", in the light scheme too — where the
   numbers below are deliberately low and recorded rather than enforced. */
const art = artworkColours()
pass('artwork palette decoded from assets/hero-logo-3-summer.png: body ' + art.body + ' · hatch ' + art.hatch + ' · ink ' + art.ink)
for (const [name] of scenarios) {
  const r = results[name]
  if (!r.present) continue
  const got = { body: r.body, hatch: r.hatch, ink: r.ink }
  const bad = Object.keys(got).filter((k) => String(got[k]).toLowerCase() !== art[k].toLowerCase())
  if (bad.length === 0) pass(name + ': paints the artwork\'s own colours (' + got.body + ' / ' + got.hatch + ' / ' + got.ink + ')')
  else fail(name + ': ' + bad.map((k) => k + ' is ' + got[k] + ' but the artwork says ' + art[k]).join('; '))
  const paper = parse(r.paper)
  const cr = (v) => ratio(parse(v), paper).toFixed(2) + ':1'
  console.log('      ' + name + ' on ' + r.paper + ': body ' + cr(r.body) + ' · hatch ' + cr(r.hatch) + ' · ink ' + cr(r.ink) + ' (logotype, no bar)')
}

/* ---------- 3. nothing on an active conversation ---------- */
const active = run('active-dark', true, '02', false)
if (!active.present) pass('active conversation: no hero mark injected (phase=' + active.phase + ')')
else fail('the hero mark appeared on phase=' + active.phase + ' — it belongs to the new-session screen only')

console.log('\nshots: ' + scenarios.map(([n]) => results[n].shot).join(' · '))
if (failures) { console.error('\n' + failures + ' hero-logo check(s) failed'); process.exit(1) }
console.log('all hero-logo checks passed')
