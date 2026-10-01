/**
 * motion-check.js — prove the MERGED button-motion design actually reaches real
 * elements in a real renderer, with a real pointer.
 *
 * Since 2026-10 the six selectable schemes (A signal / B silent / C impact /
 * D clamp / E meter / F stamp) are collapsed into ONE design, gated only on the
 * presence of data-endfield-motion:
 *
 *   signal motif  — arrow slides into the new-session CTA and the approve
 *                   button on hover (transform + opacity only);
 *                   tbody rows keep the 3px left signal rule on hover.
 *   clamp motif   — sidebar session rows + search result rows gain 12px L
 *                   corner brackets on hover (two gradient arms per corner,
 *                   pre-created at rest, keyframed opacity).
 *
 * This script renders the REAL stylesheet out of client.js into a mock page,
 * drives the genuine :hover / :active with Input.dispatchMouseEvent, and asserts
 * on computed styles plus corner PIXELS. It also proves the two retargets that
 * the merge shipped: plain/icon buttons must NOT carry brackets any more, and
 * the sidebar rows must.
 *
 * The same fixture carries the 划词灰 (selection-gray) assertions — the model
 * menu / permission popup current rows and the composer + hover all use the
 * ::selection fill/ink pair, in both schemes and (for the value-level proof)
 * under a palette where that gray differs from the accent.
 *
 * Plus two controls that keep the test honest:
 *   - `off` (attribute removed, exactly what syncMotion does) must produce
 *     NONE of it (the shared :active dim is still expected to disappear);
 *   - prefers-reduced-motion: reduce must kill the transform/animation while
 *     leaving the colour transition alone.
 *
 * Usage: node test/motion-check.js
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const zlib = require('zlib')
const { spawn } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const findChrome = () => [process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean).find((p) => fs.existsSync(p))
const chrome = findChrome()
if (!chrome) { console.error('FAIL  no Chrome/Edge found (set CHROME_PATH)'); process.exit(1) }

let failures = 0
const pass = (m) => console.log('ok    ' + m)
const fail = (m) => { console.error('FAIL  ' + m); failures++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* Colour expectations are read from the DOCUMENT, never restated as literals:
   the fixture declares the gray palette's tokens (the theme's default) and the
   expected colour is whatever the page resolves the variable to. */
const decodePng = (buf) => {
  let pos = 8, w = 0, h = 0, bd = 0, ct = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.slice(pos + 4, pos + 8).toString('ascii')
    const data = buf.slice(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9] }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bd !== 8) throw new Error('unsupported bit depth ' + bd)
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : null
  if (ch === null) throw new Error('unsupported colour type ' + ct)
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * ch
  const out = Buffer.alloc(h * stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[p++]
    const line = raw.slice(p, p + stride); p += stride
    const prev = y === 0 ? Buffer.alloc(stride) : out.slice((y - 1) * stride, y * stride)
    const cur = out.slice(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0
      const b = prev[x]
      const c = x >= ch ? prev[x - ch] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
      }
      cur[x] = v & 255
    }
  }
  return { w, h, ch, data: out }
}

/* ---- minimal CDP client over the /json/... HTTP endpoints + websocket ---- */
const httpJson = (port, p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: p }, (res) => {
    let d = ''; res.setEncoding('utf8')
    res.on('data', (c) => { d += c }); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
  }).on('error', reject)
})

const connectWs = (url) => new Promise((resolve, reject) => {
  const net = require('net')
  const crypto = require('crypto')
  const u = new URL(url)
  const sock = net.connect(Number(u.port), u.hostname, () => {
    sock.write('GET ' + u.pathname + u.search + ' HTTP/1.1\r\nHost: ' + u.host + '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + crypto.randomBytes(16).toString('base64') + '\r\nSec-WebSocket-Version: 13\r\n\r\n')
  })
  let buf = Buffer.alloc(0), open = false, nextId = 1
  const waiters = new Map()
  const emit = (m) => { if (m.id !== undefined && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id) } }
  const decodeFrames = () => {
    for (;;) {
      if (buf.length < 2) return
      const l0 = buf[1] & 0x7f; let off = 2, len = l0
      if (l0 === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4 }
      else if (l0 === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10 }
      if (buf.length < off + len) return
      const pl = buf.slice(off, off + len); buf = buf.slice(off + len)
      try { emit(JSON.parse(pl.toString('utf8'))) } catch (e) { /* non-JSON frame */ }
    }
  }
  sock.on('data', (c) => {
    if (!open) {
      buf = Buffer.concat([buf, c]); const i = buf.indexOf('\r\n\r\n'); if (i < 0) return
      if (!/101/.test(buf.slice(0, i).toString('ascii'))) { reject(new Error('ws upgrade failed: ' + buf.slice(0, i).toString().split('\r\n')[0])); return }
      buf = buf.slice(i + 4); open = true; resolve(api); decodeFrames(); return
    }
    buf = Buffer.concat([buf, c]); decodeFrames()
  })
  sock.on('error', reject)
  const send = (obj) => {
    const data = Buffer.from(JSON.stringify(obj), 'utf8')
    const mask = require('crypto').randomBytes(4)
    let header
    if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length])
    else if (data.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0xfe; header.writeUInt16BE(data.length, 2) }
    else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0xff; header.writeBigUInt64BE(BigInt(data.length), 2) }
    const masked = Buffer.alloc(data.length)
    for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4]
    sock.write(Buffer.concat([header, mask, masked]))
  }
  const api = {
    call: (method, params) => new Promise((res) => {
      const id = nextId++
      waiters.set(id, (msg) => res(msg.result))
      send({ id, method, params: params || {} })
    }),
    close: () => sock.destroy(),
  }
})

