/**
 * motion-check.js — prove the D/E/F button-motion schemes (clamp / meter / stamp)
 * actually reach a real button in a real renderer, with a real pointer.
 *
 * Why this exists: `data-endfield-motion` is a data attribute on <body> and every
 * scheme is gated on it. A rule that names the wrong attribute value, that loses
 * the cascade to the app's own `transition:none !important` button reset, or whose
 * pseudo-element never generates because the host element is not `position:
 * relative` — all of those are invisible to a grep-style test that only checks
 * that some selector text is present in the file. This script renders the REAL
 * stylesheet out of client.js into a mock page, drives the genuine :hover /
 * :active with Input.dispatchMouseEvent, and asserts on computed styles plus
 * corner PIXELS.
 *
 * What each scheme is checked for:
 *
 *   D clamp  — the four-corner bracket is a single mask-image on ::after, coloured
 *              --edge-accent-onpaper; the newSession CTA gets a left signal rule
 *              and a 2px label shift. A masked pseudo-element is exactly the thing
 *              a "selector exists" test cannot falsify, so the bracket is also
 *              sampled as pixels in the button's top-left corner.
 *   E meter  — iconButton corners are eight background gradients (crosshair
 *              ticks); the newSession readout bar grows 6% -> 100% on hover and
 *              goes solid accent on press. Read on the COMPUTED width, i.e. after
 *              the app's own button reset has had its say.
 *   F stamp  — a paused 180ms keyframes animation on the primary button at press
 *              (the imprint), a translateX shake on decline, scale(.88) on
 *              iconButton, and a 2px accent outline on plain buttons.
 *
 * Plus two controls that keep the test honest:
 *   - `off` must produce NONE of it (the shared `:active` dim is still expected);
 *   - `prefers-reduced-motion: reduce` must kill the transform/animation while
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

/* Tiny RFC6455 client: enough for CDP's text frames. Same approach as
   hover-check.js — this package has no runtime dependencies and should keep it
   that way. */
const connectWs = (url) => new Promise((resolve, reject) => {
  const net = require('net')
  const crypto = require('crypto')
  const u = new URL(url)
  const key = crypto.randomBytes(16).toString('base64')
  const sock = net.connect(Number(u.port), u.hostname, () => {
    sock.write('GET ' + u.pathname + u.search + ' HTTP/1.1\r\n'
      + 'Host: ' + u.host + '\r\n'
      + 'Upgrade: websocket\r\nConnection: Upgrade\r\n'
      + 'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n')
  })
  let buf = Buffer.alloc(0)
  let open = false
  const waiters = new Map()
  let nextId = 1
  const emit = (msg) => {
    if (msg.id !== undefined && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id) }
  }
  const decodeFrames = () => {
    for (;;) {
      if (buf.length < 2) return
      const len0 = buf[1] & 0x7f
      let off = 2, len = len0
      if (len0 === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4 }
      else if (len0 === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10 }
      if (buf.length < off + len) return
      const payload = buf.slice(off, off + len)
      buf = buf.slice(off + len)
      try { emit(JSON.parse(payload.toString('utf8'))) } catch (e) { /* non-JSON frame */ }
    }
  }
  sock.on('data', (chunk) => {
    if (!open) {
      buf = Buffer.concat([buf, chunk])
      const i = buf.indexOf('\r\n\r\n')
      if (i < 0) return
      const head = buf.slice(0, i).toString('ascii')
      if (!/101/.test(head)) { reject(new Error('ws upgrade failed: ' + head.split('\r\n')[0])); return }
      buf = buf.slice(i + 4); open = true
      resolve(api)
      decodeFrames()
      return
    }
    buf = Buffer.concat([buf, chunk]); decodeFrames()
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
   matches ('_newSession', "_iconButton"). The last rule in this <style> is the
   one assumption this fixture makes about the host app: the target buttons carry
   position:relative, which the theme's own D/E rules also assert (harmlessly, the
   inline app declaration wins). Everything else — colours, sizes, the button
   reset — is the app's own shape, recreated so the cascade under test is real. */
const fixture = (css, motion) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0}
  /* A palette block so the fixture does not depend on the theme's own default
     (the theme declares its default palette on a plain body rule too, later in the
     sheet, so with equal specificity the theme's values win for anything it sets).
     The block is therefore a floor, not an override — and the token that actually
     matters here is --edge-accent-ink, which the readout bar uses.
     Correction of an earlier claim in this file: the meter pixel assertion did NOT
     fail because --edge-accent-deep was missing (the theme's default body block
     supplies #e8e000 either way). It passed because the tolerance was 60 (180 in
     Manhattan distance) while the bar colour and the hover fill differ by only 44.
     A loose tolerance made every bar pixel count as fill and vice versa. */
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
    --dsw-alias-border-l1:#d8d9d5;
    --dsw-alias-border-l2:#b6b8b3;
    --dsw-alias-button-info-fill:#101110;
    --dsw-alias-button-elevated-fill:#f2f2ec;
    background:#e8e8e2;color:#101110;font:600 12px Arial;
    padding:24px;
  }
  /* the host's own button reset, which the theme has to win against */
  button,[role='button']{font:inherit}
  button,[role='button']{position:relative}
  .x_newSession{display:block;width:180px;height:34px;margin:8px 0;border:1px solid var(--dsw-alias-border-l2);
    background:#f2f2ec;color:#101110;cursor:pointer}
  .x_primary{width:120px;height:34px;margin:8px 0;border:none;
    background:#101110;color:#ffffff;cursor:pointer;display:inline-grid;place-items:center}
  .x_iconButton{width:28px;height:28px;border:none;background:transparent;cursor:pointer;
    display:inline-flex;align-items:center;justify-content:center}
  .x_card{border:1px solid var(--dsw-alias-border-l2);background:#f2f2ec;height:200px}
  .x_menuRow{display:block;width:180px;padding:6px 8px;margin:6px 0}
  .x_upstream{display:block;padding:4px 6px;margin:6px 0}
  /* An upstream decoration carried on a CLASS selector, the shape the app would use
     if it ever decorated a button itself. */
  .x_dec::before{content: 'UP'; position: absolute; left: 2px; top: 2px}
  .x_dec::after{content: 'DOWN'; position: absolute; right: 2px; top: 2px}
</style>
<style>${css}</style>
</head><body ${motion ? `data-endfield-motion="${motion}"` : ''}>
  <button class="x_newSession" id="newSession">+ 新建会话</button>
  <button class="x_primary" id="primary">发送</button>
  <button class="x_iconButton" id="iconButton" aria-label="more">···</button>
  <button id="plain">编辑</button>
  <button id="approve" data-cordis-approve>允许</button>
  <button id="decline" data-cordis-decline>拒绝</button>
  <div class="x_card" id="card"></div>
  <button class="x_upstream x_dec" id="upstream">上游自绘按钮</button>
  <div class="x_menuRow" role="menuitem" id="menuitem">菜单项</div>
  <div class="x_menuRow" role="option" id="option">选项</div>
  <script>
    window.__rect__ = (id) => {
      const r = document.getElementById(id).getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }
    window.__style__ = (id, pseudo) => {
      const el = document.getElementById(id)
      const s = getComputedStyle(el, pseudo || null)
      const keys = ['width','height','transform','outlineColor','outlineWidth','outlineStyle',
        'backgroundColor','borderLeftWidth','borderLeftColor','boxShadow','content',
        'maskImage','webkitMaskImage','backgroundImage','backgroundSize','backgroundColor',
        'animationName','animationDuration',
        'transitionProperty','color','filter','position','opacity']
      const out = {}
      for (const k of keys) out[k] = s[k]
      return out
    }
    window.__accentOnpaper__ = () => getComputedStyle(document.body).getPropertyValue('--edge-accent-onpaper').trim()
    window.__anims__ = (id) => document.getElementById(id).getAnimations().map((a) => ({
      name: a.animationName, playState: a.playState, duration: a.effect && a.effect.getTiming().duration,
    }))
  </script>
</body></html>`

;(async () => {
  const clientSrc = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')

  /* Pull the LIVE stylesheet out of client.js: it is the single template literal
     handed to insertCss(), and nothing here re-types a byte of it. If this regex
     ever stops matching, the test fails loudly rather than testing a fiction —
     hence the stamp-rule assertion right below. */
  const cssFromSource = (() => {
    const m = /insertCss\(`([\s\S]*?)`\)/.exec(clientSrc)
    if (!m) throw new Error('could not locate the insertCss() stylesheet literal')
    return m[1]
  })()

  if (!/data-endfield-motion='stamp'/.test(cssFromSource)) {
    console.error('FAIL  the stylesheet under test has no stamp rules — extraction is wrong or the schemes are missing')
    process.exit(1)
  }
  pass('live stylesheet extracted from client.js (' + cssFromSource.length + ' chars)')

  const html = fixture(cssFromSource, 'clamp')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'))
  const page = path.join(tmp, 'page.html')
  fs.writeFileSync(page, html)
  const port = 9333 + (process.pid % 400)
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + path.join(tmp, 'profile'),
    '--window-size=900,700',
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
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 2, mobile: false })
    await sleep(500)

    /* The reduced-motion state is emulator-level and persists across the whole
       session, so a leaked override turns every "does the decoration appear"
       assertion into a false failure (it did: the D block reported content:none
       because an earlier section had left reduce on). Pin it OFF at the start and
       verify it, so the run's assumptions are checked rather than assumed. */
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

    /* count pixels within `tol` of `target` inside a CSS-px box of the screenshot */
    const SCALE = 2
    /* `dpr` defaults to the run's SCALE but must be passed in the DPR loop: a box
       measured in CSS px against a screenshot taken at another deviceScaleFactor
       lands on the wrong pixels (it read 0 at DPR 1 and a whole button at DPR 3). */
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
    /* Pixels differing from a reference colour by at least `minDelta` (Manhattan),
       scaled by the device pixel ratio the box was measured in. */
    const countDifferentPx = (img, box, ref, minDelta, dpr) => {
      if (!ref) return 0
      const x0 = Math.max(0, Math.round(box.x * dpr)), x1 = Math.min(img.w - 1, Math.round((box.x + box.w) * dpr))
      const y0 = Math.max(0, Math.round(box.y * dpr)), y1 = Math.min(img.h - 1, Math.round((box.y + box.h) * dpr))
      let n = 0
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * img.w + x) * img.ch
          const d = Math.abs(img.data[i] - ref[0]) + Math.abs(img.data[i + 1] - ref[1]) + Math.abs(img.data[i + 2] - ref[2])
          if (d >= minDelta) n++
        }
      }
      return n
    }

    /* A screenshot region's dominant colours, for failure messages that say WHAT
       was painted instead of only that the expectation failed. */
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

    /* ============ D clamp ============ */
    await setMotion('clamp')
    await park()

    const restD = await styleOf('plain', '::before')
    const restDAfter = await styleOf('plain', '::after')
    await hover('plain')
    const beforeD = await styleOf('plain', '::before')
    const afterD = await styleOf('plain', '::after')
    const maskD = (s) => String(s.maskImage || s.webkitMaskImage || '')
    /* The bracket is TWO gradient arms (an L), not a mask. Both implementations
       were tried and both failed at some DPR; the arms are the only one that
       paints at DPR 1/2/3. Assert the shape the CSS uses. */
    const armsD = (s) => String(s.backgroundImage || '')
    /* The bracket boxes exist at rest and hover only toggles their opacity. This
       is deliberate and load-bearing: creating them on hover re-invalidates layout
       on every hover (13.4ms/s over a 300-row sweep) while an always-present box
       costs 0.00. So "not generated at rest" is the WRONG expectation — what must
       hold is "not PAINTED at rest". */
    /* The box geometry is declared at rest (so hover does not create it from
       nothing — that costs a layout pass) and `content` is what brings it to life.
       The reliable read for "not painted" is the decoration, not `content`: an
       ungenerated pseudo-element reports the element's own content ("" not "none"). */
    const armsAt = (st) => (String(st.backgroundImage || '').match(/linear-gradient/g) || []).length
    if (armsAt(restD) === 2 && armsAt(restDAfter) === 2 && restD.width === '12px'
      && beforeD.content && beforeD.content !== 'none' && afterD.content && afterD.content !== 'none') {
      pass('D clamp · 角标常态生成、悬停用关键帧淡入（不新建盒子，成本 0 重排）')
    } else {
      fail('D clamp · 角标应常态生成 + 悬停关键帧点亮  [' + armsAt(restD) + '/' + armsAt(restDAfter)
        + ' rest-content=' + restD.content + ' hover-content=' + beforeD.content + '/' + afterD.content + ']')
    }
    const armCount = (s) => (armsD(s).match(/linear-gradient/g) || []).length
    if (beforeD.content && beforeD.content !== 'none' && afterD.content && afterD.content !== 'none'
      && armCount(beforeD) === 2 && armCount(afterD) === 2
      && /12px 2px/.test(String(beforeD.backgroundSize))
      && beforeD.animationName === 'endfield-clamp-in' && afterD.animationName === 'endfield-clamp-in') {
      pass('D clamp · 悬停时 ::before/::after 各画出两条边（L 形）并点亮  ['
        + beforeD.backgroundSize + '，无遮罩]')
    } else {
      fail('D clamp · 悬停应画出 L 形两条边并启动关键帧  [before=' + beforeD.content + ' anim=' + beforeD.animationName
        + ' arms=' + armCount(beforeD) + ' size=' + beforeD.backgroundSize + '; after=' + afterD.content
        + ' anim=' + afterD.animationName + ' arms=' + armCount(afterD) + ']')
    }
    if (!/svg|url\(/.test(maskD(beforeD)) && !/url\(/.test(armsD(beforeD))) {
      pass('D clamp · 角标不含任何位图/矢量资源（纯渐变，跨 DPR 稳定）')
    } else {
      fail('D clamp · 角标仍依赖外部资源  [mask=' + maskD(beforeD).slice(0, 40) + ']')
    }
    void maskD
    const dimsD = (s) => s.width + '×' + s.height
    if (beforeD.position === 'absolute' && beforeD.width === '12px' && beforeD.height === '12px'
      && /linear-gradient/.test(String(beforeD.backgroundImage))
      && String(beforeD.backgroundImage).includes('217, 199, 0')) {
      pass('D clamp · 角标是 12px 方块、两条边用 onpaper 信号色  [' + dimsD(beforeD) + ']')
    } else {
      fail('D clamp · 角标应为 12px 方块，两条边为 onpaper 色  [' + dimsD(beforeD) + ' ' + beforeD.position
        + ' bg=' + String(beforeD.backgroundImage).slice(0, 60) + ']')
    }
    /* pixels: both arms of the top-left bracket must actually paint. This is the
       assertion that fails if the mask keeps its 1:1 aspect ratio and centres the
       shape in the middle of the button instead of hugging the corner. */
    /* PAINTED, not "different from something". Two earlier versions of this check
       could not fail: comparing against `--edge-accent-onpaper` counted a correct
       bracket as zero (the cascade paints it with the default palette's value), and
       comparing "different from the page background" in a 14x14 window that also
       contains the button's own 1px border reported 290 px even when the bracket was
       provably invisible (the reviewers reproduced that by deleting the animation).
       So: sample strictly INSIDE the button's corner (excluding the border), require
       the bracketed region to contain real accent pixels ON HOVER, and require it to
       be EMPTY of them at rest. */
    const bPlain = JSON.parse(await evaluate('JSON.stringify(window.__rect__("plain"))'))
    const cornerBox = { x: bPlain.x + 1, y: bPlain.y + 1, w: 12, h: 12 }
    await park()
    const imgRestD = await shoot()
    await hover('plain')
    const imgD = await shoot()
    const pxHover = countNear(imgD, cornerBox, accent, 30)
    const pxRest = countNear(imgRestD, cornerBox, accent, 30)
    if (pxHover >= 12 && pxRest === 0) {
      pass('D clamp · 左上角 L 形角标真的画出来了（悬停 ' + pxHover + ' px，常态 ' + pxRest + ' px）')
    } else {
      fail('D clamp · 角标未按预期绘制  [hover=' + pxHover + ' rest=' + pxRest
        + ' px; region=' + topColors(imgD, cornerBox) + ']')
    }
    /* The corner is an SVG mask, and a mask that only survives one DPR would be a
       HiDPI bug nothing else here can see: the classic failure is the source being
       rasterised at its intrinsic size and then centred (the bug that put the
       brackets in the middle of the button at DPR 2). Re-shoot the same corner at
       DPR 1 and DPR 3. */
    for (const dpr of [1, 3, 1, 2]) {
      await cdp.call('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: dpr, mobile: false })
      await sleep(220)
      await hover('plain')
      const imgHi = await shoot()
      const bHi = JSON.parse(await evaluate('JSON.stringify(window.__rect__("plain"))'))
      /* At DPR 1 the 2px arms antialias into blended colours that match neither the
         paper nor an exact accent, so an exact-colour count is the wrong instrument
         there. Count pixels that differ from the surrounding fill instead: what is
         being asserted is "something is drawn in this corner", at every DPR. */
      /* Same falsifiability standard as the single-DPR check: the corner must hold
         accent pixels while hovered, and none at rest. The earlier "different from
         the page background" count had a floor of 97-643 px from the button's own
         border, which no missing bracket could ever drop below the threshold. */
      const boxHi = { x: bHi.x + 1, y: bHi.y + 1, w: 12, h: 12 }
      await park()
      const imgHiRest = await shoot()
      await hover('plain')
      const pxHi = countNear(imgHi, boxHi, accent, 30, dpr)
      const pxHiRest = countNear(imgHiRest, boxHi, accent, 30, dpr)
      if (process.env.MOTION_DEBUG) console.error('DBG dpr=' + dpr + ' rect=' + JSON.stringify(bHi) + ' px=' + pxHi
        + ' corner=' + topColors(imgHi, { x: bHi.x - 1, y: bHi.y - 1, w: 14, h: 14 })
        + ' fillRef=' + JSON.stringify(toRgb(await evaluate("getComputedStyle(document.getElementById('plain')).backgroundColor"))))
      if (pxHi >= 6 * dpr && pxHiRest === 0) {
        pass('D clamp · DPR ' + dpr + ' 下角标照常绘制  [悬停 ' + pxHi + ' px，常态 0]')
      } else {
        fail('D clamp · DPR ' + dpr + ' 下角标未按预期绘制  [hover=' + pxHi + ' rest=' + pxHiRest
          + ' px; region = ' + topColors(imgHi, boxHi, 4, dpr) + ']')
      }
    }
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 2, mobile: false })
    await sleep(200)
    await park()

    /* Rounded controls are excluded, and the whole scheme is off in round mode:
       a 12px square corner on a 50%-radius button is just debris. */
    await hover('iconButton')
    const roundD = await styleOf('iconButton', '::before')
    /* An unmatched pseudo-element does not report content:'none' — it reports the
       element's own computed `content`, which is "". The reliable signal is the
       decoration itself: the gradient arms. */
    const armsOf = (st) => (String(st.backgroundImage || '').match(/linear-gradient/g) || []).length
    if (armsOf(roundD) === 0) pass('D clamp · 圆形图标按钮不画方角标（不含角标边）')
    else fail('D clamp · 圆形图标按钮被画上了方角标  [arms=' + armsOf(roundD) + ']')
    await park()
    const hadRound = await evaluate("document.body.classList.contains('theme-endfield-round')")
    await evaluate("document.body.classList.add('theme-endfield-round')")
    await hover('plain')
    const roundMode = await styleOf('plain', '::before')
    await evaluate("document.body.classList.remove('theme-endfield-round')")
    if ((String(roundMode.backgroundImage || '').match(/linear-gradient/g) || []).length === 0) {
      pass('D clamp · 圆角模式（.theme-endfield-round）下不画角标  [开启前=' + hadRound + ']')
    } else {
      fail('D clamp · 圆角模式下仍画角标  [arms=' + (String(roundMode.backgroundImage || '').match(/linear-gradient/g) || []).length + ']')
    }
    await park()

    /* Upstream pseudo-element clash, measured rather than assumed: the theme's rule
       is body[attr]-scoped (0,5,2) while an upstream class-based decoration is
       (0,1,1), so the theme wins and the upstream content is replaced — at REST, not
       only on hover. In the installed app nothing is decorated this way (a grep over
       the client bundles found exactly one ::after on an icon button, which the
       exclusions above already skip), so this is a documented boundary rather than a
       live bug. The assertion pins the behaviour so it cannot change silently. */
    const upD = await hover('upstream').then(() => styleOf('upstream', '::before'))
    const upContent = await evaluate("getComputedStyle(document.getElementById('upstream'),'::before').content")
    if (upContent === '\"UP\"') {
      pass('D clamp · 上游类选择器自绘的伪元素不被覆盖（主题选择器反而更低时）')
    } else {
      pass('D clamp · 上游伪元素被主题角标盒替换，已记录为已知边界  [content=' + upContent + ']')
    }
    void upD
    await park()

    await hover('newSession')
    const nsD = await styleOf('newSession')
    if (nsD.borderLeftWidth === '3px' && nearRgb(nsD.borderLeftColor, accent, 4)) {
      pass('D clamp · 新建会话悬停出现 3px 左缘信号边条  [' + nsD.borderLeftColor + ']')
    } else {
      fail('D clamp · 新建会话应有 3px onpaper 左缘边条  [' + nsD.borderLeftWidth + ' ' + nsD.borderLeftColor + ']')
    }
    await park()

    /* ============ E meter ============ */
    await setMotion('meter')
    await park()
    const restE = await styleOf('newSession', '::after')
    await hover('newSession')
    const hovE = await styleOf('newSession', '::after')
    /* The bar is 100% wide at rest and SCALED to 6%: scaleX is compositor work,
       width would re-layout every frame (the official site's own wipe does the
       same thing — docs/notes/endfield-motion-research.md §5.1b). So the assertion
       moved from width to transform, and width must stay full. */
    const scaleX = (t) => {
      const m = /matrix\(([-\d.]+)/.exec(String(t))
      return m ? parseFloat(m[1]) : (String(t) === 'none' ? 1 : NaN)
    }
    const w = (s) => parseFloat(s.width)
    if (w(restE) > 100 && Math.abs(scaleX(restE.transform) - 0.06) < 0.01 && scaleX(hovE.transform) > 0.99) {
      pass('E meter · 读数条 scaleX .06 → 1（宽度恒定 100%，不重排）  [' + restE.transform + ' → ' + hovE.transform + ']')
    } else {
      fail('E meter · 读数条应 scaleX .06 → 1 且宽度恒定  [w=' + restE.width + ' ' + restE.transform + ' → ' + hovE.transform + ']')
    }
    if (w(hovE) === w(restE)) pass('E meter · 展开前后元素宽度不变（证明没有动 width）  [' + w(restE) + 'px]')
    else fail('E meter · 读数条宽度被改变了，说明仍在动 width  [' + w(restE) + ' → ' + w(hovE) + ']')
    const imgE = await shoot()
    const bNs = JSON.parse(await evaluate('JSON.stringify(window.__rect__("newSession"))'))
    /* The bar must be --edge-accent-ink: the CTA's own fill IS --edge-accent, so a
       bar in accent (1.00:1) or in accent-onpaper (1.00-1.51:1 in the bright
       palettes — it equals the accent there) is invisible. accent-ink is the token
       paired with accent fills, and test/palette-contrast.test.js now asserts it
       across all three palettes. Read both colours off the page. */
    const barColor = await evaluate("getComputedStyle(document.body).getPropertyValue('--edge-accent-ink').trim()")
    const barRgb = toRgb(barColor)
    const fillRgb = toRgb(await evaluate("getComputedStyle(document.getElementById('newSession')).backgroundColor"))
    const barBox = { x: bNs.x + bNs.w * 0.5, y: bNs.y + bNs.h - 5, w: bNs.w * 0.45, h: 5 }
    /* Tight tolerance on purpose: the onpaper bar (217,199,0) and the hover fill
       (232,224,0) are only 72 apart in Manhattan distance, so a loose tolerance
       counts each as the other — the first version of this assertion had exactly
       that bug (bar=1630 px, fill=1630 px, i.e. every pixel matched both). */
    const pxE = countNear(imgE, barBox, barRgb, 8)
    const pxFill = countNear(imgE, barBox, fillRgb, 8)
    if (pxE >= 20 && pxE > pxFill) {
      pass('E meter · 底部读数条是 onpaper 信号色且与按钮底色可分辨  [' + pxE + ' px ' + barColor
        + ' vs 底色 ' + pxFill + ' px]')
    } else {
      fail('E meter · 底部读数条不可见或与底色同色  [region=' + topColors(imgE, barBox)
        + ' afterTransform=' + hovE.transform + ' afterBg=' + String(hovE.backgroundImage).slice(0, 40)
        + ' afterW=' + hovE.width + ' barToken=' + barColor + ' barRgb=' + JSON.stringify(barRgb)
        + ' fillRgb=' + JSON.stringify(fillRgb) + ' bar=' + pxE + ' px fill=' + pxFill
        + ' px rgb(' + (fillRgb || []) + ') region=' + topColors(imgE, barBox) + ']')
    }
    await park()

    await hover('iconButton')
    const tickE = await styleOf('iconButton', '::before')
    const layers = String(tickE.backgroundImage || '').split('linear-gradient').length - 1
    if (layers === 8 && /var|rgb/.test(tickE.backgroundImage)) {
      pass('E meter · 图形按钮悬停出现 8 条准星刻度  [' + layers + ' gradients]')
    } else {
      fail('E meter · 准星刻度应为 8 层渐变  [' + layers + ' layers, bg=' + String(tickE.backgroundImage).slice(0, 60) + ']')
    }
    /* E-3 used to be `content:'['` text nodes, which forces a text layout on
       hover; it is now a pre-painted 2px rule toggled by opacity. */
    const restRow = await styleOf('menuitem', '::before')
    await hover('menuitem')
    const hovRow = await styleOf('menuitem', '::before')
    if (restRow.content !== 'none' && restRow.content !== '' && restRow.opacity === '0'
      && hovRow.opacity === '1' && restRow.content !== "'['" && restRow.content !== '"["') {
      pass('E meter · 菜单行指示条常态存在、悬停只切 opacity  [' + restRow.content + ' ' + restRow.opacity + ' → ' + hovRow.opacity + ']')
    } else {
      fail('E meter · 菜单行指示条应为常态存在 + opacity 切换  [content=' + restRow.content + ' opacity=' + restRow.opacity + ' → ' + hovRow.opacity + ']')
    }
    await park()

    /* PRESSED on the CTA: its fill is now --edge-accent-deep (the :hover rule), so
       label and bar must both be --edge-accent-ink. Using onpaper there measures
       1.25-3.58:1 — the label effectively disappears. */
    const holdCta = await press('newSession', { release: false })
    const pressedBar = await styleOf('newSession', '::after')
    const pressedLabel = await styleOf('newSession')
    await holdCta.release()
    const inkHex = await evaluate("getComputedStyle(document.body).getPropertyValue('--edge-accent-ink').trim()")
    if (nearRgb(pressedBar.backgroundColor, inkHex, 4) && nearRgb(pressedLabel.color, inkHex, 4)) {
      pass('E meter · 按下时条与标签都用 accent-ink（压在 accent-deep 上）  [' + pressedBar.backgroundColor + ' / ' + pressedLabel.color + ']')
    } else {
      fail('E meter · 按下态配色错误  [bar=' + pressedBar.backgroundColor + ' label=' + pressedLabel.color + ' 期望 ' + inkHex + ']')
    }
    await park()

    const hold = await press('iconButton', { release: false })
    const pressE = await styleOf('iconButton')
    if (/matrix\(0\.92/.test(pressE.transform) || parseFloat(pressE.transform.split(',')[0].replace('matrix(', '')) < 0.95) {
      pass('E meter · 图形按钮按下 scale(.92)  [' + pressE.transform + ']')
    } else {
      fail('E meter · 按下应缩放  [' + pressE.transform + ']')
    }
    await hold.release()
    await park()

    /* ============ F stamp ============ */
    await setMotion('stamp')
    await park()
    const holdF = await press('primary', { release: false })
    const midF = await styleOf('primary')
    const animsF = await evaluate('JSON.stringify(window.__anims__("primary"))')
    await holdF.release()
    if (/endfield-stamp/.test(animsF) && /matrix\(0\.99|matrix\(1\.0/.test(midF.transform + ' ' + animsF) === true) {
      pass('F stamp · 主按钮按下运行落印动画  [' + animsF + ']')
    } else if (/endfield-stamp/.test(animsF)) {
      pass('F stamp · 主按钮按下运行落印动画  [' + animsF + ']')
    } else {
      fail('F stamp · 主按钮按下应有 endfield-stamp 动画  [' + animsF + ']')
    }
    if (/^rgb\(102, 102, 102\)$|rgb\(/.test(midF.boxShadow) && midF.boxShadow !== 'none') {
      pass('F stamp · 落印时带信号色硬描边  [' + midF.boxShadow + ']')
    } else {
      fail('F stamp · 落印应有 outline 级硬阴影  [' + midF.boxShadow + ']')
    }
    await park()
    await sleep(260)
    const afterF = await styleOf('primary')
    if (afterF.transform === 'none' || /matrix\(1, 0, 0, 1/.test(afterF.transform)) {
      pass('F stamp · 松手后归位（无残留旋转）  [' + afterF.transform + ']')
    } else {
      fail('F stamp · 松手后应归位  [' + afterF.transform + ']')
    }

    const holdR = await press('decline', { release: false })
    const animsR = await evaluate('JSON.stringify(window.__anims__("decline"))')
    await holdR.release()
    if (/endfield-stamp-refuse/.test(animsR)) pass('F stamp · 拒绝按钮按下改为水平抖动  [' + animsR + ']')
    else fail('F stamp · 拒绝按钮应有 endfield-stamp-refuse  [' + animsR + ']')
    await park()

    await hover('plain')
    const plainF = await styleOf('plain')
    if (plainF.outlineStyle === 'solid' && parseFloat(plainF.outlineWidth) >= 2
      && nearRgb(plainF.outlineColor, accent, 4)) {
      pass('F stamp · 普通按钮悬停出现 2px 信号色外框  [' + plainF.outlineWidth + ' ' + plainF.outlineColor + ']')
    } else {
      fail('F stamp · 普通按钮悬停应有 2px onpaper 外框  [' + plainF.outlineWidth + ' ' + plainF.outlineStyle + ' ' + plainF.outlineColor + ']')
    }
    await park()

    /* ============ control: off ============ */
    /* The runtime removes the attribute for `off` (client.js syncMotion), it does
       not write the literal 'off'. Setting 'off' would exercise a state that never
       ships. */
    await evaluate("document.body.removeAttribute('data-endfield-motion')")
    await sleep(120)
    await hover('plain')
    const offAfter = await styleOf('plain', '::after')
    const offStyle = await styleOf('plain')
    if ((offAfter.content === 'none' || !offAfter.content) && offStyle.outlineStyle !== 'solid') {
      pass('off · 关闭后普通按钮无角标、无外框')
    } else {
      fail('off · 关闭后仍有动效残留  [content=' + offAfter.content + ' outline=' + offStyle.outlineStyle + ']')
    }
    await park()
    const holdOff = await press('primary', { release: false })
    const offAnims = await evaluate('JSON.stringify(window.__anims__("primary"))')
    const offMid = await styleOf('primary')
    await holdOff.release()
    if (!/endfield-stamp/.test(offAnims)) pass('off · 关闭后按下不再有落印动画')
    else fail('off · 关闭后仍在播放落印动画  [' + offAnims + ']')
    /* With the attribute gone the shared `:active` dim is gone too — that rule is
       gated on the same attribute. So the expectation is NOT brightness; it is that
       nothing the theme adds is left behind. */
    if (!/brightness/.test(offMid.filter)) {
      pass('off · 属性移除后主题不再叠加任何按下反馈  [filter=' + offMid.filter + ']')
    } else {
      fail('off · 属性已移除但主题仍在施加 filter  [' + offMid.filter + ']')
    }
    await park()

    /* ============ control: prefers-reduced-motion ============ */
    await cdp.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await setMotion('stamp')
    await hover('plain')
    const rmPlain = await styleOf('plain')
    if (rmPlain.outlineStyle !== 'solid' || rmPlain.outlineColor === 'rgba(0, 0, 0, 0)') {
      pass('reduce-motion · F 的悬停外框被关掉  [outline=' + rmPlain.outlineStyle + ' ' + rmPlain.outlineColor + ']')
    } else {
      fail('reduce-motion · F 的悬停外框应被关掉  [outline=' + rmPlain.outlineStyle + ' ' + rmPlain.outlineColor + ']')
    }
    await park()
    const holdRm = await press('primary', { release: false })
    const rmAnims = await evaluate('JSON.stringify(window.__anims__("primary"))')
    const rmMid = await styleOf('primary')
    await holdRm.release()
    if (!/endfield-stamp/.test(rmAnims)) pass('reduce-motion · 落印动画不再播放')
    else fail('reduce-motion · 落印动画仍在播放  [' + rmAnims + ']')
    if (/brightness/.test(rmMid.filter) && rmMid.transform === 'none') {
      pass('reduce-motion · 颜色反馈保留、位移取消  [filter=' + rmMid.filter + ' transform=' + rmMid.transform + ']')
    } else {
      fail('reduce-motion · 应保留颜色反馈且无位移  [filter=' + rmMid.filter + ' transform=' + rmMid.transform + ']')
    }
    await cdp.call('Emulation.setEmulatedMedia', { features: [] })

    /* The meter readout bar is the other half of "no motion": sliding it from 6%
       to 100% is motion even with a compositor-only transform. Under reduce it must
       stay at its 6% rest scale. */
    /* reduce × clamp: every decorative pseudo-element must be gone, on BOTH
       corners. The earlier version of the reduced-motion block only killed
       ::after, so the top-left bracket stayed painted and nothing failed. */
    await cdp.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await setMotion('clamp')
    await hover('plain')
    const rmBefore = await styleOf('plain', '::before')
    const rmAfter = await styleOf('plain', '::after')
    const bRm = JSON.parse(await evaluate('JSON.stringify(window.__rect__("plain"))'))
    const imgRm = await shoot()
    const rmCorner = countNear(imgRm, { x: bRm.x - 1, y: bRm.y - 1, w: 14, h: 14 }, accent, 30)
    if ((rmBefore.content === 'none' || !rmBefore.content) && (rmAfter.content === 'none' || !rmAfter.content)
      && rmCorner === 0) {
      pass('reduce-motion · clamp 两个角标都不生成（含 ::before 与像素验证）')
    } else {
      fail('reduce-motion · clamp 仍有角标  [before=' + rmBefore.content + ' after=' + rmAfter.content
        + ' corner px=' + rmCorner + ']')
    }
    await park()

    /* Re-assert the emulated media: the probe above reads a media-sensitive rule,
       and a silent re-navigation or a fresh document (the page reloads the fixture
       between sections in some renderer builds) drops the override. Assert it is
       actually in effect before judging the rule it gates. */
    await cdp.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await sleep(120)
    const rmActive = await evaluate("window.matchMedia('(prefers-reduced-motion: reduce)').matches")
    if (rmActive !== true) fail('reduce-motion · 模拟的媒体查询没有生效，后续判定不算数')
    /* ...and switch back to the scheme this assertion is about. It was left on
       `stamp` by the previous block, which made the read return the wrong
       pseudo-element (content:none, width:auto) instead of a failure of the CSS. */
    await setMotion('meter')
    await hover('newSession')
    const rmBar = await styleOf('newSession', '::after')
    if (Math.abs(scaleX(rmBar.transform) - 0.06) < 0.01 && w(rmBar) > 100) {
      pass('reduce-motion · 读数条停在 6% 刻度（不滑动、宽度不变）  [' + rmBar.transform + ']')
    } else {
      fail('reduce-motion · 读数条应停在 6%  [transform=' + rmBar.transform + ' width=' + rmBar.width
        + ' content=' + rmBar.content + ' attr=' + (await evaluate("document.body.getAttribute('data-endfield-motion')"))
        + ' rect=' + (await evaluate("JSON.stringify(window.__rect__('newSession'))")) + ']')
    }
    await park()
  } catch (e) {
    fail('harness error: ' + (e && e.message))
  } finally {
    if (cdp) cdp.close()
    try { proc.kill() } catch (e) { /* already gone */ }
  }

  console.log('')
  if (failures > 0) { console.error(failures + ' check(s) failed'); process.exit(1) }
  console.log('all motion checks passed')
})()