/* ---------------- fixture ----------------
   Hash-free class names, because the theme's hooks are all suffix/substring
   matches ('_newSession', '_sessionRow', '_optionLabel'). The app shapes below
   are the ones the cascade has to win against: the workspace-browser sidebar
   rows (div[role=treeitem] + a search row button, hover/selected fill from the
   shared token), the model menu (menuitemradio buttons), a primitives-style
   permission menu item, and the composer add button with its solid-hover
   token. Everything else — colours, sizes, the button reset — is the app's own
   shape, recreated so the cascade under test is real. */
const fixture = (css, motion) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0}
  body{
    --edge-accent:#d9d9d9;
    --edge-accent-deep:#cccccc;
    --edge-accent-onpaper:#666666;
    --edge-accent-ink:#101110;
    --edge-accent-rgb:126, 126, 126;
    --edge-status-dark:#d9d9d9;
    --dsw-alias-bg-base:#e8e8e2;
    --dsw-alias-bg-layer-1:#f2f2ec;
    --dsw-alias-bg-layer-2:#dcddd6;
    --dsw-alias-label-primary:#101110;
    --dsw-alias-label-secondary:#5a5d58;
    --dsw-alias-border-l1:#d8d9d5;
    --dsw-alias-border-l2:#b6b8b3;
    --dsw-alias-button-info-fill:#101110;
    --dsw-alias-button-elevated-fill:#f2f2ec;
    --dsw-specific-selector:#e8e8e2;
    background:#e8e8e2;color:#101110;font:600 12px Arial;
    padding:24px;
  }
  button,[role='button']{font:inherit}
  button,[role='button']{position:relative}
  .x_newSession{display:block;width:180px;height:34px;margin:8px 0;border:1px solid var(--dsw-alias-border-l2);
    background:#f2f2ec;color:#101110;cursor:pointer}
  .x_primary{width:120px;height:34px;margin:8px 0;border:none;
    background:#101110;color:#ffffff;cursor:pointer;display:inline-grid;place-items:center}
  .x_iconButton{width:28px;height:28px;border:none;background:transparent;cursor:pointer;
    display:inline-flex;align-items:center;justify-content:center;border-radius:999px}
  .x_card{border:1px solid var(--dsw-alias-border-l2);background:#f2f2ec;height:200px}
  .x_composerSeat{padding:4px 0}
  .x_row{display:block;width:180px;padding:6px 8px;margin:6px 0}
  /* The workspace sidebar: rows are div[role=treeitem] in the real app, the
     search rows are buttons; both take the shared hover/selected fill. */
  .x_sidebarCol{width:260px;background:var(--dsw-alias-bg-layer-1);padding:6px 4px}
  .x_sessionRow{min-height:34px;display:flex;align-items:center;padding:0 8px;cursor:pointer;user-select:none}
  .x_sessionRow:hover,.x_sessionRow.x_selected{background:var(--dsw-alias-interactive-bg-hover)}
  .x_searchResultRow{display:block;width:100%;min-height:48px;text-align:left;border:none;
    background:transparent;cursor:pointer;padding:4px 8px}
  .x_searchResultRow:hover,.x_searchResultRow.x_selected{background:var(--dsw-alias-interactive-bg-hover)}
  table{border-collapse:collapse;margin:8px 0}
  td{border:1px solid var(--dsw-alias-border-l2);padding:6px 10px;background:#f2f2ec}
  /* model menu rows (dsh-client-ui-model-selection shape) */
  .x_option{display:flex;align-items:center;gap:6px;width:220px;min-height:34px;padding:5px 7px;
    border:none;background:transparent;text-align:left;cursor:pointer}
  .x_option:hover{background:var(--dsw-alias-interactive-bg-hover)}
  /* permission popup row (ui-primitives Menu shape) */
  .x_item{display:flex;align-items:center;gap:6px;width:220px;min-height:34px;padding:5px 7px;
    border:none;background:transparent;text-align:left;cursor:pointer}
  .x_item:hover{background:var(--dsw-alias-interactive-bg-hover)}
  .x_badge{color:var(--dsw-alias-label-secondary)}
  /* composer add button (InputBar shape): round, selector fill at rest,
     SOLID hover token — the exact cascade the gray has to beat. */
  .x_add{width:28px;height:28px;border:none;border-radius:999px;cursor:pointer;
    display:inline-grid;place-items:center;background:var(--dsw-specific-selector);color:var(--dsw-alias-label-primary)}
  .x_add:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}
</style>
<style>${css}</style>
</head><body ${motion ? `data-endfield-motion="${motion}"` : ''}>
  <button class="x_newSession" id="newSession">+ 新建会话</button>
  <button class="x_primary" id="primary">发送</button>
  <div class="x_composerSeat"><button class="x_primary" id="send" aria-label="send">▶</button></div>
  <button class="x_iconButton" id="iconButton" aria-label="more">···</button>
  <button id="plain">编辑</button>
  <button id="approve" data-cordis-approve>允许</button>
  <button id="decline" data-cordis-decline>拒绝</button>
  <div class="x_card" id="card"></div>
  <div class="x_row" role="menuitem" id="menuRow">菜单项</div>
  <div class="x_sidebarCol" id="sidebarCol">
    <div class="x_sessionRow" id="sessionRow" role="treeitem" aria-selected="false">会话 A</div>
    <div class="x_sessionRow x_selected" id="sessionRowSel" role="treeitem" aria-selected="true">会话 B（当前）</div>
    <button class="x_searchResultRow" id="searchRow">搜索结果行</button>
  </div>
  <table id="tbl"><tbody><tr id="trow"><td>表格行</td><td>值</td></tr></tbody></table>
  <div role="menu" id="modelMenu">
    <button class="x_option x_modelOption x_selected" id="modelSel" role="menuitemradio" aria-checked="true">当前模型</button>
    <button class="x_option x_modelOption" id="modelUnsel" role="menuitemradio" aria-checked="false">其它模型</button>
  </div>
  <div role="menu" id="permMenu">
    <button class="x_item x_selected" id="permSel" role="menuitem">
      <span class="x_itemLabel"><span class="x_optionLabel">工作区内修改</span></span>
      <span class="x_check">✓</span>
    </button>
    <button class="x_item" id="permUnsel" role="menuitem"><span class="x_itemLabel"><span class="x_optionLabel">完全权限</span></span></button>
  </div>
  <div class="x_composerSeat" id="seat2"><button class="x_add" id="addBtn">+</button></div>
  <script>
    window.__rect__ = (id) => {
      const r = document.getElementById(id).getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }
    window.__style__ = (id, pseudo) => {
      const el = document.getElementById(id)
      const s = getComputedStyle(el, pseudo || null)
      const keys = ['width','height','borderRadius','transform','outlineColor','outlineWidth','outlineStyle',
        'backgroundColor','borderLeftWidth','borderLeftColor','boxShadow','content',
        'maskImage','webkitMaskImage','backgroundImage','backgroundSize',
        'animationName','animationDuration',
        'transitionProperty','color','filter','position','opacity']
      const out = {}
      for (const k of keys) out[k] = s[k]
      return out
    }
    window.__accentOnpaper__ = () => getComputedStyle(document.body).getPropertyValue('--edge-accent-onpaper').trim()
    window.__var__ = (name) => getComputedStyle(document.body).getPropertyValue(name).trim()
    window.__anims__ = (id) => document.getElementById(id).getAnimations().map((a) => ({
      name: a.animationName, playState: a.playState, duration: a.effect && a.effect.getTiming().duration,
    }))
  </script>
</body></html>`

;(async () => {
  const clientSrc = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')

  /* Pull the LIVE stylesheet out of client.js: it is the single template literal
     handed to insertCss(), and nothing here re-types a byte of it. If this regex
     ever stops matching, the test fails loudly rather than testing a fiction. */
  const cssFromSource = (() => {
    const m = /insertCss\(`([\s\S]*?)`\)/.exec(clientSrc)
    if (!m) throw new Error('could not locate the insertCss() stylesheet literal')
    return m[1]
  })()

  /* The merged design's own markers — and a guard that the removed schemes are
     really gone, not just unreachable. */
  if (!/\[class\$='_sessionRow'\]::before/.test(cssFromSource)
    || !/data-endfield-motion\] \[class\$='_newSession'\]::after/.test(cssFromSource)) {
    console.error('FAIL  the stylesheet under test has no merged motion rules — extraction is wrong or the rules are missing')
    process.exit(1)
  }
  pass('live stylesheet extracted from client.js (' + cssFromSource.length + ' chars)')
  if (/endfield-stamp|motion='impact'|motion='meter'|motion='silent'/.test(cssFromSource)) {
    fail('合并 · 已删除的方案（冲压/读数/静默）仍在样式表里留有规则')
  } else {
    pass('合并 · 冲压/静默/读数/盖章的规则已从样式表移除')
  }
  if (!/\[role='menuitemradio'\]\[aria-checked='true'\]/.test(cssFromSource)
    || !/:has\(\[class\$='_optionLabel'\]\)/.test(cssFromSource)) {
    fail('划词灰 · 模型菜单/权限弹层的选中规则缺失')
  } else {
    pass('划词灰 · 模型菜单与权限弹层的选中规则都在样式表里')
  }

  const html = fixture(cssFromSource, 'signal')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'))
  const page = path.join(tmp, 'page.html')
  fs.writeFileSync(page, html)
  const port = 9333 + (process.pid % 400)
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + path.join(tmp, 'profile'),
    '--window-size=900,900',
    'file://' + page,
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  let cdp
  try {
    let target = null
    for (let i = 0; i < 60 && target === null; i++) {
      await sleep(200)
      try {
        const list = await httpJson(port, '/json/list')
        target = (list || []).find((t) => t.type === 'page' && t.webSocketDebuggerUrl) || null
      } catch (e) { /* not up yet */ }
    }
    if (target === null) { fail('could not reach the DevTools endpoint'); throw new Error('no target') }

    cdp = await connectWs(target.webSocketDebuggerUrl)
    await cdp.call('Runtime.enable')
    await cdp.call('Page.enable')
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 2, mobile: false })
    await sleep(500)

    /* The reduced-motion state is emulator-level and persists across the whole
       session, so a leaked override turns every "does the decoration appear"
       assertion into a false failure. Pin it OFF at the start and verify it. */
    await cdp.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
    await sleep(150)

    const evaluate = async (expr) => {
      const r = await cdp.call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r && r.exceptionDetails) throw new Error('page threw: ' + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description))
      return r && r.result ? r.result.value : undefined
    }
    const shoot = async () => decodePng(Buffer.from((await cdp.call('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    const setMotion = async (m) => {
      await evaluate(`document.body.setAttribute('data-endfield-motion', ${JSON.stringify(m)})`)
      await sleep(90)
    }
    const hover = async (id) => {
      const b = JSON.parse(await evaluate('JSON.stringify(window.__rect__(' + JSON.stringify(id) + '))'))
      await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2), buttons: 0 })
      await sleep(320)
      return b
    }
    const park = async () => { await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, buttons: 0 }); await sleep(160) }
    const press = async (id, { release = true } = {}) => {
      const b = JSON.parse(await evaluate('JSON.stringify(window.__rect__(' + JSON.stringify(id) + '))'))
      const x = Math.round(b.x + b.w / 2), y = Math.round(b.y + b.h / 2)
      await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 })
      await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
      await sleep(60)
      return { b, release: async () => { await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }); await sleep(60) } }
    }
    const styleOf = async (id, pseudo) => JSON.parse(await evaluate('JSON.stringify(window.__style__(' + JSON.stringify(id) + (pseudo ? ', ' + JSON.stringify(pseudo) : '') + '))'))
    const toRgb = (c) => {
      if (Array.isArray(c)) return c
      const s = String(c).trim()
      const h = /^#([0-9a-f]{6})$/i.exec(s)
      if (h) {
        const n = parseInt(h[1], 16)
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      }
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s)
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
    }
    const nearRgb = (a, b, tol) => {
      const x = toRgb(a), y = toRgb(b)
      if (x === null || y === null) return false
      return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) <= tol * 3
    }

    const SCALE = 2
    const countNear = (img, box, target, tol, dpr = SCALE) => {
      const x0 = Math.max(0, Math.round(box.x * dpr)), x1 = Math.min(img.w - 1, Math.round((box.x + box.w) * dpr))
      const y0 = Math.max(0, Math.round(box.y * dpr)), y1 = Math.min(img.h - 1, Math.round((box.y + box.h) * dpr))
      let n = 0
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * img.w + x) * img.ch
          if (nearRgb([img.data[i], img.data[i + 1], img.data[i + 2]], target, tol)) n++
        }
      }
      return n
    }
    const topColors = (img, box, n = 4, dpr = SCALE) => {
      const hist = new Map()
      const x0 = Math.max(0, Math.round(box.x * dpr)), x1 = Math.min(img.w - 1, Math.round((box.x + box.w) * dpr))
      const y0 = Math.max(0, Math.round(box.y * dpr)), y1 = Math.min(img.h - 1, Math.round((box.y + box.h) * dpr))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * img.w + x) * img.ch
          const k = img.data[i] + ',' + img.data[i + 1] + ',' + img.data[i + 2]
          hist.set(k, (hist.get(k) || 0) + 1)
        }
      }
      return [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([k, c]) => 'rgb(' + k + ')x' + c).join(' ')
    }

    const rmAtStart = await evaluate("window.matchMedia('(prefers-reduced-motion: reduce)').matches")
    if (rmAtStart === false) pass('起始状态 · 减少动态效果未生效（各段断言的前提成立）')
    else fail('起始状态 · reduce 处于生效状态，装饰类断言会全部失真')
    const accent = toRgb(await evaluate('window.__accentOnpaper__()'))
    if (!accent) { fail('fixture did not resolve --edge-accent-onpaper'); throw new Error('no accent') }

    /* ============ 共通底座 ============ */
    await setMotion('signal')
    await park()
    {
      /* Real <button>s are DELIBERATELY instant: the theme pins button transitions
         to none (see the "track the pointer immediately" rule) — that pin is part
         of the design, so it is asserted here rather than the colour transition.
         The .2s colour transition still applies to the non-button interactive
         roles, represented by the menuitem div. */
      const t = await styleOf('plain')
      if (t.transitionProperty === 'none') {
        pass('共通 · 按钮 hover 即时响应（主题钉死 button 无过渡）  [' + t.transitionProperty + ']')
      } else {
        fail('共通 · 按钮被挂上了过渡  [' + t.transitionProperty + ']')
      }
      const m = await styleOf('menuRow')
      if (/background-color/.test(m.transitionProperty) && /color/.test(m.transitionProperty)) {
        pass('共通 · 非按钮交互角色带 .2s 颜色过渡  [' + m.transitionProperty + ']')
      } else {
        fail('共通 · 菜单行颜色过渡缺失  [' + m.transitionProperty + ']')
      }
      const hold = await press('plain', { release: false })
      const act = await styleOf('plain')
      await hold.release()
      if (/brightness/.test(act.filter)) pass('共通 · 按下暗一档  [' + act.filter + ']')
      else fail('共通 · 按下应有 brightness  [filter=' + act.filter + ']')
      await park()
    }

    /* ============ 信号母题 ============ */
    {
      const rest = await styleOf('newSession', '::after')
      await hover('newSession')
      const hov = await styleOf('newSession', '::after')
      const inkHex = await evaluate("window.__var__('--edge-accent-ink')")
      /* computed transforms are matrices, not the authored functions */
      const tx = (tr) => { const mm = /matrix\(([-\d.]+), [-\d.]+, [-\d.]+, [-\d.]+, ([-\d.]+),/.exec(String(tr)); return mm ? { s: parseFloat(mm[1]), x: parseFloat(mm[2]) } : null }
      const restM = tx(rest.transform), hovM = tx(hov.transform)
      if (rest.opacity === '0' && hov.opacity === '1'
        && restM && hovM && Math.abs(restM.x + 14) < 0.5 && Math.abs(restM.s - 0.4) < 0.01
        && Math.abs(hovM.x) < 0.5 && Math.abs(hovM.s - 1) < 0.01
        && nearRgb(hov.backgroundColor, inkHex, 4)) {
        pass('信号 · 新会话箭头常态隐藏、悬停滑入点亮（transform+opacity，色=accent-ink）')
      } else {
        fail('信号 · 新会话箭头动效不符  [rest=' + rest.opacity + ' ' + rest.transform + ' → ' + hov.opacity + ' ' + hov.transform + ' bg=' + hov.backgroundColor + ']')
      }
      await park()
      const restA = await styleOf('approve', '::after')
      await hover('approve')
      const hovA = await styleOf('approve', '::after')
      if (restA.opacity === '0' && hovA.opacity === '1' && !/translateX\(-/.test(hovA.transform)) {
        pass('信号 · 审批按钮同款箭头滑入  [' + restA.opacity + ' → ' + hovA.opacity + ']')
      } else {
        fail('信号 · 审批按钮箭头不符  [' + restA.opacity + ' → ' + hovA.opacity + ' ' + hovA.transform + ']')
      }
      await park()
      const restT = await styleOf('trow')
      await hover('trow')
      const hovT = await styleOf('trow')
      if (restT.borderLeftWidth === '3px' && /rgba\(0, 0, 0, 0\)/.test(restT.borderLeftColor)
        && nearRgb(hovT.borderLeftColor, accent, 4)) {
        pass('信号 · 表格行悬停左缘 3px 信号条（常态透明预声明）  [' + hovT.borderLeftColor + ']')
      } else {
        fail('信号 · 表格行左缘信号条不符  [' + restT.borderLeftWidth + ' ' + restT.borderLeftColor + ' → ' + hovT.borderLeftWidth + ' ' + hovT.borderLeftColor + ']')
      }
      await park()
      /* 侧边栏行**不再**走左缘边条——那是合并前的方案A 行为。 */
      const nsRow = await styleOf('sessionRow')
      if (nsRow.borderLeftWidth === '0px') pass('信号 · 侧边栏会话行不再挂左缘边条（已让位给角标）')
      else fail('信号 · 侧边栏会话行仍有左边条  [' + nsRow.borderLeftWidth + ']')
    }

    /* ============ 角标母题（侧边栏会话行） ============ */
    {
      const restB = await styleOf('sessionRow', '::before')
      const restA = await styleOf('sessionRow', '::after')
      await hover('sessionRow')
      const hovB = await styleOf('sessionRow', '::before')
      const hovA = await styleOf('sessionRow', '::after')
      const armsAt = (st) => (String(st.backgroundImage || '').match(/linear-gradient/g) || []).length
      /* The bracket boxes exist at rest and hover only toggles their opacity:
         creating them on hover re-invalidates layout on every hover while an
         always-present box costs 0.00 (perf-motion). */
      if (armsAt(restB) === 2 && armsAt(restA) === 2 && restB.width === '12px'
        && restB.content && restB.content !== 'none' && restA.content && restA.content !== 'none') {
        pass('角标 · 会话行角标常态生成、悬停用关键帧淡入（不新建盒子，成本 0 重排）')
      } else {
        fail('角标 · 会话行角标应常态生成  [arms=' + armsAt(restB) + '/' + armsAt(restA) + ' w=' + restB.width
          + ' content=' + restB.content + '/' + restA.content + ']')
      }
      if (hovB.animationName === 'endfield-clamp-in' && hovA.animationName === 'endfield-clamp-in'
        && /12px 2px/.test(String(hovB.backgroundSize))) {
        pass('角标 · 悬停时 ::before/::after 各画两条渐变边（L 形）并启动关键帧  [' + hovB.backgroundSize + ']')
      } else {
        fail('角标 · 悬停关键帧/渐变边不符  [anim=' + hovB.animationName + '/' + hovA.animationName + ' size=' + hovB.backgroundSize + ']')
      }
      if (!/svg|url\(/.test(String(hovB.backgroundImage)) && !/url\(/.test(String(restB.backgroundImage))) {
        pass('角标 · 不含任何位图/矢量资源（纯渐变，跨 DPR 稳定）')
      } else {
        fail('角标 · 仍依赖外部资源  [bg=' + String(hovB.backgroundImage).slice(0, 40) + ']')
      }
      const accentTri = accent.join(', ')
      if (hovB.position === 'absolute' && hovB.width === '12px' && hovB.height === '12px'
        && String(hovB.backgroundImage).includes(accentTri)) {
        pass('角标 · 12px 方块、两条边用 onpaper 信号色  [' + hovB.width + '×' + hovB.height + ']')
      } else {
        fail('角标 · 几何/颜色不符  [' + hovB.position + ' ' + hovB.width + ' bg=' + String(hovB.backgroundImage).slice(0, 60) + ']')
      }
      /* search rows are in scope too */
      await park()
      const sRest = await styleOf('searchRow', '::before')
      await hover('searchRow')
      const sHov = await styleOf('searchRow', '::before')
      if ((String(sRest.backgroundImage || '').match(/linear-gradient/g) || []).length === 2
        && sHov.animationName === 'endfield-clamp-in') {
        pass('角标 · 搜索结果行同款角标  [anim=' + sHov.animationName + ']')
      } else {
        fail('角标 · 搜索结果行角标缺失  [arms=' + (String(sRest.backgroundImage || '').match(/linear-gradient/g) || []).length + ' anim=' + sHov.animationName + ']')
      }
      await park()

      /* pixels: the top-left bracket must actually paint, and only on hover.
         Sample strictly INSIDE the row's corner. */
      const bRow = JSON.parse(await evaluate('JSON.stringify(window.__rect__("sessionRow"))'))
      const cornerBox = { x: bRow.x + 1, y: bRow.y + 1, w: 12, h: 12 }
      const imgRest = await shoot()
      await hover('sessionRow')
      const imgHov = await shoot()
      const pxHover = countNear(imgHov, cornerBox, accent, 30)
      const pxRest = countNear(imgRest, cornerBox, accent, 30)
      if (pxHover >= 12 && pxRest === 0) {
        pass('角标 · 左上角 L 形角标真的画出来了（悬停 ' + pxHover + ' px，常态 ' + pxRest + ' px）')
      } else {
        fail('角标 · 未按预期绘制  [hover=' + pxHover + ' rest=' + pxRest + ' region=' + topColors(imgHov, cornerBox) + ']')
      }
      /* DPR loop: a decoration that only survives one DPR is a HiDPI bug nothing
         else can see. */
      for (const dpr of [1, 3, 1, 2]) {
        await cdp.call('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: dpr, mobile: false })
        await sleep(220)
        await hover('sessionRow')
        const imgHi = await shoot()
        const bHi = JSON.parse(await evaluate('JSON.stringify(window.__rect__("sessionRow"))'))
        const boxHi = { x: bHi.x + 1, y: bHi.y + 1, w: 12, h: 12 }
        await park()
        const imgHiRest = await shoot()
        await hover('sessionRow')
        const pxHi = countNear(imgHi, boxHi, accent, 30, dpr)
        const pxHiRest = countNear(imgHiRest, boxHi, accent, 30, dpr)
        if (pxHi >= 6 * dpr && pxHiRest === 0) {
          pass('角标 · DPR ' + dpr + ' 下照常绘制  [悬停 ' + pxHi + ' px，常态 0]')
        } else {
          fail('角标 · DPR ' + dpr + ' 下未按预期绘制  [hover=' + pxHi + ' rest=' + pxHiRest
            + ' region=' + topColors(imgHi, boxHi, 4, dpr) + ']')
        }
      }
      await cdp.call('Emulation.setDeviceMetricsOverride', { width: 900, height: 900, deviceScaleFactor: 2, mobile: false })
      await sleep(200)
      await park()

      /* round mode guard: no brackets when the app keeps its rounding. */
      const hadRound = await evaluate("document.body.classList.contains('theme-endfield-round')")
      await evaluate("document.body.classList.add('theme-endfield-round')")
      await hover('sessionRow')
      const roundMode = await styleOf('sessionRow', '::before')
      await evaluate("document.body.classList.remove('theme-endfield-round')")
      if ((String(roundMode.backgroundImage || '').match(/linear-gradient/g) || []).length === 0) {
        pass('角标 · 圆角模式（.theme-endfield-round）下不画  [开启前=' + hadRound + ']')
      } else {
        fail('角标 · 圆角模式下仍画  [arms=' + (String(roundMode.backgroundImage || '').match(/linear-gradient/g) || []).length + ']')
      }
      await park()

      /* RETARGET REGRESSION: the merged design brackets sidebar rows ONLY.
         Plain buttons and icon buttons carried brackets in the old scheme D;
         they must not any more. */
      await hover('plain')
      const plainB = await styleOf('plain', '::before')
      await park()
      await hover('iconButton')
      const iconB = await styleOf('iconButton', '::before')
      await park()
      const armsPlain = (String(plainB.backgroundImage || '').match(/linear-gradient/g) || []).length
      const armsIcon = (String(iconB.backgroundImage || '').match(/linear-gradient/g) || []).length
      if (armsPlain === 0 && armsIcon === 0) {
        pass('合并回归 · 普通按钮/图标按钮不再画角标（角标只属于侧边栏行）')
      } else {
        fail('合并回归 · 角标仍画在按钮上  [plain=' + armsPlain + ' icon=' + armsIcon + ']')
      }
    }

    /* ============ 划词灰：模型栏 / 权限更改 / 添加按钮 ============ */
    {
      const readPair = async () => ({
        fill: await evaluate("window.__var__('--edge-select-fill')"),
        ink: await evaluate("window.__var__('--edge-select-ink')"),
        accent: await evaluate("window.__var__('--edge-accent')"),
      })
      /* value-level proof under a palette where the gray differs from the
         accent: valley's accent is #fff500, the selection gray stays #d9d9d9. */
      await evaluate("document.body.classList.add('theme-endfield-valley')")
      await sleep(120)
      const pair = await readPair()
      const selFill = toRgb(pair.fill), selInk = toRgb(pair.ink), accentV = toRgb(pair.accent)
      const modelSel = await styleOf('modelSel')
      const modelUnsel = await styleOf('modelUnsel')
      const permSel = await styleOf('permSel')
      const permUnsel = await styleOf('permUnsel')
      if (nearRgb(modelSel.backgroundColor, selFill, 3) && nearRgb(modelSel.color, selInk, 3)
        && !nearRgb(modelSel.backgroundColor, accentV, 30)) {
        pass('划词灰 · 模型菜单当前项 = 选择灰底 + 墨字（≠强调黄）  [' + modelSel.backgroundColor + ' / ' + modelSel.color + ']')
      } else {
        fail('划词灰 · 模型菜单当前项不符  [bg=' + modelSel.backgroundColor + ' color=' + modelSel.color
          + ' 期望 fill=' + pair.fill + ' ink=' + pair.ink + ']')
      }
      if (!nearRgb(modelUnsel.backgroundColor, selFill, 3)) {
        pass('划词灰 · 未选中的模型行保持透明  [' + modelUnsel.backgroundColor + ']')
      } else {
        fail('划词灰 · 未选中模型行也被涂灰  [' + modelUnsel.backgroundColor + ']')
      }
      if (nearRgb(permSel.backgroundColor, selFill, 3) && nearRgb(permSel.color, selInk, 3)
        && !nearRgb(permUnsel.backgroundColor, selFill, 3)) {
        pass('划词灰 · 权限弹层当前项同款灰，未选中项不动  [' + permSel.backgroundColor + ']')
      } else {
        fail('划词灰 · 权限弹层不符  [sel=' + permSel.backgroundColor + ' unsel=' + permUnsel.backgroundColor + ']')
      }
      /* the pair must be EXACTLY the ::selection pair: same tokens, read from
         the same page (the rule reuses --edge-select-fill/ink by construction,
         so a drift here means someone hardcoded a hex). */
      const selRule = await evaluate("JSON.stringify((()=>{const s=getComputedStyle(document.getElementById('modelSel'));return {bg:s.backgroundColor, fg:s.color}})())")
      void selRule
      await park()
      /* add button: hover must be the selection gray, not the solid accent. */
      await hover('addBtn')
      const addHov = await styleOf('addBtn')
      if (nearRgb(addHov.backgroundColor, selFill, 3) && nearRgb(addHov.color, selInk, 3)
        && !nearRgb(addHov.backgroundColor, accentV, 30)) {
        pass('划词灰 · 添加按钮悬停 = 选择灰底 + 墨字（≠实心强调黄）  [' + addHov.backgroundColor + ' / ' + addHov.color + ']')
      } else {
        fail('划词灰 · 添加按钮悬停不符  [bg=' + addHov.backgroundColor + ' color=' + addHov.color + ']')
      }
      await park()
      /* the gray survives motion-off: it is a selection state, not a motion. */
      await evaluate("document.body.removeAttribute('data-endfield-motion')")
      await sleep(120)
      const grayOff = await styleOf('modelSel')
      if (nearRgb(grayOff.backgroundColor, selFill, 3)) {
        pass('划词灰 · 关闭动效后选中灰仍在（选中是状态，不是动效）')
      } else {
        fail('划词灰 · 关闭动效后选中灰消失  [bg=' + grayOff.backgroundColor + ']')
      }
      await setMotion('signal')
      /* dark scheme: the pair flips with the scheme, both spots follow. */
      await evaluate("document.body.setAttribute('data-ds-dark-theme','')")
      await sleep(120)
      const pairD = await readPair()
      const modelD = await styleOf('modelSel')
      const permD = await styleOf('permSel')
      if (nearRgb(modelD.backgroundColor, toRgb(pairD.fill), 3) && nearRgb(modelD.color, toRgb(pairD.ink), 3)
        && nearRgb(permD.backgroundColor, toRgb(pairD.fill), 3)) {
        pass('划词灰 · 暗色方案下两处选中跟随翻转  [' + modelD.backgroundColor + ' / ' + pairD.fill + ']')
      } else {
        fail('划词灰 · 暗色方案下未跟随  [model=' + modelD.backgroundColor + ' perm=' + permD.backgroundColor + ' 期望 ' + pairD.fill + ']')
      }
      await evaluate("document.body.removeAttribute('data-ds-dark-theme')")
      await evaluate("document.body.classList.remove('theme-endfield-valley')")
      await sleep(120)
    }

    /* ============ 圆角恒定 ============ */
    {
      const iconRest = await styleOf('iconButton')
      await hover('iconButton')
      const iconHover = await styleOf('iconButton')
      if (iconRest.borderRadius === iconHover.borderRadius && /50%|999px/.test(iconHover.borderRadius)) {
        pass('圆形图标按钮 · 悬停不改圆角  [' + iconRest.borderRadius + ' → ' + iconHover.borderRadius + ']')
      } else {
        fail('圆形图标按钮 · 悬停改变了圆角  [' + iconRest.borderRadius + ' → ' + iconHover.borderRadius + ']')
      }
      await park()
      await hover('plain')
      const plainHoverR = (await styleOf('plain')).borderRadius
      if (plainHoverR === '0px') pass('方角按钮 · 悬停仍是直角  [' + plainHoverR + ']')
      else fail('方角按钮 · 悬停长出了倒角  [' + plainHoverR + ']')
      await park()
    }

    /* ============ 发送按钮：不得有任何动效 ============ */
    {
      const sendRest = await styleOf('send')
      const sendAfter = await styleOf('send', '::after')
      await hover('send')
      const sendHover = await styleOf('send')
      const holdSend = await press('send', { release: false })
      const sendActive = await styleOf('send')
      await holdSend.release()
      const radiusOk = sendRest.borderRadius === sendHover.borderRadius && sendHover.borderRadius === sendActive.borderRadius
      const staticOk = !sendAfter.content || sendAfter.content === 'none'
      const noAnim = sendActive.animationName === 'none' && sendHover.animationName === 'none'
      const noShift = sendActive.transform === 'none' && sendHover.transform === 'none'
      if (radiusOk && staticOk && noAnim && noShift) {
        pass('发送按钮 · 无伪元素动效、无动画、无位移、圆角恒定  [after=' + sendAfter.content + ']')
      } else {
        fail('发送按钮 · 仍有动效  [after=' + sendAfter.content + ' anim=' + sendActive.animationName
          + ' transform=' + sendActive.transform + '/' + sendHover.transform + ']')
      }
      await park()
    }

    /* ============ control: off ============ */
    /* The runtime removes the attribute for `off` (client.js syncMotion), it does
       not write the literal 'off'. Setting 'off' would exercise a state that never
       ships. */
    await evaluate("document.body.removeAttribute('data-endfield-motion')")
    await sleep(120)
    {
      await hover('sessionRow')
      const offB = await styleOf('sessionRow', '::before')
      const offRow = await styleOf('sessionRow')
      const armsOff = (String(offB.backgroundImage || '').match(/linear-gradient/g) || []).length
      await hover('newSession')
      const offArrow = await styleOf('newSession', '::after')
      if (armsOff === 0 && (!offArrow.content || offArrow.content === 'none')) {
        pass('off · 关闭后会话行角标与 CTA 箭头全部消失')
      } else {
        fail('off · 关闭后仍有动效残留  [arms=' + armsOff + ' arrow=' + offArrow.content + ']')
      }
      void offRow
      await park()
      const holdOff = await press('primary', { release: false })
      const offMid = await styleOf('primary')
      await holdOff.release()
      if (!/brightness/.test(offMid.filter)) {
        pass('off · 属性移除后主题不再叠加任何按下反馈  [filter=' + offMid.filter + ']')
      } else {
        fail('off · 属性已移除但主题仍在施加 filter  [' + offMid.filter + ']')
      }
      await park()
    }

    /* ============ control: prefers-reduced-motion ============ */
    await cdp.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await setMotion('signal')
    {
      await hover('sessionRow')
      const rmBefore = await styleOf('sessionRow', '::before')
      const rmAfter = await styleOf('sessionRow', '::after')
      const bRm = JSON.parse(await evaluate('JSON.stringify(window.__rect__("sessionRow"))'))
      const imgRm = await shoot()
      const rmCorner = countNear(imgRm, { x: bRm.x - 1, y: bRm.y - 1, w: 14, h: 14 }, accent, 30)
      await park()
      await hover('newSession')
      const rmArrow = await styleOf('newSession', '::after')
      await park()
      if ((rmBefore.content === 'none' || !rmBefore.content) && (rmAfter.content === 'none' || !rmAfter.content)
        && rmCorner === 0 && (!rmArrow.content || rmArrow.content === 'none')) {
        pass('reduce-motion · 两个角标与 CTA 箭头都不生成（含 ::before 与像素验证）')
      } else {
        fail('reduce-motion · 装饰仍有残留  [before=' + rmBefore.content + ' after=' + rmAfter.content
          + ' corner px=' + rmCorner + ' arrow=' + rmArrow.content + ']')
      }
      const holdRm = await press('plain', { release: false })
      const rmMid = await styleOf('plain')
      await holdRm.release()
      if (/brightness/.test(rmMid.filter) && rmMid.transform === 'none') {
        pass('reduce-motion · 颜色反馈保留、位移取消  [filter=' + rmMid.filter + ' transform=' + rmMid.transform + ']')
      } else {
        fail('reduce-motion · 应保留颜色反馈且无位移  [filter=' + rmMid.filter + ' transform=' + rmMid.transform + ']')
      }
    }
    await cdp.call('Emulation.setEmulatedMedia', { features: [] })

    await evaluate("document.body.setAttribute('data-endfield-motion','signal')")
  } catch (e) {
    console.error('ERROR ' + (e && e.stack || e))
    failures++
  } finally {
    if (cdp) cdp.close()
    try { proc.kill('SIGKILL') } catch (e) { /* already gone */ }
  }

  console.log(failures === 0 ? '\nall motion checks passed' : '\n' + failures + ' motion check(s) failed')
  process.exit(failures === 0 ? 0 : 1)
})()
